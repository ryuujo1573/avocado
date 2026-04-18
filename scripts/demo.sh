#!/usr/bin/env bash
# demo — seeds the database and prints the agent CLI command.
# Requires: docker compose up -d (backend + postgres + coturn)
set -euo pipefail

BACKEND_URL="${AVOCADO_SERVER:-http://localhost:3000}"
SEED_EMAIL="${SEED_USER_EMAIL:-operator@avocado.local}"
SEED_PASSWORD="${SEED_USER_PASSWORD:-avocado-dev-2026}"
SEED_TOKEN="${SEED_ENROLLMENT_TOKEN:-enroll-dev-token-1}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Avocado MVP Demo Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Wait for backend to be ready
echo "⏳ Waiting for backend at $BACKEND_URL..."
for i in $(seq 1 30); do
  if curl -sf "$BACKEND_URL/healthz" >/dev/null 2>&1; then
    echo "✅ Backend is ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ Backend did not start in 30s. Run: docker compose up -d"
    exit 1
  fi
  sleep 1
done

# Run seed (idempotent)
echo
echo "🌱 Seeding database..."
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
DATABASE_URL="${DATABASE_URL:-postgresql://avocado:avocado@localhost:5432/avocado}" \
  bun run packages/core/src/prisma/seed.ts

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Dashboard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  URL:      http://localhost:5173"
echo "  Email:    $SEED_EMAIL"
echo "  Password: $SEED_PASSWORD"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Agent CLI (run on a second machine)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  bun projects/agent/src/main.ts --server $BACKEND_URL --enroll $SEED_TOKEN"
echo "  bun projects/agent/src/main.ts --server $BACKEND_URL"
echo
