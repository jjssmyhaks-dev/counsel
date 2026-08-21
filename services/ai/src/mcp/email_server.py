"""
Email MCP Server — Port 3104

Tools: send_email, read_inbox, search_emails, get_thread
Backed by: Resend API (configured via RESEND_API_KEY env var).
When not configured, returns helpful error messages instead of fake data.
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

# ── Resend API integration ─────────────────────────────────────────────────
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM_EMAIL", "noreply@counsel.ai")

async def _send_via_resend(to: str, subject: str, body: str) -> dict:
    """Send email via Resend API."""
    if not RESEND_API_KEY:
        return {"error": "RESEND_API_KEY not configured. Please add it to your environment."}
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                json={"from": RESEND_FROM, "to": [to], "subject": subject, "html": body},
                timeout=30,
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"sent": True, "message_id": data.get("id"), "provider": "resend", "to": to}
            else:
                return {"error": f"Resend API error: {resp.status_code} — {resp.text[:200]}"}
    except Exception as e:
        return {"error": f"Failed to send email: {str(e)}"}

# ── Tool: send_email ──────────────────────────────────────────────────────
async def send_email_handler(to: str = "", subject: str = "", body: str = ""):
    if not to or not subject or not body:
        return {"error": "to, subject, and body are required"}
    return await _send_via_resend(to, subject, body)

registry.register({
    "name": "send_email",
    "description": "Send an email via configured SMTP/Resend.",
    "inputSchema": {"type": "object", "properties": {
        "to": {"type": "string", "description": "Recipient email address"},
        "subject": {"type": "string", "description": "Email subject line"},
        "body": {"type": "string", "description": "Email body (HTML supported)"}
    }, "required": ["to", "subject", "body"]},
}, send_email_handler)

# ── Tool: send_invite_email ───────────────────────────────────────────────
async def send_invite_handler(to: str = "", firmName: str = "", inviteLink: str = "", role: str = "member"):
    """Send a team invite email with a branded template."""
    if not to or not inviteLink:
        return {"error": "to and inviteLink are required"}
    
    subject = f"You've been invited to join {firmName} on Counsel"
    body = f"""
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; color: #0c0a09; margin: 0;">Counsel</h1>
            <p style="color: #717d79; font-size: 14px; margin: 4px 0 0;">AI Workforce for Professional Firms</p>
        </div>
        <div style="background: #eaf7f0; border: 1px solid #15b88133; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="font-size: 14px; color: #0c0a09; margin: 0;">
                You've been invited to join <strong>{firmName}</strong> as <strong>{role}</strong>.
            </p>
        </div>
        <a href="{inviteLink}" style="display: block; width: 100%; text-align: center; background: #0c0a09; color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Accept Invitation →
        </a>
        <p style="text-align: center; color: #969e9b; font-size: 12px; margin-top: 24px;">
            This invitation expires in 7 days. If you didn't expect this, you can safely ignore this email.
        </p>
    </div>
    """
    return await _send_via_resend(to, subject, body)

registry.register({
    "name": "send_invite_email",
    "description": "Send a branded team invitation email with a join link.",
    "inputSchema": {"type": "object", "properties": {
        "to": {"type": "string", "description": "Invitee email address"},
        "firmName": {"type": "string", "description": "Name of the firm"},
        "inviteLink": {"type": "string", "description": "Full invite URL"},
        "role": {"type": "string", "description": "Role being assigned"}
    }, "required": ["to", "firmName", "inviteLink"]},
}, send_invite_handler)

# ── Tool: read_inbox ──────────────────────────────────────────────────────
async def read_inbox_handler(limit: int = 10):
    """Read inbox emails. Requires IMAP credentials to be configured."""
    imap_host = os.environ.get("IMAP_HOST", "")
    if not imap_host:
        return {
            "error": "IMAP not configured. Set IMAP_HOST, IMAP_USER, IMAP_PASSWORD environment variables.",
            "hint": "Configure IMAP to enable inbox reading, or use the Resend API for sending."
        }
    # Real IMAP reading would go here
    return {"emails": [], "count": 0, "note": "IMAP integration coming soon"}

registry.register({
    "name": "read_inbox",
    "description": "Fetch recent inbox emails for a user.",
    "inputSchema": {"type": "object", "properties": {
        "limit": {"type": "integer", "description": "Number of emails to fetch (default 10)"}
    }, "required": []},
}, read_inbox_handler)

# ── Tool: search_emails ──────────────────────────────────────────────────
async def search_emails_handler(query: str = ""):
    if not query:
        return {"error": "query is required"}
    return {"results": [], "query": query, "note": "Email search requires IMAP configuration"}

registry.register({
    "name": "search_emails",
    "description": "Search emails by keyword, date range, or sender.",
    "inputSchema": {"type": "object", "properties": {
        "query": {"type": "string", "description": "Search query"}
    }, "required": ["query"]},
}, search_emails_handler)

# ── Tool: get_thread ─────────────────────────────────────────────────────
async def get_thread_handler(thread_id: str = ""):
    if not thread_id:
        return {"error": "thread_id is required"}
    return {"thread_id": thread_id, "messages": [], "participants": [], "note": "Thread history requires IMAP configuration"}

registry.register({
    "name": "get_thread",
    "description": "Get the full conversation thread for a given email.",
    "inputSchema": {"type": "object", "properties": {
        "thread_id": {"type": "string", "description": "Email thread ID"}
    }, "required": ["thread_id"]},
}, get_thread_handler)

app = create_mcp_app("email", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3104"))
    _setup_shutdown("email-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
