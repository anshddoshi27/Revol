# 🗄️ Tithi Database Documentation for Frontend

**Complete database mapping for building the Tithi frontend application**

---

## 📚 Documentation Index

### 1. [DATABASE_EXECUTOR_QUICK_REFERENCE.md](./DATABASE_EXECUTOR_QUICK_REFERENCE.md) ⚡ **START HERE**
**Your 5-minute cheat sheet for understanding the data model**

- Big picture architecture
- Core data models (Tenants, Services, Bookings, Payments)
- Critical rules (especially payment flow!)
- Common API calls
- UI component mapping
- Frontend build checklist

**Read this first to get oriented quickly.**

---

### 2. [DATABASE_MAP_FOR_FRONTEND.md](./DATABASE_MAP_FOR_FRONTEND.md) 📖 **THE COMPLETE GUIDE**
**Exhaustive reference covering every table, field, and relationship**

**Table of Contents:**
1. Core Multi-Tenant Architecture
2. User & Authentication Tables
3. Business & Onboarding Tables
4. Service & Catalog Tables
5. Team & Staff Tables
6. Booking Flow Tables
7. Financial & Payment Tables
8. Notification & Communication Tables
9. Promotions & Marketing Tables
10. Analytics & Reporting Tables
11. System & Configuration Tables
12. Data Flow Patterns
13. Frontend Integration Guide

**Use this when you need:**
- Complete field definitions
- Detailed relationship explanations
- Frontend integration examples
- API endpoint documentation
- State management patterns

---

### 3. [DATABASE_RELATIONSHIP_DIAGRAM.md](./DATABASE_RELATIONSHIP_DIAGRAM.md) 🗺️ **VISUAL REFERENCE**
**ASCII diagrams showing how tables connect**

- Complete entity relationship map
- One-to-many, many-to-many patterns
- Critical data flows (onboarding, booking, payment)
- SQL query examples
- Index usage patterns

**Use this when you need:**
- Visual understanding of relationships
- Query examples
- Data flow tracing

---

## 🎯 Quick Navigation

### "How do I..."

| Question | Documentation |
|----------|--------------|
| Understand the payment flow? | [Quick Reference - Payment Flow](../DATABASE_EXECUTOR_QUICK_REFERENCE.md#payment-flow) |
| See all available API endpoints? | [Map - Frontend Integration](../DATABASE_MAP_FOR_FRONTEND.md#13-frontend-integration-guide) |
| Understand tenant isolation? | [Map - Multi-Tenant](../DATABASE_MAP_FOR_FRONTEND.md#1-core-multi-tenant-architecture) |
| See what data onboarding creates? | [Diagram - Onboarding Flow](../DATABASE_RELATIONSHIP_DIAGRAM.md#onboarding-flow) |
| Understand booking status flow? | [Map - Bookings](../DATABASE_MAP_FOR_FRONTEND.md#bookings-tenant-scoped) |
| Know what tables to query for X? | [Diagram - Relationships](../DATABASE_RELATIONSHIP_DIAGRAM.md) |
| See all fields on a specific table? | [Map - Find table by name](../DATABASE_MAP_FOR_FRONTEND.md) |

---

## 🚀 Getting Started

### For AI Executors

1. **Read Quick Reference** - Understand the architecture in 5 minutes
2. **Skim the Diagram** - Get visual understanding of relationships
3. **Deep dive in Map** - When building a specific component

### For Frontend Developers

1. **Quick Reference** - Payment flow and common patterns
2. **Map** - Table-by-table reference when coding
3. **Diagram** - When designing queries or understanding data flow

---

## ⚠️ Critical Information

### Payment Flow (MOST IMPORTANT!)
```
❌ NEVER charge at checkout
✅ Save card at checkout (SetupIntent)
✅ Charge ONLY from admin buttons:
   - Completed → Charge full amount
   - No-Show → Charge no-show fee
   - Cancelled → Charge cancellation fee
   - Refund → Refund previous charge
```

### Multi-Tenancy
```
Every row has tenant_id
Backend enforces isolation via RLS
Frontend: Include X-Tenant-ID header or JWT context
```

### Onboarding = Business Setup
```
8 steps configure one business
Admin can edit all onboarding data live
Booking site reads same data
```

---

## 📊 Database Statistics

- **Total Tables**: ~30+
- **Global Tables**: users, tenants
- **Tenant-Scoped Tables**: All business data
- **Relationships**: Complex multi-level hierarchy
- **Payment Tables**: 5+ (payments, payment_methods, refunds, tenant_billing, etc.)
- **Booking Tables**: 3+ (bookings, booking_items, booking_sessions)
- **Analytics Tables**: 5+ (tracking, metrics, analytics)

---

## 🔗 Related Documentation

- **Frontend Design Brief**: [../TITHI_FRONTEND_DESIGN_BRIEF.md](../TITHI_FRONTEND_DESIGN_BRIEF.md)
- **Frontend Logistics**: [../frontend logistics.txt](../frontend logistics.txt)
- **Backend Architecture**: [../../backend/BACKEND_ARCHITECTURE_MAP.md](../../backend/BACKEND_ARCHITECTURE_MAP.md)
- **Database Progress**: [../../database/DB_PROGRESS.md](../../database/DB_PROGRESS.md)

---

## 🛠️ Using This Documentation

### Building a Feature

1. Find the relevant tables in **Quick Reference**
2. Read detailed field descriptions in **Map**
3. Understand relationships in **Diagram**
4. Use provided API examples

### Debugging Data Issues

1. Check **Diagram** to trace data flow
2. Verify table structure in **Map**
3. Review **Quick Reference** for common patterns

### Adding New Features

1. Review existing patterns in all three docs
2. Understand tenant isolation requirements
3. Follow established data flow patterns

---

## 📝 Documentation Updates

This documentation is generated from:
- Backend model files (`backend/app/models/`)
- Migration files (`backend/migrations/versions/`)
- Frontend requirements (`docs/frontend/frontend logistics.txt`)

When updating:
1. Update model files first
2. Run migrations
3. Update relevant sections in all three docs
4. Maintain consistency across docs

---

## ✅ Quick Checklist

Before building a frontend component, ensure you understand:

- [ ] Which tables store the data you need
- [ ] How those tables relate to each other
- [ ] What API endpoints to call
- [ ] What tenant isolation is required
- [ ] What the data flow looks like
- [ ] How to handle edge cases (errors, missing data, etc.)

---

**Questions? Check the Quick Reference first, then the Map, then the Diagram. Between these three documents, every database question should be answerable.**

