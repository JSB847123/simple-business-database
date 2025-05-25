# 현장 리포트 스크라이브 (모바일 웹앱)

출장 및 현장 데이터 수집을 위한 PWA(Progressive Web App) 모바일 애플리케이션입니다.

## ✨ 주요 기능

- 📱 **모바일 최적화**: 터치 친화적 인터페이스
- 🔄 **오프라인 지원**: 서비스 워커를 통한 오프라인 기능
- 📥 **앱 설치**: 홈 화면에 추가 가능 (PWA)
- 🗺️ **위치 정보 수집**: GPS 좌표 및 주소 입력
- 📸 **이미지 첨부**: 현장 사진 업로드
- 📄 **보고서 생성**: Word 문서 형태 내보내기
- 💾 **로컬 저장**: 브라우저 저장소 활용

## 🚀 시작하기

### 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 미리보기
npm run preview
```

### PWA 기능 테스트

1. HTTPS 환경에서 실행 (로컬 개발은 localhost 허용)
2. 브라우저에서 앱 설치 프롬프트 확인
3. 개발자 도구 > Application > Service Workers에서 SW 등록 확인

## 📱 모바일 최적화 기능

### 반응형 디자인
- 모바일 우선 설계
- 터치 최적화된 버튼 크기 (최소 44px)
- 안전 영역 (Safe Area) 지원

### PWA 기능
- **매니페스트**: 앱 메타데이터 및 아이콘
- **서비스 워커**: 오프라인 캐싱 및 백그라운드 동기화
- **설치 프롬프트**: 홈 화면 추가 안내
- **업데이트 알림**: 새 버전 사용 가능 시 알림

### 모바일 UX
- 햅틱 피드백 지원
- 스와이프 제스처
- 키보드 최적화
- 상태바 색상 조정

## 🛠️ 기술 스택

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Build Tool**: Vite
- **PWA**: 커스텀 서비스 워커
- **Storage**: localStorage API
- **File Export**: docx 라이브러리

## 📁 프로젝트 구조

```
src/
├── components/          # UI 컴포넌트
│   ├── LocationForm.tsx # 위치 정보 입력 폼
│   ├── LocationList.tsx # 위치 목록 표시
│   ├── PWAInstallPrompt.tsx # PWA 설치 프롬프트
│   └── ui/             # shadcn/ui 컴포넌트
├── hooks/              # 커스텀 훅
│   ├── usePWA.ts       # PWA 기능 관리
│   └── use-toast.ts    # 토스트 알림
├── pages/              # 페이지 컴포넌트
│   └── Index.tsx       # 메인 페이지
├── types/              # TypeScript 타입 정의
├── utils/              # 유틸리티 함수
└── styles/             # 스타일 파일
public/
├── manifest.json       # PWA 매니페스트
├── sw.js              # 서비스 워커
├── icon-192.png       # PWA 아이콘 (192x192)
└── icon-512.png       # PWA 아이콘 (512x512)
```

## 📱 모바일 설치 가이드

### Android (Chrome)
1. 웹사이트 방문
2. 주소창 옆 설치 버튼 클릭
3. "홈 화면에 추가" 선택

### iOS (Safari)
1. 웹사이트 방문
2. 공유 버튼 탭
3. "홈 화면에 추가" 선택

## 🔧 환경 설정

### 필수 환경 변수
현재 버전은 환경 변수가 필요하지 않습니다.

### 브라우저 지원
- Chrome 67+
- Firefox 67+
- Safari 11.1+
- Edge 79+

## 📋 개발 가이드

### 새 기능 추가
1. 컴포넌트 작성
2. 타입 정의 추가
3. 모바일 최적화 확인
4. PWA 호환성 테스트

### 성능 최적화
- 코드 스플리팅
- 이미지 최적화
- 서비스 워커 캐싱 전략
- 번들 크기 모니터링

## 🐛 문제 해결

### 서비스 워커 문제
```bash
# 브라우저 개발자 도구
Application > Service Workers > Unregister
```

### 캐시 문제
```bash
# 하드 리프레시
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

## 📄 라이센스

MIT License

## 🤝 기여하기

1. Fork the project
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
