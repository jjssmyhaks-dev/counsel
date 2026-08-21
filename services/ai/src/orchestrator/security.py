"""
Security Layer — RBAC enforcement, tenant isolation, compliance controls.

Enforces:
  - Role-Based Access Control at the orchestrator level
  - Tenant isolation verification (every operation is firm-scoped)
  - Compliance constraints (filing approval gates)
  - Data classification (sensitive data handling)
  - Session validation
"""
from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    PARTNER = "PARTNER"
    ASSOCIATE = "ASSOCIATE"
    TRAINEE = "TRAINEE"
    VIEWER = "VIEWER"


class Permission(str, Enum):
    # Document permissions
    DOCUMENT_READ = "document:read"
    DOCUMENT_WRITE = "document:write"
    DOCUMENT_DELETE = "document:delete"

    # Matter permissions
    MATTER_READ = "matter:read"
    MATTER_CREATE = "matter:create"
    MATTER_CLOSE = "matter:close"

    # AI permissions
    AI_CHAT = "ai:chat"
    AI_ANALYZE = "ai:analyze"
    AI_DRAFT = "ai:draft"
    AI_RESEARCH = "ai:research"
    AI_COMPLIANCE = "ai:compliance"

    # CA vertical permissions
    CA_BOOKKEEPING = "ca:bookkeeping"
    CA_GST = "ca:gst"
    CA_GST_FILE = "ca:gst:file"  # Filing-specific
    CA_AUDIT = "ca:audit"
    CA_INCOME_TAX = "ca:income_tax"
    CA_INCOME_TAX_FILE = "ca:income_tax:file"
    CA_ROC = "ca:roc"
    CA_ROC_FILE = "ca:roc:file"

    # Admin permissions
    ADMIN_USERS = "admin:users"
    ADMIN_BILLING = "admin:billing"
    ADMIN_AUDIT = "admin:audit"
    ADMIN_INTEGRATIONS = "admin:integrations"
    ADMIN_PLAYBOOK = "admin:playbook"

    # E-sign permissions
    ESIGN_SEND = "esign:send"
    ESIGN_VOID = "esign:void"

    # Billing permissions
    BILLING_VIEW = "billing:view"
    BILLING_MANAGE = "billing:manage"


# Role → Permissions mapping
ROLE_PERMISSIONS: Dict[UserRole, Set[Permission]] = {
    UserRole.ADMIN: {p for p in Permission},  # All permissions
    UserRole.PARTNER: {
        Permission.DOCUMENT_READ, Permission.DOCUMENT_WRITE, Permission.DOCUMENT_DELETE,
        Permission.MATTER_READ, Permission.MATTER_CREATE, Permission.MATTER_CLOSE,
        Permission.AI_CHAT, Permission.AI_ANALYZE, Permission.AI_DRAFT,
        Permission.AI_RESEARCH, Permission.AI_COMPLIANCE,
        Permission.CA_BOOKKEEPING, Permission.CA_GST, Permission.CA_GST_FILE,
        Permission.CA_AUDIT, Permission.CA_INCOME_TAX, Permission.CA_INCOME_TAX_FILE,
        Permission.CA_ROC, Permission.CA_ROC_FILE,
        Permission.ADMIN_AUDIT, Permission.ADMIN_PLAYBOOK,
        Permission.ESIGN_SEND, Permission.ESIGN_VOID,
        Permission.BILLING_VIEW, Permission.BILLING_MANAGE,
    },
    UserRole.ASSOCIATE: {
        Permission.DOCUMENT_READ, Permission.DOCUMENT_WRITE,
        Permission.MATTER_READ, Permission.MATTER_CREATE,
        Permission.AI_CHAT, Permission.AI_ANALYZE, Permission.AI_DRAFT,
        Permission.AI_RESEARCH, Permission.AI_COMPLIANCE,
        Permission.CA_BOOKKEEPING, Permission.CA_GST,
        Permission.CA_AUDIT, Permission.CA_INCOME_TAX,
        Permission.CA_ROC,
        Permission.ESIGN_SEND,
        Permission.BILLING_VIEW,
    },
    UserRole.TRAINEE: {
        Permission.DOCUMENT_READ,
        Permission.MATTER_READ,
        Permission.AI_CHAT, Permission.AI_ANALYZE, Permission.AI_RESEARCH,
        Permission.CA_BOOKKEEPING, Permission.CA_AUDIT,
    },
    UserRole.VIEWER: {
        Permission.DOCUMENT_READ,
        Permission.MATTER_READ,
        Permission.AI_CHAT,
    },
}

# Tools that require specific permissions
TOOL_PERMISSIONS: Dict[str, Permission] = {
    "document_intelligence": Permission.AI_ANALYZE,
    "drafting": Permission.AI_DRAFT,
    "research": Permission.AI_RESEARCH,
    "compliance": Permission.AI_COMPLIANCE,
    "ca_bookkeeping": Permission.CA_BOOKKEEPING,
    "ca_gst": Permission.CA_GST,
    "ca_audit": Permission.CA_AUDIT,
    "ca_income_tax": Permission.CA_INCOME_TAX,
    "ca_roc": Permission.CA_ROC,
    "esign_send": Permission.ESIGN_SEND,
    "email_send": Permission.AI_CHAT,  # Using AI chat as proxy
}

# Tools that require PARTNER+ (filing-adjacent)
FILING_TOOLS: Dict[str, Permission] = {
    "ca_gst": Permission.CA_GST_FILE,
    "ca_income_tax": Permission.CA_INCOME_TAX_FILE,
    "ca_roc": Permission.CA_ROC_FILE,
    "esign_send": Permission.ESIGN_SEND,
}


@dataclass
class SecurityContext:
    """Security context for an operation."""
    firm_id: str
    user_id: str
    user_role: UserRole
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    permissions: Set[Permission] = field(default_factory=set)

    def __post_init__(self):
        self.permissions = ROLE_PERMISSIONS.get(self.user_role, set())


class SecurityEnforcer:
    """
    Enforces security policies at the orchestrator level.

    Every operation passes through this enforcer before execution.
    """

    def __init__(self):
        self._violations: List[Dict[str, Any]] = []

    def check_permission(
        self,
        ctx: SecurityContext,
        tool_name: str,
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a user has permission to use a tool.

        Returns: (allowed, reason)
        """
        # Check tool-specific permission
        required = TOOL_PERMISSIONS.get(tool_name)
        if required and required not in ctx.permissions:
            msg = f"User role '{ctx.user_role.value}' lacks permission '{required.value}' for tool '{tool_name}'"
            self._log_violation(ctx, "permission_denied", msg)
            return False, msg

        # Check filing-specific permission (PARTNER+ required)
        filing_perm = FILING_TOOLS.get(tool_name)
        if filing_perm:
            if ctx.user_role not in (UserRole.ADMIN, UserRole.PARTNER):
                msg = f"Filing action '{tool_name}' requires PARTNER or ADMIN role"
                self._log_violation(ctx, "filing_requires_approval", msg)
                return False, msg

        return True, None

    def verify_tenant_isolation(
        self,
        ctx: SecurityContext,
        resource_firm_id: str,
    ) -> Tuple[bool, Optional[str]]:
        """Verify that a resource belongs to the user's firm."""
        if ctx.firm_id != resource_firm_id:
            msg = f"Tenant isolation violation: user firm={ctx.firm_id}, resource firm={resource_firm_id}"
            self._log_violation(ctx, "tenant_isolation_violation", msg)
            return False, msg
        return True, None

    def validate_session(self, ctx: SecurityContext) -> Tuple[bool, Optional[str]]:
        """Validate that the security context is complete and valid."""
        if not ctx.firm_id:
            return False, "Missing firm_id"
        if not ctx.user_id:
            return False, "Missing user_id"
        if not ctx.user_role:
            return False, "Missing user role"
        return True, None

    def sanitize_for_audit(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize data for audit logging (remove sensitive fields)."""
        sanitized = dict(data)
        sensitive_keys = {"password", "token", "secret", "api_key", "authorization"}
        for key in list(sanitized.keys()):
            if key.lower() in sensitive_keys:
                sanitized[key] = "***REDACTED***"
            elif isinstance(sanitized[key], dict):
                sanitized[key] = self.sanitize_for_audit(sanitized[key])
        return sanitized

    def get_violations(
        self,
        firm_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get recent security violations."""
        violations = self._violations
        if firm_id:
            violations = [v for v in violations if v.get("firm_id") == firm_id]
        return violations[-limit:]

    def get_security_report(self, firm_id: str) -> Dict[str, Any]:
        """Get a security summary for a firm."""
        violations = [v for v in self._violations if v.get("firm_id") == firm_id]
        by_type = defaultdict(int)
        for v in violations:
            by_type[v.get("violation_type", "unknown")] += 1

        return {
            "firm_id": firm_id,
            "total_violations": len(violations),
            "by_type": dict(by_type),
            "recent_violations": violations[-10:],
        }

    def _log_violation(self, ctx: SecurityContext, violation_type: str, message: str):
        """Log a security violation."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "firm_id": ctx.firm_id,
            "user_id": ctx.user_id,
            "user_role": ctx.user_role.value,
            "violation_type": violation_type,
            "message": message,
            "session_id": ctx.session_id,
            "ip_address": ctx.ip_address,
        }
        self._violations.append(entry)
        if len(self._violations) > 1000:
            self._violations = self._violations[-1000:]

        logger.warning("Security violation: %s — %s (user=%s, firm=%s)",
                       violation_type, message, ctx.user_id, ctx.firm_id)


# Global singleton
security = SecurityEnforcer()
