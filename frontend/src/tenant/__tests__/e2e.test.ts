/**
 * Tenant E2E Tests
 * 
 * End-to-end tests for tenant resolution and routing behavior.
 */

import { test, expect } from '@playwright/test';

test.describe('Tenant Resolution E2E', () => {
  test('should resolve tenant from path-based routing', async ({ page }) => {
    // Navigate to public booking route
    await page.goto('/v1/b/acme-salon');
    
    // Check that tenant context is resolved
    const tenantSlug = await page.evaluate(() => {
      return window.__TENANT_CONTEXT__?.slug;
    });
    
    expect(tenantSlug).toBe('acme-salon');
  });

  test('should resolve tenant from subdomain routing', async ({ page }) => {
    // Navigate to subdomain
    await page.goto('http://acme-salon.tithi.com');
    
    // Check that tenant context is resolved
    const tenantSlug = await page.evaluate(() => {
      return window.__TENANT_CONTEXT__?.slug;
    });
    
    expect(tenantSlug).toBe('acme-salon');
  });

  test('should block admin routes without authentication', async ({ page }) => {
    // Navigate to admin route without authentication
    await page.goto('/admin/dashboard');
    
    // Should be redirected or show access denied
    await expect(page.locator('text=Access denied')).toBeVisible();
  });

  test('should allow admin routes with authentication', async ({ page }) => {
    // Mock authentication
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'mock-token');
    });
    
    // Navigate to admin route
    await page.goto('/admin/dashboard');
    
    // Should show admin content
    await expect(page.locator('text=Admin Dashboard')).toBeVisible();
  });

  test('should handle deep links correctly', async ({ page }) => {
    // Navigate directly to a deep booking link
    await page.goto('/v1/b/acme-salon/services');
    
    // Check that tenant context is resolved
    const tenantSlug = await page.evaluate(() => {
      return window.__TENANT_CONTEXT__?.slug;
    });
    
    expect(tenantSlug).toBe('acme-salon');
    
    // Check that services page is loaded
    await expect(page.locator('text=Services')).toBeVisible();
  });

  test('should survive page refresh', async ({ page }) => {
    // Navigate to booking page
    await page.goto('/v1/b/acme-salon');
    
    // Refresh the page
    await page.reload();
    
    // Check that tenant context is still resolved
    const tenantSlug = await page.evaluate(() => {
      return window.__TENANT_CONTEXT__?.slug;
    });
    
    expect(tenantSlug).toBe('acme-salon');
  });

  test('should handle tenant isolation', async ({ page }) => {
    // Navigate to first tenant
    await page.goto('/v1/b/acme-salon');
    
    // Check tenant context
    let tenantSlug = await page.evaluate(() => {
      return window.__TENANT_CONTEXT__?.slug;
    });
    expect(tenantSlug).toBe('acme-salon');
    
    // Navigate to different tenant
    await page.goto('/v1/b/different-salon');
    
    // Check that context has changed
    tenantSlug = await page.evaluate(() => {
      return window.__TENANT_CONTEXT__?.slug;
    });
    expect(tenantSlug).toBe('different-salon');
  });

  test('should emit telemetry events', async ({ page }) => {
    // Listen for telemetry events
    const events: any[] = [];
    await page.exposeFunction('trackEvent', (event: any) => {
      events.push(event);
    });
    
    // Navigate to tenant page
    await page.goto('/v1/b/acme-salon');
    
    // Check that tenant_resolved event was emitted
    await page.waitForFunction(() => {
      return window.__TELEMETRY_EVENTS__?.some((e: any) => e.name === 'routing.tenant_resolved');
    });
    
    const tenantResolvedEvent = await page.evaluate(() => {
      return window.__TELEMETRY_EVENTS__?.find((e: any) => e.name === 'routing.tenant_resolved');
    });
    
    expect(tenantResolvedEvent).toBeDefined();
    expect(tenantResolvedEvent.data.slug).toBe('acme-salon');
  });
});
