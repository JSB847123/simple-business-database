const CACHE_NAME = 'field-report-v1.0.1';
const EMERGENCY_DB_NAME = 'EmergencyBackupDB';
const EMERGENCY_STORE_NAME = 'emergency_locations';
const STATIC_CACHE_URLS = [
  '/',
  '/src/main.tsx',
  '/src/index.css',
  '/manifest.json'
];

// 설치 이벤트
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('캐시 저장 중...');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// 활성화 이벤트
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('오래된 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 강화된 긴급 저장 시스템
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'EMERGENCY_SAVE') {
    console.log('Service Worker: 긴급 저장 요청 받음');
    
    const saveToEmergencyDB = async (data) => {
      try {
        // 별도의 긴급 백업 DB 사용
        const request = indexedDB.open(EMERGENCY_DB_NAME, 1);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(EMERGENCY_STORE_NAME)) {
            const store = db.createObjectStore(EMERGENCY_STORE_NAME, { keyPath: 'id' });
            store.createIndex('timestamp', 'emergency_timestamp', { unique: false });
          }
        };
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = db.transaction([EMERGENCY_STORE_NAME], 'readwrite');
          const store = transaction.objectStore(EMERGENCY_STORE_NAME);
          
          // 긴급 타임스탬프 추가
          const emergencyData = data.map(location => ({
            ...location,
            emergency_timestamp: Date.now(),
            backup_source: 'emergency_save'
          }));
          
          // 개별 저장으로 안전성 향상
          emergencyData.forEach(location => {
            const putRequest = store.put(location);
            putRequest.onerror = () => console.error('긴급 저장 실패:', location.id);
            putRequest.onsuccess = () => console.log('긴급 저장 성공:', location.id);
          });
          
          transaction.oncomplete = () => {
            console.log('Service Worker: 긴급 저장 완료');
            
            // 메인 DB에도 백업 시도
            const mainRequest = indexedDB.open('FieldReportDB', 1);
            mainRequest.onsuccess = (mainEvent) => {
              try {
                const mainDb = mainEvent.target.result;
                const mainTransaction = mainDb.transaction(['locations'], 'readwrite');
                const mainStore = mainTransaction.objectStore('locations');
                
                data.forEach(location => {
                  const mainPutRequest = mainStore.put({
                    ...location,
                    backup_timestamp: Date.now()
                  });
                  mainPutRequest.onerror = () => console.warn('메인 DB 백업 실패:', location.id);
                });
                
                mainTransaction.oncomplete = () => console.log('메인 DB 백업도 완료');
              } catch (mainError) {
                console.error('메인 DB 백업 중 오류:', mainError);
              }
            };
            
            // 클라이언트에 완료 알림
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({ 
                  type: 'EMERGENCY_SAVE_COMPLETE',
                  count: data.length,
                  timestamp: Date.now()
                });
              });
            });
          };
          
          transaction.onerror = () => {
            console.error('Service Worker: 긴급 저장 트랜잭션 실패');
          };
        };
        
        request.onerror = () => {
          console.error('Service Worker: 긴급 DB 열기 실패');
        };
      } catch (error) {
        console.error('Service Worker: 긴급 저장 실패', error);
      }
    };
    
    if (event.data.locations && event.data.locations.length > 0) {
      saveToEmergencyDB(event.data.locations);
    }
  }
  
  // 데이터 복구 요청 처리
  if (event.data && event.data.type === 'EMERGENCY_RECOVERY') {
    console.log('Service Worker: 긴급 복구 요청 받음');
    
    const recoverFromEmergencyDB = async () => {
      try {
        const request = indexedDB.open(EMERGENCY_DB_NAME, 1);
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          
          if (!db.objectStoreNames.contains(EMERGENCY_STORE_NAME)) {
            console.log('긴급 백업 데이터 없음');
            return;
          }
          
          const transaction = db.transaction([EMERGENCY_STORE_NAME], 'readonly');
          const store = transaction.objectStore('emergency_locations');
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            const emergencyData = getAllRequest.result || [];
            console.log(`Service Worker: ${emergencyData.length}개 긴급 데이터 발견`);
            
            // 클라이언트에 복구된 데이터 전송
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'EMERGENCY_RECOVERY_COMPLETE',
                  data: emergencyData,
                  count: emergencyData.length
                });
              });
            });
          };
        };
      } catch (error) {
        console.error('Service Worker: 긴급 복구 실패', error);
      }
    };
    
    recoverFromEmergencyDB();
  }
});

// 메모리 압박 상황 감지
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'MEMORY_WARNING') {
    console.log('Service Worker: 메모리 경고 받음');
    
    // 불필요한 캐시 정리
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        if (cacheName !== CACHE_NAME) {
          caches.delete(cacheName);
        }
      });
    });
  }
});

// 요청 가로채기
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에서 찾은 경우 반환
        if (response) {
          return response;
        }
        
        // 네트워크에서 가져오기
        return fetch(event.request)
          .then((response) => {
            // 유효한 응답이 아니면 그대로 반환
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 응답을 복제하여 캐시에 저장
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // 오프라인 상태일 때 기본 페이지 반환
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
          });
      })
  );
}); 