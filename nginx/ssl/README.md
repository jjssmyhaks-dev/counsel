# ── NGINX SSL Setup Guide ────────────────────────────────────────
#
# For local development self-signed cert:
#   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
#     -keyout nginx/ssl/privkey.pem -out nginx/ssl/fullchain.pem \
#     -subj "/CN=localhost"
#
# For production (Let's Encrypt):
#   sudo certbot certonly --standalone -d counsel.yourdomain.com
#   sudo cp /etc/letsencrypt/live/counsel.yourdomain.com/fullchain.pem nginx/ssl/
#   sudo cp /etc/letsencrypt/live/counsel.yourdomain.com/privkey.pem nginx/ssl/
#   sudo chmod 644 nginx/ssl/fullchain.pem nginx/ssl/privkey.pem
#
# Auto-renewal cron:
#   0 2 * * * certbot renew --quiet --post-hook "cp /etc/letsencrypt/live/counsel.yourdomain.com/fullchain.pem /path/to/nginx/ssl/ && cp /etc/letsencrypt/live/counsel.yourdomain.com/privkey.pem /path/to/nginx/ssl/ && docker compose restart nginx"
