import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  needsUpdate: boolean;
}

export const usePWA = () => {
  const [pwaState, setPwaState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    isOnline: navigator.onLine,
    needsUpdate: false,
  });
  
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // PWA 설치 가능 여부 확인
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);
      setPwaState(prev => ({ ...prev, isInstallable: true }));
    };

    // PWA 설치 완료 감지
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setPwaState(prev => ({ 
        ...prev, 
        isInstallable: false, 
        isInstalled: true 
      }));
    };

    // 온라인/오프라인 상태 감지
    const handleOnline = () => {
      setPwaState(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setPwaState(prev => ({ ...prev, isOnline: false }));
    };

    // 서비스 워커 업데이트 감지
    const handleServiceWorkerUpdate = () => {
      setPwaState(prev => ({ ...prev, needsUpdate: true }));
    };

    // 이벤트 리스너 등록
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 서비스 워커 등록 및 업데이트 확인
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('updatefound', handleServiceWorkerUpdate);
        
        // 이미 설치된 PWA인지 확인
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
          setPwaState(prev => ({ ...prev, isInstalled: true }));
        }
      });
    }

    // 정리
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setPwaState(prev => ({ 
          ...prev, 
          isInstallable: false,
          isInstalled: true 
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('PWA 설치 오류:', error);
      return false;
    }
  };

  const updatePWA = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      window.location.reload();
    }
  };

  return {
    ...pwaState,
    installPWA,
    updatePWA,
  };
}; 