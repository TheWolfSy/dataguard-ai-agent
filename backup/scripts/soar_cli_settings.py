#!/usr/bin/env python3
"""
SOAR Interactive CLI Settings
==========================
Interactive command-line interface for SOAR settings.
Works in any terminal (PowerShell, CMD, etc.)
"""

import json
import sys
import os
import sqlite3
from datetime import datetime


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "soar_data.db")


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
    conn.execute("UPDATE soar_settings SET value = ?, updated_at = ? WHERE key = ?",
                (value, datetime.now().isoformat(), key))
    conn.commit()
    conn.close()
    return True


def print_banner():
    print("=" * 60)
    print("   DataGuard SOAR - Settings Configuration")
    print("=" * 60)
    print("!" * 60)
    print("  WARNING: High-risk modifications affect security")
    print("!" * 60)
    print()


def print_settings_table(settings):
    print(f"{'#':<3} {'Setting':<25} {'Value':<15} {'Risk':<10}")
    print("-" * 60)
    for i, (key, config) in enumerate(settings.items(), 1):
        value = config["value"]
        if config["type"] == "boolean":
            value = "True" if value else "False"
        elif config["type"] == "list":
            value = ", ".join(map(str, value[:2])) + ("..." if len(value) > 2 else "")
        elif config["type"] == "integer":
            value = str(value)
        risk = config["risk_level"].upper()
        risk_marker = " [HIGH RISK]" if config["risk_level"] in ["critical", "high"] else ""
        print(f"{i:<3} {key:<25} {str(value):<15} {risk:<10}{risk_marker}")


def get_setting_by_number(settings, num):
    keys = list(settings.keys())
    if 1 <= num <= len(keys):
        return keys[num - 1]
    return None


def main():
    while True:
        os.system('cls' if os.name == 'nt' else 'clear')
        print_banner()
        
        settings = get_settings()
        print_settings_table(settings)
        
        print()
        print("Options:")
        print("  [1-9]  - Edit setting by number")
        print("  [E]    - Export to JSON")
        print("  [R]    - Reset to defaults")
        print("  [Q]    - Quit")
        print()
        
        choice = input("Select option: ").strip().upper()
        
        if choice == 'Q':
            print("Goodbye!")
            break
        
        elif choice == 'R':
            confirm = input("Reset ALL settings to defaults? (y/n): ").strip().upper()
            if confirm == 'Y':
                defaults = {
                    "auto_block_ip": "true", "auto_kill_process": "true",
                    "auto_quarantine": "true", "auto_isolate_host": "false",
                    "ai_assisted_modify": "true", "require_approval": "false",
                    "alert_channels": '["console", "log"]',
                    "max_auto_response_time": "30",
                    "incident_retention_days": "90"
                }
                conn = sqlite3.connect(DB_PATH)
                for k, v in defaults.items():
                    conn.execute("UPDATE soar_settings SET value = ?, updated_at = ? WHERE key = ?",
                               (v, datetime.now().isoformat(), k))
                conn.commit()
                conn.close()
                print("[OK] Settings reset to defaults")
                input("Press Enter to continue...")
        
        elif choice == 'E':
            filename = f"soar_settings_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(os.path.join(SCRIPT_DIR, filename), "w", encoding="utf-8") as f:
                json.dump({"exported_at": datetime.now().isoformat(), "settings": settings},
                        f, indent=2, ensure_ascii=False)
            print(f"[OK] Exported to {filename}")
            input("Press Enter to continue...")
        
        elif choice.isdigit():
            num = int(choice)
            key = get_setting_by_number(settings, num)
            if key:
                config = settings[key]
                print(f"\nEditing: {key}")
                print(f"Description: {config['description']}")
                print(f"Risk Level: {config['risk_level'].upper()}")
                print(f"Current Value: {config['value']}")
                
                if config["risk_level"] in ["critical", "high"]:
                    confirm = input("WARNING: High-risk setting! Continue? (y/n): ").strip().upper()
                    if confirm != 'Y':
                        continue
                
                if config["type"] == "boolean":
                    new_val = input("New value (true/false): ").strip().lower()
                    if new_val in ["true", "false"]:
                        update_setting(key, new_val)
                        print("[OK] Updated")
                elif config["type"] == "integer":
                    try:
                        new_val = int(input("New value: ").strip())
                        update_setting(key, str(new_val))
                        print("[OK] Updated")
                    except:
                        print("[ERROR] Invalid number")
                elif config["type"] == "list":
                    new_val = input("New value (comma-separated): ").strip()
                    update_setting(key, new_val)
                    print("[OK] Updated")
                else:
                    new_val = input("New value: ").strip()
                    update_setting(key, new_val)
                    print("[OK] Updated")
                
                input("Press Enter to continue...")
            else:
                print("[ERROR] Invalid number")
                input("Press Enter to continue...")
        
        else:
            print("[ERROR] Invalid option")
            input("Press Enter to continue...")


if __name__ == "__main__":
    main()