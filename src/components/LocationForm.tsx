import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Plus, Trash2, Camera, Check, Edit, Image, FolderOpen, Upload } from 'lucide-react';
import { Location, Floor, Photo, LOCATION_TYPES, FLOOR_OPTIONS } from '../types/location';
import { generateId } from '../utils/storage';
import { saveLocation } from '../utils/storage-indexeddb';
import { checkImageSize, getMemoryUsage } from '../utils/imageUtils';
import { useToast } from '../hooks/use-toast';
import { usePhotoManagerV2 } from '../hooks/usePhotoManagerV2';

interface LocationFormProps {
  location?: Location | null;
  onSave: (location: Location) => void;
  onCancel: () => void;
}

// 모바일에서 API 서버 연결 문제 해결: 개발 환경과 프로덕션 환경을 구분
const getAPIBaseURL = () => {
  // 개발 환경에서는 상대 경로 사용
  return '/api';
};

const API_BASE_URL = getAPIBaseURL();
console.log('🌐 API 경로:', API_BASE_URL);

// 디버깅 도우미
const debugLog = (message: string, data?: any) => {
  console.log(`[DEBUG] ${message}`, data || '');
};

const LocationForm: React.FC<LocationFormProps> = ({ location, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Location>({
    id: '',
    address: { addressAndName: '' },
    locationType: '',
    checkItems: '',
    floors: [],
    notes: '',
    timestamp: Date.now()
  });
  const { toast } = useToast();
  const { saveCompressedPhoto, getPhotoUrl, removePhoto, revokeAllUrls } = usePhotoManagerV2();
  const floorRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // 업로드 상태 관리
  const [uploadingStates, setUploadingStates] = useState<{ [key: string]: boolean }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    if (location) {
      setFormData(location);
    } else {
      setFormData({
        id: generateId(),
        address: { addressAndName: '' },
        locationType: '',
        checkItems: '',
        floors: [createNewFloor()],
        notes: '',
        timestamp: Date.now()
      });
    }
    
    // 컴포넌트 마운트 시 모든 상태 초기화
    setUploadingStates({});
    setUploadProgress({});
  }, [location]);

  // 컴포넌트 언마운트 시 모든 Blob URL 정리
  useEffect(() => {
    return () => {
      revokeAllUrls();
    };
  }, [revokeAllUrls]);

  // 앱 종료 시 데이터 손실 방지 (IndexedDB 기반)
  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (formData.id && (formData.address.addressAndName || formData.floors.some(f => f.photos.length > 0))) {
        try {
          await saveLocation(formData);
          console.log('앱 종료 전 IndexedDB 긴급 저장 완료');
        } catch (error) {
          console.error('앱 종료 전 저장 실패:', error);
          event.preventDefault();
          event.returnValue = '저장되지 않은 데이터가 있습니다. 정말 나가시겠습니까?';
          return event.returnValue;
        }
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden' && formData.id) {
        try {
          await saveLocation(formData);
          console.log('백그라운드 이동 시 IndexedDB 저장 완료');
        } catch (error) {
          console.error('백그라운드 저장 실패:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [formData]);

  const createNewFloor = (): Floor => ({
    id: generateId(),
    floorName: '1층',
    customFloorName: '',
    floorInfo: '',
    photos: [],
    isCompleted: false
  });

  const scrollToFloor = (floorId: string) => {
    setTimeout(() => {
      const floorElement = floorRefs.current[floorId];
      if (floorElement) {
        floorElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 100);
  };

  const handleAddFloor = () => {
    const newFloor = createNewFloor();
    setFormData({
      ...formData,
      floors: [...formData.floors, newFloor]
    });
    scrollToFloor(newFloor.id);
  };

  const handleAddFloorAfter = (afterIndex: number) => {
    const newFloor = createNewFloor();
    const newFloors = [...formData.floors];
    newFloors.splice(afterIndex + 1, 0, newFloor);
    
    setFormData({
      ...formData,
      floors: newFloors
    });
    
    scrollToFloor(newFloor.id);
    
    toast({
      title: "층 추가 완료",
      description: `${afterIndex + 2}번째 위치에 새 층이 추가되었습니다.`,
      duration: 3000
    });
  };

  const handleRemoveFloor = (floorId: string) => {
    if (formData.floors.length === 1) {
      toast({
        title: "삭제 불가",
        description: "최소 하나의 층 정보는 필요합니다.",
        variant: "destructive",
        duration: 3000
      });
      return;
    }
    
    setFormData({
      ...formData,
      floors: formData.floors.filter(floor => floor.id !== floorId)
    });
  };

  const handleFloorChange = (floorId: string, field: keyof Floor, value: any) => {
    setFormData({
      ...formData,
      floors: formData.floors.map(floor =>
        floor.id === floorId ? { ...floor, [field]: value } : floor
      )
    });
  };

  const handleCompleteFloor = (floorId: string) => {
    const floor = formData.floors.find(f => f.id === floorId);
    if (!floor) return;

    if (floor.floorName === '기타' && !floor.customFloorName?.trim()) {
      toast({
        title: "입력 확인",
        description: "기타 층을 선택한 경우 층 이름을 입력해주세요.",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    if (!floor.floorInfo.trim() && floor.photos.length === 0) {
      toast({
        title: "입력 확인",
        description: "층 정보나 사진 중 하나는 필수로 입력해야 합니다.",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    handleFloorChange(floorId, 'isCompleted', true);
    
    toast({
      title: "층 완료",
      description: "해당 층의 정보 입력이 완료되었습니다.",
      duration: 3000
    });
  };

  const handleEditFloor = (floorId: string) => {
    handleFloorChange(floorId, 'isCompleted', false);
    
    toast({
      title: "수정 모드",
      description: "해당 층을 다시 수정할 수 있습니다.",
      duration: 3000
    });
  };

  const uploadPhotosToServer = async (floorId: string, files: File[]): Promise<Photo[]> => {
    // 기기 정보 로깅
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    debugLog('📱 기기 정보:', {
      isIOS,
      isAndroid,
      isSafari,
      userAgent: navigator.userAgent,
      files: files.length,
      filesInfo: files.map(f => ({ name: f.name, type: f.type, size: Math.round(f.size/1024) + 'KB' }))
    });
    
    // 서버 업로드 대신 로컬 처리 방식으로 변경
    console.log('로컬 파일 처리 시작:', files.length);
    
    // 최대 허용 크기 검사 (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      debugLog('용량 초과 파일 감지:', oversizedFiles.map(f => ({ 
        name: f.name, 
        size: Math.round(f.size / (1024 * 1024)) + 'MB' 
      })));
      
      // 큰 파일에 대한 경고 표시 (하지만 진행)
      toast({
        title: "대용량 이미지 감지",
        description: "일부 이미지가 큽니다. 압축을 시도합니다.",
        duration: 3000
      });
    }
    
    try {
      // 파일 압축 및 로컬 저장 처리
      const results: Photo[] = [];
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < files.length; i++) {
        try {
          // 진행률 업데이트
          setUploadProgress(prev => ({
            ...prev,
            [floorId]: Math.floor(10 + ((i / files.length) * 80))
          }));
          
          const file = files[i];
          
          // 유효하지 않은 파일 건너뛰기
          if (!file || file.size === 0) {
            debugLog(`파일 ${i+1} 건너뛰기: 유효하지 않은 파일`);
            failCount++;
            continue;
          }
          
          const photoId = generateId();
          
          debugLog(`파일 ${i+1}/${files.length} 처리 시작:`, { 
            name: file.name, 
            size: file.size, 
            type: file.type 
          });
          
          // 로컬 파일 처리 (압축 및 Blob URL 생성)
          const success = await saveCompressedPhoto(file, photoId, formData.id, floorId);
          
          if (success) {
            debugLog(`파일 ${i+1}/${files.length} 압축 성공, URL 생성 시도`);
            // URL 가져오기
            const photoUrl = await getPhotoUrl(photoId);
            
            if (photoUrl) {
              // 저장된 사진 정보 생성
              const photo: Photo = {
                id: photoId,
                name: file.name,
                data: photoUrl,
                timestamp: Date.now()
              };
              
              results.push(photo);
              successCount++;
              debugLog(`파일 ${i+1}/${files.length} 로컬 처리 완료:`, photo.name);
            } else {
              debugLog(`파일 ${i+1}/${files.length} URL 생성 실패`);
              failCount++;
            }
          } else {
            debugLog(`파일 ${i+1}/${files.length} 압축/저장 실패`);
            failCount++;
          }
        } catch (err) {
          console.error(`파일 ${i+1}/${files.length} 처리 실패:`, err);
          failCount++;
        }
        
        // 중간 진행상황 알림 (큰 배치의 경우)
        if (files.length > 2 && i > 0 && (i + 1) % 2 === 0) {
          debugLog(`중간 진행 상황: ${i+1}/${files.length} 완료`);
        }
      }
      
      // 완료 표시
      setUploadProgress(prev => ({ ...prev, [floorId]: 100 }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [floorId]: 0 }));
      }, 1000);
      
      debugLog(`처리 결과: 성공 ${successCount}개, 실패 ${failCount}개`);
      
      if (results.length === 0) {
        throw new Error('모든 파일 처리 실패');
      }
      
      console.log(`총 ${results.length}개 파일 처리 완료`);
      return results;
    } catch (error) {
      console.error('파일 처리 오류:', error);
      throw error;
    }
  };

  // 개선된 다중 파일 선택 및 업로드
  const triggerMultipleFileSelect = (floorId: string, inputType: 'gallery' | 'camera') => {
    if (uploadingStates[floorId]) {
      toast({
        title: "처리 진행 중",
        description: "현재 파일을 처리 중입니다. 잠시 기다려주세요.",
        duration: 2000
      });
      return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    // 모바일 기기 감지
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isAndroid = /Android/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // 카메라 모드와 갤러리 모드 설정
    if (inputType === 'camera') {
      // 카메라는 모든 기기에서 단일 파일로 제한
      input.capture = 'environment';
      input.multiple = false;
    } else {
      // 갤러리 모드 설정
      input.removeAttribute('capture');
      
      // Safari/iOS에서는 다중 선택 제한
      if (isIOS && isSafari) {
        // iOS Safari는 여러 파일 처리가 불안정할 수 있음
        input.multiple = false;
        console.log('iOS Safari에서는 단일 파일 모드로 설정');
      } else {
        input.multiple = true;
      }
    }
    
    // 즉시 로딩 상태 설정
    setUploadingStates(prev => ({ ...prev, [floorId]: true }));
    setUploadProgress(prev => ({ ...prev, [floorId]: 0 }));
    
    // 타임아웃 설정 (60초로 연장)
    const timeoutId = setTimeout(() => {
      console.warn('파일 선택 타임아웃 - 강제 상태 리셋');
      setUploadingStates(prev => ({ ...prev, [floorId]: false }));
      setUploadProgress(prev => ({ ...prev, [floorId]: 0 }));
      toast({
        title: "시간 초과",
        description: "파일 선택이 취소되었습니다. 다시 시도해주세요.",
        variant: "destructive",
        duration: 3000
      });
    }, 60000); // 60초로 연장
    
    // 파일 선택 완료 핸들러
    input.onchange = async (e) => {
      clearTimeout(timeoutId);
      
      const target = e.target as HTMLInputElement;
      
      console.log('파일 선택 이벤트 발생');
      console.log('선택된 파일 수:', target.files?.length || 0);
      
      // 파일 선택 취소 또는 없음
      if (!target.files || target.files.length === 0) {
        console.log('파일이 선택되지 않음');
        setUploadingStates(prev => ({ ...prev, [floorId]: false }));
        setUploadProgress(prev => ({ ...prev, [floorId]: 0 }));
        toast({
          title: "선택 취소됨",
          description: "사진이 선택되지 않았습니다.",
          duration: 1500
        });
        return;
      }
      
      // 선택된 파일 복사 (FileList는 변경될 수 있음)
      const filesArray = Array.from(target.files);
      const floor = formData.floors.find(f => f.id === floorId);
      
      if (!floor) {
        console.error('층을 찾을 수 없음:', floorId);
        setUploadingStates(prev => ({ ...prev, [floorId]: false }));
        setUploadProgress(prev => ({ ...prev, [floorId]: 0 }));
        return;
      }
      
      if (floor.photos.length + filesArray.length > 5) {
        setUploadingStates(prev => ({ ...prev, [floorId]: false }));
        setUploadProgress(prev => ({ ...prev, [floorId]: 0 }));
        toast({
          title: "업로드 제한",
          description: `층당 최대 5장까지 가능합니다. (현재: ${floor.photos.length}장)`,
          variant: "destructive",
          duration: 4000
        });
        return;
      }
      
      console.log('=== 파일 선택 성공 ===');
      console.log('선택된 파일:', filesArray.map(f => ({ name: f.name, size: f.size })));
      console.log('브라우저:', navigator.userAgent);
      console.log('입력 타입:', inputType);
      
      setUploadProgress(prev => ({ ...prev, [floorId]: 10 }));
      
      try {
        toast({
          title: `🔄 ${filesArray.length}장 로컬 처리 시작`,
          description: "압축 및 저장 중...",
          duration: 3000
        });
        
        // 파일 크기 점검
        const totalSizeMB = filesArray.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024);
        console.log(`총 파일 크기: ${totalSizeMB.toFixed(2)}MB`);
        
        try {
          let uploadedPhotos: Photo[] = [];
          
          // iOS Safari에서는 항상 개별 처리 (더 안정적)
          if (isIOS) {
            console.log('iOS에서 개별 처리 전략 사용');
            const allUploadedPhotos: Photo[] = [];
            
            // 한 번에 하나씩 처리
            for (let i = 0; i < filesArray.length; i++) {
              setUploadProgress(prev => ({
                ...prev,
                [floorId]: 30 + Math.floor((i / filesArray.length) * 50)
              }));
              
              try {
                const singleFileArray = [filesArray[i]];
                const result = await uploadPhotosToServer(floorId, singleFileArray);
                allUploadedPhotos.push(...result);
                console.log(`iOS 개별 처리 ${i+1}/${filesArray.length} 성공:`, result);
              } catch (error) {
                console.error(`파일 ${i+1} 개별 처리 실패:`, error);
              }
              
              // 중간 성공 상태 반영 (사용자 경험 개선)
              if (allUploadedPhotos.length > 0 && (i === filesArray.length - 1 || (i > 0 && i % 2 === 0))) {
                // 현재까지 성공한 사진들을 미리 UI에 반영
                handleFloorChange(floorId, 'photos', [
                  ...floor.photos,
                  ...allUploadedPhotos.filter(photo => 
                    !floor.photos.some(p => p.id === photo.id)
                  )
                ]);
              }
            }
            
            uploadedPhotos = allUploadedPhotos;
          } else {
            // 다른 기기에서는 일괄 처리 시도 (Android 등)
            uploadedPhotos = await uploadPhotosToServer(floorId, filesArray);
          }
          
          setUploadProgress(prev => ({ ...prev, [floorId]: 90 }));
          
          if (uploadedPhotos.length > 0) {
            // 이미 추가된 사진을 제외하고 새 사진만 추가
            const newPhotos = uploadedPhotos.filter(photo => 
              !floor.photos.some(p => p.id === photo.id)
            );
            
            // 성공한 사진들을 층 데이터에 추가
            handleFloorChange(floorId, 'photos', [
              ...floor.photos,
              ...newPhotos
            ]);
            
            toast({
              title: "저장 성공",
              description: `${uploadedPhotos.length}장의 사진이 성공적으로 저장되었습니다.`,
              duration: 3000
            });
          } else {
            toast({
              title: "처리 실패",
              description: "사진을 저장하지 못했습니다. 다시 시도해주세요.",
              variant: "destructive",
              duration: 3000
            });
          }
        } catch (error) {
          console.error('파일 처리 오류:', error);
          toast({
            title: "처리 실패",
            description: error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.",
            variant: "destructive",
            duration: 4000
          });
        } finally {
          setUploadingStates(prev => ({ ...prev, [floorId]: false }));
          setUploadProgress(prev => ({ ...prev, [floorId]: 100 }));
          setTimeout(() => {
            setUploadProgress(prev => ({ ...prev, [floorId]: 0 }));
          }, 1000);
        }
      } catch (error) {
        console.error('파일 처리 오류:', error);
        toast({
          title: "처리 실패",
          description: error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.",
          variant: "destructive",
          duration: 4000
        });
      }
    };
    
    // 파일 선택 다이얼로그 표시
    input.click();
  };

  // 파일 삭제 함수 (단순화)
  const handleRemovePhoto = async (floorId: string, photoId: string) => {
    const floor = formData.floors.find(f => f.id === floorId);
    if (!floor) return;

    try {
      // 로컬에서 삭제
      await removePhoto(photoId);
      
      // 상태에서도 제거
      handleFloorChange(floorId, 'photos', floor.photos.filter(p => p.id !== photoId));
      
      toast({
        title: "사진 삭제됨",
        description: "사진이 성공적으로 삭제되었습니다.",
        duration: 2000
      });
    } catch (error) {
      console.error('Error removing photo:', error);
      toast({
        title: "삭제 실패",
        description: "사진 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!formData.address.addressAndName.trim() && !formData.locationType && 
        !formData.checkItems?.trim() &&
        formData.floors.every(floor => !floor.floorInfo.trim() && floor.photos.length === 0) && 
        !formData.notes?.trim()) {
      toast({
        title: "입력 확인",
        description: "최소한 하나의 정보라도 입력해주세요.",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    onSave({
      ...formData,
      timestamp: location ? formData.timestamp : Date.now()
    });

    toast({
      title: "저장 완료",
      description: "정보가 성공적으로 저장되었습니다.",
      duration: 3000
    });
  };

  // 사진 표시 컴포넌트
  const PhotoDisplay: React.FC<{
    photo: Photo;
    onRemove?: () => void;
    isReadOnly?: boolean;
  }> = ({ photo, onRemove, isReadOnly = false }) => {
    return (
      <div className="relative">
        <img
          src={photo.data}
          alt={photo.name}
          className="w-full h-20 object-cover rounded border"
          loading="lazy"
          onError={(e) => {
            console.error('이미지 로드 실패:', photo.name);
            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjEgMTlWNWEyIDIgMCAwIDAtMi0ySDVhMiAyIDAgMCAwLTIgMnYxNGEyIDIgMCAwIDAgMiAyaDE0YTIgMiAwIDAgMCAyLTJ6IiBzdHJva2U9IiM5Y2ExYWYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0iI2Y5ZmFmYiIvPjxwYXRoIGQ9Im05IDEwIDIgMi0yIDIiIHN0cm9rZT0iIzljYTFhZiIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+';
          }}
        />
        {!isReadOnly && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 touch-target"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white min-h-screen safe-area-bottom">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between safe-area-top z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onCancel} 
            className="p-2 hover:bg-gray-100 rounded-lg touch-target"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">
            {location ? '장소 정보 수정' : '새 장소 정보'}
          </h2>
        </div>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 touch-target"
        >
          <Save className="h-4 w-4" />
          저장
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* 기본 정보 */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">기본 정보</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              주소 및 상호명
            </label>
            <input
              type="text"
              value={formData.address.addressAndName}
              onChange={(e) => setFormData({
                ...formData,
                address: { addressAndName: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="예: 서울특별시 강남구 테헤란로 123 (카페 스타벅스)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              장소 유형
            </label>
            <select
              value={formData.locationType || ''}
              onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">선택해주세요 (선택사항)</option>
              {LOCATION_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              체크 사항
            </label>
            <textarea
              value={formData.checkItems || ''}
              onChange={(e) => setFormData({ ...formData, checkItems: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              rows={3}
              placeholder="확인해야 할 사항이나 점검 항목을 입력하세요 (선택사항)"
            />
          </div>
        </div>

        {/* 층별 정보 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">층별 정보</h3>
            <button
              type="button"
              onClick={handleAddFloor}
              className="flex items-center gap-1 bg-teal-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 touch-target"
            >
              <Plus className="h-4 w-4" />
              층 추가
            </button>
          </div>

          {formData.floors.map((floor, index) => (
            <div
              key={floor.id}
              ref={(el) => floorRefs.current[floor.id] = el}
              className={`border rounded-lg p-4 space-y-4 ${
                floor.isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
              }`}
            >
              {/* 층 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-teal-100 text-teal-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {index + 1}층째
                  </span>
                  {floor.isCompleted && (
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      완료
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {floor.isCompleted ? (
                    <button
                      type="button"
                      onClick={() => handleEditFloor(floor.id)}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium touch-target"
                    >
                      <Edit className="h-4 w-4" />
                      수정
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCompleteFloor(floor.id)}
                      className="flex items-center gap-1 text-green-600 hover:text-green-700 text-xs font-medium touch-target"
                    >
                      <Check className="h-4 w-4" />
                      완료
                    </button>
                  )}
                  {formData.floors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFloor(floor.id)}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700 text-xs font-medium touch-target"
                    >
                      <Trash2 className="h-4 w-4" />
                      삭제
                    </button>
                  )}
                </div>
              </div>

              {/* 층 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">층</label>
                <select
                  value={floor.floorName}
                  onChange={(e) => handleFloorChange(floor.id, 'floorName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  disabled={floor.isCompleted}
                >
                  {FLOOR_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                
                {floor.floorName === '기타' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={floor.customFloorName || ''}
                      onChange={(e) => handleFloorChange(floor.id, 'customFloorName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="층 이름을 입력하세요 (예: 옥상, 지하 4층, 중층 등)"
                      disabled={floor.isCompleted}
                    />
                  </div>
                )}
              </div>

              {/* 내부 정보 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">내부 정보</label>
                <textarea
                  value={floor.floorInfo}
                  onChange={(e) => handleFloorChange(floor.id, 'floorInfo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  rows={3}
                  placeholder="해당 층의 내부 정보를 입력하세요"
                  disabled={floor.isCompleted}
                />
              </div>

              {/* 🚀 개선된 사진 업로드 섹션 - FormData + array 방식 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사진 ({floor.photos.length}/5) - 로컬 저장
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {floor.photos.map(photo => (
                    <PhotoDisplay 
                      key={photo.id} 
                      photo={photo} 
                      onRemove={() => handleRemovePhoto(floor.id, photo.id)} 
                    />
                  ))}
                </div>

                {!floor.isCompleted && floor.photos.length < 5 && (
                  <div className="space-y-3">
                    {/* 업로드 진행률 표시 */}
                    {uploadingStates[floor.id] && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Upload className="h-4 w-4 text-blue-600 animate-pulse" />
                          <span className="text-sm font-medium text-blue-700">
                            로컬 저장 진행 중... {uploadProgress[floor.id] || 0}%
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress[floor.id] || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* 업로드 버튼들 */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => triggerMultipleFileSelect(floor.id, 'gallery')}
                        disabled={uploadingStates[floor.id]}
                        className={`flex items-center justify-center gap-2 rounded-lg p-3 cursor-pointer touch-target text-sm font-medium transition-colors ${
                          uploadingStates[floor.id]
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-2 border-gray-300'
                            : 'bg-white border-2 border-teal-500 text-teal-600 hover:bg-teal-50'
                        }`}
                      >
                        {uploadingStates[floor.id] ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
                            <span>처리 중...</span>
                          </>
                        ) : (
                          <>
                            <FolderOpen className="h-5 w-5" />
                            <span>사진첩에서 선택</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => triggerMultipleFileSelect(floor.id, 'camera')}
                        disabled={uploadingStates[floor.id]}
                        className={`flex items-center justify-center gap-2 rounded-lg p-3 cursor-pointer touch-target text-sm font-medium transition-colors ${
                          uploadingStates[floor.id]
                            ? 'bg-gray-400 text-gray-300 cursor-not-allowed'
                            : 'bg-teal-500 text-white hover:bg-teal-600'
                        }`}
                      >
                        {uploadingStates[floor.id] ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-transparent"></div>
                            <span>처리 중...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="h-5 w-5" />
                            <span>카메라 촬영</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* 개선된 안내 */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Image className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-green-700">
                          <p className="font-medium mb-2">📱 로컬 저장 방식으로 변경!</p>
                          <div className="space-y-2">
                            <div className="bg-white bg-opacity-60 rounded p-2">
                              <p className="font-medium mb-1">✅ 사진 저장 방법:</p>
                              <p>• 사진첩 버튼을 누르세요</p>
                              <p>• 여러 장 선택 후 "완료" 누르기</p>
                              <p>• 사진이 기기에 로컬 저장됩니다</p>
                            </div>
                            <div className="bg-white bg-opacity-60 rounded p-2">
                              <p className="font-medium mb-1">📱 저장 방식:</p>
                              <p>• 서버 업로드 없이 로컬 저장</p>
                              <p>• 자동 이미지 압축으로 용량 절약</p>
                              <p>• 최대 5장, 오프라인 작동 가능</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 층 추가 버튼 */}
              {!floor.isCompleted && (
                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => handleAddFloorAfter(index)}
                    className="flex items-center gap-1 text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-1 rounded text-xs font-medium touch-target"
                  >
                    <Plus className="h-3 w-3" />
                    다음 층 추가
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            특이사항 및 메모
          </label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            rows={4}
            placeholder="추가 메모나 특이사항을 입력하세요 (선택사항)"
          />
        </div>

        {/* 하단 저장 버튼 */}
        <div className="sticky bottom-0 bg-white pt-4 pb-4 border-t border-gray-200 -mx-4 px-4 mt-8">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-3 px-4 rounded-lg text-sm font-medium hover:bg-teal-700 touch-target"
          >
            <Save className="h-5 w-5" />
            정보 저장하기
          </button>
        </div>

        {/* 하단 여백 */}
        <div className="h-20"></div>
      </form>
    </div>
  );
};

export default LocationForm; 