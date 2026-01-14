# Taxability Assessment: Tithi SaaS Application

## Executive Summary

**Status: NON-TAXABLE** (Pure SaaS with no taxable elements detected)

This application is a web-based Software-as-a-Service (SaaS) booking/appointment scheduling platform. Based on thorough codebase analysis, it does NOT contain any of the taxable elements that would make it subject to sales tax.

## Detailed Analysis by Taxable Criteria

### ❌ Downloadable Software
**Status: NOT PRESENT**
- Application is built with Next.js and runs entirely in the browser
- No downloadable executables, installers, or offline packages
- No `package.json` scripts or build outputs that create downloadable files
- Web-based SaaS architecture only

### ❌ Desktop Apps
**Status: NOT PRESENT**
- No Electron, Tauri, or desktop application frameworks
- No desktop app build scripts or configurations
- Confirmed: Web application only (Next.js/React)

### ❌ Mobile Apps Sold as Licenses
**Status: NOT PRESENT**
- No React Native, Flutter, or native mobile app code
- No iOS/Android app configurations or build files
- No mobile app store deployment code
- Confirmed: Responsive web application, not native apps

### ❌ Offline Software Files
**Status: NOT PRESENT**
- No offline-first architecture (Service Workers, PWA offline mode not detected)
- No downloadable files or offline installation packages
- Requires active internet connection to function

### ❌ Locally Installed or On-Prem Software
**Status: NOT PRESENT**
- Cloud-hosted SaaS architecture (Supabase backend)
- No on-premise deployment instructions or self-hosted options
- No Docker/Kubernetes configs for on-premise deployment
- Users access via web browser only

### ⚠️ Taxable Bundled Services
**Status: REQUIRES VERIFICATION**

**Subscription Model Analysis:**
- **Primary Service**: SaaS platform access ($14.99/month subscription)
- **Trial Period**: 7-day free trial (no charge)
- **Onboarding**: Free, no mandatory fees

**Potential Concerns:**
1. **Stripe Connect Setup**: Businesses must set up Stripe Connect accounts for payment processing
   - **Status**: This is a third-party integration, not a bundled service sold by the app
   - **Conclusion**: NOT TAXABLE - integration setup is free, not a separate service

2. **Subscription Includes**: 
   - Booking management platform
   - Admin dashboard
   - Public booking pages
   - Payment processing integration
   - Notifications (email/SMS)
   - Analytics
   - **Conclusion**: All digital SaaS features, no taxable bundled services

### ❌ Mandatory Onboarding Fees
**Status: NOT PRESENT**
- Onboarding flow is completely free (12-step process)
- No fees charged during onboarding
- Subscription only starts after 7-day trial period
- Code confirms: `subscription_status` defaults to `'trial'` with no charge

**Evidence from code:**
```typescript
// apps/web/src/lib/stripe.ts:134
trial_period_days: 7,  // Free 7-day trial
```

### ❌ Consulting Required to Use the App
**Status: NOT PRESENT**
- No consulting services offered or required
- Self-service onboarding flow
- No professional services bundled
- No implementation consulting mentioned in codebase

### ❌ Training Sold as Part of Subscription
**Status: NOT PRESENT**
- No training modules, courses, or educational content
- No training videos or documentation sold separately
- Subscription includes only the software platform access
- No evidence of training as a component

### ❌ Hardware or Physical Goods
**Status: NOT PRESENT**
- No physical products sold
- No inventory management for physical goods
- Digital services only
- No shipping/fulfillment code present

### ❌ Devices
**Status: NOT PRESENT**
- No device sales (tablets, terminals, POS systems)
- No hardware rental or lease programs
- Customers use their own devices to access the web app

### ❌ Sensors
**Status: NOT PRESENT**
- No IoT integrations
- No sensor hardware sold or required
- Pure software platform

### ❌ Anything Shipped
**Status: NOT PRESENT**
- No shipping addresses collected for product delivery
- No fulfillment or shipping integrations (no UPS/FedEx APIs)
- No physical inventory
- Database schema shows only `customers` table with email/phone, no shipping fields

**Database Schema Evidence:**
```sql
-- customers table has no shipping fields
CREATE TABLE customers (
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  -- NO shipping_address, NO delivery fields
);
```

### ⚠️ Economic Nexus - State Tax Thresholds
**Status: NOT TRACKED (Potential Risk)**

**Threshold Examples:**
- $100,000 revenue in a state, OR
- 200 transactions in a state

**Current State:**
- ❌ **NO state-level revenue tracking** in database schema
- ❌ **NO transaction count by state** tracking
- ❌ **NO geolocation/IP-based state attribution** for customers
- ❌ **NO state-based reporting** capabilities

**Risk Assessment:**
- If the app crosses economic nexus thresholds in states that tax SaaS (varies by state), it may become taxable
- **Current codebase cannot determine if thresholds are crossed** due to lack of tracking
- Recommendation: Implement state-level revenue/transaction tracking if approaching thresholds

**States That May Tax SaaS:**
- Some states tax SaaS (e.g., Texas, New York under certain conditions)
- Most states exempt pure SaaS from sales tax
- Need to verify per-state rules and thresholds

## Business Model Summary

**Revenue Streams:**
1. **Monthly Subscription**: $14.99/month (Basic Plan)
   - 7-day free trial
   - Recurring subscription after trial
   - Pure SaaS access

2. **Platform Fees**: 1% application fee on customer bookings (transaction fee)
   - This is a payment processing fee, not a taxable sale of goods
   - Flow-through revenue model (collected on behalf of businesses)

**Payment Flow:**
- Businesses set up Stripe Connect accounts (free integration)
- Customers book appointments through platform
- Platform charges 1% fee on transactions
- No direct taxable sales of products or services by Tithi to end customers

## Conclusion

✅ **This application is NON-TAXABLE** under the criteria provided:

1. Pure SaaS model - web-based software service
2. No downloadable software, desktop apps, or mobile apps
3. No physical goods, devices, or shipping
4. No mandatory fees, consulting, or training bundled
5. Subscription-based revenue (typically exempt in most states)

⚠️ **Potential Monitoring Needed:**
- **Economic Nexus Tracking**: Consider implementing state-level revenue/transaction tracking to monitor thresholds in states that tax SaaS
- **State-Specific Rules**: Verify per-state SaaS taxation rules as business scales

## Recommendations

1. **Implement Economic Nexus Tracking** (if not already done externally):
   - Track customer locations (state) at booking time
   - Calculate revenue by state
   - Monitor transaction counts by state
   - Set up alerts when approaching thresholds

2. **State Tax Research**:
   - Determine which states tax SaaS (varies significantly)
   - Understand threshold requirements per state
   - Consult with tax professional for state-specific guidance

3. **Documentation**:
   - Maintain clear records that this is a pure SaaS offering
   - Document that no physical goods or taxable services are bundled
   - Keep subscription terms clear that only software access is provided

---

## State-Specific Analysis: New Jersey

### ✅ NEW JERSEY SALES TAX: EXEMPT

**Status: EXEMPT FROM SALES TAX in New Jersey**

**Legal Basis:**
- New Jersey generally exempts Software as a Service (SaaS) from sales tax
- SaaS is considered a **service** rather than tangible personal property
- Tax applies only to software that is "delivered electronically" or transferred to customers
- Since your app provides **access** without transfer/download, it qualifies as exempt SaaS

**Why Tithi is Exempt:**

1. **Pure SaaS Model** ✅
   - Software accessed remotely via web browser
   - No download or electronic delivery of software files
   - Customers never possess the software
   - Access-only model (not transfer of software)

2. **NOT an Information Service** ✅
   - Information services ARE taxable in NJ (e.g., Westlaw, LexisNexis)
   - Information services provide "collected, compiled, or analyzed information"
   - Tithi is a booking/appointment management **service**, not an information provider
   - You provide functionality/tools, not compiled information

3. **NOT Specified Digital Products** ✅
   - Digital products (music, movies, books, etc.) ARE taxable in NJ (6.625%)
   - Tithi does not sell digital media or specified digital products
   - You sell software access/service only

**NJ Tax Rate if Applicable:** 6.625% (but NOT applicable to SaaS)

**Conclusion for New Jersey:**
✅ **Your SaaS application is EXEMPT from New Jersey sales tax** because:
- It's a service (not tangible property)
- Software is not delivered/transferred to customers
- It's not classified as an information service
- It's not a specified digital product

**Important Notes:**
- This exemption applies to your SaaS subscription revenue ($14.99/month)
- The 1% platform fee on transactions is a payment processing fee, also exempt
- No need to collect or remit NJ sales tax on subscriptions
- Monitor for any legislative changes (no changes expected for 2024-2025)

**Documentation Recommendation:**
- Maintain clear records that this is SaaS (service access, not software transfer)
- Keep subscription terms that specify "access to software platform" language
- Document that no software files are delivered to customers

---

**Assessment Date**: January 2025
**Codebase Version**: Current (as of assessment)
**Assessment Method**: Comprehensive codebase search and analysis + NJ-specific tax research
