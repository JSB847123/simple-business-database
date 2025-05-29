import React, { useState } from 'react';
import { X, Save, RefreshCw, HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';
import { AppSettings } from '../types/location';
import { diagnoseStorage, attemptDataRecovery } from '../utils/storage';
import { useToast } from '../hooks/use-toast';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, settings, onSave, onClose }) => {
  const [currentSettings, setCurrentSettings] = useState<AppSettings>(settings);
  const [isRunningDiagnosis, setIsRunningDiagnosis] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleDiagnosis = async () => {
    setIsRunningDiagnosis(true);
    try {
      const result = await diagnoseStorage();
      setDiagnosisResult(result);
      
      const totalSizeMB = Math.round((result.localStorageSize + result.indexedDBSize) / 1024 / 1024 * 100) / 100;
      const quotaUsedMB = Math.round(result.quotaUsed / 1024 / 1024 * 100) / 100;
      const quotaTotalMB = Math.round(result.quotaTotal / 1024 / 1024 * 100) / 100;
      
      toast({
        title: "진단 완료",
        description: `총 데이터: ${totalSizeMB}MB, 사용 공간: ${quotaUsedMB}/${quotaTotalMB}MB`,
        duration: 5000
      });
    } catch (error) {
      toast({
        title: "진단 실패",
        description: "스토리지 진단 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsRunningDiagnosis(false);
    }
  };

  const handleDataRecovery = async () => {
    setIsRecovering(true);
    try {
      const recoveredData = await attemptDataRecovery();
      
      toast({
        title: "복구 완료",
        description: `${recoveredData.length}개의 위치 데이터를 복구했습니다.`,
        duration: 5000
      });
      
      // 페이지 새로고침으로 복구된 데이터 반영
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      toast({
        title: "복구 실패",
        description: "데이터 복구 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">설정</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* 자동저장 설정 */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">자동저장 설정</h3>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">자동저장 활성화</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentSettings.autoSaveEnabled}
                  onChange={(e) => setCurrentSettings({
                    ...currentSettings,
                    autoSaveEnabled: e.target.checked
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {currentSettings.autoSaveEnabled && (
              <div>
                <label className="block text-sm text-gray-700 mb-2">저장 간격</label>
                <select
                  value={currentSettings.autoSaveInterval}
                  onChange={(e) => setCurrentSettings({
                    ...currentSettings,
                    autoSaveInterval: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value={3}>3초</option>
                  <option value={5}>5초</option>
                  <option value={10}>10초</option>
                  <option value={30}>30초</option>
                  <option value={60}>1분</option>
                </select>
              </div>
            )}
          </div>

          {/* 스토리지 진단 섹션 */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-medium text-gray-900">데이터 관리</h3>
            
            <div className="space-y-3">
              <button
                onClick={handleDiagnosis}
                disabled={isRunningDiagnosis}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isRunningDiagnosis ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <HardDrive className="h-4 w-4" />
                )}
                {isRunningDiagnosis ? '진단 중...' : '스토리지 진단'}
              </button>

              <button
                onClick={handleDataRecovery}
                disabled={isRecovering}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {isRecovering ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isRecovering ? '복구 중...' : '데이터 복구 시도'}
              </button>
            </div>

            {/* 진단 결과 표시 */}
            {diagnosisResult && (
              <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                <h4 className="text-sm font-medium text-gray-900">진단 결과</h4>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    {diagnosisResult.localStorageWorking ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                    )}
                    <span>localStorage</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {diagnosisResult.indexedDBWorking ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                    )}
                    <span>IndexedDB</span>
                  </div>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <div>로컬 데이터: {diagnosisResult.localCount}개 ({Math.round(diagnosisResult.localStorageSize / 1024)}KB)</div>
                  <div>IndexedDB: {diagnosisResult.indexedDBCount}개 ({Math.round(diagnosisResult.indexedDBSize / 1024)}KB)</div>
                  <div>스토리지 사용률: {Math.round(diagnosisResult.quotaUsed / diagnosisResult.quotaTotal * 100)}% 
                    ({Math.round(diagnosisResult.quotaUsed / 1024 / 1024)}MB / {Math.round(diagnosisResult.quotaTotal / 1024 / 1024)}MB)
                  </div>
                </div>

                {diagnosisResult.quotaUsed / diagnosisResult.quotaTotal > 0.8 && (
                  <div className="bg-red-50 border border-red-200 rounded p-2">
                    <div className="flex items-center gap-1 text-red-700 text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      <span>스토리지 사용량이 80%를 초과했습니다!</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 저장 버튼 */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={() => onSave(currentSettings)}
              className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700"
            >
              <Save className="h-4 w-4" />
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 