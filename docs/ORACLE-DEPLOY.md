# Oracle Cloud Always Free — Deployment Guide

## 1. Provision the VM

1. Go to [cloud.oracle.com](https://cloud.oracle.com) → Sign up (credit card required for verification, NOT charged)
2. Navigate to **Compute → Instances → Create Instance**
3. Configure:

| Setting | Value |
|---------|-------|
| Name | `counsel-prod` |
| Placement | Any AD |
| Image | **Ubuntu 22.04 LTS** (or 24.04) |
| Shape | **Ampere A1** — 4 OCPU, 24 GB RAM |
| Boot volume | 200 GB (max free) |
| SSH key | Upload your public key (`~/.ssh/id_rsa.pub`) |
| Network | Default VCN, assign public IP |

4. Click **Create** — takes ~2 min

## 2. Open Ports in Oracle Security List

Oracle's firewall blocks everything by default. Go to **Networking → Virtual Cloud Networks → [your VCN] → Security Lists → Default Security List → Add Ingress Rules**:

| Source | Port | Protocol | Description |
|--------|------|----------|-------------|
| 0.0.0.0/0 | 22 | TCP | SSH |
| 0.0.0.0/0 | 80 | TCP | HTTP |
| 0.0.0.0/0 | 443 | TCP | HTTPS |
| 0.0.0.0/0 | 3001 | TCP | API (temp, until tunnel) |

**Also:** On the VM itself, run `sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT` if ports are still blocked (Oracle has a second firewall inside the VM image).

## 3. Set DNS (Cloudflare or your registrar)

Create two A records pointing to your Oracle VM's public IP:

```
app.counsel.ai    → <VM public IP>
api.counsel.ai    → <VM public IP>
```

Wait 5-10 minutes for DNS propagation.

## 4. SSH & Run Setup

```bash
# Copy your SSH key to the VM (if not done at creation)
ssh-copy-id ubuntu@<VM_PUBLIC_IP>

# SSH in
ssh ubuntu@<VM_PUBLIC_IP>

# Set required env vars before running
export DOMAIN="app.counsel.ai"
export API_DOMAIN="api.counsel.ai"
export LETSENCRYPT_EMAIL="your-email@counsel.ai"
export CF_ACCOUNT_ID="e09989"
export CF_API_TOKEN="your-cloudflare-api-token"

# Download and run setup
curl -O https://raw.githubusercontent.com/jjssmyhaks-dev/counsel/main/scripts/oracle-setup.sh
chmod +x oracle-setup.sh
sudo -E ./oracle-setup.sh
```

The script will:
- Install Node 22, Python 3.12, PostgreSQL 17, Nginx
- Clone the repo
- Install all dependencies
- Set up the database (Prisma push + seed)
- Start all 20 services via PM2
- Configure Nginx reverse proxy
- Request SSL certificates from Let's Encrypt
- Enable firewall

## 5. Verify

```bash
# Check PM2
pm2 status

# Health checks
curl https://api.counsel.ai/api/health
curl https://api.counsel.ai/api/v1/public/stats
curl https://app.counsel.ai

# View logs
pm2 logs --lines 20
```

## 6. Monitoring

```bash
pm2 status          # Process list
pm2 monit           # Real-time CPU/Memory
pm2 logs            # All logs
pm2 logs counsel-api --lines 50
htop                # System resource usage
df -h               # Disk usage
```

## 7. Pushing Updates

```bash
ssh ubuntu@<VM_PUBLIC_IP>
cd /opt/counsel
git pull origin main
npm ci --legacy-peer-deps
cd apps/web && npx next build && cd ../..
pm2 restart all
```

---

## Oracle Free Tier Limits

| Resource | Free Limit | Our Usage | Fit? |
|----------|-----------|-----------|------|
| Compute (Ampere) | 4 OCPU, 24 GB | 4 OCPU, 24 GB | ✅ |
| Block Storage | 200 GB | ~30 GB | ✅ |
| Bandwidth | 10 TB/mo outbound | ~100 GB | ✅ |
| Arm instances | Up to 4 | 1 | ✅ |
| **Cost** | **$0/mo forever** | | ✅ |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 80/443 blocked | Oracle has TWO firewalls — check both Security List AND `iptables` on VM |
| SSL cert fails | DNS must propagate first. Wait 10 min, run `sudo certbot --nginx` manually |
| Prisma can't connect | Check `DATABASE_URL` in `/opt/counsel/apps/api/.env` |
| AI service fails | Check `pip install -r requirements.txt` — some packages need `build-essential` |
| PM2 won't start on reboot | Run `pm2 startup` again, copy-paste the command it outputs |
