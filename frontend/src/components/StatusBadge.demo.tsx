/**
 * StatusBadge Demo Component
 * 
 * This file demonstrates the usage of the StatusBadge component
 * with all its variants, sizes, and status types.
 * 
 * This is for demonstration purposes only and should not be used in production.
 */

import React from 'react';
import { StatusBadge } from './StatusBadge';

export const StatusBadgeDemo: React.FC = () => {
  return (
    <div className="p-1 space-y-1">
      <h1 className="text-xs font-bold mb-1">StatusBadge Component Demo</h1>
      
      {/* Status Types */}
      <section>
        <h2 className="text-xs font-semibold mb-1">Status Types</h2>
        <div className="flex flex-wrap gap-4">
          <StatusBadge status="pending">Pending</StatusBadge>
          <StatusBadge status="confirmed">Confirmed</StatusBadge>
          <StatusBadge status="attended">Attended</StatusBadge>
          <StatusBadge status="no_show">No Show</StatusBadge>
          <StatusBadge status="cancelled">Cancelled</StatusBadge>
        </div>
      </section>

      {/* Booking Status Types */}
      <section>
        <h2 className="text-xs font-semibold mb-1">Booking Status Types</h2>
        <div className="flex flex-wrap gap-4">
          <StatusBadge status="pending">Pending</StatusBadge>
          <StatusBadge status="confirmed">Confirmed</StatusBadge>
          <StatusBadge status="completed">Completed</StatusBadge>
          <StatusBadge status="cancelled">Cancelled</StatusBadge>
          <StatusBadge status="no_show">No Show</StatusBadge>
        </div>
      </section>

      {/* Variants */}
      <section>
        <h2 className="text-xs font-semibold mb-1">Variants</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Default</h3>
            <div className="flex flex-wrap gap-4">
              <StatusBadge status="pending" variant="default">Pending</StatusBadge>
              <StatusBadge status="confirmed" variant="default">Confirmed</StatusBadge>
              <StatusBadge status="attended" variant="default">Attended</StatusBadge>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Outline</h3>
            <div className="flex flex-wrap gap-4">
              <StatusBadge status="pending" variant="outline">Pending</StatusBadge>
              <StatusBadge status="confirmed" variant="outline">Confirmed</StatusBadge>
              <StatusBadge status="attended" variant="outline">Attended</StatusBadge>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Subtle</h3>
            <div className="flex flex-wrap gap-4">
              <StatusBadge status="pending" variant="subtle">Pending</StatusBadge>
              <StatusBadge status="confirmed" variant="subtle">Confirmed</StatusBadge>
              <StatusBadge status="attended" variant="subtle">Attended</StatusBadge>
            </div>
          </div>
        </div>
      </section>

      {/* Sizes */}
      <section>
        <h2 className="text-xs font-semibold mb-1">Sizes</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Small</h3>
            <div className="flex flex-wrap gap-4">
              <StatusBadge status="pending" size="sm">Pending</StatusBadge>
              <StatusBadge status="confirmed" size="sm">Confirmed</StatusBadge>
              <StatusBadge status="attended" size="sm">Attended</StatusBadge>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Medium (Default)</h3>
            <div className="flex flex-wrap gap-4">
              <StatusBadge status="pending" size="md">Pending</StatusBadge>
              <StatusBadge status="confirmed" size="md">Confirmed</StatusBadge>
              <StatusBadge status="attended" size="md">Attended</StatusBadge>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Large</h3>
            <div className="flex flex-wrap gap-4">
              <StatusBadge status="pending" size="lg">Pending</StatusBadge>
              <StatusBadge status="confirmed" size="lg">Confirmed</StatusBadge>
              <StatusBadge status="attended" size="lg">Attended</StatusBadge>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive */}
      <section>
        <h2 className="text-xs font-semibold mb-1">Interactive Badges</h2>
        <div className="flex flex-wrap gap-4">
          <StatusBadge 
            status="pending" 
            interactive 
            onClick={() => alert('Pending badge clicked!')}
          >
            Click Me
          </StatusBadge>
          <StatusBadge 
            status="confirmed" 
            variant="outline"
            interactive 
            onClick={() => alert('Confirmed badge clicked!')}
          >
            Click Me
          </StatusBadge>
        </div>
      </section>

      {/* Custom Styling */}
      <section>
        <h2 className="text-xs font-semibold mb-1">Custom Styling</h2>
        <div className="flex flex-wrap gap-4">
          <StatusBadge 
            status="pending" 
            className="shadow-lg"
          >
            With Shadow
          </StatusBadge>
          <StatusBadge 
            status="confirmed" 
            className="border-2 border-dashed"
          >
            Dashed Border
          </StatusBadge>
        </div>
      </section>

      {/* Accessibility */}
      <section>
        <h2 className="text-xs font-semibold mb-1">Accessibility</h2>
        <div className="flex flex-wrap gap-4">
          <StatusBadge 
            status="pending" 
            aria-label="Booking is pending approval"
          >
            Pending
          </StatusBadge>
          <StatusBadge 
            status="confirmed" 
            aria-label="Booking has been confirmed"
          >
            Confirmed
          </StatusBadge>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          All badges include proper ARIA labels and focus management for screen readers.
        </p>
      </section>
    </div>
  );
};

export default StatusBadgeDemo;
