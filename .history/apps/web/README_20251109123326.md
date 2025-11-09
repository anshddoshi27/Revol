# Tithi Frontend — Phase 1 (Entry & Auth)

This package contains the landing, login, and sign-up experiences for Phase&nbsp;1 of the Tithi build. The UI runs purely on in-memory state and fake data so we can iterate on visual quality before wiring real APIs.

## Getting Started

```bash
cd /Users/3017387smacbookm/Downloads/Career/Tithi/apps/web
npm install
npm run dev
```

Visit `http://localhost:3000` to explore the flows:

- `/` — Landing
- `/login` — Owner login (email/phone toggle)
- `/signup` — Owner account creation
- `/app` — Admin placeholder shell
- `/onboarding` — Onboarding placeholder shell

## Fake Session

The UI uses an in-memory `FakeSessionProvider` (`src/lib/fake-session.tsx`) exposed through the `useFakeSession()` hook. A hard refresh clears the session—expected for this phase. The **Dev Login** action in the login form sets the fake session and redirects to the admin placeholder.

## Design Fidelity & Components

- Typography, spacing, gradients, and button states are enforced per `docs/frontend/frontend logistics.txt`.
- Shared UI primitives live under `src/components/ui/` (`Button`, `Input`, `HelperText`, `Badge`, `Toast`).
- Form validation uses `react-hook-form` + `zod` with inline errors, helper copy, and accessible focus handling.

## Next Steps (Phase 2 Preview)

- Replace fake session with real auth + tenant-aware API calls.
- Build the full onboarding wizard (8 steps) and admin workspace shells.
- Wire Stripe Connect/Billing once backend contracts are finalized.
- Expand the design system to cover tables, calendars, notification editor, and booking cards.


