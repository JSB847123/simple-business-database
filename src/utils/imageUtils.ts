export const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions
        let { width, height } = img;
        
        // 더 효율적인 크기 조정
        const maxDimension = Math.max(width, height);
        if (maxDimension > maxWidth) {
          const ratio = maxWidth / maxDimension;
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        // 고품질 렌더링 설정
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);
          
          // 압축된 이미지 생성
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // 메모리 정리
          URL.revokeObjectURL(img.src);
          
          resolve(compressedDataUrl);
        } else {
          reject(new Error('Canvas context not available'));
        }
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
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
