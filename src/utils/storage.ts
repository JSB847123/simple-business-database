import { Location } from '../types/location';
import { AppSettings } from '../types/location';

const STORAGE_KEY = 'fieldReportLocations';
const SETTINGS_KEY = 'fieldReportSettings';
const DB_NAME = 'FieldReportDB';
const DB_VERSION = 1;
const STORE_NAME = 'locations';

// 기본 설정
const DEFAULT_SETTINGS: AppSettings = {
  autoSaveEnabled: false,
  autoSaveInterval: 3
};

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

// 설정 관련 함수들
export const loadSettings = (): AppSettings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};

// 스토리지 상태 진단 함수
export const diagnoseStorage = async (): Promise<{
  localStorageSize: number;
  indexedDBSize: number;
  quotaUsed: number;
  quotaTotal: number;
  localStorageWorking: boolean;
  indexedDBWorking: boolean;
  localCount: number;
  indexedDBCount: number;
}> => {
  const result = {
    localStorageSize: 0,
    indexedDBSize: 0,
    quotaUsed: 0,
    quotaTotal: 0,
    localStorageWorking: false,
    indexedDBWorking: false,
    localCount: 0,
    indexedDBCount: 0
  };

  // localStorage 진단
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      result.localStorageSize = new Blob([localData]).size;
      result.localCount = JSON.parse(localData).length;
    }
    
    // localStorage 쓰기 테스트
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    result.localStorageWorking = true;
  } catch (error) {
    console.error('localStorage 진단 실패:', error);
  }

  // IndexedDB 진단
  try {
    const indexedDBData = await loadFromIndexedDB();
    result.indexedDBCount = indexedDBData.length;
    result.indexedDBSize = new Blob([JSON.stringify(indexedDBData)]).size;
    result.indexedDBWorking = true;
  } catch (error) {
    console.error('IndexedDB 진단 실패:', error);
  }

  // 스토리지 쿼터 확인
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      result.quotaUsed = estimate.usage || 0;
      result.quotaTotal = estimate.quota || 0;
    }
  } catch (error) {
    console.error('쿼터 확인 실패:', error);
  }

  return result;
};

// 안전한 저장 함수 (개별 저장 방식)
export const saveLocationSafely = async (location: Location): Promise<void> => {
  try {
    // 1. 기존 데이터 로드
    const existingLocations = await loadLocations();
    
    // 2. 해당 위치 찾기 또는 추가
    const existingIndex = existingLocations.findIndex(loc => loc.id === location.id);
    let updatedLocations;
    
    if (existingIndex >= 0) {
      updatedLocations = [...existingLocations];
      updatedLocations[existingIndex] = location;
    } else {
      updatedLocations = [location, ...existingLocations];
    }

    // 3. IndexedDB에 개별 저장 (더 안전함)
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // 개별 위치만 저장/업데이트 (전체 클리어 방식보다 안전)
      await new Promise((resolve, reject) => {
        const request = store.put(location);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      
      console.log(`위치 ${location.id} IndexedDB 저장 완료`);
    } catch (error) {
      console.error('IndexedDB 개별 저장 실패:', error);
    }

    // 4. localStorage에 전체 저장 (백업용)
    try {
      const dataToSave = JSON.stringify(updatedLocations);
      const dataSize = new Blob([dataToSave]).size;
      
      // 5MB 이상이면 localStorage 저장 건너뛰기
      if (dataSize < 5 * 1024 * 1024) {
        localStorage.setItem(STORAGE_KEY, dataToSave);
        console.log(`localStorage 저장 완료 (크기: ${Math.round(dataSize / 1024)}KB)`);
      } else {
        console.warn('데이터가 너무 커서 localStorage 저장 건너뜀');
      }
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage 용량 초과, IndexedDB만 사용');
        // localStorage 정리 시도
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.setItem(STORAGE_KEY, JSON.stringify([location])); // 최소한 현재 데이터라도 저장
        } catch (cleanupError) {
          console.error('localStorage 정리 실패:', cleanupError);
        }
      } else {
        console.error('localStorage 저장 실패:', error);
      }
    }
  } catch (error) {
    console.error('안전한 저장 실패:', error);
    throw error;
  }
};

// 데이터 복구 시도 함수
export const attemptDataRecovery = async (): Promise<Location[]> => {
  console.log('데이터 복구 시도 중...');
  
  const recoveredData: Location[] = [];
  
  // 1. IndexedDB에서 복구 시도
  try {
    const indexedDBData = await loadFromIndexedDB();
    if (indexedDBData.length > 0) {
      recoveredData.push(...indexedDBData);
      console.log(`IndexedDB에서 ${indexedDBData.length}개 위치 복구`);
    }
  } catch (error) {
    console.error('IndexedDB 복구 실패:', error);
  }

  // 2. localStorage에서 복구 시도
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      const parsed = JSON.parse(localData);
      const localLocations = Array.isArray(parsed) ? parsed : [];
      
      // 중복 제거하면서 병합
      for (const localLocation of localLocations) {
        const existsInRecovered = recoveredData.find(loc => loc.id === localLocation.id);
        if (!existsInRecovered) {
          recoveredData.push(localLocation);
        } else {
          // 더 최신 데이터 유지
          const recoveredIndex = recoveredData.findIndex(loc => loc.id === localLocation.id);
          if (localLocation.lastSaved && localLocation.lastSaved > (existsInRecovered.lastSaved || 0)) {
            recoveredData[recoveredIndex] = localLocation;
          }
        }
      }
      console.log(`localStorage에서 추가 복구, 총 ${recoveredData.length}개 위치`);
    }
  } catch (error) {
    console.error('localStorage 복구 실패:', error);
  }

  // 3. Service Worker의 긴급 저장 데이터 확인
  try {
    const emergencyDB = indexedDB.open('FieldReportDB', 1);
    emergencyDB.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('Service Worker 긴급 저장 데이터 확인 완료');
    };
  } catch (error) {
    console.error('Service Worker 데이터 확인 실패:', error);
  }

  return recoveredData.sort((a, b) => (b.lastSaved || b.timestamp) - (a.lastSaved || a.timestamp));
};
