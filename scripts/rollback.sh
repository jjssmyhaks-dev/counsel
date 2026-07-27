#!/usr/bin/env bash
# ── MCP Rollback Script ──────────────────────────────────────────
# Usage: bash scripts/rollback.sh [git-ref]
# Default: rolls back to the previous commit.
# This script:
#   1. Saves current state to rollback log
#   2. Git-reset to target ref
#   3. Rebuilds Docker images
#   4. Restarts all MCP services via docker compose
#   5. Validates health checks
# Target: < 5 minutes total
set -euo pipefail

TARGET_REF="${1:-HEAD^}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="rollback-${TIMESTAMP}.log"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== MCP Rollback Started at ${TIMESTAMP} ===" | tee -a "$LOG_FILE"
echo "Target ref: ${TARGET_REF}" | tee -a "$LOG_FILE"

# Step 1: Record current state
echo "[1/6] Recording current state..." | tee -a "$LOG_FILE"
cd "$PROJECT_ROOT"
CURRENT_SHA=$(git rev-parse --short HEAD) || true
echo "  Current: ${CURRENT_SHA}" | tee -a "$LOG_FILE"
echo "  Timestamp: ${TIMESTAMP}" | tee -a "$LOG_FILE"

# Step 2: Stop services
echo "[2/6] Stopping MCP services..." | tee -a "$LOG_FILE"
docker compose -f docker-compose.yml stop || true

# Step 3: Git rollback
echo "[3/6] Rolling back git to ${TARGET_REF}..." | tee -a "$LOG_FILE"
git fetch --all || true
git reset --hard "${TARGET_REF}" 2>&1 | tee -a "$LOG_FILE"
NEW_SHA=$(git rev-parse --short HEAD)
echo "  Rolled back to: ${NEW_SHA}" | tee -a "$LOG_FILE"

# Step 4: Rebuild
echo "[4/6] Rebuilding Docker images..." | tee -a "$LOG_FILE"
docker compose -f docker-compose.yml build --no-cache 2>&1 | tee -a "$LOG_FILE"

# Step 5: Start services
echo "[5/6] Starting services..." | tee -a "$LOG_FILE"
docker compose -f docker-compose.yml up -d 2>&1 | tee -a "$LOG_FILE"

# Step 6: Health validation
echo "[6/6] Verifying health..." | tee -a "$LOG_FILE"
sleep 10

HEALTH_OK=true
for port in 3100 3101 3102 3103; do
  if curl -sf "http://127.0.0.1:${port}/health" > /dev/null 2>&1; then
    echo "  ✅ Port ${port} healthy" | tee -a "$LOG_FILE"
  else
    echo "  ❌ Port ${port} FAILED health check" | tee -a "$LOG_FILE"
    HEALTH_OK=false
  fi
done

if [ "$HEALTH_OK" = true ]; then
  echo "✅ Rollback SUCCESS — all services healthy at ${NEW_SHA}" | tee -a "$LOG_FILE"
else
  echo "❌ Rollback PARTIAL — some services unhealthy. Review: ${LOG_FILE}" | tee -a "$LOG_FILE"
  exit 1
fi

echo "Rollback completed at $(date -u +"%Y-%m-%dT%H:%M:%SZ")" | tee -a "$LOG_FILE"
echo "Log: ${LOG_FILE}"
