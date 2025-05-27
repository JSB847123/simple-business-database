import React, { useState } from 'react';
import { X, Save, Clock } from 'lucide-react';
import { AppSettings } from '../types/location';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, settings, onSave, onClose }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
  };

  const intervalOptions = [
    { value: 3, label: '3초' },
    { value: 5, label: '5초' },
    { value: 10, label: '10초' },
    { value: 30, label: '30초' },
    { value: 60, label: '1분' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">설정</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* 자동저장 설정 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-600" />
              <h3 className="text-md font-medium">자동저장 설정</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  자동저장 활성화
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.autoSaveEnabled}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      autoSaveEnabled: e.target.checked
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {localSettings.autoSaveEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    저장 간격
                  </label>
                  <select
                    value={localSettings.autoSaveInterval}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      autoSaveInterval: Number(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    {intervalOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    설정한 간격마다 자동으로 데이터가 저장됩니다.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>자동저장 기능:</strong><br />
                  • 활성화 시 설정한 간격마다 자동으로 데이터를 저장합니다<br />
                  • 메모리 부족으로 앱이 종료되어도 데이터 손실을 방지할 수 있습니다<br />
                  • 비활성화 시 수동으로 저장 버튼을 눌러야 합니다
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700"
          >
            <Save className="h-4 w-4" />
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal; 