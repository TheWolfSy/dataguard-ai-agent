/**
 * useDashboardConfig — manages user-configurable dashboard layout.
 * Persists to localStorage under STORAGE_KEY.
 */

import { useState, useCallback } from 'react';

export type WidgetId =
  | 'stats'
  | 'recent-logs'
  | 'quick-actions'
  | 'policy-overview'
  | 'threat-breakdown';

export type DashboardLayout = 'comfortable' | 'compact' | 'wide';

export type AccentColor =
  | '#f97316'  // orange  (default)
  | '#38bdf8'  // sky
  | '#34d399'  // emerald
  | '#a78bfa'  // violet
  | '#f43f5e'  // rose
  | '#facc15'; // amber

export interface DashboardConfig {
  layout: DashboardLayout;
  accentColor: AccentColor;
  widgetOrder: WidgetId[];
  hiddenWidgets: WidgetId[];
  statsColumns: 2 | 4;
  showGreeting: boolean;
  compactStats: boolean;
}

const STORAGE_KEY = 'dataguard_dashboard_config';

const DEFAULT_CONFIG: DashboardConfig = {
  layout: 'comfortable',
  accentColor: '#f97316',
  widgetOrder: ['stats', 'recent-logs', 'quick-actions', 'policy-overview', 'threat-breakdown'],
  hiddenWidgets: [],
  statsColumns: 4,
  showGreeting: true,
  compactStats: false,
};

function loadConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<DashboardConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: DashboardConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function useDashboardConfig() {
  const [config, setConfigState] = useState<DashboardConfig>(loadConfig);

  const updateConfig = useCallback(<K extends keyof DashboardConfig>(
    key: K,
    value: DashboardConfig[K]
  ) => {
    setConfigState((prev) => {
      const next = { ...prev, [key]: value };
      saveConfig(next);
      return next;
    });
  }, []);

  const toggleWidget = useCallback((id: WidgetId) => {
    setConfigState((prev) => {
      const hidden = prev.hiddenWidgets.includes(id)
        ? prev.hiddenWidgets.filter((w) => w !== id)
        : [...prev.hiddenWidgets, id];
      const next = { ...prev, hiddenWidgets: hidden };
      saveConfig(next);
      return next;
    });
  }, []);

  const reorderWidgets = useCallback((newOrder: WidgetId[]) => {
    setConfigState((prev) => {
      const next = { ...prev, widgetOrder: newOrder };
      saveConfig(next);
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_CONFIG);
    saveConfig(DEFAULT_CONFIG);
  }, []);

  const isVisible = useCallback(
    (id: WidgetId) => !config.hiddenWidgets.includes(id),
    [config.hiddenWidgets]
  );

  return { config, updateConfig, toggleWidget, reorderWidgets, resetConfig, isVisible };
}
