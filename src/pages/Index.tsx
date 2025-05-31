import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, MapPin, FileText, Camera, Settings } from 'lucide-react';
import LocationForm from '../components/LocationForm';
import LocationList from '../components/LocationList';
import ReportGenerator from '../components/ReportGenerator';
import PWAInstallPrompt from '../components/PWAInstallPrompt';
import SettingsModal from '../components/SettingsModal';
import { Location } from '../types/location';
import { AppSettings } from '../types/location';
import { 
  loadAllLocations, 
  saveLocation, 
  migrateFromLocalStorage,
  getStorageStats,
  saveSetting,
  loadSetting
} from '../utils/storage-indexeddb';
import { useToast } from '../hooks/use-toast';
import { startMemoryMonitoring, requestEmergencySave } from '../utils/imageUtils';

// 기본 설정
const DEFAULT_SETTINGS: AppSettings = {
  autoSaveEnabled: false,
  autoSaveInterval: 3
};

const Index = () => {
  const [currentView, setCurrentView] = useState<'list' | 'form' | 'report'>('list');
  const [locations, setLocations] = useState<Location[]>([]);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{
    isRunning: boolean;
    progress: string;
    completed: boolean;
  }>({ isRunning: false, progress: '', completed: false });
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
        // IndexedDB는 개별 저장이므로 모든 locations을 개별적으로 저장할 필요 없음
        // 대신 상태를 리셋만 처리
        setHasUnsavedChanges(false);
        
        toast({
          title: "자동 저장 완료",
          description: "데이터가 IndexedDB에 자동으로 저장되었습니다.",
          duration: 1000,
          className: "scale-75 origin-top-right"
        });
      } catch (error) {
        console.error('Auto save failed:', error);
      }
    }
  };

  const handleSettingsChange = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveSetting('appSettings', newSettings);
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
        
        console.log('🚀 IndexedDB 기반 데이터 초기화 시작...');
        
        // 설정 로드
        const savedSettings = await loadSetting('appSettings', DEFAULT_SETTINGS);
        setSettings(savedSettings);
        
        // 마이그레이션 실행 (localStorage → IndexedDB)
        const needsMigration = localStorage.getItem('fieldReportLocations');
        if (needsMigration) {
          setMigrationStatus({ isRunning: true, progress: 'localStorage 데이터 발견, 마이그레이션 시작...', completed: false });
          
          try {
            const migrationResult = await migrateFromLocalStorage();
            
            setMigrationStatus({ 
              isRunning: false, 
              progress: `마이그레이션 완료: ${migrationResult.success}장 성공, ${migrationResult.failed}장 실패`, 
              completed: true 
            });
            
            if (migrationResult.success > 0) {
              toast({
                title: "🔄 데이터 마이그레이션 완료",
                description: `${migrationResult.success}장의 사진을 IndexedDB Blob으로 변환했습니다.`,
                duration: 5000
              });
            }
          } catch (error) {
            console.error('마이그레이션 실패:', error);
            setMigrationStatus({ isRunning: false, progress: '마이그레이션 실패', completed: false });
          }
        }
        
        // IndexedDB에서 데이터 로드
        const savedLocations = await loadAllLocations();
        setLocations(savedLocations);
        
        // 저장소 통계 표시
        const stats = await getStorageStats();
        console.log('📊 저장소 통계:', stats);
        
        toast({
          title: "🎉 IndexedDB 로딩 완료",
          description: `${stats.locations}개 위치, ${stats.photos}장의 사진 (총 ${stats.totalSizeMB}MB)`,
          duration: 4000
        });
        
        console.log(`✅ IndexedDB 초기화 완료: ${savedLocations.length}개의 위치 로드됨`);
        
      } catch (error) {
        console.error('데이터 초기화 실패:', error);
        toast({
          title: "❌ 데이터 로딩 실패",
          description: "IndexedDB 초기화 중 오류가 발생했습니다.",
          variant: "destructive",
          duration: 5000
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [toast]);

  // 메모리 모니터링 시작
  useEffect(() => {
    const cleanup = startMemoryMonitoring();
    return cleanup;
  }, []);

  const handleNewLocation = () => {
    setEditingLocation(null);
    setCurrentView('form');
  };

  const handleSaveLocation = async (location: Location) => {
    try {
      // IndexedDB에 개별 저장
      await saveLocation(location);
      
      let updatedLocations;
      
      if (editingLocation) {
        updatedLocations = locations.map(loc => 
          loc.id === editingLocation.id ? { ...location, lastSaved: Date.now() } : loc
        );
        toast({
          title: "✅ 수정 완료",
          description: "장소 정보가 IndexedDB에 수정 저장되었습니다.",
        });
      } else {
        // 새로운 위치를 맨 앞에 추가 (최근 저장 순)
        updatedLocations = [{ ...location, lastSaved: Date.now() }, ...locations];
        toast({
          title: "✅ 저장 완료",
          description: "새로운 장소 정보가 IndexedDB에 저장되었습니다.",
        });
      }
      
      // 최근 저장 순으로 정렬
      updatedLocations.sort((a, b) => (b.lastSaved || b.timestamp) - (a.lastSaved || a.timestamp));
      
      setLocations(updatedLocations);
      
      if (!settings.autoSaveEnabled) {
        // IndexedDB는 이미 개별 저장되었으므로 추가 저장 불필요
        console.log('IndexedDB 저장 완료 - 추가 저장 불필요');
      } else {
        setHasUnsavedChanges(true);
      }
      
      setCurrentView('list');
      setEditingLocation(null);
    } catch (error) {
      console.error('저장 오류:', error);
      toast({
        title: "❌ 저장 실패",
        description: "IndexedDB 저장 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive"
      });
    }
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setCurrentView('form');
  };

  const handleDeleteLocation = async (locationId: string) => {
    try {
      // IndexedDB에서 삭제
      const { deleteLocation: deleteFromDB } = await import('../utils/storage-indexeddb');
      await deleteFromDB(locationId);
      
      setLocations(locations.filter(loc => loc.id !== locationId));
      
      toast({
        title: "✅ 삭제 완료",
        description: "장소 정보가 IndexedDB에서 완전히 삭제되었습니다.",
      });
    } catch (error) {
      console.error('삭제 오류:', error);
      toast({
        title: "❌ 삭제 실패",
        description: "삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const handleCancel = () => {
    setCurrentView('list');
    setEditingLocation(null);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "좋은 아침입니다! ☀️";
    if (hour < 18) return "좋은 오후입니다! 🌤️";
    return "좋은 저녁입니다! 🌙";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-700">IndexedDB 시스템 초기화 중...</p>
            {migrationStatus.isRunning && (
              <p className="text-sm text-blue-600 animate-pulse">{migrationStatus.progress}</p>
            )}
            {migrationStatus.completed && (
              <p className="text-sm text-green-600">{migrationStatus.progress}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'form') {
    return (
      <LocationForm
        location={editingLocation}
        onSave={handleSaveLocation}
        onCancel={handleCancel}
      />
    );
  }

  if (currentView === 'report') {
    return (
      <ReportGenerator
        locations={locations}
        onBack={() => setCurrentView('list')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-100">
      <PWAInstallPrompt />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10 safe-area-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500 p-2 rounded-lg">
                <MapPin className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  현장조사 기록부
                </h1>
                <p className="text-sm text-gray-600">IndexedDB Blob 저장 방식</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg touch-target"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
          
          <div className="mt-3 text-center">
            <p className="text-gray-600">{getGreeting()}</p>
            <p className="text-sm text-teal-600 font-medium">
              📊 {locations.length}개 장소 등록됨 | 💾 IndexedDB 저장
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleNewLocation}
            className="bg-white rounded-lg p-4 shadow-sm border hover:shadow-md transition-shadow touch-target text-left"
          >
            <div className="flex items-center gap-3">
              <div className="bg-teal-100 p-2 rounded-lg">
                <PlusCircle className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">새 장소 등록</p>
                <p className="text-xs text-gray-500">Blob 방식 저장</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => setCurrentView('report')}
            className="bg-white rounded-lg p-4 shadow-sm border hover:shadow-md transition-shadow touch-target text-left"
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">보고서 생성</p>
                <p className="text-xs text-gray-500">PDF 내보내기</p>
              </div>
            </div>
          </button>
        </div>

        {/* Location List */}
        <LocationList 
          locations={locations}
          onEdit={handleEditLocation}
          onDelete={handleDeleteLocation}
        />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          isOpen={showSettings}
          settings={settings}
          onSave={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default Index;
