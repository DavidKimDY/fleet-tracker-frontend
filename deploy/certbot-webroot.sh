#!/usr/bin/env bash
# 인증서만 다시 발급 (webroot + ACME 전용 nginx)
set -euo pipefail

DOMAIN="${DOMAIN:?예: export DOMAIN=www.penutjam.com}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:?예: export CERTBOT_EMAIL=you@example.com}"
EXTRA_DOMAINS="${EXTRA_DOMAINS:-}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=lib/deploy-common.sh
source "$REPO_ROOT/deploy/lib/deploy-common.sh"

if [[ $EUID -ne 0 ]]; then
  echo "sudo -E ./deploy/certbot-webroot.sh"
  exit 1
fi

deploy_disable_default_nginx_site

if ! deploy_assert_dns_points_here "$DOMAIN"; then
  exit 1
fi

echo "==> ACME 전용 nginx (bootstrap)"
deploy_apply_acme_bootstrap_nginx "$DOMAIN" "$EXTRA_DOMAINS" "$REPO_ROOT"

chown -R nginx:nginx /var/www/html 2>/dev/null || chown -R www-data:www-data /var/www/html 2>/dev/null || true

echo "==> ACME URL 사전 테스트"
if ! deploy_test_acme_url "$DOMAIN"; then
  echo ""
  echo "위 테스트가 실패하면 certbot도 실패합니다. DNS/SG/nginx를 먼저 고치세요."
  exit 1
fi

CERT_ARGS=(-d "$DOMAIN")
if [[ -n "$EXTRA_DOMAINS" ]]; then
  IFS=',' read -ra EXTRA <<<"$EXTRA_DOMAINS"
  for d in "${EXTRA[@]}"; do
    deploy_assert_dns_points_here "$d" || exit 1
    CERT_ARGS+=(-d "$d")
  done
fi

echo "==> certbot"
certbot certonly --webroot \
  -w /var/www/html \
  "${CERT_ARGS[@]}" \
  --non-interactive \
  --agree-tos \
  -m "$CERTBOT_EMAIL" \
  --preferred-challenges http

echo ""
echo "발급 완료. 전체 사이트 nginx 적용:"
echo "  sudo -E ./deploy/apply-ssl-nginx.sh"
