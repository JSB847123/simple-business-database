export interface Photo {
  id: string;
  data?: string; // Base64 encoded image data (legacy, for backward compatibility)
  name: string;
  timestamp?: number; // 사진 업로드 시간
  blobUrl?: string; // Blob URL for display (temporary)
}

export interface Floor {
  id: string;
  floorName: string;
  customFloorName?: string; // "기타" 선택 시 사용자가 입력하는 층 이름
  floorInfo: string;
  photos: Photo[];
  isCompleted?: boolean; // 층별 완료 상태
}

export interface Address {
  addressAndName: string;
}

export interface Location {
  id: string;
  address: Address;
  locationType?: string;
  checkItems?: string;
  floors: Floor[];
  notes?: string;
  timestamp: number;
  lastSaved?: number; // 마지막 저장 시간
}

export interface AppSettings {
  autoSaveEnabled: boolean;
  autoSaveInterval: number; // 초 단위
}

export const LOCATION_TYPES = [
  '종교시설',
  '영유아시설', 
  '유흥주점',
  '멸실',
  '신축',
  '공영주차장',
  '가설건축물',
  '지역아동센터',
  '노인복지시설',
  '기타'
];

export const FLOOR_OPTIONS = [
  'B3', 'B2', 'B1', '1층', '2층', '3층', '4층', '5층', '6층', '7층', '8층', '9층', '10층', '기타'
];
