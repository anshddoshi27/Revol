# Missing Items Checklist

**Purpose:** Track missing or ambiguous functionality identified during backend analysis for frontend development.

**Usage:** Append new gaps as they're discovered in each module. This serves as a prioritized backlog for backend development and frontend workarounds.

---

## Module 1: Repo Overview, Auth & Session, Multi-Tenant Resolution, DB Models

**Confidence Score: 85%** - Some functionality referenced but not fully implemented

### 🔴 Critical Gaps (Blocking Frontend Development)

#### 1. Theme Versioning System
**Issue:** Database has `themes` table but no versioning system visible
**Impact:** Frontend cannot implement draft/publish theme workflow
**Suggested Backend Signatures:**
```python
# Theme versioning endpoints
POST /api/v1/tenants/{id}/themes
PUT /api/v1/tenants/{id}/themes/{theme_id}/publish
GET /api/v1/tenants/{id}/themes/{theme_id}/versions
DELETE /api/v1/tenants/{id}/themes/{theme_id}/versions/{version_id}
```

#### 2. Custom Domain Management
**Issue:** Referenced in onboarding blueprint but no implementation found
**Impact:** Frontend cannot implement custom domain setup flow
**Suggested Backend Signatures:**
```python
# Custom domain management
POST /api/v1/tenants/{id}/domains
GET /api/v1/tenants/{id}/domains
GET /api/v1/tenants/{id}/domains/{domain_id}/status
PUT /api/v1/tenants/{id}/domains/{domain_id}/verify
DELETE /api/v1/tenants/{id}/domains/{domain_id}
```

#### 3. File Upload System
**Issue:** Upload folder configured but upload endpoints not found
**Impact:** Frontend cannot upload logos, avatars, or other assets
**Suggested Backend Signatures:**
```python
# File upload endpoints
POST /api/v1/upload/logo
POST /api/v1/upload/avatar
POST /api/v1/upload/document
GET /api/v1/upload/{file_id}/signed-url
DELETE /api/v1/upload/{file_id}
```

### 🟡 Medium Priority Gaps

#### 4. Staff Profile Management API
**Issue:** Models exist (`StaffProfile`, `WorkSchedule`, `StaffAvailability`) but API endpoints unclear
**Impact:** Frontend cannot implement staff management features
**Suggested Backend Signatures:**
```python
# Staff management endpoints
GET /api/v1/tenants/{id}/staff
POST /api/v1/tenants/{id}/staff
PUT /api/v1/tenants/{id}/staff/{staff_id}
DELETE /api/v1/tenants/{id}/staff/{staff_id}
GET /api/v1/tenants/{id}/staff/{staff_id}/schedule
POST /api/v1/tenants/{id}/staff/{staff_id}/schedule
```

#### 5. Availability Caching Logic
**Issue:** Redis integration mentioned but caching logic not fully visible
**Impact:** Frontend may not understand cache invalidation patterns
**Suggested Backend Signatures:**
```python
# Availability cache management
POST /api/v1/tenants/{id}/availability/cache/invalidate
GET /api/v1/tenants/{id}/availability/cache/status
POST /api/v1/tenants/{id}/availability/cache/warm
```

### 🟢 Low Priority Gaps

#### 6. Webhook Handling
**Issue:** Stripe webhooks referenced but handlers not found
**Impact:** Frontend may not receive real-time payment updates
**Suggested Backend Signatures:**
```python
# Webhook endpoints
POST /webhooks/stripe
POST /webhooks/supabase
POST /webhooks/twilio
GET /webhooks/{provider}/status
```

#### 7. Analytics Materialized Views
**Issue:** Migration exists but API endpoints unclear
**Impact:** Frontend cannot access analytics data
**Suggested Backend Signatures:**
```python
# Analytics endpoints
GET /api/v1/tenants/{id}/analytics/bookings
GET /api/v1/tenants/{id}/analytics/revenue
GET /api/v1/tenants/{id}/analytics/customers
GET /api/v1/tenants/{id}/analytics/staff
```

---

## Module 2: Onboarding & Branding (Pending)

*Gaps will be added as module is analyzed*

---

## Module 3: Booking & Availability (Pending)

*Gaps will be added as module is analyzed*

---

## Module 4: Admin & Management (Pending)

*Gaps will be added as module is analyzed*

---

## Module 5: Payments & Billing (Pending)

*Gaps will be added as module is analyzed*

---

## Module 6: Notifications & Communications (Pending)

*Gaps will be added as module is analyzed*

---

## Priority Matrix

| Priority | Impact | Effort | Module | Status |
|----------|--------|--------|--------|--------|
| 🔴 Critical | High | Medium | 1 | Needs Backend Work |
| 🔴 Critical | High | High | 1 | Needs Backend Work |
| 🔴 Critical | High | Low | 1 | Needs Backend Work |
| 🟡 Medium | Medium | Medium | 1 | Needs Backend Work |
| 🟡 Medium | Medium | Low | 1 | Needs Backend Work |
| 🟢 Low | Low | Low | 1 | Needs Backend Work |
| 🟢 Low | Low | Medium | 1 | Needs Backend Work |

---

## Frontend Workarounds

### Temporary Solutions While Backend Gaps Are Addressed:

1. **Theme Management:** Use localStorage for draft themes, implement publish when backend ready
2. **Custom Domains:** Show placeholder UI with "coming soon" messaging
3. **File Uploads:** Use direct S3/CloudFront uploads with signed URLs
4. **Staff Management:** Use mock data for development, implement when API ready
5. **Analytics:** Use mock charts and data until endpoints are available

---

**Last Updated:** 2024-01-01  
**Version:** 1.0  
**Next Review:** After Module 2 completion
