import { useCallback, useRef, useEffect, useState } from 'react';
import { 
  savePhotoBlob, 
  loadPhotoBlob, 
  deletePhotoBlob, 
  createPhotoUrl, 
  revokePhotoUrl, 
  revokeAllPhotoUrls 
} from '../utils/storage-indexeddb';
import { compressImage } from '../utils/imageUtils';

// 최대 재시도 횟수
const MAX_RETRY = 3;

export const usePhotoManagerV2 = () => {
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const [processingCount, setProcessingCount] = useState(0);

  // 컴포넌트 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      revokeAllPhotoUrls();
    };
  }, []);

  // Blob 저장 (압축 포함) - 재시도 로직 추가
  const saveCompressedPhoto = useCallback(async (
    file: File,
    photoId: string,
    locationId: string,
    floorId: string,
    retryCount = 0
  ): Promise<boolean> => {
    try {
      setProcessingCount(prev => prev + 1);
      console.log(`사진 압축 시작: ${file.name} (시도: ${retryCount + 1}/${MAX_RETRY + 1})`);
      
      // 파일 유효성 체크
      if (!file || file.size === 0) {
        console.error('유효하지 않은 파일:', file);
        return false;
      }
      
      // 너무 큰 이미지 체크 (100MB 이상)
      if (file.size > 100 * 1024 * 1024) {
        console.error('파일이 너무 큽니다:', Math.round(file.size / (1024 * 1024)) + 'MB');
        return false;
      }
      
      // 이미지 압축
      const compressedDataUrl = await compressImage(file);
      
      // 압축 결과 유효성 체크
      if (!compressedDataUrl || compressedDataUrl.length < 100) {
        throw new Error('압축된 이미지가 유효하지 않습니다');
      }
      
      // DataURL → Blob 변환
      const response = await fetch(compressedDataUrl);
      const blob = await response.blob();
      
      // Blob 유효성 체크
      if (!blob || blob.size === 0) {
        throw new Error('Blob 변환 실패');
      }
      
      console.log(`압축 완료: ${file.name} (${Math.round(blob.size / 1024)}KB)`);
      
      try {
        // IndexedDB에 Blob 저장
        await savePhotoBlob(photoId, blob, {
          name: file.name,
          locationId,
          floorId
        });
        
        return true;
      } catch (dbError) {
        console.error('IndexedDB 저장 오류:', dbError);
        
        // 작은 파일로 재시도
        if (retryCount < MAX_RETRY) {
          console.log(`저장 재시도 (${retryCount + 1}/${MAX_RETRY})...`);
          // 재시도할 때는 더 작은 크기와 낮은 품질로 시도
          const smallerMaxWidth = 800 - (retryCount * 200); // 점점 작아짐
          const lowerQuality = 0.6 - (retryCount * 0.1); // 점점 품질 낮아짐
          
          // 재귀적으로 재시도
          return saveCompressedPhoto(
            file, 
            photoId, 
            locationId, 
            floorId, 
            retryCount + 1
          );
        }
        
        throw dbError;
      }
    } catch (error) {
      console.error('사진 저장 실패:', error);
      
      // 에러 유형별 처리 및 재시도
      if (retryCount < MAX_RETRY) {
        console.log(`처리 재시도 (${retryCount + 1}/${MAX_RETRY})...`);
        return new Promise(resolve => {
          // 잠시 대기 후 재시도
          setTimeout(() => {
            resolve(saveCompressedPhoto(file, photoId, locationId, floorId, retryCount + 1));
          }, 500);
        });
      }
      
      return false;
    } finally {
      setProcessingCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  // Blob URL 생성 (캐싱 포함) - 안정성 개선
  const getPhotoUrl = useCallback(async (photoId: string, retryCount = 0): Promise<string | null> => {
    try {
      // 메모리 캐시 확인
      const cached = urlCacheRef.current.get(photoId);
      if (cached) {
        return cached;
      }
      
      // IndexedDB에서 URL 생성
      const url = await createPhotoUrl(photoId);
      if (url) {
        urlCacheRef.current.set(photoId, url);
        return url;
      }
      
      throw new Error('URL 생성 실패');
    } catch (error) {
      console.error(`사진 URL 생성 실패 (${photoId}):`, error);
      
      // URL 생성 재시도
      if (retryCount < MAX_RETRY) {
        console.log(`URL 생성 재시도 (${retryCount + 1}/${MAX_RETRY})...`);
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(getPhotoUrl(photoId, retryCount + 1));
          }, 300);
        });
      }
      
      return null;
    }
  }, []);

  // 사진 삭제 - 개선된 오류 처리
  const removePhoto = useCallback(async (photoId: string): Promise<void> => {
    try {
      // URL 해제
      const url = urlCacheRef.current.get(photoId);
      if (url) {
        URL.revokeObjectURL(url);
        urlCacheRef.current.delete(photoId);
      }
      
      // IndexedDB에서 삭제
      try {
        await deletePhotoBlob(photoId);
        console.log(`사진 ${photoId} 완전 삭제`);
      } catch (dbError) {
        console.error(`IndexedDB에서 사진 삭제 실패 (${photoId}):`, dbError);
        // URL은 이미 삭제했으므로 DB 오류는 무시할 수 있음
      }
    } catch (error) {
      console.error(`사진 삭제 실패 (${photoId}):`, error);
      throw error;
    }
  }, []);

  // 모든 URL 해제 - 안전하게 처리
  const revokeAllUrls = useCallback(() => {
    try {
      urlCacheRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error('URL 해제 실패:', e);
        }
      });
      urlCacheRef.current.clear();
      revokeAllPhotoUrls();
    } catch (error) {
      console.error('모든 URL 해제 중 오류:', error);
    }
  }, []);

  // 특정 URL 해제
  const revokeSingleUrl = useCallback((photoId: string) => {
    try {
      const url = urlCacheRef.current.get(photoId);
      if (url) {
        URL.revokeObjectURL(url);
        urlCacheRef.current.delete(photoId);
      }
      revokePhotoUrl(photoId);
    } catch (error) {
      console.error(`URL 해제 실패 (${photoId}):`, error);
    }
  }, []);

  // 메모리 사용량 확인
  const getMemoryUsage = useCallback(() => {
    const cacheSize = urlCacheRef.current.size;
    console.log(`현재 URL 캐시: ${cacheSize}개, 처리 중: ${processingCount}개`);
    return { 
      urlCacheSize: cacheSize,
      processingCount
    };
  }, [processingCount]);

  return {
    saveCompressedPhoto,
    getPhotoUrl,
    removePhoto,
    revokeAllUrls,
    revokeSingleUrl,
    getMemoryUsage
  };
}; 