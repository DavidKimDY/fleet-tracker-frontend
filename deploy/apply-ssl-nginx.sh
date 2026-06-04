#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:?}"
BACKEND_HOST="${BACKEND_HOST:-3.34.97.233}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
EXTRA_DOMAINS="${EXTRA_DOMAINS:-}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NGINX_SITE="/etc/nginx/conf.d/fleet-tracker.conf"

if [[ $EUID -ne 0 ]]; then
  echo "sudo -E ./deploy/apply-ssl-nginx.sh"
  exit 1
fi

[[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]] || {
  echo "인증서 없음. 먼저 certbot-webroot.sh 실행"
  exit 1
}

EXTRA_SERVER_NAMES=""
if [[ -n "$EXTRA_DOMAINS" ]]; then
  EXTRA_SERVER_NAMES="${EXTRA_DOMAINS//,/ }"
fi

sed -e "s/__DOMAIN__/${DOMAIN}/g" \
    -e "s/__EXTRA_SERVER_NAMES__/${EXTRA_SERVER_NAMES}/g" \
    -e "s/__BACKEND_HOST__/${BACKEND_HOST}/g" \
    -e "s/__BACKEND_PORT__/${BACKEND_PORT}/g" \
    "$REPO_ROOT/deploy/nginx/fleet-tracker.ssl.conf.template" >"$NGINX_SITE"

nginx -t
systemctl reload nginx
echo "https://${DOMAIN} 적용됨"
