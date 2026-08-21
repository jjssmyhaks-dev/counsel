"""
Regression Alerts — notify admins when AI quality drops.

Alert channels:
  - Slack webhook (if SLACK_WEBHOOK_URL configured)
  - Email via Resend (if RESEND_API_KEY configured)
  - Console log (always)

Triggers:
  - Quality regression detected (>15% drop in overall score)
  - Tool failure rate exceeds 50%
  - PII leak detected
  - Prompt injection detected
  - Budget exceeded
"""
from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertType(str, Enum):
    QUALITY_REGRESSION = "quality_regression"
    TOOL_FAILURE_RATE = "tool_failure_rate"
    PII_LEAK = "pii_leak"
    PROMPT_INJECTION = "prompt_injection"
    BUDGET_EXCEEDED = "budget_exceeded"
    HIGH_LATENCY = "high_latency"


@dataclass
class Alert:
    id: str
    timestamp: str
    severity: AlertSeverity
    alert_type: AlertType
    firm_id: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    acknowledged: bool = False


class AlertManager:
    """
    Manages alerts — detection, deduplication, notification, and history.
    """

    # Dedup window: don't send same alert type for same firm within this period
    DEDUP_WINDOW_SECONDS = 3600  # 1 hour

    def __init__(self):
        self._alerts: Dict[str, List[Alert]] = {}  # firm_id -> alerts
        self._last_sent: Dict[str, float] = {}  # dedup key -> timestamp
        self._max_alerts_per_firm = 100

    def check_quality_regression(
        self,
        firm_id: str,
        recent_avg: float,
        baseline_avg: float,
        tool_name: Optional[str] = None,
    ) -> Optional[Alert]:
        """Check if quality has regressed and fire alert if needed."""
        if baseline_avg <= 0:
            return None

        regression_pct = (1 - recent_avg / baseline_avg) * 100

        if regression_pct < 15:  # Less than 15% drop — not significant
            return None

        dedup_key = f"regression:{firm_id}:{tool_name or 'overall'}"
        if self._is_deduplicated(dedup_key):
            return None

        severity = AlertSeverity.CRITICAL if regression_pct > 30 else AlertSeverity.WARNING
        target = f"tool '{tool_name}'" if tool_name else "overall quality"

        alert = self._create_alert(
            severity=severity,
            alert_type=AlertType.QUALITY_REGRESSION,
            firm_id=firm_id,
            message=f"Quality regression detected for {target}: {regression_pct:.1f}% drop "
                    f"(recent: {recent_avg:.3f}, baseline: {baseline_avg:.3f})",
            details={
                "target": target,
                "tool_name": tool_name,
                "recent_avg": round(recent_avg, 4),
                "baseline_avg": round(baseline_avg, 4),
                "regression_pct": round(regression_pct, 1),
            },
        )

        self._send_notifications(alert)
        return alert

    def check_tool_failure_rate(
        self,
        firm_id: str,
        tool_name: str,
        failure_rate: float,
        sample_count: int,
    ) -> Optional[Alert]:
        """Fire alert if tool failure rate exceeds threshold."""
        if failure_rate < 0.5 or sample_count < 5:
            return None

        dedup_key = f"failure:{firm_id}:{tool_name}"
        if self._is_deduplicated(dedup_key):
            return None

        severity = AlertSeverity.CRITICAL if failure_rate > 0.8 else AlertSeverity.WARNING

        alert = self._create_alert(
            severity=severity,
            alert_type=AlertType.TOOL_FAILURE_RATE,
            firm_id=firm_id,
            message=f"Tool '{tool_name}' failure rate: {failure_rate*100:.0f}% ({sample_count} samples)",
            details={
                "tool_name": tool_name,
                "failure_rate": round(failure_rate, 4),
                "sample_count": sample_count,
            },
        )

        self._send_notifications(alert)
        return alert

    def check_pii_leak(
        self,
        firm_id: str,
        pii_types: List[str],
        context: str = "",
    ) -> Optional[Alert]:
        """Fire alert when PII is detected in AI output."""
        dedup_key = f"pii:{firm_id}:{','.join(sorted(pii_types))}"
        if self._is_deduplicated(dedup_key):
            return None

        alert = self._create_alert(
            severity=AlertSeverity.CRITICAL,
            alert_type=AlertType.PII_LEAK,
            firm_id=firm_id,
            message=f"PII detected in AI output: {', '.join(pii_types)}",
            details={"pii_types": pii_types, "context": context[:200]},
        )

        self._send_notifications(alert)
        return alert

    def check_prompt_injection(
        self,
        firm_id: str,
        user_message: str,
    ) -> Optional[Alert]:
        """Fire alert when prompt injection is detected."""
        dedup_key = f"injection:{firm_id}"
        if self._is_deduplicated(dedup_key):
            return None

        alert = self._create_alert(
            severity=AlertSeverity.WARNING,
            alert_type=AlertType.PROMPT_INJECTION,
            firm_id=firm_id,
            message=f"Prompt injection attempt blocked",
            details={"message_preview": user_message[:200]},
        )

        self._send_notifications(alert)
        return alert

    def check_budget(
        self,
        firm_id: str,
        current_cost: float,
        budget: float,
    ) -> Optional[Alert]:
        """Fire alert when budget is exceeded or near exceeded."""
        if current_cost < budget * 0.9:  # Only alert at 90%+ usage
            return None

        dedup_key = f"budget:{firm_id}"
        if self._is_deduplicated(dedup_key):
            return None

        severity = AlertSeverity.CRITICAL if current_cost >= budget else AlertSeverity.WARNING
        pct = (current_cost / budget) * 100

        alert = self._create_alert(
            severity=severity,
            alert_type=AlertType.BUDGET_EXCEEDED,
            firm_id=firm_id,
            message=f"AI budget {'exceeded' if current_cost >= budget else 'at ' + f'{pct:.0f}%'}: ${current_cost:.2f} / ${budget:.2f}",
            details={"current_cost": round(current_cost, 4), "budget": budget, "pct": round(pct, 1)},
        )

        self._send_notifications(alert)
        return alert

    def get_alerts(
        self,
        firm_id: str,
        limit: int = 50,
        severity: Optional[AlertSeverity] = None,
    ) -> List[Dict[str, Any]]:
        """Get recent alerts for a firm."""
        alerts = self._alerts.get(firm_id, [])

        if severity:
            alerts = [a for a in alerts if a.severity == severity]

        return [
            {
                "id": a.id,
                "timestamp": a.timestamp,
                "severity": a.severity.value,
                "type": a.alert_type.value,
                "message": a.message,
                "details": a.details,
                "acknowledged": a.acknowledged,
            }
            for a in alerts[-limit:]
        ]

    def acknowledge(self, firm_id: str, alert_id: str) -> bool:
        """Mark an alert as acknowledged."""
        for alert in self._alerts.get(firm_id, []):
            if alert.id == alert_id:
                alert.acknowledged = True
                return True
        return False

    # ─── Internal helpers ────────────────────────────────────────────

    def _create_alert(
        self,
        severity: AlertSeverity,
        alert_type: AlertType,
        firm_id: str,
        message: str,
        details: Dict[str, Any],
    ) -> Alert:
        alert = Alert(
            id=f"alert_{int(time.time() * 1000)}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            severity=severity,
            alert_type=alert_type,
            firm_id=firm_id,
            message=message,
            details=details,
        )

        if firm_id not in self._alerts:
            self._alerts[firm_id] = []
        self._alerts[firm_id].append(alert)

        # Trim old alerts
        if len(self._alerts[firm_id]) > self._max_alerts_per_firm:
            self._alerts[firm_id] = self._alerts[firm_id][-self._max_alerts_per_firm:]

        return alert

    def _is_deduplicated(self, key: str) -> bool:
        """Check if we've sent this alert recently."""
        now = time.time()
        last = self._last_sent.get(key, 0)
        if now - last < self.DEDUP_WINDOW_SECONDS:
            return True
        self._last_sent[key] = now
        return False

    def _send_notifications(self, alert: Alert):
        """Send alert through all configured channels."""
        # 1. Console log (always)
        log_fn = logger.warning if alert.severity == AlertSeverity.WARNING else logger.critical
        log_fn("[ALERT:%s] %s | firm=%s | %s",
               alert.severity.value.upper(), alert.alert_type.value, alert.firm_id, alert.message)

        # 2. Slack webhook
        slack_url = os.environ.get("SLACK_WEBHOOK_URL")
        if slack_url:
            self._send_slack(slack_url, alert)

        # 3. Console JSON (for structured log aggregation)
        try:
            logger.info("ALERT_JSON: %s", json.dumps({
                "severity": alert.severity.value,
                "type": alert.alert_type.value,
                "firm_id": alert.firm_id,
                "message": alert.message,
                "details": alert.details,
                "timestamp": alert.timestamp,
            }))
        except Exception:
            pass

    def _send_slack(self, webhook_url: str, alert: Alert):
        """Send alert to Slack via webhook."""
        try:
            import httpx

            color = {
                AlertSeverity.INFO: "#36a64f",
                AlertSeverity.WARNING: "#ff9900",
                AlertSeverity.CRITICAL: "#ff0000",
            }.get(alert.severity, "#999999")

            payload = {
                "attachments": [{
                    "color": color,
                    "title": f"🚨 Counsel AI Alert: {alert.alert_type.value}",
                    "text": alert.message,
                    "fields": [
                        {"title": "Severity", "value": alert.severity.value.upper(), "short": True},
                        {"title": "Firm", "value": alert.firm_id[:12], "short": True},
                    ],
                    "footer": "Counsel AI Monitoring",
                    "ts": int(time.time()),
                }],
            }

            httpx.post(webhook_url, json=payload, timeout=5)
        except Exception as e:
            logger.warning("Slack alert failed: %s", e)


# Global singleton
alert_manager = AlertManager()
