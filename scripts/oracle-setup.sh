#!/bin/bash
# ============================================================================
# oracle-setup.sh — Counsel Platform on Oracle Cloud Always Free
# ============================================================================
# Run this ONCE after provisioning an Oracle Ampere A1 VM (4 cores, 24GB RAM)
# OS: Ubuntu 22.04 or 24.04 LTS
#
# Usage:
#   ssh ubuntu@<oracle-vm-ip>
#   curl -O https://raw.githubusercontent.com/jjssmyhaks-dev/counsel/main/scripts/oracle-setup.sh
#   chmod +x oracle-setup.sh
#   sudo ./oracle-setup.sh
# ============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BOLD}[>]${NC} $1"; }

# ── Must be root ──────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  err "Please run as root: sudo ./oracle-setup.sh"
  exit 1
fi

# ── Configuration ─────────────────────────────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/jjssmyhaks-dev/counsel.git}"
APP_DIR="/opt/counsel"
DOMAIN="${DOMAIN:-app.counsel.ai}"
API_DOMAIN="${API_DOMAIN:-api.counsel.ai}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-admin@counsel.ai}"

# Secrets — set these BEFORE running, or the script will prompt
DB_PASSWORD="${DB_PASSWORD:-}"
JWT_SECRET="${JWT_SECRET:-}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-e09989}"
CF_API_TOKEN="${CF_API_TOKEN:-}"

info "=== Counsel Platform — Oracle Cloud Setup ==="
echo "  Domain:      $DOMAIN (web)"
echo "  API Domain:  $API_DOMAIN"
echo "  App Dir:     $APP_DIR"
echo ""

# ── 1. System Updates & Basics ────────────────────────────────────────────
info "Step 1/10: System updates & basic packages"
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl git build-essential nginx certbot python3-certbot-nginx ufw
log "System packages installed"

# ── 2. Node.js 22 ─────────────────────────────────────────────────────────
info "Step 2/10: Node.js 22"
if ! command -v node &> /dev/null || ! node --version | grep -q "v22"; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
log "Node.js $(node --version) | npm $(npm --version)"

# ── 3. Python 3.12 + venv ─────────────────────────────────────────────────
info "Step 3/10: Python 3.12"
if ! command -v python3.12 &> /dev/null; then
  add-apt-repository -y ppa:deadsnakes/ppa
  apt-get install -y -qq python3.12 python3.12-venv python3-pip
fi
log "Python $(python3.12 --version)"

# ── 4. PM2 ────────────────────────────────────────────────────────────────
info "Step 4/10: PM2 process manager"
npm install -g pm2 --silent
log "PM2 $(pm2 --version)"

# ── 5. PostgreSQL 17 ──────────────────────────────────────────────────────
info "Step 5/10: PostgreSQL 17"
if ! command -v psql &> /dev/null; then
  sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  curl -fsSL https://www.postgresql.org/media/keys/AC*******.asc | gpg --dearmor > /etc/apt/trusted.gpg.d/postgresql.gpg
  apt-get update -qq
  apt-get install -y -qq postgresql-17 postgresql-contrib-17
fi

# Generate random DB password if not set
if [ -z "$DB_PASSWORD" ]; then
  DB_PASSWORD=$(openssl rand -base64 32)
  warn "Generated random DB password. Save this: $DB_PASSWORD"
fi

# Create DB and user
sudo -u postgres psql -c "CREATE USER counsel WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE counsel OWNER counsel;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE counsel TO counsel;" 2>/dev/null || true
log "PostgreSQL ready — DB: counsel, User: counsel"

# Generate random JWT secret if not set
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -base64 48)
  warn "Generated random JWT secret. Save this in a password manager."
fi

# ── 6. Clone Repository ───────────────────────────────────────────────────
info "Step 6/10: Clone counsel-platform"
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR" && git pull origin main
  log "Repository updated"
else
  git clone "$REPO_URL" "$APP_DIR"
  log "Repository cloned"
fi

# ── 7. Install Dependencies ───────────────────────────────────────────────
info "Step 7/10: Install Node & Python dependencies"
cd "$APP_DIR"

# Node
npm ci --legacy-peer-deps --silent 2>&1 | tail -1
log "Node dependencies installed"

# Python virtualenv
python3.12 -m venv /opt/counsel-venv
source /opt/counsel-venv/bin/activate
pip install -r services/ai/requirements.txt --quiet 2>&1 | tail -1
log "Python dependencies installed"

# ── 8. Generate Prisma Client & Run Migrations ────────────────────────────
info "Step 8/10: Database setup"
DATABASE_URL="postgresql://counsel:${DB_PASSWORD}@localhost:5432/counsel"
cd "$APP_DIR/packages/database"
npx prisma generate --silent 2>&1 | tail -1
DATABASE_URL="$DATABASE_URL" npx prisma db push --accept-data-loss 2>&1 | tail -1
log "Prisma schema pushed"

# Seed
node "$APP_DIR/scripts/seed.cjs" 2>&1 | tail -3 || warn "Seed had warnings (may be idempotent)"

# ── 9. Create Environment Files ───────────────────────────────────────────
info "Step 9/10: Environment configuration"

# API .env
cat > "$APP_DIR/apps/api/.env" << APENV
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://counsel:${DB_PASSWORD}@localhost:5432/counsel
JWT_SECRET=${JWT_SECRET}
CORS_ORIGIN=https://${DOMAIN}
APENV

# AI .env  
cat > "$APP_DIR/services/ai/.env" << AIENV
CF_ACCOUNT_ID=${CF_ACCOUNT_ID}
CF_API_TOKEN=${CF_API_TOKEN}
AIENV

# Web .env
cat > "$APP_DIR/apps/web/.env.production" << WEBENV
NEXT_PUBLIC_API_URL=https://${API_DOMAIN}/api/v1
NEXT_PUBLIC_SITE_URL=https://${DOMAIN}
NEXT_PUBLIC_ENABLE_AI=true
WEBENV

# Build frontend
cd "$APP_DIR/apps/web"
npx next build 2>&1 | tail -3
log "Frontend built"

# ── 10. Start Services with PM2 ───────────────────────────────────────────
info "Step 10/10: Start all services"
cd "$APP_DIR"

# Create logs directory
mkdir -p "$APP_DIR/logs"

# Create PM2 ecosystem with current env vars
export DATABASE_URL="postgresql://counsel:${DB_PASSWORD}@localhost:5432/counsel"
export JWT_SECRET="$JWT_SECRET"
export CORS_ORIGIN="https://${DOMAIN}"
export PYTHONPATH="$APP_DIR/services/ai"

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>&1 | tail -1
log "PM2 started — 20 processes (API, AI, Web, 17 MCP)"

# ── 11. Nginx Reverse Proxy ───────────────────────────────────────────────
info "Setting up Nginx reverse proxy"

cat > "/etc/nginx/sites-available/${API_DOMAIN}" << NGINX
# API backend
server {
    listen 80;
    server_name ${API_DOMAIN};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
    }
}
NGINX

cat > "/etc/nginx/sites-available/${DOMAIN}" << NGINX2
# Web frontend
server {
    listen 80;
    server_name ${DOMAIN};

    root ${APP_DIR}/apps/web/.next;
    index index.html;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX2

ln -sf "/etc/nginx/sites-available/${API_DOMAIN}" /etc/nginx/sites-enabled/
ln -sf "/etc/nginx/sites-available/${DOMAIN}" /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
log "Nginx configured"

# ── 12. SSL via Let's Encrypt ─────────────────────────────────────────────
info "Requesting SSL certificates"
certbot --nginx -d "${API_DOMAIN}" -d "${DOMAIN}" --non-interactive --agree-tos -m "${LETSENCRYPT_EMAIL}" 2>&1 | tail -3 || warn "SSL: run manually later (DNS may not be propagated)"
log "SSL requested (verify DNS resolves first)"

# ── 13. Firewall ──────────────────────────────────────────────────────────
info "Configuring firewall"
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3001/tcp  # API (until Cloudflare Tunnel is set up)
ufw --force enable
log "Firewall active"

# ── 14. Health Check ──────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo -e "${GREEN}${BOLD}  Counsel Platform Setup Complete!${NC}"
echo "=============================================="
echo ""
echo "Services:"
echo "  Web:        https://${DOMAIN}"
echo "  API:        https://${API_DOMAIN}/api/health"
echo "  AI:         http://localhost:8000/health"
echo ""
echo "Management:"
echo "  pm2 status              — View all processes"
echo "  pm2 logs                — Tail all logs"
echo "  pm2 restart all         — Restart everything"
echo "  pm2 stop all            — Stop everything"
echo ""
echo "Database:"
echo "  sudo -u postgres psql -d counsel"
echo ""
echo -e "${YELLOW}CREDENTIALS (save these!):${NC}"
echo "  DB Password:  ${DB_PASSWORD}"
echo "  JWT Secret:   ${JWT_SECRET}"
echo ""
echo -e "${YELLOW}IMPORTANT: Wait 5 min for DNS to propagate, then run:${NC}"
echo "  sudo certbot --nginx -d ${API_DOMAIN} -d ${DOMAIN}"
echo ""
echo "=============================================="

# Wait 5 seconds then show PM2 status
sleep 3
pm2 status
