import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Location } from '../types/location';

// IndexedDB 스키마 정의
interface FieldReportDB extends DBSchema {
  locations: {
    key: string;
    value: Location;
    indexes: { 'by-timestamp': number; 'by-lastSaved': number };
  };
  photos: {
    key: string;
    value: Blob;
  };
  metadata: {
    key: string;
    value: {
      name: string;
      timestamp: number;
      size: number;
      locationId: string;
      floorId: string;
    };
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'FieldReportDB';
const DB_VERSION = 2;

// 데이터베이스 초기화
const initDB = async (): Promise<IDBPDatabase<FieldReportDB>> => {
  return openDB<FieldReportDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`DB 업그레이드: ${oldVersion} → ${newVersion}`);
      
      // Locations store
      if (!db.objectStoreNames.contains('locations')) {
        const locationStore = db.createObjectStore('locations', { keyPath: 'id' });
        locationStore.createIndex('by-timestamp', 'timestamp');
        locationStore.createIndex('by-lastSaved', 'lastSaved');
      }
      
      // Photos store (Binary data)
      if (!db.objectStoreNames.contains('photos')) {
        db.createObjectStore('photos', { keyPath: undefined });
      }
      
      // Photo metadata store
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: undefined });
      }
      
      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: undefined });
      }
    },
  });
};

// ===== 위치 데이터 관리 =====

export const saveLocation = async (location: Location): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction('locations', 'readwrite');
  
  // lastSaved 타임스탬프 추가
  const locationWithTimestamp = {
    ...location,
    lastSaved: Date.now()
  };
  
  await tx.store.put(locationWithTimestamp);
  await tx.done;
  
  console.log(`위치 ${location.id} IndexedDB 저장 완료`);
};

export const loadAllLocations = async (): Promise<Location[]> => {
  try {
    const db = await initDB();
    const locations = await db.getAll('locations');
    
    // 최근 저장 순으로 정렬
    locations.sort((a, b) => (b.lastSaved || b.timestamp) - (a.lastSaved || a.timestamp));
    
    console.log(`${locations.length}개 위치 로드 완료`);
    return locations;
  } catch (error) {
    console.error('위치 로드 실패:', error);
    return [];
  }
};

export const getLocation = async (id: string): Promise<Location | undefined> => {
  const db = await initDB();
  return db.get('locations', id);
};

export const deleteLocation = async (id: string): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(['locations', 'photos', 'metadata'], 'readwrite');
  
  // 위치 삭제
  await tx.objectStore('locations').delete(id);
  
  // 관련 사진들도 삭제
  const allMetadata = await tx.objectStore('metadata').getAll();
  const relatedPhotos = allMetadata.filter(meta => meta.locationId === id);
  
  for (const photo of relatedPhotos) {
    await tx.objectStore('photos').delete(photo.name);
    await tx.objectStore('metadata').delete(photo.name);
  }
  
  await tx.done;
  console.log(`위치 ${id} 및 관련 사진들 삭제 완료`);
};

// ===== 사진 관리 (Blob 기반) =====

export const savePhotoBlob = async (
  photoId: string, 
  blob: Blob, 
  metadata: {
    name: string;
    locationId: string;
    floorId: string;
  }
): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(['photos', 'metadata'], 'readwrite');
  
  // Binary 데이터 저장
  await tx.objectStore('photos').put(blob, photoId);
  
  // 메타데이터 저장
  await tx.objectStore('metadata').put({
    name: metadata.name,
    timestamp: Date.now(),
    size: blob.size,
    locationId: metadata.locationId,
    floorId: metadata.floorId
  }, photoId);
  
  await tx.done;
  console.log(`사진 ${photoId} Blob 저장 완료 (${Math.round(blob.size / 1024)}KB)`);
};

export const loadPhotoBlob = async (photoId: string): Promise<Blob | null> => {
  try {
    const db = await initDB();
    const blob = await db.get('photos', photoId);
    return blob || null;
  } catch (error) {
    console.error(`사진 ${photoId} 로드 실패:`, error);
    return null;
  }
};

export const deletePhotoBlob = async (photoId: string): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(['photos', 'metadata'], 'readwrite');
  
  await tx.objectStore('photos').delete(photoId);
  await tx.objectStore('metadata').delete(photoId);
  
  await tx.done;
  console.log(`사진 ${photoId} 삭제 완료`);
};

// ===== Blob URL 관리 =====

const urlCache = new Map<string, string>();

export const createPhotoUrl = async (photoId: string): Promise<string | null> => {
  // 캐시 확인
  if (urlCache.has(photoId)) {
    return urlCache.get(photoId)!;
  }
  
  // IndexedDB에서 Blob 로드
  const blob = await loadPhotoBlob(photoId);
  if (!blob) return null;
  
  // Blob URL 생성 및 캐싱
  const url = URL.createObjectURL(blob);
  urlCache.set(photoId, url);
  
  return url;
};

export const revokePhotoUrl = (photoId: string): void => {
  const url = urlCache.get(photoId);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(photoId);
  }
};

export const revokeAllPhotoUrls = (): void => {
  urlCache.forEach(url => URL.revokeObjectURL(url));
  urlCache.clear();
};

// ===== 설정 관리 =====

export const saveSetting = async (key: string, value: any): Promise<void> => {
  const db = await initDB();
  await db.put('settings', value, key);
};

export const loadSetting = async <T>(key: string, defaultValue: T): Promise<T> => {
  try {
    const db = await initDB();
    const value = await db.get('settings', key);
    return value !== undefined ? value : defaultValue;
  } catch (error) {
    console.error(`설정 ${key} 로드 실패:`, error);
    return defaultValue;
  }
};

// ===== 저장소 통계 =====

export const getStorageStats = async () => {
  try {
    const db = await initDB();
    
    const locationCount = await db.count('locations');
    const photoCount = await db.count('photos');
    
    const allMetadata = await db.getAll('metadata');
    const totalPhotoSize = allMetadata.reduce((sum, meta) => sum + meta.size, 0);
    
    return {
      locations: locationCount,
      photos: photoCount,
      totalSizeMB: Math.round(totalPhotoSize / 1024 / 1024 * 100) / 100,
      totalSizeKB: Math.round(totalPhotoSize / 1024)
    };
  } catch (error) {
    console.error('저장소 통계 조회 실패:', error);
    return { locations: 0, photos: 0, totalSizeMB: 0, totalSizeKB: 0 };
  }
};

// ===== 마이그레이션 (localStorage → IndexedDB) =====

export const migrateFromLocalStorage = async (): Promise<{
  success: number;
  failed: number;
  totalSize: number;
}> => {
  const result = { success: 0, failed: 0, totalSize: 0 };
  
  try {
    // localStorage에서 위치 데이터 가져오기
    const localData = localStorage.getItem('fieldReportLocations');
    if (!localData) {
      console.log('localStorage에 데이터가 없습니다.');
      return result;
    }
    
    const locations: Location[] = JSON.parse(localData);
    console.log(`${locations.length}개 위치 마이그레이션 시작...`);
    
    for (const location of locations) {
      try {
        // 위치 데이터에서 Base64 사진들을 Blob으로 변환
        for (const floor of location.floors) {
          for (const photo of floor.photos) {
            if (photo.data && photo.data.startsWith('data:image/')) {
              try {
                // Base64 → Blob 변환
                const response = await fetch(photo.data);
                const blob = await response.blob();
                
                // IndexedDB에 Blob으로 저장
                await savePhotoBlob(photo.id, blob, {
                  name: photo.name,
                  locationId: location.id,
                  floorId: floor.id
                });
                
                // Base64 데이터 제거 (메모리 절약)
                delete photo.data;
                
                result.success++;
                result.totalSize += blob.size;
              } catch (error) {
                console.error(`사진 ${photo.id} 마이그레이션 실패:`, error);
                result.failed++;
              }
            }
          }
        }
        
        // 위치 데이터 저장
        await saveLocation(location);
        
      } catch (error) {
        console.error(`위치 ${location.id} 마이그레이션 실패:`, error);
        result.failed++;
      }
    }
    
    console.log(`마이그레이션 완료: 성공 ${result.success}, 실패 ${result.failed}`);
    
    // localStorage 정리 (선택적)
    // localStorage.removeItem('fieldReportLocations');
    
  } catch (error) {
    console.error('마이그레이션 실패:', error);
  }
  
  return result;
};

// ===== 데이터 정리 =====

export const clearAllData = async (): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction(['locations', 'photos', 'metadata', 'settings'], 'readwrite');
  
  await tx.objectStore('locations').clear();
  await tx.objectStore('photos').clear();
  await tx.objectStore('metadata').clear();
  // settings는 유지
  
  await tx.done;
  
  // URL 캐시도 정리
  revokeAllPhotoUrls();
  
  console.log('모든 데이터 정리 완료');
}; 