#!/usr/bin/env python3
"""
Traffic Flow Analyzer - Network Behavior Analysis
Analyzes network traffic patterns and detects anomalies.
"""

import json
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from collections import defaultdict
import statistics


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


@dataclass
class FlowMetrics:
    ip: str
    total_flows: int = 0
    total_bytes_sent: int = 0
    total_bytes_received: int = 0
    avg_bytes_per_flow: float = 0.0
    ports_accessed: List[int] = field(default_factory=list)
    protocols_used: List[str] = field(default_factory=list)
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    flow_durations: List[int] = field(default_factory=list)


class TrafficAnalyzer:
    def __init__(self):
        self.flows: List[Dict] = []
        self.ip_metrics: Dict[str, FlowMetrics] = {}
        self.time_window_minutes = 30
    
    def add_flow(self, flow: Dict):
        self.flows.append(flow)
        self._update_metrics(flow)
    
    def _update_metrics(self, flow: Dict):
        ip = flow.get("dst_ip", "unknown")
        
        if ip not in self.ip_metrics:
            self.ip_metrics[ip] = FlowMetrics(
                ip=ip,
                first_seen=flow.get("timestamp"),
                last_seen=flow.get("timestamp")
            )
        else:
            m = self.ip_metrics[ip]
            if flow.get("timestamp", "") < (m.first_seen or flow.get("timestamp", "")):
                m.first_seen = flow.get("timestamp")
            if flow.get("timestamp", "") > (m.last_seen or flow.get("timestamp", "")):
                m.last_seen = flow.get("timestamp")
        
        m = self.ip_metrics[ip]
        m.total_flows += 1
        m.total_bytes_sent += flow.get("bytes_sent", 0)
        m.total_bytes_received += flow.get("bytes_received", 0)
        
        port = flow.get("dst_port")
        if port:
            m.ports_accessed.append(port)
        
        proto = flow.get("protocol", "unknown")
        if proto and proto not in m.protocols_used:
            m.protocols_used.append(proto)
        
        duration = flow.get("duration_ms", 0)
        if duration:
            m.flow_durations.append(duration)
        
        if m.total_flows > 0:
            m.avg_bytes_per_flow = m.total_bytes_sent / m.total_flows
    
    def analyze_destination(self, ip: str) -> Dict:
        if ip not in self.ip_metrics:
            return {"error": "IP not found"}
        
        m = self.ip_metrics[ip]
        
        return {
            "ip": m.ip,
            "total_flows": m.total_flows,
            "total_bytes_sent": m.total_bytes_sent,
            "total_bytes_received": m.total_bytes_received,
            "avg_bytes_per_flow": round(m.avg_bytes_per_flow, 2),
            "unique_ports": len(set(m.ports_accessed)),
            "ports": sorted(set(m.ports_accessed)),
            "protocols": m.protocols_used,
            "first_seen": m.first_seen,
            "last_seen": m.last_seen,
            "avg_duration_ms": statistics.mean(m.flow_durations) if m.flow_durations else 0,
            "risk_score": self._calculate_risk_score(m)
        }
    
    def _calculate_risk_score(self, m: FlowMetrics) -> float:
        score = 0.0
        
        if m.total_bytes_sent > 1_000_000:
            score += 30
        elif m.total_bytes_sent > 100_000:
            score += 15
        
        if len(set(m.ports_accessed)) > 10:
            score += 20
        elif len(set(m.ports_accessed)) > 5:
            score += 10
        
        if m.avg_bytes_per_flow > 50_000:
            score += 20
        
        suspicious_ports = {4444, 5555, 6667, 8080, 3128}
        if set(m.ports_accessed) & suspicious_ports:
            score += 25
        
        return min(score, 100)
    
    def detect_anomalies(self) -> List[Dict]:
        anomalies = []
        
        for ip, m in self.ip_metrics.items():
            if m.total_bytes_sent > 1_000_000:
                anomalies.append({
                    "type": "large_exfiltration",
                    "severity": "high",
                    "ip": ip,
                    "description": f"Large data transfer: {m.total_bytes_sent:,} bytes sent",
                    "details": {
                        "total_bytes": m.total_bytes_sent,
                        "flow_count": m.total_flows
                    }
                })
            
            if len(set(m.ports_accessed)) > 10:
                anomalies.append({
                    "type": "port_scan",
                    "severity": "medium",
                    "ip": ip,
                    "description": f"Multiple ports accessed: {len(set(m.ports_accessed))} unique ports",
                    "details": {
                        "ports": list(set(m.ports_accessed))[:20]
                    }
                })
            
            if m.avg_bytes_per_flow > 50_000:
                anomalies.append({
                    "type": "high_bandwidth",
                    "severity": "medium",
                    "ip": ip,
                    "description": f"High average bandwidth: {m.avg_bytes_per_flow:.0f} bytes/flow",
                    "details": {
                        "avg_bytes": m.avg_bytes_per_flow,
                        "total_flows": m.total_flows
                    }
                })
        
        suspicious_ports = {4444, 5555, 6667, 8080, 3128}
        for ip, m in self.ip_metrics.items():
            accessed = set(m.ports_accessed) & suspicious_ports
            if accessed:
                anomalies.append({
                    "type": "suspicious_ports",
                    "severity": "high",
                    "ip": ip,
                    "description": f"Connection to suspicious ports: {accessed}",
                    "details": {
                        "ports": list(accessed)
                    }
                })
        
        return anomalies
    
    def get_top_destinations(self, limit: int = 10, by: str = "bytes") -> List[Dict]:
        if by == "bytes":
            sorted_ips = sorted(
                self.ip_metrics.items(),
                key=lambda x: x[1].total_bytes_sent,
                reverse=True
            )
        elif by == "flows":
            sorted_ips = sorted(
                self.ip_metrics.items(),
                key=lambda x: x[1].total_flows,
                reverse=True
            )
        elif by == "ports":
            sorted_ips = sorted(
                self.ip_metrics.items(),
                key=lambda x: len(set(x[1].ports_accessed)),
                reverse=True
            )
        else:
            sorted_ips = list(self.ip_metrics.items())
        
        results = []
        for ip, m in sorted_ips[:limit]:
            results.append({
                "ip": ip,
                "total_flows": m.total_flows,
                "total_bytes_sent": m.total_bytes_sent,
                "unique_ports": len(set(m.ports_accessed)),
                "risk_score": self._calculate_risk_score(m)
            })
        
        return results
    
    def get_protocol_distribution(self) -> Dict:
        protocol_counts = defaultdict(int)
        
        for flow in self.flows:
            proto = flow.get("protocol", "unknown")
            protocol_counts[proto] += 1
        
        total = sum(protocol_counts.values())
        return {
            proto: {
                "count": count,
                "percentage": round(count / total * 100, 2) if total > 0 else 0
            }
            for proto, count in protocol_counts.items()
        }
    
    def get_summary(self) -> Dict:
        if not self.flows:
            return {
                "total_flows": 0,
                "unique_destinations": 0,
                "total_bytes": 0
            }
        
        total_bytes = sum(f.get("bytes_sent", 0) for f in self.flows)
        unique_ips = len(self.ip_metrics)
        
        return {
            "total_flows": len(self.flows),
            "unique_destinations": unique_ips,
            "total_bytes_sent": total_bytes,
            "total_bytes_received": sum(f.get("bytes_received", 0) for f in self.flows),
            "anomalies_count": len(self.detect_anomalies()),
            "top_destinations": self.get_top_destinations(5)
        }


def process_flows(flows: List[Dict]) -> Dict:
    analyzer = TrafficAnalyzer()
    
    for flow in flows:
        analyzer.add_flow(flow)
    
    return {
        "summary": analyzer.get_summary(),
        "anomalies": analyzer.detect_anomalies(),
        "top_destinations": analyzer.get_top_destinations(),
        "protocol_distribution": analyzer.get_protocol_distribution()
    }


def load_flows_from_db(db_path: str, since: Optional[str] = None) -> List[Dict]:
    import sqlite3
    
    if not os.path.exists(db_path):
        return []
    
    conn = sqlite3.connect(db_path)
    cursor = conn.execute("""
        SELECT flow_id, timestamp, src_ip, dst_ip, dst_port, protocol,
               bytes_sent, bytes_received, duration_ms, host
        FROM ndr_flows
        ORDER BY timestamp DESC
        LIMIT 500
    """)
    
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


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "analyze":
        if len(sys.argv) < 3:
            
            db_path = os.path.join(SCRIPT_DIR, "ndr_data.db")
            flows = load_flows_from_db(db_path)
        else:
            try:
                flows = json.loads(sys.argv[2])
            except json.JSONDecodeError:
                flows = load_flows_from_db(sys.argv[2])
        
        result = process_flows(flows)
        print(json.dumps(result, default=str))
    
    elif command == "ips":
        db_path = os.path.join(SCRIPT_DIR, "ndr_data.db")
        flows = load_flows_from_db(db_path)
        analyzer = TrafficAnalyzer()
        
        for flow in flows:
            analyzer.add_flow(flow)
        
        results = []
        for ip in analyzer.ip_metrics:
            results.append(analyzer.analyze_destination(ip))
        
        print(json.dumps(results, default=str))
    
    elif command == "summary":
        db_path = os.path.join(SCRIPT_DIR, "ndr_data.db")
        flows = load_flows_from_db(db_path)
        analyzer = TrafficAnalyzer()
        
        for flow in flows:
            analyzer.add_flow(flow)
        
        print(json.dumps(analyzer.get_summary(), default=str))
    
    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))


if __name__ == "__main__":
    main()