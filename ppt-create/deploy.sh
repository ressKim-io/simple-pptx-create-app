#!/usr/bin/env bash
# ============================================================
#  슬라이드 생성기 → S3 + Cloudflare 배포
#  index.html 은 라이브러리까지 내장된 단일 파일이라, 배포 대상은
#  index.html + presets.json 두 개뿐입니다.
#  DNS·CDN·SSL은 Cloudflare가 담당 (S3는 퍼블릭 정적 웹사이트 호스팅)
# ============================================================
set -euo pipefail

# ── 여기만 수정 ─────────────────────────────────────────────
BUCKET="ganpyeon-click-web"            # S3 버킷 이름
CF_ZONE_ID="YOUR_CLOUDFLARE_ZONE_ID"   # Cloudflare 대시보드 > 개요 우측 하단 Zone ID
DOMAIN="ganpyeon.click"
# CF_API_TOKEN은 여기 적지 말고 환경변수로 주입하세요:
#   export CF_API_TOKEN="발급받은 토큰"
# ───────────────────────────────────────────────────────────

: "${CF_API_TOKEN:?CF_API_TOKEN 환경변수를 설정하세요 (export CF_API_TOKEN=...)}"

aws s3 cp index.html "s3://${BUCKET}/index.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=60"

aws s3 cp presets.json "s3://${BUCKET}/presets.json" \
  --content-type "application/json; charset=utf-8" \
  --cache-control "public, max-age=60"

# Cloudflare 엣지 캐시 퍼지 (이게 없으면 구버전이 계속 보임)
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"files\":[\"https://${DOMAIN}/index.html\",\"https://${DOMAIN}/presets.json\"]}"

echo ""
echo "✓ 배포 완료. 캐시 반영까지 보통 수십 초 걸립니다."

# ============================================================
#  [최초 1회 세팅 체크리스트] — 처음 배포 전 한 번만
#  1) Cloudflare에 사이트(ganpyeon.click) 추가 → 안내받은 네임서버 2개를
#     Route53 Domains의 ganpyeon.click 네임서버로 변경
#  2) Cloudflare DNS에 레코드 추가 (Proxied 🟠 켜기):
#     타입 CNAME, 이름 @, 대상 ganpyeon-click-web.s3-website.ap-northeast-2.amazonaws.com
#  3) Cloudflare SSL/TLS 모드: Flexible 로 설정
#     (S3 정적 웹사이트 엔드포인트는 HTTPS를 지원하지 않아서 Full 모드는 안 됨)
#     + "Always Use HTTPS" 켜기
#  4) Cloudflare API 토큰 발급: 내 프로필 > API 토큰 > "Zone.Cache Purge" 권한만 있는 토큰 생성
#     export CF_API_TOKEN="발급받은토큰"  (쉘 프로필(.zshrc 등)에 저장, 절대 이 파일에 넣지 말 것)
#  5) 버킷 버저닝은 이미 켜져 있음 (롤백 안전망)
#  롤백: S3 콘솔에서 index.html 이전 버전 '복원' → 이 스크립트로 캐시 퍼지
# ============================================================
