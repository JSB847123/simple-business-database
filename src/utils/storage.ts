import { Location } from '../types/location';

const STORAGE_KEY = 'fieldReportLocations';
const DB_NAME = 'FieldReportDB';
const DB_VERSION = 1;
const STORE_NAME = 'locations';

// IndexedDB 초기화
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// IndexedDB에서 데이터 로드
const loadFromIndexedDB = async (): Promise<Location[]> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const locations = request.result || [];
        resolve(locations.sort((a, b) => b.timestamp - a.timestamp));
      };
    });
  } catch (error) {
    console.error('Error loading from IndexedDB:', error);
    return [];
  }
};

// IndexedDB에 데이터 저장
const saveToIndexedDB = async (locations: Location[]): Promise<void> => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // 기존 데이터 클리어
    await new Promise((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onerror = () => reject(clearRequest.error);
      clearRequest.onsuccess = () => resolve(clearRequest.result);
    });
    
    // 새 데이터 저장
    for (const location of locations) {
      await new Promise((resolve, reject) => {
        const addRequest = store.add(location);
        addRequest.onerror = () => reject(addRequest.error);
        addRequest.onsuccess = () => resolve(addRequest.result);
      });
    }
    
    console.log(`Successfully saved ${locations.length} locations to IndexedDB`);
  } catch (error) {
    console.error('Error saving to IndexedDB:', error);
  }
};

export const loadLocations = async (): Promise<Location[]> => {
  try {
    // 1차: localStorage에서 로드
    const localData = localStorage.getItem(STORAGE_KEY);
    let locations: Location[] = [];
    
    if (localData) {
      const parsed = JSON.parse(localData);
      locations = Array.isArray(parsed) ? parsed : [];
    }
    
    // 2차: IndexedDB에서 로드 (localStorage가 비어있거나 실패한 경우)
    if (locations.length === 0) {
      const indexedDBData = await loadFromIndexedDB();
      if (indexedDBData.length > 0) {
        locations = indexedDBData;
        // localStorage에 백업
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
        } catch (error) {
          console.warn('Failed to backup to localStorage:', error);
        }
      }
    }
    
    console.log(`Loaded ${locations.length} locations`);
    return locations;
  } catch (error) {
    console.error('Error loading locations:', error);
    return [];
  }
};

export const saveLocations = async (locations: Location[]): Promise<void> => {
  try {
    // 1차: localStorage에 저장
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
    
    // 2차: IndexedDB에 저장 (백업)
    await saveToIndexedDB(locations);
    
    console.log(`Saved ${locations.length} locations`);
  } catch (error) {
    console.error('Error saving locations:', error);
    throw error;
  }
};

// 데이터 동기화 (앱 시작 시 호출)
export const syncStorageData = async (): Promise<void> => {
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    const indexedDBData = await loadFromIndexedDB();
    
    if (!localData && indexedDBData.length > 0) {
      // localStorage가 비어있지만 IndexedDB에 데이터가 있는 경우
      localStorage.setItem(STORAGE_KEY, JSON.stringify(indexedDBData));
      console.log('Synced data from IndexedDB to localStorage');
    } else if (localData && indexedDBData.length === 0) {
      // localStorage에는 데이터가 있지만 IndexedDB가 비어있는 경우
      const locations = JSON.parse(localData);
      await saveToIndexedDB(locations);
      console.log('Synced data from localStorage to IndexedDB');
    }
  } catch (error) {
    console.error('Error syncing storage data:', error);
  }
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
