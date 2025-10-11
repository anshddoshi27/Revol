# Onboarding Step 3: Services, Categories & Defaults

This directory contains the implementation of Step 3 of the onboarding wizard, which handles service catalog creation for new businesses.

## Overview

Step 3 allows business owners to:
- Create and manage service categories with color coding
- Create services with detailed information (name, description, duration, pricing)
- Upload service images with drag & drop and cropping functionality
- Configure special requests settings with quick chips
- Set pre-appointment instructions and buffer times

## Components

### Core Components

- **`Step3Services.tsx`** - Main page component that orchestrates the entire step
- **`CategoryCRUD.tsx`** - Category management with full CRUD operations
- **`ServiceCardEditor.tsx`** - Service creation and editing form
- **`ServiceImageUploader.tsx`** - Image upload with drag & drop and cropping
- **`ChipsConfigurator.tsx`** - Special requests configuration

### Hooks

- **`useServiceCatalog.ts`** - Service management state and operations
- **`useCategoryManagement.ts`** - Category management state and operations

### API Services

- **`servicesService`** - Service CRUD operations
- **`categoriesService`** - Category CRUD operations
- **`servicesUtils`** - Utility functions for formatting and validation

## Features

### Category Management
- **CRUD Operations**: Create, read, update, delete categories
- **Color Coding**: Visual organization with predefined color palette
- **Validation**: Name uniqueness and required field validation
- **Sort Order**: Automatic ordering with manual override capability

### Service Creation
- **Basic Information**: Name, description, duration, pricing
- **Category Assignment**: Link services to categories
- **Image Upload**: Drag & drop with cropping functionality
- **Buffer Times**: Pre and post service buffer configuration
- **Pre-appointment Instructions**: Custom instructions for customers

### Special Requests Configuration
- **Enable/Disable**: Toggle special requests functionality
- **Character Limits**: Configurable text length limits
- **Quick Chips**: Pre-defined options for common requests
- **Custom Input**: Allow customers to type custom requests
- **Preview**: Real-time preview of configuration

### Image Management
- **Drag & Drop**: Intuitive file upload interface
- **File Validation**: Type and size validation
- **Cropping**: Built-in image cropping functionality
- **Preview**: Real-time preview of uploaded images
- **Error Handling**: Clear error messages for upload failures

## API Integration

### Service Endpoints
- `POST /api/v1/services` - Create service
- `PUT /api/v1/services/{id}` - Update service
- `DELETE /api/v1/services/{id}` - Delete service
- `GET /api/v1/services` - List services
- `POST /api/v1/services/upload-image` - Upload service image

### Category Endpoints
- `POST /api/v1/categories` - Create category
- `PUT /api/v1/categories/{id}` - Update category
- `DELETE /api/v1/categories/{id}` - Delete category
- `GET /api/v1/categories` - List categories

## Validation Rules

### Service Validation
- **Name**: Required, 2-255 characters
- **Description**: Required, 10-1000 characters
- **Duration**: Required, 15-480 minutes
- **Price**: Required, non-negative
- **Special Requests Limit**: 10-500 characters (if enabled)

### Category Validation
- **Name**: Required, 2-100 characters, unique
- **Description**: Optional, max 500 characters

## Observability

### Analytics Events
- `onboarding.step3_started` - When step loads
- `onboarding.step3_complete` - When step completes
- `onboarding.category_created` - When category is created
- `onboarding.service_created` - When service is created
- `onboarding.image_uploaded` - When image is uploaded

### Error Tracking
- Validation errors with field-level details
- API errors with endpoint and status code
- Network errors with retry information
- File upload errors with file details

### Performance Tracking
- Step load time
- Service creation time
- Category creation time
- Image upload time

## Testing

### Unit Tests
- Component rendering and interaction tests
- Hook functionality tests
- Validation logic tests
- Utility function tests

### E2E Tests
- Complete onboarding flow
- Category CRUD operations
- Service CRUD operations
- Image upload functionality
- Form validation
- Navigation between steps

## Accessibility

### WCAG 2.1 AA Compliance
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Color Contrast**: Meets AA contrast requirements
- **Focus Management**: Clear focus indicators
- **Error Handling**: Accessible error messages

### Form Accessibility
- Required field indicators
- Field descriptions and help text
- Error message association
- Form validation feedback

## Performance

### Optimization Features
- **Lazy Loading**: Components loaded on demand
- **Image Optimization**: Automatic resizing and compression
- **Debounced Validation**: Reduced validation calls
- **Memoized Calculations**: Cached computed values

### Performance Targets
- **LCP**: < 2.0s (p75)
- **CLS**: < 0.1 (p75)
- **INP**: < 200ms (p75)
- **Bundle Size**: < 500KB initial

## Error Handling

### User-Friendly Errors
- Clear, actionable error messages
- Field-level validation feedback
- Retry mechanisms for network errors
- Graceful degradation for failed operations

### Error Recovery
- Form state preservation
- Automatic retry for transient errors
- Fallback options for failed uploads
- Clear recovery instructions

## Navigation

### Step Flow
1. **Categories Tab**: Create and manage service categories
2. **Services Tab**: Create and manage services
3. **Service Editor**: Detailed service creation/editing
4. **Continue**: Proceed to availability configuration

### Data Persistence
- Form data preserved during navigation
- Categories and services saved to backend
- Image uploads processed immediately
- State synchronized across components

## Future Enhancements

### Planned Features
- **Bulk Import**: CSV import for services
- **Templates**: Pre-built service templates
- **Advanced Scheduling**: Complex availability rules
- **Multi-language**: Internationalization support
- **Analytics**: Service performance metrics

### Technical Improvements
- **Offline Support**: Service catalog caching
- **Real-time Sync**: Live updates across sessions
- **Advanced Validation**: Business rule validation
- **Performance Monitoring**: Real-time performance tracking