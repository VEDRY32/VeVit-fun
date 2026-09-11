#!/usr/bin/env bash
# Návrat na poslední známý dobrý tag.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .last-good ]]; then
  echo "Chybí .last-good — nelze automaticky rollbacknout. Zasáhni ručně." >&2
  exit 1
fi

TAG="$(cat .last-good)"
echo "Rollback na tag $TAG"
TAG="$TAG" docker compose pull
TAG="$TAG" docker compose up -d --remove-orphans
TAG="$TAG" docker compose run --rm web
echo "Rollback hotov."
