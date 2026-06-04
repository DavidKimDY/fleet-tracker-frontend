# EC2 HTTPS 배포 (무료, EC2만 사용)

프론트를 **HTTPS**로 제공해 모바일 **Geolocation(GPS)** 을 쓰기 위한 가이드입니다.  
TLS는 **Let's Encrypt**(무료) + **nginx**(EC2 설치)로 처리합니다. ALB·ACM·CloudFront 등 추가 AWS 유료/관리형 서비스는 사용하지 않습니다.

## 필요한 것

| 항목 | 설명 |
|------|------|
| **도메인** | Let's Encrypt는 공인 IP만으로 발급이 어렵습니다. Route 53·가비아 등 아무 곳이나 가능 (도메인 등록비만 별도) |
| **DNS** | `A` 레코드 → 프론트 EC2 **퍼블릭 IP** (Elastic IP 권장) |
| **EC2 SG** | 인바운드 **80**, **443** (전 세계 또는 본인 IP) |
| **백엔드 SG** | `3.34.97.233` EC2에 **8000** 허용 (프론트 EC2 IP에서만 열어도 됨) |

## 동작 방식

```text
브라우저 ──HTTPS──► nginx (EC2:443)
                      ├─ /          → /var/www/fleet-tracker (Vite 빌드)
                      ├─ /ram       → http://3.34.97.233:8000/ram
                      └─ /ws        → ws://3.34.97.233:8000/ws (wss로 종료)
```

HTTPS 페이지에서 HTTP 백엔드를 직접 호출하면 **mixed content**로 차단되므로, nginx가 API·WebSocket을 프록시하고 프론트는 **같은 도메인**(`/ram`, `/ws`)으로 요청합니다.

## 1. EC2 준비

```bash
# Ubuntu 예시
sudo apt update
sudo apt install -y git nodejs npm

git clone https://github.com/DavidKimDY/fleet-tracker-frontend.git
cd fleet-tracker-frontend
```

## 2. DNS

예: `penutjam.com` → 프론트 EC2 퍼블릭 IP

전파 확인:

```bash
dig +short penutjam.com
```

## 3. 한 번에 배포

```bash
cd fleet-tracker-frontend
export DOMAIN=penutjam.com
export CERTBOT_EMAIL=you@example.com
# 선택: 백엔드가 다른 IP/포트면
# export BACKEND_HOST=3.34.97.233
# export BACKEND_PORT=8000

chmod +x deploy/setup-https.sh
sudo -E ./deploy/setup-https.sh
```

브라우저: **https://penutjam.com**

## 4. 코드 갱신 후 재배포

```bash
cd fleet-tracker-frontend
git pull
npm ci && npm run build
sudo cp -a dist/. /var/www/fleet-tracker/
```

nginx 설정은 바꾸지 않아도 됩니다.

## 5. 인증서 갱신

Let's Encrypt는 약 90일마다 갱신합니다. `certbot` 설치 시 보통 **timer/cron**이 함께 설정됩니다.

```bash
sudo certbot renew --dry-run
```

## 6. 비용

| 항목 | 비용 |
|------|------|
| Let's Encrypt | 무료 |
| nginx / certbot on EC2 | 무료 |
| EC2 인스턴스 | AWS 프리 티어/사용량에 따름 (이 가이드 범위 밖) |
| 도메인 | 등록 업체별 유료 (AWS Route 53 도메인 등록만 써도 됨, **EC2 외 서비스는 DNS·도메인뿐**) |

## 로컬 개발

`npm run dev`는 기존처럼 `http://3.34.97.233:8000` 백엔드에 직접 연결합니다.  
프로덕션 빌드(`npm run build`)만 nginx same-origin(`/ram`, `/ws`)을 사용합니다.

환경 변수로 덮어쓰기:

```bash
VITE_BACKEND_HTTP_URL=https://api.example.com npm run build
VITE_BACKEND_WS_URL=wss://api.example.com/ws npm run build
```

## Certbot 실패 시 (`Authority failed to verify`)

Let's Encrypt는 **인터넷에서** `http://penutjam.com/.well-known/acme-challenge/...` 에 접근해 도메인을 확인합니다. 아래를 **프론트 EC2**에서 순서대로 확인하세요.

### 1) 사전 점검 스크립트

```bash
export DOMAIN=penutjam.com
chmod +x deploy/preflight-https.sh deploy/certbot-webroot.sh deploy/apply-ssl-nginx.sh
sudo -E ./deploy/preflight-https.sh
```

### 2) DNS가 이 EC2 IP인지

```bash
curl -s https://checkip.amazonaws.com    # EC2 퍼블릭 IP
dig +short A penutjam.com                # 도메인이 가리키는 IP — 둘이 같아야 함
```

- 다르면 도메인 업체(또는 Route 53)에서 **A 레코드** 수정 후 전파 대기(수분~수십분).
- EC2 재시작 후 IP가 바뀌었으면 Elastic IP를 쓰지 않은 경우 DNS를 다시 맞춥니다.

### 3) Security Group

프론트 EC2 인바운드: **TCP 80**, **TCP 443** (`0.0.0.0/0` 또는 테스트용 본인 IP).

### 4) nginx 기본 사이트 제거

Amazon Linux/Ubuntu 기본 `default` 가 80을 먼저 받으면 ACME가 실패할 수 있습니다.

```bash
sudo mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled 2>/dev/null || true
sudo nginx -t && sudo systemctl reload nginx
```

### 5) ACME 경로 외부 테스트

```bash
echo ok | sudo tee /var/www/html/.well-known/acme-challenge/test
curl -v http://penutjam.com/.well-known/acme-challenge/test
```

본문에 `ok` 가 보여야 합니다. 안 되면 DNS/SG/nginx 문제입니다.

### 6) 인증서만 다시 발급 (webroot, `--nginx` 미사용)

최신 `deploy/` 스크립트 pull 후:

```bash
git pull
export DOMAIN=penutjam.com
export CERTBOT_EMAIL=you@example.com
# www도 쓸 경우 DNS에 www A/CNAME 추가 후:
# export EXTRA_DOMAINS=www.penutjam.com

sudo -E ./deploy/certbot-webroot.sh
sudo -E ./deploy/apply-ssl-nginx.sh
```

로그 상세:

```bash
sudo tail -50 /var/log/letsencrypt/letsencrypt.log
```

## 문제 해결 (기타)

| 증상 | 확인 |
|------|------|
| certbot 실패 | 위 「Certbot 실패 시」 절차 |
| `www` 접속만 사용 | `EXTRA_DOMAINS=www.penutjam.com` + DNS + certbot에 `-d www` |
| GPS 안 됨 | `https://` 로 접속 |
| API 실패 | 백엔드 8000 SG, nginx `location /ram` |
| WebSocket 끊김 | `location /ws` Upgrade 헤더 |
