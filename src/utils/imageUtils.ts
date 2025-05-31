export const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 이미지 타입 확인
    const isJPEG = file.type === 'image/jpeg' || file.type === 'image/jpg';
    const isPNG = file.type === 'image/png';
    const isHEIF = file.type === 'image/heif' || file.type === 'image/heic';
    
    // iOS의 HEIF/HEIC 포맷 처리
    if (isHEIF) {
      console.log('HEIF/HEIC 이미지 감지됨, 변환 시도');
      // HEIF 형식은 직접 처리할 수 없으므로 blob URL을 통해 로드
      const blobUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);
        compressWithCanvas(img, maxWidth, 0.85, 'image/jpeg')
          .then(resolve)
          .catch(reject);
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        console.error('HEIF/HEIC 이미지 로드 실패, 원본 파일 사용 시도');
        // 로드 실패 시 파일 리더로 시도
        fallbackCompression(file, maxWidth, quality)
          .then(resolve)
          .catch(reject);
      };
      img.src = blobUrl;
      return;
    }
    
    // 일반 이미지 처리
    const targetQuality = isPNG ? 0.85 : quality;
    const outputFormat = isPNG ? 'image/png' : 'image/jpeg';
    
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      compressWithCanvas(img, maxWidth, targetQuality, outputFormat)
        .then(resolve)
        .catch(reject);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      console.error('이미지 로드 실패, 대체 압축 방식 시도');
      fallbackCompression(file, maxWidth, quality)
        .then(resolve)
        .catch(reject);
    };
    
    img.src = blobUrl;
  });
};

// 캔버스를 사용한 실제 압축 처리
const compressWithCanvas = (
  img: HTMLImageElement, 
  maxWidth: number, 
  quality: number,
  outputFormat: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas 컨텍스트 생성 실패'));
        return;
      }
      
      // 크기 계산
      let { width, height } = img;
      const maxDimension = Math.max(width, height);
      
      if (maxDimension > maxWidth) {
        const ratio = maxWidth / maxDimension;
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      // 메모리 사용량 체크
      const totalPixels = width * height;
      if (totalPixels > 4096 * 4096) {
        // 너무 큰 이미지는 더 작게 조정
        const downsizeRatio = Math.sqrt((4096 * 4096) / totalPixels);
        width = Math.round(width * downsizeRatio);
        height = Math.round(height * downsizeRatio);
        console.log('이미지가 너무 큼, 크기 축소:', { width, height });
      }
      
      // 캔버스 크기 설정
      canvas.width = width;
      canvas.height = height;
      
      // 고품질 렌더링 설정
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // 이미지 그리기
      ctx.fillStyle = '#FFFFFF'; // 배경색 (필요시)
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      // 압축 및 인코딩
      const compressedDataUrl = canvas.toDataURL(outputFormat, quality);
      
      // 메모리 해제
      canvas.width = 1;
      canvas.height = 1;
      
      resolve(compressedDataUrl);
    } catch (error) {
      console.error('압축 중 오류 발생:', error);
      reject(error);
    }
  });
};

// 대체 압축 방식 (FileReader 사용)
const fallbackCompression = (file: File, maxWidth: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (!e.target?.result) {
          reject(new Error('파일 읽기 실패'));
          return;
        }
        
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('Canvas 컨텍스트 생성 실패'));
              return;
            }
            
            // 크기 계산 (더 작게 제한)
            let { width, height } = img;
            const maxDimension = Math.max(width, height);
            
            if (maxDimension > maxWidth) {
              const ratio = maxWidth / maxDimension;
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            
            // 더 낮은 해상도로 제한
            const maxPixels = 2048 * 2048; // 메모리 제한
            if (width * height > maxPixels) {
              const downscaleRatio = Math.sqrt(maxPixels / (width * height));
              width = Math.floor(width * downscaleRatio);
              height = Math.floor(height * downscaleRatio);
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // 낮은 품질로 시도
            const result = canvas.toDataURL('image/jpeg', Math.min(quality, 0.6));
            
            // 메모리 해제
            canvas.width = 1;
            canvas.height = 1;
            
            resolve(result);
          } catch (canvasError) {
            console.error('대체 압축 방식 캔버스 오류:', canvasError);
            reject(canvasError);
          }
        };
        
        img.onerror = () => {
          console.error('대체 압축 방식 이미지 로드 실패');
          // 최후의 수단: 원본 데이터 사용
          resolve(e.target.result as string);
        };
        
        img.src = e.target.result as string;
      };
      
      reader.onerror = () => {
        reject(new Error('파일 읽기 실패'));
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('대체 압축 방식 오류:', error);
      reject(error);
    }
  });
};

export const dataURLtoFile = (dataURL: string, filename: string): File => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
};

// 이미지 크기 체크 함수
export const checkImageSize = (dataURL: string): number => {
  // Base64 문자열의 크기를 바이트로 계산
  const base64Length = dataURL.split(',')[1].length;
  return Math.round((base64Length * 3) / 4); // Base64 디코딩 후 실제 크기
};

// 메모리 사용량 모니터링
export const getMemoryUsage = (): { used: number; total: number } | null => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize
    };
  }
  return null;
};

// Service Worker에 긴급 저장 요청
export const requestEmergencySave = async (locations: any[]) => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'EMERGENCY_SAVE',
        locations: locations
      });
      console.log('긴급 저장 요청 전송됨');
    } catch (error) {
      console.error('긴급 저장 요청 실패:', error);
    }
  }
};

// 메모리 경고를 Service Worker에 전송
export const sendMemoryWarning = () => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'MEMORY_WARNING'
      });
      console.log('메모리 경고 전송됨');
    } catch (error) {
      console.error('메모리 경고 전송 실패:', error);
    }
  }
};

// 메모리 모니터링 및 자동 보호
export const startMemoryMonitoring = (onMemoryWarning?: () => void) => {
  const checkMemory = () => {
    const memoryInfo = getMemoryUsage();
    if (memoryInfo) {
      const usagePercent = memoryInfo.used / memoryInfo.total;
      
      if (usagePercent > 0.85) {
        console.warn(`메모리 사용량 높음: ${Math.round(usagePercent * 100)}%`);
        sendMemoryWarning();
        onMemoryWarning?.();
      }
    }
  };

  // 5초마다 메모리 체크
  const interval = setInterval(checkMemory, 5000);
  
  return () => clearInterval(interval);
};
