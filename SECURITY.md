# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | ✅ Active support  |
| < 1.0   | ❌ No support      |

## Reporting a Vulnerability

If you discover a security vulnerability in Counsel AI Workforce Suite, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. Email: security@counsel.ai with details and reproduction steps
3. Include: affected version, attack vector, potential impact
4. You will receive acknowledgment within 48 hours
5. We will investigate and provide a fix timeline within 7 days

## Security Measures

### Authentication
- JWT-based with refresh token rotation
- Password hashing via bcrypt (12 rounds)
- Auth-specific rate limiting: 10 requests / 15 min per IP
- Global rate limiting: 100 requests / 15 min per IP

### API Security
- Helmet security headers (CSP, HSTS, XSS filter)
- CORS restricted to configured origins
- Zod input validation on all routes
- Multi-tenant isolation via firmId
- Request ID tracing on every request

### Data Security
- PostgreSQL with Row Level Security (RLS) ready
- OAuth tokens encrypted at rest
- No secrets in code — all via environment variables
- Audit logging on all mutations

### Infrastructure
- WorkOS SSO/SAML for enterprise auth
- R2 encrypted object storage
- Neon serverless Postgres with auto-backups

## Disclosure Policy

- Security fixes are released as patch versions
- CVEs are assigned for critical vulnerabilities
- Public disclosure after fix is released (max 90 days)

## Contact

- Security: security@counsel.ai
- General: support@counsel.ai
