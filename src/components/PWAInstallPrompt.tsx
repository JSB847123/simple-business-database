import React from 'react';
import { Download, X, WifiOff, RotateCcw } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';
import { useToast } from '../hooks/use-toast';

const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isOnline, needsUpdate, installPWA, updatePWA } = usePWA();
  const [showInstallPrompt, setShowInstallPrompt] = React.useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isInstallable) {
      const timer = setTimeout(() => setShowInstallPrompt(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable]);

  React.useEffect(() => {
    if (needsUpdate) {
      setShowUpdatePrompt(true);
    }
  }, [needsUpdate]);

  const handleInstall = async () => {
    const success = await installPWA();
    if (success) {
      toast({
        title: "앱 설치 완료",
        description: "현장 리포트 스크라이브가 홈 화면에 추가되었습니다.",
      });
    }
    setShowInstallPrompt(false);
  };

  const handleUpdate = async () => {
    await updatePWA();
    toast({
      title: "업데이트 완료",
      description: "앱이 최신 버전으로 업데이트되었습니다.",
    });
    setShowUpdatePrompt(false);
  };

  return (
    <>
      {/* 네트워크 상태 표시 */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white text-center py-2 px-4 text-sm font-medium z-50 safe-area-top">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="h-4 w-4" />
            오프라인 모드 - 일부 기능이 제한됩니다
          </div>
        </div>
      )}



      {/* PWA 설치 프롬프트 */}
      {showInstallPrompt && (
        <div className="install-prompt">
          <div className="flex items-start gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">앱으로 설치하기</h3>
              <p className="text-xs text-white/90 mb-3">
                홈 화면에 추가하여 더 빠르고 편리하게 사용하세요
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleInstall}
                  className="bg-white text-teal-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  설치하기
                </button>
                <button
                  onClick={() => setShowInstallPrompt(false)}
                  className="text-white/80 px-3 py-2 text-sm hover:text-white transition-colors"
                >
                  나중에
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="text-white/60 hover:text-white transition-colors p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 업데이트 프롬프트 */}
      {showUpdatePrompt && (
        <div className="install-prompt">
          <div className="flex items-start gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">새 업데이트 사용 가능</h3>
              <p className="text-xs text-white/90 mb-3">
                더 나은 기능과 성능을 위해 업데이트해주세요
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdate}
                  className="bg-white text-teal-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  업데이트
                </button>
                <button
                  onClick={() => setShowUpdatePrompt(false)}
                  className="text-white/80 px-3 py-2 text-sm hover:text-white transition-colors"
                >
                  나중에
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowUpdatePrompt(false)}
              className="text-white/60 hover:text-white transition-colors p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallPrompt; 