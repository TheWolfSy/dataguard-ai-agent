#!/usr/bin/env python3
"""
EDR Engine - Endpoint Detection & Response
Core engine for protecting the accounting software and user data.

Components:
1. Process Monitoring: Monitor processes accessing the database
2. File Integrity Monitoring (FIM): Ensure critical files haven't been tampered
3. Behavioral Analysis: Monitor behavior patterns (cmd.exe, powershell, etc.)
"""

import json
import sys
import os
import sqlite3
import hashlib
import subprocess
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import threading
import time


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


@dataclass
class ProcessEvent:
    event_id: str
    timestamp: str
    process_name: str
    process_pid: int
    parent_process: str
    command_line: str
    target_path: Optional[str]
    action: str
    severity: str
    risk_score: float


@dataclass
class FileIntegrityEvent:
    event_id: str
    timestamp: str
    file_path: str
    event_type: str
    expected_hash: str
    actual_hash: str
    status: str
    severity: str


@dataclass
class BehavioralAlert:
    alert_id: str
    timestamp: str
    process_name: str
    behavior_type: str
    description: str
    severity: str
    action: str
    details: Dict[str, Any]


CRITICAL_FILES = [
    "accounting.db",
    "settings.json", 
    "users.json",
    "data/accounts.db",
    "data/transactions.db"
]

SUSPICIOUS_PROCESSES = [
    "ransomware.exe",
    "malware.exe",
    "encryptor.exe",
    "cryptolocker.exe"
]

SUSPICIOUS_ACTIONS = [
    "cmd.exe",
    "powershell.exe",
    "wscript.exe",
    "cscript.exe",
    "mshta.exe",
    "regsvr32.exe",
    "rundll32.exe",
    "certutil.exe",
    "bitsadmin.exe",
    "wevtutil.exe"
]

PROTECTED_EXTENSIONS = [
    ".db", ".json", ".xlsx", ".csv", ".pdf"
]

ENCRYPTION_EXTENSIONS = [
    ".encrypted", ".locked", ".crypt", ". Encrypted", 
    ".aes", ".encrypted", ".lock"
]


class ProcessMonitor:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_database()
        self.white_list = {
            "python.exe", "python3.exe", "pythonw.exe",
            "dataguard.exe", "dataguard-ai.exe",
            "accounting.exe", "finance.exe",
            "explorer.exe", "system"
        }
        self.black_list = set(SUSPICIOUS_PROCESSES)
    
    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS edr_processes (
                event_id TEXT PRIMARY KEY,
                timestamp TEXT,
                process_name TEXT,
                process_pid INTEGER,
                parent_process TEXT,
                command_line TEXT,
                target_path TEXT,
                action TEXT,
                severity TEXT,
                risk_score REAL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_processes_timestamp 
            ON edr_processes(timestamp)
        """)
        conn.commit()
        conn.close()
    
    def _calculate_risk_score(self, process_name: str, action: str, 
                           target_path: Optional[str]) -> float:
        score = 0.0
        
        if process_name.lower() in [p.lower() for p in self.black_list]:
            score += 100
        
        if process_name.lower() in [p.lower() for p in SUSPICIOUS_ACTIONS]:
            score += 50
        
        if target_path:
            if any(target_path.lower().endswith(ext) 
                   for ext in PROTECTED_EXTENSIONS):
                score += 30
            if any(ext in target_path.lower() for ext in ENCRYPTION_EXTENSIONS):
                score += 80
                if action in ["write", "modify", "delete"]:
                    score += 20
        
        if action in ["delete", "modify", "encrypt"]:
            score += 25
        
        return min(score, 100)
    
    def _determine_severity(self, score: float) -> str:
        if score >= 80:
            return "critical"
        elif score >= 50:
            return "high"
        elif score >= 25:
            return "medium"
        return "low"
    
    def log_process(self, process_name: str, process_pid: int,
                  parent_process: str, command_line: str,
                  target_path: Optional[str], action: str) -> Dict:
        
        risk_score = self._calculate_risk_score(
            process_name, action, target_path
        )
        severity = self._determine_severity(risk_score)
        
        event = ProcessEvent(
            event_id=hashlib.md5(
                f"{process_name}{process_pid}{datetime.now().isoformat()}".encode()
            ).hexdigest()[:16],
            timestamp=datetime.now().isoformat(),
            process_name=process_name,
            process_pid=process_pid,
            parent_process=parent_process,
            command_line=command_line,
            target_path=target_path,
            action=action,
            severity=severity,
            risk_score=risk_score
        )
        
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT OR REPLACE INTO edr_processes
            (event_id, timestamp, process_name, process_pid, parent_process,
             command_line, target_path, action, severity, risk_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            event.event_id, event.timestamp, event.process_name,
            event.process_pid, event.parent_process, event.command_line,
            event.target_path, event.action, event.severity,
            event.risk_score
        ))
        conn.commit()
        conn.close()
        
        blocked = severity in ["critical", "high"] and risk_score >= 75
        
        return {
            "event": asdict(event),
            "blocked": blocked,
            "action_taken": "BLOCKED" if blocked else "LOGGED"
        }
    
    def check_process(self, process_name: str) -> Dict:
        process_lower = process_name.lower()
        
        if process_lower in [p.lower() for p in self.black_list]:
            return {
                "allowed": False,
                "reason": "Known malicious process",
                "severity": "critical"
            }
        
        if process_lower in [p.lower() for p in self.white_list]:
            return {
                "allowed": True,
                "reason": "Whitelisted process",
                "severity": "low"
            }
        
        return {
            "allowed": True,
            "reason": "Unknown process - monitoring",
            "severity": "medium"
        }
    
    def get_recent_events(self, limit: int = 50) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("""
            SELECT event_id, timestamp, process_name, process_pid,
                   parent_process, command_line, target_path, action,
                   severity, risk_score
            FROM edr_processes
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,))
        
        events = []
        for row in cursor.fetchall():
            events.append({
                "event_id": row[0],
                "timestamp": row[1],
                "process_name": row[2],
                "process_pid": row[3],
                "parent_process": row[4],
                "command_line": row[5],
                "target_path": row[6],
                "action": row[7],
                "severity": row[8],
                "risk_score": row[9]
            })
        
        conn.close()
        return events


class FileIntegrityMonitor:
    def __init__(self, db_path: str, monitored_paths: List[str]):
        self.db_path = db_path
        self.monitored_paths = monitored_paths
        self._init_database()
    
    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS edr_file_integrity (
                event_id TEXT PRIMARY KEY,
                timestamp TEXT,
                file_path TEXT,
                event_type TEXT,
                expected_hash TEXT,
                actual_hash TEXT,
                status TEXT,
                severity TEXT
            )
        """)
        conn.commit()
        conn.close()
    
    def _calculate_file_hash(self, file_path: str) -> Optional[str]:
        if not os.path.exists(file_path):
            return None
        
        try:
            sha256_hash = hashlib.sha256()
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception:
            return None
    
    def register_baseline(self, file_path: str) -> Dict:
        file_hash = self._calculate_file_hash(file_path)
        
        if file_hash:
            conn = sqlite3.connect(self.db_path)
            conn.execute("""
                INSERT OR REPLACE INTO edr_file_integrity
                (event_id, timestamp, file_path, event_type,
                 expected_hash, actual_hash, status, severity)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                hashlib.md5(f"{file_path}baseline".encode()).hexdigest()[:16],
                datetime.now().isoformat(),
                file_path,
                "baseline",
                file_hash,
                file_hash,
                "valid",
                "low"
            ))
            conn.commit()
            conn.close()
            
            return {
                "file_path": file_path,
                "baseline_hash": file_hash,
                "status": "registered"
            }
        
        return {
            "file_path": file_path,
            "error": "Could not calculate hash",
            "status": "failed"
        }
    
    def check_integrity(self, file_path: str) -> Dict:
        conn = sqlite3.connect(self.db_path)
        
        cursor = conn.execute("""
            SELECT event_id, timestamp, file_path, expected_hash, event_type
            FROM edr_file_integrity
            WHERE file_path = ? AND event_type = 'baseline'
            ORDER BY timestamp DESC
            LIMIT 1
        """, (file_path,))
        
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return {
                "file_path": file_path,
                "status": "not_baselined",
                "severity": "medium"
            }
        
        expected_hash = row[3]
        actual_hash = self._calculate_file_hash(file_path)
        
        if actual_hash is None:
            conn.close()
            return {
                "file_path": file_path,
                "status": "file_missing",
                "severity": "critical",
                "expected_hash": expected_hash
            }
        
        if expected_hash != actual_hash:
            status = "modified"
            severity = "high"
        else:
            status = "valid"
            severity = "low"
        
        event = FileIntegrityEvent(
            event_id=hashlib.md5(
                f"{file_path}{datetime.now().isoformat()}".encode()
            ).hexdigest()[:16],
            timestamp=datetime.now().isoformat(),
            file_path=file_path,
            event_type="check",
            expected_hash=expected_hash,
            actual_hash=actual_hash,
            status=status,
            severity=severity
        )
        
        conn.execute("""
            INSERT OR REPLACE INTO edr_file_integrity
            (event_id, timestamp, file_path, event_type,
             expected_hash, actual_hash, status, severity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            event.event_id, event.timestamp, event.file_path,
            event.event_type, event.expected_hash,
            event.actual_hash, event.status, event.severity
        ))
        conn.commit()
        conn.close()
        
        return {
            "file_path": file_path,
            "expected_hash": expected_hash,
            "actual_hash": actual_hash,
            "status": status,
            "severity": severity
        }
    
    def monitor_all(self) -> List[Dict]:
        results = []
        
        for path in self.monitored_paths:
            if os.path.exists(path):
                results.append(self.check_integrity(path))
        
        return results


class BehavioralAnalyzer:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_database()
        self.suspicious_patterns = {
            "command_injection": {
                "processes": ["cmd.exe", "powershell.exe"],
                "indicators": ["&", "|", ";", "$(", "`"],
                "severity": "high"
            },
            "script_execution": {
                "processes": ["wscript.exe", "cscript.exe", "mshta.exe"],
                "indicators": [".vbs", ".js", ".vba", ".ps1"],
                "severity": "high"
            },
            "suspicious_download": {
                "processes": ["bitsadmin.exe", "certutil.exe"],
                "indicators": ["download", "url", "http", "-f"],
                "severity": "medium"
            },
            "persistence": {
                "processes": ["regsvr32.exe", "rundll32.exe"],
                "indicators": ["-i", "/s", "AppInit"],
                "severity": "high"
            },
            "network_c2": {
                "processes": [],
                "indicators": ["4444", "5555", "7777", "31337"],
                "severity": "critical"
            }
        }
    
    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS edr_behavioral (
                alert_id TEXT PRIMARY KEY,
                timestamp TEXT,
                process_name TEXT,
                behavior_type TEXT,
                description TEXT,
                severity TEXT,
                action TEXT,
                details TEXT
            )
        """)
        conn.commit()
        conn.close()
    
    def analyze_command(self, process_name: str, command_line: str) -> Optional[Dict]:
        process_lower = process_name.lower()
        
        matched_patterns = []
        
        for pattern_name, pattern_data in self.suspicious_patterns.items():
            if process_lower in [p.lower() for p in pattern_data["processes"]]:
                matched_patterns.append({
                    "pattern": pattern_name,
                    "severity": pattern_data["severity"]
                })
            
            for indicator in pattern_data["indicators"]:
                if indicator.lower() in command_line.lower():
                    matched_patterns.append({
                        "pattern": pattern_name,
                        "severity": pattern_data["severity"],
                        "indicator": indicator
                    })
        
        if matched_patterns:
            highest_severity = max(
                p["severity"] for p in matched_patterns
            )
            severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
            highest = max(
                matched_patterns, 
                key=lambda x: severity_order.get(x["severity"], 0)
            )
            
            alert = BehavioralAlert(
                alert_id=hashlib.md5(
                    f"{process_name}{command_line}{datetime.now().isoformat()}".encode()
                ).hexdigest()[:16],
                timestamp=datetime.now().isoformat(),
                process_name=process_name,
                behavior_type=highest["pattern"],
                description=f"Suspicious behavior: {highest['pattern']} detected",
                severity=highest["severity"],
                action="BLOCK" if highest["severity"] == "critical" else "ALERT",
                details={
                    "command_line": command_line,
                    "matched_patterns": matched_patterns
                }
            )
            
            conn = sqlite3.connect(self.db_path)
            conn.execute("""
                INSERT OR REPLACE INTO edr_behavioral
                (alert_id, timestamp, process_name, behavior_type,
                 description, severity, action, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                alert.alert_id, alert.timestamp, alert.process_name,
                alert.behavior_type, alert.description, alert.severity,
                alert.action, json.dumps(alert.details)
            ))
            conn.commit()
            conn.close()
            
            result = asdict(alert)
            result["blocked"] = alert.action == "BLOCK"
            return result
        
        return None
    
    def get_recent_alerts(self, limit: int = 50) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("""
            SELECT alert_id, timestamp, process_name, behavior_type,
                   description, severity, action, details
            FROM edr_behavioral
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,))
        
        alerts = []
        for row in cursor.fetchall():
            alerts.append({
                "alert_id": row[0],
                "timestamp": row[1],
                "process_name": row[2],
                "behavior_type": row[3],
                "description": row[4],
                "severity": row[5],
                "action": row[6],
                "details": json.loads(row[7]) if row[7] else {}
            })
        
        conn.close()
        return alerts


class EDREngine:
    def __init__(self, db_path: str, monitored_files: List[str]):
        self.db_path = db_path
        self.process_monitor = ProcessMonitor(db_path)
        self.file_monitor = FileIntegrityMonitor(db_path, monitored_files)
        self.behavioral_analyzer = BehavioralAnalyzer(db_path)
        self._init_database()
    
    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS edr_alerts (
                alert_id TEXT PRIMARY KEY,
                timestamp TEXT,
                alert_type TEXT,
                severity TEXT,
                title TEXT,
                description TEXT,
                source TEXT,
                details TEXT,
                acknowledged INTEGER DEFAULT 0
            )
        """)
        conn.commit()
        conn.close()
    
    def monitor_process_access(self, process_name: str, process_pid: int,
                            parent_process: str, command_line: str,
                            target_path: Optional[str], 
                            action: str) -> Dict:
        
        check_result = self.process_monitor.check_process(process_name)
        
        if not check_result["allowed"]:
            result = {
                "allowed": False,
                "severity": "critical",
                "action": "BLOCKED",
                "reason": check_result["reason"]
            }
        else:
            result = self.process_monitor.log_process(
                process_name, process_pid, parent_process,
                command_line, target_path, action
            )
            
            if result.get("blocked"):
                self._log_alert(
                    alert_type="process_block",
                    severity=result["event"]["severity"],
                    title=f"Process Blocked: {process_name}",
                    description=f"Process {process_name} was blocked due to high risk score",
                    source="process_monitor",
                    details=result
                )
        
        return result
    
    def check_file_integrity(self, file_path: str) -> Dict:
        result = self.file_monitor.check_integrity(file_path)
        
        if result.get("status") == "modified":
            self._log_alert(
                alert_type="file_modified",
                severity=result["severity"],
                title=f"File Modified: {file_path}",
                description=f"File integrity violation detected for {file_path}",
                source="file_integrity",
                details=result
            )
        elif result.get("status") == "file_missing":
            self._log_alert(
                alert_type="file_missing",
                severity=result["severity"],
                title=f"File Missing: {file_path}",
                description=f"Critical file {file_path} is missing",
                source="file_integrity",
                details=result
            )
        
        return result
    
    def analyze_behavior(self, process_name: str, command_line: str) -> Dict:
        result = self.behavioral_analyzer.analyze_command(
            process_name, command_line
        )
        
        if result:
            self._log_alert(
                alert_type="behavioral_alert",
                severity=result["severity"],
                title=f"Behavioral Alert: {result['behavior_type']}",
                description=result["description"],
                source="behavioral_analyzer",
                details=result
            )
        
        return result or {"status": "normal", "severity": "low"}
    
    def _log_alert(self, alert_type: str, severity: str, title: str,
                 description: str, source: str, details: Dict):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT OR REPLACE INTO edr_alerts
            (alert_id, timestamp, alert_type, severity, title,
             description, source, details, acknowledged)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            hashlib.md5(
                f"{alert_type}{datetime.now().isoformat()}".encode()
            ).hexdigest()[:16],
            datetime.now().isoformat(),
            alert_type,
            severity,
            title,
            description,
            source,
            json.dumps(details),
            0
        ))
        conn.commit()
        conn.close()
    
    def get_security_summary(self) -> Dict:
        conn = sqlite3.connect(self.db_path)
        
        cursor = conn.execute("""
            SELECT severity, COUNT(*) as count
            FROM edr_alerts
            GROUP BY severity
        """)
        alerts_by_severity = {row[0]: row[1] for row in cursor.fetchall()}
        
        cursor = conn.execute("""
            SELECT alert_type, COUNT(*) as count
            FROM edr_alerts
            GROUP BY alert_type
        """)
        alerts_by_type = {row[0]: row[1] for row in cursor.fetchall()}
        
        cursor = conn.execute("SELECT COUNT(*) FROM edr_alerts WHERE acknowledged = 0")
        unacknowledged = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "alerts_by_severity": alerts_by_severity,
            "alerts_by_type": alerts_by_type,
            "unacknowledged_alerts": unacknowledged,
            "components": {
                "process_monitor": "active",
                "file_integrity": "active",
                "behavioral_analysis": "active"
            }
        }


def handle_command(args: List[str], db_path: str) -> Dict:
    if not args:
        return {"error": "No command provided"}
    
    command = args[0]
    monitored_files = [
        os.path.join(SCRIPT_DIR, f) for f in CRITICAL_FILES
        if os.path.exists(os.path.join(SCRIPT_DIR, f))
    ]
    
    engine = EDREngine(db_path, monitored_files)
    
    if command == "process":
        if len(args) < 6:
            return {"error": "Usage: process <name> <pid> <parent> <cmd> <target> <action>"}
        
        return engine.monitor_process_access(
            args[1], int(args[2]), args[3], args[4],
            args[5] if args[5] != "null" else None,
            args[6] if len(args) > 6 else "access"
        )
    
    elif command == "file-check":
        if len(args) < 2:
            return {"error": "Usage: file-check <file_path>"}
        
        return engine.check_file_integrity(args[1])
    
    elif command == "file-register":
        if len(args) < 2:
            return {"error": "Usage: file-register <file_path>"}
        
        return engine.file_monitor.register_baseline(args[1])
    
    elif command == "behavior":
        if len(args) < 3:
            return {"error": "Usage: behavior <process_name> <command_line>"}
        
        return engine.analyze_behavior(args[1], args[2])
    
    elif command == "status":
        return engine.get_security_summary()
    
    elif command == "alerts":
        limit = int(args[1]) if len(args) > 1 else 50
        
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("""
            SELECT alert_id, timestamp, alert_type, severity, title,
                   description, source, acknowledged
            FROM edr_alerts
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,))
        
        alerts = []
        for row in cursor.fetchall():
            alerts.append({
                "alert_id": row[0],
                "timestamp": row[1],
                "alert_type": row[2],
                "severity": row[3],
                "title": row[4],
                "description": row[5],
                "source": row[6],
                "acknowledged": bool(row[7])
            })
        
        conn.close()
        return {"alerts": alerts}
    
    elif command == "process-events":
        return {"events": engine.process_monitor.get_recent_events()}
    
    elif command == "behavior-alerts":
        return {"alerts": engine.behavioral_analyzer.get_recent_alerts()}
    
    elif command == "init-baseline":
        results = []
        
        for path in monitored_files:
            results.append(engine.file_monitor.register_baseline(path))
        
        return {"results": results}
    
    elif command == "full-scan":
        file_results = engine.file_monitor.monitor_all()
        
        return {
            "file_integrity": file_results,
            "summary": engine.get_security_summary()
        }
    
    return {"error": f"Unknown command: {command}"}


def main():
    db_path = os.environ.get("EDR_DB_PATH", 
                            os.path.join(SCRIPT_DIR, "edr_data.db"))
    monitored_files = [
        os.path.join(SCRIPT_DIR, f) for f in CRITICAL_FILES
    ]
    engine = EDREngine(db_path, monitored_files)
    
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)
    
    command = sys.argv[1]
    args = sys.argv[2:]
    
    result = handle_command([command] + args, db_path)
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()