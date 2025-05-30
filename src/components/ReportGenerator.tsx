import React, { useState } from 'react';
import { ArrowLeft, Download, FileText, Smartphone, Mail, List, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { Location } from '../types/location';
import { generateReport, generateReportForEmail } from '../utils/reportGenerator';
import { openEmailWithAttachment, supportsWebShare } from '../utils/emailUtils';
import { useToast } from '../hooks/use-toast';

interface ReportGeneratorProps {
  locations: Location[];
  onBack: () => void;
}

// 프로그레스 모달 컴포넌트
const ProgressModal: React.FC<{
  isOpen: boolean;
  message: string;
  progress: number;
  onCancel: () => void;
}> = ({ isOpen, message, progress, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-600 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">보고서 생성 중</h3>
          <p className="text-sm text-gray-600 mb-4">{message}</p>
          
          {/* 프로그레스 바 */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-teal-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            ></div>
          </div>
          
          <div className="text-xs text-gray-500 mb-4">
            {Math.round(progress)}% 완료
          </div>
          
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
};

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ locations, onBack }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set(locations.map(l => l.id)));
  const [progressMessage, setProgressMessage] = useState('');
  const [progressValue, setProgressValue] = useState(0);
  const [cancelGeneration, setCancelGeneration] = useState(false);
  const { toast } = useToast();

  // 선택된 장소들만 필터링
  const selectedLocations = locations.filter(location => selectedLocationIds.has(location.id));

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedLocationIds.size === locations.length) {
      setSelectedLocationIds(new Set());
    } else {
      setSelectedLocationIds(new Set(locations.map(l => l.id)));
    }
  };

  // 개별 장소 선택/해제
  const handleLocationToggle = (locationId: string) => {
    const newSelected = new Set(selectedLocationIds);
    if (newSelected.has(locationId)) {
      newSelected.delete(locationId);
    } else {
      newSelected.add(locationId);
    }
    setSelectedLocationIds(newSelected);
  };

  // Mobile detection
  const isMobile = (): boolean => {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handleGenerateReport = async () => {
    if (selectedLocations.length === 0) {
      toast({
        title: "보고서 생성 불가",
        description: "선택된 장소가 없습니다. 최소 하나의 장소를 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setCancelGeneration(false);
    setProgressMessage('보고서 준비 중...');
    setProgressValue(0);
    
    try {
      await generateReport(
        selectedLocations, 
        (message, progress) => {
          if (cancelGeneration) return;
          setProgressMessage(message);
          setProgressValue(progress);
        },
        (warningMessage) => {
          // 경고 메시지 토스트 표시
          toast({
            title: "주의사항",
            description: warningMessage,
            variant: "default",
            duration: 5000
          });
        }
      );
      
      if (!cancelGeneration) {
        toast({
          title: "보고서 생성 완료",
          description: `${selectedLocations.length}개 장소의 보고서가 생성되었습니다.`,
        });
      }
    } catch (error) {
      if (!cancelGeneration) {
        console.error('Report generation error:', error);
        toast({
          title: "보고서 생성 실패",
          description: error.message || "보고서 생성 중 오류가 발생했습니다.",
          variant: "destructive"
        });
      }
    } finally {
      setIsGenerating(false);
      setCancelGeneration(false);
      setProgressMessage('');
      setProgressValue(0);
    }
  };

  const handleSendEmail = async () => {
    if (selectedLocations.length === 0) {
      toast({
        title: "메일 전송 불가",
        description: "선택된 장소가 없습니다. 최소 하나의 장소를 선택해주세요.",
        variant: "destructive"
      });
      return;
    }

    setIsSendingEmail(true);
    setCancelGeneration(false);
    setProgressMessage('메일용 보고서 준비 중...');
    setProgressValue(0);
    
    try {
      const { blob, fileName, size } = await generateReportForEmail(
        selectedLocations, 
        (message, progress) => {
          if (cancelGeneration) return;
          setProgressMessage(message);
          setProgressValue(progress);
        },
        (warningMessage) => {
          // 경고 메시지 토스트 표시
          toast({
            title: "주의사항",
            description: warningMessage,
            variant: "default",
            duration: 5000
          });
        }
      );
      
      if (!cancelGeneration) {
        const result = await openEmailWithAttachment(blob, fileName);
        
        // Only show success message if not cancelled
        if (result.success) {
          const fileSizeMB = Math.round(size / 1024 / 1024 * 10) / 10;
          
          if (supportsWebShare()) {
            toast({
              title: "메일 전송 준비 완료",
              description: `공유 메뉴에서 메일 앱을 선택해주세요. (파일크기: ${fileSizeMB}MB)`,
            });
          } else {
            toast({
              title: "메일 앱 열기 완료",
              description: `파일이 다운로드되고 메일 앱이 열렸습니다. 다운로드된 파일을 첨부해주세요. (파일크기: ${fileSizeMB}MB)`,
            });
          }
        }
      }
      // Don't show any message if cancelled (result.cancelled === true)
    } catch (error) {
      if (!cancelGeneration) {
        console.error('Email sending error:', error);
        toast({
          title: "메일 전송 실패",
          description: error instanceof Error ? error.message : "메일 전송 중 오류가 발생했습니다.",
          variant: "destructive"
        });
      }
    } finally {
      setIsSendingEmail(false);
      setCancelGeneration(false);
      setProgressMessage('');
      setProgressValue(0);
    }
  };

  const handleCancelGeneration = () => {
    setCancelGeneration(true);
    setIsGenerating(false);
    setIsSendingEmail(false);
    toast({
      title: "생성 취소됨",
      description: "보고서 생성이 취소되었습니다.",
    });
  };

  const getTotalPhotos = (): number => {
    return selectedLocations.reduce((total, location) => {
      return total + location.floors.reduce((floorTotal, floor) => floorTotal + floor.photos.length, 0);
    }, 0);
  };

  const getLocationTypeStats = () => {
    const stats: { [key: string]: number } = {};
    selectedLocations.forEach(location => {
      const type = location.locationType || '미분류';
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  };

  const locationStats = getLocationTypeStats();

  // 파일 크기 예상치 계산
  const getEstimatedFileSize = (): string => {
    const totalPhotos = getTotalPhotos();
    const estimatedSizeBytes = (selectedLocations.length * 50000) + (totalPhotos * 150000); // 대략적인 계산
    const estimatedSizeMB = estimatedSizeBytes / 1024 / 1024;
    
    if (estimatedSizeMB < 1) {
      return `약 ${Math.round(estimatedSizeBytes / 1024)}KB`;
    } else {
      return `약 ${Math.round(estimatedSizeMB * 10) / 10}MB`;
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Progress Modal */}
      <ProgressModal
        isOpen={isGenerating || isSendingEmail}
        message={progressMessage}
        progress={progressValue}
        onCancel={handleCancelGeneration}
      />

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
                  • 메일 전송 버튼을 누르면 공유 메뉴가 열리며 메일 앱을 선택할 수 있습니다<br/>
                  • 다운로드가 안 되면 브라우저를 새로고침 후 다시 시도해주세요
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 장소 선택 섹션 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900">보고서에 포함할 장소 선택</h4>
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
            >
              {selectedLocationIds.size === locations.length ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {selectedLocationIds.size === locations.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {locations.map((location, index) => (
              <div 
                key={location.id} 
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedLocationIds.has(location.id) 
                    ? 'bg-teal-50 border border-teal-200' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => handleLocationToggle(location.id)}
              >
                <div className="mt-1">
                  {selectedLocationIds.has(location.id) ? (
                    <CheckSquare className="h-5 w-5 text-teal-600" />
                  ) : (
                    <Square className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {location.locationType || '미분류'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {location.floors.length}개 층, {location.floors.reduce((total, floor) => total + floor.photos.length, 0)}장
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{location.address.addressAndName}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-3 pt-3 border-t text-sm text-gray-600">
            선택된 장소: {selectedLocationIds.size}개 / 전체 {locations.length}개
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-6 w-6 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900">선택된 장소 요약</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-teal-600">{selectedLocations.length}</div>
              <div className="text-sm text-gray-600">선택 장소</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{getTotalPhotos()}</div>
              <div className="text-sm text-gray-600">첨부 사진</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">{getEstimatedFileSize()}</div>
              <div className="text-sm text-gray-600">예상 크기</div>
            </div>
          </div>

          <div className="text-sm text-gray-600 text-center">
            생성 일시: {new Date().toLocaleString('ko-KR')}
          </div>
          
          {/* 파일 크기 경고 */}
          {selectedLocations.length > 0 && (
            <div className="mt-3 pt-3 border-t text-xs text-gray-500">
              * 실제 파일 크기는 이미지 압축 정도에 따라 달라질 수 있습니다
            </div>
          )}
        </div>

        {/* Location Type Stats */}
        {Object.keys(locationStats).length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">선택된 장소 유형별 통계</h4>
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

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating || isSendingEmail || selectedLocations.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                보고서 생성 중...
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                보고서 다운로드 ({selectedLocations.length}개 장소)
                {selectedLocations.length > 0 && (
                  <span className="text-teal-200 text-sm ml-1">• {getEstimatedFileSize()}</span>
                )}
              </>
            )}
          </button>

          <button
            onClick={handleSendEmail}
            disabled={isSendingEmail || isGenerating || selectedLocations.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSendingEmail ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                메일 준비 중...
              </>
            ) : (
              <>
                <Mail className="h-5 w-5" />
                메일로 전송 ({selectedLocations.length}개 장소)
                {selectedLocations.length > 0 && (
                  <span className="text-blue-200 text-sm ml-1">• {getEstimatedFileSize()}</span>
                )}
              </>
            )}
          </button>
        </div>

        {/* 메모리 사용량 경고 */}
        {(isGenerating || isSendingEmail) && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-1" />
              <div>
                <h4 className="text-sm font-medium text-yellow-900 mb-1">대용량 파일 처리 안내</h4>
                <p className="text-xs text-yellow-700">
                  • 이미지가 많은 경우 처리 시간이 소요될 수 있습니다<br/>
                  • 메모리 부족 시 이미지가 자동으로 압축됩니다<br/>
                  • 처리 중 앱을 종료하지 마세요<br/>
                  • 문제 발생 시 취소 후 다시 시도해주세요
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedLocations.length === 0 && (
          <div className="text-center py-8">
            <List className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">장소를 선택해주세요</h3>
            <p className="text-gray-500">보고서에 포함할 장소를 위에서 선택해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportGenerator;
