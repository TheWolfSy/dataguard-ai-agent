#!/usr/bin/env python3
"""
DataGuard AI - XDR (Extended Detection & Response)
Unified CLI that integrates:
- EDR: Endpoint Detection & Response
- NDR: Network Detection & Response
- AI: Threat Intelligence & Analysis
"""

import json
import sys
import os
from typing import Dict, List, Any, Optional
from dataclasses import asdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def load_edr_module():
    from edr_engine import EDREngine, handle_command as edr_handle, CRITICAL_FILES
    return edr_engine, CRITICAL_FILES


def load_ndr_module():
    from ndr_engine import handle_command as ndr_handle
    return ndr_engine


def load_ndra_module():
    from traffic_flow import TrafficAnalyzer
    return TrafficAnalyzer


def load_ai_module():
    from threat_intel import analyze_threats, get_recommendations
    return analyze_threats, get_recommendations


class DataGuardXDR:
    def __init__(self):
        self.edr_db = os.path.join(SCRIPT_DIR, "edr_data.db")
        self.ndr_db = os.path.join(SCRIPT_DIR, "ndr_data.db")
        self.edr_engine = None
        self.ndr_engine = None
    
    def _import_edr(self):
        import edr_engine
        return edr_engine
    
    def _get_edr(self):
        if self.edr_engine is None:
            import edr_engine
            from edr_engine import CRITICAL_FILES
            
            monitored = [
                os.path.join(SCRIPT_DIR, f) for f in CRITICAL_FILES
                if os.path.exists(os.path.join(SCRIPT_DIR, f))
            ]
            self.edr_engine = edr_engine.EDREngine(self.edr_db, monitored)
        
        return self.edr_engine
    
    def _get_ndr(self):
        if self.ndr_engine is None:
            import ndr_engine
            self.ndr_engine = ndr_engine
        
        return self.ndr_engine
    
    def edr(self, args: List[str]) -> Dict:
        import edr_engine
        
        if self.edr_engine is None:
            from edr_engine import CRITICAL_FILES
            
            monitored = [
                os.path.join(SCRIPT_DIR, f) for f in CRITICAL_FILES
                if os.path.exists(os.path.join(SCRIPT_DIR, f))
            ]
            self.edr_engine = edr_engine.EDREngine(self.edr_db, monitored)
        
        return edr_engine.handle_command(args, self.edr_db)
    
    def ndr(self, args: List[str]) -> Dict:
        return self.ndr_engine.handle_command(args, self.ndr_db)
    
    def ndra(self, args: List[str]) -> Dict:
        import traffic_flow
        import sqlite3
        
        if len(args) < 2:
            return {"error": "Usage: ndra analyze <db_path>"}
        
        db_path = args[1] if len(args) > 1 else self.ndr_db
        
        if not os.path.exists(db_path):
            return {"error": f"Database not found: {db_path}"}
        
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
        
        analyzer = traffic_flow.TrafficAnalyzer()
        for flow in flows:
            analyzer.add_flow(flow)
        
        return {
            "summary": analyzer.get_summary(),
            "anomalies": analyzer.detect_anomalies(),
            "top_destinations": analyzer.get_top_destinations()
        }
    
    def ai(self, args: List[str]) -> Dict:
        import threat_intel
        
        if len(args) < 1:
            return {"error": "Usage: ai analyze|recommend"}
        
        command = args[0]
        
        if command == "analyze":
            return threat_intel.main() or {}
        elif command == "recommend":
            return threat_intel.main() or {}
        
        return {"error": f"Unknown AI command: {command}"}
    
    def status(self) -> Dict:
        import edr_engine
        import ndr_engine
        import sqlite3
        
        import edr_engine
        
        from edr_engine import CRITICAL_FILES
        
        monitored = [
            os.path.join(SCRIPT_DIR, f) for f in CRITICAL_FILES
            if os.path.exists(os.path.join(SCRIPT_DIR, f))
        ]
        
        edr = edr_engine.EDREngine(self.edr_db, monitored)
        edr_status = edr.get_security_summary()
        
        edr_conn = sqlite3.connect(self.edr_db)
        edr_cursor = edr_conn.execute("SELECT COUNT(*) FROM edr_processes")
        process_events = edr_cursor.fetchone()[0]
        edr_cursor = edr_conn.execute("SELECT COUNT(*) FROM edr_file_integrity")
        file_events = edr_cursor.fetchone()[0]
        edr_cursor = edr_conn.execute("SELECT COUNT(*) FROM edr_behavioral")
        behavioral_alerts = edr_cursor.fetchone()[0]
        edr_conn.close()
        
        ndr_summary = {
            "flows": 0,
            "alerts": 0
        }
        
        if os.path.exists(self.ndr_db):
            ndr_conn = sqlite3.connect(self.ndr_db)
            ndr_cursor = ndr_conn.execute("SELECT COUNT(*) FROM ndr_flows")
            ndr_summary["flows"] = ndr_cursor.fetchone()[0]
            ndr_cursor = ndr_conn.execute("SELECT COUNT(*) FROM ndr_alerts")
            ndr_summary["alerts"] = ndr_cursor.fetchone()[0]
            ndr_conn.close()
        
        return {
            "edr": {
                "status": "active",
                "components": {
                    "process_monitor": "active",
                    "file_integrity": "active",
                    "behavioral_analysis": "active"
                },
                "statistics": {
                    "process_events": process_events,
                    "file_events": file_events,
                    "behavioral_alerts": behavioral_alerts
                },
                "alerts_by_severity": edr_status.get("alerts_by_severity", {})
            },
            "ndr": {
                "status": "active" if ndr_summary["flows"] > 0 else "no_data",
                "statistics": ndr_summary
            },
            "ai": {
                "status": "ready",
                "model": os.environ.get("OLLAMA_MODEL", "llama3.2:latest")
            },
            "xdr_components": {
                "edr": "Endpoint Detection & Response",
                "ndr": "Network Detection & Response",
                "ai": "Threat Intelligence (LLM)"
            }
        }
    
    def full_scan(self) -> Dict:
        import edr_engine
        from edr_engine import CRITICAL_FILES
        
        from edr_engine import CRITICAL_FILES
        
        monitored = [
            os.path.join(SCRIPT_DIR, f) for f in CRITICAL_FILES
            if os.path.exists(os.path.join(SCRIPT_DIR, f))
        ]
        
        edr = edr_engine.EDREngine(self.edr_db, monitored)
        
        file_results = edr.file_monitor.monitor_all()
        
        files_altered = [f for f in file_results 
                      if f.get("status") in ["modified", "file_missing"]]
        
        behavioral_alerts = edr.behavioral_analyzer.get_recent_alerts(10)
        
        critical_behavior = [b for b in behavioral_alerts 
                         if b.get("severity") in ["high", "critical"]]
        
        ndr_alerts = []
        if os.path.exists(self.ndr_db):
            import sqlite3
            ndr_conn = sqlite3.connect(self.ndr_db)
            ndr_cursor = ndr_conn.execute("""
                SELECT alert_id, severity, title, category
                FROM ndr_alerts
                ORDER BY timestamp DESC
                LIMIT 20
            """)
            ndr_alerts = [
                {"alert_id": row[0], "severity": row[1], 
                 "title": row[2], "category": row[3]}
                for row in ndr_cursor.fetchall()
            ]
            ndr_conn.close()
        
        threat_level = "low"
        
        if files_altered or critical_behavior:
            threat_level = "high"
        
        if any(a.get("severity") == "critical" for a in ndr_alerts):
            threat_level = "critical"
        
        return {
            "threat_level": threat_level,
            "file_integrity": {
                "total_checked": len(file_results),
                "altered": len(files_altered),
                "details": files_altered
            },
            "behavioral": {
                "total_alerts": len(behavioral_alerts),
                "critical": len(critical_behavior),
                "details": critical_behavior
            },
            "network": {
                "active_alerts": len(ndr_alerts),
                "critical": len([a for a in ndr_alerts 
                               if a.get("severity") == "critical"])
            },
            "recommendations": self._get_protection_recommendations(
                threat_level, files_altered, critical_behavior, ndr_alerts
            )
        }
    
    def _get_protection_recommendations(self, threat_level: str,
                                   files: List[Dict], 
                                   behavioral: List[Dict],
                                   network: List[Dict]) -> List[str]:
        recommendations = []
        
        if threat_level == "critical":
            recommendations.append("CRITICAL: Execute incident response protocol immediately!")
            recommendations.append("Isolate affected systems from the network")
        
        if files:
            recommendations.append("Restore tampered files from verified backup")
            recommendations.append("Verify all critical files with baseline hashes")
        
        if behavioral:
            recommendations.append("Review and block suspicious processes")
            recommendations.append("Check for unauthorized persistence mechanisms")
        
        if network:
            recommendations.append("Block connection to suspicious IPs/ports")
            recommendations.append("Review network traffic for data exfiltration")
        
        if threat_level == "low":
            recommendations.append("Continue monitoring - no immediate threats detected")
            recommendations.append("Run regular integrity checks on critical files")
        
        return recommendations


def main():
    if len(sys.argv) < 2:
        print("""
DataGuard AI - XDR (Extended Detection & Response)
=================================================

Usage: python xdr_cli.py <command> [arguments]

EDR Commands (Endpoint):
  python xdr_cli.py edr process <name> <pid> <parent> <cmd> <target> <action>
  python xdr_cli.py edr file-check <path>
  python xdr_cli.py edr file-register <path>
  python xdr_cli.py edr behavior <process> <command>
  python xdr_cli.py edr status
  python xdr_cli.py edr alerts [limit]
  python xdr_cli.py edr init-baseline

NDR Commands (Network):
  python xdr_cli.py ndr flows [limit]
  python xdr_cli.py ndr alerts [limit]
  python xdr_cli.py ndr stats

XDR Commands (Unified):
  python xdr_cli.py status          - Overall security status
  python xdr_cli.py full-scan     - Full security scan
  python xdr_cli.py help         - Show this help

Examples:
  python xdr_cli.py status
  python xdr_cli.py full-scan
  python xdr_cli.py edr process python.exe 1234 explorer.exe "python app.py" data/db.sqlite read
  python xdr_cli.py edr file-check accounting.db
  python xdr_cli.py ndr flows
""")
        sys.exit(1)
    
    xdr = DataGuardXDR()
    
    command = sys.argv[1]
    args = sys.argv[2:]
    
    try:
        if command == "edr":
            result = xdr.edr(args)
        
        elif command == "ndr":
            import ndr_engine
            ndr = ndr_engine
            result = ndr.handle_command(args, xdr.ndr_db)
        
        elif command == "ndra":
            result = xdr.ndra(args)
        
        elif command == "ai":
            import threat_intel
            
            if not args:
                result = {"error": "Usage: ai analyze|recommend"}
            elif args[0] == "analyze":
                sys.argv = ["threat_intel.py", "analyze"]
                result = threat_intel.main() or {}
            elif args[0] == "recommend":
                sys.argv = ["threat_intel.py", "recommend"]
                result = threat_intel.main() or {}
            else:
                result = {"error": f"Unknown AI command: {args[0]}"}
        
        elif command == "status":
            result = xdr.status()
        
        elif command == "full-scan":
            result = xdr.full_scan()
        
        elif command == "help":
            main()
        
        else:
            result = {"error": f"Unknown command: {command}"}
        
        print(json.dumps(result, default=str))
    
    except Exception as e:
        print(json.dumps({"error": str(e), "type": "exception"}))
        sys.exit(1)


if __name__ == "__main__":
    main()