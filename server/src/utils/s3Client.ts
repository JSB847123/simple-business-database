import { S3Client } from '@aws-sdk/client-s3';

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || '',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true, // Required for R2
});

export const R2_CONFIG = {
  bucketName: process.env.R2_BUCKET_NAME || 'field-reports',
  publicUrl: process.env.R2_PUBLIC_URL || '',
  uploadExpiration: 3600, // 1 hour
};

// Generate file key for consistent organization
export const generateFileKey = (locationId: string, floorId: string, fileName: string): string => {
  const timestamp = Date.now();
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `locations/${locationId}/floors/${floorId}/${timestamp}_${cleanFileName}`;
};

// Get public URL for uploaded file
export const getPublicUrl = (fileKey: string): string => {
  if (R2_CONFIG.publicUrl) {
    return `${R2_CONFIG.publicUrl}/${fileKey}`;
  }
  // Fallback to direct R2 URL (if bucket is public)
  return `${process.env.R2_ENDPOINT}/${R2_CONFIG.bucketName}/${fileKey}`;
}; 