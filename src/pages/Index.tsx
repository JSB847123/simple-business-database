import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, MapPin, FileText, Camera, Settings } from 'lucide-react';
import LocationForm from '../components/LocationForm';
import LocationList from '../components/LocationList';
import ReportGenerator from '../components/ReportGenerator';
import PWAInstallPrompt from '../components/PWAInstallPrompt';
import SettingsModal from '../components/SettingsModal';
import { Location } from '../types/location';
import { AppSettings } from '../types/location';
import { loadLocations, saveLocations, syncStorageData, loadSettings, saveSettings } from '../utils/storage';
import { useToast } from '../hooks/use-toast';

const Index = () => {
  const [currentView, setCurrentView] = useState<'list' | 'form' | 'report'>('list');
  const [locations, setLocations] = useState<Location[]>([]);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // 자동저장 설정
  useEffect(() => {
    if (settings.autoSaveEnabled && hasUnsavedChanges) {
      autoSaveIntervalRef.current = setInterval(() => {
        handleAutoSave();
      }, settings.autoSaveInterval * 1000);
    } else {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    }

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [settings.autoSaveEnabled, settings.autoSaveInterval, hasUnsavedChanges]);

  const handleAutoSave = async () => {
    if (hasUnsavedChanges && locations.length > 0) {
      try {
        await saveLocations(locations);
        setHasUnsavedChanges(false);
        toast({
          title: "자동 저장 완료",
          description: "데이터가 자동으로 저장되었습니다.",
          duration: 1000
        });
      } catch (error) {
        console.error('Auto save failed:', error);
      }
    }
  };

  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    setShowSettings(false);
    toast({
      title: "설정 저장 완료",
      description: `자동저장이 ${newSettings.autoSaveEnabled ? '활성화' : '비활성화'}되었습니다.`,
    });
  };

  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        
        // 데이터 동기화 먼저 수행
        await syncStorageData();
        
        // 데이터 로드
        const savedLocations = await loadLocations();
        setLocations(savedLocations);
        
        console.log(`앱 시작: ${savedLocations.length}개의 저장된 위치 로드됨`);
      } catch (error) {
        console.error('데이터 초기화 오류:', error);
        toast({
          title: "데이터 로드 오류",
          description: "저장된 데이터를 불러오는 중 오류가 발생했습니다.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  const handleSaveLocation = async (location: Location) => {
    try {
      let updatedLocations;
      
      if (editingLocation) {
        updatedLocations = locations.map(loc => 
          loc.id === editingLocation.id ? { ...location, lastSaved: Date.now() } : loc
        );
        toast({
          title: "수정 완료",
          description: "장소 정보가 성공적으로 수정되었습니다.",
        });
      } else {
        // 새로운 위치를 맨 앞에 추가 (최근 저장 순)
        updatedLocations = [{ ...location, lastSaved: Date.now() }, ...locations];
        toast({
          title: "저장 완료",
          description: "새로운 장소 정보가 저장되었습니다.",
        });
      }
      
      // 최근 저장 순으로 정렬
      updatedLocations.sort((a, b) => (b.lastSaved || b.timestamp) - (a.lastSaved || a.timestamp));
      
      setLocations(updatedLocations);
      
      if (!settings.autoSaveEnabled) {
        await saveLocations(updatedLocations);
      } else {
        setHasUnsavedChanges(true);
      }
      
      setCurrentView('list');
      setEditingLocation(null);
    } catch (error) {
      console.error('저장 오류:', error);
      toast({
        title: "저장 실패",
        description: "데이터 저장 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive"
      });
    }
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setCurrentView('form');
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      const updatedLocations = locations.filter(loc => loc.id !== id);
      setLocations(updatedLocations);
      await saveLocations(updatedLocations);
      toast({
        title: "삭제 완료",
        description: "장소 정보가 삭제되었습니다.",
      });
    } catch (error) {
      console.error('삭제 오류:', error);
      toast({
        title: "삭제 실패",
        description: "데이터 삭제 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive"
      });
    }
  };

  const handleNewLocation = () => {
    setEditingLocation(null);
    setCurrentView('form');
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600">데이터를 불러오는 중...</p>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'form':
        return (
          <LocationForm
            location={editingLocation}
            onSave={handleSaveLocation}
            onCancel={() => {
              setCurrentView('list');
              setEditingLocation(null);
            }}
          />
        );
      case 'report':
        return (
          <ReportGenerator
            locations={locations}
            onBack={() => setCurrentView('list')}
          />
        );
      default:
        return (
          <LocationList
            locations={locations}
            onEdit={handleEditLocation}
            onDelete={handleDeleteLocation}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 touch-optimize">
      {/* PWA 설치 프롬프트 및 네트워크 상태 */}
      <PWAInstallPrompt />

      {/* Header */}
      <header className="bg-white shadow-sm border-b safe-area-top">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-6 w-6 text-teal-600" />
              <h1 className="text-xl font-bold text-gray-800">출장 데이터 수집</h1>
            </div>
            <div className="flex items-center gap-2">
              {currentView === 'list' && !isLoading && (
                <>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg touch-target"
                    title="설정"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleNewLocation}
                    className="flex items-center gap-1 bg-teal-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors touch-target"
                  >
                    <PlusCircle className="h-4 w-4" />
                    새 장소
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      {currentView === 'list' && !isLoading && (
        <nav className="bg-white border-b">
          <div className="max-w-md mx-auto px-4 py-3">
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentView('list')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors touch-target ${
                  currentView === 'list'
                    ? 'bg-teal-100 text-teal-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <MapPin className="h-4 w-4" />
                장소 목록 ({locations.length})
              </button>
              <button
                onClick={() => setCurrentView('report')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors touch-target ${
                  currentView === 'report'
                    ? 'bg-teal-100 text-teal-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <FileText className="h-4 w-4" />
                보고서 생성
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-md mx-auto smooth-scroll safe-area-bottom">
        {renderContent()}
      </main>

      {/* Empty State */}
      {currentView === 'list' && !isLoading && locations.length === 0 && (
        <div className="text-center py-12 px-4">
          <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">아직 수집된 데이터가 없습니다</h3>
          <p className="text-gray-500 mb-6">첫 번째 장소 정보를 입력해보세요</p>
          <button
            onClick={handleNewLocation}
            className="bg-teal-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-700 transition-colors touch-target"
          >
            장소 정보 입력하기
          </button>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        settings={settings}
        onSave={handleSettingsChange}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

export default Index;
