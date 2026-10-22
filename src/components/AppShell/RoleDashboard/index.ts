// src/components/AppShell/RoleDashboard/index.ts
//
// Public entry point for the role-based dashboard variants.

export { RoleDashboard } from './RoleDashboard';
export type { RoleDashboardProps } from './RoleDashboard';

export { WidgetCard } from './WidgetCard';
export type { WidgetCardProps } from './WidgetCard';

export { DashboardWidgetContent } from './DashboardWidgetContent';

export {
  useOnboardingHint,
  LocalStorageHintStorage,
  DEFAULT_HINT_STORAGE,
  hintStorageKey,
} from './onboardingHints';
export type { DashboardHintStorage, OnboardingHintState } from './onboardingHints';

export {
  ROLE_CONFIGS,
  ROLE_WIDGET_IDS,
  INVESTOR_WIDGETS,
  ISSUER_WIDGETS,
  ADMIN_WIDGETS,
  DEFAULT_WIDGET_CONTENT,
  getRoleDashboardConfig,
  widgetTitle,
} from './widgets';

export {
  DASHBOARD_ROLES,
  GRID_COLUMNS,
  SLOT_SPAN,
  WIDGET_SLOTS,
  isUserRole,
} from './roleDashboard.types';
export type {
  UserRole,
  DashboardSlot,
  DashboardWidgetId,
  DashboardWidgetStatus,
  DashboardMetric,
  DashboardRowTone,
  DashboardWidget,
  DashboardWidgetContent as DashboardWidgetContentData,
  RoleDashboardConfig,
  RoleOnboarding,
} from './roleDashboard.types';