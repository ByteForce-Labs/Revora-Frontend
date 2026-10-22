import { describe, it, expect } from 'vitest';

import * as RoleDashboardIndex from './index';

describe('RoleDashboard Public API', () => {
  it('exposes the RoleDashboard component', () => {
    expect(RoleDashboardIndex.RoleDashboard).toBeDefined();
    expect(typeof RoleDashboardIndex.RoleDashboard).toBe('function');
  });

  it('exposes the WidgetCard component', () => {
    expect(RoleDashboardIndex.WidgetCard).toBeDefined();
    expect(typeof RoleDashboardIndex.WidgetCard).toBe('function');
  });

  it('exposes the DashboardWidgetContent component', () => {
    expect(RoleDashboardIndex.DashboardWidgetContent).toBeDefined();
    expect(typeof RoleDashboardIndex.DashboardWidgetContent).toBe('function');
  });

  it('exposes onboardingHints utilities', () => {
    expect(RoleDashboardIndex.useOnboardingHint).toBeDefined();
    expect(typeof RoleDashboardIndex.useOnboardingHint).toBe('function');
    
    expect(RoleDashboardIndex.LocalStorageHintStorage).toBeDefined();
    expect(typeof RoleDashboardIndex.LocalStorageHintStorage).toBe('function'); // It's a class
    
    expect(RoleDashboardIndex.DEFAULT_HINT_STORAGE).toBeDefined();
    
    expect(RoleDashboardIndex.hintStorageKey).toBeDefined();
    expect(typeof RoleDashboardIndex.hintStorageKey).toBe('function');
  });

  it('exposes widgets configuration and utilities', () => {
    expect(RoleDashboardIndex.ROLE_CONFIGS).toBeDefined();
    expect(RoleDashboardIndex.ROLE_WIDGET_IDS).toBeDefined();
    expect(RoleDashboardIndex.INVESTOR_WIDGETS).toBeDefined();
    expect(RoleDashboardIndex.ISSUER_WIDGETS).toBeDefined();
    expect(RoleDashboardIndex.ADMIN_WIDGETS).toBeDefined();
    expect(RoleDashboardIndex.DEFAULT_WIDGET_CONTENT).toBeDefined();
    
    expect(RoleDashboardIndex.getRoleDashboardConfig).toBeDefined();
    expect(typeof RoleDashboardIndex.getRoleDashboardConfig).toBe('function');
    
    expect(RoleDashboardIndex.widgetTitle).toBeDefined();
    expect(typeof RoleDashboardIndex.widgetTitle).toBe('function');
  });

  it('exposes roleDashboard.types constants and utilities', () => {
    expect(RoleDashboardIndex.DASHBOARD_ROLES).toBeDefined();
    expect(RoleDashboardIndex.GRID_COLUMNS).toBeDefined();
    expect(RoleDashboardIndex.SLOT_SPAN).toBeDefined();
    expect(RoleDashboardIndex.WIDGET_SLOTS).toBeDefined();
    
    expect(RoleDashboardIndex.isUserRole).toBeDefined();
    expect(typeof RoleDashboardIndex.isUserRole).toBe('function');
  });
  
  it('does not expose unexpected properties', () => {
    const expectedExports = [
      'RoleDashboard',
      'WidgetCard',
      'DashboardWidgetContent',
      'useOnboardingHint',
      'LocalStorageHintStorage',
      'DEFAULT_HINT_STORAGE',
      'hintStorageKey',
      'ROLE_CONFIGS',
      'ROLE_WIDGET_IDS',
      'INVESTOR_WIDGETS',
      'ISSUER_WIDGETS',
      'ADMIN_WIDGETS',
      'DEFAULT_WIDGET_CONTENT',
      'getRoleDashboardConfig',
      'widgetTitle',
      'DASHBOARD_ROLES',
      'GRID_COLUMNS',
      'SLOT_SPAN',
      'WIDGET_SLOTS',
      'isUserRole'
    ];
    
    const actualExports = Object.keys(RoleDashboardIndex);
    
    for (const key of actualExports) {
      expect(expectedExports.includes(key)).toBe(true);
    }
    
    for (const key of expectedExports) {
      expect(actualExports.includes(key)).toBe(true);
    }
  });
});
