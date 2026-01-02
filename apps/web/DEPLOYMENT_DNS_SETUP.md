# DNS Setup Guide for Dual-Domain Architecture

## ⏰ When to Set This Up

**Do this AFTER your app is complete and BEFORE going to production.**

You can continue developing locally without DNS setup. The code is ready, but you'll need DNS configured when you deploy to production.

---

## 🎯 What You Need to Set Up

### Domain 1: `revol.app` (App Domain)
- Used for: Marketing site, login, admin dashboard, billing
- Examples: `www.revol.app`, `revol.app`, `app.revol.app`

### Domain 2: `main.tld` (Customer Booking Domain)
- Used for: Customer booking sites
- **Root domain** (`main.tld`) → redirects to `www.revol.app`
- **WWW subdomain** (`www.main.tld`) → redirects to `www.revol.app`
- **Business subdomains** (`{businessname}.main.tld`) → show booking pages
- Examples: `jambox.main.tld`, `oakstreet.main.tld` (these are the actual booking URLs)

---

## 📋 GoDaddy DNS Configuration

### Step 1: Configure `revol.app` Domain

1. **Log into GoDaddy** → Go to DNS Management for `revol.app`

2. **Add/Update Records**:

   ```
   Type: A (or CNAME)
   Name: @ (or leave blank for root)
   Value: [Your hosting provider IP/CNAME]
   TTL: 3600
   
   Type: A (or CNAME)
   Name: www
   Value: [Your hosting provider IP/CNAME]
   TTL: 3600
   
   Type: A (or CNAME)
   Name: app
   Value: [Your hosting provider IP/CNAME]
   TTL: 3600
   ```

   **For Vercel**: Use CNAME pointing to `cname.vercel-dns.com` or use Vercel's nameservers

3. **If using Vercel**:
   - Go to Vercel Dashboard → Your Project → Settings → Domains
   - Add: `revol.app`, `www.revol.app`, `app.revol.app`
   - Vercel will show you the DNS records to add in GoDaddy

---

### Step 2: Configure `main.tld` Domain (Customer Booking Domain)

1. **Log into GoDaddy** → Go to DNS Management for `main.tld`

2. **Add Wildcard Record** (for subdomains):

   ```
   Type: A (or CNAME)
   Name: * (wildcard)
   Value: [Same hosting provider IP/CNAME as revol.app]
   TTL: 3600
   ```

   This allows `jambox.main.tld`, `oakstreet.main.tld`, etc. to work.

3. **Handle Root Domain and WWW Redirect** (`main.tld` and `www.main.tld` → `www.revol.app`):

   **Option A: Use GoDaddy Domain Forwarding** (Easiest)
   - In GoDaddy DNS, look for "Domain Forwarding" or "Redirects"
   - Set up forward: `main.tld` → `https://www.revol.app`
   - Set up forward: `www.main.tld` → `https://www.revol.app`
   - Choose "Permanent (301)" redirect for both

   **Option B: Handle in App** (More Control - Already Implemented)
   - The middleware already redirects both `main.tld` and `www.main.tld` to `www.revol.app`
   - Just point root domain and www to your hosting provider
   - Add these DNS records:
     ```
     Type: A (or CNAME)
     Name: @ (or leave blank for root)
     Value: [Same hosting provider IP/CNAME]
     TTL: 3600
     
     Type: A (or CNAME)
     Name: www
     Value: [Same hosting provider IP/CNAME]
     TTL: 3600
     ```

4. **If using Vercel**:
   - Go to Vercel Dashboard → Your Project → Settings → Domains
   - Add: `main.tld` and `*.main.tld` (wildcard)
   - Vercel will automatically handle SSL for all subdomains

---

## 🔧 Code Updates Needed Before Deployment

Before deploying, replace `.main.tld` with your actual domain:

### File 1: `apps/web/src/lib/domain-utils.ts`
```typescript
// Line 8 - Replace with your actual domain
export const CUSTOMER_DOMAIN_SUFFIX = '.main.tld'; // Change to your domain, e.g., '.revolbooking.com'
```

### File 2: `apps/web/src/middleware.ts`
```typescript
// Line 14 - Replace with your actual domain
const CUSTOMER_DOMAIN_SUFFIX = '.main.tld'; // Change to your domain, e.g., '.revolbooking.com'
```

**Example**: If your customer booking domain is `revolbooking.com`, change both to:
```typescript
export const CUSTOMER_DOMAIN_SUFFIX = '.revolbooking.com';
```

---

## ✅ DNS Checklist

### For `revol.app`:
- [ ] Root domain (`revol.app`) points to hosting
- [ ] `www.revol.app` points to hosting
- [ ] `app.revol.app` points to hosting (optional)
- [ ] Added domains in Vercel (if using Vercel)
- [ ] SSL certificates auto-provisioned (Vercel does this automatically)

### For `main.tld`:
- [ ] Wildcard `*.main.tld` points to hosting (for business subdomains)
- [ ] Root `main.tld` either:
  - [ ] Redirects to `www.revol.app` (via GoDaddy forwarding), OR
  - [ ] Points to hosting (app will handle redirect)
- [ ] `www.main.tld` either:
  - [ ] Redirects to `www.revol.app` (via GoDaddy forwarding), OR
  - [ ] Points to hosting (app will handle redirect)
- [ ] Added `main.tld`, `www.main.tld`, and `*.main.tld` in Vercel (if using Vercel)
- [ ] SSL certificates auto-provisioned

---

## 🧪 Testing After DNS Setup

1. **Test App Domain**:
   - Visit `https://www.revol.app` → Should show marketing/login page
   - Visit `https://revol.app` → Should redirect to `www.revol.app` or show app

2. **Test Customer Domain Redirects**:
   - Visit `https://main.tld` → Should redirect to `https://www.revol.app`
   - Visit `https://www.main.tld` → Should redirect to `https://www.revol.app`

3. **Test Customer Booking Site**:
   - Complete onboarding for a test business (e.g., "jambox")
   - Visit `https://jambox.main.tld` → Should show booking page
   - Verify SSL certificate is valid (green lock icon)

---

## 🚨 Important Notes

1. **SSL Certificates**: 
   - Vercel automatically provisions SSL for all domains
   - No need to buy certificates
   - Wildcard SSL covers `*.main.tld` automatically

2. **DNS Propagation**:
   - DNS changes can take 24-48 hours to propagate globally
   - Usually works within 1-2 hours
   - Use `dig` or `nslookup` to check propagation

3. **GoDaddy Domain Forwarding**:
   - If using GoDaddy forwarding for root domain, it may not preserve HTTPS
   - Better to handle redirect in app (middleware already does this)

4. **Vercel Nameservers** (Alternative):
   - Instead of individual DNS records, you can point domains to Vercel's nameservers
   - GoDaddy → DNS Management → Change Nameservers
   - Use nameservers provided by Vercel
   - Then manage all DNS in Vercel dashboard

---

## 📞 Quick Reference

**App Domain**: `revol.app`, `www.revol.app`
- Marketing, login, dashboard, billing

**Customer Domain**: `*.main.tld` (e.g., `jambox.main.tld`)
- Public booking sites

**Root Redirect**: `main.tld` → `www.revol.app`
- Handled by middleware or GoDaddy forwarding

---

## ❓ Common Questions

**Q: Can I test this locally?**
A: Yes, add to `/etc/hosts` (Mac/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
```
127.0.0.1 jambox.main.tld
127.0.0.1 www.revol.app
```

**Q: Do I need to buy SSL certificates?**
A: No! Vercel (and most modern hosting) automatically provisions SSL via Let's Encrypt.

**Q: What if I'm not using Vercel?**
A: Same DNS setup, but point to your hosting provider's IP/CNAME. SSL setup depends on your provider.

**Q: Can I use a different domain for customer sites?**
A: Yes! Just replace `.main.tld` in the two config files with your actual domain.

