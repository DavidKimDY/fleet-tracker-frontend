# Fleet Tracker Frontend

WebSocket 기반 백엔드와 연동하여 GPS 경로, 속도, 가속도를 실시간으로 시각화하는 대시보드입니다.

명세: [`docs/SPEC.md`](docs/SPEC.md)  
디자인: [`docs/design/dashboard-mockup.png`](docs/design/dashboard-mockup.png)

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 을 엽니다. Geolocation API는 `localhost` 또는 HTTPS에서 동작합니다.

백엔드 주소는 `src/config.ts`에서 설정합니다. 로컬 개발 시 기본 `http://3.34.97.233:8000`, EC2 HTTPS 배포 시 nginx가 `/ram`, `/ws`로 프록시합니다.

**EC2 + 무료 HTTPS (Let's Encrypt):** [`docs/DEPLOY-EC2-HTTPS.md`](docs/DEPLOY-EC2-HTTPS.md) — 프로덕션 `https://www.penutjam.com`

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 미리보기 |
