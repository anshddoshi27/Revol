/**
 * Admin Dashboard for a specific business
 * GET /api/v1/tenants/{id}
 * 
 * Shows tabs for:
 * - Overview
 * - Onboarding sections (mirrored from onboarding)
 * - Past Bookings (with money buttons)
 * - Account (subscription management)
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenant, useBookings, useCompleteBooking, useMarkNoShow, useCancelBooking } from '@/lib/hooks';
import { useAuth } from '@/lib/store';
import Link from 'next/link';

type Tab = 'overview' | 'business' | 'services' | 'staff' | 'bookings' | 'account';

export default function BusinessAdminPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = params.businessId as string;
  const { isAuthenticated } = useAuth();
  const { data: tenantData, isLoading: tenantLoading } = useTenant(businessId);
  const { data: bookingsData } = useBookings({ page: 1, per_page: 50 });
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  if (tenantLoading) {
    return <div className="p-8">Loading...</div>;
  }

  const tenant = tenantData?.tenant;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-2xl font-bold text-gray-900">{tenant?.name || 'Business Admin'}</h1>
            <p className="text-gray-600">{tenant?.slug}.tithi.com</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {(['overview', 'business', 'services', 'staff', 'bookings', 'account'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow p-6">
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Overview</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded">
                  <div className="text-2xl font-bold text-blue-600">
                    {bookingsData?.bookings?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Bookings</div>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <div className="text-2xl font-bold text-green-600">Active</div>
                  <div className="text-sm text-gray-600">Status</div>
                </div>
                <div className="bg-purple-50 p-4 rounded">
                  <div className="text-2xl font-bold text-purple-600">
                    {tenant?.status || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Business Status</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Past Bookings</h2>
              <BookingsList businessId={businessId} />
            </div>
          )}

          {activeTab === 'account' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Account & Subscription</h2>
              <SubscriptionManagement businessId={businessId} />
            </div>
          )}

          {/* Other tabs would show forms to edit onboarding data */}
          {activeTab === 'business' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Business Settings</h2>
              <p className="text-gray-600">Edit business information, contact details, branding, etc.</p>
              {/* BACKEND CHANGE NEEDED: Need endpoint to update business settings */}
            </div>
          )}

          {activeTab === 'services' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Services & Categories</h2>
              <Link
                href={`/app/b/${businessId}/services`}
                className="text-indigo-600 hover:text-indigo-700"
              >
                Manage Services →
              </Link>
            </div>
          )}

          {activeTab === 'staff' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Team Members</h2>
              <p className="text-gray-600">Manage team members and their availability</p>
              {/* BACKEND CHANGE NEEDED: Need endpoints for staff management */}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Bookings List Component with Money Buttons
function BookingsList({ businessId }: { businessId: string }) {
  const { data, isLoading } = useBookings({ page: 1, per_page: 100 });
  const completeMutation = useCompleteBooking();
  const noShowMutation = useMarkNoShow();
  const cancelMutation = useCancelBooking();

  if (isLoading) return <div>Loading bookings...</div>;

  const bookings = data?.bookings || [];

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <div key={booking.id} className="border rounded-lg p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="font-semibold">
                {booking.customer.first_name} {booking.customer.last_name}
              </div>
              <div className="text-sm text-gray-600">{booking.customer.email}</div>
              <div className="text-sm text-gray-600">{booking.customer.phone || 'No phone'}</div>
            </div>
            <span className={`px-2 py-1 rounded text-xs ${
              booking.status === 'completed' ? 'bg-green-100 text-green-800' :
              booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
              booking.status === 'no_show' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {booking.status}
            </span>
          </div>
          
          <div className="mb-4">
            <div className="text-sm">
              <strong>Service:</strong> {booking.service.name}
            </div>
            <div className="text-sm">
              <strong>Date:</strong> {new Date(booking.start_at).toLocaleString()}
            </div>
            <div className="text-sm">
              <strong>Price:</strong> ${(booking.service.price_cents / 100).toFixed(2)}
            </div>
          </div>

          {/* Money Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={() => completeMutation.mutate(booking.id)}
              disabled={completeMutation.isPending || booking.status === 'completed'}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {completeMutation.isPending ? 'Processing...' : 'Completed'}
            </button>
            <button
              onClick={() => noShowMutation.mutate(booking.id)}
              disabled={noShowMutation.isPending || booking.status === 'no_show'}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              {noShowMutation.isPending ? 'Processing...' : 'No Show'}
            </button>
            <button
              onClick={() => cancelMutation.mutate(booking.id)}
              disabled={cancelMutation.isPending || booking.status === 'cancelled'}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Processing...' : 'Cancelled'}
            </button>
            <button
              onClick={() => {
                // BACKEND CHANGE NEEDED: Need refund endpoint
                alert('Refund functionality requires backend endpoint');
              }}
              disabled={booking.status !== 'completed'}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Refund
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Subscription Management Component
function SubscriptionManagement({ businessId }: { businessId: string }) {
  // BACKEND CHANGE NEEDED: Need endpoints for subscription management
  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h3 className="font-semibold mb-2">Subscription Status</h3>
        <p className="text-gray-600 mb-4">Current plan: $11.99/month per business</p>
        <div className="flex space-x-2">
          <button className="px-4 py-2 bg-indigo-600 text-white rounded">Activate</button>
          <button className="px-4 py-2 bg-gray-600 text-white rounded">Pause</button>
          <button className="px-4 py-2 bg-red-600 text-white rounded">Cancel</button>
        </div>
      </div>
    </div>
  );
}

