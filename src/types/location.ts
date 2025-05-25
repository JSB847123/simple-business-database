export interface Photo {
  id: string;
  data: string; // Base64 encoded image data
  name: string;
}

export interface Floor {
  id: string;
  floorName: string;
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
}

export const LOCATION_TYPES = [
  '종교시설',
  '영유아시설', 
  '유흥주점',
  '멸실',
  '신축',
  '공영주차장',
  '가설건축물',
  '기타'
];

export const FLOOR_OPTIONS = [
  'B3', 'B2', 'B1', '1층', '2층', '3층', '4층', '5층', '6층', '7층', '8층', '9층', '10층'
];
