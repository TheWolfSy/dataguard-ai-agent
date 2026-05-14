#!/usr/bin/env python3
"""
NDR Engine - Network Detection & Response
Core engine for analyzing network traffic and generating alerts.
"""

import json
import sys
import os
import sqlite3
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import hashlib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


@dataclass
class NetworkFlow:
    flow_id: str
    timestamp: str
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    bytes_sent: int
    bytes_received: int
    duration_ms: int
    status_code: Optional[int] = None
    user_agent: Optional[str] = None
    host: Optional[str] = None
    path: Optional[str] = None
    method: Optional[str] = None


@dataclass
class Alert:
    alert_id: str
    timestamp: str
    severity: str
    category: str
    title: str
    description: str
    source_ip: str
    dest_ip: str
    details: Dict[str, Any]
    acknowledged: bool = False


DETECTION_RULES = [
    {
        "id": "large_exfiltration",
        "name": "Large Data Exfiltration",
        "severity": "high",
        "category": "exfiltration",
        "condition": lambda f: f.bytes_sent > 1_000_000,
        "description": "Large outbound data transfer detected"
    },
    {
        "id": "suspicious_port",
        "name": "Suspicious Port Access",
        "severity": "medium",
        "category": "reconnaissance",
        "condition": lambda f: f.dst_port in [22, 23, 3389, 445, 139],
        "description": "Connection to sensitive port detected"
    },
    {
        "id": "rapid_connections",
        "name": "Rapid Connection Pattern",
        "severity": "medium",
        "category": "reconnaissance",
        "condition": lambda f: f.duration_ms < 100 and f.bytes_sent < 100,
        "description": "Rapid connection attempts detected"
    },
    {
        "id": "error_status",
        "name": "Error Response Pattern",
        "severity": "low",
        "category": "errors",
        "condition": lambda f: f.status_code and f.status_code >= 400,
        "description": "HTTP error response received"
    },
    {
        "id": "unknown_destination",
        "name": "Unknown Destination",
        "severity": "low",
        "category": "monitoring",
        "condition": lambda f: not f.host or f.host == "unknown",
        "description": "Connection to unknown host"
    },
]

SUSPICIOUS_IPS = {
    "known_malicious": [
        "185.141.25.68", "92.63.197.153", "45.33.32.156",
        "104.211.55.0", "192.99.144.0", "91.92.109.43"
    ],
    "suspicious_ranges": [
        "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"
    ]
}

SUSPICIOUS_PORTS = [4444, 5555, 6667, 8080, 3128, 1080]


def generate_flow_id(flow: NetworkFlow) -> str:
    data = f"{flow.timestamp}{flow.src_ip}{flow.dst_ip}{flow.dst_port}"
    return hashlib.md5(data.encode()).hexdigest()[:16]


def init_database(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ndr_flows (
            flow_id TEXT PRIMARY KEY,
            timestamp TEXT,
            src_ip TEXT,
            dst_ip TEXT,
            src_port INTEGER,
            dst_port INTEGER,
            protocol TEXT,
            bytes_sent INTEGER,
            bytes_received INTEGER,
            duration_ms INTEGER,
            status_code INTEGER,
            user_agent TEXT,
            host TEXT,
            path TEXT,
            method TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ndr_alerts (
            alert_id TEXT PRIMARY KEY,
            timestamp TEXT,
            severity TEXT,
            category TEXT,
            title TEXT,
            description TEXT,
            source_ip TEXT,
            dest_ip TEXT,
            details TEXT,
            acknowledged INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_flows_timestamp ON ndr_flows(timestamp)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON ndr_alerts(timestamp)
    """)
    conn.commit()
    return conn


def check_suspicious_ip(ip: str) -> Optional[str]:
    for category, ips in SUSPICIOUS_IPS.items():
        if ip in ips:
            return category
    return None


def analyze_flow(flow: NetworkFlow) -> List[Alert]:
    alerts = []
    
    for rule in DETECTION_RULES:
        try:
            if rule["condition"](flow):
                alert = Alert(
                    alert_id=hashlib.md5(
                        f"{rule['id']}{flow.flow_id}{datetime.now().isoformat()}".encode()
                    ).hexdigest()[:16],
                    timestamp=datetime.now().isoformat(),
                    severity=rule["severity"],
                    category=rule["category"],
                    title=rule["name"],
                    description=f"{rule['description']}: {flow.host or flow.dst_ip}:{flow.dst_port}",
                    source_ip=flow.src_ip,
                    dest_ip=flow.dst_ip,
                    details={
                        "flow_id": flow.flow_id,
                        "port": flow.dst_port,
                        "bytes_sent": flow.bytes_sent,
                        "duration_ms": flow.duration_ms
                    }
                )
                alerts.append(alert)
        except Exception:
            continue
    
    ip_check = check_suspicious_ip(flow.dst_ip)
    if ip_check:
        alert = Alert(
            alert_id=hashlib.md5(f"malip{flow.flow_id}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
            timestamp=datetime.now().isoformat(),
            severity="critical",
            category="malicious_ip",
            title="Connection to Known Malicious IP",
            description=f"Destination IP {flow.dst_ip} is flagged as {ip_check}",
            source_ip=flow.src_ip,
            dest_ip=flow.dst_ip,
            details={"ip_category": ip_check, "flow_id": flow.flow_id}
        )
        alerts.append(alert)
    
    if flow.dst_port in SUSPICIOUS_PORTS:
        alert = Alert(
            alert_id=hashlib.md5(f"sport{flow.flow_id}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
            timestamp=datetime.now().isoformat(),
            severity="high",
            category="suspicious_port",
            title="Connection to Suspicious Port",
            description=f"Connection to port {flow.dst_port} detected",
            source_ip=flow.src_ip,
            dest_ip=flow.dst_ip,
            details={"port": flow.dst_port, "flow_id": flow.flow_id}
        )
        alerts.append(alert)
    
    return alerts


def store_flow(conn: sqlite3.Connection, flow: NetworkFlow):
    conn.execute("""
        INSERT OR REPLACE INTO ndr_flows 
        (flow_id, timestamp, src_ip, dst_ip, src_port, dst_port, protocol,
         bytes_sent, bytes_received, duration_ms, status_code, user_agent, host, path, method)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        flow.flow_id, flow.timestamp, flow.src_ip, flow.dst_ip, flow.src_port,
        flow.dst_port, flow.protocol, flow.bytes_sent, flow.bytes_received,
        flow.duration_ms, flow.status_code, flow.user_agent, flow.host,
        flow.path, flow.method
    ))
    conn.commit()


def store_alert(conn: sqlite3.Connection, alert: Alert):
    conn.execute("""
        INSERT OR REPLACE INTO ndr_alerts
        (alert_id, timestamp, severity, category, title, description,
         source_ip, dest_ip, details, acknowledged)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        alert.alert_id, alert.timestamp, alert.severity, alert.category,
        alert.title, alert.description, alert.source_ip, alert.dest_ip,
        json.dumps(alert.details), 1 if alert.acknowledged else 0
    ))
    conn.commit()


def get_alerts(conn: sqlite3.Connection, limit: int = 50) -> List[Dict]:
    cursor = conn.execute("""
        SELECT alert_id, timestamp, severity, category, title, description,
               source_ip, dest_ip, details, acknowledged
        FROM ndr_alerts
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,))
    
    alerts = []
    for row in cursor.fetchall():
        alerts.append({
            "alert_id": row[0],
            "timestamp": row[1],
            "severity": row[2],
            "category": row[3],
            "title": row[4],
            "description": row[5],
            "source_ip": row[6],
            "dest_ip": row[7],
            "details": json.loads(row[8]) if row[8] else {},
            "acknowledged": bool(row[9])
        })
    return alerts


def get_flow_stats(conn: sqlite3.Connection) -> Dict:
    cursor = conn.execute("""
        SELECT 
            COUNT(*) as total_flows,
            SUM(bytes_sent) as total_bytes_sent,
            SUM(bytes_received) as total_bytes_received,
            COUNT(DISTINCT dst_ip) as unique_destinations,
            COUNT(DISTINCT dst_port) as unique_ports
        FROM ndr_flows
    """)
    row = cursor.fetchone()
    
    cursor2 = conn.execute("""
        SELECT category, COUNT(*) as count
        FROM ndr_alerts
        GROUP BY category
    """)
    alerts_by_category = {row[0]: row[1] for row in cursor2.fetchall()}
    
    return {
        "total_flows": row[0] or 0,
        "total_bytes_sent": row[1] or 0,
        "total_bytes_received": row[2] or 0,
        "unique_destinations": row[3] or 0,
        "unique_ports": row[4] or 0,
        "alerts_by_category": alerts_by_category
    }


def process_flow(flow_data: Dict, db_path: str) -> Dict:
    conn = init_database(db_path)
    
    flow = NetworkFlow(**flow_data)
    if not flow.flow_id:
        flow.flow_id = generate_flow_id(flow)
    
    store_flow(conn, flow)
    alerts = analyze_flow(flow)
    
    for alert in alerts:
        store_alert(conn, alert)
    
    conn.close()
    
    return {
        "flow_id": flow.flow_id,
        "alerts_count": len(alerts),
        "alerts": [asdict(a) for a in alerts]
    }


def get_recent_flows(db_path: str, limit: int = 20) -> List[Dict]:
    conn = init_database(db_path)
    cursor = conn.execute("""
        SELECT flow_id, timestamp, src_ip, dst_ip, dst_port, protocol,
               bytes_sent, bytes_received, duration_ms, host
        FROM ndr_flows
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,))
    
    flows = []
    for row in cursor.fetchall():
        flows.append({
            "flow_id": row[0],
            "timestamp": row[1],
            "src_ip": row[2],
            "dst_ip": row[3],
            "dst_port": row[4],
            "protocol": row[5],
            "bytes_sent": row[6],
            "bytes_received": row[7],
            "duration_ms": row[8],
            "host": row[9]
        })
    
    conn.close()
    return flows


def handle_command(args: List[str], db_path: str) -> Dict:
    if not args:
        return {"error": "No command provided"}
    
    command = args[0]
    
    if command == "analyze":
        if len(args) < 2:
            return {"error": "Missing flow data"}
        try:
            flow_data = json.loads(args[1])
            return process_flow(flow_data, db_path)
        except json.JSONDecodeError as e:
            return {"error": f"Invalid JSON: {e}"}
    
    elif command == "alerts":
        limit = int(args[1]) if len(args) > 1 else 50
        conn = init_database(db_path)
        return {"alerts": get_alerts(conn, limit)}
    
    elif command == "flows":
        limit = int(args[1]) if len(args) > 1 else 20
        return {"flows": get_recent_flows(db_path, limit)}
    
    elif command == "stats":
        conn = init_database(db_path)
        return {"stats": get_flow_stats(conn)}
    
    elif command == "clear":
        conn = init_database(db_path)
        conn.execute("DELETE FROM ndr_flows")
        conn.execute("DELETE FROM ndr_alerts")
        conn.commit()
        conn.close()
        return {"success": True, "message": "Data cleared"}
    
    return {"error": f"Unknown command: {command}"}


def main():
    db_path = os.environ.get("NDR_DB_PATH", os.path.join(SCRIPT_DIR, "ndr_data.db"))
    
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)
    
    command = sys.argv[1]
    args = sys.argv[2:]
    
    result = handle_command([command] + args, db_path)
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()