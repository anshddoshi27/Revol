# Tithi Frontend Context Pack

Purpose: Single, consistent source of truth for frontend integration, aligned 1:1 with the backend contracts and the Tithi Frontend Design Brief.

Contents
- config.ts: Environment and constants
- apiClient.ts: Axios client with auth, error handling, rate-limit retries, idempotency
- endpoints.ts: Canonical endpoint map matching backend blueprints
- types/: Strongly-typed models mirroring backend schemas
- utils/tenant.ts: Tenant resolution (path or subdomain)
- services/: Domain-specific API wrappers (core + extended)
- index.ts: Public exports

Usage
```ts
import { api, types, getTenantSlug } from '@/frontend-context-pack';

const slug = getTenantSlug();
const services = await api.services.list();
```

Conventions
- Always send Authorization: Bearer <token>
- For critical operations, include Idempotency-Key header
- Handle 429 with backoff (built-in)
- Respect tenant routing patterns consistently

