import express, { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// 업로드 디렉토리 생성
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer 설정 - 메모리 스토리지 사용 (나중에 S3로 업로드)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
    files: 5, // 최대 5개 파일
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  },
});

// 🚀 다중 파일 업로드 API - FormData + array 방식
router.post('/upload-multiple', upload.array('photos[]', 5), async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== 서버 다중 파일 업로드 디버깅 ===');
    console.log('req.files 타입:', Array.isArray(req.files) ? 'Array' : typeof req.files);
    console.log('받은 파일 수:', req.files?.length || 0);
    console.log('요청 바디:', req.body);
    console.log('요청 헤더:', {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      userAgent: req.headers['user-agent']
    });
    
    // 파일 필드 이름 로깅
    console.log('요청의 모든 필드:', Object.keys(req.body));
    
    // 파일 내용 체크
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      console.log('🔍 첫 번째 파일 필드 이름:', req.files[0].fieldname);
      console.log('🔍 요청에 포함된 파일 필드 목록:', [...new Set(req.files.map(f => f.fieldname))]);
    }
    
    // 📋 각 파일 상세 정보
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file, index) => {
        console.log(`파일 ${index + 1}:`, {
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: `${Math.round(file.size / 1024)}KB`,
          buffer: file.buffer ? `${Math.round(file.buffer.length / 1024)}KB` : 'empty'
        });
      });
    }
    
    const files = req.files as Express.Multer.File[];
    const { locationId, floorId } = req.body;
    
    if (!files || files.length === 0) {
      console.error('❌ 파일이 없습니다. req.files:', req.files);
      res.status(400).json({
        success: false,
        error: 'No files uploaded',
        message: '업로드할 파일이 없습니다.',
        debug: {
          filesLength: req.files?.length || 0,
          filesType: typeof req.files,
          isArray: Array.isArray(req.files)
        }
      });
      return;
    }

    if (!locationId || !floorId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'locationId와 floorId가 필요합니다.'
      });
      return;
    }

    const uploadedPhotos = [];
    
    console.log(`📁 ${files.length}개 파일 처리 시작`);
    
    // 각 파일 처리
    for (const [index, file] of files.entries()) {
      console.log(`처리 중 ${index + 1}/${files.length}: ${file.originalname}`);
      
      const photoId = uuidv4();
      const fileExtension = path.extname(file.originalname) || '.jpg';
      const fileName = `${photoId}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);
      
      // 임시로 로컬에 저장 (실제로는 S3로 업로드)
      await fs.promises.writeFile(filePath, file.buffer);
      
      const photoData = {
        id: photoId,
        name: file.originalname,
        fileName: fileName,
        size: file.size,
        mimetype: file.mimetype,
        locationId,
        floorId,
        url: `/uploads/${fileName}`, // 임시 URL
        timestamp: Date.now()
      };
      
      uploadedPhotos.push(photoData);
      
      console.log(`✅ 파일 처리 완료 ${index + 1}/${files.length}: ${file.originalname} -> ${fileName}`);
    }

    console.log(`🎉 총 ${uploadedPhotos.length}개 파일 업로드 완료`);
    
    // 📊 결과 검증
    if (uploadedPhotos.length !== files.length) {
      console.error(`⚠️ 처리 결과 불일치: 입력 ${files.length}개, 출력 ${uploadedPhotos.length}개`);
    }
    
    res.json({
      success: true,
      message: `${uploadedPhotos.length}개 파일이 성공적으로 업로드되었습니다.`,
      data: {
        photos: uploadedPhotos,
        count: uploadedPhotos.length
      }
    });

  } catch (error) {
    console.error('파일 업로드 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      message: error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.'
    });
  }
});

// 🔄 대안 라우트: photos 키로도 다중 파일 처리 (photos[] 키가 안 되는 환경 대응)
router.post('/upload-multiple-alt', upload.array('photos', 5), async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== 대안 라우트: photos 키로 다중 파일 업로드 ===');
    console.log('받은 파일 수:', req.files?.length || 0);
    
    const files = req.files as Express.Multer.File[];
    const { locationId, floorId } = req.body;
    
    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No files uploaded',
        message: '업로드할 파일이 없습니다 (대안 라우트)'
      });
      return;
    }

    if (!locationId || !floorId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'locationId와 floorId가 필요합니다.'
      });
      return;
    }

    const uploadedPhotos = [];
    
    for (const file of files) {
      const photoId = uuidv4();
      const fileExtension = path.extname(file.originalname) || '.jpg';
      const fileName = `${photoId}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);
      
      await fs.promises.writeFile(filePath, file.buffer);
      
      const photoData = {
        id: photoId,
        name: file.originalname,
        fileName: fileName,
        size: file.size,
        mimetype: file.mimetype,
        locationId,
        floorId,
        url: `/uploads/${fileName}`,
        timestamp: Date.now()
      };
      
      uploadedPhotos.push(photoData);
      console.log(`대안 라우트 파일 처리: ${file.originalname}`);
    }

    console.log(`대안 라우트: ${uploadedPhotos.length}개 파일 업로드 완료`);
    
    res.json({
      success: true,
      message: `${uploadedPhotos.length}개 파일이 성공적으로 업로드되었습니다 (대안 라우트).`,
      data: {
        photos: uploadedPhotos,
        count: uploadedPhotos.length
      }
    });

  } catch (error) {
    console.error('대안 라우트 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      message: error instanceof Error ? error.message : '대안 라우트 업로드 중 오류가 발생했습니다.'
    });
  }
});

// 단일 파일 업로드 API (카메라용)
router.post('/upload-single', upload.single('photo'), async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== 단일 파일 업로드 시작 ===');
    
    const file = req.file;
    const { locationId, floorId } = req.body;
    
    if (!file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: '업로드할 파일이 없습니다.'
      });
      return;
    }

    if (!locationId || !floorId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'locationId와 floorId가 필요합니다.'
      });
      return;
    }

    const photoId = uuidv4();
    const fileExtension = path.extname(file.originalname) || '.jpg';
    const fileName = `${photoId}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);
    
    // 임시로 로컬에 저장
    await fs.promises.writeFile(filePath, file.buffer);
    
    const photoData = {
      id: photoId,
      name: file.originalname,
      fileName: fileName,
      size: file.size,
      mimetype: file.mimetype,
      locationId,
      floorId,
      url: `/uploads/${fileName}`,
      timestamp: Date.now()
    };
    
    console.log(`파일 처리 완료: ${file.originalname} -> ${fileName}`);
    
    res.json({
      success: true,
      message: '파일이 성공적으로 업로드되었습니다.',
      data: {
        photo: photoData
      }
    });

  } catch (error) {
    console.error('파일 업로드 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Upload failed',
      message: error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.'
    });
  }
});

// 업로드된 파일 정적 서빙
router.use('/uploads', express.static(uploadsDir));

// 파일 삭제 API
router.delete('/:photoId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { photoId } = req.params;
    
    // 파일 시스템에서 삭제 (실제로는 S3에서도 삭제)
    const files = await fs.promises.readdir(uploadsDir);
    const targetFile = files.find(file => file.startsWith(photoId));
    
    if (targetFile) {
      const filePath = path.join(uploadsDir, targetFile);
      await fs.promises.unlink(filePath);
      console.log(`파일 삭제 완료: ${targetFile}`);
    }
    
    res.json({
      success: true,
      message: '파일이 삭제되었습니다.',
      data: { photoId }
    });

  } catch (error) {
    console.error('파일 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: 'Delete failed',
      message: error instanceof Error ? error.message : '파일 삭제 중 오류가 발생했습니다.'
    });
  }
});

export default router; 