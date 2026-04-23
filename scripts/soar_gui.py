#!/usr/bin/env python3
"""
SOAR Settings GUI - Graphical Interface for SOAR Configuration
=============================================================
A simple GUI for managing SOAR settings that can be integrated with Tauri.

Usage:
    python soar_gui.py          # Run GUI
    python soar_gui.py apply    # Apply settings from JSON
    python soar_gui.py export  # Export current settings to JSON
"""

import json
import sys
import os
import sqlite3
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
from datetime import datetime


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


RISK_COLORS = {
    "critical": "#ff4444",
    "high": "#ff8844",
    "medium": "#ffaa44",
    "low": "#44cc44"
}


class SOARSettingsGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("DataGuard SOAR - ⚠️ HIGH RISK Settings")
        self.root.geometry("800x700")
        self.root.configure(bg="#1a1a2e")
        
        self.db_path = os.path.join(SCRIPT_DIR, "soar_data.db")
        self.settings_path = os.path.join(SCRIPT_DIR, "soar_settings.json")
        
        self.settings = {}
        self.widgets = {}
        
        self._load_settings()
        self._create_widgets()
        self._load_current_values()
    
    def _load_settings(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("SELECT key, value, type, description, category, risk_level FROM soar_settings")
        
        self.settings = {}
        for row in cursor.fetchall():
            key, value, setting_type, description, category, risk_level = row
            
            if setting_type == "boolean":
                value = value.lower() == "true"
            elif setting_type == "integer":
                value = int(value)
            elif setting_type == "list":
                value = json.loads(value)
            
            self.settings[key] = {
                "value": value,
                "type": setting_type,
                "description": description,
                "category": category,
                "risk_level": risk_level
            }
        
        conn.close()
    
    def _create_widgets(self):
        main_frame = tk.Frame(self.root, bg="#1a1a2e")
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        title_label = tk.Label(
            main_frame,
            text="⚠️ DataGuard SOAR - إعدادات عالية الخطورة",
            font=("Arial", 16, "bold"),
            bg="#1a1a2e",
            fg="#ff4444"
        )
        title_label.pack(pady=(0, 5))
        
        warning_label = tk.Label(
            main_frame,
            text="⚠️ تحذير: التعديلات هنا تؤثر على قدرة النظام على الاستجابة للتهديدات",
            font=("Arial", 10),
            bg="#1a1a2e",
            fg="#ffaa44"
        )
        warning_label.pack(pady=(0, 15))
        
        canvas = tk.Canvas(main_frame, bg="#1a1a2e", highlightthickness=0)
        scrollbar = ttk.Scrollbar(main_frame, orient="vertical", command=canvas.yview)
        self.scrollable_frame = tk.Frame(canvas, bg="#1a1a2e")
        
        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        row = 0
        for key, config in self.settings.items():
            self._create_setting_row(key, config, row)
            row += 1
        
        button_frame = tk.Frame(main_frame, bg="#1a1a2e")
        button_frame.pack(pady=20, fill=tk.X)
        
        save_btn = tk.Button(
            button_frame,
            text="💾 حفظ التعديلات",
            command=self._save_settings,
            bg="#44aa44",
            fg="white",
            font=("Arial", 12, "bold"),
            padx=20,
            pady=10
        )
        save_btn.pack(side=tk.LEFT, padx=5)
        
        reset_btn = tk.Button(
            button_frame,
            text="🔄 إعادة تعيين",
            command=self._reset_to_default,
            bg="#666666",
            fg="white",
            font=("Arial", 10),
            padx=15,
            pady=10
        )
        reset_btn.pack(side=tk.LEFT, padx=5)
        
        export_btn = tk.Button(
            button_frame,
            text="📤 تصدير",
            command=self._export_settings,
            bg="#4466aa",
            fg="white",
            font=("Arial", 10),
            padx=15,
            pady=10
        )
        export_btn.pack(side=tk.LEFT, padx=5)
        
        import_btn = tk.Button(
            button_frame,
            text="📥 استيراد",
            command=self._import_settings,
            bg="#4466aa",
            fg="white",
            font=("Arial", 10),
            padx=15,
            pady=10
        )
        import_btn.pack(side=tk.LEFT, padx=5)
        
        self.status_label = tk.Label(
            main_frame,
            text="الحالة: جاهز",
            font=("Arial", 9),
            bg="#1a1a2e",
            fg="#44cc44"
        )
        self.status_label.pack(pady=5)
    
    def _create_setting_row(self, key, config, row):
        frame = tk.Frame(self.scrollable_frame, bg="#1a1a2e")
        frame.pack(fill=tk.X, pady=3, padx=5)
        
        risk_color = RISK_COLORS.get(config.get("risk_level", "low"), "#ffffff")
        
        risk_indicator = tk.Label(
            frame,
            text="●",
            font=("Arial", 12),
            bg="#1a1a2e",
            fg=risk_color,
            width=2
        )
        risk_indicator.pack(side=tk.LEFT)
        
        name_label = tk.Label(
            frame,
            text=key.replace("_", " ").title(),
            font=("Arial", 10, "bold"),
            bg="#1a1a2e",
            fg="white",
            width=25,
            anchor="w"
        )
        name_label.pack(side=tk.LEFT, padx=5)
        
        desc_label = tk.Label(
            frame,
            text=config.get("description", ""),
            font=("Arial", 8),
            bg="#1a1a2e",
            fg="#888888",
            width=30,
            anchor="w"
        )
        desc_label.pack(side=tk.LEFT, padx=5)
        
        if config["type"] == "boolean":
            var = tk.BooleanVar(value=config.get("value", False))
            self.widgets[key] = var
            
            combo = ttk.Combobox(
                frame,
                textvariable=var,
                values=[True, False],
                state="readonly",
                width=10
            )
            combo.pack(side=tk.LEFT, padx=5)
            combo.current(0 if var.get() else 1)
            
            var.trace_add("write", lambda *args, k=key, v=var: self._on_change(k, v))
        
        elif config["type"] == "integer":
            var = tk.IntVar(value=config.get("value", 0))
            self.widgets[key] = var
            
            spinbox = ttk.Spinbox(
                frame,
                from_=0,
                to=9999,
                textvariable=var,
                width=10
            )
            spinbox.pack(side=tk.LEFT, padx=5)
        
        elif config["type"] == "list":
            var = tk.StringVar(value=", ".join(map(str, config.get("value", []))))
            self.widgets[key] = var
            
            entry = tk.Entry(
                frame,
                textvariable=var,
                width=20
            )
            entry.pack(side=tk.LEFT, padx=5)
        
        else:
            var = tk.StringVar(value=str(config.get("value", "")))
            self.widgets[key] = var
            
            entry = tk.Entry(
                frame,
                textvariable=var,
                width=20
            )
            entry.pack(side=tk.LEFT, padx=5)
        
        risk_label = tk.Label(
            frame,
            text=config.get("risk_level", "low").upper(),
            font=("Arial", 8, "bold"),
            bg="#1a1a2e",
            fg=risk_color,
            width=10
        )
        risk_label.pack(side=tk.LEFT, padx=5)
    
    def _on_change(self, key, var):
        self.status_label.config(text="تم التعدي! اضغط حفظ للتطبيق", fg="#ffaa44")
    
    def _load_current_values(self):
        for key, var in self.widgets.items():
            if key in self.settings:
                value = self.settings[key].get("value")
                if self.settings[key]["type"] == "boolean":
                    var.set(value)
                elif self.settings[key]["type"] == "integer":
                    var.set(value or 0)
                elif self.settings[key]["type"] == "list":
                    var.set(", ".join(map(str, value)))
                else:
                    var.set(value)
    
    def _save_settings(self):
        confirm = messagebox.askyesno(
            "تأكيد",
            "⚠️ هل أنت متأكد من حفظ التعديلات؟\n\nالتعديلات عالية الخطورة ستؤثر على استجابة النظام الأمنية."
        )
        
        if not confirm:
            return
        
        conn = sqlite3.connect(self.db_path)
        
        changes_made = []
        
        for key, var in self.widgets.items():
            if key not in self.settings:
                continue
            
            setting_type = self.settings[key]["type"]
            current_value = self.settings[key]["value"]
            
            if setting_type == "boolean":
                new_value = var.get()
            elif setting_type == "integer":
                try:
                    new_value = int(var.get())
                except:
                    new_value = current_value
            elif setting_type == "list":
                try:
                    new_value = [x.strip() for x in var.get().split(",")]
                except:
                    new_value = current_value
            else:
                new_value = var.get()
            
            if new_value != current_value:
                risk_level = self.settings[key]["risk_level"]
                changes_made.append({
                    "key": key,
                    "old": current_value,
                    "new": new_value,
                    "risk": risk_level
                })
                
                if setting_type == "list":
                    new_value = json.dumps(new_value)
                else:
                    new_value = str(new_value)
                
                conn.execute("""
                    UPDATE soar_settings SET value = ?, updated_at = ? WHERE key = ?
                """, (new_value, datetime.now().isoformat(), key))
        
        conn.commit()
        conn.close()
        
        if changes_made:
            msg = "✅ تم حفظ التعديلات:\n\n"
            for change in changes_made:
                msg += f"• {change['key']}: {change['old']} → {change['new']}\n"
                if change['risk'] in ["critical", "high"]:
                    msg += f"  ⚠️ خطر {change['risk']}\n"
            msg += "\nقد تؤثر هذه التعديلات على الاستجابة الأمنية."
            messagebox.showwarning("تم الحفظ", msg)
        else:
            messagebox.showinfo("المعلومات", "لم يتم إجراء أي تعديلات.")
        
        self.status_label.config(text="تم الحفظ بنجاح", fg="#44cc44")
        self._load_settings()
    
    def _reset_to_default(self):
        confirm = messagebox.askyesno(
            "إعادة تعيين",
            "⚠️ هل تريد إعادة تعيين جميع الإعدادات الافتراضية؟"
        )
        
        if not confirm:
            return
        
        conn = sqlite3.connect(self.db_path)
        
        default_settings = {
            "auto_block_ip": ("true", "boolean"),
            "auto_kill_process": ("true", "boolean"),
            "auto_quarantine": ("true", "boolean"),
            "auto_isolate_host": ("false", "boolean"),
            "ai_assisted_modify": ("true", "boolean"),
            "require_approval": ("false", "boolean"),
            "alert_channels": (json.dumps(["console", "log"]), "list"),
            "max_auto_response_time": ("30", "integer"),
            "incident_retention_days": ("90", "integer")
        }
        
        for key, (value, setting_type) in default_settings.items():
            conn.execute("""
                UPDATE soar_settings SET value = ?, updated_at = ? WHERE key = ?
            """, (value, datetime.now().isoformat(), key))
        
        conn.commit()
        conn.close()
        
        self._load_settings()
        self._load_current_values()
        
        messagebox.showinfo("تم", "تمت إعادة تعيين الإعدادات الافتراضية.")
        self.status_label.config(text="تمت إعادة التعيين", fg="#44aa44")
    
    def _export_settings(self):
        try:
            with open(self.settings_path, "w", encoding="utf-8") as f:
                json.dump({
                    "exported_at": datetime.now().isoformat(),
                    "settings": self.settings
                }, f, indent=2, ensure_ascii=False)
            
            messagebox.showinfo("تم", f"تم تصدير الإعدادات إلى:\n{self.settings_path}")
        except Exception as e:
            messagebox.showerror("خطأ", f"فشل التصدير: {e}")
    
    def _import_settings(self):
        from tkinter import filedialog
        
        filename = filedialog.askopenfilename(
            title="اختر ملف الإعدادات",
            filetypes=[("JSON", "*.json"), ("All", "*.*")]
        )
        
        if not filename:
            return
        
        try:
            with open(filename, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            if "settings" in data:
                imported = 0
                conn = sqlite3.connect(self.db_path)
                
                for key, config in data["settings"].items():
                    value = config.get("value")
                    setting_type = config.get("type", "string")
                    
                    if setting_type == "list":
                        value = json.dumps(value)
                    else:
                        value = str(value)
                    
                    conn.execute("""
                        UPDATE soar_settings SET value = ?, updated_at = ? WHERE key = ?
                    """, (value, datetime.now().isoformat(), key))
                    imported += 1
                
                conn.commit()
                conn.close()
                
                self._load_settings()
                self._load_current_values()
                
                messagebox.showinfo("تم", f"تم استيراد {imported} إعداد.")
                self.status_label.config(text=f"تم استيراد {imported} إعداد", fg="#44aa44")
        
        except Exception as e:
            messagebox.showerror("خطأ", f"فشل الاستيراد: {e}")


def run_gui():
    root = tk.Tk()
    app = SOARSettingsGUI(root)
    root.mainloop()


def export_settings():
    db_path = os.path.join(SCRIPT_DIR, "soar_data.db")
    settings_path = os.path.join(SCRIPT_DIR, "soar_settings.json")
    
    conn = sqlite3.connect(db_path)
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
    
    with open(settings_path, "w", encoding="utf-8") as f:
        json.dump({
            "exported_at": datetime.now().isoformat(),
            "settings": settings
        }, f, indent=2, ensure_ascii=False)
    
    print(f"Settings exported to {settings_path}")


def apply_settings():
    db_path = os.path.join(SCRIPT_DIR, "soar_data.db")
    settings_path = os.path.join(SCRIPT_DIR, "soar_settings.json")
    
    if not os.path.exists(settings_path):
        print(f"Settings file not found: {settings_path}")
        return
    
    with open(settings_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if "settings" not in data:
        print("No settings found in file")
        return
    
    conn = sqlite3.connect(db_path)
    
    for key, config in data["settings"].items():
        value = config.get("value")
        setting_type = config.get("type", "string")
        
        if setting_type == "list":
            value = json.dumps(value)
        else:
            value = str(value)
        
        conn.execute("""
            UPDATE soar_settings SET value = ?, updated_at = ? WHERE key = ?
        """, (value, datetime.now().isoformat(), key))
    
    conn.commit()
    conn.close()
    
    print("Settings applied successfully")


def main():
    if len(sys.argv) < 2:
        run_gui()
    else:
        command = sys.argv[1]
        
        if command == "export":
            export_settings()
        elif command == "apply":
            apply_settings()
        elif command == "gui":
            run_gui()
        else:
            print("""
SOAR Settings GUI
=================

Usage:
    python soar_gui.py           - Run GUI
    python soar_gui.py export    - Export settings to JSON
    python soar_gui.py apply     - Apply settings from JSON
            """)


if __name__ == "__main__":
    main()