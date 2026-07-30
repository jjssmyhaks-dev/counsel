#!/bin/bash
# ============================================================================
# oracle-setup-tunnel.sh — Add Cloudflare Tunnel to Oracle VM
# ============================================================================
# Run AFTER oracle-setup.sh, on the existing Oracle VM
# This replaces direct port exposure with a secure Cloudflare tunnel.
#
# Prerequisites:
#   - Cloudflare account with your domain (counsel.ai) added
#   - counsel-prod-tunnel already created in Cloudflare Zero Trust dashboard
#
# Usage:
#   ssh ubuntu@<oracle-vm-ip>
#   sudo ./oracle-setup-tunnel.sh
# ============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

[ "$EUID" -ne 0 ] && { echo "Run as root"; exit 1; }

APP_DIR="/opt/counsel"

# ── 1. Install cloudflared ────────────────────────────────────────────────
log "Installing cloudflared..."
curl -fsSL https://pkg.cloudflare.com/cloudflared-apt-key.gpg | gpg --dearmor > /usr/share/keyrings/cloudflare-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" > /etc/apt/sources.list.d/cloudflared.list
apt-get update -qq && apt-get install -y -qq cloudflared
log "cloudflared $(cloudflared --version)"

# ── 2. Copy tunnel config ─────────────────────────────────────────────────
log "Deploying tunnel config..."
mkdir -p /root/.cloudflared
cp "$APP_DIR/config/cloudflare-tunnel.yml" /root/.cloudflared/config.yml

# ── 3. Create tunnel (one-time, in Cloudflare Zero Trust) ─────────────────
log "Creating tunnel (this requires Cloudflare login one time)..."
echo ""
echo "The tunnel token is available in:"
echo "  Cloudflare Dashboard → Zero Trust → Networks → Tunnels → counsel-prod-tunnel"
echo ""
read -p "Paste the tunnel token (from Cloudflare Dashboard): " TUNNEL_TOKEN

# Install tunnel as a systemd service
cloudflared service token "$TUNNEL_TOKEN"
log "Tunnel service installed"

# ── 4. Start the tunnel ───────────────────────────────────────────────────
systemctl enable cloudflared
systemctl start cloudflared
log "Tunnel running"

# ── 5. Close direct API port (secure the VM) ──────────────────────────────
log "Closing direct API port 3001..."
ufw delete allow 3001/tcp 2>/dev/null || true
log "Port 3001 now only accessible via Cloudflare Tunnel"

# ── 6. Update DNS in Cloudflare ───────────────────────────────────────────
log "Setting up DNS..."
echo ""
echo "=== MANUAL STEP ==="
echo "In Cloudflare DNS, create CNAME records pointing to the tunnel:"
echo ""
echo "  api.counsel.ai   CNAME  counsel-prod-tunnel.cfargotunnel.com  (Proxied ☁️)"
echo "  app.counsel.ai   CNAME  counsel-prod-tunnel.cfargotunnel.com  (Proxied ☁️)"
echo "  ai.counsel.ai    CNAME  counsel-prod-tunnel.cfargotunnel.com  (Proxied ☁️)"
echo ""
echo "OR — if you're NOT using Cloudflare Pages for the frontend, you can keep:"
echo "  app.counsel.ai   A  <Oracle VM public IP>"
echo ""

# ── 7. Verification ───────────────────────────────────────────────────────
echo "=== Verification ==="
sleep 3
systemctl status cloudflared --no-pager | head -n 10

echo ""
echo -e "${GREEN}Done! After DNS propagates (5-10 min):${NC}"
echo "  curl https://api.counsel.ai/api/health"
echo ""
echo "No open ports on the VM except SSH (22) and HTTP (80/443 for nginx)."
echo "All API traffic now flows through Cloudflare's secure tunnel."
