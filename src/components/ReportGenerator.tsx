import React, { useState } from 'react';
import { ArrowLeft, Download, FileText, Smartphone } from 'lucide-react';
import { Location } from '../types/location';
import { generateReport } from '../utils/reportGenerator';
import { useToast } from '../hooks/use-toast';

interface ReportGeneratorProps {
  locations: Location[];
  onBack: () => void;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ locations, onBack }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Mobile detection
  const isMobile = (): boolean => {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handleGenerateReport = async () => {
    if (locations.length === 0) {
      toast({
        title: "보고서 생성 불가",
        description: "저장된 장소 데이터가 없습니다.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      await generateReport(locations);
      if (isMobile()) {
        toast({
          title: "보고서 생성 완료",
          description: "다운로드 폴더를 확인해주세요. 파일이 다운로드되지 않으면 브라우저 설정을 확인해주세요.",
        });
      } else {
        toast({
          title: "보고서 생성 완료",
          description: "DOCX 파일이 다운로드되었습니다.",
        });
      }
    } catch (error) {
      console.error('Report generation error:', error);
      toast({
        title: "보고서 생성 실패",
        description: "보고서 생성 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getTotalPhotos = (): number => {
    return locations.reduce((total, location) => {
      return total + location.floors.reduce((floorTotal, floor) => floorTotal + floor.photos.length, 0);
    }, 0);
  };

  const getLocationTypeStats = () => {
    const stats: { [key: string]: number } = {};
    locations.forEach(location => {
      stats[location.locationType] = (stats[location.locationType] || 0) + 1;
    });
    return stats;
  };

  const locationStats = getLocationTypeStats();

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">보고서 생성</h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Mobile Usage Guide */}
        {isMobile() && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-blue-600 mt-1" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">모바일 사용 안내</h4>
                <p className="text-xs text-blue-700">
                  • 파일이 다운로드되지 않으면 브라우저 설정에서 다운로드를 허용해주세요<br/>
                  • iOS Safari의 경우 파일 앱에서 다운로드된 파일을 확인할 수 있습니다<br/>
                  • 다운로드가 안 되면 브라우저를 새로고침 후 다시 시도해주세요
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-6 w-6 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900">보고서 요약</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-600">{locations.length}</div>
              <div className="text-sm text-gray-600">수집 장소</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{getTotalPhotos()}</div>
              <div className="text-sm text-gray-600">첨부 사진</div>
            </div>
          </div>

          <div className="text-sm text-gray-600 text-center">
            생성 일시: {new Date().toLocaleString('ko-KR')}
          </div>
        </div>

        {/* Location Type Stats */}
        {Object.keys(locationStats).length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">장소 유형별 통계</h4>
            <div className="space-y-2">
              {Object.entries(locationStats).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{type}</span>
                  <span className="text-sm font-medium">{count}개</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">수집된 장소 목록</h4>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {locations.map((location, index) => (
              <div key={location.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-6 h-6 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{location.locationType}</span>
                    <span className="text-xs text-gray-500">
                      {location.floors.length}개 층, {location.floors.reduce((total, floor) => total + floor.photos.length, 0)}장
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-1">{location.address.addressAndName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating || locations.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-5 w-5" />
            {isGenerating ? '보고서 생성 중...' : 'docx(word) 생성'}
          </button>
        </div>

        {locations.length === 0 && (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">생성할 데이터가 없습니다</h3>
            <p className="text-gray-500">먼저 장소 정보를 수집해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportGenerator;
