import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Save, Plus, Trash2, Camera, Check, Edit, Upload, Image, FolderOpen } from 'lucide-react';
import { Location, Floor, Photo, LOCATION_TYPES, FLOOR_OPTIONS } from '../types/location';
import { generateId, saveLocationSafely } from '../utils/storage';
import { compressImage, checkImageSize, getMemoryUsage } from '../utils/imageUtils';
import { useToast } from '../hooks/use-toast';

interface LocationFormProps {
  location?: Location | null;
  onSave: (location: Location) => void;
  onCancel: () => void;
}

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
  const floorRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // 드래그 앤 드롭 상태 관리
  const [dragStates, setDragStates] = useState<{ [key: string]: boolean }>({});

  // 파일 선택 상태 관리 (연속 업로드 관련 상태 제거)
  const [uploadingStates, setUploadingStates] = useState<{ [key: string]: boolean }>({});

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
  }, [location]);

  // 앱 종료 시 데이터 손실 방지
  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (formData.id && (formData.address.addressAndName || formData.floors.some(f => f.photos.length > 0))) {
        try {
          const { saveLocations, loadLocations } = await import('../utils/storage');
          const currentLocations = await loadLocations();
          const locationIndex = currentLocations.findIndex(loc => loc.id === formData.id);
          
          let updatedLocations;
          if (locationIndex >= 0) {
            updatedLocations = [...currentLocations];
            updatedLocations[locationIndex] = { ...formData, lastSaved: Date.now() };
          } else {
            updatedLocations = [{ ...formData, lastSaved: Date.now() }, ...currentLocations];
          }
          
          await saveLocations(updatedLocations);
          console.log('앱 종료 전 긴급 저장 완료');
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
          const { saveLocations, loadLocations } = await import('../utils/storage');
          const currentLocations = await loadLocations();
          const locationIndex = currentLocations.findIndex(loc => loc.id === formData.id);
          
          let updatedLocations;
          if (locationIndex >= 0) {
            updatedLocations = [...currentLocations];
            updatedLocations[locationIndex] = { ...formData, lastSaved: Date.now() };
          } else {
            updatedLocations = [{ ...formData, lastSaved: Date.now() }, ...currentLocations];
          }
          
          await saveLocations(updatedLocations);
          console.log('백그라운드 이동 시 저장 완료');
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

  // File 배열을 처리하는 핵심 함수
  const handlePhotoUploadFromFiles = async (floorId: string, files: File[]) => {
    const floor = formData.floors.find(f => f.id === floorId);
    if (!floor) return;

    if (floor.photos.length + files.length > 5) {
      toast({
        title: "업로드 제한",
        description: `층당 최대 5장까지 가능합니다. (현재: ${floor.photos.length}장, 추가하려는: ${files.length}장)`,
        variant: "destructive",
        duration: 4000
      });
      return;
    }

    // 메모리 사용량 체크
    const memoryInfo = getMemoryUsage();
    if (memoryInfo && memoryInfo.used > memoryInfo.total * 0.8) {
      toast({
        title: "메모리 부족",
        description: "메모리 사용량이 높습니다. 일부 사진을 삭제하거나 앱을 재시작해주세요.",
        variant: "destructive",
        duration: 5000
      });
      return;
    }

    const newPhotos: Photo[] = [];
    let totalSize = 0;
    let successCount = 0;
    let failCount = 0;
    
    // 진행 상황 토스트 표시
    if (files.length > 1) {
      toast({
        title: `${files.length}장의 사진 처리 시작`,
        description: "이미지를 압축하고 저장하는 중...",
        duration: 3000
      });
    }
    
    // 각 파일을 개별적으로 처리하여 메모리 효율성 향상
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        failCount++;
        continue;
      }
      
      // 파일 크기 체크 (10MB 제한)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "파일 크기 초과",
          description: `${file.name}은(는) 10MB를 초과합니다.`,
          variant: "destructive",
          duration: 3000
        });
        failCount++;
        continue;
      }
      
      try {
        const compressedData = await compressImage(file);
        const imageSize = checkImageSize(compressedData);
        
        // 압축된 이미지 크기 체크 (2MB 제한)
        if (imageSize > 2 * 1024 * 1024) {
          toast({
            title: "이미지 크기 초과",
            description: `${file.name}은(는) 압축 후에도 너무 큽니다.`,
            variant: "destructive",
            duration: 3000
          });
          failCount++;
          continue;
        }
        
        totalSize += imageSize;
        
        const newPhoto: Photo = {
          id: generateId(),
          data: compressedData,
          name: file.name,
          timestamp: Date.now()
        };
        
        newPhotos.push(newPhoto);
        
        // 각 사진을 개별적으로 즉시 저장 (메모리 문제 방지)
        try {
          const updatedFloors = formData.floors.map(f =>
            f.id === floorId ? { ...f, photos: [...f.photos, newPhoto] } : f
          );
          
          const updatedFormData = { ...formData, floors: updatedFloors, lastSaved: Date.now() };
          
          await saveLocationSafely(updatedFormData);
          setFormData(updatedFormData);
          
          successCount++;
          console.log(`사진 ${newPhoto.name} 안전하게 저장 완료 (${i + 1}/${files.length})`);
          
        } catch (saveError) {
          console.error('개별 사진 저장 실패:', saveError);
          toast({
            title: "저장 경고",
            description: `${newPhoto.name} 저장에 문제가 있었습니다.`,
            variant: "destructive",
            duration: 3000
          });
          failCount++;
        }
        
      } catch (error) {
        console.error('Error compressing image:', error);
        toast({
          title: "이미지 처리 오류",
          description: `${file.name} 파일을 처리할 수 없습니다.`,
          variant: "destructive",
          duration: 3000
        });
        failCount++;
      }
    }

    // 최종 결과 표시
    if (successCount > 0) {
      const resultMessage = failCount > 0 
        ? `${successCount}장 성공, ${failCount}장 실패`
        : `${successCount}장 모두 성공`;
        
      toast({
        title: "사진 업로드 완료",
        description: `${resultMessage} (총 크기: ${Math.round(totalSize / 1024)}KB)`,
        duration: 4000
      });
    } else if (failCount > 0) {
      toast({
        title: "업로드 실패",
        description: `${failCount}장의 사진을 처리할 수 없었습니다.`,
        variant: "destructive",
        duration: 4000
      });
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent, floorId: string) => {
    e.preventDefault();
    setDragStates(prev => ({ ...prev, [floorId]: true }));
  };

  const handleDragLeave = (e: React.DragEvent, floorId: string) => {
    e.preventDefault();
    setDragStates(prev => ({ ...prev, [floorId]: false }));
  };

  const handleDrop = async (e: React.DragEvent, floorId: string) => {
    e.preventDefault();
    setDragStates(prev => ({ ...prev, [floorId]: false }));

    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      await handlePhotoUploadFromFiles(floorId, files);
    }
  };

  // 다중 선택을 위한 개선된 함수
  const triggerMultipleFileSelect = (floorId: string, inputType: 'gallery' | 'camera') => {
    setUploadingStates(prev => ({ ...prev, [floorId]: true }));
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true; // 다중 선택 활성화
    
    // 카메라 모드에서는 환경(후면) 카메라 사용
    if (inputType === 'camera') {
      input.capture = 'environment';
    }
    
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      setUploadingStates(prev => ({ ...prev, [floorId]: false }));
      
      if (target.files && target.files.length > 0) {
        const filesArray = Array.from(target.files);
        
        console.log(`Selected ${filesArray.length} files for upload`);
        
        // 선택된 파일 수에 따른 메시지
        if (filesArray.length === 1) {
          toast({
            title: "1장의 사진 선택됨",
            description: "이미지를 처리하고 있습니다...",
            duration: 2000
          });
        } else {
          toast({
            title: `${filesArray.length}장의 사진 선택됨`,
            description: "여러 이미지를 순차적으로 처리 중...",
            duration: 3000
          });
        }
        
        await handlePhotoUploadFromFiles(floorId, filesArray);
      } else {
        toast({
          title: "선택 취소됨",
          description: "사진이 선택되지 않았습니다.",
          duration: 1500
        });
      }
    };
    
    // 사용자에게 다중 선택 가능함을 알리는 토스트 (PC에서만)
    if (inputType === 'gallery' && window.navigator.userAgent.indexOf('Mobile') === -1) {
      toast({
        title: "💡 다중 선택 팁",
        description: "Ctrl(Cmd) + 클릭으로 여러 장을 한번에 선택할 수 있습니다!",
        duration: 3000
      });
    }
    
    input.click();
  };

  const handleRemovePhoto = (floorId: string, photoId: string) => {
    const floor = formData.floors.find(f => f.id === floorId);
    if (!floor) return;

    handleFloorChange(floorId, 'photos', floor.photos.filter(p => p.id !== photoId));
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
        {/* 주소 및 상호명 정보 */}
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
            <p className="text-xs text-gray-500 mt-1">
              주소와 건물명/상호명을 함께 입력하세요
            </p>
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
            <p className="text-xs text-gray-500 mt-1">
              예: 소방시설 점검, 출입구 확인, 주차장 상태 등
            </p>
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

              {/* 개선된 사진 업로드 섹션 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사진 ({floor.photos.length}/5)
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {floor.photos.map(photo => (
                    <div key={photo.id} className="relative">
                      <img
                        src={photo.data}
                        alt={photo.name}
                        className="w-full h-20 object-cover rounded border"
                      />
                      {!floor.isCompleted && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(floor.id, photo.id)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 touch-target"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {!floor.isCompleted && floor.photos.length < 5 && (
                  <div className="space-y-3">
                    {/* 드래그 앤 드롭 영역 */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                        dragStates[floor.id]
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
                      }`}
                      onDragOver={(e) => handleDragOver(e, floor.id)}
                      onDragLeave={(e) => handleDragLeave(e, floor.id)}
                      onDrop={(e) => handleDrop(e, floor.id)}
                      onClick={() => triggerMultipleFileSelect(floor.id, 'gallery')}
                    >
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium text-teal-600">클릭하여 여러 장 선택</span> 또는 드래그 앤 드롭
                      </p>
                      <p className="text-xs text-gray-500">
                        최대 {5 - floor.photos.length}장 추가 가능 • JPG, PNG 등 이미지 파일
                      </p>
                    </div>

                    {/* 업로드 버튼들 */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => triggerMultipleFileSelect(floor.id, 'gallery')}
                        disabled={uploadingStates[floor.id]}
                        className={`flex items-center justify-center gap-2 rounded-lg p-3 cursor-pointer touch-target text-sm font-medium transition-colors ${
                          uploadingStates[floor.id]
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : 'bg-white border-2 border-teal-500 text-teal-600 hover:bg-teal-50'
                        }`}
                      >
                        {uploadingStates[floor.id] ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
                            <span>선택 중...</span>
                          </>
                        ) : (
                          <>
                            <FolderOpen className="h-5 w-5" />
                            <span>갤러리에서 선택</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => triggerMultipleFileSelect(floor.id, 'camera')}
                        disabled={uploadingStates[floor.id]}
                        className={`flex items-center justify-center gap-2 rounded-lg p-3 cursor-pointer touch-target text-sm font-medium transition-colors ${
                          uploadingStates[floor.id]
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : 'bg-teal-500 text-white hover:bg-teal-600'
                        }`}
                      >
                        {uploadingStates[floor.id] ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-200 border-t-transparent"></div>
                            <span>선택 중...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="h-5 w-5" />
                            <span>카메라로 촬영</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* 개선된 도움말 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <Image className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-700">
                          <p className="font-medium mb-2">📸 다중 업로드 방법:</p>
                          <div className="space-y-2">
                            <div className="bg-white bg-opacity-60 rounded p-2">
                              <p className="font-medium mb-1">🖥️ PC/노트북:</p>
                              <p>• 갤러리 버튼 클릭 후 Ctrl(Cmd) + 클릭으로 여러 장 선택</p>
                              <p>• 드래그 앤 드롭으로 한번에 여러 장 추가</p>
                            </div>
                            <div className="bg-white bg-opacity-60 rounded p-2">
                              <p className="font-medium mb-1">📱 모바일:</p>
                              <p>• 갤러리에서 다중 선택 (기기에 따라 지원)</p>
                              <p>• 한 번에 안 되면 여러 번 나누어서 업로드</p>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-blue-200">
                            <p className="text-xs text-blue-600">
                              💡 한 번에 최대 5장까지, 각 파일 최대 10MB
                            </p>
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
                    title="이 층 다음에 새 층 추가"
                  >
                    <Plus className="h-3 w-3" />
                    다음 층 추가
                  </button>
                </div>
              )}

              {/* 층별 하단 액션 버튼들 */}
              {floor.isCompleted && (
                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => handleAddFloorAfter(index)}
                    className="flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium touch-target"
                  >
                    <Plus className="h-4 w-4" />
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
            저장하기
          </button>
        </div>

        {/* 하단 여백 */}
        <div className="h-20"></div>
      </form>
    </div>
  );
};

export default LocationForm; 