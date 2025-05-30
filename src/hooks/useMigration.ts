import { useState, useEffect, useCallback } from 'react';
import { migrateFromLocalStorage, getStorageStats } from '../utils/photo-store';

const MIGRATION_FLAG_KEY = 'photos_migrated_to_indexeddb';

export const useMigration = () => {
  const [migrationStatus, setMigrationStatus] = useState<'pending' | 'running' | 'completed' | 'failed'>('pending');
  const [migrationStats, setMigrationStats] = useState<{
    success: number;
    failed: number;
    totalSizeMB: number;
  } | null>(null);

  // 마이그레이션이 이미 완료되었는지 확인
  const checkMigrationStatus = useCallback(() => {
    const migrated = localStorage.getItem(MIGRATION_FLAG_KEY);
    return migrated === 'true';
  }, []);

  // 마이그레이션 실행
  const runMigration = useCallback(async () => {
    if (checkMigrationStatus()) {
      setMigrationStatus('completed');
      return;
    }

    console.log('Starting photo migration from localStorage to IndexedDB...');
    setMigrationStatus('running');

    try {
      const result = await migrateFromLocalStorage();
      
      setMigrationStats({
        success: result.success,
        failed: result.failed,
        totalSizeMB: Math.round(result.totalSize / 1024 / 1024 * 100) / 100
      });

      // 마이그레이션 완료 플래그 설정
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      setMigrationStatus('completed');

      console.log('Migration completed successfully:', result);
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationStatus('failed');
    }
  }, [checkMigrationStatus]);

  // 앱 시작 시 자동 마이그레이션 실행
  useEffect(() => {
    const initializeMigration = async () => {
      if (!checkMigrationStatus()) {
        // 현재 저장소 상태 확인
        const stats = await getStorageStats();
        
        // IndexedDB에 이미 사진이 있으면 마이그레이션 스킵
        if (stats.count > 0) {
          console.log('IndexedDB already has photos, skipping migration');
          localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
          setMigrationStatus('completed');
          return;
        }

        // localStorage에서 사진 데이터가 있는지 확인
        const hasLegacyData = Object.keys(localStorage).some(key => {
          try {
            const data = localStorage.getItem(key);
            if (data && (key.startsWith('location_') || key === 'locations')) {
              const parsed = JSON.parse(data);
              const locations = Array.isArray(parsed) ? parsed : [parsed];
              return locations.some(loc => 
                loc.floors?.some((floor: any) => 
                  floor.photos?.some((photo: any) => 
                    photo.data?.startsWith('data:image/')
                  )
                )
              );
            }
          } catch {
            return false;
          }
          return false;
        });

        if (hasLegacyData) {
          await runMigration();
        } else {
          // 마이그레이션할 데이터가 없음
          localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
          setMigrationStatus('completed');
        }
      } else {
        setMigrationStatus('completed');
      }
    };

    initializeMigration();
  }, [checkMigrationStatus, runMigration]);

  // 강제 마이그레이션 재실행 (개발/디버깅용)
  const forceMigration = useCallback(async () => {
    localStorage.removeItem(MIGRATION_FLAG_KEY);
    await runMigration();
  }, [runMigration]);

  return {
    migrationStatus,
    migrationStats,
    runMigration,
    forceMigration,
    isMigrationCompleted: migrationStatus === 'completed'
  };
}; 