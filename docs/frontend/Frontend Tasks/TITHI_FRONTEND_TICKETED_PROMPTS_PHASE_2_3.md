e# Tithi Frontend Ticketed Prompts - Phase 2 & 3

**Document Purpose**: Mature ticketed prompts for Phase 2 (Onboarding Core) and Phase 3 (Extended Onboarding) from the approved Frontend Task Graph.

**Source References**: 
- Frontend Task Graph: Phase 2 (T04-T07, T07A) and Phase 3 (T08-T11)
- TITHI_FRONTEND_DESIGN_BRIEF.md
- frontend-context-pack/all_context_pack.ts

---

## Phase 2 Overview - "Onboarding Core"

**Goal**: Build the first four steps of the 8-step onboarding wizard so a newly signed-up business can get to a working tenant with brand, services, and base availability.

**Exit Criteria to advance to Phase 3**:
✅ Steps 1–4 are fully functional, accessible (WCAG 2.1 AA), and mobile-first.
✅ Each step persists to backend APIs with proper idempotency, error handling, and retry-after on 429.
✅ DTOs are stable or stubbed from T00 – API Contracts Addendum; no "OPEN_QUESTION" left unresolved.
✅ Observability: events emitted (onboarding.step_complete, failures) validated against taxonomy (T39).
✅ Performance: LCP p75 < 2.0 s on each step; bundle under 500 KB initial.
✅ UX complete: keyboard nav, focus order, ARIA labels, error toasts via TithiError.
✅ Branding/theming tokens (T03) applied; no "Tithi" leak on public surfaces.

---

## T04 — Onboarding Step 1: Business Details

You are implementing Task T04: Onboarding Step 1: Business Details from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §3.1**: "First step of the onboarding wizard. Captures business identity, location, contact info, staff pre-list and social links to seed later steps and public pages."
- **CP §"API: /tenants"**: POST /onboarding/register, GET /onboarding/check-subdomain/{slug}
- **Brief §3.1**: "Business name, description, timezone selection" + "Staff list rows (role, name) autocolor; editable later"

This task covers the initial business setup form that captures core tenant information and staff pre-list for later availability configuration.

### 1. Deliverables
**Code**:
- `/src/pages/onboarding/Step1BusinessDetails.tsx`
- `/src/components/onboarding/BusinessDetailsForm.tsx`
- `/src/components/onboarding/StaffRepeater.tsx`
- `/src/components/onboarding/AddressGroup.tsx`
- `/src/components/onboarding/SocialLinksForm.tsx`
- `/src/hooks/useSubdomainValidation.ts`
- `/src/hooks/useBusinessDetailsForm.ts`

**Contracts**:
- `BusinessDetailsFormData` interface
- `StaffMember` interface
- `AddressData` interface
- `SocialLinksData` interface

**Tests**:
- `BusinessDetailsForm.test.tsx`
- `StaffRepeater.test.tsx`
- `useSubdomainValidation.test.ts`
- `onboarding-step1.e2e.spec.ts`

### 2. Constraints
- **Branding**: Use design tokens from T03, no "Tithi" branding visible
- **A11y**: WCAG 2.1 AA compliance, keyboard navigation, focus order
- **Performance**: LCP p75 < 2.0s, form validation < 100ms
- **Layout**: Mobile-first responsive design, XS/SM/MD/LG/XL breakpoints
- **Do-Not-Invent**: All field validation rules must come from backend contracts

### 3. Inputs → Outputs
**Inputs**:
- API: POST /onboarding/register, GET /onboarding/check-subdomain/{slug}
- Dependencies: T01 (API client), T02/T02A (routing & auth), T03 (design tokens)
- Sample payloads from contracts addendum

**Outputs**:
- Page: /onboarding/details
- Form components with validation
- Staff list with auto-assigned colors
- Subdomain validation with live feedback
- Navigation to Step 2 with persisted data

### 4. Validation & Testing
**Acceptance Criteria**:
- All required fields (name, timezone, slug) validate and persist
- Optional fields: DBA, industry, full address, website, phone, support email, social links
- Staff list rows (role, name) with auto-assigned colors
- Subdomain checked live with error messages via TithiError
- Buttons: Save & Continue / Back / Add Staff / Remove Staff

**Unit Tests**:
- Form validation for required/optional fields
- Staff repeater add/remove functionality
- Subdomain validation hook
- Address group validation
- Social links validation

**E2E Tests**:
- Complete form submission flow
- Subdomain validation with existing slug
- Staff list management
- Navigation between steps

**Manual QA**:
- [ ] All fields validate correctly
- [ ] Staff colors auto-assign and persist
- [ ] Subdomain validation works in real-time
- [ ] Form persists data on navigation
- [ ] Keyboard navigation works
- [ ] Mobile responsive design

### 5. Dependencies
**DependsOn**: T01 (API client), T02/T02A (routing & auth), T03 (design tokens)
**Exposes**: Business details data, staff list with colors, tenant slug for Step 2

### 6. Executive Rationale
This is the foundation of tenant creation. If this fails, no business can onboard. Risk: data loss during navigation. Rollback: clear form state, show error toast.

### 7. North-Star Invariants
- Tenant slug must be unique across platform
- Staff colors must be unique within tenant
- All form data must persist across navigation
- No "Tithi" branding visible on form

### 8. Schema/DTO Freeze Note
```typescript
interface BusinessDetailsFormData {
  name: string;
  description?: string;
  timezone: string;
  slug: string;
  dba?: string;
  industry?: string;
  address?: AddressData;
  website?: string;
  phone?: string;
  support_email?: string;
  staff: StaffMember[];
  social_links: SocialLinksData;
}

// SHA-256: a1b2c3d4e5f6... (to be calculated from canonical JSON)
```

### 9. Observability Hooks
- `onboarding.step1_started` - when form loads
- `onboarding.step1_complete` - when step completes successfully
- `onboarding.step1_validation_error` - when validation fails
- `onboarding.subdomain_check` - when subdomain validation runs
- `onboarding.staff_added` - when staff member added

### 10. Error Model Enforcement
- **Validation Errors**: Inline field errors, form-level error summary
- **Network Errors**: TithiError toast with retry option
- **Subdomain Conflicts**: Inline error with suggestion
- **Server Errors**: Generic error toast with support contact

### 11. Idempotency & Retry
- Subdomain validation: GET request, no idempotency needed
- Form submission: POST with idempotency key for duplicate prevention
- Retry strategy: 429 backoff with Retry-After header

### 12. Output Bundle
```typescript
// BusinessDetailsForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const businessDetailsSchema = z.object({
  name: z.string().min(1, 'Business name is required'),
  description: z.string().optional(),
  timezone: z.string().min(1, 'Timezone is required'),
  slug: z.string().min(3, 'Slug must be at least 3 characters'),
  // ... other fields
});

export const BusinessDetailsForm: React.FC = () => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(businessDetailsSchema)
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Form fields implementation */}
    </form>
  );
};
```

**How to verify**:
1. Navigate to /onboarding/details
2. Fill required fields (name, timezone, slug)
3. Add staff members and verify colors auto-assign
4. Test subdomain validation with existing slug
5. Submit form and verify navigation to Step 2
6. Check browser dev tools for observability events

---

## T05 — Onboarding Step 2: Logo & Brand Colors

You are implementing Task T05: Onboarding Step 2: Logo & Brand Colors from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §3.2**: "Lets owner upload brand logo and choose primary color; drives white-label branding"
- **Brief §3.2**: "Drag & drop logo upload from local device (Downloads or any folder)"
- **Brief §3.2**: "Placement rules: very large logo on booking Welcome page header; small logo top-left on every booking page"

This task covers logo upload with crop/preview functionality and primary color selection with contrast validation.

### 1. Deliverables
**Code**:
- `/src/pages/onboarding/Step2LogoColors.tsx`
- `/src/components/onboarding/LogoUploader.tsx`
- `/src/components/onboarding/ColorPicker.tsx`
- `/src/components/onboarding/LogoPreview.tsx`
- `/src/hooks/useLogoUpload.ts`
- `/src/hooks/useColorContrast.ts`
- `/src/utils/imageProcessing.ts`

**Contracts**:
- `LogoUploadData` interface
- `ColorSelectionData` interface
- `ContrastValidationResult` interface

**Tests**:
- `LogoUploader.test.tsx`
- `ColorPicker.test.tsx`
- `useColorContrast.test.ts`
- `onboarding-step2.e2e.spec.ts`

### 2. Constraints
- **Image Constraints**: PNG/JPG/SVG, 640×560 recommended, 2MB max
- **Contrast**: AA ≥ 4.5:1 for text/UI against backgrounds
- **Performance**: LCP < 2s, image processing < 500ms
- **Branding**: No "Tithi" branding visible, white-label compliance
- **Do-Not-Invent**: Image processing rules must match backend constraints

### 3. Inputs → Outputs
**Inputs**:
- Image constraints (PNG/JPG/SVG, 640×560 rec.)
- Contrast rules & palette from T03
- Business details from Step 1

**Outputs**:
- Page: /onboarding/logo-colors
- Logo upload with crop/preview functionality
- Color picker with AA contrast validation
- Placement preview (large/small logo positions)
- Navigation to Step 3 with branding data

### 4. Validation & Testing
**Acceptance Criteria**:
- Validates file type/size, previews with AA ≥ 4.5:1
- Placement preview: large logo on Welcome header, small on other booking pages
- Buttons: Upload, Crop, Remove, Pick Color, Preview, Save & Continue, Back
- Snapshot tests verify white-label (no "Tithi")

**Unit Tests**:
- File type validation (PNG/JPG/SVG)
- File size validation (2MB max)
- Color contrast calculation
- Image crop functionality
- Logo placement preview

**E2E Tests**:
- Complete logo upload flow
- Color selection with contrast validation
- Preview functionality
- Navigation with persisted data

**Manual QA**:
- [ ] Drag & drop logo upload works
- [ ] File type validation works
- [ ] Color contrast validation works
- [ ] Logo placement preview accurate
- [ ] No "Tithi" branding visible
- [ ] Mobile responsive design

### 5. Dependencies
**DependsOn**: T04 (business details), T03 (design tokens)
**Exposes**: Logo URL, primary color, contrast validation results for Step 3

### 6. Executive Rationale
This establishes the visual identity for the business. If this fails, branding is broken. Risk: inaccessible color combinations. Rollback: default color fallback.

### 7. North-Star Invariants
- Logo must be accessible (proper contrast)
- No "Tithi" branding visible
- Image processing must be consistent
- Color selection must meet AA standards

### 8. Schema/DTO Freeze Note
```typescript
interface LogoUploadData {
  file: File;
  cropped_data_url: string;
  placement_preview: {
    large_logo: string;
    small_logo: string;
  };
}

interface ColorSelectionData {
  primary_color: string;
  contrast_ratio: number;
  passes_aa: boolean;
}

// SHA-256: b2c3d4e5f6a1... (to be calculated from canonical JSON)
```

### 9. Observability Hooks
- `onboarding.step2_started` - when step loads
- `onboarding.step2_complete` - when step completes
- `asset_upload_error` - when logo upload fails
- `onboarding.color_contrast_check` - when contrast validation runs
- `onboarding.logo_preview` - when preview is generated

### 10. Error Model Enforcement
- **Upload Errors**: File type/size validation with clear messages
- **Contrast Errors**: Inline warning with color suggestions
- **Processing Errors**: Generic error toast with retry option
- **Network Errors**: TithiError toast with retry

### 11. Idempotency & Retry
- Logo upload: POST with idempotency key
- Color validation: GET request, no idempotency needed
- Retry strategy: 429 backoff with exponential backoff

### 12. Output Bundle
```typescript
// LogoUploader.tsx
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export const LogoUploader: React.FC<{
  onFile: (file: File) => void;
  onError: (error: string) => void;
}> = ({ onFile, onError }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file.size > 2 * 1024 * 1024) {
      onError('File size must be less than 2MB');
      return;
    }
    onFile(file);
  }, [onFile, onError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/svg+xml': ['.svg']
    },
    multiple: false
  });

  return (
    <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-8">
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop the logo here...</p>
      ) : (
        <p>Drag & drop logo here, or click to select</p>
      )}
    </div>
  );
};
```

**How to verify**:
1. Navigate to /onboarding/logo-colors
2. Upload logo file (PNG/JPG/SVG)
3. Test file type and size validation
4. Select primary color and verify contrast validation
5. Check logo placement preview
6. Verify no "Tithi" branding visible
7. Submit and navigate to Step 3

---

## T06 — Onboarding Step 3: Services, Categories & Defaults

You are implementing Task T06: Onboarding Step 3: Services, Categories & Defaults from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §3.3**: "Owners define service catalog (categories, services, pricing, instructions). Seeds both admin and public booking."
- **Brief §3.3**: "Service creation: name, description, duration, default price, category, image upload"
- **Brief §3.3**: "Special requests/notes field settings: show/hide, length limit, suggested quick chips"

This task covers the service catalog creation with categories, pricing, and configuration options.

### 1. Deliverables
**Code**:
- `/src/pages/onboarding/Step3Services.tsx`
- `/src/components/onboarding/CategoryCRUD.tsx`
- `/src/components/onboarding/ServiceCardEditor.tsx`
- `/src/components/onboarding/ChipsConfigurator.tsx`
- `/src/components/onboarding/ServiceImageUploader.tsx`
- `/src/hooks/useServiceCatalog.ts`
- `/src/hooks/useCategoryManagement.ts`

**Contracts**:
- `ServiceCatalogData` interface
- `CategoryData` interface
- `ServiceData` interface
- `ChipsConfiguration` interface

**Tests**:
- `CategoryCRUD.test.tsx`
- `ServiceCardEditor.test.tsx`
- `ChipsConfigurator.test.tsx`
- `onboarding-step3.e2e.spec.ts`

### 2. Constraints
- **API**: POST /api/v1/services (Partial<Service>, idempotent)
- **Performance**: LCP < 2s, form validation < 100ms
- **Validation**: All service data must validate against backend schema
- **Do-Not-Invent**: Service pricing rules must match backend constraints

### 3. Inputs → Outputs
**Inputs**:
- API: POST /api/v1/services (Partial<Service>, idempotent)
- Business details from Step 1
- Branding data from Step 2

**Outputs**:
- Page: /onboarding/services
- Category CRUD functionality
- Service creation with image upload
- Special requests configuration
- Navigation to Step 4 with service catalog

### 4. Validation & Testing
**Acceptance Criteria**:
- CRUD for categories and services (name, price, duration, desc, image)
- Special requests/notes setting (toggle, length limit, suggested chips)
- Pre-appointment instructions saved/displayed downstream
- Buttons: Add Category, Add Service, Upload Image, Save Defaults, Save & Continue, Back
- Persisted server response matches DTO

**Unit Tests**:
- Category CRUD operations
- Service creation and validation
- Image upload functionality
- Special requests configuration
- Form validation for all fields

**E2E Tests**:
- Complete service catalog creation
- Category and service management
- Image upload and preview
- Navigation with persisted data

**Manual QA**:
- [ ] Category CRUD works correctly
- [ ] Service creation with all fields
- [ ] Image upload and preview
- [ ] Special requests configuration
- [ ] Form validation works
- [ ] Mobile responsive design

### 5. Dependencies
**DependsOn**: T01 (API client), T04 (business details)
**Exposes**: Service catalog, categories, special requests config for Step 4

### 6. Executive Rationale
This defines what customers can book. If this fails, no bookings can be made. Risk: incomplete service data. Rollback: clear form state, show error toast.

### 7. North-Star Invariants
- All services must have valid pricing
- Categories must be unique within tenant
- Image uploads must meet size constraints
- Special requests config must be valid

### 8. Schema/DTO Freeze Note
```typescript
interface ServiceData {
  id?: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category?: string;
  image_url?: string;
  special_requests_enabled: boolean;
  special_requests_limit?: number;
  quick_chips: string[];
  pre_appointment_instructions?: string;
}

// SHA-256: c3d4e5f6a1b2... (to be calculated from canonical JSON)
```

### 9. Observability Hooks
- `onboarding.step3_started` - when step loads
- `onboarding.step3_complete` - when step completes
- `onboarding.category_created` - when category is created
- `onboarding.service_created` - when service is created
- `onboarding.image_uploaded` - when service image is uploaded

### 10. Error Model Enforcement
- **Validation Errors**: Inline field errors with clear messages
- **Upload Errors**: File type/size validation
- **Network Errors**: TithiError toast with retry
- **Server Errors**: Generic error toast with support contact

### 11. Idempotency & Retry
- Service creation: POST with idempotency key
- Category creation: POST with idempotency key
- Retry strategy: 429 backoff with Retry-After header

### 12. Output Bundle
```typescript
// ServiceCardEditor.tsx
import React from 'react';
import { useForm } from 'react-hook-form';

export const ServiceCardEditor: React.FC<{
  service?: ServiceData;
  onSave: (service: ServiceData) => void;
  onCancel: () => void;
}> = ({ service, onSave, onCancel }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<ServiceData>({
    defaultValues: service
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div>
        <label>Service Name</label>
        <input {...register('name', { required: true })} />
        {errors.name && <span>Name is required</span>}
      </div>
      {/* Other form fields */}
      <div className="flex gap-2">
        <button type="submit">Save Service</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};
```

**How to verify**:
1. Navigate to /onboarding/services
2. Create categories and services
3. Upload service images
4. Configure special requests settings
5. Test form validation
6. Submit and navigate to Step 4
7. Verify data persists correctly

---

## T07 — Onboarding Step 4: Default Availability

You are implementing Task T07: Onboarding Step 4: Default Availability from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §3.4**: "Business sets default schedule and staff availability"
- **Brief §3.4**: "Weekly visual calendar with block-based entry (drag to create blocks)"
- **Brief §3.4**: "Staff color-coding (from Step 1 staff list); names + roles visible on blocks"

This task covers the availability calendar setup with staff scheduling and recurring patterns.

### 1. Deliverables
**Code**:
- `/src/pages/onboarding/Step4Availability.tsx`
- `/src/components/onboarding/AvailabilityCalendar.tsx`
- `/src/components/onboarding/TimeBlockEditor.tsx`
- `/src/components/onboarding/RecurringPatternEditor.tsx`
- `/src/hooks/useAvailabilityCalendar.ts`
- `/src/hooks/useTimeBlockManagement.ts`
- `/src/utils/availabilityHelpers.ts`

**Contracts**:
- `AvailabilityRule` interface
- `TimeBlock` interface
- `RecurringPattern` interface
- `StaffAvailability` interface

**Tests**:
- `AvailabilityCalendar.test.tsx`
- `TimeBlockEditor.test.tsx`
- `useAvailabilityCalendar.test.ts`
- `onboarding-step4.e2e.spec.ts`

### 2. Constraints
- **API**: /api/v1/availability/rules (from T07A) with recurring/DST support
- **Performance**: LCP < 2s, calendar interaction < 100ms
- **Validation**: Overlap detection and validation
- **Do-Not-Invent**: Availability rules must match backend schema

### 3. Inputs → Outputs
**Inputs**:
- API: /api/v1/availability/rules (from T07A) with recurring/DST support
- Staff list from Step 1
- Service catalog from Step 3

**Outputs**:
- Page: /onboarding/availability
- Calendar with drag-create/resize blocks
- Copy week & recurring patterns
- Overlap validation
- Navigation to Step 5 with availability rules

### 4. Validation & Testing
**Acceptance Criteria**:
- User can add recurring blocks, breaks; copy week; DST safe
- Overlap detection & validation
- Staff names/roles/colors visible
- Buttons: Copy Week, Add Block, Save & Continue, Back

**Unit Tests**:
- Calendar drag and drop functionality
- Time block creation and editing
- Overlap detection logic
- Recurring pattern creation
- DST handling

**E2E Tests**:
- Complete availability setup
- Calendar interaction
- Time block management
- Navigation with persisted data

**Manual QA**:
- [ ] Calendar drag and drop works
- [ ] Time blocks can be created and edited
- [ ] Overlap detection works
- [ ] Staff colors are visible
- [ ] Copy week functionality works
- [ ] Mobile responsive design

### 5. Dependencies
**DependsOn**: T06 (service catalog), T07A (availability rules DTO)
**Exposes**: Availability rules, staff schedules for Step 5

### 6. Executive Rationale
This defines when customers can book. If this fails, no bookings can be scheduled. Risk: conflicting availability rules. Rollback: clear calendar state, show error toast.

### 7. North-Star Invariants
- No overlapping time blocks for same staff
- Staff colors must match Step 1 assignments
- Availability rules must be DST-safe
- All blocks must have valid time ranges

### 8. Schema/DTO Freeze Note
```typescript
interface AvailabilityRule {
  id?: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  break_start?: string;
  break_end?: string;
  is_active: boolean;
}

// SHA-256: d4e5f6a1b2c3... (to be calculated from canonical JSON)
```

### 9. Observability Hooks
- `onboarding.step4_started` - when step loads
- `onboarding.step4_complete` - when step completes
- `onboarding.time_block_created` - when time block is created
- `onboarding.availability_copy_week` - when week is copied
- `onboarding.availability_overlap_detected` - when overlap is detected

### 10. Error Model Enforcement
- **Validation Errors**: Inline calendar errors with clear messages
- **Overlap Errors**: Visual highlighting with resolution suggestions
- **Network Errors**: TithiError toast with retry
- **Server Errors**: Generic error toast with support contact

### 11. Idempotency & Retry
- Availability rule creation: POST with idempotency key
- Rule updates: PUT with idempotency key
- Retry strategy: 429 backoff with Retry-After header

### 12. Output Bundle
```typescript
// AvailabilityCalendar.tsx
import React from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

export const AvailabilityCalendar: React.FC<{
  staff: StaffMember[];
  availability: AvailabilityRule[];
  onUpdate: (rules: AvailabilityRule[]) => void;
}> = ({ staff, availability, onUpdate }) => {
  const handleDragEnd = (result: any) => {
    // Handle drag and drop logic
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="calendar-container">
        {staff.map((member) => (
          <div key={member.id} className="staff-row">
            <div className="staff-info">
              <div 
                className="staff-color" 
                style={{ backgroundColor: member.color }}
              />
              <span>{member.name} - {member.role}</span>
            </div>
            <Droppable droppableId={member.id}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {/* Time blocks */}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
};
```

**How to verify**:
1. Navigate to /onboarding/availability
2. Create time blocks by dragging
3. Test overlap detection
4. Verify staff colors are visible
5. Test copy week functionality
6. Submit and navigate to Step 5
7. Verify availability rules persist

---

## T07A — Availability Rules DTO Wiring

You are implementing Task T07A: Availability Rules DTO Wiring from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §3.4**: "Backfills missing contract for default/staff schedules so Step 4 and admin scheduler work consistently"
- **Brief §3.4**: "Spec from T00 (/docs/availability-rules.md)"

This task ensures the availability rules DTO is properly defined and integrated.

### 1. Deliverables
**Code**:
- `/src/types/availability.ts`
- `/src/validators/availabilityValidators.ts`
- `/src/api/availabilityApi.ts`
- `/src/hooks/useAvailabilityRules.ts`

**Contracts**:
- `AvailabilityRule` interface (finalized)
- `RecurringPattern` interface
- `TimeBlock` interface
- Zod schemas for validation

**Tests**:
- `availabilityValidators.test.ts`
- `availabilityApi.test.ts`
- `useAvailabilityRules.test.ts`

### 2. Constraints
- **DTO**: Must cover recurring, breaks, DST safe
- **Validation**: Must reject overlaps
- **Integration**: Must work with Step 4 and admin scheduler
- **Do-Not-Invent**: All rules must match backend schema

### 3. Inputs → Outputs
**Inputs**:
- Spec from T00 (/docs/availability-rules.md)
- Backend API contracts

**Outputs**:
- TS types and validators
- API integration functions
- Validation schemas

### 4. Validation & Testing
**Acceptance Criteria**:
- DTO covers recurring, breaks, DST safe
- Validator rejects overlaps
- Frontend compiles with new types
- Tests updated

**Unit Tests**:
- DTO validation
- Overlap detection
- DST handling
- API integration

**Integration Tests**:
- End-to-end availability flow
- Backend contract compliance

### 5. Dependencies
**DependsOn**: T00 (API contracts), T07 (availability calendar)
**Exposes**: Finalized availability DTOs for Step 4 and admin scheduler

### 6. Executive Rationale
This ensures consistency between onboarding and admin availability management. If this fails, availability rules are inconsistent. Risk: data corruption. Rollback: revert to previous DTO version.

### 7. North-Star Invariants
- DTO must be consistent across all usage
- Validation must prevent invalid states
- DST handling must be accurate
- Overlap detection must be reliable

### 8. Schema/DTO Freeze Note
```typescript
interface AvailabilityRule {
  id: string;
  tenant_id: string;
  staff_id: string;
  day_of_week: number; // 0-6 (Sunday-Saturday)
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  is_recurring: boolean;
  break_start?: string; // HH:MM format
  break_end?: string; // HH:MM format
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// SHA-256: e5f6a1b2c3d4... (to be calculated from canonical JSON)
```

### 9. Observability Hooks
- `availability.dto_loaded` - when DTO is loaded
- `availability.validation_error` - when validation fails
- `availability.api_error` - when API call fails

### 10. Error Model Enforcement
- **Validation Errors**: Clear error messages for invalid data
- **API Errors**: TithiError handling
- **Schema Errors**: TypeScript compilation errors

### 11. Idempotency & Retry
- API calls: POST/PUT with idempotency key
- Retry strategy: 429 backoff with Retry-After header

### 12. Output Bundle
```typescript
// availability.ts
import { z } from 'zod';

export const availabilityRuleSchema = z.object({
  id: z.string().optional(),
  tenant_id: z.string(),
  staff_id: z.string(),
  day_of_week: z.number().min(0).max(6),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  is_recurring: z.boolean(),
  break_start: z.string().optional(),
  break_end: z.string().optional(),
  is_active: z.boolean(),
});

export type AvailabilityRule = z.infer<typeof availabilityRuleSchema>;

export const validateAvailabilityRules = (rules: AvailabilityRule[]): boolean => {
  // Overlap detection logic
  return true;
};
```

**How to verify**:
1. Check TypeScript compilation
2. Run validation tests
3. Test API integration
4. Verify overlap detection
5. Check DST handling
6. Test with Step 4 integration

---

## Phase 3 Overview - "Extended Onboarding"

**Goal**: Complete the onboarding wizard with notifications, policies, gift cards, and payment setup to get businesses live.

**Exit Criteria to advance to Phase 4**:
✅ Steps 5–8 are fully functional, accessible (WCAG 2.1 AA), and mobile-first.
✅ Each step persists to backend APIs with proper idempotency, error handling, and retry-after on 429.
✅ DTOs are stable or stubbed from T00 – API Contracts Addendum; no "OPEN_QUESTION" left unresolved.
✅ Observability: events emitted (onboarding.step_complete, failures) validated against taxonomy (T39).
✅ Performance: LCP p75 < 2.0 s on each step; bundle under 500 KB initial.
✅ UX complete: keyboard nav, focus order, ARIA labels, error toasts via TithiError.
✅ Branding/theming tokens (T03) applied; no "Tithi" leak on public surfaces.

---

## T08 — Onboarding Step 5: Notifications

You are implementing Task T08: Onboarding Step 5: Notifications from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §3.5**: "Owners configure booking notifications before going live. We provide a templates editor with previews, quiet-hours, and a hard cap of 1 confirmation + up to 2 reminders (max 3 per booking)."
- **Brief §3.5**: "Content editor with placeholders: {customer_name}, {service_name}, {service_duration}, {price}, {booking_date}, {booking_time}, {business_name}, {address}, {staff_name}, {instructions}, {special_requests}, {cancel_policy}, {refund_policy}, {booking_link}, {ics_link}"

This task covers notification template creation with placeholder validation and preview functionality.

### 1. Deliverables
**Code**:
- `/src/pages/onboarding/Step5Notifications.tsx`
- `/src/components/onboarding/NotificationTemplateEditor.tsx`
- `/src/components/onboarding/PlaceholderValidator.tsx`
- `/src/components/onboarding/NotificationPreview.tsx`
- `/src/components/onboarding/QuietHoursConfig.tsx`
- `/src/hooks/useNotificationTemplates.ts`
- `/src/hooks/usePlaceholderValidation.ts`

**Contracts**:
- `NotificationTemplate` interface
- `PlaceholderData` interface
- `QuietHoursConfig` interface

**Tests**:
- `NotificationTemplateEditor.test.tsx`
- `PlaceholderValidator.test.tsx`
- `NotificationPreview.test.tsx`
- `onboarding-step5.e2e.spec.ts`

### 2. Constraints
- **API**: POST /api/v1/notifications/templates
- **Limits**: Max 3 templates total (1 confirmation + up to 2 reminders)
- **Performance**: Editor initial render TTI < 2.0s; template list fetch < 500ms
- **Do-Not-Invent**: Placeholder list must match backend specification

### 3. Inputs → Outputs
**Inputs**:
- API: POST /api/v1/notifications/templates
- DTO: NotificationTemplate with variables & required_variables
- Business timezone (for quiet hours) and social links

**Outputs**:
- Page: /onboarding/notifications
- Template editor with placeholder validation
- Preview functionality with sample data
- Quiet hours configuration
- Navigation to Step 6 with notification templates

### 4. Validation & Testing
**Acceptance Criteria**:
- Can create/edit up to 3 templates total: 1 confirmation (+0 reminders) or 1 confirmation + 1–2 reminders; cannot exceed
- Editor validates required_variables and blocks save when any are missing
- Preview renders with sample data; sends a test (when backend permits)
- Quiet hours respected in scheduling UI; show policy note

**Unit Tests**:
- Template creation and validation
- Placeholder validation
- Preview functionality
- Quiet hours configuration
- Template limit enforcement

**E2E Tests**:
- Complete notification setup
- Template creation and editing
- Preview functionality
- Navigation with persisted data

**Manual QA**:
- [ ] Template creation works
- [ ] Placeholder validation works
- [ ] Preview functionality works
- [ ] Quiet hours configuration works
- [ ] Template limits enforced
- [ ] Mobile responsive design

### 5. Dependencies
**DependsOn**: T04 (business details), T05 (branding)
**Exposes**: Notification templates, quiet hours config for Step 6

### 6. Executive Rationale
This defines customer communication. If this fails, customers won't receive booking confirmations. Risk: missing notifications. Rollback: default templates, show error toast.

### 7. North-Star Invariants
- Template limit must be enforced (max 3)
- All required placeholders must be present
- Quiet hours must be respected
- Preview must match actual notifications

### 8. Schema/DTO Freeze Note
```typescript
interface NotificationTemplate {
  id?: string;
  tenant_id: string;
  name: string;
  channel: 'email' | 'sms' | 'push';
  subject?: string;
  content: string;
  variables: Record<string, any>;
  required_variables: string[];
  trigger_event?: string;
  category?: string;
  is_active: boolean;
}

// SHA-256: f6a1b2c3d4e5... (to be calculated from canonical JSON)
```

### 9. Observability Hooks
- `onboarding.step5_started` - when step loads
- `onboarding.step5_complete` - when step completes
- `notifications.template_create` - when template is created
- `notifications.template_update` - when template is updated
- `notifications.preview_sent` - when preview is sent
- `notifications.quiet_hours_violation` - when quiet hours violated

### 10. Error Model Enforcement
- **Validation Errors**: Inline field errors with clear messages
- **Template Limit Errors**: Clear message about limit reached
- **Placeholder Errors**: Highlight missing required placeholders
- **Network Errors**: TithiError toast with retry

### 11. Idempotency & Retry
- Template creation: POST with idempotency key
- Template updates: PUT with idempotency key
- Retry strategy: 429 backoff with Retry-After header

### 12. Output Bundle
```typescript
// NotificationTemplateEditor.tsx
import React from 'react';
import { useForm } from 'react-hook-form';

const PLACEHOLDERS = [
  'customer_name', 'service_name', 'service_duration', 'price',
  'booking_date', 'booking_time', 'business_name', 'address',
  'staff_name', 'instructions', 'special_requests', 'cancel_policy',
  'refund_policy', 'booking_link', 'ics_link'
];

export const NotificationTemplateEditor: React.FC<{
  template?: NotificationTemplate;
  onSave: (template: NotificationTemplate) => void;
  onCancel: () => void;
}> = ({ template, onSave, onCancel }) => {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<NotificationTemplate>({
    defaultValues: template
  });

  const content = watch('content');
  const requiredVariables = watch('required_variables');

  const validatePlaceholders = (content: string, required: string[]) => {
    const missing = required.filter(placeholder => !content.includes(`{${placeholder}}`));
    return missing;
  };

  const missingPlaceholders = validatePlaceholders(content, requiredVariables);

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div>
        <label>Template Name</label>
        <input {...register('name', { required: true })} />
        {errors.name && <span>Name is required</span>}
      </div>
      
      <div>
        <label>Content</label>
        <textarea {...register('content', { required: true })} />
        {errors.content && <span>Content is required</span>}
      </div>

      {missingPlaceholders.length > 0 && (
        <div className="error">
          Missing required placeholders: {missingPlaceholders.join(', ')}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={missingPlaceholders.length > 0}>
          Save Template
        </button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};
```

**How to verify**:
1. Navigate to /onboarding/notifications
2. Create notification templates
3. Test placeholder validation
4. Test preview functionality
5. Configure quiet hours
6. Verify template limits
7. Submit and navigate to Step 6

---

## T09 — Onboarding Step 6: Booking Policies & Confirmation Message

You are implementing Task T09: Onboarding Step 6: Booking Policies & Confirmation Message from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §3.6**: "Owners codify cancellation/no-show/refund policies and craft the confirmation message that surfaces in checkout and the final screen. Checkout must stop unless the policy is acknowledged."
- **Brief §3.6**: "Message editor with quick-paste from service details/instructions/price/duration/selected availability"

This task covers policy creation and confirmation message setup with checkout integration.

### 1. Deliverables
**Code**:
- `/src/pages/onboarding/Step6Policies.tsx`
- `/src/components/onboarding/PolicyEditor.tsx`
- `/src/components/onboarding/ConfirmationMessageEditor.tsx`
- `/src/components/onboarding/CheckoutWarningConfig.tsx`
- `/src/hooks/usePolicyManagement.ts`
- `/src/hooks/useConfirmationMessage.ts`

**Contracts**:
- `BookingPolicy` interface
- `ConfirmationMessage` interface
- `CheckoutWarning` interface

**Tests**:
- `PolicyEditor.test.tsx`
- `ConfirmationMessageEditor.test.tsx`
- `CheckoutWarningConfig.test.tsx`
- `onboarding-step6.e2e.spec.ts`

### 2. Constraints
- **Performance**: Save action round-trip < 500ms; editor input latency under 50ms
- **Validation**: All policies must be valid and enforceable
- **Do-Not-Invent**: Policy rules must match backend constraints

### 3. Inputs → Outputs
**Inputs**:
- UI fields (policy editor): cancellation cutoff, no-show fee (percent/flat), refund presets, cash logistics copy
- Message editor with quick-paste from service details/instructions/price/duration/selected availability

**Outputs**:
- Page: /onboarding/policies
- Rich-text policy and confirmation message editors
- Standardized checkout warning popup + acknowledgement checkbox contract
- Navigation to Step 7 with policies and confirmation message

### 4. Validation & Testing
**Acceptance Criteria**:
- Policies saved; message preview displays exactly as in Public Confirmation
- Checkout cannot proceed without explicit acknowledgement
- Policy text is available to Public pages and Notifications

**Unit Tests**:
- Policy creation and validation
- Confirmation message editing
- Checkout warning configuration
- Form validation for all fields

**E2E Tests**:
- Complete policy setup
- Confirmation message creation
- Checkout warning configuration
- Navigation with persisted data

**Manual QA**:
- [ ] Policy creation works
- [ ] Confirmation message editing works
- [ ] Checkout warning configuration works
- [ ] Form validation works
- [ ] Preview functionality works
- [ ] Mobile responsive design

### 5. Dependencies
**DependsOn**: T05 (notifications), T06 (services)
**Exposes**: Booking policies, confirmation message, checkout warning contract for Step 7

### 6. Executive Rationale
This defines business rules and customer communication. If this fails, checkout flow is broken. Risk: unclear policies. Rollback: default policies, show error toast.

### 7. North-Star Invariants
- All policies must be enforceable
- Confirmation message must be clear
- Checkout warning must be mandatory
- Policy text must be available to all pages

### 8. Schema/DTO Freeze Note
```typescript
interface BookingPolicy {
  id?: string;
  tenant_id: string;
  cancellation_cutoff_hours: number;
  no_show_fee_percent: number;
  no_show_fee_flat_cents?: number;
  refund_policy: string;
  cash_logistics: string;
  is_active: boolean;
}

interface ConfirmationMessage {
  id?: string;
  tenant_id: string;
  content: string;
  is_active: boolean;
}

// SHA-256: a1b2c3d4e5f6... (to be calculated from canonical JSON)
```

### 9. Observability Hooks
- `onboarding.step6_started` - when step loads
- `onboarding.step6_complete` - when step completes
- `policies.save_success` - when policies are saved
- `policies.save_error` - when policy save fails
- `checkout.policy_ack_required` - when policy acknowledgment is required
- `checkout.policy_ack_confirmed` - when policy is acknowledged

### 10. Error Model Enforcement
- **Validation Errors**: Inline field errors with clear messages
- **Policy Errors**: Clear error messages for invalid policies
- **Network Errors**: TithiError toast with retry
- **Server Errors**: Generic error toast with support contact

### 11. Idempotency & Retry
- Policy creation: POST with idempotency key
- Policy updates: PUT with idempotency key
- Retry strategy: 429 backoff with Retry-After header

### 12. Output Bundle
```typescript
// PolicyEditor.tsx
import React from 'react';
import { useForm } from 'react-hook-form';

export const PolicyEditor: React.FC<{
  policy?: BookingPolicy;
  onSave: (policy: BookingPolicy) => void;
  onCancel: () => void;
}> = ({ policy, onSave, onCancel }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<BookingPolicy>({
    defaultValues: policy
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div>
        <label>Cancellation Cutoff (hours)</label>
        <input 
          type="number" 
          {...register('cancellation_cutoff_hours', { required: true, min: 0 })} 
        />
        {errors.cancellation_cutoff_hours && <span>Cutoff is required</span>}
      </div>
      
      <div>
        <label>No-Show Fee (%)</label>
        <input 
          type="number" 
          {...register('no_show_fee_percent', { required: true, min: 0, max: 100 })} 
        />
        {errors.no_show_fee_percent && <span>Fee is required</span>}
      </div>

      <div>
        <label>Refund Policy</label>
        <textarea {...register('refund_policy', { required: true })} />
        {errors.refund_policy && <span>Refund policy is required</span>}
      </div>

      <div className="flex gap-2">
        <button type="submit">Save Policies</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};
```

**How to verify**:
1. Navigate to /onboarding/policies
2. Create booking policies
3. Edit confirmation message
4. Configure checkout warning
5. Test form validation
6. Submit and navigate to Step 7
7. Verify policies persist correctly

---

  ## T10 — Onboarding Step 7: Gift Cards (Optional)

  You are implementing Task T10: Onboarding Step 7: Gift Cards (Optional) from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §3.7**: "Enable an optional gift-card program with denominations and lifecycle controls. Onboarding allows owners to set it up or skip."
- **Brief §3.7**: "Create initial gift cards if desired"

This task covers optional gift card setup with denominations and lifecycle controls.

### 1. Deliverables
**Code**:
- `/src/pages/onboarding/Step7GiftCards.tsx`
- `/src/components/onboarding/GiftCardSetup.tsx`
- `/src/components/onboarding/DenominationEditor.tsx`
- `/src/components/onboarding/GiftCardPreview.tsx`
- `/src/hooks/useGiftCardSetup.ts`
- `/src/hooks/useDenominationManagement.ts`

**Contracts**:
- `GiftCardConfig` interface
- `Denomination` interface
- `GiftCardLifecycle` interface

**Tests**:
- `GiftCardSetup.test.tsx`
- `DenominationEditor.test.tsx`
- `GiftCardPreview.test.tsx`
- `onboarding-step7.e2e.spec.ts`

### 2. Constraints
- **API**: coupons/gift-card endpoints (POST|PUT|DELETE /api/v1/promotions/coupons, validate/stats)
- **Performance**: List/CRUD operations < 500ms; form render TTI < 2.0s
- **Do-Not-Invent**: Gift card rules must match backend constraints

### 3. Inputs → Outputs
**Inputs**:
- API: coupons/gift-card endpoints (POST|PUT|DELETE /api/v1/promotions/coupons, validate/stats)
- Fields: denominations, expiration policy

**Outputs**:
- Page: /onboarding/gift-cards
- Create denominations or Skip & Continue
- Persisted configuration surfaced to Public Checkout (code validation) and Admin stats
- Navigation to Step 8 with gift card configuration

### 4. Validation & Testing
**Acceptance Criteria**:
- Can add at least one denomination (if enabled); expiration policy saved
- Skip preserves ability to enable later in Admin
- Validation endpoint wired for Public Checkout input

**Unit Tests**:
- Gift card creation and validation
- Denomination management
- Expiration policy configuration
- Skip functionality

**E2E Tests**:
- Complete gift card setup
- Denomination creation
- Skip functionality
- Navigation with persisted data

**Manual QA**:
- [ ] Gift card setup works
- [ ] Denomination creation works
- [ ] Expiration policy configuration works
- [ ] Skip functionality works
- [ ] Form validation works
- [ ] Mobile responsive design

### 5. Dependencies
**DependsOn**: T06 (services), T07 (policies)
**Exposes**: Gift card configuration, denominations for Step 8

### 6. Executive Rationale
This enables gift card functionality. If this fails, gift cards are unavailable. Risk: invalid gift card configuration. Rollback: disable gift cards, show error toast.

### 7. North-Star Invariants
- Gift cards must be valid if enabled
- Denominations must be positive amounts
- Expiration policy must be valid
- Skip must preserve future enablement

### 8. Schema/DTO Freeze Note
```typescript
interface GiftCardConfig {
  id?: string;
  tenant_id: string;
  is_enabled: boolean;
  denominations: Denomination[];
  expiration_policy: string;
  is_active: boolean;
}

interface Denomination {
  id?: string;
  amount_cents: number;
  is_active: boolean;
}

// SHA-256: b2c3d4e5f6a1... (to be calculated from canonical JSON)
```

### 9. Observability Hooks
- `onboarding.step7_started` - when step loads
- `onboarding.step7_complete` - when step completes
- `giftcards.enable` - when gift cards are enabled
- `giftcards.disable` - when gift cards are disabled
- `giftcards.denomination_create` - when denomination is created
- `giftcards.denomination_update` - when denomination is updated
- `giftcards.denomination_delete` - when denomination is deleted

### 10. Error Model Enforcement
- **Validation Errors**: Inline field errors with clear messages
- **Gift Card Errors**: Clear error messages for invalid configuration
- **Network Errors**: TithiError toast with retry
- **Server Errors**: Generic error toast with support contact

### 11. Idempotency & Retry
- Gift card creation: POST with idempotency key
- Denomination updates: PUT with idempotency key
- Retry strategy: 429 backoff with Retry-After header

### 12. Output Bundle
```typescript
// GiftCardSetup.tsx
import React, { useState } from 'react';

export const GiftCardSetup: React.FC<{
  onSave: (config: GiftCardConfig) => void;
  onSkip: () => void;
}> = ({ onSave, onSkip }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [denominations, setDenominations] = useState<Denomination[]>([]);

  const handleSave = () => {
    const config: GiftCardConfig = {
      is_enabled: isEnabled,
      denominations,
      expiration_policy: '1 year from purchase',
      is_active: true
    };
    onSave(config);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center">
          <input 
            type="checkbox" 
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
          />
          <span className="ml-2">Enable Gift Cards</span>
        </label>
      </div>

      {isEnabled && (
        <div>
          <h3>Gift Card Denominations</h3>
          <DenominationEditor 
            denominations={denominations}
            onChange={setDenominations}
          />
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleSave}>
          {isEnabled ? 'Save Gift Cards' : 'Skip Gift Cards'}
        </button>
        <button onClick={onSkip}>Skip & Continue</button>
      </div>
    </div>
  );
};
```

**How to verify**:
1. Navigate to /onboarding/gift-cards
2. Enable/disable gift cards
3. Create denominations
4. Configure expiration policy
5. Test skip functionality
6. Submit and navigate to Step 8
7. Verify gift card configuration persists

---

## T11 — Onboarding Step 8: Payments, Wallets & Subscription (GO LIVE)

You are implementing Task T11: Onboarding Step 8: Payments, Wallets & Subscription (GO LIVE) from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §3.8**: "Owners connect payment methods and business identity (KYC), choose supported wallets, accept platform subscription, and then GO LIVE. Rule: Cash bookings require a card-on-file for no-shows."
- **Brief §3.8**: "GO LIVE page: "{Business Name} IS LIVE!!" with confetti, booking link (https://tithi/{businessslug}), buttons: Copy Link, Go to admin view"

This task covers payment setup, KYC, wallet configuration, and the final GO LIVE step.

### 1. Deliverables
**Code**:
- `/src/pages/onboarding/Step8Payments.tsx`
- `/src/components/onboarding/PaymentSetup.tsx`
- `/src/components/onboarding/WalletToggles.tsx`
- `/src/components/onboarding/KYCForm.tsx`
- `/src/components/onboarding/GoLiveModal.tsx`
- `/src/components/onboarding/GoLiveSuccess.tsx`
- `/src/hooks/usePaymentSetup.ts`
- `/src/hooks/useKYCForm.ts`

**Contracts**:
- `PaymentSetupData` interface
- `WalletConfig` interface
- `KYCData` interface
- `GoLiveData` interface

**Tests**:
- `PaymentSetup.test.tsx`
- `WalletToggles.test.tsx`
- `KYCForm.test.tsx`
- `GoLiveModal.test.tsx`
- `onboarding-step8.e2e.spec.ts`

### 2. Constraints
- **API**: Payments Setup Intent (card on file for $11.99/mo)
- **Performance**: Payments UI LCP p75 < 2.0s; network to Stripe < 600ms median; no main-thread long tasks > 200ms
- **Do-Not-Invent**: Payment rules must match backend constraints

### 3. Inputs → Outputs
**Inputs**:
- Payments Setup Intent (card on file for $11.99/mo)
- Toggles: Cards, Apple Pay, Google Pay, PayPal, Cash (cash rule above)
- Business/KYC fields: legal/DBA, representative, payout destination, statement descriptor + phone, currency, tax display behavior

**Outputs**:
- Page: /onboarding/payments
- Stripe Elements mount + wallet toggles
- Consent checkboxes + "Are you sure?" final modal
- GO LIVE success screen: "{Business Name} IS LIVE!!", booking link, Copy Link, Go to Admin
- Navigation to business admin dashboard

### 4. Validation & Testing
**Acceptance Criteria**:
- Setup Intent succeeds; subscription card stored; wallets toggles persisted
- Cash requires card-on-file constraint enforced at save time
- GO LIVE screen appears with working public booking link and admin link
- 3DS flows supported at checkout (prepared for Phase 5 reuse)

**Unit Tests**:
- Payment setup and validation
- Wallet configuration
- KYC form validation
- Go Live modal functionality
- 3DS flow handling

**E2E Tests**:
- Complete payment setup
- Wallet configuration
- KYC form submission
- Go Live flow
- Navigation to admin dashboard

**Manual QA**:
- [ ] Payment setup works
- [ ] Wallet toggles work
- [ ] KYC form validation works
- [ ] Go Live modal works
- [ ] Success screen displays correctly
- [ ] Mobile responsive design

### 5. Dependencies
**DependsOn**: T07 (gift cards), T08 (policies)
**Exposes**: Payment configuration, KYC data, business live status

### 6. Executive Rationale
This completes the onboarding and makes the business live. If this fails, business cannot accept payments. Risk: payment setup failure. Rollback: disable payments, show error toast.

### 7. North-Star Invariants
- Payment setup must be secure
- KYC data must be valid
- Cash rule must be enforced
- Go Live must be irreversible

### 8. Schema/DTO Freeze Note
```typescript
interface PaymentSetupData {
  id?: string;
  tenant_id: string;
  setup_intent_id: string;
  subscription_card_id: string;
  wallets: WalletConfig;
  kyc_data: KYCData;
  is_live: boolean;
  go_live_date?: string;
}

interface WalletConfig {
  cards: boolean;
  apple_pay: boolean;
  google_pay: boolean;
  paypal: boolean;
  cash: boolean;
  cash_requires_card: boolean;
}

// SHA-256: c3d4e5f6a1b2... (to be calculated from canonical JSON)
```

### 9. Observability Hooks
- `onboarding.step8_started` - when step loads
- `onboarding.step8_complete` - when step completes
- `payments.setup_intent_started` - when setup intent starts
- `payments.setup_intent_succeeded` - when setup intent succeeds
- `payments.setup_intent_failed` - when setup intent fails
- `owner.subscription_card_saved` - when subscription card is saved
- `owner.go_live_success` - when business goes live
- `wallets.toggle_update` - when wallet toggles are updated

### 10. Error Model Enforcement
- **Payment Errors**: Clear error messages for payment failures
- **KYC Errors**: Inline field errors with clear messages
- **Network Errors**: TithiError toast with retry
- **Server Errors**: Generic error toast with support contact

### 11. Idempotency & Retry
- Payment setup: POST with idempotency key
- Wallet updates: PUT with idempotency key
- Go Live: POST with idempotency key
- Retry strategy: 429 backoff with Retry-After header

### 12. Output Bundle
```typescript
// PaymentSetup.tsx
import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY!);

export const PaymentSetup: React.FC<{
  onSetupComplete: (setupData: PaymentSetupData) => void;
  onError: (error: string) => void;
}> = ({ onSetupComplete, onError }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      // Stripe setup intent logic
      const setupData = await createSetupIntent();
      onSetupComplete(setupData);
    } catch (error) {
      onError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Elements stripe={stripePromise}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>Card Information</label>
          <CardElement />
        </div>
        
        <div>
          <label className="flex items-center">
            <input type="checkbox" required />
            <span className="ml-2">I agree to the $11.99/month subscription</span>
          </label>
        </div>

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Setting up...' : 'Setup Payment'}
        </button>
      </form>
    </Elements>
  );
};
```

**How to verify**:
1. Navigate to /onboarding/payments
2. Setup payment method
3. Configure wallets
4. Complete KYC form
5. Test Go Live modal
6. Verify success screen
7. Navigate to admin dashboard
8. Verify business is live

---

## Phase 3 Exit Criteria → Phase 4 Entry

To move on to Phase 4 (Owner Surfaces), the following must be true across T08–T11:

✅ **Notifications**: At least one confirmation template saved; total templates respect 1+≤2 cap; placeholders validate; quiet-hours policy set.

✅ **Policies**: Cancellation/no-show/refund policy saved and checkout acknowledgment wiring exported for use in Public Checkout.

✅ **Gift Cards**: Either enabled with denominations (and validation path tested) or explicitly skipped.

✅ **Payments & GO LIVE**: Setup-intent completed, wallets configured (cash rule enforced), KYC saved, GO LIVE page confirmed with booking link.

---

*End of Tithi Frontend Ticketed Prompts - Phase 2 & 3*
