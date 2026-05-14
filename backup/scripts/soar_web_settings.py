#!/usr/bin/env python3
"""
SOAR Web Settings - HTTP Interface for SOAR Configuration
=============================================================
A simple web interface for managing SOAR settings.
Works with any browser and can be embedded in Tauri.

Usage:
    python soar_web_settings.py          # Run server (default: localhost:8080)
    python soar_web_settings.py 9000   # Run on custom port
"""

import json
import sys
import os
import sqlite3
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "soar_data.db")


RISK_INFO = {
    "auto_block_ip": {"risk": "high", "color": "#ff4444"},
    "auto_kill_process": {"risk": "high", "color": "#ff4444"},
    "auto_quarantine": {"risk": "medium", "color": "#ffaa44"},
    "auto_isolate_host": {"risk": "critical", "color": "#ff0000"},
    "ai_assisted_modify": {"risk": "medium", "color": "#ffaa44"},
    "require_approval": {"risk": "low", "color": "#44cc44"},
    "alert_channels": {"risk": "low", "color": "#44cc44"},
    "max_auto_response_time": {"risk": "low", "color": "#44cc44"},
    "incident_retention_days": {"risk": "low", "color": "#44cc44"}
}


def get_settings():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT key, value, type, description, category, risk_level FROM soar_settings")
    
    settings = {}
    for row in cursor.fetchall():
        key, value, setting_type, description, category, risk_level = row
        
        if setting_type == "boolean":
            value = value.lower() == "true"
        elif setting_type == "integer":
            value = int(value)
        elif setting_type == "list":
            value = json.loads(value)
        
        settings[key] = {
            "value": value,
            "type": setting_type,
            "description": description,
            "category": category,
            "risk_level": risk_level
        }
    
    conn.close()
    return settings


def update_setting(key, value):
    conn = sqlite3.connect(DB_PATH)
    
    cursor = conn.execute("SELECT type FROM soar_settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return False
    
    setting_type = row[0]
    
    if setting_type == "list":
        try:
            value = json.dumps([x.strip() for x in value.split(",")])
        except:
            value = "[]"
    else:
        value = str(value)
    
    conn.execute("""
        UPDATE soar_settings SET value = ?, updated_at = ? WHERE key = ?
    """, (value, datetime.now().isoformat(), key))
    
    conn.commit()
    conn.close()
    return True


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DataGuard SOAR - إعدادات عالية الخطورة</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #0d1117; color: #e6edf3; min-height: 100vh; }
        
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #161b22 100%); padding: 20px; border-bottom: 3px solid #ff4444; text-align: center; }
        .header h1 { color: #ff4444; font-size: 24px; margin-bottom: 10px; }
        .warning { background: rgba(255, 68, 68, 0.2); border: 1px solid #ff4444; padding: 10px; border-radius: 5px; color: #ffaa44; font-weight: bold; }
        
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        
        .setting-card { background: #161b22; border-radius: 8px; padding: 15px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between; }
        .setting-card.high-risk { border-right: 4px solid #ff4444; }
        .setting-card.medium-risk { border-right: 4px solid #ffaa44; }
        .setting-card.low-risk { border-right: 4px solid #44cc44; }
        
        .risk-indicator { width: 12px; height: 12px; border-radius: 50%; margin-left: 15px; }
        
        .setting-info { flex: 1; }
        .setting-name { font-size: 16px; font-weight: bold; color: #e6edf3; }
        .setting-desc { font-size: 12px; color: #8b949e; margin-top: 5px; }
        .setting-risk { font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 3px; margin-right: 10px; }
        
        .setting-control { min-width: 150px; }
        
        select, input[type="number"], input[type="text"] {
            padding: 8px 12px; border-radius: 5px; border: 1px solid #30363d;
            background: #0d1117; color: #e6edf3; font-size: 14px; width: 100%;
        }
        
        select:focus, input:focus { outline: none; border-color: #58a6ff; }
        
        .buttons { display: flex; gap: 10px; margin-top: 20px; padding: 20px; background: #161b22; border-radius: 8px; position: sticky; bottom: 0; }
        
        .btn { padding: 12px 24px; border: none; border-radius: 5px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
        .btn-save { background: #238636; color: white; }
        .btn-save:hover { background: #2ea043; }
        .btn-reset { background: #6e7681; color: white; }
        .btn-reset:hover { background: #8b949e; }
        .btn-export { background: #1f6feb; color: white; }
        .btn-export:hover { background: #388bfd; }
        
        .status { padding: 10px; border-radius: 5px; margin-bottom: 15px; text-align: center; }
        .status.success { background: rgba(35, 134, 54, 0.3); color: #3fb950; }
        .status.error { background: rgba(255, 68, 68, 0.3); color: #ff6b6b; }
        
        .playbooks-section { margin-top: 30px; }
        .section-title { font-size: 18px; color: #e6edf3; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #30363d; }
        
        @media (max-width: 600px) {
            .setting-card { flex-direction: column; align-items: flex-start; }
            .setting-control { width: 100%; margin-top: 10px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ DataGuard SOAR</h1>
        <div class="warning">⚠️ تحذير عالي الخطورة - التعديلات هنا تؤثر على قدرة النظام الأمنية</div>
    </div>
    
    <div class="container">
        <div id="status"></div>
        
        <div class="settings-list" id="settingsList">
            {SETTINGS_HTML}
        </div>
        
        <div class="buttons">
            <button class="btn btn-save" onclick="saveSettings()">💾 حفظ التعديلات</button>
            <button class="btn btn-reset" onclick="resetDefaults()">🔄 إعادة تعيين</button>
            <button class="btn btn-export" onclick="exportSettings()">📤 تصدير JSON</button>
        </div>
    </div>
    
    <script>
        let originalSettings = {};
        
        function init() {{
            fetch('/api/settings').then(r => r.json()).then(data => {{
                Object.keys(data).forEach(k => originalSettings[k] = JSON.stringify(data[k].value));
            }});
        }}
        
        function getRiskClass(risk) {{
            if (risk === 'critical') return 'high-risk';
            if (risk === 'high') return 'high-risk';
            if (risk === 'medium') return 'medium-risk';
            return 'low-risk';
        }}
        
        function getRiskColor(risk) {{
            if (risk === 'critical') return '#ff0000';
            if (risk === 'high') return '#ff4444';
            if (risk === 'medium') return '#ffaa44';
            return '#44cc44';
        }}
        
        function saveSettings() {{
            if (!confirm('⚠️ هل أنت متأكد؟ التعديلات تؤثر على الأمان.')) return;
            
            let data = {};
            document.querySelectorAll('[data-key]').forEach(el => {{
                data[el.dataset.key] = el.value;
            }});
            
            fetch('/api/settings', {{
                method: 'POST',
                headers: {{'Content-Type': 'application/json'}},
                body: JSON.stringify(data)
            }}).then(r => r.json()).then(result => {{
                showStatus('✅ تم الحفظ بنجاح', 'success');
            }}).catch(e => {{
                showStatus('❌ خطأ: ' + e, 'error');
            }});
        }}
        
        function resetDefaults() {{
            if (!confirm('إعادة تعيين؟')) return;
            fetch('/api/reset', {{method: 'POST'}}).then(r => r.json()).then(() => {{
                showStatus('✅ تم إعادة التعيين', 'success');
                location.reload();
            }});
        }}
        
        function exportSettings() {{
            fetch('/api/export').then(r => r.json()).then(data => {{
                const blob = new Blob([JSON.stringify(data, null, 2)], {{type: 'application/json'}});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'soar_settings_' + new Date().toISOString().split('T')[0] + '.json';
                a.click();
            }});
        }}
        
        function showStatus(msg, type) {{
            const s = document.getElementById('status');
            s.className = 'status ' + type;
            s.textContent = msg;
            setTimeout(() => s.textContent = '', 3000);
        }}
        
        init();
    </script>
</body>
</html>
"""


class SOARHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path == '/settings':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            
            settings = get_settings()
            settings_html = ""
            
            for key, config in settings.items():
                risk = config.get("risk_level", "low")
                risk_info = RISK_INFO.get(key, {})
                risk_color = risk_info.get("color", "#44cc44")
                risk_label = risk_info.get("risk", "low")
                
                control = ""
                if config["type"] == "boolean":
                    checked = "checked" if config["value"] else ""
                    control = f'<input type="checkbox" data-key="{key}" {checked}>'
                elif config["type"] == "integer":
                    control = f'<input type="number" data-key="{key}" value="{config["value"]}">'
                elif config["type"] == "list":
                    control = f'<input type="text" data-key="{key}" value="{",".join(map(str, config["value"]))}">'
                
                settings_html += f'''
                <div class="setting-card {self._get_risk_class(risk)}">
                    <div class="risk-indicator" style="background: {risk_color}"></div>
                    <div class="setting-info">
                        <div class="setting-name">{key.replace("_", " ")}</div>
                        <div class="setting-desc">{config.get("description", "")}</div>
                    </div>
                    <div class="setting-control">{control}</div>
                    <span class="setting-risk" style="background: {risk_color}20; color: {risk_color}">{risk_label}</span>
                </div>
                '''
            
            html = HTML_TEMPLATE.replace("{SETTINGS_HTML}", settings_html)
            self.wfile.write(html.encode('utf-8'))
            
        elif self.path == '/api/settings':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(get_settings()).encode('utf-8'))
            
        elif self.path == '/api/export':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "exported_at": datetime.now().isoformat(),
                "settings": get_settings()
            }, indent=2).encode('utf-8'))
            
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path == '/api/settings':
            length = int(self.headers.get('Content-Length', 0))
            data = json.loads(self.rfile.read(length).decode('utf-8'))
            
            for key, value in data.items():
                update_setting(key, value)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            
        elif self.path == '/api/reset':
            default_settings = {
                "auto_block_ip": "true",
                "auto_kill_process": "true", 
                "auto_quarantine": "true",
                "auto_isolate_host": "false",
                "ai_assisted_modify": "true",
                "require_approval": "false",
                "alert_channels": '["console", "log"]',
                "max_auto_response_time": "30",
                "incident_retention_days": "90"
            }
            
            conn = sqlite3.connect(DB_PATH)
            for key, value in default_settings.items():
                conn.execute("""
                    UPDATE soar_settings SET value = ?, updated_at = ? WHERE key = ?
                """, (value, datetime.now().isoformat(), key))
            conn.commit()
            conn.close()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
        
        else:
            super().do_POST()
    
    def _get_risk_class(self, risk):
        if risk in ["critical", "high"]:
            return "high-risk"
        elif risk == "medium":
            return "medium-risk"
        return "low-risk"
    
    def log_message(self, format, *args):
        pass


def run_server(port=8080):
    addr = ('', port)
    httpd = HTTPServer(addr, SOARHandler)
    print(f"""
[*] DataGuard SOAR Settings Server
[*] Open in browser: http://localhost:{port}/settings
[*] Press Ctrl+C to stop
""")
    httpd.serve_forever()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port)