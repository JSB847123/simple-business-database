import { useCallback, useRef, useEffect } from 'react';
import { 
  savePhotoBlob, 
  loadPhotoBlob, 
  deletePhotoBlob, 
  createPhotoUrl, 
  revokePhotoUrl, 
  revokeAllPhotoUrls 
} from '../utils/storage-indexeddb';
import { compressImage } from '../utils/imageUtils';

export const usePhotoManagerV2 = () => {
  const urlCacheRef = useRef<Map<string, string>>(new Map());

  // 컴포넌트 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      revokeAllPhotoUrls();
    };
  }, []);

  // Blob 저장 (압축 포함)
  const saveCompressedPhoto = useCallback(async (
    file: File,
    photoId: string,
    locationId: string,
    floorId: string
  ): Promise<boolean> => {
    try {
      console.log(`사진 압축 시작: ${file.name}`);
      
      // 이미지 압축
      const compressedDataUrl = await compressImage(file);
      
      // DataURL → Blob 변환
      const response = await fetch(compressedDataUrl);
      const blob = await response.blob();
      
      console.log(`압축 완료: ${file.name} (${Math.round(blob.size / 1024)}KB)`);
      
      // IndexedDB에 Blob 저장
      await savePhotoBlob(photoId, blob, {
        name: file.name,
        locationId,
        floorId
      });
      
      return true;
    } catch (error) {
      console.error('사진 저장 실패:', error);
      return false;
    }
  }, []);

  // Blob URL 생성 (캐싱 포함)
  const getPhotoUrl = useCallback(async (photoId: string): Promise<string | null> => {
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
      }
      
      return url;
    } catch (error) {
      console.error(`사진 URL 생성 실패 (${photoId}):`, error);
      return null;
    }
  }, []);

  // 사진 삭제
  const removePhoto = useCallback(async (photoId: string): Promise<void> => {
    try {
      // URL 해제
      const url = urlCacheRef.current.get(photoId);
      if (url) {
        URL.revokeObjectURL(url);
        urlCacheRef.current.delete(photoId);
      }
      
      // IndexedDB에서 삭제
      await deletePhotoBlob(photoId);
      
      console.log(`사진 ${photoId} 완전 삭제`);
    } catch (error) {
      console.error(`사진 삭제 실패 (${photoId}):`, error);
      throw error;
    }
  }, []);

  // 모든 URL 해제
  const revokeAllUrls = useCallback(() => {
    urlCacheRef.current.forEach(url => URL.revokeObjectURL(url));
    urlCacheRef.current.clear();
    revokeAllPhotoUrls();
  }, []);

  // 특정 URL 해제
  const revokeSingleUrl = useCallback((photoId: string) => {
    const url = urlCacheRef.current.get(photoId);
    if (url) {
      URL.revokeObjectURL(url);
      urlCacheRef.current.delete(photoId);
    }
    revokePhotoUrl(photoId);
  }, []);

  // 메모리 사용량 확인
  const getMemoryUsage = useCallback(() => {
    const cacheSize = urlCacheRef.current.size;
    console.log(`현재 URL 캐시: ${cacheSize}개`);
    return { urlCacheSize: cacheSize };
  }, []);

  return {
    saveCompressedPhoto,
    getPhotoUrl,
    removePhoto,
    revokeAllUrls,
    revokeSingleUrl,
    getMemoryUsage
  };
}; 