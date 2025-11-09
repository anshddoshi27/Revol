# Pagination & Filtering Standards

**Document Purpose**: Standardized query parameters, pagination, and filtering rules for all Tithi API list endpoints.

**Version**: 1.0.0  
**Last Updated**: January 27, 2025  
**Status**: Finalized

---

## Overview

All list endpoints in the Tithi API follow consistent pagination and filtering patterns to ensure predictable behavior and optimal performance.

---

## Standard Query Parameters

### Pagination Parameters

All list endpoints support these standard pagination parameters:

```typescript
interface PaginationParams {
  page?: number;        // Page number (1-based, default: 1)
  per_page?: number;    // Items per page (default: 20, max: 100)
  sort_by?: string;     // Field to sort by (endpoint-specific)
  sort_order?: 'asc' | 'desc'; // Sort direction (default: 'asc')
}
```

### Filtering Parameters

Standard filtering parameters across all endpoints:

```typescript
interface StandardFilters {
  search?: string;      // Text search across relevant fields
  created_after?: string;  // ISO 8601 date filter
  created_before?: string; // ISO 8601 date filter
  updated_after?: string;  // ISO 8601 date filter
  updated_before?: string; // ISO 8601 date filter
}
```

---

## Pagination Response Format

### Standard Pagination Meta

All paginated responses include consistent metadata:

```typescript
interface PaginationMeta {
  page: number;           // Current page number
  per_page: number;       // Items per page
  total: number;          // Total number of items
  total_pages: number;    // Total number of pages
  has_next: boolean;      // Whether there's a next page
  has_prev: boolean;      // Whether there's a previous page
  next_page?: number;     // Next page number (if exists)
  prev_page?: number;     // Previous page number (if exists)
}
```

### Example Paginated Response

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
  meta: {
    version: string;
  };
}

// Example response
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Bella's Salon",
      "slug": "bellas-salon",
      "created_at": "2025-01-27T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 45,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false,
    "next_page": 2,
    "prev_page": null
  },
  "meta": {
    "version": "1.0.0"
  }
}
```

---

## Endpoint-Specific Standards

### Tenants List (`GET /api/v1/tenants`)

```typescript
interface TenantsListParams extends PaginationParams, StandardFilters {
  status?: 'active' | 'inactive' | 'suspended';
  include_inactive?: boolean; // Default: false
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'slug';
}

// Example request
GET /api/v1/tenants?page=1&per_page=20&status=active&sort_by=name&sort_order=asc&search=bella
```

### Bookings List (`GET /api/v1/bookings`)

```typescript
interface BookingsListParams extends PaginationParams, StandardFilters {
  status?: BookingStatus[];
  service_id?: string;
  customer_id?: string;
  resource_id?: string;
  start_date?: string; // ISO 8601
  end_date?: string;   // ISO 8601
  sort_by?: 'start_at' | 'created_at' | 'status' | 'customer_name';
}

// Example request
GET /api/v1/bookings?page=1&per_page=50&status=confirmed,pending&start_date=2025-01-01&end_date=2025-01-31&sort_by=start_at&sort_order=asc
```

### Services List (`GET /api/v1/services`)

```typescript
interface ServicesListParams extends PaginationParams, StandardFilters {
  category?: string;
  is_active?: boolean;
  min_price_cents?: number;
  max_price_cents?: number;
  min_duration_minutes?: number;
  max_duration_minutes?: number;
  sort_by?: 'name' | 'price_cents' | 'duration_minutes' | 'created_at';
}

// Example request
GET /api/v1/services?page=1&per_page=20&category=hair&is_active=true&min_price_cents=5000&sort_by=price_cents&sort_order=asc
```

### Customers List (`GET /api/v1/customers`)

```typescript
interface CustomersListParams extends PaginationParams, StandardFilters {
  segment?: string;
  has_bookings?: boolean;
  loyalty_tier?: string;
  last_booking_after?: string; // ISO 8601
  last_booking_before?: string; // ISO 8601
  sort_by?: 'first_name' | 'last_name' | 'email' | 'created_at' | 'last_booking_at';
}

// Example request
GET /api/v1/customers?page=1&per_page=25&has_bookings=true&segment=high_value&sort_by=last_booking_at&sort_order=desc
```

### Staff List (`GET /api/v1/admin/staff`)

```typescript
interface StaffListParams extends PaginationParams, StandardFilters {
  role?: string;
  is_active?: boolean;
  has_availability?: boolean;
  sort_by?: 'first_name' | 'last_name' | 'email' | 'created_at';
}

// Example request
GET /api/v1/admin/staff?page=1&per_page=20&role=stylist&is_active=true&sort_by=first_name&sort_order=asc
```

---

## Search Implementation

### Text Search Behavior

The `search` parameter performs case-insensitive text search across relevant fields:

```typescript
// For tenants: searches name, description, slug
// For bookings: searches customer name, service name, notes
// For services: searches name, description, category
// For customers: searches first_name, last_name, email, phone
```

### Search Examples

```typescript
// Search tenants by name or description
GET /api/v1/tenants?search=bella

// Search bookings by customer or service name
GET /api/v1/bookings?search=john

// Search services by name or category
GET /api/v1/services?search=hair
```

---

## Date Filtering

### Date Range Filters

All date filters accept ISO 8601 format:

```typescript
// Date range examples
GET /api/v1/bookings?start_date=2025-01-01&end_date=2025-01-31
GET /api/v1/customers?created_after=2025-01-01T00:00:00Z
GET /api/v1/tenants?updated_before=2025-01-27T23:59:59Z
```

### Timezone Handling

- All date filters are interpreted in the tenant's timezone
- Responses include timezone information in metadata
- UTC timestamps are used for storage and comparison

---

## Sorting Standards

### Default Sort Orders

```typescript
// Default sort fields by endpoint
const DEFAULT_SORTS = {
  tenants: { sort_by: 'name', sort_order: 'asc' },
  bookings: { sort_by: 'start_at', sort_order: 'asc' },
  services: { sort_by: 'name', sort_order: 'asc' },
  customers: { sort_by: 'last_name', sort_order: 'asc' },
  staff: { sort_by: 'first_name', sort_order: 'asc' }
};
```

### Multi-Field Sorting

For complex sorting needs, use comma-separated fields:

```typescript
// Sort by multiple fields
GET /api/v1/bookings?sort_by=start_at,status&sort_order=asc,desc
```

---

## Performance Considerations

### Pagination Limits

```typescript
const PAGINATION_LIMITS = {
  default_per_page: 20,
  max_per_page: 100,
  max_page: 1000, // Prevents deep pagination
  max_total_items: 10000 // For performance
};
```

### Indexing Strategy

Database indexes are optimized for common filter combinations:

```sql
-- Example indexes for bookings
CREATE INDEX idx_bookings_tenant_status_start ON bookings(tenant_id, status, start_at);
CREATE INDEX idx_bookings_tenant_customer ON bookings(tenant_id, customer_id);
CREATE INDEX idx_bookings_tenant_service ON bookings(tenant_id, service_id);
```

---

## Error Handling

### Validation Errors

Invalid pagination/filtering parameters return 400 with details:

```typescript
interface ValidationErrorResponse {
  type: "validation_error";
  title: "Invalid Query Parameters";
  status: 400;
  detail: "One or more query parameters are invalid";
  validation_errors: {
    field: string;
    message: string;
    value: any;
  }[];
}

// Example error response
{
  "type": "validation_error",
  "title": "Invalid Query Parameters",
  "status": 400,
  "detail": "One or more query parameters are invalid",
  "validation_errors": [
    {
      "field": "per_page",
      "message": "per_page must be between 1 and 100",
      "value": 150
    },
    {
      "field": "sort_by",
      "message": "sort_by must be one of: name, created_at, updated_at",
      "value": "invalid_field"
    }
  ]
}
```

### Common Validation Rules

```typescript
const VALIDATION_RULES = {
  page: { min: 1, max: 1000 },
  per_page: { min: 1, max: 100 },
  sort_order: { enum: ['asc', 'desc'] },
  date_fields: { format: 'ISO 8601' },
  search: { max_length: 100 }
};
```

---

## Caching Strategy

### Response Caching

Paginated responses are cached with appropriate TTL:

```typescript
const CACHE_STRATEGY = {
  tenants_list: { ttl: 300 }, // 5 minutes
  services_list: { ttl: 600 }, // 10 minutes
  bookings_list: { ttl: 60 },  // 1 minute (frequently changing)
  customers_list: { ttl: 300 } // 5 minutes
};
```

### Cache Invalidation

Cache is invalidated when:
- New items are created
- Existing items are updated
- Items are deleted
- Related data changes

---

## Usage Examples

### Frontend Implementation

```typescript
// Example pagination hook
const usePaginatedList = <T>(
  endpoint: string,
  params: Record<string, any> = {}
) => {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const response = await apiClient.get(endpoint, {
        params: { ...params, page, per_page: 20 }
      });
      setData(response.data.data);
      setPagination(response.data.pagination);
    } catch (error) {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [endpoint, params]);

  return { data, pagination, loading, fetchData };
};
```

### Backend Implementation

```python
# Example pagination helper
def paginate_query(query, page=1, per_page=20, max_per_page=100):
    per_page = min(per_page, max_per_page)
    offset = (page - 1) * per_page
    
    total = query.count()
    items = query.offset(offset).limit(per_page).all()
    
    return {
        'data': items,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total,
            'total_pages': math.ceil(total / per_page),
            'has_next': page < math.ceil(total / per_page),
            'has_prev': page > 1,
            'next_page': page + 1 if page < math.ceil(total / per_page) else None,
            'prev_page': page - 1 if page > 1 else None
        }
    }
```

---

## Migration Guide

### From Legacy Pagination

If migrating from a different pagination format:

```typescript
// Legacy format
interface LegacyPagination {
  offset: number;
  limit: number;
  total: number;
}

// New format
interface NewPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// Conversion helper
const convertPagination = (legacy: LegacyPagination): NewPagination => {
  const page = Math.floor(legacy.offset / legacy.limit) + 1;
  const total_pages = Math.ceil(legacy.total / legacy.limit);
  
  return {
    page,
    per_page: legacy.limit,
    total: legacy.total,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1
  };
};
```

---

## Testing

### Contract Tests

All pagination and filtering behavior is validated through contract tests:

```typescript
describe('Pagination Standards', () => {
  it('should return correct pagination metadata', async () => {
    const response = await apiClient.get('/api/v1/tenants?page=2&per_page=10');
    
    expect(response.data.pagination).toMatchObject({
      page: 2,
      per_page: 10,
      has_next: expect.any(Boolean),
      has_prev: expect.any(Boolean)
    });
  });

  it('should validate pagination parameters', async () => {
    const response = await apiClient.get('/api/v1/tenants?per_page=150');
    
    expect(response.status).toBe(400);
    expect(response.data.validation_errors).toContainEqual({
      field: 'per_page',
      message: 'per_page must be between 1 and 100',
      value: 150
    });
  });
});
```

---

## Completion Criteria

This document is **complete** when:
- ✅ All list endpoints follow consistent pagination patterns
- ✅ Standard filtering parameters are implemented
- ✅ Error handling for invalid parameters is consistent
- ✅ Performance considerations are documented
- ✅ Frontend integration examples are provided

**Status**: ✅ COMPLETE - Pagination and filtering standards finalized
