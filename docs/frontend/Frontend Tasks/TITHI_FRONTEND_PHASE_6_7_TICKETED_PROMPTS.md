# Tithi Frontend Phase 6 & 7 Ticketed Prompts

## Phase 6 — Notifications, Gift Cards, Loyalty, Automations

### T24 — Notifications Admin (List / Create / Update)

You are implementing Task T24: Notifications Admin from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context
- **Brief §5.1**: "Business owners define the messages customers receive for a booking. Enforce max '3 per booking': 1 confirmation + up to 2 reminders."
- **CP §NotificationTemplate**: Interface with channel, content, variables, required_variables, quiet_hours, enabled fields.
- **Brief §5.5**: "Notification settings (timing, content, email templates) - max 3 per booking"

This task covers the admin interface for creating and managing notification templates with strict limits and placeholder validation.

#### 1. Deliverables
- **Code**: 
  - `/src/pages/admin/notifications/NotificationsPage.tsx`
  - `/src/components/notifications/NotificationTemplateEditor.tsx`
  - `/src/components/notifications/NotificationTemplateList.tsx`
  - `/src/hooks/useNotificationTemplates.ts`
- **Contracts**: 
  - `NotificationTemplate` interface (from CP)
  - `NotificationTemplateForm` type
  - `NotificationValidationResult` type
- **Tests**: 
  - `NotificationsPage.test.tsx`
  - `NotificationTemplateEditor.test.tsx`
  - `useNotificationTemplates.test.ts`

#### 2. Constraints
- **Cap Enforcement**: Exactly 1 "confirmation" template, max 2 "reminder" templates
- **Placeholder Validation**: All required_variables must appear in content
- **Quiet Hours**: Preview/send blocked if violates configured hours
- **A11y**: WCAG 2.1 AA, keyboard navigation, screen reader support
- **Performance**: Table first paint ≤ 2.0s p75, editor open ≤ 150ms median

#### 3. Inputs → Outputs
- **Inputs**: 
  - `GET /api/v1/notifications/templates` (list)
  - `POST /api/v1/notifications/templates` (create)
  - `PUT /api/v1/notifications/templates/{id}` (update)
  - `POST /api/v1/notifications/preview` (preview)
- **Outputs**: 
  - Notification templates table with CRUD operations
  - Rich text editor with placeholder validation
  - Preview modal with test send functionality
  - Cap enforcement UI with clear messaging

#### 4. Validation & Testing
- **AC**: Cap enforced, placeholder validation, quiet hours respected, test send works
- **Unit Tests**: Template CRUD, validation logic, cap enforcement
- **E2E**: Create template, exceed cap, validate placeholders, send test
- **Manual QA**: Keyboard navigation, screen reader, mobile responsive

#### 5. Dependencies
- **DependsOn**: T01 (API client), T02 (routing), T03 (design tokens)
- **Exposes**: Notification template management for T40 (event hooks)

#### 6. Executive Rationale
Critical for business communication control. Wrong implementation could lead to notification spam or missing communications. Rollback: disable all templates, restore from backup.

#### 7. North-Star Invariants
- Never exceed 3 templates per booking
- All placeholders must be validated before save
- Quiet hours must be respected in all operations

#### 8. Schema/DTO Freeze Note
```typescript
interface NotificationTemplate {
  id: string;
  tenant_id: string;
  name: string;
  channel: 'email' | 'sms' | 'push';
  subject?: string;
  content: string;
  variables?: Record<string, any>;
  required_variables?: string[];
  trigger_event?: string;
  category?: string;
  is_active: boolean;
}
```
SHA-256: `a1b2c3d4e5f6...` (canonical JSON hash)

#### 9. Observability Hooks
- `notifications.template_update` (old→new diff size)
- `notifications.preview_sent` (channel, length)
- `notifications.quiet_hours_violation` (window id)

#### 10. Error Model Enforcement
- **Validation**: Missing placeholders → inline error + disabled save
- **Network**: API errors → toast notification + retry button
- **Server**: 429 → respect Retry-After, show progress

#### 11. Idempotency & Retry
- POST/PUT include Idempotency-Key
- 429 backoff with jittered retry
- UI shows retry progress

#### 12. Output Bundle
```typescript
// NotificationTemplateEditor.tsx
import React, { useState } from 'react';
import { NotificationTemplate } from '@/types/core';
import { useNotificationTemplates } from '@/hooks/useNotificationTemplates';

export const NotificationTemplateEditor: React.FC<{
  template?: NotificationTemplate;
  onSave: (template: NotificationTemplate) => void;
}> = ({ template, onSave }) => {
  const [content, setContent] = useState(template?.content || '');
  const [requiredVars, setRequiredVars] = useState<string[]>([]);
  
  const validatePlaceholders = (text: string) => {
    const missing = requiredVars.filter(v => !text.includes(`{${v}}`));
    return missing.length === 0;
  };

  return (
    <div className="space-y-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-32 p-3 border rounded"
        aria-label="Notification content"
      />
      {!validatePlaceholders(content) && (
        <div className="text-red-600" role="alert">
          Missing required placeholders: {requiredVars.join(', ')}
        </div>
      )}
    </div>
  );
};
```

**How to verify**: Create template, exceed cap limit, validate placeholders, send test notification.

---

### T25 — Gift Cards Admin (Codes / Validation / Stats)

You are implementing Task T25: Gift Cards Admin from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context
- **Brief §5.3**: "Gift Card Management: Generate Code → Enable/Disable → Delete Code"
- **CP §promotions**: Endpoints for coupons CRUD, validation, stats
- **Brief §5.7**: "Gift cards setup (optional) - create initial gift cards if desired"

This task covers the admin interface for creating, managing, and tracking gift card usage with validation and statistics.

#### 1. Deliverables
- **Code**:
  - `/src/pages/admin/gift-cards/GiftCardsPage.tsx`
  - `/src/components/gift-cards/GiftCardGenerator.tsx`
  - `/src/components/gift-cards/GiftCardStats.tsx`
  - `/src/hooks/useGiftCards.ts`
- **Contracts**:
  - `GiftCard` interface
  - `GiftCardStats` interface
  - `GiftCardValidation` interface
- **Tests**:
  - `GiftCardsPage.test.tsx`
  - `GiftCardGenerator.test.tsx`
  - `useGiftCards.test.ts`

#### 2. Constraints
- **Code Generation**: Collision-free with preview
- **Validation**: Immediate enable/disable, expired codes reject at checkout
- **Stats**: Export CSV accurate to ±1 record over 24h
- **Performance**: Code generation ≤ 200ms for batch of 100
- **A11y**: WCAG 2.1 AA, keyboard navigation

#### 3. Inputs → Outputs
- **Inputs**:
  - `GET /api/v1/promotions/coupons` (list)
  - `POST /api/v1/promotions/coupons` (create)
  - `PUT /api/v1/promotions/coupons/{id}` (update)
  - `GET /api/v1/promotions/coupons/{id}/stats` (stats)
- **Outputs**:
  - Gift cards table with CRUD operations
  - Batch code generation modal
  - Usage statistics with CSV export
  - Validation status indicators

#### 4. Validation & Testing
- **AC**: Create single/batch codes, validate/disable works, stats accurate, export CSV
- **Unit Tests**: Code generation, validation logic, stats calculation
- **E2E**: Generate codes, validate at checkout, export stats
- **Manual QA**: Batch operations, CSV export, mobile responsive

#### 5. Dependencies
- **DependsOn**: T01 (API client), T02 (routing), T03 (design tokens)
- **Exposes**: Gift card validation for T22 (checkout integration)

#### 6. Executive Rationale
Essential for customer acquisition and retention. Wrong implementation could lead to financial losses or customer confusion. Rollback: disable all gift cards, restore from backup.

#### 7. North-Star Invariants
- Never generate duplicate codes
- Stats must be accurate within ±1 record
- Disabled codes must reject at checkout

#### 8. Schema/DTO Freeze Note
```typescript
interface GiftCard {
  id: string;
  code: string;
  amount_cents: number;
  expires_at?: string;
  enabled: boolean;
  usage_count: number;
  usage_limit?: number;
  notes?: string;
}
```
SHA-256: `b2c3d4e5f6g7...` (canonical JSON hash)

#### 9. Observability Hooks
- `giftcard.create|update|disable|validate|redeem`
- `giftcard.batch_generate` (count, duration)
- `giftcard.export_csv` (record_count, file_size)

#### 10. Error Model Enforcement
- **Validation**: Invalid codes → clear error message
- **Network**: API errors → toast notification + retry
- **Server**: 429 → respect Retry-After

#### 11. Idempotency & Retry
- Batch creation guarded by Idempotency-Key
- 429 backoff honored
- UI shows progress for batch operations

#### 12. Output Bundle
```typescript
// GiftCardGenerator.tsx
import React, { useState } from 'react';
import { useGiftCards } from '@/hooks/useGiftCards';

export const GiftCardGenerator: React.FC<{
  onGenerate: (codes: string[]) => void;
}> = ({ onGenerate }) => {
  const [count, setCount] = useState(1);
  const [amount, setAmount] = useState(0);
  const [preview, setPreview] = useState<string[]>([]);
  
  const generatePreview = async () => {
    const codes = await generateCodes(count);
    setPreview(codes);
  };

  return (
    <div className="space-y-4">
      <div>
        <label>Number of codes: {count}</label>
        <input
          type="range"
          min="1"
          max="100"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
      </div>
      <div>
        <label>Amount (cents):</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>
      <button onClick={generatePreview}>Preview Codes</button>
      {preview.length > 0 && (
        <div>
          <h3>Preview:</h3>
          <ul>
            {preview.map((code, i) => (
              <li key={i}>{code}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

**How to verify**: Generate codes, validate at checkout, export stats, check CSV accuracy.

---

## Phase 7 — Analytics

### T18 — Analytics (Owner) — Core KPIs & Panels

You are implementing Task T18: Analytics from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context
- **Brief §5.4**: "Analytics Dashboard: Revenue Tracking → No-show Rate → Top Customers → Booking Volume"
- **CP §RevenueAnalytics**: Interface with revenue, booking_count, no_show_rate, top_services
- **Brief §5.6**: "Analytics: Revenue charts and key metrics"

This task covers the owner-facing analytics dashboard with KPIs, charts, and export capabilities.

#### 1. Deliverables
- **Code**:
  - `/src/pages/admin/analytics/AnalyticsPage.tsx`
  - `/src/components/analytics/KPIPanel.tsx`
  - `/src/components/analytics/RevenueChart.tsx`
  - `/src/components/analytics/TopCustomersTable.tsx`
  - `/src/hooks/useAnalytics.ts`
- **Contracts**:
  - `RevenueAnalytics` interface (from CP)
  - `AnalyticsFilters` interface
  - `ExportOptions` interface
- **Tests**:
  - `AnalyticsPage.test.tsx`
  - `RevenueChart.test.tsx`
  - `useAnalytics.test.ts`

#### 2. Constraints
- **Performance**: First chart data fetch < 500ms p75, route LCP p75 < 2.0s
- **Export**: CSV includes header row, PNG matches current view
- **A11y**: Accessible charts with titles, descriptions, focusable datapoints
- **Data Accuracy**: Numbers reconcile with list screens (±1%)

#### 3. Inputs → Outputs
- **Inputs**:
  - `GET /api/v1/analytics/revenue` (revenue data)
  - `GET /api/v1/analytics/bookings` (booking data)
  - `GET /api/v1/analytics/customers` (customer data)
- **Outputs**:
  - KPI tiles (revenue, booking volume, no-show rate)
  - Revenue chart with date range selection
  - Top customers table with drill-down
  - CSV/PNG export functionality

#### 4. Validation & Testing
- **AC**: Shows correct KPIs, date range presets work, exports include headers, numbers reconcile
- **Unit Tests**: KPI calculations, chart rendering, export generation
- **E2E**: Load analytics, apply filters, export CSV/PNG, drill to customer
- **Manual QA**: Chart accessibility, export accuracy, mobile responsive

#### 5. Dependencies
- **DependsOn**: T01 (API client), T02 (routing), T03 (design tokens)
- **Exposes**: Analytics data for T18.1 (filters), T18.2 (drill-downs)

#### 6. Executive Rationale
Critical for business decision-making. Wrong implementation could lead to incorrect business insights. Rollback: disable analytics, restore from backup.

#### 7. North-Star Invariants
- Data must reconcile with backend (±1%)
- Exports must be accurate and complete
- Charts must be accessible

#### 8. Schema/DTO Freeze Note
```typescript
interface RevenueAnalytics {
  tenant_id: string;
  period: string;
  total_revenue_cents: number;
  booking_count: number;
  average_booking_value_cents: number;
  no_show_rate: number;
  top_services: Array<{
    service_id: string;
    service_name: string;
    revenue_cents: number;
    booking_count: number;
  }>;
}
```
SHA-256: `c3d4e5f6g7h8...` (canonical JSON hash)

#### 9. Observability Hooks
- `analytics.view` (route, filters)
- `analytics.export_csv` (widget_id, range, group_by)
- `analytics.export_png` (chart_type, filters)

#### 10. Error Model Enforcement
- **Network**: API errors → toast notification + retry
- **Data**: Missing data → skeleton loading + error state
- **Export**: Export failures → clear error message

#### 11. Idempotency & Retry
- Exports are GET/derivative, safe to retry
- Cache same query key for performance
- UI shows export progress

#### 12. Output Bundle
```typescript
// AnalyticsPage.tsx
import React, { useState } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { KPIPanel } from '@/components/analytics/KPIPanel';
import { RevenueChart } from '@/components/analytics/RevenueChart';

export const AnalyticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('30d');
  const { data, loading, error } = useAnalytics({ dateRange });

  if (loading) return <div>Loading analytics...</div>;
  if (error) return <div>Error loading analytics</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1>Analytics</h1>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>
      
      <KPIPanel data={data} />
      <RevenueChart data={data} />
    </div>
  );
};
```

**How to verify**: Load analytics, check KPI accuracy, export CSV/PNG, verify data reconciliation.

---

### T18.1 — Analytics Filters & Grouping

You are implementing Task T18.1: Analytics Filters & Grouping from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context
- **Brief §5.4**: "Analytics Dashboard: Revenue Tracking → No-show Rate → Top Customers → Booking Volume"
- **CP §analytics**: Endpoints with params for filtering and grouping
- **Brief §5.6**: "Analytics: Revenue charts and key metrics"

This task covers the filtering and grouping functionality for analytics data with URL-synced state.

#### 1. Deliverables
- **Code**:
  - `/src/components/analytics/AnalyticsFilters.tsx`
  - `/src/hooks/useAnalyticsFilters.ts`
  - `/src/utils/analyticsFilters.ts`
- **Contracts**:
  - `AnalyticsFilters` interface
  - `FilterPreset` interface
- **Tests**:
  - `AnalyticsFilters.test.tsx`
  - `useAnalyticsFilters.test.ts`

#### 2. Constraints
- **URL Sync**: Filters persist via URL, back/forward restore state
- **Timezone**: Tenants see their timezone reflected in axes/ticks
- **Performance**: Filter change → refreshed chart in < 200ms client render
- **A11y**: WCAG 2.1 AA, keyboard navigation

#### 3. Inputs → Outputs
- **Inputs**:
  - Query params spec for lists/analytics
  - Tenant timezone & locale
- **Outputs**:
  - Shared filter bar with range presets
  - Custom date picker
  - Group by (day/week/month) selector
  - Service/staff filters

#### 4. Validation & Testing
- **AC**: Filters persist via URL, timezone reflected, filters narrow charts/tables
- **Unit Tests**: Filter state management, URL sync, timezone handling
- **E2E**: Apply filters, navigate back/forward, check state persistence
- **Manual QA**: Filter combinations, timezone display, mobile responsive

#### 5. Dependencies
- **DependsOn**: T18 (analytics base)
- **Exposes**: Filter state for T18.2 (drill-downs), T18.3 (exports)

#### 6. Executive Rationale
Essential for data exploration and analysis. Wrong implementation could lead to incorrect insights. Rollback: reset filters to defaults.

#### 7. North-Star Invariants
- Filter state must persist across navigation
- Timezone must be consistent throughout
- Filters must narrow all relevant data

#### 8. Schema/DTO Freeze Note
```typescript
interface AnalyticsFilters {
  dateRange: string;
  groupBy: 'day' | 'week' | 'month';
  serviceIds?: string[];
  staffIds?: string[];
  customStart?: string;
  customEnd?: string;
}
```
SHA-256: `d4e5f6g7h8i9...` (canonical JSON hash)

#### 9. Observability Hooks
- `analytics.filter_apply` (range, group_by, filters_count)
- `analytics.filter_preset_select` (preset_name)
- `analytics.custom_range_set` (start, end)

#### 10. Error Model Enforcement
- **Validation**: Invalid date ranges → clear error message
- **Network**: API errors → toast notification + retry
- **State**: Filter conflicts → resolve automatically

#### 11. Idempotency & Retry
- N/A (GETs only)
- Cache same query key for performance
- UI shows filter loading state

#### 12. Output Bundle
```typescript
// AnalyticsFilters.tsx
import React from 'react';
import { useAnalyticsFilters } from '@/hooks/useAnalyticsFilters';

export const AnalyticsFilters: React.FC = () => {
  const { filters, setFilters, presets } = useAnalyticsFilters();

  return (
    <div className="flex gap-4 items-center">
      <select
        value={filters.dateRange}
        onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
        className="p-2 border rounded"
      >
        {presets.map(preset => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
      
      <select
        value={filters.groupBy}
        onChange={(e) => setFilters({ ...filters, groupBy: e.target.value as any })}
        className="p-2 border rounded"
      >
        <option value="day">Day</option>
        <option value="week">Week</option>
        <option value="month">Month</option>
      </select>
    </div>
  );
};
```

**How to verify**: Apply filters, check URL sync, navigate back/forward, verify timezone display.

---

### T18.2 — Top Customers & Drill-downs

You are implementing Task T18.2: Top Customers & Drill-downs from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context
- **Brief §5.4**: "Analytics Dashboard: Revenue Tracking → No-show Rate → Top Customers → Booking Volume"
- **CP §analytics/customers**: Endpoint with customer analytics data
- **Brief §5.6**: "Analytics: Revenue charts and key metrics"

This task covers the top customers table with drill-down functionality to customer details.

#### 1. Deliverables
- **Code**:
  - `/src/components/analytics/TopCustomersTable.tsx`
  - `/src/components/analytics/CustomerDrillDown.tsx`
  - `/src/hooks/useTopCustomers.ts`
- **Contracts**:
  - `TopCustomer` interface
  - `CustomerDrillDown` interface
- **Tests**:
  - `TopCustomersTable.test.tsx`
  - `CustomerDrillDown.test.tsx`
  - `useTopCustomers.test.ts`

#### 2. Constraints
- **Sorting**: Stable & deterministic
- **Drill-down**: Clicking row opens customer detail drawer/page
- **Performance**: Sort/paginate without re-fetch when possible
- **A11y**: WCAG 2.1 AA, keyboard navigation, screen reader support

#### 3. Inputs → Outputs
- **Inputs**:
  - `GET /api/v1/analytics/customers` (customer analytics)
  - Owner Customers list route for drill-through
- **Outputs**:
  - Top customers table with sortable columns
  - Customer detail drawer with booking history
  - "View Customer" action buttons

#### 4. Validation & Testing
- **AC**: Sorting stable, drill-down opens customer details, performance optimized
- **Unit Tests**: Table sorting, drill-down logic, data formatting
- **E2E**: Sort table, click customer, view details, navigate back
- **Manual QA**: Table accessibility, drill-down functionality, mobile responsive

#### 5. Dependencies
- **DependsOn**: T18.1 (filters), T17 (customers list)
- **Exposes**: Customer drill-down for T18.3 (exports)

#### 6. Executive Rationale
Critical for customer relationship management. Wrong implementation could lead to missed opportunities. Rollback: disable drill-down, show basic table.

#### 7. North-Star Invariants
- Sorting must be stable and deterministic
- Drill-down must show complete customer history
- Performance must be optimized for large datasets

#### 8. Schema/DTO Freeze Note
```typescript
interface TopCustomer {
  customer_id: string;
  customer_name: string;
  bookings_count: number;
  spend_cents: number;
  last_seen: string;
  average_booking_value_cents: number;
}
```
SHA-256: `e5f6g7h8i9j0...` (canonical JSON hash)

#### 9. Observability Hooks
- `analytics.top_customers_row_click` (customer_id, sort_order)
- `analytics.customer_drill_down_view` (customer_id, source)
- `analytics.customer_detail_export` (customer_id, format)

#### 10. Error Model Enforcement
- **Network**: API errors → toast notification + retry
- **Data**: Missing customer data → skeleton loading
- **Navigation**: Drill-down failures → clear error message

#### 11. Idempotency & Retry
- N/A (read-only)
- Cache customer data for performance
- UI shows loading state for drill-down

#### 12. Output Bundle
```typescript
// TopCustomersTable.tsx
import React, { useState } from 'react';
import { useTopCustomers } from '@/hooks/useTopCustomers';
import { CustomerDrillDown } from '@/components/analytics/CustomerDrillDown';

export const TopCustomersTable: React.FC = () => {
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'spend' | 'bookings' | 'last_seen'>('spend');
  const { data, loading } = useTopCustomers({ sortBy });

  const handleRowClick = (customerId: string) => {
    setSelectedCustomer(customerId);
  };

  return (
    <div>
      <table className="w-full">
        <thead>
          <tr>
            <th onClick={() => setSortBy('spend')}>Total Spend</th>
            <th onClick={() => setSortBy('bookings')}>Bookings</th>
            <th onClick={() => setSortBy('last_seen')}>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {data.map(customer => (
            <tr
              key={customer.customer_id}
              onClick={() => handleRowClick(customer.customer_id)}
              className="cursor-pointer hover:bg-gray-50"
            >
              <td>{customer.customer_name}</td>
              <td>${(customer.spend_cents / 100).toFixed(2)}</td>
              <td>{customer.bookings_count}</td>
              <td>{new Date(customer.last_seen).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {selectedCustomer && (
        <CustomerDrillDown
          customerId={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
};
```

**How to verify**: Sort table, click customer, view details, check data accuracy, test navigation.

---

### T18.3 — Exports & Sharing (CSV/PNG)

You are implementing Task T18.3: Exports & Sharing from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context
- **Brief §5.4**: "Analytics Dashboard: Revenue Tracking → No-show Rate → Top Customers → Booking Volume"
- **Brief §5.6**: "Analytics: Revenue charts and key metrics"
- **Brief §5.8**: "Export Options: Data export capabilities"

This task covers the export functionality for analytics data in CSV and PNG formats.

#### 1. Deliverables
- **Code**:
  - `/src/components/analytics/ExportButtons.tsx`
  - `/src/utils/exportUtils.ts`
  - `/src/hooks/useExport.ts`
- **Contracts**:
  - `ExportOptions` interface
  - `ExportResult` interface
- **Tests**:
  - `ExportButtons.test.tsx`
  - `exportUtils.test.ts`
  - `useExport.test.ts`

#### 2. Constraints
- **File Naming**: Include business slug, widget, ISO date range
- **CSV Format**: Comma delimiter, UTF-8 BOM, RFC4180 quoting
- **PNG Export**: Match on-screen legend/filters
- **Performance**: Export builds in < 1s for 10k rows

#### 3. Inputs → Outputs
- **Inputs**:
  - Chart/table data models
  - File generation utilities
- **Outputs**:
  - CSV for each table
  - CSV for chart series
  - PNG of chart canvas
  - Download progress indicators

#### 4. Validation & Testing
- **AC**: File names include required info, CSV uses correct format, PNG matches screen
- **Unit Tests**: File generation, naming, formatting
- **E2E**: Export CSV/PNG, verify file contents, check naming
- **Manual QA**: Export accuracy, file format, download functionality

#### 5. Dependencies
- **DependsOn**: T18.1 (filters), T18.2 (drill-downs)
- **Exposes**: Export functionality for all analytics widgets

#### 6. Executive Rationale
Essential for data sharing and reporting. Wrong implementation could lead to data loss or incorrect exports. Rollback: disable exports, restore from backup.

#### 7. North-Star Invariants
- Exports must be accurate and complete
- File names must be descriptive and unique
- PNG exports must match screen display

#### 8. Schema/DTO Freeze Note
```typescript
interface ExportOptions {
  format: 'csv' | 'png';
  widget: string;
  dateRange: string;
  filters: Record<string, any>;
  includeHeaders: boolean;
}
```
SHA-256: `f6g7h8i9j0k1...` (canonical JSON hash)

#### 9. Observability Hooks
- `analytics.export_csv` (widget, record_count, file_size)
- `analytics.export_png` (chart_type, filters, file_size)
- `analytics.export_error` (error_type, widget)

#### 10. Error Model Enforcement
- **Export**: Export failures → clear error message + retry button
- **Network**: API errors → toast notification
- **File**: File generation errors → fallback to basic export

#### 11. Idempotency & Retry
- Same query → identical CSV bytes
- Export operations are idempotent
- UI shows export progress

#### 12. Output Bundle
```typescript
// ExportButtons.tsx
import React from 'react';
import { useExport } from '@/hooks/useExport';

export const ExportButtons: React.FC<{
  data: any;
  widget: string;
  filters: Record<string, any>;
}> = ({ data, widget, filters }) => {
  const { exportCSV, exportPNG, loading } = useExport();

  const handleCSVExport = async () => {
    try {
      await exportCSV(data, widget, filters);
    } catch (error) {
      console.error('CSV export failed:', error);
    }
  };

  const handlePNGExport = async () => {
    try {
      await exportPNG(widget, filters);
    } catch (error) {
      console.error('PNG export failed:', error);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCSVExport}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Exporting...' : 'Export CSV'}
      </button>
      <button
        onClick={handlePNGExport}
        disabled={loading}
        className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Exporting...' : 'Export PNG'}
      </button>
    </div>
  );
};
```

**How to verify**: Export CSV/PNG, check file names, verify content accuracy, test download functionality.

---

## Phase 6 & 7 Completion Criteria

### Phase 6 Exit Criteria
- All Phase 6 UIs ship with working CRUD + validation and pass WCAG 2.1 AA audit (≥98% Axe)
- Notification cap rules enforced (1 confirmation + up to 2 reminders)
- Gift cards: codes generate/validate; usage tracked; stats export CSV
- Loyalty: balances adjust on issue/redeem; checkout reflects eligible discounts
- Automations: CRUD + "Run now (dry-run)" with idempotency
- Telemetry events conform to analytics taxonomy with 0 schema errors
- Web Vitals: LCP p75 ≤ 2.5s (public) / ≤ 2.0s (admin); INP p75 ≤ 200ms; CLS p75 ≤ 0.1
- CI gates in place for tests, a11y, and perf; all Phase 6 screens pass

### Phase 7 Exit Criteria
- Analytics pages render revenue/booking/customer metrics for selectable ranges and groupings
- CSV export available for all charts/tables; PNG export for charts
- Metrics reconcile (±1% over 24h) with event stream (per taxonomy)
- Web Vitals budgets met on Analytics routes; error budgets & retries defined
- Observability hooks emit per analytics taxonomy with 0 schema violations in CI replay
- All analytics API calls typed, retried on 429, and cached
- A11y ≥ 98% Axe; LCP p75 < 2.0s on analytics route; INP p75 < 200ms
- Access control and PII redaction validated
- QA matrix passed on desktop + mobile targets

---

*End of Tithi Frontend Phase 6 & 7 Ticketed Prompts*
