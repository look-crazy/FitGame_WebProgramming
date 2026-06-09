# 🎮 FitGame — 운동 기록 기반 경쟁형 헬스 게임

> "기존 운동 앱은 기록만 한다. FitGame은 그 기록을 게임으로 만든다."

대학 포트폴리오용 풀스택 웹 애플리케이션

---

## ✨ 핵심 기능

| 기능 | 설명 |
|------|------|
| 🎯 **게임화 시스템** | 운동 → 점수 → EXP → 레벨업, 5단계 티어 (Bronze~Diamond) |
| ⚔️ **실시간 배틀** | 주간 점수로 친구와 1:1 배틀, Socket.io 실시간 결과 |
| 🏆 **업적 시스템** | 6종 업적, 달성 시 즉시 알림 및 포인트 보상 |
| 🤖 **AI 코치** | GPT-3.5 기반 운동 분석 + 맞춤 루틴 추천 (API 키 없이 데모 모드) |
| 📊 **통계 대시보드** | Chart.js 기반 주간/월간 운동 추이, 타입별 분석 |
| 👥 **소셜 기능** | 친구 추가, 친구 랭킹, 실시간 활동 피드 |
| 📅 **운동 달력** | 날짜별 운동 기록 조회, 직관적 캘린더 UI |

---

## 🛠 기술 스택

**백엔드**
- Node.js + Express.js (REST API)
- MongoDB + Mongoose (데이터베이스)
- Socket.io (실시간 양방향 통신)
- JWT (인증), bcryptjs (암호화)
- OpenAI API (AI 코치)
- Multer (프로필 이미지 업로드)

**프론트엔드**
- Vanilla JS (ES6+, 모듈 패턴)
- Chart.js (통계 차트)
- Socket.io Client (실시간 알림)
- CSS3 (다크 테마 + Glassmorphism + 네온 효과)

---

## 🚀 설치 및 실행

### 1. 저장소 클론

```bash
git clone <repository-url>
cd fitgame
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일 수정:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/fitgame
JWT_SECRET=your_super_secret_jwt_key_here_change_this
OPENAI_API_KEY=sk-...          # 없으면 데모 모드로 동작
```

### 4. MongoDB 실행

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Ubuntu/Debian
sudo systemctl start mongod

# Docker
docker run -d -p 27017:27017 mongo
```

### 5. 테스트 데이터 생성 (선택)

```bash
node server/seed.js
```

테스트 계정이 자동 생성됩니다:
- `test@fitgame.com` / `test1234`
- `iron@fitgame.com` / `test1234`

### 6. 서버 시작

```bash
# 개발 모드 (nodemon, 자동 재시작)
npm run dev

# 프로덕션 모드
npm start
```

### 7. 브라우저에서 접속

```
http://localhost:3000
```

---

## 📁 프로젝트 구조

```
fitgame/
├── server/
│   ├── index.js              # 메인 서버 (Express + Socket.io)
│   ├── seed.js               # 테스트 데이터 시드
│   ├── config/
│   │   ├── database.js       # MongoDB 연결
│   │   └── gameConfig.js     # 게임 로직 상수 & 점수 계산
│   ├── middleware/
│   │   └── auth.js           # JWT 인증 미들웨어
│   ├── models/
│   │   ├── User.js           # 유저 스키마 (레벨, 업적, 친구)
│   │   └── Workout.js        # 운동 기록 스키마
│   ├── routes/
│   │   ├── auth.js           # 회원가입 / 로그인
│   │   ├── workout.js        # 운동 CRUD + 점수 계산
│   │   ├── game.js           # 게임 상태 / 배틀
│   │   ├── ranking.js        # 랭킹 조회
│   │   ├── ai.js             # AI 코치 (OpenAI)
│   │   └── user.js           # 유저 검색 / 친구
│   └── socket/
│       └── socketHandler.js  # Socket.io 이벤트 처리
├── public/
│   ├── index.html            # SPA 엔트리포인트
│   ├── css/
│   │   └── main.css          # 다크 네온 테마 스타일시트
│   ├── js/
│   │   ├── api.js            # API 클라이언트 (중앙화)
│   │   ├── auth.js           # 인증 UI
│   │   ├── game.js           # 대시보드 / 랭킹 / 배틀 / 업적
│   │   ├── workout.js        # 운동 기록 CRUD UI
│   │   ├── stats.js          # 통계 차트
│   │   ├── ai.js             # AI 코치 UI
│   │   ├── socket.js         # 실시간 이벤트 처리
│   │   └── app.js            # SPA 라우터 & 초기화
│   └── uploads/              # 프로필 이미지 저장
├── .env.example
├── package.json
└── README.md
```

---

## 🎮 게임 시스템 상세

### 점수 계산

```
근력 운동: (무게 × 반복 × 세트수) / 10 × 운동 가중치
유산소:    시간(분) × 운동 가중치
```

### EXP & 레벨

```
EXP 획득 = 점수 / 10 (최소 10 EXP)
레벨 필요 EXP = 100 × N × (N+1) / 2
```

### 티어 시스템

| 티어 | 레벨 구간 | 색상 |
|------|-----------|------|
| 🥉 Bronze | Lv. 1 – 9 | #cd7f32 |
| 🥈 Silver | Lv. 10 – 19 | #c0c0c0 |
| 🥇 Gold | Lv. 20 – 29 | #ffd700 |
| 💎 Platinum | Lv. 30 – 49 | #00d4ff |
| 💠 Diamond | Lv. 50+ | #a855f7 |

### 업적 목록

| 업적 | 조건 | 보상 |
|------|------|------|
| 첫걸음 | 첫 운동 기록 | +50 포인트 |
| 7일 연속 | 7일 연속 운동 | +200 포인트 |
| 2시간 운동 | 단일 운동 120분+ | +100 포인트 |
| 스쿼트 100kg | 스쿼트 100kg+ | +150 포인트 |
| 10회 달성 | 총 10회 운동 | +100 포인트 |
| 30회 달성 | 총 30회 운동 | +300 포인트 |

---

## 🔌 API 엔드포인트

### 인증
```
POST /api/auth/register      회원가입 (multipart/form-data)
POST /api/auth/login         로그인
GET  /api/auth/me            내 정보
PUT  /api/auth/profile       프로필 수정
GET  /api/auth/check-nickname?nickname=xxx  닉네임 중복확인
```

### 운동
```
GET    /api/workout          운동 목록 (query: date, limit)
POST   /api/workout          운동 추가
PUT    /api/workout/:id      운동 수정
DELETE /api/workout/:id      운동 삭제
GET    /api/workout/stats    운동 통계
GET    /api/workout/calendar 달력 데이터
```

### 게임
```
GET  /api/game/status        내 게임 상태
GET  /api/game/achievements  업적 목록
POST /api/game/battle        배틀 신청
```

### 랭킹
```
GET /api/ranking             전체/주간/친구 랭킹 (query: type)
```

### AI
```
POST /api/ai/analyze         운동 분석
POST /api/ai/routine         루틴 추천
POST /api/ai/chat            채팅
```

---

## 🔧 개발 환경

- Node.js 18+
- MongoDB 6+
- npm 9+

---

*Built with ❤️ for portfolio*
