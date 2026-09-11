#!/usr/bin/env bash
# Kouřový test po deployi. Nenulový návratový kód spustí rollback.
set -euo pipefail

BASE="${BASE_URL:-https://vevit.fun}"
RT="${RT_URL:-https://rt.vevit.fun}"
fail=0

check() {
  local name="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" || echo 000)
  if [[ "$code" != "$expect" ]]; then
    echo "FAIL  $name  ($url → $code, čekáno $expect)"
    fail=1
  else
    echo "ok    $name"
  fi
}

check "portál"        "$BASE/"            200
check "caddy health"  "$BASE/healthz"     200
check "api health"    "$BASE/api/healthz" 200
check "realtime"      "$RT/healthz"       200
check "katalog her"   "$BASE/api/games"   200

exit "$fail"
