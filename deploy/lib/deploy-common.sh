#!/usr/bin/env bash
# shellcheck disable=SC2034
deploy_public_ip() {
  curl -fsS --max-time 5 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' \
    || curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null | tr -d '[:space:]' \
    || true
}

deploy_dns_a() {
  local domain=$1
  if command -v dig >/dev/null 2>&1; then
    dig +short A "$domain" | head -1 | tr -d '[:space:]'
  else
    getent ahostsv4 "$domain" 2>/dev/null | awk '{print $1; exit}'
  fi
}

# DNS A가 이 EC2를 가리키는지 확인. FORCE_DNS=1 이면 건너뜀.
deploy_assert_dns_points_here() {
  local domain=$1
  local my_ip dns_ip
  my_ip="$(deploy_public_ip)"
  dns_ip="$(deploy_dns_a "$domain")"

  echo "EC2 퍼블릭 IP: ${my_ip:-?}"
  echo "${domain} DNS A:    ${dns_ip:-?}"

  if [[ -z "$dns_ip" ]]; then
    echo "ERROR: ${domain} A 레코드를 찾을 수 없습니다."
    return 1
  fi

  if [[ -n "$my_ip" && "$dns_ip" != "$my_ip" ]]; then
    echo ""
    echo "ERROR: DNS가 이 EC2를 가리키지 않습니다."
    echo "  Let's Encrypt는 ${dns_ip} 로 접속합니다 (에러 로그의 IP와 같음)."
    echo "  이 서버(EC2)는 ${my_ip} 입니다."
    echo "  → 도메인 관리 화면에서 ${domain} A 레코드를 ${my_ip} 로 바꾼 뒤 전파를 기다리세요."
    echo "  → URL 포워딩/파킹/Cloudflare 프록시만 켜져 있으면 404가 납니다."
    if [[ "${FORCE_DNS:-}" == "1" ]]; then
      echo "FORCE_DNS=1 → 검사 생략"
      return 0
    fi
    return 1
  fi

  echo "OK: DNS가 이 EC2를 가리킵니다."
  return 0
}

deploy_disable_default_nginx_site() {
  for f in /etc/nginx/conf.d/default.conf /etc/nginx/sites-enabled/default; do
    if [[ -f $f ]]; then
      mv "$f" "${f}.disabled.$(date +%s)"
      echo "비활성화: $f"
    fi
  done
}

deploy_apply_acme_bootstrap_nginx() {
  local domain=$1 extra=${2:-} repo_root=$3
  local nginx_site=/etc/nginx/conf.d/fleet-tracker.conf
  local extra_names="${extra//,/ }"

  sed -e "s/__DOMAIN__/${domain}/g" \
      -e "s/__EXTRA_SERVER_NAMES__/${extra_names}/g" \
      "$repo_root/deploy/nginx/acme-bootstrap.conf.template" >"$nginx_site"

  nginx -t
  systemctl reload nginx
}

deploy_test_acme_url() {
  local domain=$1
  local token=${2:-preflight-test}
  local body=${3:-preflight-ok}

  mkdir -p /var/www/html/.well-known/acme-challenge
  echo "$body" >"/var/www/html/.well-known/acme-challenge/${token}"

  echo "로컬 (Host 헤더):"
  curl -fsS "http://127.0.0.1/.well-known/acme-challenge/${token}" -H "Host: ${domain}" || true
  echo ""
  echo "공인 DNS 경로 (반드시 ${body} 출력):"
  curl -fsS "http://${domain}/.well-known/acme-challenge/${token}" || {
    echo "FAIL: http://${domain}/.well-known/acme-challenge/${token}"
    return 1
  }
}
