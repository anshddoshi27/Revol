## 0. Mission Context & Core Platform Vision

### 0.1 Core Mission Statement
**Tithi is an end-to-end, fully white-labeled platform for service-based businesses** (salons, clinics, studios) to launch their own branded booking systems in minutes. Every tenant (business) has its own subdomain (business.tithi.com) or custom domain, and customers booking services only see the business's brand, logo, colors, policies—not "Tithi" (unless explicitly chosen).

Tithi replaces multiple tools by offering onboarding, branding, bookings, payments, policies, notifications, CRM, analytics — all within one modular platform.

**CRITICAL EXECUTION REQUIREMENT:**
This project requires comprehensive multi-document consultation before any implementation. Do not assume you understand requirements from task descriptions alone. You must consult the design brief, context pack, and TITHI_DATABASE_COMPREHENSIVE_REPORT.md to fully understand all goals, architectural decisions, API patterns, and business requirements. Prioritize thoroughness over speed in requirements gathering. This is a multi-document project requiring cross-reference to ensure 100% compliance with all authoritative documents. The database report is essential for accurate backend integration and alignment with Tithi's spirit and functionalities.



### 0.2 Platform Architecture Overview
Tithi is a white-labeled, multi-tenant booking platform where each tenant (business) has:
- **Isolated data** with complete separation between business data
- **Own branding** with businesses appearing 100% independent 
- **Customer-facing experiences** under their domain
- **Prepaid bookings** via Stripe with full payment validation
- **Professional branding defaults** with deterministic backend workflows

### 0.3 North Star Goals (Critical Success Factors)
- **Strict tenant data isolation** - Complete separation between business data
- **Full tenant-controlled branding** - Businesses appear 100% independent 
- **Owner/Admin only** (no staff roles in v1) - Simplified role model for initial release
- **Bookings require full payment validation** - No unpaid bookings allowed
- **Availability must always be defined** for booking to function
- **Secure, observable, and deterministic backend execution** - Production-ready reliability

**All atomic tasks must align with this mission, context pack, and design brief.**

## 1. Enhanced Platform Goals & Requirements

**CRITICAL: TITHI_DATABASE_COMPREHENSIVE_REPORT.md is the single source of truth for all database schemas, constraints, indexes, relationships, migrations, and backend alignment. No deliverable should ever contradict or drift from this file.AFTER BUILDING CHECK THAT DATABASE IS FULLY COMPATIBLE WITH WHAT YOU JUST BUILT (THINK OF RELEVANT TABLES AND OVERALL SCHEMA AND HOW IT WOULD WORK WITH THE NEW ADDITION)**

### 1.1 App-Level Goals (Business Vision)
- **Multi-tenant Mission**: Enable businesses to launch branded booking systems in minutes with complete data isolation
- **White-label Promise**: Customers see only business branding, not "Tithi" (unless explicitly chosen)
- **Tool Consolidation**: Replace multiple tools with one integrated system (booking, CRM, payments, notifications, analytics)
- **Policy Automation**: Automate policy enforcement (cancellations, no-shows) and payments
- **Retention Focus**: Improve retention with reminders, loyalty, and targeted promotions
- **Scale Ready**: Multi-tenant operations with strong isolation, auditability, and observability

### 1.2 Engineering Principles (Technical Foundation)
- **Multi-tenant by Construction**: Shared schema with tenant_id in every row, enforced by RLS
- **API-first BFF**: Frontends only talk to Flask BFF endpoints, no direct DB access
- **Extreme Modularity**: Each feature as self-contained backend blueprint + frontend folder
- **White-labeling**: Tenant themes, custom domains, runtime CSS tokens
- **Determinism over Cleverness**: Schema constraints enforce invariants
- **Trust & Compliance**: GDPR, PCI minimization, explicit consent
- **Execution Discipline**: Frozen interfaces, contract tests, micro-tickets, feature flags
- **Observability & Safety**: Audit trails, structured logs, Sentry, rate limits, idempotency, outbox/inbox design

### 1.3 Functional Rules (Core Business Logic)
- **Booking Lifecycle**: All bookings prepaid via Stripe, no unpaid bookings allowed
- **Availability Management**: Must always be defined for booking to function, never "empty state"
- **Payment Processing**: Stripe integration with SetupIntents for no-show fees, PCI compliance
- **Notification System**: All emails/SMS in tenant branding, must log to DB for audit
- **Promotion Engine**: Coupons, gift cards, referrals with conditional rules and A/B testing
- **CRM & Analytics**: Customer profiles, segmentation, loyalty programs, revenue tracking
- **Staff Management**: Work schedules, availability, time off, performance tracking

### 1.4 Database Requirements (Schema Truth)
- **Schema Source of Truth**: TITHI_DATABASE_COMPREHENSIVE_REPORT.md contains 39 core tables, 40 functions, 80+ indexes, 98 RLS policies, 62+ constraints, 44 triggers, 4 materialized views
- **RLS Enforcement**: Row Level Security enabled on all tables with deny-by-default policies
- **Tenant Isolation**: Every business table includes tenant_id for complete data separation
- **Overlap Prevention**: GiST exclusion constraints prevent double-booking of resources
- **Idempotency**: Unique constraints on (tenant_id, client_generated_id) for reliable retries
- **Audit Trail**: Comprehensive logging with 12-month retention and GDPR compliance
- **Performance**: Composite indexes on (tenant_id, created_at) for time-series queries
- **Extensions**: pgcrypto, citext, btree_gist, pg_trgm for UUID generation, case-insensitive text, overlap prevention, text search

### 1.5 Integration Rules (System Architecture)
- **API-First Design**: All frontend interactions through Flask BFF endpoints
- **Background Processing**: Redis + Celery for reliable event delivery and retries
- **Real-time Updates**: WebSocket integration for live availability and booking updates
- **External Providers**: Stripe (payments), Twilio (SMS), SendGrid (email), Google Calendar sync
- **Event Sourcing**: Outbox/inbox pattern for reliable external integrations
- **Health Monitoring**: /health/live and /health/ready endpoints for system status
- **Rate Limiting**: Token bucket per IP, user, tenant to prevent abuse
- **Feature Flags**: feature.<key> gating in config/DB for controlled rollouts

### 1.6 Compliance & Security Requirements
- **GDPR Compliance**: Data anonymization, consent tracking, export/delete capabilities
- **PCI DSS Compliance**: No raw card data storage, Stripe-only payment processing
- **Audit Logging**: Complete trail for all operations with user attribution
- **Data Retention**: 12-month retention policy with automated cleanup
- **PII Protection**: Field-level encryption, redacted logs, secure token storage
- **Access Control**: Role-based permissions with tenant-scoped enforcement

## 2. Platform Architecture & User Experience

### 2.1 Platform Architecture & User Management
- **Main Tithi Platform**: Homepage with "Get on Tithi" and "Login" buttons
- **User Types**: Tithi users (business owners/staff) vs. Customers (no platform accounts)
- **Business Selection**: Multi-business access for users with multiple tenant relationships
- **Role Management**: Owner, Admin, Staff roles with permission matrices
- **Customer System**: No customer logins - customers exist only as CRM records in business databases

### 2.2 Booking Flow Customization & User Experience
- **Complete Customization**: Businesses can fully customize how their booking flow looks and works
- **Visual Flow Builder**: Drag-and-drop interface for reordering booking steps
- **Custom Fields**: Dynamic field creation with conditional logic and validation
- **A/B Testing**: Framework for testing different booking flow variations
- **Mobile-First Design**: Apple-quality UX with black/white theme, touch-optimized interface
- **Offline-First PWA**: Full offline capability for core booking flow with background sync

### 2.3 UI/UX Design Requirements
- **Apple-Quality UX**: Intuitive, clean, elderly-friendly interface design
- **Black/White Theme**: Modern, high-contrast, professional appearance
- **Touch-Optimized**: Large tap targets, responsive layouts for mobile-first design
- **Sub-2s Load Time**: Optimized for 3G networks with fast loading
- **Fully Offline-Capable**: Core booking flow works without internet connection
- **Visual Flow Builder**: Drag-and-drop interface for booking flow customization
- **Real-Time Preview**: Live preview of branding changes and booking flow modifications
- **Accessibility**: ARIA compliance, screen reader support, keyboard navigation

## 3. Business Features & Functionality

### 3.1 Admin Dashboard (13 Core Modules)
- **Availability Scheduler**: Drag-and-drop time slot creation, Google Calendar sync
- **Services & Pricing**: CRUD interface, bulk updates, category management
- **Booking Management**: Sortable table, bulk actions, payment tracking
- **Visual Calendar**: FullCalendar integration, drag-and-drop management
- **Analytics Dashboard**: Modular widgets, customizable dashboards
- **Client CRM**: Customer database, lifetime value, segmentation
- **Promotions Engine**: Coupon creation, referral programs, A/B testing
- **Gift Card Management**: Creation, sales tracking, redemption history
- **Notification Settings**: Template editor, timing configuration
- **Team Management**: Staff profiles, schedules, performance tracking
- **Branding Controls**: Live preview, color management, custom CSS
- **Financial Reports**: Revenue reporting, Stripe integration, tax tracking
- **Customer Database**: No customer logins - CRM records only

### 3.2 Comprehensive Analytics System (40+ Metrics)
- **Revenue Analytics**: Total revenue, revenue by service/staff, average transaction value, seasonal patterns
- **Customer Analytics**: New vs. returning customers, lifetime value, retention rates, churn analysis
- **Booking Analytics**: Conversion rates, peak hours, cancellation patterns, source tracking
- **Service Analytics**: Popular services, profitability analysis, cross-selling success rates
- **Staff Performance**: Bookings per staff, revenue generation, utilization rates, customer ratings
- **Operational Analytics**: No-show rates, wait times, capacity utilization, scheduling optimization
- **Marketing Analytics**: Promotion effectiveness, referral performance, social media impact
- **Financial Analytics**: Cash flow analysis, tax tracking, profit margins, cost analysis
- **Competitive Intelligence**: Market analysis, pricing insights, demand forecasting

### 3.3 Notification & Communication System
- **SMS Integration**: Twilio API with template system, delivery tracking, opt-out handling
- **Email Integration**: SendGrid API with rich templates, bounce handling, A/B testing
- **Automated Triggers**: Event-driven notifications (booking created, payment received)
- **Scheduled Notifications**: 24h/1h reminders, follow-up sequences
- **Template Management**: Rich text editor, variable system, multi-language support
- **Customer Preferences**: SMS vs. email preferences, opt-in/opt-out management

### 3.4 Monetization & Business Model
- **Flat Monthly Pricing**: First month free, then $11.99/month
- **Stripe Connect**: Per-tenant payouts and subscription management
- **Payment Methods**: Cards, Apple Pay, Google Pay, PayPal, cash (with no-show collateral)
- **Cash Payment Policy**: 3% no-show fee with card on file via SetupIntent
- **Gift Cards & Promotions**: Digital gift cards, coupon system, referral programs

## 4. Technical Infrastructure & Architecture

### 4.1 Technical Infrastructure
- **Offline-First PWA**: Service Worker, IndexedDB, background sync, optimistic UI
- **Multi-Tenant Architecture**: RLS enforcement, tenant-scoped caching, resource isolation
- **Real-Time Features**: Socket.IO, tenant-scoped rooms, live updates
- **Plugin Architecture**: Modular system for easy feature addition and modification
- **API-First Design**: RESTful APIs, webhook system, SDK development
- **Feature Flag System**: Dynamic feature enabling, A/B testing, gradual rollouts

### 4.2 Modularity & Extensibility Framework
- **Extreme Modularity**: Each feature completely independent and swappable
- **Micro-Frontend Approach**: Admin app and public booking interface can split into separate builds
- **Pluggable Backend Services**: Easy to swap, modify, or extend any functionality
- **Container-Based Design**: Every feature in its own container
- **API-First Architecture**: All functionality accessible via well-documented APIs
- **Component Library System**: Reusable UI components across all features
- **Future-Proofing**: Easy feature addition, simple modification, scalable extensions
- **Technology Flexibility**: Ability to integrate new technologies as they emerge

### 4.3 Onboarding Flow Requirements (12 Steps)
- **Business Information**: Name, type, address, phone, email, website, subdomain generation
- **Owner Details & Team Setup**: Primary admin account, team invitations, role assignment
- **Services & Pricing**: Dynamic service creation, categories, bulk import, image management
- **Availability & Scheduling**: Weekly schedule builder, holiday management, time zone handling
- **Team Member Management**: Staff profiles, scheduling preferences, service assignments
- **Branding & Customization**: Color picker, logo upload, font selection, custom domain setup
- **Promotions & Marketing**: Coupon creation, referral programs, discount rules
- **Gift Card Configuration**: Denomination setup, digital delivery, redemption tracking
- **Notification Settings**: SMS/email templates, timing configuration, opt-in management
- **Payment Methods & Billing**: Stripe Connect, payment options, no-show fee policies
- **Review & Go Live**: Comprehensive review, test booking flow, domain activation
- **Modularity**: Each step is a separate React component that can be reordered, skipped, or extended

## 5. Success Metrics & Performance Targets

### 5.1 Performance Targets
- **Booking Flow Performance**: <60 seconds completion time (even offline)
- **App Load Performance**: <2 seconds on 3G networks
- **Uptime Target**: 99.9% availability
- **Data Security**: Zero data leakage across tenants
- **Admin Efficiency**: Configure coupons/forms without developer assistance
- **Subscription Management**: Graceful enforcement after 30-day trial period
- **Trial Visibility**: Countdown visible to tenants
- **Feature Extensibility**: Feature toggles extensible without system rewrite

### 5.2 Trust-First Messaging & Onboarding
- **Zero-Risk Message**: "Transform your booking process with zero risk. No setup fees, no monthly costs for 90 days, no contracts."
- **Clear Value Proposition**: "You only pay a small percentage when we bring you new customers — after 3 months, just $10/month flat."
- **Transparent Pricing**: First month free, then $11.99/month flat rate
- **No Hidden Fees**: Clear communication of all costs and policies
- **Trial Period**: 30-day free trial with clear countdown and upgrade prompts




## 6. Database Architecture & Backend Integration

### 6.1 Backend-Database Relationship
```
Flask Backend (Python 3.11+)
   ↓ (SQLAlchemy 2.x + psycopg3)
PostgreSQL (Supabase) with RLS
   ↓ (Row Level Security)
Multi-tenant Data Isolation
   ↓ (Redis + Celery)
Background Processing & Caching
   ↓ (WebSocket)
Real-time Updates
```

### 6.2 Critical Database Infrastructure
- **Extensions**: `pgcrypto`, `citext`, `btree_gist`, `pg_trgm`
- **RLS Context**: `SET LOCAL "request.jwt.claims" = <claims>`
- **Helper Functions**: `current_tenant_id()`, `current_user_id()`
- **Constraints**: GiST exclusion for booking overlaps, composite indexes on `(tenant_id, created_at)`
- **Idempotency**: Unique constraints on `(tenant_id, client_generated_id)`

### 6.3 Backend-Database Integration Patterns
1. **RLS Enforcement**: Every query must be tenant-scoped via helper functions
2. **Transaction Management**: Atomic operations with proper rollback
3. **Connection Pooling**: Efficient database connection management
4. **Migration Strategy**: Alembic with idempotent migrations
5. **Audit Logging**: All database changes tracked with tenant context

### 6.4 Critical Design Principles
1. **Multi-tenant by Construction**: Shared schema with tenant_id in every row, enforced by RLS
2. **API-first BFF**: Frontends only talk to Flask BFF endpoints, no direct DB access
3. **Extreme Modularity**: Each feature as self-contained backend blueprint + frontend folder
4. **White-labeling**: Tenant themes, custom domains, runtime CSS tokens
5. **Determinism over Cleverness**: Schema constraints enforce invariants
6. **Trust & Compliance**: GDPR, PCI minimization, explicit consent
7. **Execution Discipline**: Frozen interfaces, contract tests, micro-tickets, feature flags

### 6.5 Key Infrastructure Patterns
- **Outbox/Inbox**: Write events to events_outbox for reliable external delivery
- **Idempotency**: client_generated_id + DB partial unique indexes
- **GiST Exclusion**: tstzrange & GiST exclude constraints for booking overlaps
- **Rate Limiting**: Token bucket per IP, user, tenant
- **Feature Flags**: feature.<key> gating in config/DB for rollouts
- **Health Endpoints**: /health/live and /health/ready






## 7. Phase Context & Task Management

### 7.1 Phase ENDGOALS (tasks makeup phases)
## Phase 6 — NFRs, Testing, CI/CD, Deployment (Global across all modules) - COMPLETION CRITERIA

**End Goal:** System non-functional requirements fully met — performance, security, reliability, maintainability, observability, compliance. CI/CD pipelines validate correctness; deployments follow safe practices.

**Requirements:**

**Performance**
- API median response < 500ms; public booking flow < 2s on 3G.
- Caching layer (Redis) integrated for tenant bootstrap and availability queries.
- Contract tests and load tests validate performance SLAs.

**Security**
- RLS enforced on all tables.
- JWT verification and rotation implemented.
- Field-level encryption for sensitive PII.
- PCI compliance verified: no raw card storage.
- Contract/adversarial tests validate RLS, JWT tampering, PII protection.

**Reliability**
- Backup & restore procedures implemented with daily backups & point-in-time recovery.
- Outbox/inbox ensures at-least-once delivery; retry policies in place.
- CI/CD tests validate idempotency, failover, and partial failure handling.

**Maintainability**
- Frozen DTOs and migrations enforced.
- Contract tests and OpenAPI spec generation automated.
- Micro-ticket system used for task tracking.

**Observability**
- Structured logs, Sentry, Prometheus metrics fully integrated.
- Alerts configured for failures, high no-show rates, provider outages.

**Compliance**
- GDPR flows for export/delete implemented per tenant and per customer.
- Marketing opt-in enforced for notifications.
- Audit logs capture PII access and changes.

**CI/CD**
- Linting, unit tests, contract tests, pgTAP validation pass before merge.
- Integration tests run in staging.
- Canary/feature flag deployment supported.
- Rollback plan tested and documented.

**Phase Completion Criteria:**
- All NFRs verified via automated tests and staging verification.
- CI/CD pipelines fully operational; deployments to production follow safe, repeatable steps.
- Observability and alerting systems operational.
- GDPR, PCI, and other compliance requirements validated.

---
---
### 7.2 Reference to Backend Report & Historical Files
**Authoritative Sources**: Before execution, the executor must read and cross-reference backend_report.md and all previously generated files for this project.

**Purpose**: Ensure continuity, avoid re-implementing already delivered components, and preserve consistency across phases.

**Scope**:
- Review completed modules, migrations, API specs, and config files already defined
- Cross-check existing deliverables before generating new ones
- If inconsistencies or unclear overlaps are found, lower the confidence score and ask clarifying questions before proceeding

**Rule**: The backend report and historical artifacts act as the state of record for what is implemented to date. No changes or assumptions should be made without reconciling against these files.

**Execution Impact**: Executor must integrate new work with existing structure, not overwrite it blindly.

### 7.3 Backend Report Documentation Requirements
**CRITICAL: Every executor MUST append detailed implementation steps to backend_report.md after completing any task.**

#### 7.3.1 Mandatory Documentation Standards
- **File Location**: `backend_report.md` (root directory)
- **Update Frequency**: After EVERY task completion
- **Detail Level**: Comprehensive step-by-step implementation record
- **Format**: Follow existing report structure and formatting

#### 7.3.2 Required Documentation Sections for Each Task
For every task completed, the executor MUST append the following sections to backend_report.md:

**A. Task Implementation Header**
```markdown
#### Step X: [Task Name] (Task X.X)
**Files Created:**
1. `path/to/file1.py` - Description of file purpose
2. `path/to/file2.py` - Description of file purpose
[N] `path/to/fileN.py` - Description of file purpose

**Files Modified:**
1. `path/to/existing_file.py` - Description of changes made
2. `path/to/another_file.py` - Description of changes made
```

**B. Implementation Details**
```markdown
**Implementation Details:**
- [Specific implementation approach taken]
- [Key architectural decisions made]
- [Integration points with existing code]
- [Database changes or migrations applied]
- [Configuration changes made]
- [Dependencies added or updated]
```

**C. Key Features Implemented**
```markdown
**Key Features Implemented:**
- [Feature 1]: [Description of what was implemented]
- [Feature 2]: [Description of what was implemented]
- [Feature N]: [Description of what was implemented]
```

**D. Issues Encountered & Resolved**
```markdown
**Issues Encountered & Resolved:**
#### Issue 1: [Issue Title] (P[Priority] - RESOLVED)
**Problem:** [Detailed description of the problem]
**Root Cause:** [Analysis of why the problem occurred]
**Solution Applied:**
- **File:** `path/to/file.py`
- **Fix:** [Specific changes made]
- **Result:** [Outcome of the fix]
**Impact:** [How this resolution affected the system]
```

**E. Testing & Validation**
```markdown
**Testing & Validation:**
- [Test files created or modified]
- [Test cases added]
- [Validation steps performed]
- [Test results and coverage]
- [Integration testing performed]
```

**F. Integration & Dependencies**
```markdown
**Integration & Dependencies:**
- [How this task integrates with existing modules]
- [Dependencies on other tasks or modules]
- [Impact on existing functionality]
- [Database schema changes]
- [API endpoint changes]
```

#### 7.3.3 Documentation Quality Standards
- **Completeness**: Every file created or modified must be documented
- **Accuracy**: All implementation details must be factually correct
- **Clarity**: Use clear, professional language
- **Consistency**: Follow the established format and structure
- **Traceability**: Link back to specific task requirements and phase goals

#### 7.3.4 Update Process
1. **Before Starting Task**: Read current backend_report.md to understand existing state
2. **During Implementation**: Take notes of all changes, decisions, and issues
3. **After Task Completion**: Immediately append comprehensive documentation to backend_report.md
4. **Validation**: Ensure all changes are properly documented and traceable

#### 7.3.5 Critical Success Factors
- **No Task Completion Without Documentation**: Every task must be fully documented
- **Real-Time Updates**: Documentation must be updated immediately after task completion
- **Comprehensive Coverage**: Every file, change, decision, and issue must be recorded
- **Professional Quality**: Documentation must meet professional standards for maintainability
- **Future Reference**: Documentation must enable future developers to understand and build upon the work

**ENFORCEMENT**: Any executor who fails to properly document their implementation steps in backend_report.md will be considered to have not completed the task successfully, regardless of code quality or functionality.

### 7.4 Task Placement
Every atomic prompt will contain a **Task Definition Block** (see Section 8). This is the *only* source of truth for what the executor should deliver in this run. 

- If missing or ambiguous → lower confidence, ask clarifying questions
- If present and unambiguous → treat it as authoritative

### 7.5 Confidence Score Workflow
- Confidence Score (0–100%) must be declared
- If <100%: stop execution, list reasons for doubt, and ask clarifying questions
- If 100%: explain why, then proceed with generation
- No code or deliverables may be produced below 100%

## 8. Task Definition Block (Embedded Atomic Task)

## Phase 6

### Task 6.1: Coupons & Gift Codes
**Context:** Allow tenants to create coupons/gift codes for customers.

**Deliverable:**
- `/promotions/coupons` CRUD
- `coupons` table

**Constraints:**
- Code unique per tenant
- Expiry dates enforced

**Inputs/Outputs:**
- Input: {code, discount, expiry}
- Output: coupon record

**Validation:** Expired coupons rejected

**Testing:** Apply coupon → discount applied

**Dependencies:** Task 5.1

**Executive Rationale:** Promotions drive customer acquisition and retention.

**North-Star Invariants:**
- Discount never exceeds 100%
- Expired coupons never valid

**Contract Tests (Black-box):** Given a coupon expired yesterday, When applied at checkout, Then system rejects with TITHI_COUPON_EXPIRED.

**Schema/DTO Freeze Note:** `coupons` schema frozen.

**Observability Hooks:** Emit `COUPON_REDEEMED`

**Error Model Enforcement:**
- `TITHI_COUPON_INVALID`
- `TITHI_COUPON_EXPIRED`

**Idempotency & Retry Guarantee:** Coupon redemption atomic

---



## 9. Execution Standards & Requirements

### 9.1 Environment Defaults
- **Development**: local DB, dummy Stripe, emails → console 
- **Staging**: test DB, test Stripe, emails → test inbox 
- **Production**: real DB, real Stripe, real emails 

### 9.2 Tenant Safeguards
- No cross-tenant data sharing
- Owner/Admin roles only (no staff roles in v1)
- Fallback branding: neutral (black/white font, no "Tithi" mention)

### 9.3 Database Schema Alignment
- Reference `all_migrations_consolidated.txt` as schema source of truth
- Never create schema drift
- If schema not clear, ask for clarification before proceeding

### 9.4 Booking & Availability
- All bookings prepaid via Stripe
- Availability must never be "empty state"
- Holidays, buffers, and exceptions configurable

### 9.5 Notifications
- All emails/SMS in tenant branding
- Must log notifications to DB for audit

### 9.6 Error Handling & Observability
- Structured logs + error codes
- Example: `TITHI_BOOT_FAILURE` if env vars missing
- Metrics: latency, startup, DB queries

### 9.7 Instruction Checklist
Each deliverable must explicitly address:
- Business logic enforcement
- Multi-tenant safety
- Idempotency (if applicable)
- Observability hooks
- Integration guidance
- UI/Admin validation points

## 10. Execution Workflow & Task Excellence

### 10.1 Execution Workflow
**CRITICAL: Every executor must follow this workflow with 100% adherence to task requirements and Tithi's goals. No shortcuts, no assumptions, no compromises on quality or completeness.**

1. **Task Analysis & Prioritization**
   - Read **Design Brief**, **Context Pack**, **Task Definition Block**, and **TITHI_DATABASE_COMPREHENSIVE_REPORT.md**
   - Understand the specific task requirements and how they contribute to the current phase's end goals
   - Prioritize task execution to ensure maximum progress toward fulfilling the phase's requirements
   - Identify all dependencies and prerequisites before proceeding

2. **Schema & Migration Check (MANDATORY)**
   - Verify all DB interactions, migrations, and entity shapes against TITHI_DATABASE_COMPREHENSIVE_REPORT.md
   - Cross-reference with all_migrations_consolidated.txt for schema consistency
   - If mismatches are found → stop, ask clarifying questions before continuing
   - Ensure no schema drift or contradictions with established database truth

3. **Confidence Assessment & Validation**
   - Assign Confidence Score (0-100%)
   - If <100%: stop, explain uncertainty, ask questions, do not proceed
   - If 100%: explain why, then proceed with complete confidence
   - No code or deliverables may be produced below 100% confidence

4. **Task Contextualization & Goal Alignment**
   - Summarize planned deliverable in plain English
   - Explicitly tie back to current phase end goals and requirements
   - Contextualize how this specific task execution advances Tithi's overall mission
   - Ensure the task contributes meaningfully to the phase's success criteria

5. **Deterministic Implementation**
   - Generate code/config/tests deterministically with complete adherence to requirements
   - Follow all established patterns, conventions, and architectural principles
   - Implement with production-ready quality and comprehensive error handling
   - Ensure all deliverables meet the highest standards of completeness and correctness

6. **Comprehensive Validation**
   - Validate against all invariants, contract tests, and error models
   - Ensure multi-tenant safety and data isolation
   - Verify idempotency and determinism requirements
   - Check compliance with GDPR, PCI, and security requirements

7. **Determinism & Idempotency Verification**
   - Validate retries and re-runs won't cause duplication or state corruption
   - Ensure outputs are consistent for identical inputs
   - Test edge cases and failure scenarios
   - Verify all business logic is deterministic and reliable

8. **Phase Goal Alignment Confirmation**
   - Confirm alignment with current phase end goals
   - Verify the deliverable advances the phase toward completion
   - Ensure no regressions or conflicts with existing functionality
   - Validate that the task execution brings the phase closer to its success criteria

9. **Documentation & Progress Tracking**
   - Update backend_report.md with comprehensive details of what was accomplished
   - Document any new patterns, conventions, or architectural decisions
   - Record lessons learned and best practices for future reference
   - Ensure all changes are properly tracked and auditable

10. **Final Deliverable & Rationale**
    - Output final deliverable with comprehensive rationale
    - Explain how the deliverable fulfills the task requirements
    - Demonstrate alignment with Tithi's goals and phase objectives
    - Provide clear guidance for integration and next steps

**EXECUTION PRINCIPLE: Every task must be executed with the understanding that it is a critical building block toward Tithi's success. No task is too small to be done perfectly, and every deliverable must contribute meaningfully to the platform's mission and the current phase's objectives.**

### 10.2 Task Execution Excellence & Progress Alignment

#### Task Prioritization & Perfect Execution
**Every executor must prioritize task completion and ensure perfect execution that directly advances the current phase toward its end goals.**

##### Task Understanding & Prioritization
- **Deep Task Analysis**: Before starting any work, thoroughly understand what the task requires and how it fits into the broader phase objectives
- **Phase Goal Alignment**: Every task must be executed with the explicit understanding of how it contributes to fulfilling the current phase's requirements
- **Dependency Mapping**: Identify all prerequisites and dependencies to ensure smooth execution and avoid blocking other tasks
- **Progress Maximization**: Prioritize task execution to achieve maximum progress toward phase completion criteria

##### Perfect Execution Standards
- **100% Requirement Fulfillment**: Every task must be completed to 100% of its specified requirements with no shortcuts or compromises
- **Production-Ready Quality**: All deliverables must meet production standards for reliability, security, and maintainability
- **Comprehensive Implementation**: Address all aspects of the task including business logic, error handling, testing, documentation, and observability
- **Zero Technical Debt**: Implement solutions that don't create future maintenance burden or architectural inconsistencies

##### Phase Progress Alignment
- **Goal-Oriented Execution**: Every task execution must be consciously aligned with advancing the current phase toward its end goals
- **Success Criteria Focus**: Understand the phase completion criteria and ensure each task contributes meaningfully to achieving them
- **Incremental Value**: Each task should build upon previous work and create a solid foundation for subsequent tasks
- **Cohesive Integration**: Ensure all task deliverables integrate seamlessly with existing systems and planned future work

##### Quality Assurance & Validation
- **Comprehensive Testing**: Implement thorough unit, integration, and contract tests that validate all functionality
- **Error Handling**: Address all possible error scenarios with appropriate error codes and user-friendly messages
- **Security Validation**: Ensure all security requirements are met including RLS, data isolation, and compliance
- **Performance Considerations**: Implement solutions that meet performance requirements and don't introduce bottlenecks

##### Documentation & Knowledge Transfer
- **Complete Documentation**: Document all implementation decisions, patterns, and architectural choices
- **Clear Rationale**: Provide clear explanations for why specific approaches were chosen
- **Integration Guidance**: Include clear instructions for how the deliverable integrates with existing systems
- **Future Considerations**: Document any assumptions or limitations that may affect future development

**CRITICAL SUCCESS FACTOR: Every task execution must be viewed as a strategic step toward Tithi's overall success. The quality and completeness of each task directly impacts the platform's ability to deliver on its mission and serve its users effectively.**







 