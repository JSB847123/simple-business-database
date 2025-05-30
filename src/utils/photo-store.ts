import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface PhotoDB extends DBSchema {
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
    };
  };
}

const DB_NAME = 'field-report-photos';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PhotoDB>> | null = null;

const getDB = (): Promise<IDBPDatabase<PhotoDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<PhotoDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 사진 데이터 저장소
        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos');
        }
        // 메타데이터 저장소
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
      },
    });
  }
  return dbPromise;
};

export const savePhoto = async (id: string, blob: Blob, name: string): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction(['photos', 'metadata'], 'readwrite');
    
    // 사진 데이터 저장
    await tx.objectStore('photos').put(blob, id);
    
    // 메타데이터 저장
    await tx.objectStore('metadata').put({
      name,
      timestamp: Date.now(),
      size: blob.size
    }, id);
    
    await tx.done;
    console.log(`Photo ${id} saved successfully (${Math.round(blob.size / 1024)}KB)`);
  } catch (error) {
    console.error('Failed to save photo:', error);
    throw new Error(`사진 저장 실패: ${error}`);
  }
};

export const loadPhoto = async (id: string): Promise<Blob | undefined> => {
  try {
    const db = await getDB();
    return await db.get('photos', id);
  } catch (error) {
    console.error('Failed to load photo:', error);
    return undefined;
  }
};

export const loadPhotoMetadata = async (id: string) => {
  try {
    const db = await getDB();
    return await db.get('metadata', id);
  } catch (error) {
    console.error('Failed to load photo metadata:', error);
    return undefined;
  }
};

export const deletePhoto = async (id: string): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction(['photos', 'metadata'], 'readwrite');
    
    await tx.objectStore('photos').delete(id);
    await tx.objectStore('metadata').delete(id);
    
    await tx.done;
    console.log(`Photo ${id} deleted successfully`);
  } catch (error) {
    console.error('Failed to delete photo:', error);
    throw new Error(`사진 삭제 실패: ${error}`);
  }
};

export const getAllPhotoIds = async (): Promise<string[]> => {
  try {
    const db = await getDB();
    return await db.getAllKeys('photos') as string[];
  } catch (error) {
    console.error('Failed to get photo IDs:', error);
    return [];
  }
};

export const getStorageStats = async () => {
  try {
    const db = await getDB();
    const photoIds = await db.getAllKeys('photos');
    let totalSize = 0;
    
    for (const id of photoIds) {
      const metadata = await db.get('metadata', id as string);
      if (metadata) {
        totalSize += metadata.size;
      }
    }
    
    return {
      count: photoIds.length,
      totalSize,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
    };
  } catch (error) {
    console.error('Failed to get storage stats:', error);
    return { count: 0, totalSize: 0, totalSizeMB: 0 };
  }
};

// Base64 데이터를 Blob으로 변환하는 유틸리티
export const base64ToBlob = (base64Data: string): Blob => {
  const arr = base64Data.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
};

// 마이그레이션: localStorage Base64 → IndexedDB Blob
export const migrateFromLocalStorage = async (): Promise<{
  success: number;
  failed: number;
  totalSize: number;
}> => {
  const result = { success: 0, failed: 0, totalSize: 0 };
  
  try {
    // localStorage에서 기존 위치 데이터 찾기
    const locationKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('location_') || key === 'locations'
    );
    
    console.log(`Found ${locationKeys.length} location keys to migrate`);
    
    for (const key of locationKeys) {
      try {
        const data = localStorage.getItem(key);
        if (!data) continue;
        
        const parsed = JSON.parse(data);
        let hasPhotos = false;
        
        // 단일 위치 객체인지 위치 배열인지 확인
        const locations = Array.isArray(parsed) ? parsed : [parsed];
        
        for (const location of locations) {
          if (location.floors) {
            for (const floor of location.floors) {
              if (floor.photos) {
                for (const photo of floor.photos) {
                  if (photo.data && photo.data.startsWith('data:image/')) {
                    try {
                      // Base64를 Blob으로 변환
                      const blob = base64ToBlob(photo.data);
                      
                      // IndexedDB에 저장
                      await savePhoto(photo.id, blob, photo.name || 'migrated-photo');
                      
                      result.success++;
                      result.totalSize += blob.size;
                      hasPhotos = true;
                      
                      console.log(`Migrated photo ${photo.id} (${Math.round(blob.size / 1024)}KB)`);
                    } catch (error) {
                      console.error(`Failed to migrate photo ${photo.id}:`, error);
                      result.failed++;
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Failed to process ${key}:`, error);
      }
    }
    
    if (result.success > 0) {
      console.log(`Migration completed: ${result.success} photos migrated, ${result.failed} failed, total size: ${Math.round(result.totalSize / 1024 / 1024 * 100) / 100}MB`);
    }
    
    return result;
  } catch (error) {
    console.error('Migration failed:', error);
    return result;
  }
}; 