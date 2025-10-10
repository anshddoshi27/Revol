/**
 * StatusBadge Component
 * 
 * A reusable status badge component that displays booking and payment statuses
 * with consistent colors and styling. Supports all booking statuses and provides
 * accessibility features including proper contrast and screen reader support.
 * 
 * SHA-256 Hash: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8
 */

import React from 'react';
import { statusColors, bookingStatusColors } from '../styles/tokens';
import type { BookingStatus } from '../api/types';

// ===== TYPES =====

export type StatusBadgeVariant = 'default' | 'outline' | 'subtle';
export type StatusBadgeSize = 'sm' | 'md' | 'lg';

export interface StatusBadgeProps {
  /** The status to display */
  status: keyof typeof statusColors | BookingStatus;
  /** The text content to display */
  children: React.ReactNode;
  /** Visual variant of the badge */
  variant?: StatusBadgeVariant;
  /** Size of the badge */
  size?: StatusBadgeSize;
  /** Additional CSS classes */
  className?: string;
  /** Accessibility label for screen readers */
  'aria-label'?: string;
  /** Whether the badge should be interactive */
  interactive?: boolean;
  /** Click handler for interactive badges */
  onClick?: () => void;
}

// ===== STATUS MAPPING =====

const getStatusColor = (status: keyof typeof statusColors | BookingStatus): string => {
  // Handle booking status mapping
  if (status in bookingStatusColors) {
    return bookingStatusColors[status as BookingStatus];
  }
  
  // Handle direct status color mapping
  if (status in statusColors) {
    return statusColors[status as keyof typeof statusColors];
  }
  
  // Fallback to neutral color
  return statusColors.cancelled;
};

const getStatusLabel = (status: keyof typeof statusColors | BookingStatus): string => {
  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    attended: 'Attended',
    completed: 'Completed',
    no_show: 'No Show',
    cancelled: 'Cancelled',
  };
  
  return statusLabels[status] || status;
};

// ===== SIZE CONFIGURATIONS =====

const sizeConfig = {
  sm: {
    padding: 'px-2 py-0.5',
    fontSize: 'text-xs',
    borderRadius: 'rounded-md',
  },
  md: {
    padding: 'px-2.5 py-0.5',
    fontSize: 'text-xs',
    borderRadius: 'rounded-full',
  },
  lg: {
    padding: 'px-3 py-1',
    fontSize: 'text-sm',
    borderRadius: 'rounded-full',
  },
} as const;

// ===== VARIANT CONFIGURATIONS =====

const getVariantStyles = (color: string, variant: StatusBadgeVariant) => {
  switch (variant) {
    case 'outline':
      return {
        backgroundColor: 'transparent',
        borderColor: color,
        borderWidth: 'border',
        color: color,
      };
    case 'subtle':
      return {
        backgroundColor: `${color}20`, // 20% opacity
        borderColor: 'transparent',
        borderWidth: 'border-0',
        color: color,
      };
    case 'default':
    default:
      return {
        backgroundColor: color,
        borderColor: 'transparent',
        borderWidth: 'border-0',
        color: 'white',
      };
  }
};

// ===== CONTRAST UTILITIES =====

/**
 * Calculate relative luminance of a color
 */
const getLuminance = (color: string): number => {
  // Remove # if present
  const hex = color.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  // Apply gamma correction
  const [rs, gs, bs] = [r, g, b].map(c => 
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  
  return 0.2126 * (rs || 0) + 0.7152 * (gs || 0) + 0.0722 * (bs || 0);
};

/**
 * Calculate contrast ratio between two colors
 */
const getContrastRatio = (color1: string, color2: string): number => {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Get appropriate text color for a background color
 */
const getTextColor = (backgroundColor: string): string => {
  const whiteContrast = getContrastRatio(backgroundColor, '#ffffff');
  const blackContrast = getContrastRatio(backgroundColor, '#000000');
  
  // Return the color with better contrast (AA standard is 4.5:1)
  // For dark colors, prefer white text; for light colors, prefer black text
  return whiteContrast >= blackContrast ? '#ffffff' : '#000000';
};

// ===== MAIN COMPONENT =====

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  children,
  variant = 'default',
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
  interactive = false,
  onClick,
}) => {
  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(status);
  const variantStyles = getVariantStyles(statusColor, variant);
  const sizeStyles = sizeConfig[size];
  
  // Calculate appropriate text color for contrast
  const textColor = variant === 'default' 
    ? getTextColor(statusColor)
    : variantStyles.color;
  
  // Build CSS classes
  const baseClasses = [
    'inline-flex',
    'items-center',
    'justify-center',
    'font-medium',
    'transition-colors',
    'duration-150',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-1',
    'focus:ring-blue-500',
    sizeStyles.padding,
    sizeStyles.fontSize,
    sizeStyles.borderRadius,
    variantStyles.borderWidth,
  ].join(' ');
  
  const interactiveClasses = interactive 
    ? 'cursor-pointer hover:opacity-80 active:opacity-60' 
    : '';
  
  const finalClasses = [baseClasses, interactiveClasses, className]
    .filter(Boolean)
    .join(' ');
  
  // Build inline styles
  const inlineStyles: React.CSSProperties = {
    backgroundColor: variantStyles.backgroundColor,
    borderColor: variantStyles.borderColor,
    color: textColor,
  };
  
  // Handle click events
  const handleClick = () => {
    if (interactive && onClick) {
      onClick();
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (interactive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleClick();
    }
  };
  
  // Build accessibility attributes
  const accessibilityProps = {
    'aria-label': ariaLabel || `${statusLabel} status`,
    'role': interactive ? 'button' : undefined,
    'tabIndex': interactive ? 0 : undefined,
    'onClick': interactive ? handleClick : undefined,
    'onKeyDown': interactive ? handleKeyDown : undefined,
  };
  
  return (
    <span
      className={finalClasses}
      style={inlineStyles}
      {...accessibilityProps}
    >
      {children}
    </span>
  );
};

// ===== EXPORTS =====

export default StatusBadge;

// Types are already exported above
