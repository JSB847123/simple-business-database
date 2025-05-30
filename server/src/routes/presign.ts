import { Router, Request, Response, RequestHandler } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, R2_CONFIG, generateFileKey, getPublicUrl } from '../utils/s3Client';
import { PresignRequest, PresignResponse, ApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /api/presign
 * Generate presigned URL for file upload
 */
const createPresignedUrl: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { fileName, fileType, locationId, floorId }: PresignRequest = req.body;

    // Validation
    if (!fileName || !fileType || !locationId) {
      res.status(400).json({
        success: false,
        error: 'fileName, fileType, and locationId are required'
      } as ApiResponse);
      return;
    }

    // Generate unique file key
    const finalFloorId = floorId || 'default';
    const fileKey = generateFileKey(locationId, finalFloorId, fileName);

    // Create presigned URL for PUT operation
    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: fileKey,
      ContentType: fileType,
      Metadata: {
        locationId,
        floorId: finalFloorId,
        originalName: fileName,
        uploadId: uuidv4(),
      },
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: R2_CONFIG.uploadExpiration,
    });

    const downloadUrl = getPublicUrl(fileKey);

    const response: PresignResponse = {
      uploadUrl,
      downloadUrl,
      fileKey,
      expiresIn: R2_CONFIG.uploadExpiration,
    };

    res.json({
      success: true,
      data: response,
      message: 'Presigned URL generated successfully'
    } as ApiResponse<PresignResponse>);

  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate presigned URL'
    } as ApiResponse);
  }
};

/**
 * POST /api/presign/batch
 * Generate multiple presigned URLs for batch upload
 */
const createBatchPresignedUrls: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { files, locationId, floorId } = req.body;

    if (!files || !Array.isArray(files) || !locationId) {
      res.status(400).json({
        success: false,
        error: 'files array and locationId are required'
      } as ApiResponse);
      return;
    }

    const finalFloorId = floorId || 'default';
    const presignedUrls: PresignResponse[] = [];

    for (const file of files) {
      const { fileName, fileType } = file;
      
      if (!fileName || !fileType) {
        continue; // Skip invalid files
      }

      const fileKey = generateFileKey(locationId, finalFloorId, fileName);

      const command = new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: fileKey,
        ContentType: fileType,
        Metadata: {
          locationId,
          floorId: finalFloorId,
          originalName: fileName,
          uploadId: uuidv4(),
        },
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: R2_CONFIG.uploadExpiration,
      });

      const downloadUrl = getPublicUrl(fileKey);

      presignedUrls.push({
        uploadUrl,
        downloadUrl,
        fileKey,
        expiresIn: R2_CONFIG.uploadExpiration,
      });
    }

    res.json({
      success: true,
      data: presignedUrls,
      message: `Generated ${presignedUrls.length} presigned URLs`
    } as ApiResponse<PresignResponse[]>);

  } catch (error) {
    console.error('Error generating batch presigned URLs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate presigned URLs'
    } as ApiResponse);
  }
};

router.post('/', createPresignedUrl);
router.post('/batch', createBatchPresignedUrls);

export default router; 