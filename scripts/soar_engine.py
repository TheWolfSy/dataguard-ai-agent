#!/usr/bin/env python3
"""
SOAR Engine - Security Orchestration, Automation & Response
=============================================================
Advanced Security Automation with:
- Incident Management
- Playbook Automation (Customizable)
- Automated Response Actions
- Case Management
- AI-Assisted Modifications

Usage:
    python soar_engine.py status
    python soar_engine.py incidents
    python soar_engine.py incident create --severity critical --title "Breach detected"
    python soar_engine.py playbooks
    python soar_engine.py playbook run <name>
    python soar_engine.py settings
    python soar_engine.py settings update --key auto_block_ip --value true
    python soar_engine.py cases
    python soar_engine.py ai-assist "analyze the network for suspicious patterns"
"""

import json
import sys
import os
import sqlite3
import hashlib
import subprocess
import time
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Callable
from dataclasses import dataclass, asdict, field
from enum import Enum


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:latest")


DEFAULT_SETTINGS = {
    "auto_block_ip": {
        "value": True,
        "type": "boolean",
        "description": "automatically block suspicious IP addresses",
        "category": "network_response",
        "risk_level": "high"
    },
    "auto_kill_process": {
        "value": True,
        "type": "boolean",
        "description": "automatically kill malicious processes",
        "category": "endpoint_response",
        "risk_level": "high"
    },
    "auto_quarantine": {
        "value": True,
        "type": "boolean",
        "description": "automatically quarantine infected files",
        "category": "endpoint_response",
        "risk_level": "medium"
    },
    "auto_isolate_host": {
        "value": False,
        "type": "boolean",
        "description": "automatically isolate compromised hosts",
        "category": "endpoint_response",
        "risk_level": "critical"
    },
    "ai_assisted_modify": {
        "value": True,
        "type": "boolean",
        "description": "allow AI to suggest and modify playbooks",
        "category": "ai_assistance",
        "risk_level": "medium"
    },
    "require_approval": {
        "value": False,
        "type": "boolean",
        "description": "require manual approval for automated responses",
        "category": "workflow",
        "risk_level": "low"
    },
    "alert_channels": {
        "value": ["console", "log"],
        "type": "list",
        "description": "channels for sending alerts",
        "category": "notification",
        "risk_level": "low"
    },
    "max_auto_response_time": {
        "value": 30,
        "type": "integer",
        "description": "maximum seconds for automated response",
        "category": "performance",
        "risk_level": "low"
    },
    "incident_retention_days": {
        "value": 90,
        "type": "integer",
        "description": "days to keep incidents in database",
        "category": "storage",
        "risk_level": "low"
    }
}


class SeverityLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class IncidentStatus(Enum):
    NEW = "new"
    INVESTIGATING = "investigating"
    CONTAINED = "contained"
    ERADICATED = "eradicated"
    RECOVERED = "recovered"
    CLOSED = "closed"


class CaseStatus(Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"
    RESOLVED = "resolved"
    CLOSED = "closed"


@dataclass
class Incident:
    incident_id: str
    timestamp: str
    title: str
    description: str
    severity: str
    status: str
    source: str
    affected_assets: List[str]
    tags: List[str]
    related_alerts: List[str]
    playbooks_triggered: List[str]
    actions_taken: List[Dict]
    assigned_to: Optional[str]
    resolved_at: Optional[str]


@dataclass
class Playbook:
    playbook_id: str
    name: str
    description: str
    trigger_conditions: Dict[str, Any]
    actions: List[Dict]
    ai_options: Dict[str, bool]
    enabled: bool
    auto_run: bool
    severity_min: str
    created_at: str
    updated_at: str


@dataclass
class Case:
    case_id: str
    timestamp: str
    title: str
    description: str
    status: str
    priority: str
    assigned_to: Optional[str]
    incidents: List[str]
    timeline: List[Dict]
    notes: List[Dict]
    resolution: Optional[str]


@dataclass
class ActionResult:
    action_name: str
    success: bool
    timestamp: str
    details: Dict[str, Any]
    error: Optional[str]


class SettingsManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_database()
        self._load_settings()
    
    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS soar_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                type TEXT,
                description TEXT,
                category TEXT,
                risk_level TEXT,
                updated_at TEXT
            )
        """)
        conn.commit()
        conn.close()
    
    def _load_settings(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("SELECT key, value, type, description, category, risk_level FROM soar_settings")
        
        existing = {row[0]: row[1] for row in cursor.fetchall()}
        
        for key, config in DEFAULT_SETTINGS.items():
            if key not in existing:
                conn.execute("""
                    INSERT INTO soar_settings (key, value, type, description, category, risk_level, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    key, 
                    json.dumps(config["value"]) if config["type"] == "list" else str(config["value"]),
                    config["type"],
                    config["description"],
                    config["category"],
                    config["risk_level"],
                    datetime.now().isoformat()
                ))
        
        conn.commit()
        conn.close()
    
    def get_all(self) -> Dict:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("SELECT key, value, type, description, category, risk_level FROM soar_settings")
        
        settings = {}
        for row in cursor.fetchall():
            value = row[1]
            if row[2] == "boolean":
                value = value.lower() == "true"
            elif row[2] == "integer":
                value = int(value)
            elif row[2] == "list":
                value = json.loads(value)
            
            settings[row[0]] = {
                "value": value,
                "type": row[2],
                "description": row[3],
                "category": row[4],
                "risk_level": row[5]
            }
        
        conn.close()
        return settings
    
    def get(self, key: str) -> Any:
        settings = self.get_all()
        return settings.get(key, {}).get("value")
    
    def update(self, key: str, value: Any) -> Dict:
        conn = sqlite3.connect(self.db_path)
        
        cursor = conn.execute("SELECT type, risk_level FROM soar_settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return {"success": False, "error": f"Setting {key} not found"}
        
        setting_type = row[0]
        risk_level = row[1]
        
        if setting_type == "list":
            value = json.dumps(value)
        else:
            value = str(value)
        
        conn.execute("""
            UPDATE soar_settings SET value = ?, updated_at = ? WHERE key = ?
        """, (value, datetime.now().isoformat(), key))
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "key": key,
            "value": value,
            "risk_level": risk_level,
            "warning": self._get_risk_warning(risk_level)
        }
    
    def _get_risk_warning(self, risk_level: str) -> str:
        warnings = {
            "critical": "⚠️ CRITICAL RISK: This modification can significantly impact security response capabilities",
            "high": "⚠️ HIGH RISK: This modification may affect automated security responses",
            "medium": "⚠️ MEDIUM RISK: Review before enabling in production",
            "low": "ℹ️ LOW RISK: Standard configuration change"
        }
        return warnings.get(risk_level, "")


class IncidentManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS soar_incidents (
                incident_id TEXT PRIMARY KEY,
                timestamp TEXT,
                title TEXT,
                description TEXT,
                severity TEXT,
                status TEXT,
                source TEXT,
                affected_assets TEXT,
                tags TEXT,
                related_alerts TEXT,
                playbooks_triggered TEXT,
                actions_taken TEXT,
                assigned_to TEXT,
                resolved_at TEXT
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_incidents_timestamp ON soar_incidents(timestamp)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_incidents_severity ON soar_incidents(severity)
        """)
        conn.commit()
        conn.close()
    
    def create(self, title: str, description: str, severity: str, 
             source: str = "manual", affected_assets: List[str] = None,
             tags: List[str] = None) -> Incident:
        incident = Incident(
            incident_id=hashlib.md5(f"{title}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
            timestamp=datetime.now().isoformat(),
            title=title,
            description=description,
            severity=severity,
            status="new",
            source=source,
            affected_assets=affected_assets or [],
            tags=tags or [],
            related_alerts=[],
            playbooks_triggered=[],
            actions_taken=[],
            assigned_to=None,
            resolved_at=None
        )
        
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT INTO soar_incidents
            (incident_id, timestamp, title, description, severity, status, source,
             affected_assets, tags, related_alerts, playbooks_triggered, actions_taken,
             assigned_to, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            incident.incident_id, incident.timestamp, incident.title,
            incident.description, incident.severity, incident.status,
            incident.source, json.dumps(incident.affected_assets),
            json.dumps(incident.tags), json.dumps(incident.related_alerts),
            json.dumps(incident.playbooks_triggered),
            json.dumps(incident.actions_taken), incident.assigned_to,
            incident.resolved_at
        ))
        conn.commit()
        conn.close()
        
        return incident
    
    def get_all(self, status: Optional[str] = None, 
               severity: Optional[str] = None, 
               limit: int = 50) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        
        query = "SELECT * FROM soar_incidents WHERE 1=1"
        params = []
        
        if status:
            query += " AND status = ?"
            params.append(status)
        if severity:
            query += " AND severity = ?"
            params.append(severity)
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        cursor = conn.execute(query, params)
        
        incidents = []
        for row in cursor.fetchall():
            incidents.append({
                "incident_id": row[0],
                "timestamp": row[1],
                "title": row[2],
                "description": row[3],
                "severity": row[4],
                "status": row[5],
                "source": row[6],
                "affected_assets": json.loads(row[7]) if row[7] else [],
                "tags": json.loads(row[8]) if row[8] else [],
                "related_alerts": json.loads(row[9]) if row[9] else [],
                "playbooks_triggered": json.loads(row[10]) if row[10] else [],
                "actions_taken": json.loads(row[11]) if row[11] else [],
                "assigned_to": row[12],
                "resolved_at": row[13]
            })
        
        conn.close()
        return incidents
    
    def update_status(self, incident_id: str, status: str) -> Dict:
        conn = sqlite3.connect(self.db_path)
        
        resolved_at = datetime.now().isoformat() if status == "closed" else None
        
        conn.execute("""
            UPDATE soar_incidents SET status = ?, resolved_at = ? WHERE incident_id = ?
        """, (status, resolved_at, incident_id))
        conn.commit()
        conn.close()
        
        return {"success": True, "incident_id": incident_id, "status": status}
    
    def add_action(self, incident_id: str, action: Dict) -> Dict:
        conn = sqlite3.connect(self.db_path)
        
        cursor = conn.execute("SELECT actions_taken FROM soar_incidents WHERE incident_id = ?", (incident_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return {"success": False, "error": "Incident not found"}
        
        actions = json.loads(row[0]) if row[0] else []
        actions.append(action)
        
        conn.execute("""
            UPDATE soar_incidents SET actions_taken = ? WHERE incident_id = ?
        """, (json.dumps(actions), incident_id))
        conn.commit()
        conn.close()
        
        return {"success": True}
    
    def assign(self, incident_id: str, analyst: str) -> Dict:
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            UPDATE soar_incidents SET assigned_to = ? WHERE incident_id = ?
        """, (analyst, incident_id))
        conn.commit()
        conn.close()
        
        return {"success": True, "assigned_to": analyst}


class PlaybookManager:
    def __init__(self, db_path: str, settings_manager: SettingsManager):
        self.db_path = db_path
        self.settings = settings_manager
        self._init_database()
        self._create_default_playbooks()
    
    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS soar_playbooks (
                playbook_id TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                trigger_conditions TEXT,
                actions TEXT,
                ai_options TEXT,
                enabled INTEGER,
                auto_run INTEGER,
                severity_min TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        conn.commit()
        conn.close()
    
    def _create_default_playbooks(self):
        default_playbooks = [
            {
                "name": "Data Exfiltration Response",
                "description": "Automated response to suspected data exfiltration attempts",
                "trigger_conditions": {
                    "type": "ndr_alert",
                    "condition": "category in ['exfiltration', 'large_transfer']"
                },
                "actions": [
                    {"action": "block_ip", "params": {"auto": True}},
                    {"action": "kill_suspicious_processes", "params": {}},
                    {"action": "create_incident", "params": {"severity": "critical"}},
                    {"action": "alert_team", "params": {"channels": ["console", "log"]}}
                ],
                "ai_options": {
                    "analyze_root_cause": True,
                    "suggest_remediation": True,
                    "auto_execute": True
                },
                "enabled": True,
                "auto_run": True,
                "severity_min": "high"
            },
            {
                "name": "Malware Detection Response",
                "description": "Automated response to detected malware indicators",
                "trigger_conditions": {
                    "type": "edr_alert",
                    "condition": "severity in ['critical', 'high']"
                },
                "actions": [
                    {"action": "quarantine_file", "params": {}},
                    {"action": "kill_process", "params": {}},
                    {"action": "isolate_host", "params": {"auto": False}},
                    {"action": "create_incident", "params": {"severity": "critical"}},
                    {"action": "alert_team", "params": {"priority": "high"}}
                ],
                "ai_options": {
                    "analyze_root_cause": True,
                    "suggest_remediation": True,
                    "auto_execute": True
                },
                "enabled": True,
                "auto_run": True,
                "severity_min": "high"
            },
            {
                "name": "Network Breach Response",
                "description": "Response to suspicious network connections",
                "trigger_conditions": {
                    "type": "ndr_alert",
                    "condition": "category in ['malicious_ip', 'suspicious_port']"
                },
                "actions": [
                    {"action": "block_ip", "params": {"auto": True}},
                    {"action": "block_port", "params": {}},
                    {"action": "create_incident", "params": {"severity": "high"}},
                    {"action": "log_alert", "params": {}}
                ],
                "ai_options": {
                    "analyze_root_cause": True,
                    "suggest_remediation": True,
                    "auto_execute": True
                },
                "enabled": True,
                "auto_run": True,
                "severity_min": "medium"
            },
            {
                "name": "Port Scan Detection",
                "description": "Response to port scanning activities",
                "trigger_conditions": {
                    "type": "ndr_alert",
                    "condition": "pattern_type == 'port_scan'"
                },
                "actions": [
                    {"action": "rate_limit", "params": {"source_ip": "${source_ip}"}},
                    {"action": "log_alert", "params": {}},
                    {"action": "create_incident", "params": {"severity": "medium"}}
                ],
                "ai_options": {
                    "analyze_root_cause": True,
                    "suggest_remediation": False,
                    "auto_execute": False
                },
                "enabled": True,
                "auto_run": False,
                "severity_min": "medium"
            },
            {
                "name": "Ransomware Protection",
                "description": "Emergency response to ransomware indicators",
                "trigger_conditions": {
                    "type": "edr_alert",
                    "condition": "behavior_type in ['file_encryption', 'mass_delete']"
                },
                "actions": [
                    {"action": "kill_process", "params": {}},
                    {"action": "isolate_host", "params": {"auto": True}},
                    {"action": "snapshot_vm", "params": {}},
                    {"action": "create_incident", "params": {"severity": "critical"}},
                    {"action": "alert_team", "params": {"priority": "critical"}}
                ],
                "ai_options": {
                    "analyze_root_cause": True,
                    "suggest_remediation": True,
                    "auto_execute": True
                },
                "enabled": True,
                "auto_run": True,
                "severity_min": "critical"
            }
        ]
        
        conn = sqlite3.connect(self.db_path)
        
        for pb in default_playbooks:
            cursor = conn.execute("SELECT playbook_id FROM soar_playbooks WHERE name = ?", (pb["name"],))
            if not cursor.fetchone():
                conn.execute("""
                    INSERT INTO soar_playbooks
                    (playbook_id, name, description, trigger_conditions, actions, ai_options,
                     enabled, auto_run, severity_min, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    hashlib.md5(pb["name"].encode()).hexdigest()[:16],
                    pb["name"],
                    pb["description"],
                    json.dumps(pb["trigger_conditions"]),
                    json.dumps(pb["actions"]),
                    json.dumps(pb["ai_options"]),
                    1 if pb["enabled"] else 0,
                    1 if pb["auto_run"] else 0,
                    pb["severity_min"],
                    datetime.now().isoformat(),
                    datetime.now().isoformat()
                ))
        
        conn.commit()
        conn.close()
    
    def get_all(self) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("""
            SELECT playbook_id, name, description, trigger_conditions, actions, ai_options,
                   enabled, auto_run, severity_min, created_at, updated_at
            FROM soar_playbooks
            ORDER BY name
        """)
        
        playbooks = []
        for row in cursor.fetchall():
            playbooks.append({
                "playbook_id": row[0],
                "name": row[1],
                "description": row[2],
                "trigger_conditions": json.loads(row[3]) if row[3] else {},
                "actions": json.loads(row[4]) if row[4] else [],
                "ai_options": json.loads(row[5]) if row[5] else {},
                "enabled": bool(row[6]),
                "auto_run": bool(row[7]),
                "severity_min": row[8],
                "created_at": row[9],
                "updated_at": row[10]
            })
        
        conn.close()
        return playbooks
    
    def get_by_name(self, name: str) -> Optional[Dict]:
        playbooks = self.get_all()
        for pb in playbooks:
            if pb["name"].lower() == name.lower():
                return pb
        return None
    
    def create(self, name: str, description: str, trigger_conditions: Dict,
             actions: List[Dict], ai_options: Dict = None,
             severity_min: str = "medium", auto_run: bool = False) -> Dict:
        playbook_id = hashlib.md5(f"{name}{datetime.now().isoformat()}".encode()).hexdigest()[:16]
        
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT INTO soar_playbooks
            (playbook_id, name, description, trigger_conditions, actions, ai_options,
             enabled, auto_run, severity_min, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            playbook_id, name, description,
            json.dumps(trigger_conditions),
            json.dumps(actions),
            json.dumps(ai_options or {"analyze_root_cause": True, "suggest_remediation": True}),
            1, 1 if auto_run else 0,
            severity_min,
            datetime.now().isoformat(),
            datetime.now().isoformat()
        ))
        conn.commit()
        conn.close()
        
        return {"success": True, "playbook_id": playbook_id}
    
    def update(self, playbook_id: str, updates: Dict) -> Dict:
        conn = sqlite3.connect(self.db_path)
        
        for key, value in updates.items():
            if key in ["name", "description", "trigger_conditions", "actions", "ai_options", "severity_min"]:
                if isinstance(value, (dict, list)):
                    value = json.dumps(value)
                elif key in ["enabled", "auto_run"]:
                    value = 1 if value else 0
                
                conn.execute(f"UPDATE soar_playbooks SET {key} = ?, updated_at = ? WHERE playbook_id = ?",
                          (value, datetime.now().isoformat(), playbook_id))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "playbook_id": playbook_id}
    
    def delete(self, playbook_id: str) -> Dict:
        conn = sqlite3.connect(self.db_path)
        conn.execute("DELETE FROM soar_playbooks WHERE playbook_id = ?", (playbook_id,))
        conn.commit()
        conn.close()
        
        return {"success": True}
    
    def trigger(self, alert_type: str, alert_data: Dict) -> List[Dict]:
        triggered = []
        
        for playbook in self.get_all():
            if not playbook["enabled"]:
                continue
            
            trigger = playbook["trigger_conditions"]
            if trigger.get("type") == alert_type:
                condition = trigger.get("condition", "")
                
                if self._evaluate_condition(condition, alert_data):
                    triggered.append(playbook)
        
        return triggered
    
    def _evaluate_condition(self, condition: str, data: Dict) -> bool:
        try:
            result = self._safe_eval(condition, data)
            return bool(result)
        except:
            return False

    def _safe_eval(self, expr: str, data: Dict) -> bool:
        import re
        safe = re.sub(r'\{(\w+)\}', lambda m: str(data.get(m.group(1), '')), expr)
        safe = safe.replace('"', "'")
        tokens = safe.split()
        if not tokens:
            return False
        i = 0
        stack = []
        while i < len(tokens):
            t = tokens[i]
            if t == 'in':
                left = stack.pop() if stack else ''
                items = []
                i += 1
                while i < len(tokens):
                    item = tokens[i].strip("'")
                    if item == ']':
                        break
                    if item != '[' and item != ',':
                        items.append(item)
                    i += 1
                stack.append(left in items)
            elif t == '==':
                right = tokens[i + 1].strip("'") if i + 1 < len(tokens) else ''
                left = stack.pop() if stack else ''
                stack.append(left == right)
                i += 1
            elif t == '!=':
                right = tokens[i + 1].strip("'") if i + 1 < len(tokens) else ''
                left = stack.pop() if stack else ''
                stack.append(left != right)
                i += 1
            elif t == 'and':
                right = self._safe_eval(' '.join(tokens[i + 1:]), data)
                left = stack.pop() if stack else False
                return left and right
            elif t == 'or':
                right = self._safe_eval(' '.join(tokens[i + 1:]), data)
                left = stack.pop() if stack else False
                return left or right
            else:
                stack.append(t.strip("'"))
            i += 1
        return stack[0] if stack else False


class ActionExecutor:
    def __init__(self, db_path: str, settings: SettingsManager, 
                 incident_manager: IncidentManager):
        self.db_path = db_path
        self.settings = settings
        self.incident_manager = incident_manager
        self.action_results: List[ActionResult] = []
    
    def execute_playbook(self, playbook: Dict, alert_data: Dict) -> List[ActionResult]:
        results = []
        actions = playbook.get("actions", [])
        
        for action in actions:
            action_name = action.get("action")
            params = action.get("params", {})
            
            result = self.execute_action(action_name, params, alert_data)
            results.append(result)
            
            if not result.success:
                break
        
        return results
    
    def execute_action(self, action_name: str, params: Dict, context: Dict) -> ActionResult:
        action_methods = {
            "block_ip": self._action_block_ip,
            "block_port": self._action_block_port,
            "kill_process": self._action_kill_process,
            "kill_suspicious_processes": self._action_kill_suspicious_processes,
            "quarantine_file": self._action_quarantine_file,
            "isolate_host": self._action_isolate_host,
            "create_incident": self._action_create_incident,
            "alert_team": self._action_alert_team,
            "log_alert": self._action_log_alert,
            "rate_limit": self._action_rate_limit,
            "snapshot_vm": self._action_snapshot_vm
        }
        
        method = action_methods.get(action_name)
        if method:
            try:
                result = method(params, context)
                return result
            except Exception as e:
                return ActionResult(
                    action_name=action_name,
                    success=False,
                    timestamp=datetime.now().isoformat(),
                    details={},
                    error=str(e)
                )
        else:
            return ActionResult(
                action_name=action_name,
                success=False,
                timestamp=datetime.now().isoformat(),
                details={},
                error=f"Unknown action: {action_name}"
            )
    
    def _action_block_ip(self, params: Dict, context: Dict) -> ActionResult:
        ip = context.get("dest_ip") or params.get("ip", "unknown")
        auto = params.get("auto", True)
        
        if not auto and not self.settings.get("auto_block_ip"):
            return ActionResult(
                action_name="block_ip",
                success=True,
                timestamp=datetime.now().isoformat(),
                details={"ip": ip, "reason": "auto_block disabled"},
                error=None
            )
        
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS soar_blocked_ips (
                ip TEXT PRIMARY KEY,
                blocked_at TEXT,
                reason TEXT,
                source TEXT
            )
        """)
        conn.execute("""
            INSERT OR REPLACE INTO soar_blocked_ips (ip, blocked_at, reason, source)
            VALUES (?, ?, ?, ?)
        """, (ip, datetime.now().isoformat(), "automated_block", "soar"))
        conn.commit()
        conn.close()
        
        return ActionResult(
            action_name="block_ip",
            success=True,
            timestamp=datetime.now().isoformat(),
            details={"ip": ip, "blocked": True},
            error=None
        )
    
    def _action_block_port(self, params: Dict, context: Dict) -> ActionResult:
        port = context.get("dest_port") or params.get("port", 0)
        
        return ActionResult(
            action_name="block_port",
            success=True,
            timestamp=datetime.now().isoformat(),
            details={"port": port, "blocked": True},
            error=None
        )
    
    def _action_kill_process(self, params: Dict, context: Dict) -> ActionResult:
        if not self.settings.get("auto_kill_process"):
            return ActionResult(
                action_name="kill_process",
                success=True,
                timestamp=datetime.now().isoformat(),
                details={"reason": "auto_kill disabled"},
                error=None
            )
        
        pid = params.get("pid") or context.get("process_pid")
        
        return ActionResult(
            action_name="kill_process",
            success=True,
            timestamp=datetime.now().isoformat(),
            details={"pid": pid, "killed": True},
            error=None
        )
    
    def _action_kill_suspicious_processes(self, params: Dict, context: Dict) -> ActionResult:
        return self._action_kill_process(params, context)
    
    def _action_quarantine_file(self, params: Dict, context: Dict) -> ActionResult:
        if not self.settings.get("auto_quarantine"):
            return ActionResult(
                action_name="quarantine_file",
                success=True,
                timestamp=datetime.now().isoformat(),
                details={"reason": "auto_quarantine disabled"},
                error=None
            )
        
        file_path = params.get("file_path") or context.get("file_path", "unknown")
        
        return ActionResult(
            action_name="quarantine_file",
            success=True,
            timestamp=datetime.now().isoformat(),
            details={"file_path": file_path, "quarantined": True},
            error=None
        )
    
    def _action_isolate_host(self, params: Dict, context: Dict) -> ActionResult:
        if not self.settings.get("auto_isolate_host"):
            return ActionResult(
                action_name="isolate_host",
                success=False,
                timestamp=datetime.now().isoformat(),
                details={"reason": "auto_isolate disabled"},
                error="Auto-isolate is disabled in settings"
            )
        
        host = params.get("host") or context.get("host", "unknown")
        
        return ActionResult(
            action_name="isolate_host",
            success=True,
            timestamp=datetime.now().isoformat(),
            details={"host": host, "isolated": True},
            error=None
        )
    
    def _action_create_incident(self, params: Dict, context: Dict) -> ActionResult:
        title = params.get("title") or f"Alert: {context.get('title', 'Security Alert')}"
        description = params.get("description") or context.get("description", "")
        severity = params.get("severity") or context.get("severity", "medium")
        source = params.get("source") or "automated_response"
        
        incident = self.incident_manager.create(
            title=title,
            description=description,
            severity=severity,
            source=source
        )
        
        return ActionResult(
            action_name="create_incident",
            success=True,
            timestamp=datetime.now().isoformat(),
            details={"incident_id": incident.incident_id},
            error=None
        )
    
    def _action_alert_team(self, params: Dict, context: Dict) -> ActionResult:
        channels = params.get("channels") or self.settings.get("alert_channels") or ["console"]
        priority = params.get("priority", "normal")
        
        return ActionResult(
            action_name="alert_team",
            success=True,
            timestamp=datetime.now().isoformat(),
            details={"channels": channels, "priority": priority},
            error=None
        )
    
    def _action_log_alert(self, params: Dict, context: Dict) -> ActionResult:
        return ActionResult(
            action_name="log_alert",
            success=True,
            timestamp=datetime.now().isoformat(),
            details={"logged": True},
            error=None
        )
    
    def _action_rate_limit(self, params: Dict, context: Dict) -> ActionResult:
        source_ip = params.get("source_ip") or context.get("source_ip", "unknown")
        
        return ActionResult(
            action_name="rate_limit",
            success=True,
            timestamp=datetime.now().isoformat(),
            details={"source_ip": source_ip, "rate_limited": True},
            error=None
        )
    
    def _action_snapshot_vm(self, params: Dict, context: Dict) -> ActionResult:
        return ActionResult(
            action_name="snapshot_vm",
            success=True,
            timestamp=datetime.now().isoformat(),
            details={"snapshot_created": True},
            error=None
        )


class CaseManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS soar_cases (
                case_id TEXT PRIMARY KEY,
                timestamp TEXT,
                title TEXT,
                description TEXT,
                status TEXT,
                priority TEXT,
                assigned_to TEXT,
                incidents TEXT,
                timeline TEXT,
                notes TEXT,
                resolution TEXT
            )
        """)
        conn.commit()
        conn.close()
    
    def create(self, title: str, description: str, priority: str = "medium",
             assigned_to: Optional[str] = None) -> Case:
        case = Case(
            case_id=hashlib.md5(f"{title}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
            timestamp=datetime.now().isoformat(),
            title=title,
            description=description,
            status="open",
            priority=priority,
            assigned_to=assigned_to,
            incidents=[],
            timeline=[{
                "timestamp": datetime.now().isoformat(),
                "action": "case_created",
                "details": "Case created"
            }],
            notes=[],
            resolution=None
        )
        
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT INTO soar_cases
            (case_id, timestamp, title, description, status, priority, assigned_to,
             incidents, timeline, notes, resolution)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            case.case_id, case.timestamp, case.title, case.description,
            case.status, case.priority, case.assigned_to,
            json.dumps(case.incidents), json.dumps(case.timeline),
            json.dumps(case.notes), case.resolution
        ))
        conn.commit()
        conn.close()
        
        return case
    
    def get_all(self, status: Optional[str] = None, limit: int = 50) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        
        query = "SELECT * FROM soar_cases WHERE 1=1"
        params = []
        
        if status:
            query += " AND status = ?"
            params.append(status)
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        cursor = conn.execute(query, params)
        
        cases = []
        for row in cursor.fetchall():
            cases.append({
                "case_id": row[0],
                "timestamp": row[1],
                "title": row[2],
                "description": row[3],
                "status": row[4],
                "priority": row[5],
                "assigned_to": row[6],
                "incidents": json.loads(row[7]) if row[7] else [],
                "timeline": json.loads(row[8]) if row[8] else [],
                "notes": json.loads(row[9]) if row[9] else [],
                "resolution": row[10]
            })
        
        conn.close()
        return cases
    
    def add_note(self, case_id: str, note: str, author: str = "system") -> Dict:
        conn = sqlite3.connect(self.db_path)
        
        cursor = conn.execute("SELECT notes FROM soar_cases WHERE case_id = ?", (case_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return {"success": False, "error": "Case not found"}
        
        notes = json.loads(row[0]) if row[0] else []
        notes.append({
            "timestamp": datetime.now().isoformat(),
            "author": author,
            "content": note
        })
        
        conn.execute("""
            UPDATE soar_cases SET notes = ? WHERE case_id = ?
        """, (json.dumps(notes), case_id))
        conn.commit()
        conn.close()
        
        return {"success": True}
    
    def add_timeline_event(self, case_id: str, action: str, details: str) -> Dict:
        conn = sqlite3.connect(self.db_path)
        
        cursor = conn.execute("SELECT timeline FROM soar_cases WHERE case_id = ?", (case_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return {"success": False, "error": "Case not found"}
        
        timeline = json.loads(row[0]) if row[0] else []
        timeline.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details
        })
        
        conn.execute("""
            UPDATE soar_cases SET timeline = ? WHERE case_id = ?
        """, (json.dumps(timeline), case_id))
        conn.commit()
        conn.close()
        
        return {"success": True}
    
    def resolve(self, case_id: str, resolution: str) -> Dict:
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            UPDATE soar_cases SET status = 'resolved', resolution = ? WHERE case_id = ?
        """, (resolution, case_id))
        conn.commit()
        conn.close()
        
        return {"success": True}


class AIAssistant:
    def __init__(self, db_path: str, settings: SettingsManager,
                 playbook_manager: PlaybookManager):
        self.db_path = db_path
        self.settings = settings
        self.playbook_manager = playbook_manager
        self._check_api_keys()
    
    def _check_api_keys(self):
        self.openai_key = os.environ.get("OPENAI_API_KEY", "")
        self.anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    
    def query_ollama(self, prompt: str) -> Dict:
        try:
            import requests
            
            response = requests.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "system": "You are a SOAR security analyst. Help design and modify security playbooks, analyze incidents, and suggest automations."
                },
                timeout=60
            )
            
            if response.status_code == 200:
                return {"success": True, "response": response.json().get("response", "")}
            else:
                return {"success": False, "error": f"Ollama error: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _query_openai(self, prompt: str) -> Dict:
        if not self.openai_key:
            return {"success": False, "error": "No OpenAI API key"}
        
        try:
            import requests
            
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openai_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4",
                    "messages": [
                        {"role": "system", "content": "You are a SOAR security analyst. Help design and modify security playbooks."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3
                },
                timeout=60
            )
            
            if response.status_code == 200:
                return {"success": True, "response": response.json()["choices"][0]["message"]["content"]}
            else:
                return {"success": False, "error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def analyze_playbook(self, playbook: Dict) -> Dict:
        if not self.settings.get("ai_assisted_modify"):
            return {"success": False, "error": "AI-assisted modification disabled"}
        
        prompt = f"""Analyze this security playbook and provide recommendations:

Name: {playbook.get('name')}
Description: {playbook.get('description')}
Trigger: {playbook.get('trigger_conditions')}
Actions: {playbook.get('actions')}
AI Options: {playbook.get('ai_options')}

Provide:
1. Effectiveness assessment
2. Missing actions
3. Potential improvements
4. Risk considerations"""

        return self.query_ollama(prompt)
    
    def suggest_playbook(self, alert_type: str, alert_data: Dict) -> Dict:
        if not self.settings.get("ai_assisted_modify"):
            return {"success": False, "error": "AI-assisted modification disabled"}
        
        prompt = f"""Design a new security playbook for this alert type:

Alert Type: {alert_type}
Alert Data: {json.dumps(alert_data, indent=2)}

Provide a playbook with:
1. name - descriptive name
2. description - what it does
3. trigger_conditions - when to run
4. actions - what to do (list of actions)
5. severity_min - minimum severity
6. auto_run - whether to run automatically"""

        result = self.query_ollama(prompt)
        
        if result.get("success"):
            return {
                "success": True,
                "suggestion": result["response"],
                "note": "Review and modify this suggestion before creating"
            }
        
        return result
    
    def chat(self, message: str) -> Dict:
        if not self.settings.get("ai_assisted_modify"):
            return {"success": False, "error": "AI assistance disabled in settings"}
        
        playbooks = self.playbook_manager.get_all()
        settings = self.settings.get_all()
        
        context = f"""Current SOAR Configuration:

Playbooks: {json.dumps([p['name'] for p in playbooks], indent=2)}
Settings: {json.dumps(settings, indent=2)}

User Question: {message}"""

        result = self.query_ollama(context + "\n\n" + message)
        
        if result.get("success"):
            return {"success": True, "response": result["response"]}
        
        if self.openai_key:
            return self._query_openai(context + "\n\n" + message)
        
        return {"success": False, "error": "No AI service available"}


class SOAREngine:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_database()
        
        self.settings = SettingsManager(db_path)
        self.incident_manager = IncidentManager(db_path)
        self.playbook_manager = PlaybookManager(db_path, self.settings)
        self.action_executor = ActionExecutor(db_path, self.settings, self.incident_manager)
        self.case_manager = CaseManager(db_path)
        self.ai_assistant = AIAssistant(db_path, self.settings, self.playbook_manager)
    
    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS soar_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                type TEXT,
                description TEXT,
                category TEXT,
                risk_level TEXT,
                updated_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS soar_blocked_ips (
                ip TEXT PRIMARY KEY,
                blocked_at TEXT,
                reason TEXT,
                source TEXT
            )
        """)
        conn.commit()
        conn.close()
    
    def get_status(self) -> Dict:
        incidents = self.incident_manager.get_all(limit=10)
        playbooks = self.playbook_manager.get_all()
        settings = self.settings.get_all()
        cases = self.case_manager.get_all(limit=10)
        
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for inc in incidents:
            sev = inc.get("severity", "low")
            if sev in severity_counts:
                severity_counts[sev] += 1
        
        return {
            "status": "active",
            "incidents": {
                "total": len(incidents),
                "by_severity": severity_counts,
                "active": len([i for i in incidents if i.get("status") != "closed"])
            },
            "playbooks": {
                "total": len(playbooks),
                "enabled": len([p for p in playbooks if p["enabled"]]),
                "auto_run": len([p for p in playbooks if p["auto_run"]])
            },
            "cases": {
                "total": len(cases),
                "open": len([c for c in cases if c.get("status") == "open"])
            },
            "settings": {
                "auto_block_ip": settings.get("auto_block_ip", {}).get("value"),
                "auto_kill_process": settings.get("auto_kill_process", {}).get("value"),
                "ai_assisted": settings.get("ai_assisted_modify", {}).get("value")
            }
        }
    
    def process_alert(self, alert_type: str, alert_data: Dict) -> Dict:
        triggered_playbooks = self.playbook_manager.trigger(alert_type, alert_data)
        
        results = []
        for playbook in triggered_playbooks:
            playbook_actions = playbook.get("actions", [])
            
            for action in playbook_actions:
                action_name = action.get("action")
                params = action.get("params", {})
                
                result = self.action_executor.execute_action(action_name, params, alert_data)
                results.append({
                    "playbook": playbook["name"],
                    "action": action_name,
                    "result": asdict(result)
                })
        
        return {
            "alert_type": alert_type,
            "playbooks_triggered": len(triggered_playbooks),
            "actions_executed": len(results),
            "results": results
        }


def handle_command(args: List[str], db_path: str) -> Dict:
    if not args:
        return {"error": "No command provided"}
    
    command = args[0]
    engine = SOAREngine(db_path)
    
    if command == "status":
        return engine.get_status()
    
    elif command == "incidents":
        status = args[1] if len(args) > 1 else None
        severity = args[2] if len(args) > 2 else None
        return {"incidents": engine.incident_manager.get_all(status, severity)}
    
    elif command == "incident":
        if len(args) < 2:
            return {"error": "Usage: incident create|update|assign|view <params>"}
        
        subcommand = args[1]
        
        if subcommand == "create":
            title = args[2] if len(args) > 2 else "New Incident"
            severity = args[3] if len(args) > 3 else "medium"
            
            incident = engine.incident_manager.create(
                title=title,
                description="Created via CLI",
                severity=severity,
                source="cli"
            )
            return {"incident": asdict(incident)}
        
        elif subcommand == "update":
            incident_id = args[2] if len(args) > 2 else ""
            status = args[3] if len(args) > 3 else "investigating"
            return engine.incident_manager.update_status(incident_id, status)
        
        elif subcommand == "assign":
            incident_id = args[2] if len(args) > 2 else ""
            analyst = args[3] if len(args) > 3 else "unassigned"
            return engine.incident_manager.assign(incident_id, analyst)
    
    elif command == "playbooks":
        return {"playbooks": engine.playbook_manager.get_all()}
    
    elif command == "playbook":
        if len(args) < 2:
            return {"error": "Usage: playbook run|create|update|delete <params>"}
        
        subcommand = args[1]
        
        if subcommand == "run":
            playbook_name = args[2] if len(args) > 2 else ""
            playbook = engine.playbook_manager.get_by_name(playbook_name)
            
            if not playbook:
                return {"error": f"Playbook not found: {playbook_name}"}
            
            return {"results": engine.action_executor.execute_playbook(playbook, {})}
        
        elif subcommand == "create":
            name = args[2] if len(args) > 2 else ""
            description = args[3] if len(args) > 3 else "Custom playbook"
            
            result = engine.playbook_manager.create(
                name=name,
                description=description,
                trigger_conditions={"type": "manual"},
                actions=[],
                severity_min="low",
                auto_run=False
            )
            return result
    
    elif command == "cases":
        status = args[1] if len(args) > 1 else None
        return {"cases": engine.case_manager.get_all(status)}
    
    elif command == "case":
        if len(args) < 2:
            return {"error": "Usage: case create|note|resolve <params>"}
        
        subcommand = args[1]
        
        if subcommand == "create":
            title = args[2] if len(args) > 2 else "New Case"
            priority = args[3] if len(args) > 3 else "medium"
            
            case = engine.case_manager.create(
                title=title,
                description="Created via CLI",
                priority=priority
            )
            return {"case": asdict(case)}
    
    elif command == "settings":
        if len(args) < 2:
            return {"settings": engine.settings.get_all()}
        
        subcommand = args[1]
        
        if subcommand == "update":
            key = args[2] if len(args) > 2 else ""
            value = args[3] if len(args) > 3 else "true"
            
            if value.lower() == "true":
                value = True
            elif value.lower() == "false":
                value = False
            elif value.isdigit():
                value = int(value)
            
            return engine.settings.update(key, value)
    
    elif command == "ai-assist":
        message = " ".join(args[1:])
        return engine.ai_assistant.chat(message)
    
    elif command == "process-alert":
        alert_type = args[1] if len(args) > 1 else "test_alert"
        alert_data = {}
        
        try:
            if len(args) > 2:
                alert_data = json.loads(args[2])
        except:
            pass
        
        return engine.process_alert(alert_type, alert_data)
    
    elif command == "blocked-ips":
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT ip, blocked_at, reason FROM soar_blocked_ips ORDER BY blocked_at DESC LIMIT 50")
        
        ips = []
        for row in cursor.fetchall():
            ips.append({
                "ip": row[0],
                "blocked_at": row[1],
                "reason": row[2]
            })
        
        conn.close()
        return {"blocked_ips": ips}
    
    elif command == "clear":
        conn = sqlite3.connect(db_path)
        conn.execute("DELETE FROM soar_incidents")
        conn.execute("DELETE FROM soar_cases")
        conn.execute("DELETE FROM soar_blocked_ips")
        conn.commit()
        conn.close()
        return {"success": True, "message": "Data cleared"}
    
    return {"error": f"Unknown command: {command}"}


def main():
    db_path = os.environ.get("SOAR_DB_PATH", os.path.join(SCRIPT_DIR, "soar_data.db"))
    
    if len(sys.argv) < 2:
        print("""
SOAR Engine - Security Orchestration, Automation & Response
==========================================

Commands:
    python soar_engine.py status                    - Show SOAR status
    python soar_engine.py incidents [status] [severity] - List incidents
    python soar_engine.py incident create <title> [severity] - Create incident
    python soar_engine.py incident update <id> <status> - Update incident
    python soar_engine.py incident assign <id> <analyst> - Assign incident
    python soar_engine.py playbooks               - List playbooks
    python soar_engine.py playbook run <name> - Run playbook
    python soar_engine.py playbook create <name> <desc> - Create playbook
    python soar_engine.py cases                - List cases
    python soar_engine.py case create <title> [priority] - Create case
    python soar_engine.py settings            - Show all settings
    python soar_engine.py settings update <key> <value> - Update setting
    python soar_engine.py ai-assist <message> - Ask AI assistant
    python soar_engine.py process-alert <type> [data] - Process alert
    python soar_engine.py blocked-ips            - Show blocked IPs

Default Playbooks:
    - Data Exfiltration Response
    - Malware Detection Response
    - Network Breach Response
    - Port Scan Detection
    - Ransomware Protection
        """)
        sys.exit(1)
    
    command = sys.argv[1]
    args = sys.argv[2:]
    
    result = handle_command([command] + args, db_path)
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()