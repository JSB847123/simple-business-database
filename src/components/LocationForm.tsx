import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Plus, Trash2, Camera, Check, Edit } from 'lucide-react';
import { Location, Floor, Photo, LOCATION_TYPES, FLOOR_OPTIONS } from '../types/location';
import { generateId } from '../utils/storage';
import { compressImage } from '../utils/imageUtils';
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

  const createNewFloor = (): Floor => ({
    id: generateId(),
    floorName: '1층',
    floorInfo: '',
    photos: [],
    isCompleted: false
  });

  const handleAddFloor = () => {
    setFormData({
      ...formData,
      floors: [...formData.floors, createNewFloor()]
    });
  };

  const handleAddFloorAfter = (afterIndex: number) => {
    const newFloor = createNewFloor();
    const newFloors = [...formData.floors];
    newFloors.splice(afterIndex + 1, 0, newFloor);
    
    setFormData({
      ...formData,
      floors: newFloors
    });
    
    toast({
      title: "층 추가 완료",
      description: `${afterIndex + 2}번째 위치에 새 층이 추가되었습니다.`,
      duration: 300
    });
  };

  const handleRemoveFloor = (floorId: string) => {
    if (formData.floors.length === 1) {
      toast({
        title: "삭제 불가",
        description: "최소 하나의 층 정보는 필요합니다.",
        variant: "destructive",
        duration: 300
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

    // 최소 정보 입력 확인
    if (!floor.floorInfo.trim() && floor.photos.length === 0) {
      toast({
        title: "입력 확인",
        description: "내부 정보나 사진 중 하나는 입력해주세요.",
        variant: "destructive",
        duration: 300
      });
      return;
    }

    handleFloorChange(floorId, 'isCompleted', true);
    toast({
      title: "층 정보 완료",
      description: `${floor.floorName} 정보가 저장되었습니다.`,
      duration: 300
    });
  };

  const handleEditFloor = (floorId: string) => {
    handleFloorChange(floorId, 'isCompleted', false);
    toast({
      title: "편집 모드",
      description: "층 정보를 수정할 수 있습니다.",
      duration: 300
    });
  };

  const handlePhotoUpload = async (floorId: string, files: FileList) => {
    const floor = formData.floors.find(f => f.id === floorId);
    if (!floor) return;

    if (floor.photos.length + files.length > 3) {
      toast({
        title: "업로드 제한",
        description: "층당 최대 3장의 사진만 업로드할 수 있습니다.",
        variant: "destructive",
        duration: 300
      });
      return;
    }

    const newPhotos: Photo[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      
      try {
        const compressedData = await compressImage(file);
        newPhotos.push({
          id: generateId(),
          data: compressedData,
          name: file.name
        });
      } catch (error) {
        console.error('Error compressing image:', error);
        toast({
          title: "이미지 처리 오류",
          description: `${file.name} 파일을 처리할 수 없습니다.`,
          variant: "destructive",
          duration: 300
        });
      }
    }

    if (newPhotos.length > 0) {
      handleFloorChange(floorId, 'photos', [...floor.photos, ...newPhotos]);
      toast({
        title: "사진 업로드 완료",
        description: `${newPhotos.length}장의 사진이 추가되었습니다.`,
        duration: 300
      });
    }
  };

  const handleRemovePhoto = (floorId: string, photoId: string) => {
    const floor = formData.floors.find(f => f.id === floorId);
    if (!floor) return;

    handleFloorChange(floorId, 'photos', floor.photos.filter(p => p.id !== photoId));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // 최소한의 유효성 검사만 수행
    if (!formData.address.addressAndName.trim() && !formData.locationType && 
        !formData.checkItems?.trim() &&
        formData.floors.every(floor => !floor.floorInfo.trim() && floor.photos.length === 0) && 
        !formData.notes?.trim()) {
      toast({
        title: "입력 확인",
        description: "최소한 하나의 정보라도 입력해주세요.",
        variant: "destructive",
        duration: 300
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
      duration: 300
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
            <div key={floor.id} className={`border rounded-lg p-4 space-y-4 ${
              floor.isCompleted 
                ? 'border-green-200 bg-green-50' 
                : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">층 정보 #{index + 1}</h4>
                  {floor.isCompleted && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <Check className="h-3 w-3" />
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

              {/* 사진 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사진 ({floor.photos.length}/3)
                </label>
                
                <div className="grid grid-cols-3 gap-2 mb-3">
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

                {!floor.isCompleted && floor.photos.length < 3 && (
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-teal-500 hover:bg-teal-50 cursor-pointer touch-target">
                      <Camera className="h-5 w-5 text-gray-500" />
                      <span className="text-sm text-gray-600">사진 선택</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => e.target.files && handlePhotoUpload(floor.id, e.target.files)}
                        className="hidden"
                      />
                    </label>
                    <label className="flex items-center justify-center gap-2 border-2 border-solid border-teal-500 bg-teal-50 rounded-lg p-3 hover:bg-teal-100 cursor-pointer touch-target min-w-[100px]">
                      <Camera className="h-5 w-5 text-teal-600" />
                      <span className="text-sm text-teal-700 font-medium">카메라</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={(e) => e.target.files && handlePhotoUpload(floor.id, e.target.files)}
                        className="hidden"
                      />
                    </label>
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
