import React from 'react';
import { Edit, Trash2, MapPin, Image, Calendar } from 'lucide-react';
import { Location } from '../types/location';
import { formatTimestamp } from '../utils/storage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface LocationListProps {
  locations: Location[];
  onEdit: (location: Location) => void;
  onDelete: (id: string) => void;
}

const LocationList: React.FC<LocationListProps> = ({ locations, onEdit, onDelete }) => {
  const getTotalPhotos = (location: Location): number => {
    return location.floors.reduce((total, floor) => total + floor.photos.length, 0);
  };

  const getFirstPhoto = (location: Location): string | null => {
    for (const floor of location.floors) {
      if (floor.photos.length > 0) {
        return floor.photos[0].data;
      }
    }
    return null;
  };

  if (locations.length === 0) {
    return null;
  }

  return (
    <div className="p-4 space-y-4">
      {locations.map((location) => {
        const firstPhoto = getFirstPhoto(location);
        const totalPhotos = getTotalPhotos(location);

        return (
          <div key={location.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4">
              <div className="flex gap-3">
                {/* Thumbnail */}
                <div className="flex-shrink-0">
                  {firstPhoto ? (
                    <img
                      src={firstPhoto}
                      alt="대표 사진"
                      className="w-16 h-16 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg border flex items-center justify-center">
                      <Image className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                          {location.locationType}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">
                          {location.address.addressAndName}
                        </p>
                        {location.checkItems && (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            체크사항: {location.checkItems}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{location.floors.length}개 층</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Image className="h-3 w-3" />
                          <span>{totalPhotos}장</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatTimestamp(location.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions - moved below content for better mobile layout */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => onEdit(location)}
                      className="flex items-center gap-1 px-3 py-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors text-xs border border-teal-200"
                    >
                      <Edit className="h-4 w-4" />
                      <span>수정 및 층별 정보 추가</span>
                    </button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="flex items-center gap-1 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-xs border border-red-200">
                          <Trash2 className="h-4 w-4" />
                          <span>삭제</span>
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                          <AlertDialogDescription>
                            이 장소의 모든 정보가 삭제되며, 복구할 수 없습니다.
                            <br />
                            <span className="font-medium">{location.address.addressAndName}</span>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(location.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>

              {/* Notes Preview */}
              {location.notes && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-600 line-clamp-2">{location.notes}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LocationList;
