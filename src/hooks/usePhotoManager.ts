import { useState, useEffect, useCallback, useRef } from 'react';
import { loadPhoto, savePhoto, deletePhoto } from '../utils/photo-store';
import { Photo } from '../types/location';

interface PhotoWithUrl extends Photo {
  displayUrl?: string;
}

export const usePhotoManager = () => {
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const urlCache = useRef<Map<string, string>>(new Map());

  // Blob URL 생성 및 캐싱
  const createPhotoUrl = useCallback(async (photoId: string): Promise<string | null> => {
    // 이미 캐시된 URL이 있으면 반환
    if (urlCache.current.has(photoId)) {
      return urlCache.current.get(photoId)!;
    }

    try {
      const blob = await loadPhoto(photoId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        urlCache.current.set(photoId, url);
        setPhotoUrls(prev => new Map(prev.set(photoId, url)));
        return url;
      }
    } catch (error) {
      console.error(`Failed to create URL for photo ${photoId}:`, error);
    }
    
    return null;
  }, []);

  // Blob URL 해제
  const revokePhotoUrl = useCallback((photoId: string) => {
    const url = urlCache.current.get(photoId);
    if (url) {
      URL.revokeObjectURL(url);
      urlCache.current.delete(photoId);
      setPhotoUrls(prev => {
        const newMap = new Map(prev);
        newMap.delete(photoId);
        return newMap;
      });
    }
  }, []);

  // 모든 URL 정리
  const revokeAllUrls = useCallback(() => {
    urlCache.current.forEach(url => URL.revokeObjectURL(url));
    urlCache.current.clear();
    setPhotoUrls(new Map());
  }, []);

  // 컴포넌트 언마운트 시 모든 URL 정리
  useEffect(() => {
    return () => {
      revokeAllUrls();
    };
  }, [revokeAllUrls]);

  // 파일을 Blob으로 변환하고 IndexedDB에 저장
  const savePhotoFile = useCallback(async (file: File, photoId: string, photoName: string): Promise<boolean> => {
    try {
      // File 객체는 이미 Blob이므로 직접 저장 가능
      await savePhoto(photoId, file, photoName);
      return true;
    } catch (error) {
      console.error('Failed to save photo file:', error);
      return false;
    }
  }, []);

  // 압축된 이미지 데이터(Base64)를 Blob으로 변환하고 저장
  const saveCompressedPhoto = useCallback(async (compressedData: string, photoId: string, photoName: string): Promise<boolean> => {
    try {
      // Base64를 Blob으로 변환
      const response = await fetch(compressedData);
      const blob = await response.blob();
      
      await savePhoto(photoId, blob, photoName);
      return true;
    } catch (error) {
      console.error('Failed to save compressed photo:', error);
      return false;
    }
  }, []);

  // 사진 삭제
  const removePhoto = useCallback(async (photoId: string): Promise<boolean> => {
    try {
      // Blob URL 정리
      revokePhotoUrl(photoId);
      
      // IndexedDB에서 삭제
      await deletePhoto(photoId);
      return true;
    } catch (error) {
      console.error('Failed to remove photo:', error);
      return false;
    }
  }, [revokePhotoUrl]);

  // 사진 목록에 대한 URL 일괄 생성
  const loadPhotosUrls = useCallback(async (photos: Photo[]): Promise<PhotoWithUrl[]> => {
    const photosWithUrls: PhotoWithUrl[] = [];
    
    for (const photo of photos) {
      const photoWithUrl: PhotoWithUrl = { ...photo };
      
      // IndexedDB에서 URL 생성 시도
      const url = await createPhotoUrl(photo.id);
      if (url) {
        photoWithUrl.displayUrl = url;
      } else if (photo.data) {
        // 백워드 호환성: Base64 데이터가 있으면 사용
        photoWithUrl.displayUrl = photo.data;
      }
      
      photosWithUrls.push(photoWithUrl);
    }
    
    return photosWithUrls;
  }, [createPhotoUrl]);

  return {
    createPhotoUrl,
    revokePhotoUrl,
    revokeAllUrls,
    savePhotoFile,
    saveCompressedPhoto,
    removePhoto,
    loadPhotosUrls,
    photoUrls: photoUrls
  };
}; 