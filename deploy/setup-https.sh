#!/usr/bin/env bash
# EC2 단독 배포: nginx + Let's Encrypt (webroot, --nginx 플러그인 미사용)
set -euo pipefail

DOMAIN="${DOMAIN:?DOMAIN 환경 변수를 설정하세요 (예: www.penutjam.com)}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:?CERTBOT_EMAIL 환경 변수를 설정하세요}"
BACKEND_HOST="${BACKEND_HOST:-3.34.97.233}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
EXTRA_DOMAINS="${EXTRA_DOMAINS:-}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="/var/www/fleet-tracker"
NGINX_SITE="/etc/nginx/conf.d/fleet-tracker.conf"

if [[ $EUID -ne 0 ]]; then
  echo "sudo로 실행하세요: sudo -E ./deploy/setup-https.sh"
  exit 1
fi

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y nginx certbot curl
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx certbot curl
  else
    echo "지원 OS: Ubuntu/Debian(apt) 또는 Amazon Linux(dnf)"
    exit 1
  fi
}

disable_default_nginx_site() {
  for f in /etc/nginx/conf.d/default.conf /etc/nginx/sites-enabled/default; do
    if [[ -f $f ]]; then
      mv "$f" "${f}.disabled.$(date +%s)"
      echo "비활성화: $f"
    fi
  done
}

install_packages
disable_default_nginx_site

echo "==> 사전 점검 (DNS·ACME)"
bash "$REPO_ROOT/deploy/preflight-https.sh" || true
echo ""
if [[ "${SKIP_PROMPT:-}" != "1" ]]; then
  read -r -p "DNS가 이 EC2 IP를 가리키고 SG 80/443이 열려 있나요? [y/N] " ok
  [[ "${ok,,}" == "y" ]] || { echo "DNS/SG 정리 후 다시 실행하세요."; exit 1; }
fi

echo "==> 프론트엔드 빌드"
cd "$REPO_ROOT"
if command -v npm >/dev/null 2>&1; then
  npm ci 2>/dev/null || npm install
  npm run build
else
  [[ -d dist ]] || { echo "dist/ 없음"; exit 1; }
fi

mkdir -p "$WEB_ROOT" /var/www/html/.well-known/acme-challenge
rm -rf "${WEB_ROOT:?}"/*
cp -a "$REPO_ROOT/dist/." "$WEB_ROOT/"
chown -R nginx:nginx /var/www/html "$WEB_ROOT" 2>/dev/null \
  || chown -R www-data:www-data /var/www/html "$WEB_ROOT" 2>/dev/null || true

echo "==> nginx HTTP (인증서 발급 전)"
sed -e "s/__DOMAIN__/${DOMAIN}/g" \
    -e "s/__BACKEND_HOST__/${BACKEND_HOST}/g" \
    -e "s/__BACKEND_PORT__/${BACKEND_PORT}/g" \
    "$REPO_ROOT/deploy/nginx/fleet-tracker.conf.template" >"$NGINX_SITE"

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "==> ACME 로컬 확인"
echo preflight-ok >/var/www/html/.well-known/acme-challenge/local-test
if ! curl -fsS "http://127.0.0.1/.well-known/acme-challenge/local-test" -H "Host: ${DOMAIN}" | grep -q preflight-ok; then
  echo "경고: 로컬 ACME 경로 실패. nginx server_name / default site 확인"
fi

echo "==> Let's Encrypt (webroot)"
export DOMAIN CERTBOT_EMAIL EXTRA_DOMAINS
bash "$REPO_ROOT/deploy/certbot-webroot.sh"

echo "==> nginx HTTPS 적용"
bash "$REPO_ROOT/deploy/apply-ssl-nginx.sh"

echo ""
echo "완료: https://${DOMAIN}"
echo "실패 시: sudo -E ./deploy/preflight-https.sh"
