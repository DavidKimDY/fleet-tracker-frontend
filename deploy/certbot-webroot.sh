#!/usr/bin/env bash
# 인증서만 다시 발급 (nginx는 webroot로 검증, --nginx 플러그인 미사용)
set -euo pipefail

DOMAIN="${DOMAIN:?예: export DOMAIN=penutjam.com}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:?예: export CERTBOT_EMAIL=you@example.com}"
EXTRA_DOMAINS="${EXTRA_DOMAINS:-}" # 예: www.penutjam.com

if [[ $EUID -ne 0 ]]; then
  echo "sudo -E ./deploy/certbot-webroot.sh"
  exit 1
fi

mkdir -p /var/www/html/.well-known/acme-challenge
chown -R nginx:nginx /var/www/html 2>/dev/null || chown -R www-data:www-data /var/www/html 2>/dev/null || true

CERT_ARGS=(-d "$DOMAIN")
if [[ -n "$EXTRA_DOMAINS" ]]; then
  IFS=',' read -ra EXTRA <<<"$EXTRA_DOMAINS"
  for d in "${EXTRA[@]}"; do
    CERT_ARGS+=(-d "$d")
  done
fi

certbot certonly --webroot \
  -w /var/www/html \
  "${CERT_ARGS[@]}" \
  --non-interactive \
  --agree-tos \
  -m "$CERTBOT_EMAIL" \
  --preferred-challenges http

echo "발급 완료. SSL nginx 적용: sudo -E ./deploy/apply-ssl-nginx.sh"
