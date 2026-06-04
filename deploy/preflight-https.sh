#!/usr/bin/env bash
# Certbot 전 DNS·80번·ACME 경로 점검
set -euo pipefail

DOMAIN="${DOMAIN:?}"

public_ip() {
  curl -fsS --max-time 3 https://checkip.amazonaws.com 2>/dev/null \
    || curl -fsS --max-time 3 https://ifconfig.me 2>/dev/null \
    || true
}

echo "=== 1) 이 EC2 퍼블릭 IP ==="
MY_IP="$(public_ip)"
echo "${MY_IP:-(조회 실패 — EC2 콘솔에서 퍼블릭 IP 확인)}"

echo ""
echo "=== 2) DNS A 레코드 (penutjam.com 이 IP와 같아야 함) ==="
if command -v dig >/dev/null 2>&1; then
  dig +short A "$DOMAIN" || true
  dig +short A "www.$DOMAIN" || true
else
  getent hosts "$DOMAIN" || true
fi

echo ""
echo "=== 3) 로컬 nginx / 80 포트 ==="
systemctl is-active nginx 2>/dev/null || echo "nginx 미실행"
ss -tlnp | grep ':80 ' || echo "80 포트 리스닝 없음"

echo ""
echo "=== 4) ACME 테스트 파일 (외부에서 200 이어야 함) ==="
mkdir -p /var/www/html/.well-known/acme-challenge
echo preflight-ok | tee /var/www/html/.well-known/acme-challenge/preflight-test >/dev/null
echo "외부 PC 또는 https://www.yougetsignal.com/tools/open-ports/ 로 확인:"
echo "  curl -v http://${DOMAIN}/.well-known/acme-challenge/preflight-test"
echo "기대 응답 본문: preflight-ok"

echo ""
echo "=== 5) 기본 nginx 사이트 충돌 (있으면 비활성화 권장) ==="
for f in /etc/nginx/conf.d/default.conf /etc/nginx/sites-enabled/default; do
  [[ -f $f ]] && echo "  존재: $f  →  sudo mv $f ${f}.disabled && sudo nginx -t && sudo systemctl reload nginx"
done

echo ""
echo "=== 6) AWS Security Group ==="
echo "  인바운드 TCP 80, 443 이 EC2에 열려 있는지 확인"
