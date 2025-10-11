# Responsive Design Guidelines

This document provides comprehensive guidelines for implementing responsive design in the Tithi platform using our design token system.

## Overview

The Tithi platform uses a mobile-first responsive design approach with consistent breakpoints, typography scales, and spacing systems. All components are designed to work seamlessly across all device sizes while maintaining accessibility and performance.

## Breakpoints

Our breakpoint system is designed for mobile-first development:

| Breakpoint | Min Width | Device Type | Usage |
|------------|-----------|-------------|-------|
| `xs` | 320px | Mobile phones (portrait) | Base mobile experience |
| `sm` | 640px | Mobile phones (landscape) / Small tablets | Landscape mobile, small tablets |
| `md` | 768px | Tablets (portrait) | Tablet portrait mode |
| `lg` | 1024px | Tablets (landscape) / Small desktops | Tablet landscape, small desktops |
| `xl` | 1280px | Desktops | Standard desktop experience |
| `2xl` | 1536px | Large desktops | Large desktop displays |

### Breakpoint Usage

```tsx
// Mobile-first approach - start with mobile styles
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-xl md:text-2xl lg:text-3xl">Responsive Heading</h1>
</div>

// Use breakpoint prefixes for larger screens
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  <div>Column 1</div>
  <div>Column 2</div>
  <div>Column 3</div>
</div>
```

## Typography Scale

Our typography system uses Inter font family with a consistent scale:

### Font Sizes

| Class | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 12px | 16px | Small labels, captions |
| `text-sm` | 14px | 20px | Body text, form labels |
| `text-base` | 16px | 24px | Default body text |
| `text-lg` | 18px | 28px | Large body text |
| `text-xl` | 20px | 28px | Small headings |
| `text-2xl` | 24px | 32px | Medium headings |
| `text-3xl` | 30px | 36px | Large headings |
| `text-4xl` | 36px | 40px | Extra large headings |
| `text-5xl` | 48px | 48px | Display headings |
| `text-6xl` | 60px | 60px | Hero headings |
| `text-7xl` | 72px | 72px | Large hero headings |
| `text-8xl` | 96px | 96px | Extra large hero headings |
| `text-9xl` | 128px | 128px | Massive headings |

### Font Weights

| Class | Weight | Usage |
|-------|--------|-------|
| `font-thin` | 100 | Very light text |
| `font-extralight` | 200 | Extra light text |
| `font-light` | 300 | Light text |
| `font-normal` | 400 | Normal body text |
| `font-medium` | 500 | Medium emphasis |
| `font-semibold` | 600 | Semibold headings |
| `font-bold` | 700 | Bold headings |
| `font-extrabold` | 800 | Extra bold headings |
| `font-black` | 900 | Black headings |

### Typography Usage Examples

```tsx
// Heading hierarchy
<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900">
  Main Heading
</h1>

<h2 className="text-2xl md:text-3xl font-semibold text-gray-800">
  Section Heading
</h2>

<h3 className="text-xl md:text-2xl font-medium text-gray-700">
  Subsection Heading
</h3>

// Body text
<p className="text-base md:text-lg text-gray-600 leading-relaxed">
  This is body text that scales appropriately across devices.
</p>

// Small text
<span className="text-sm text-gray-500">
  Small label or caption text
</span>
```

## Spacing System

Our spacing system uses a consistent 4px base unit:

| Class | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `space-1` | 0.25rem | 4px | Very tight spacing |
| `space-2` | 0.5rem | 8px | Tight spacing |
| `space-3` | 0.75rem | 12px | Small spacing |
| `space-4` | 1rem | 16px | Base spacing |
| `space-5` | 1.25rem | 20px | Medium spacing |
| `space-6` | 1.5rem | 24px | Large spacing |
| `space-8` | 2rem | 32px | Extra large spacing |
| `space-10` | 2.5rem | 40px | Section spacing |
| `space-12` | 3rem | 48px | Large section spacing |
| `space-16` | 4rem | 64px | Extra large section spacing |
| `space-20` | 5rem | 80px | Hero spacing |
| `space-24` | 6rem | 96px | Massive spacing |

### Spacing Usage Examples

```tsx
// Responsive spacing
<div className="p-4 md:p-6 lg:p-8">
  <div className="space-y-4 md:space-y-6">
    <div>Item 1</div>
    <div>Item 2</div>
    <div>Item 3</div>
  </div>
</div>

// Margin and padding
<div className="mt-8 mb-4 px-4 py-2">
  <p>Content with responsive margins and padding</p>
</div>
```

## Color System

Our color system includes semantic colors for different states and contexts:

### Status Colors

| Color | Usage | Hex Value |
|-------|-------|-----------|
| `success` | Success states, confirmations | #10B981 |
| `warning` | Warnings, cautions | #F59E0B |
| `error` | Errors, failures | #EF4444 |
| `info` | Information, tips | #3B82F6 |

### Neutral Colors

| Color | Usage | Hex Value |
|-------|-------|-----------|
| `gray-50` | Light backgrounds | #F9FAFB |
| `gray-100` | Subtle backgrounds | #F3F4F6 |
| `gray-200` | Borders, dividers | #E5E7EB |
| `gray-300` | Disabled states | #D1D5DB |
| `gray-400` | Placeholder text | #9CA3AF |
| `gray-500` | Secondary text | #6B7280 |
| `gray-600` | Body text | #4B5563 |
| `gray-700` | Primary text | #374151 |
| `gray-800` | Headings | #1F2937 |
| `gray-900` | Dark headings | #111827 |

### Color Usage Examples

```tsx
// Status indicators
<div className="bg-success-50 border border-success-200 text-success-800">
  Success message
</div>

<div className="bg-warning-50 border border-warning-200 text-warning-800">
  Warning message
</div>

<div className="bg-error-50 border border-error-200 text-error-800">
  Error message
</div>

// Text colors
<h1 className="text-gray-900">Primary heading</h1>
<p className="text-gray-700">Body text</p>
<span className="text-gray-500">Secondary text</span>
```

## Layout Patterns

### Container System

```tsx
// Responsive containers
<div className="container-xs">Content for mobile</div>
<div className="container-sm">Content for small screens</div>
<div className="container-md">Content for medium screens</div>
<div className="container-lg">Content for large screens</div>
<div className="container-xl">Content for extra large screens</div>
```

### Grid System

```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  <div>Grid item 1</div>
  <div>Grid item 2</div>
  <div>Grid item 3</div>
</div>

// Flexbox layouts
<div className="flex flex-col md:flex-row gap-4">
  <div className="flex-1">Main content</div>
  <div className="w-full md:w-64">Sidebar</div>
</div>
```

## Mobile-First Design Principles

### 1. Start with Mobile

Always design and develop for mobile first, then enhance for larger screens:

```tsx
// ❌ Desktop-first approach
<div className="w-64 md:w-32">Content</div>

// ✅ Mobile-first approach
<div className="w-32 md:w-64">Content</div>
```

### 2. Progressive Enhancement

Add features and complexity as screen size increases:

```tsx
// Mobile: Simple list
// Desktop: Complex grid with additional information
<div className="space-y-4 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-3">
  <div className="p-4 border rounded-lg">
    <h3 className="text-lg font-semibold">Item Title</h3>
    <p className="text-sm text-gray-600 md:hidden">Short description</p>
    <p className="hidden md:block text-gray-600">Full description with more details</p>
  </div>
</div>
```

### 3. Touch-Friendly Design

Ensure all interactive elements meet minimum touch target sizes:

```tsx
// Minimum 44px touch targets
<button className="touch-target px-4 py-2">
  Touch-friendly button
</button>

// Larger touch targets on mobile
<button className="px-4 py-2 md:px-3 md:py-1">
  Responsive button
</button>
```

## Accessibility Considerations

### 1. Focus Management

```tsx
// Focus-visible styles
<button className="focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2">
  Accessible button
</button>
```

### 2. High Contrast Support

```tsx
// High contrast mode support
<div className="high-contrast border border-gray-900 bg-white text-gray-900">
  High contrast content
</div>
```

### 3. Reduced Motion Support

```tsx
// Respect user's motion preferences
<div className="transition-all duration-300 reduce-motion:transition-none">
  Animated content
</div>
```

### 4. Screen Reader Support

```tsx
// Proper heading hierarchy
<h1>Main Page Title</h1>
  <h2>Section Title</h2>
    <h3>Subsection Title</h3>

// Descriptive labels
<label htmlFor="email" className="block text-sm font-medium text-gray-700">
  Email Address
</label>
<input 
  id="email" 
  type="email" 
  className="form-input" 
  aria-describedby="email-help"
/>
<p id="email-help" className="text-sm text-gray-500">
  We'll never share your email with anyone else.
</p>
```

## Performance Considerations

### 1. Optimize Images

```tsx
// Responsive images
<img 
  src="/image-320w.jpg"
  srcSet="/image-320w.jpg 320w, /image-640w.jpg 640w, /image-1280w.jpg 1280w"
  sizes="(max-width: 640px) 320px, (max-width: 1280px) 640px, 1280px"
  alt="Responsive image"
  className="w-full h-auto"
/>
```

### 2. Lazy Loading

```tsx
// Lazy load images below the fold
<img 
  src="/image.jpg" 
  loading="lazy" 
  alt="Lazy loaded image"
  className="w-full h-auto"
/>
```

### 3. Conditional Rendering

```tsx
// Only render complex components on larger screens
{isDesktop && (
  <ComplexDesktopComponent />
)}

// Use CSS to hide/show instead of conditional rendering when possible
<div className="hidden md:block">
  Desktop-only content
</div>
```

## Testing Guidelines

### 1. Visual Regression Testing

Take screenshots at each breakpoint:

- **XS (320px)**: iPhone SE, small Android phones
- **SM (640px)**: iPhone 12, Pixel 5
- **MD (768px)**: iPad portrait
- **LG (1024px)**: iPad landscape, small laptops
- **XL (1280px)**: Desktop monitors
- **2XL (1536px)**: Large desktop monitors

### 2. Manual Testing Checklist

- [ ] No horizontal scroll on any breakpoint
- [ ] All text is readable and properly sized
- [ ] Touch targets are at least 44px
- [ ] Focus indicators are visible
- [ ] High contrast mode works
- [ ] Reduced motion is respected
- [ ] Images scale properly
- [ ] Forms are usable on mobile
- [ ] Navigation works on all devices

### 3. Automated Testing

```tsx
// Test responsive behavior
describe('Responsive Layout', () => {
  it('should render correctly on mobile', () => {
    cy.viewport(375, 667); // iPhone 12
    cy.visit('/');
    cy.get('[data-testid="main-content"]').should('be.visible');
  });

  it('should render correctly on desktop', () => {
    cy.viewport(1280, 720);
    cy.visit('/');
    cy.get('[data-testid="sidebar"]').should('be.visible');
  });
});
```

## Common Patterns

### 1. Responsive Navigation

```tsx
// Mobile: Hamburger menu
// Desktop: Horizontal navigation
<nav className="flex items-center justify-between p-4">
  <div className="flex items-center space-x-4">
    <Logo />
    <div className="hidden md:flex space-x-6">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </div>
  </div>
  <button className="md:hidden">
    <MenuIcon />
  </button>
</nav>
```

### 2. Responsive Cards

```tsx
// Mobile: Single column
// Desktop: Multiple columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <div className="card">
    <h3 className="text-heading text-lg">Card Title</h3>
    <p className="text-body">Card content</p>
  </div>
</div>
```

### 3. Responsive Forms

```tsx
// Mobile: Stacked layout
// Desktop: Side-by-side layout
<form className="space-y-4 md:space-y-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700">
        First Name
      </label>
      <input type="text" className="form-input" />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700">
        Last Name
      </label>
      <input type="text" className="form-input" />
    </div>
  </div>
</form>
```

## Best Practices

1. **Always start with mobile** - Design for the smallest screen first
2. **Use relative units** - Prefer rem/em over px for scalable designs
3. **Test on real devices** - Use actual devices, not just browser dev tools
4. **Consider performance** - Optimize images and lazy load content
5. **Maintain consistency** - Use the design token system consistently
6. **Plan for edge cases** - Consider very small and very large screens
7. **Accessibility first** - Ensure all users can access your content
8. **Progressive enhancement** - Add features as screen size increases

## Resources

- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [MDN Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [WebAIM Accessibility Guidelines](https://webaim.org/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
