# Fleet Tracker Frontend 명세

WebSocket 기반 백엔드 서버와 연동하여 GPS 경로, 속도, 가속도를 실시간으로 시각화하는 대시보드 프론트엔드의 동작을 정의한다.

> **백엔드 참조:** [`fleet-tracker-backend/docs/SPEC.md`](../../fleet-tracker-backend/docs/SPEC.md)  
> **디자인 참조:** [`docs/design/dashboard-mockup.png`](./design/dashboard-mockup.png)

---

## 개요

| 항목 | 내용 |
|------|------|
| 목적 | 식별자 기반 차량 텔레메트리(GPS·속도·가속도) 실시간 수집·모니터링 |
| 통신 | WebSocket (주), HTTP (보조) |
| 백엔드 주소 | `127.0.0.1:8000` (기본값, 변경 가능) |

---

## 설정 (상수화)

백엔드 서버 주소는 환경·배포에 따라 변경될 수 있으므로 **단일 설정 파일**에 상수로 분리한다.

```ts
// 예: src/config.ts
export const BACKEND_HOST = '127.0.0.1';
export const BACKEND_PORT = 8000;
export const BACKEND_WS_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}/ws`;
export const BACKEND_HTTP_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
```

| 상수 | 기본값 | 설명 |
|------|--------|------|
| `BACKEND_HOST` | `127.0.0.1` | 백엔드 호스트 |
| `BACKEND_PORT` | `8000` | 백엔드 포트 |
| `BACKEND_WS_URL` | `ws://127.0.0.1:8000/ws` | WebSocket 엔드포인트 |
| `BACKEND_HTTP_URL` | `http://127.0.0.1:8000` | HTTP 엔드포인트 (예: `/ram`) |

향후 `.env` 또는 빌드 타임 환경 변수로 덮어쓸 수 있도록 확장 가능하게 설계한다.

---

## 1. 접속자 식별

### 1.1 식별자 규칙

| 항목 | 규칙 |
|------|------|
| 저장 위치 | 브라우저 Cookie |
| Cookie 이름 | `fleet_tracker_id` (구현 시 확정) |
| 허용 문자 | 영문 대·소문자(`A–Z`, `a–z`) 및 숫자(`0–9`)만 |
| 길이 | 1자 이상 (권장: 8~16자) |

유효하지 않은 문자가 포함된 경우 입력 필드에서 즉시 검증 오류를 표시하고, Cookie 저장 및 WebSocket 연결을 진행하지 않는다.

### 1.2 초기 접속 흐름

```
앱 진입
  │
  ├─ Cookie에 유효한 식별자 존재? ──Yes──▶ 대시보드 (GPS 획득) ──▶ 3. WebSocket 연결
  │
  No
  │
  ▼
식별자 입력 화면 표시
  (랜덤 식별자가 미리 입력된 상태)
  │
  ▼
사용자 확인 또는 수정 후 제출
  │
  ▼
Cookie에 식별자 저장
  │
  ▼
대시보드 진입 (GPS 획득)
  │
  ▼
3. WebSocket 연결
```

### 1.3 식별자 입력 화면

- **최초 접속자**에게 식별자 입력을 요청한다.
- 화면 진입 시 **랜덤 알파벳·숫자 문자열**이 입력 필드에 **미리 채워진 상태**로 표시된다.
- 사용자는 제안된 값을 그대로 사용하거나 수정할 수 있다.
- 제출 시 Cookie에 저장하고 대시보드로 이동한다.

**랜덤 식별자 생성 예시:**

```ts
function generateIdentifier(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
```

### 1.4 Cookie 재사용 (1.1)

Cookie에 유효한 식별자가 이미 존재하면 **식별자 입력 단계를 건너뛰고** 바로 WebSocket 연결(3번)로 진행한다.

---

## 2. GPS 획득 및 전송

대시보드에 진입하면 **사용자(단말)의 현재 GPS 좌표**를 획득하고, WebSocket 연결 후 백엔드로 주기적으로 전송한다.

### 2.1 획득 시점

| 항목 | 규칙 |
|------|------|
| 시작 시점 | 대시보드 페이지 진입 직후 |
| 종료 시점 | 대시보드 이탈 또는 WebSocket 연결 해제 시 |
| 전제 조건 | Cookie에 유효한 식별자가 저장된 상태 |

### 2.2 Geolocation API

프론트엔드는 브라우저 **Geolocation API**(`navigator.geolocation`)로 GPS를 획득한다.

```ts
navigator.geolocation.getCurrentPosition(
  (position) => {
    const { latitude: lat, longitude: lng } = position.coords;
    // lat, lng 사용
  },
  (error) => { /* 권한 거부·타임아웃 등 처리 */ },
  { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
);
```

| 항목 | 권장값 |
|------|--------|
| API | `navigator.geolocation.getCurrentPosition` |
| `enableHighAccuracy` | `true` |
| `maximumAge` | `0` (캐시된 위치 미사용) |
| `timeout` | `10_000` ms |

**권한 처리:**

| 상태 | UI·동작 |
|------|---------|
| 권한 요청 중 | 위치 권한 안내 및 로딩 표시 |
| 권한 허용 | GPS 획득 후 WebSocket 전송 시작 |
| 권한 거부 | 오류 메시지 표시, 전송 중단 (재시도 안내) |
| 위치 unavailable / timeout | 오류 표시, 다음 주기(1초)에 재시도 |

> Geolocation API는 **HTTPS** 또는 `localhost` 환경에서 동작한다. 배포 시 TLS 적용을 전제로 한다.

### 2.3 WebSocket 전송

WebSocket 연결이 **수립된 이후**, **1초 간격**으로 현재 GPS와 식별자를 백엔드에 전송한다.

| 항목 | 값 |
|------|-----|
| action | `store_gps` |
| 전송 주기 | 1초 |
| 식별자 | Cookie의 `fleet_tracker_id` |
| 좌표 | Geolocation API로 획득한 `lat`, `lng` |
| 시간 | GPS 획득 시각 (Unix timestamp, 초 단위) |

**요청 (클라이언트 → 서버)**

```json
{
  "action": "store_gps",
  "identifier": "<식별자>",
  "gps": { "lat": 37.5665, "lng": 126.9780 },
  "time": 1717234567.89
}
```

**응답 (서버 → 클라이언트)**

```json
{ "ok": true }
```

백엔드는 수신한 GPS를 RAM에 저장하고, 이전 데이터를 바탕으로 **속도·가속도**를 계산한다.

### 2.4 전송 흐름

```
대시보드 진입
  │
  ▼
Geolocation 권한 요청
  │
  ├─ 거부 ──▶ 오류 UI, 전송 중단
  │
  허용
  │
  ▼
WebSocket 연결 (3번)
  │
  ▼
1초 간격 setInterval
  │
  ├─ getCurrentPosition → lat, lng, time
  └─ WebSocket send store_gps (identifier + gps + time)
```

WebSocket이 끊기면 GPS 전송 타이머를 중지하고, 재연결 성공 시 타이머를 다시 시작한다.

---

## 3. WebSocket 연결

### 3.1 연결

식별자 확정 후 백엔드 WebSocket에 접속한다.

| 항목 | 값 |
|------|-----|
| URL | `BACKEND_WS_URL` (`ws://127.0.0.1:8000/ws`) |
| 프로토콜 | JSON 메시지 |

### 3.2 메시지 형식

백엔드 구현([`fleet-tracker-backend/main.py`](../../fleet-tracker-backend/main.py)) 기준:

**요청 (클라이언트 → 서버)**

GPS 저장 (대시보드, 1초 간격):

```json
{
  "action": "store_gps",
  "identifier": "<식별자>",
  "gps": { "lat": 37.5665, "lng": 126.9780 },
  "time": 1717234567.89
}
```

GPS 조회:

```json
{ "action": "get_gps", "identifier": "<식별자>" }
```

```json
{ "action": "get_speed", "identifier": "<식별자>" }
```

**응답 (서버 → 클라이언트)**

GPS 저장 성공:

```json
{ "ok": true }
```

GPS 조회 성공:

```json
{
  "<식별자>": {
    "<timestamp>": { "GPS": { "lat": 37.5665, "lng": 126.9780 } }
  }
}
```

속도 조회 성공:

```json
{
  "<식별자>": {
    "<timestamp>": { "속도": 17.8 }
  }
}
```

데이터 없음:

```json
{ "error": "not found" }
```

### 3.3 데이터 폴링

WebSocket 연결 후 주기적으로 GPS·속도·가속도 데이터를 요청한다.

| 항목 | 권장값 |
|------|--------|
| 폴링 주기 | 1초 (구현 시 조정 가능) |
| GPS 요청 | `{ "action": "get_gps", "identifier": "..." }` |
| 속도 요청 | `{ "action": "get_speed", "identifier": "..." }` |

### 3.4 가속도 데이터 조회

백엔드 WebSocket은 현재 `get_gps`, `get_speed` 액션만 제공한다. 가속도는 RAM에 저장되지만 전용 WebSocket 액션이 없으므로 아래 중 하나를 사용한다.

| 방식 | 설명 |
|------|------|
| **A. HTTP `/ram` 폴링 (권장, 현재)** | `GET BACKEND_HTTP_URL/ram` 으로 전체 데이터 조회 후 가속도 필드 추출 |
| **B. 백엔드 확장 (향후)** | `get_acceleration` WebSocket 액션 추가 후 전환 |

`/ram` 응답 예시:

```json
{
  "<식별자>": {
    "<timestamp>": {
      "GPS": { "lat": 37.5665, "lng": 126.9780 },
      "속도": 17.8,
      "가속도": 0.42
    }
  }
}
```

> 최초 GPS 수신 시점에는 이전 데이터가 없어 `속도`, `가속도`가 `null`일 수 있다.

### 3.5 연결 상태 관리

| 상태 | UI 표시 |
|------|---------|
| 연결 중 | 로딩 인디케이터 |
| 연결됨 | 정상 데이터 갱신 |
| 연결 끊김 | 재연결 시도 (지수 백오프) 및 상태 표시 |
| 식별자 데이터 없음 | "데이터 대기 중" 안내 |

---

## 4. 데이터 시각화

디자인은 [`docs/design/dashboard-mockup.png`](./design/dashboard-mockup.png)를 따른다.  
다크 테마, 모노스페이스 폰트, 쏘카 블루(속도)·오렌지(가속도) 액센트 컬러.

### 4.1 GPS 경로 표시

**요구사항:** GPS 좌표를 이용해 이동 경로를 화면에 표시한다.

**1단계 (현재):** 외부 지도 API 없이 GPS 좌표 기준 **자체 캔버스/SVG 경로 렌더링**

| 항목 | 설명 |
|------|------|
| 좌표계 | 위도(`lat`)·경도(`lng`) |
| 경로 | 시간순 GPS 포인트를 선으로 연결 |
| 현재 위치 | 최신 GPS 포인트에 차량 아이콘·방향 표시 |
| 뷰포트 | 모든 포인트가 보이도록 자동 스케일·센터링 |
| 배경 | 목업과 유사한 어두운 그리드·레이더 스타일 |

**2단계 (향후):** Google Maps, Mapbox 등 지도 API 연동

**표시 정보 (목업 참조):**

- VEHICLE IDENTITY 패널: `ID_KEY`, `LATITUDE`, `LONGITUDE`
- 경로 꼬리(trail): 최근 이동 경로를 쏘카 블루 선으로 표시

### 4.2 속도 그래프

**요구사항:** 속도 데이터를 시간에 따른 라인 차트로 표시한다.

| 항목 | 설명 |
|------|------|
| 데이터 소스 | WebSocket `get_speed` 응답 |
| X축 | 시간 (`timestamp`) |
| Y축 | 속도 (m/s, 백엔드 계산값) |
| 표시 | 현재 속도 수치 + 스파크라인/라인 그래프 |
| 색상 | 쏘카 블루 (`#0078FF` 계열) |
| 라벨 | `VELOCITY PROFILE` (목업 참조) |

단위 변환(예: km/h)은 UI 레이어에서 처리한다.  
`1 m/s ≈ 3.6 km/h`

### 4.3 가속도 그래프

**요구사항:** 가속도 데이터를 시간에 따른 라인 차트로 표시한다.

| 항목 | 설명 |
|------|------|
| 데이터 소스 | HTTP `/ram` 또는 향후 `get_acceleration` |
| X축 | 시간 (`timestamp`) |
| Y축 | 가속도 (m/s²) |
| 표시 | 현재 가속도 수치 + 스파크라인/라인 그래프 |
| 색상 | 오렌지/앰ber (`#ff8800` 계열) |
| 라벨 | `ACCEL_VECTOR` (목업 참조) |

`null` 값은 그래프에서 건너뛴다.

---

## 5. UI 레이아웃

목업([`dashboard-mockup.png`](./design/dashboard-mockup.png)) 기준 레이아웃:

```
┌─────────────────────────────────────────────────────────────┐
│  VIGILANT_OS_v1.0    TELEMETRY | DIAGNOSTICS | MISSION      │
├────┬──────────────────────────┬───────────────────────────────┤
│    │  Latency / Driving Mode │  VEHICLE IDENTITY            │
│ S  │  VELOCITY PROFILE       │  (ID, LAT, LNG, SAT)         │
│ i  │  [속도 그래프]           │                               │
│ d  │  ACCEL_VECTOR           │     GPS 경로 뷰               │
│ e  │  [가속도 그래프]         │     (캔버스/SVG)              │
│ b  │  System Log Stream      │                               │
│ a  │                          │  Signal / Kalman Filter     │
│ r  │                          │                               │
└────┴──────────────────────────┴───────────────────────────────┘
```

### 5.1 필수 구현 영역

| 영역 | 우선순위 | 설명 |
|------|----------|------|
| GPS 획득·전송 | P0 | 2 |
| GPS 경로 뷰 | P0 | 4.1 |
| 속도 그래프 | P0 | 4.2 |
| 가속도 그래프 | P0 | 4.3 |
| 식별자 입력/저장 | P0 | 1 |
| WebSocket 연결 | P0 | 3 |

### 5.2 선택 구현 영역 (목업 참조, 후순위)

| 영역 | 설명 |
|------|------|
| 상단 탭 (TELEMETRY / DIAGNOSTICS / MISSION) | TELEMETRY만 우선 구현 |
| Latency / Driving Mode 위젯 | WebSocket RTT 등으로 확장 가능 |
| System Log Stream | 수신 이벤트 로그 표시 |
| EMERGENCY STOP | 향후 기능 |
| KALMAN_FILTER 토글 | 향후 기능 |

---

## 6. 디자인 가이드

참조 이미지: [`docs/design/dashboard-mockup.png`](./design/dashboard-mockup.png)

| 요소 | 값 |
|------|-----|
| 배경 | `#0a0a0a` ~ `#1a1a1a` |
| 주 액센트 (속도·경로) | `#0078FF` (쏘카 블루, blue-6) |
| 보조 액센트 (가속도) | `#ff8800` (오렌지) |
| 텍스트 | `#ffffff`, `#aaaaaa` |
| 경고/긴급 | `#ff3333` |
| 폰트 | 모노스페이스 (JetBrains Mono, Fira Code 등) |
| 테두리 | 얇은 `#333` 보더, 약간의 border-radius |
| 글로우 | 데이터 라인에 subtle box-shadow / filter glow |

---

## 7. 페이지·컴포넌트 구조 (권장)

```
src/
├── config.ts              # BACKEND_* 상수
├── lib/
│   ├── cookies.ts         # 식별자 Cookie read/write/validate
│   ├── identifier.ts      # 랜덤 식별자 생성
│   ├── geolocation.ts     # Geolocation API 래퍼
│   └── websocket.ts       # WebSocket 클라이언트
├── pages/
│   ├── IdentifierPage.tsx # 1. 식별자 입력
│   └── DashboardPage.tsx  # 2·3·4. GPS 전송 + 텔레메트리 대시보드
└── components/
    ├── GpsPathView.tsx    # 4.1 GPS 경로
    ├── VelocityChart.tsx  # 4.2 속도 그래프
    └── AccelChart.tsx     # 4.3 가속도 그래프
```

---

## 8. 데이터 흐름

```
[Cookie: fleet_tracker_id]
        │
        ▼
[대시보드 진입 → Geolocation API로 GPS 획득]
        │
        ▼
[WebSocket connect → ws://HOST:PORT/ws]
        │
        ├─ every 1s store_gps ──▶ 백엔드 RAM 저장 (속도·가속도 계산)
        ├─ poll get_gps  ──▶ GPS 포인트 ──▶ GpsPathView
        ├─ poll get_speed ─▶ 속도 시계열 ─▶ VelocityChart
        └─ poll GET /ram  ──▶ 가속도 시계열 ▶ AccelChart
```

---

## 9. 구현 시 확인 사항

| 항목 | 결정 필요 |
|------|-----------|
| Cookie 만료 기간 | 세션 / 30일 등 |
| GPS 전송 주기 | 1s (2.3) |
| 폴링 주기 | 1s 기본, 성능에 따라 조정 |
| Geolocation 재시도 | 권한 거부 시 수동 재시도 vs 자동 재시도 |
| 그래프 라이브러리 | Chart.js, Recharts, uPlot 등 |
| 프레임워크 | React, Vue 등 (미정) |
| 가속도 조회 방식 | `/ram` HTTP vs 백엔드 `get_acceleration` 추가 |
| GPS 경로 좌표 변환 | lat/lng → 캔버스 좌표 투영 알고리즘 |
| 다중 식별자 | 현재는 Cookie 식별자 1개만 추적 |

---

## 10. 백엔드 API 요약

| 방식 | 엔드포인트 | 용도 |
|------|-----------|------|
| WebSocket | `/ws` | GPS 전송·조회, 속도 조회 |
| HTTP GET | `/ram` | 전체 RAM 데이터 (가속도 포함) |

WebSocket 액션:

| action | 방향 | 설명 |
|--------|------|------|
| `get_gps` | C→S→C | GPS 시계열 조회 |
| `get_speed` | C→S→C | 속도 시계열 조회 |
| `store_gps` | C→S | GPS 저장 (프론트엔드, 1초 간격 전송) |

---

## 11. 테스트 시나리오

1. **최초 접속:** Cookie 없음 → 랜덤 식별자 pre-fill 화면 → 제출 → Cookie 저장 → 대시보드
2. **재접속:** Cookie 있음 → 식별자 화면 생략 → 대시보드
3. **유효하지 않은 식별자:** 특수문자 입력 시 검증 오류
4. **GPS 권한 허용:** 대시보드 진입 → 위치 권한 허용 → `store_gps` 1초 간격 전송 확인
5. **GPS 권한 거부:** 권한 거부 시 오류 UI 표시, 전송 미시작
6. **데이터 없음:** 신규 식별자, 백엔드에 데이터 없을 때 "대기 중" 표시
7. **데이터 수신:** GPS 경로·속도·가속도 그래프 갱신 확인
8. **연결 끊김:** 백엔드 중단 시 재연결 동작 및 GPS 전송 타이머 중지·재개 확인
9. **설정 변경:** `BACKEND_HOST`/`BACKEND_PORT` 변경 시 정상 연결 확인
