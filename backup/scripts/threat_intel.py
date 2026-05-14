#!/usr/bin/env python3
"""
Threat Intelligence - Ollama LLM Integration
Analyzes network behavior using local LLM.
"""

import json
import sys
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:latest")


SYSTEM_PROMPT = """You are a network security analyst. Analyze network traffic data and identify potential threats.
Focus on:
- Unusual data transfer patterns
- Suspicious ports and protocols
- Known malicious IP patterns
- Lateral movement indicators
- Data exfiltration signs

Respond with structured threat analysis."""


def build_flow_summary(flows: List[Dict]) -> str:
    if not flows:
        return "No traffic data available."
    
    summary_parts = []
    
    total_bytes = sum(f.get("bytes_sent", 0) for f in flows)
    unique_ips = len(set(f.get("dst_ip", "") for f in flows))
    unique_ports = len(set(f.get("dst_port", 0) for f in flows))
    
    summary_parts.append(f"Total: {len(flows)} flows, {total_bytes:,} bytes sent")
    summary_parts.append(f"Unique destinations: {unique_ips} IPs, {unique_ports} ports")
    
    port_distribution = {}
    for flow in flows:
        port = flow.get("dst_port", 0)
        port_distribution[port] = port_distribution.get(port, 0) + 1
    
    if port_distribution:
        top_ports = sorted(port_distribution.items(), key=lambda x: x[1], reverse=True)[:5]
        summary_parts.append(f"Top ports: {', '.join(f'{p}({c})' for p,c in top_ports)}")
    
    suspicious_found = []
    for flow in flows:
        port = flow.get("dst_port", 0)
        if port in [4444, 5555, 6667, 8080, 3128]:
            suspicious_found.append(f"Port {port} to {flow.get('dst_ip')}")
    
    if suspicious_found:
        summary_parts.append(f"⚠️ Suspicious: {'; '.join(suspicious_found[:3])}")
    
    if total_bytes > 100_000:
        summary_parts.append(f"⚠️ Large transfer: {total_bytes:,} bytes")
    
    return "\n".join(summary_parts)


def build_alert_summary(alerts: List[Dict]) -> str:
    if not alerts:
        return "No alerts."
    
    by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    by_category = {}
    
    for alert in alerts:
        sev = alert.get("severity", "low")
        if sev in by_severity:
            by_severity[sev] += 1
        
        cat = alert.get("category", "unknown")
        by_category[cat] = by_category.get(cat, 0) + 1
    
    parts = [f"Total alerts: {len(alerts)}"]
    for sev, count in by_severity.items():
        if count > 0:
            parts.append(f"{sev.upper()}: {count}")
    
    if by_category:
        parts.append(f"By category: {', '.join(f'{k}({v})' for k,v in by_category.items())}")
    
    return "\n".join(parts)


def query_ollama(prompt: str) -> Dict:
    try:
        import requests
        
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "system": SYSTEM_PROMPT
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
            return {
                "success": False,
                "error": f"Ollama error: {response.status_code}"
            }
    except ImportError:
        return {"success": False, "error": "requests library not installed"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def analyze_threats(flows: List[Dict], alerts: List[Dict]) -> Dict:
    flow_summary = build_flow_summary(flows)
    alert_summary = build_alert_summary(alerts)
    
    prompt = f"""Analyze the following network traffic and security alerts:

=== Traffic Summary ===
{flow_summary}

=== Alerts ===
{alert_summary}

Provide:
1. Threat assessment (Low/Medium/High/Critical)
2. Key findings (2-3 sentences)
3. Recommended actions (bullet points)"""
    
    result = query_ollama(prompt)
    
    if result.get("success"):
        return {
            "analysis": result["response"],
            "summaries": {
                "flows": flow_summary,
                "alerts": alert_summary
            }
        }
    else:
        return {
            "error": result.get("error", "Analysis failed"),
            "fallback_analysis": {
                "flow_summary": flow_summary,
                "alert_summary": alert_summary
            }
        }


def get_recommendations(flows: List[Dict], alerts: List[Dict]) -> List[str]:
    recommendations = []
    
    total_bytes = sum(f.get("bytes_sent", 0) for f in flows)
    if total_bytes > 1_000_000:
        recommendations.append("Large data transfer detected - verify legitimacy")
    
    unique_ips = set(f.get("dst_ip", "") for f in flows)
    if len(unique_ips) > 50:
        recommendations.append("High number of unique destinations - monitor for suspicious activity")
    
    for alert in alerts:
        sev = alert.get("severity", "")
        if sev in ["critical", "high"]:
            recommendations.append(f"Review {sev} alert: {alert.get('title')}")
    
    port_check = {}
    for flow in flows:
        port = flow.get("dst_port", 0)
        port_check[port] = port_check.get(port, 0) + 1
    
    suspicious = {4444, 5555, 6667, 8080, 3128}
    for port in suspicious:
        if port in port_check:
            recommendations.append(f"Connection to suspicious port {port} - investigate destination")
    
    return recommendations


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "analyze":
        db_path = os.path.join(SCRIPT_DIR, "ndr_data.db")
        
        import sqlite3
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            
            cursor = conn.execute("""
                SELECT flow_id, timestamp, src_ip, dst_ip, dst_port, protocol,
                       bytes_sent, bytes_received, duration_ms, host
                FROM ndr_flows
                ORDER BY timestamp DESC
                LIMIT 100
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
            
            cursor2 = conn.execute("""
                SELECT alert_id, timestamp, severity, category, title, description,
                       source_ip, dest_ip, details
                FROM ndr_alerts
                ORDER BY timestamp DESC
                LIMIT 50
            """)
            alerts = []
            for row in cursor2.fetchall():
                alerts.append({
                    "alert_id": row[0],
                    "timestamp": row[1],
                    "severity": row[2],
                    "category": row[3],
                    "title": row[4],
                    "description": row[5],
                    "source_ip": row[6],
                    "dest_ip": row[7],
                    "details": json.loads(row[8]) if row[8] else {}
                })
            
            conn.close()
        else:
            flows = []
            alerts = []
        
        result = analyze_threats(flows, alerts)
        print(json.dumps(result, default=str))
    
    elif command == "recommend":
        db_path = os.path.join(SCRIPT_DIR, "ndr_data.db")
        
        import sqlite3
        flows = []
        alerts = []
        
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            
            cursor = conn.execute("""
                SELECT flow_id, dst_ip, dst_port, bytes_sent
                FROM ndr_flows
                ORDER BY timestamp DESC
                LIMIT 100
            """)
            for row in cursor.fetchall():
                flows.append({
                    "flow_id": row[0],
                    "dst_ip": row[1],
                    "dst_port": row[2],
                    "bytes_sent": row[3]
                })
            
            cursor2 = conn.execute("""
                SELECT alert_id, severity, title
                FROM ndr_alerts
                ORDER BY timestamp DESC
                LIMIT 50
            """)
            for row in cursor2.fetchall():
                alerts.append({
                    "alert_id": row[0],
                    "severity": row[1],
                    "title": row[2]
                })
            
            conn.close()
        
        recommendations = get_recommendations(flows, alerts)
        print(json.dumps({"recommendations": recommendations}, default=str))
    
    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))


if __name__ == "__main__":
    main()