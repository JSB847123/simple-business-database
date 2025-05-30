export interface Photo {
  id: string;
  name: string;
  url?: string; // Cloud URL
  size?: number;
  timestamp: number;
}

export interface Floor {
  id: string;
  floorName: string;
  customFloorName?: string;
  floorInfo: string;
  photos: Photo[];
  isCompleted?: boolean;
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
  lastSaved?: number;
  userId?: string; // For future user management
}

export interface PresignRequest {
  fileName: string;
  fileType: string;
  locationId: string;
  floorId?: string;
}

export interface PresignResponse {
  uploadUrl: string;
  downloadUrl: string;
  fileKey: string;
  expiresIn: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface LocationQuery extends PaginationParams {
  locationType?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
} 