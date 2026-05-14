#!/usr/bin/env python3
"""
NDR Engine v2 - Advanced Network Detection & Response
=====================================================
Enhanced with:
- NetFlow/Netstat-based Passive Monitoring
- Data Exfiltration Detection
- AI-Powered Anomaly Detection (Ollama)
- URL/Domain Threat Analysis
- Attack Simulation Framework

Usage:
    python ndr_v2.py status
    python ndr_v2.py monitor           # Start continuous monitoring
    python ndr_v2.py analyze           # Analyze current traffic
    python ndr_v2.py exfiltrate-test   # Run Data Exfiltration simulation
    python ndr_v2.py ai-analyze        # AI-powered analysis
    python ndr_v2.py url-check <url>   # Check URL for threats
"""

import json
import sys
import os
import sqlite3
import socket
import time
import threading
import hashlib
import subprocess
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, asdict, field
from collections import defaultdict, deque
from ipaddress import ip_address, IPv4Address


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:latest")


EXFILTRATION_THRESHOLD_MB = 1
SUSPICIOUS_PORTS = [4444, 5555, 6667, 7777, 31337, 12345, 8080, 3128]
SUSPICIOUS_IPS = {
    "known_malicious": [
        "185.141.25.68", "92.63.197.153", "45.33.32.156",
        "104.211.55.0", "192.99.144.0", "91.92.109.43",
        "185.220.101.1", "45.155.205.233", "104.244.76.13"
    ],
    "tor_nodes": [
        "192.95.36.142", "23.129.64.130", "185.220.101.134"
    ]
}
SUSPICIOUS_DOMAINS = [
    "malware-domain.com", "evil-c2.net", "suspicious-tunnel.io"
]


@dataclass
class NetworkConnection:
    conn_id: str
    timestamp: str
    local_ip: str
    local_port: int
    remote_ip: str
    remote_port: int
    protocol: str
    state: str
    bytes_in: int = 0
    bytes_out: int = 0
    duration_ms: int = 0


@dataclass
class NetworkStats:
    timestamp: str
    active_connections: int
    total_bytes_in: int
    total_bytes_out: int
    unique_remote_ips: int
    unique_ports: int
    connections_by_state: Dict[str, int]
    top_talkers: List[Dict]


@dataclass  
class ExfiltrationAlert:
    alert_id: str
    timestamp: str
    severity: str
    source_ip: str
    dest_ip: str
    dest_port: int
    bytes_transferred: int
    duration_seconds: int
    pattern_type: str
    confidence: float
    description: str


@dataclass
class AnomalyResult:
    timestamp: str
    anomaly_type: str
    severity: str
    description: str
    details: Dict[str, Any]
    risk_score: float


class NetFlowCollector:
    def __init__(self):
        self.connections: List[NetworkConnection] = []
        self.connection_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.ip_stats: Dict[str, Dict] = defaultdict(lambda: {
            "bytes_sent": 0,
            "bytes_received": 0,
            "connections": 0,
            "first_seen": None,
            "last_seen": None,
            "ports": set()
        })
    
    def get_active_connections(self) -> List[Dict]:
        try:
            if os.name == 'nt':
                result = subprocess.run(
                    ['netstat', '-ano'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                return self._parse_netstat_windows(result.stdout)
            else:
                result = subprocess.run(
                    ['netstat', '-tunapl'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                return self._parse_netstat_unix(result.stdout)
        except Exception as e:
            return []
    
    def _parse_netstat_windows(self, output: str) -> List[Dict]:
        connections = []
        lines = output.strip().split('\n')
        
        for line in lines[4:]:
            if not line.strip():
                continue
            
            parts = line.split()
            if len(parts) < 4:
                continue
            
            try:
                proto = parts[0]
                local_addr = parts[1]
                remote_addr = parts[2]
                
                local_ip, local_port = self._parse_address(local_addr)
                remote_ip, remote_port = self._parse_address(remote_addr)
                
                state = "UNKNOWN"
                if len(parts) >= 4:
                    state = parts[3] if not parts[3].isdigit() else "ESTABLISHED"
                
                pid = 0
                if len(parts) >= 5 and parts[4].isdigit():
                    pid = int(parts[4])
                
                conn = NetworkConnection(
                    conn_id=hashlib.md5(f"{local_ip}{local_port}{remote_ip}{remote_port}{proto}".encode()).hexdigest()[:16],
                    timestamp=datetime.now().isoformat(),
                    local_ip=local_ip,
                    local_port=local_port,
                    remote_ip=remote_ip,
                    remote_port=remote_port,
                    protocol=proto.upper().replace('TCP', 'TCP').replace('UDP', 'UDP'),
                    state=state,
                    bytes_in=0,
                    bytes_out=0,
                    duration_ms=0
                )
                connections.append(asdict(conn))
                
            except Exception:
                continue
        
        return connections[:100]
    
    def _parse_netstat_unix(self, output: str) -> List[Dict]:
        connections = []
        lines = output.strip().split('\n')
        
        for line in lines[2:]:
            if not line.strip():
                continue
            
            parts = line.split()
            if len(parts) < 6:
                continue
            
            try:
                proto = parts[0]
                local_addr = parts[3]
                remote_addr = parts[4]
                state = parts[5]
                
                local_ip, local_port = self._parse_address(local_addr)
                remote_ip, remote_port = self._parse_address(remote_addr)
                
                conn = NetworkConnection(
                    conn_id=hashlib.md5(f"{local_ip}{local_port}{remote_ip}{remote_port}{proto}".encode()).hexdigest()[:16],
                    timestamp=datetime.now().isoformat(),
                    local_ip=local_ip,
                    local_port=local_port,
                    remote_ip=remote_ip,
                    remote_port=remote_port,
                    protocol=proto,
                    state=state,
                    bytes_in=0,
                    bytes_out=0,
                    duration_ms=0
                )
                connections.append(asdict(conn))
                
            except Exception:
                continue
        
        return connections[:100]
    
    def _parse_address(self, addr: str) -> Tuple[str, int]:
        if ':' in addr:
            parts = addr.rsplit(':', 1)
            return parts[0], int(parts[1]) if parts[1].isdigit() else 0
        return addr, 0
    
    def get_network_stats(self) -> NetworkStats:
        connections = self.get_active_connections()
        
        total_in = 0
        total_out = 0
        remote_ips = set()
        remote_ports = set()
        states = defaultdict(int)
        
        for conn in connections:
            remote_ips.add(conn.get("remote_ip", ""))
            remote_ports.add(conn.get("remote_port", 0))
            states[conn.get("state", "UNKNOWN")] += 1
            
            stats = self.ip_stats[conn.get("remote_ip", "")]
            stats["connections"] += 1
            if not stats["first_seen"]:
                stats["first_seen"] = conn.get("timestamp")
            stats["last_seen"] = conn.get("timestamp")
            stats["ports"].add(conn.get("remote_port", 0))
        
        sorted_talkers = sorted(
            self.ip_stats.items(),
            key=lambda x: x[1]["bytes_sent"] + x[1]["bytes_received"],
            reverse=True
        )[:10]
        
        top_talkers = []
        for ip, stats in sorted_talkers:
            top_talkers.append({
                "ip": ip,
                "bytes_sent": stats["bytes_sent"],
                "bytes_received": stats["bytes_received"],
                "connections": stats["connections"]
            })
        
        return NetworkStats(
            timestamp=datetime.now().isoformat(),
            active_connections=len(connections),
            total_bytes_in=total_in,
            total_bytes_out=total_out,
            unique_remote_ips=len(remote_ips),
            unique_ports=len(remote_ports),
            connections_by_state=dict(states),
            top_talkers=top_talkers
        )
    
    def collect_flows(self) -> List[Dict]:
        connections = self.get_active_connections()
        
        flows = []
        for conn in connections:
            flows.append({
                "flow_id": conn["conn_id"],
                "timestamp": conn["timestamp"],
                "src_ip": conn["local_ip"],
                "dst_ip": conn["remote_ip"],
                "src_port": conn["local_port"],
                "dst_port": conn["remote_port"],
                "protocol": conn["protocol"],
                "bytes_sent": 0,
                "bytes_received": 0,
                "duration_ms": 0,
                "status": conn.get("state", "UNKNOWN")
            })
        
        return flows


class DataExfiltrationDetector:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.baseline = self._load_baseline()
        self._init_database()
    
    def _init_database(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ndr_exfiltration (
                alert_id TEXT PRIMARY KEY,
                timestamp TEXT,
                severity TEXT,
                source_ip TEXT,
                dest_ip TEXT,
                dest_port INTEGER,
                bytes_transferred INTEGER,
                duration_seconds INTEGER,
                pattern_type TEXT,
                confidence REAL,
                description TEXT
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_exfil_timestamp ON ndr_exfiltration(timestamp)
        """)
        conn.commit()
        conn.close()
    
    def _load_baseline(self) -> Dict:
        return {
            "max_bytes_per_hour": 50_000_000,
            "max_connections_per_hour": 1000,
            "known_trusted_ips": set(),
            "suspicious_ports": SUSPICIOUS_PORTS,
            "allowed_hours": list(range(8, 20)),
            "max_unusual_ports": 3
        }
    
    def check_exfiltration(self, connections: List[Dict]) -> List[ExfiltrationAlert]:
        alerts = []
        
        ip_summary: Dict[str, Dict] = defaultdict(lambda: {
            "bytes_sent": 0,
            "bytes_received": 0,
            "connections": 0,
            "ports": set(),
            "first_seen": None,
            "last_seen": None
        })
        
        for conn in connections:
            remote_ip = conn.get("remote_ip", "")
            remote_port = conn.get("remote_port", 0)
            
            summary = ip_summary[remote_ip]
            summary["connections"] += 1
            summary["ports"].add(remote_port)
            
            if not summary["first_seen"]:
                summary["first_seen"] = conn.get("timestamp")
            summary["last_seen"] = conn.get("timestamp")
        
        for ip, data in ip_summary.items():
            if not ip or ip.startswith("127.") or ip == "0.0.0.0":
                continue
            
            for port in data["ports"]:
                if port in self.baseline["suspicious_ports"]:
                    alert = ExfiltrationAlert(
                        alert_id=hashlib.md5(f"exfil{ip}{port}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
                        timestamp=datetime.now().isoformat(),
                        severity="critical",
                        source_ip=conn.get("local_ip", ""),
                        dest_ip=ip,
                        dest_port=port,
                        bytes_transferred=0,
                        duration_seconds=0,
                        pattern_type="suspicious_port",
                        confidence=0.95,
                        description=f"Connection to suspicious port {port} - potential C2 channel"
                    )
                    alerts.append(alert)
            
            is_malicious = False
            for category, ips in SUSPICIOUS_IPS.items():
                if ip in ips:
                    alert = ExfiltrationAlert(
                        alert_id=hashlib.md5(f"malip{ip}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
                        timestamp=datetime.now().isoformat(),
                        severity="critical",
                        source_ip=conn.get("local_ip", ""),
                        dest_ip=ip,
                        dest_port=0,
                        bytes_transferred=0,
                        duration_seconds=0,
                        pattern_type=f"known_{category}",
                        confidence=0.99,
                        description=f"Connection to known {category} IP address"
                    )
                    alerts.append(alert)
                    is_malicious = True
                    break
            
            if data["connections"] > 50 and not is_malicious:
                alert = ExfiltrationAlert(
                    alert_id=hashlib.md5(f"burst{ip}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
                    timestamp=datetime.now().isoformat(),
                    severity="high",
                    source_ip=conn.get("local_ip", ""),
                    dest_ip=ip,
                    dest_port=0,
                    bytes_transferred=0,
                    duration_seconds=0,
                    pattern_type="high_connection_count",
                    confidence=0.75,
                    description=f"High connection count ({data['connections']}) to single destination"
                )
                alerts.append(alert)
            
            if len(data["ports"]) > 10:
                alert = ExfiltrationAlert(
                    alert_id=hashlib.md5(f"portscan{ip}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
                    timestamp=datetime.now().isoformat(),
                    severity="medium",
                    source_ip=conn.get("local_ip", ""),
                    dest_ip=ip,
                    dest_port=0,
                    bytes_transferred=0,
                    duration_seconds=0,
                    pattern_type="port_scan",
                    confidence=0.80,
                    description=f"Port scanning detected ({len(data['ports'])} unique ports)"
                )
                alerts.append(alert)
        
        for alert in alerts:
            self._store_alert(alert)
        
        return alerts
    
    def _store_alert(self, alert: ExfiltrationAlert):
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            INSERT OR REPLACE INTO ndr_exfiltration
            (alert_id, timestamp, severity, source_ip, dest_ip, dest_port,
             bytes_transferred, duration_seconds, pattern_type, confidence, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            alert.alert_id, alert.timestamp, alert.severity,
            alert.source_ip, alert.dest_ip, alert.dest_port,
            alert.bytes_transferred, alert.duration_seconds,
            alert.pattern_type, alert.confidence, alert.description
        ))
        conn.commit()
        conn.close()
    
    def get_recent_alerts(self, limit: int = 50) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("""
            SELECT alert_id, timestamp, severity, source_ip, dest_ip, dest_port,
                   bytes_transferred, pattern_type, confidence, description
            FROM ndr_exfiltration
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,))
        
        alerts = []
        for row in cursor.fetchall():
            alerts.append({
                "alert_id": row[0],
                "timestamp": row[1],
                "severity": row[2],
                "source_ip": row[3],
                "dest_ip": row[4],
                "dest_port": row[5],
                "bytes_transferred": row[6],
                "pattern_type": row[7],
                "confidence": row[8],
                "description": row[9]
            })
        
        conn.close()
        return alerts


class URLThreatAnalyzer:
    def __init__(self):
        self.threat_patterns = {
            "suspicious_tld": [".xyz", ".top", ".club", ".win", ".click", ".link"],
            "suspicious_keywords": ["free", "gift", "win", "prize", "claim", "update"],
            "encoding": ["base64", "urlencode", "double_encode"],
            "ip_as_domain": r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"
        }
    
    def analyze_url(self, url: str) -> Dict:
        try:
            if not url.startswith(('http://', 'https://')):
                url = 'http://' + url
            
            parsed = self._parse_url(url)
            
            result = {
                "url": url,
                "domain": parsed.get("domain", ""),
                "suspicious": False,
                "severity": "low",
                "threats": [],
                "risk_score": 0
            }
            
            if self._is_ip_address(parsed.get("domain", "")):
                result["threats"].append("IP address as domain")
                result["risk_score"] += 40
                result["suspicious"] = True
            
            tld = parsed.get("tld", "").lower()
            if tld in self.threat_patterns["suspicious_tld"]:
                result["threats"].append(f"Suspicious TLD: .{tld}")
                result["risk_score"] += 30
            
            domain_lower = parsed.get("domain", "").lower()
            for kw in self.threat_patterns["suspicious_keywords"]:
                if kw in domain_lower:
                    result["threats"].append(f"Suspicious keyword: {kw}")
                    result["risk_score"] += 20
            
            if len(url) > 200:
                result["threats"].append("Unusually long URL")
                result["risk_score"] += 15
            
            for category, domains in SUSPICIOUS_IPS.items():
                if parsed.get("domain") in [d.replace(".", "") for d in domains]:
                    result["threats"].append(f"Known {category}")
                    result["risk_score"] += 50
            
            result["risk_score"] = min(result["risk_score"], 100)
            
            if result["risk_score"] >= 70:
                result["severity"] = "critical"
            elif result["risk_score"] >= 40:
                result["severity"] = "high"
            elif result["risk_score"] >= 20:
                result["severity"] = "medium"
            
            return result
            
        except Exception as e:
            return {
                "url": url,
                "error": str(e),
                "suspicious": True,
                "severity": "high"
            }
    
    def _parse_url(self, url: str) -> Dict:
        result = {"domain": "", "tld": "", "path": "", "params": {}}
        
        match = re.search(r'://([^/]+)', url)
        if match:
            host = match.group(1)
            result["domain"] = host.split(':')[0].split('.')[-2] if '.' in host else host
            result["tld"] = host.split('.')[-1] if '.' in host else ""
        
        match = re.search(r'/(.+?)(?:\?|$)', url)
        if match:
            result["path"] = match.group(1)
        
        return result
    
    def _is_ip_address(self, domain: str) -> bool:
        try:
            socket.inet_aton(domain)
            return True
        except:
            return False


class AIAnomalyDetector:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.baseline_connections: Set[Tuple[str, int]] = set()
        self.baseline_ips: Set[str] = set()
        self.baseline_ports: Set[int] = {80, 443, 53, 22}
        self._load_baseline()
        
        self.threat_patterns = {
            "c2_ports": {4444, 5555, 6667, 7777, 31337, 12345, 9001},
            "suspicious_tlds": {"xyz", "top", "click", "link", "work", "tk", "ml", "ga", "cf", "gq"},
            "suspicious_keywords": ["free", "gift", "win", "prize", "claim", "update", "secure", "verify"],
            "data_ports": {20, 21, 22, 25, 587, 2525},
            "malware_ips": SUSPICIOUS_IPS.get("known_malicious", []),
            "tor_ports": {9050, 9051, 9150},
            "beacon_intervals": {30, 60, 120, 300, 600, 1800, 3600}
        }
        
        self.api_key = os.environ.get("OPENAI_API_KEY", "")
        self.anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    
    def _load_baseline(self):
        conn = sqlite3.connect(self.db_path)
        
        cursor = conn.execute("""
            SELECT DISTINCT dst_ip, dst_port 
            FROM ndr_flows
            LIMIT 500
        """)
        for row in cursor.fetchall():
            self.baseline_connections.add((row[0], row[1]))
            self.baseline_ips.add(row[0])
            if row[1]:
                self.baseline_ports.add(row[1])
        
        conn.close()
    
    def analyze_with_ai(self, connections: List[Dict], stats: Dict) -> List[AnomalyResult]:
        anomalies = []
        
        if not self.baseline_ips:
            return anomalies
        
        for conn in connections:
            remote_ip = conn.get("remote_ip", "")
            remote_port = conn.get("remote_port", 0)
            
            if remote_ip not in self.baseline_ips:
                anomaly = AnomalyResult(
                    timestamp=datetime.now().isoformat(),
                    anomaly_type="unknown_destination",
                    severity="medium",
                    description=f"New destination IP: {remote_ip}",
                    details={"remote_ip": remote_ip, "port": remote_port},
                    risk_score=50.0
                )
                anomalies.append(anomaly)
            
            if remote_port not in self.baseline_ports:
                anomaly = AnomalyResult(
                    timestamp=datetime.now().isoformat(),
                    anomaly_type="unusual_port",
                    severity="high",
                    description=f"Unusual port access: {remote_port}",
                    details={"remote_ip": remote_ip, "port": remote_port},
                    risk_score=70.0
                )
                anomalies.append(anomaly)
        
        current_hour = datetime.now().hour
        if current_hour < 6 or current_hour > 22:
            if len(connections) > 10:
                anomaly = AnomalyResult(
                    timestamp=datetime.now().isoformat(),
                    anomaly_type="off_hours_activity",
                    severity="medium",
                    description=f"High activity during unusual hours ({current_hour}:00)",
                    details={"connections": len(connections), "hour": current_hour},
                    risk_score=60.0
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def _local_advanced_analysis(self, connections: List[Dict], stats: NetworkStats) -> Dict:
        findings = []
        risk_factors = []
        
        for conn in connections:
            remote_ip = conn.get("remote_ip", "")
            remote_port = conn.get("remote_port", 0)
            state = conn.get("state", "")
            
            if remote_port in self.threat_patterns["c2_ports"]:
                risk_factors.append({
                    "type": "c2_beacon",
                    "severity": "critical",
                    "description": f"Connection to known C2 port {remote_port}",
                    "details": {"ip": remote_ip, "port": remote_port}
                })
            
            if remote_ip in self.threat_patterns["malware_ips"]:
                risk_factors.append({
                    "type": "known_malware_ip",
                    "severity": "critical",
                    "description": f"Connection to known malware IP",
                    "details": {"ip": remote_ip}
                })
            
            if remote_port in self.threat_patterns["tor_ports"]:
                risk_factors.append({
                    "type": "tor_connection",
                    "severity": "high",
                    "description": "Connection to Tor network port",
                    "details": {"ip": remote_ip, "port": remote_port}
                })
            
            if remote_port == 80 or remote_port == 443:
                pass
        
        conn_by_ip = defaultdict(list)
        for conn in connections:
            conn_by_ip[conn.get("remote_ip", "")].append(conn)
        
        for ip, conns in conn_by_ip.items():
            if len(conns) > 20 and ip not in ["127.0.0.1", "0.0.0.0"]:
                risk_factors.append({
                    "type": "connection_aggregation",
                    "severity": "medium",
                    "description": f"High number of connections to {ip} ({len(conns)})",
                    "details": {"ip": ip, "count": len(conns)}
                })
            
            unique_ports = set(c.get("remote_port", 0) for c in conns)
            if len(unique_ports) > 10:
                risk_factors.append({
                    "type": "port_scan",
                    "severity": "high",
                    "description": f"Port scanning detected ({len(unique_ports)} ports)",
                    "details": {"ip": ip, "ports": list(unique_ports)[:20]}
                })
        
        current_hour = datetime.now().hour
        if current_hour < 6 or current_hour > 22:
            if len(connections) > 15:
                risk_factors.append({
                    "type": "off_hours_activity",
                    "severity": "medium",
                    "description": f"Active during unusual hours ({current_hour}:00)",
                    "details": {"hour": current_hour, "connections": len(connections)}
                })
        
        unique_ips = set(c.get("remote_ip", "") for c in connections if c.get("remote_ip"))
        if len(unique_ips) > 30:
            risk_factors.append({
                "type": "lateral_movement",
                "severity": "high",
                "description": f"Multiple destination IPs ({len(unique_ips)})",
                "details": {"unique_ips": len(unique_ips)}
            })
        
        risk_score = sum({
            "critical": 100,
            "high": 60,
            "medium": 30,
            "low": 10
        }.get(r.get("severity"), 0) for r in risk_factors)
        
        risk_level = "low"
        if risk_score >= 80:
            risk_level = "critical"
        elif risk_score >= 50:
            risk_level = "high"
        elif risk_score >= 20:
            risk_level = "medium"
        
        return {
            "analysis_method": "local_intelligence",
            "risk_level": risk_level,
            "risk_score": risk_score,
            "total_connections": len(connections),
            "unique_destinations": len(unique_ips),
            "risk_factors": risk_factors,
            "recommendations": self._generate_recommendations(risk_factors, risk_level)
        }
    
    def _generate_recommendations(self, risk_factors: List[Dict], risk_level: str) -> List[str]:
        recommendations = []
        
        if risk_level == "critical":
            recommendations.append("IMMEDIATE ACTION: Isolate affected system from network")
            recommendations.append("Investigate suspicious connections immediately")
        
        for factor in risk_factors:
            if factor.get("type") == "c2_beacon":
                recommendations.append("Block outbound connection to C2 port")
            elif factor.get("type") == "known_malware_ip":
                recommendations.append("Block IP at firewall level")
            elif factor.get("type") == "tor_connection":
                recommendations.append("Review Tor usage policy")
            elif factor.get("type") == "port_scan":
                recommendations.append("Investigate potential reconnaissance")
            elif factor.get("type") == "off_hours_activity":
                recommendations.append("Verify legitimate business need")
        
        if not recommendations:
            recommendations.append("Continue monitoring - no threats detected")
            recommendations.append("Regular baseline updates recommended")
        
        return recommendations
    
    def _query_openai(self, prompt: str) -> Dict:
        if not self.api_key:
            return {"success": False, "error": "No API key configured"}
        
        try:
            import requests
            
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4",
                    "messages": [
                        {"role": "system", "content": "You are a network security analyst. Analyze traffic patterns and identify threats."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "response": result["choices"][0]["message"]["content"]
                }
            else:
                return {"success": False, "error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _query_anthropic(self, prompt: str) -> Dict:
        if not self.anthropic_key:
            return {"success": False, "error": "No API key configured"}
        
        try:
            import requests
            
            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "claude-3-opus-20240229",
                    "max_tokens": 1024,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ]
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "response": result["content"][0]["text"]
                }
            else:
                return {"success": False, "error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def query_ollama(self, prompt: str) -> Dict:
        try:
            import requests
            
            response = requests.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "system": "You are a network security analyst. Analyze network traffic patterns and identify potential security threats."
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "response": result.get("response", ""),
                    "done": result.get("done", True)
                }
            else:
                return {"success": False, "error": f"Ollama error: {response.status_code}"}
        except ImportError:
            return {"success": False, "error": "requests library not installed"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def ai_deep_analysis(self, connections: List[Dict], stats: NetworkStats) -> Dict:
        unique_ips = set(c.get("remote_ip", "") for c in connections if c.get("remote_ip"))
        
        connection_summary = f"""Network Traffic Analysis Summary:
- Active connections: {stats.active_connections}
- Unique destination IPs: {stats.unique_remote_ips}
- Unique ports: {stats.unique_ports}
- Connection states: {stats.connections_by_state}

Top destination IPs:
"""
        for t in stats.top_talkers[:5]:
            connection_summary += f"- {t['ip']}: {t['connections']} connections\n"
        
        local_result = self._local_advanced_analysis(connections, stats)
        
        ollama_result = self.query_ollama(connection_summary + "\nIdentify security threats and provide recommendations.")
        
        if ollama_result.get("success"):
            return {
                "analysis_method": "hybrid",
                "local_intelligence": local_result,
                "llm_analysis": ollama_result["response"],
                "summary": {
                    "active_connections": stats.active_connections,
                    "unique_ips": stats.unique_remote_ips,
                    "unique_ports": stats.unique_ports,
                    "risk_level": local_result["risk_level"]
                },
                "status": "analyzed"
            }
        
        if self.api_key:
            openai_result = self._query_openai(connection_summary + "\nAnalyze this traffic for security threats.")
            if openai_result.get("success"):
                return {
                    "analysis_method": "hybrid",
                    "local_intelligence": local_result,
                    "llm_analysis": openai_result["response"],
                    "summary": {
                        "active_connections": stats.active_connections,
                        "unique_ips": stats.unique_remote_ips,
                        "unique_ports": stats.unique_ports,
                        "risk_level": local_result["risk_level"]
                    },
                    "status": "analyzed"
                }
        
        if self.anthropic_key:
            anthropic_result = self._query_anthropic(connection_summary + "\nAnalyze this traffic for security threats and anomalies.")
            if anthropic_result.get("success"):
                return {
                    "analysis_method": "hybrid",
                    "local_intelligence": local_result,
                    "llm_analysis": anthropic_result["response"],
                    "summary": {
                        "active_connections": stats.active_connections,
                        "unique_ips": stats.unique_remote_ips,
                        "unique_ports": stats.unique_ports,
                        "risk_level": local_result["risk_level"]
                    },
                    "status": "analyzed"
                }
        
        return {
            "analysis_method": "local_intelligence_only",
            "analysis": local_result,
            "llm_available": False,
            "summary": {
                "active_connections": stats.active_connections,
                "unique_ips": stats.unique_remote_ips,
                "unique_ports": stats.unique_ports,
                "risk_level": local_result["risk_level"]
            },
            "status": "analyzed"
        }


class AttackSimulator:
    def __init__(self, db_path: str):
        self.db_path = db_path
    
    def simulate_data_exfiltration(self, target_ip: str = "192.168.1.100", 
                           target_port: int = 4444,
                           bytes_to_send: int = 5_000_000) -> Dict:
        connections = []
        
        for i in range(20):
            conn = {
                "conn_id": hashlib.md5(f"sim{i}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
                "timestamp": datetime.now().isoformat(),
                "local_ip": "192.168.1.10",
                "local_port": 50000 + i,
                "remote_ip": target_ip,
                "remote_port": target_port,
                "protocol": "TCP",
                "state": "ESTABLISHED",
                "bytes_sent": bytes_to_send // 20,
                "bytes_received": 0,
                "duration_ms": 500
            }
            connections.append(conn)
        
        detector = DataExfiltrationDetector(self.db_path)
        alerts = detector.check_exfiltration(connections)
        
        return {
            "simulation_type": "data_exfiltration",
            "target_ip": target_ip,
            "target_port": target_port,
            "simulated_bytes": bytes_to_send,
            "connection_count": len(connections),
            "alerts_generated": len(alerts),
            "alerts": [asdict(a) for a in alerts],
            "success": len(alerts) > 0
        }
    
    def simulate_port_scan(self, target_ip: str = "192.168.1.1",
                       start_port: int = 1, 
                       end_port: int = 100) -> Dict:
        connections = []
        
        for port in range(start_port, end_port + 1):
            conn = {
                "conn_id": hashlib.md5(f"scan{port}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
                "timestamp": datetime.now().isoformat(),
                "local_ip": "192.168.1.10",
                "local_port": 40000 + port,
                "remote_ip": target_ip,
                "remote_port": port,
                "protocol": "TCP",
                "state": "SYN_SENT",
                "bytes_sent": 0,
                "bytes_received": 0,
                "duration_ms": 10
            }
            connections.append(conn)
        
        detector = DataExfiltrationDetector(self.db_path)
        alerts = detector.check_exfiltration(connections)
        
        return {
            "simulation_type": "port_scan",
            "target_ip": target_ip,
            "port_range": f"{start_port}-{end_port}",
            "simulated_ports": end_port - start_port + 1,
            "alerts_generated": len(alerts),
            "alerts": [asdict(a) for a in alerts],
            "success": len(alerts) > 0
        }
    
    def simulate_c2_connection(self, c2_ip: str = "185.141.25.68",
                            c2_port: int = 4444) -> Dict:
        conn = {
            "conn_id": hashlib.md5(f"c2{datetime.now().isoformat()}".encode()).hexdigest()[:16],
            "timestamp": datetime.now().isoformat(),
            "local_ip": "192.168.1.10",
            "local_port": 51234,
            "remote_ip": c2_ip,
            "remote_port": c2_port,
            "protocol": "TCP",
            "state": "ESTABLISHED",
            "bytes_sent": 1024,
            "bytes_received": 2048,
            "duration_ms": 5000
        }
        
        connections = [conn]
        detector = DataExfiltrationDetector(self.db_path)
        alerts = detector.check_exfiltration(connections)
        
        return {
            "simulation_type": "c2_connection",
            "c2_ip": c2_ip,
            "c2_port": c2_port,
            "alerts_generated": len(alerts),
            "alerts": [asdict(a) for a in alerts],
            "blocked": any(a.severity == "critical" for a in alerts),
            "success": True
        }
    
    def run_all_simulations(self) -> Dict:
        results = []
        
        results.append(self.simulate_data_exfiltration())
        results.append(self.simulate_port_scan())
        results.append(self.simulate_c2_connection())
        
        return {
            "simulations": results,
            "total_alerts": sum(r.get("alerts_generated", 0) for r in results),
            "detection_rate": sum(1 for r in results if r.get("success")) / len(results) * 100
        }


def init_database(db_path: str):
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
        CREATE TABLE IF NOT EXISTS ndr_exfiltration (
            alert_id TEXT PRIMARY KEY,
            timestamp TEXT,
            severity TEXT,
            source_ip TEXT,
            dest_ip TEXT,
            dest_port INTEGER,
            bytes_transferred INTEGER,
            duration_seconds INTEGER,
            pattern_type TEXT,
            confidence REAL,
            description TEXT
        )
    """)
    conn.commit()
    return conn


def handle_command(args: List[str], db_path: str) -> Dict:
    if not args:
        return {"error": "No command provided"}
    
    command = args[0]
    conn = init_database(db_path)
    
    if command == "status":
        collector = NetFlowCollector()
        stats = collector.get_network_stats()
        
        detector = DataExfiltrationDetector(db_path)
        exfil_alerts = detector.get_recent_alerts(10)
        
        return {
            "network_stats": asdict(stats),
            "exfiltration_alerts": {
                "count": len(exfil_alerts),
                "recent": exfil_alerts[:5]
            }
        }
    
    elif command == "monitor":
        collector = NetFlowCollector()
        stats = collector.get_network_stats()
        
        flows = collector.collect_flows()
        
        for flow in flows:
            conn.execute("""
                INSERT OR REPLACE INTO ndr_flows
                (flow_id, timestamp, src_ip, dst_ip, src_port, dst_port, protocol,
                 bytes_sent, bytes_received, duration_ms, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                flow["flow_id"], flow["timestamp"], flow["src_ip"], flow["dst_ip"],
                flow["src_port"], flow["dst_port"], flow["protocol"],
                flow["bytes_sent"], flow["bytes_received"], flow["duration_ms"],
                flow.get("status", "UNKNOWN")
            ))
        conn.commit()
        
        detector = DataExfiltrationDetector(db_path)
        exfil_alerts = detector.check_exfiltration(flows)
        
        return {
            "collected": len(flows),
            "exfiltration_alerts": len(exfil_alerts),
            "flows_sample": flows[:5]
        }
    
    elif command == "analyze":
        collector = NetFlowCollector()
        connections = collector.get_active_connections()
        
        detector = DataExfiltrationDetector(db_path)
        exfil_alerts = detector.check_exfiltration(connections)
        
        stats = collector.get_network_stats()
        
        anomalies = []
        
        return {
            "connections": len(connections),
            "exfiltration_alerts": len(exfil_alerts),
            "alerts": [asdict(a) for a in exfil_alerts],
            "network_stats": asdict(stats),
            "top_destinations": [
                t for t in stats.top_talkers[:10]
            ]
        }
    
    elif command == "exfiltrate-test":
        simulator = AttackSimulator(db_path)
        return simulator.run_all_simulations()
    
    elif command == "ai-analyze":
        collector = NetFlowCollector()
        connections = collector.get_active_connections()
        stats = collector.get_network_stats()
        
        ai_detector = AIAnomalyDetector(db_path)
        return ai_detector.ai_deep_analysis(connections, stats)
    
    elif command == "url-check":
        if len(args) < 2:
            return {"error": "Usage: url-check <url>"}
        
        analyzer = URLThreatAnalyzer()
        return analyzer.analyze_url(args[1])
    
    elif command == "exfil-alerts":
        detector = DataExfiltrationDetector(db_path)
        limit = int(args[1]) if len(args) > 1 else 50
        return {"alerts": detector.get_recent_alerts(limit)}
    
    elif command == "flows":
        limit = int(args[1]) if len(args) > 1 else 20
        cursor = conn.execute("""
            SELECT flow_id, timestamp, src_ip, dst_ip, dst_port, protocol,
                   bytes_sent, bytes_received, duration_ms
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
                "duration_ms": row[8]
            })
        
        conn.close()
        return {"flows": flows}
    
    elif command == "clear":
        conn.execute("DELETE FROM ndr_flows")
        conn.execute("DELETE FROM ndr_exfiltration")
        conn.commit()
        conn.close()
        return {"success": True, "message": "Data cleared"}
    
    conn.close()
    return {"error": f"Unknown command: {command}"}


def main():
    db_path = os.environ.get("NDR_V2_DB_PATH", 
                         os.path.join(SCRIPT_DIR, "ndr_v2_data.db"))
    
    if len(sys.argv) < 2:
        print("""
NDR Engine v2 - Advanced Network Detection & Response
==============================================

Commands:
    python ndr_v2.py status          - Show network status and alerts
    python ndr_v2.py monitor       - Collect and log network flows
    python ndr_v2.py analyze      - Analyze connections for threats
    python ndr_v2.py exfil-test - Run attack simulations
    python ndr_v2.py ai-analyze  - AI-powered analysis (Ollama)
    python ndr_v2.py url-check <url> - Check URL for threats
    python ndr_v2.py exfil-alerts - Show exfiltration alerts
    python ndr_v2.py flows <n>   - Show recent flows
        """)
        sys.exit(1)
    
    command = sys.argv[1]
    args = sys.argv[2:]
    
    result = handle_command([command] + args, db_path)
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()