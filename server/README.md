# Field Report Server

Express.js 기반 백엔드 API 서버로 현장 리포트 앱의 데이터 저장 및 파일 업로드를 담당합니다.

## 🏗️ 아키텍처

- **Express.js**: RESTful API 서버
- **SQLite**: 로컬 데이터베이스
- **Cloudflare R2**: 이미지 파일 저장 (S3 호환)
- **TypeScript**: 타입 안전성

## 📁 프로젝트 구조

```
server/
├── src/
│   ├── routes/
│   │   ├── presign.ts      # Presigned URL 생성 API
│   │   └── records.ts      # 위치 데이터 CRUD API
│   ├── db/
│   │   └── database.ts     # SQLite 데이터베이스 모델
│   ├── utils/
│   │   └── s3Client.ts     # S3/R2 클라이언트 설정
│   ├── types/
│   │   └── index.ts        # TypeScript 타입 정의
│   └── index.ts            # 메인 서버 애플리케이션
├── package.json
├── tsconfig.json
└── nodemon.json
```

## 🚀 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env` 파일을 생성하고 다음 내용을 설정하세요:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Settings
CORS_ORIGIN=http://localhost:8082

# Cloudflare R2 Configuration
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_BUCKET_NAME=field-reports
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_PUBLIC_URL=https://your-domain.com

# Database
DATABASE_PATH=./database.sqlite
```

### 3. 개발 서버 실행
```bash
npm run dev
```

### 4. 프로덕션 빌드
```bash
npm run build
npm start
```

## 📡 API 엔드포인트

### Health Check
- `GET /health` - 서버 상태 확인

### Presigned URLs
- `POST /api/presign` - 단일 파일 업로드 URL 생성
- `POST /api/presign/batch` - 다중 파일 업로드 URL 생성

### Location Records
- `GET /api/records` - 위치 데이터 목록 조회
- `GET /api/records/:id` - 특정 위치 데이터 조회
- `POST /api/records` - 새 위치 데이터 생성
- `PUT /api/records/:id` - 위치 데이터 수정
- `DELETE /api/records/:id` - 위치 데이터 삭제
- `GET /api/records/stats` - 통계 정보 조회

## 🔧 주요 기능

### 1. Presigned URL 생성
클라이언트가 직접 R2에 파일을 업로드할 수 있도록 임시 서명된 URL을 생성합니다.

```typescript
// 요청 예시
POST /api/presign
{
  "fileName": "photo.jpg",
  "fileType": "image/jpeg",
  "locationId": "loc-123",
  "floorId": "floor-456"
}

// 응답 예시
{
  "success": true,
  "data": {
    "uploadUrl": "https://...",
    "downloadUrl": "https://...",
    "fileKey": "locations/loc-123/floors/floor-456/1234567890_photo.jpg",
    "expiresIn": 3600
  }
}
```

### 2. 위치 데이터 관리
현장 리포트의 위치 정보와 층별 데이터를 SQLite에 저장하고 관리합니다.

### 3. 파일 조직화
업로드된 파일은 다음과 같은 구조로 저장됩니다:
```
locations/{locationId}/floors/{floorId}/{timestamp}_{filename}
```

## 🔒 보안 고려사항

- CORS 설정으로 허용된 도메인만 접근 가능
- Presigned URL은 1시간 후 만료
- 파일 업로드 크기 제한 (10MB)
- 환경 변수로 민감한 정보 관리

## 🛠️ 개발 도구

- **TypeScript**: 타입 안전성
- **Nodemon**: 개발 중 자동 재시작
- **ESLint**: 코드 품질 관리

## 📊 모니터링

서버 상태는 `/health` 엔드포인트를 통해 확인할 수 있습니다:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600
}
``` 