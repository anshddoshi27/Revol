# Tithi Frontend

Frontend application for Tithi - White-label booking and payments platform.

## Project Structure

```
frontend/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Landing page (/)
│   ├── login/page.tsx            # Login page
│   ├── signup/page.tsx           # Signup page (Step 1)
│   ├── app/                      # Authenticated area
│   │   ├── page.tsx              # Dashboard (businesses list)
│   │   └── b/[businessId]/       # Business admin pages
│   ├── onboarding/               # Onboarding wizard
│   │   └── step2/page.tsx        # Step 2 and beyond
│   └── booking/[slug]/           # Public booking flow
│       ├── page.tsx              # Catalog
│       ├── service/[serviceId]/  # Availability
│       ├── checkout/             # Checkout
│       └── confirm/[code]/       # Confirmation
├── components/                   # Reusable components
│   └── layout/
├── lib/                          # Utilities and API
│   ├── api-client.ts            # All API fetch functions
│   ├── hooks.ts                 # React Query hooks
│   └── store.ts                 # Auth state management
└── styles/                       # Global styles
    └── globals.css
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp env.example .env.local
```

3. Configure environment variables:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Run development server:
```bash
npm run dev
```

## API Integration

All API calls are defined in `lib/api-client.ts` with exact endpoint paths matching the backend:

- **Authentication**: `/api/v1/auth/*`
- **Tenants**: `/api/v1/tenants/*`
- **Onboarding**: `/onboarding/step*/*`
- **Bookings**: `/api/v1/bookings/*` and `/booking/*`
- **Payments**: `/api/payments/*`

## Routing

- `/` - Landing page
- `/login` - Owner login
- `/signup` - Account creation (onboarding step 1)
- `/app` - Dashboard (businesses list)
- `/app/b/[businessId]` - Business admin panel
- `/booking/[slug]` - Public booking catalog
- `/booking/[slug]/service/[serviceId]` - Availability selection
- `/booking/[slug]/checkout` - Checkout page
- `/booking/[slug]/confirm/[code]` - Booking confirmation

## State Management

- **Auth**: Context API (`lib/store.ts`)
- **Data Fetching**: React Query (`lib/hooks.ts`)
- **Local State**: React hooks (`useState`, `useEffect`)

## Backend Gaps

See `BACKEND_GAPS.md` for a complete list of backend changes needed.

