import React from 'react';
import { Database, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';

interface MigrationProgressProps {
  isRunning: boolean;
  progress: string;
  completed: boolean;
}

const MigrationProgress: React.FC<MigrationProgressProps> = ({
  isRunning,
  progress,
  completed
}) => {
  if (!isRunning && !completed && !progress) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <ArrowRight className="h-4 w-4 text-gray-400" />
            <Database className="h-5 w-5 text-teal-600" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {isRunning && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              )}
              {completed && (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              {!isRunning && !completed && (
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              )}
              
              <span className="text-sm font-medium text-gray-900">
                {isRunning ? 'localStorage → IndexedDB 마이그레이션 중...' : 
                 completed ? '마이그레이션 완료' : '마이그레이션 오류'}
              </span>
            </div>
            
            <p className="text-xs text-gray-600 mt-1">{progress}</p>
          </div>
        </div>
        
        {completed && (
          <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2">
            <p className="text-xs text-green-700">
              ✅ Base64 데이터가 효율적인 Blob 형태로 변환되었습니다. 이제 앱 종료 시에도 데이터가 안전하게 보존됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MigrationProgress; 