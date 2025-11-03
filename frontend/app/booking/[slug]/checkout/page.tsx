/**
 * Booking Flow - Checkout Page
 * POST /booking/create
 * 
 * Collects customer info, shows policies, handles payment setup
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCreateBooking } from '@/lib/hooks';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const serviceId = searchParams.get('service_id') || '';
  const slot = searchParams.get('slot') || '';
  
  const createBookingMutation = useCreateBooking();
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [giftCardCode, setGiftCardCode] = useState('');
  const [policyConsent, setPolicyConsent] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);

  // BACKEND CHANGE NEEDED: Need tenant_id and policies from backend
  const tenantId = ''; // Should come from tenant lookup
  const policies = {
    cancellation_policy: '',
    no_show_policy: '',
    refund_policy: '',
    cash_payment_policy: '',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!policyConsent) {
      alert('Please accept the policies to continue');
      return;
    }

    try {
      const [startTime, teamMemberId] = slot.split('-');
      
      const result = await createBookingMutation.mutateAsync({
        tenant_id: tenantId,
        service_id: serviceId,
        team_member_id: teamMemberId,
        start_time: startTime,
        customer: customerInfo,
        gift_card_code: giftCardCode || undefined,
      });

      if (result.payment_status === 'requires_action' && result.setup_intent_client_secret) {
        // Handle Stripe payment setup
        // BACKEND CHANGE NEEDED: Need to complete Stripe Elements integration
      }

      router.push(`/booking/${slug}/confirm/${result.booking_code}`);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Booking failed');
    }
  };

  return (
    <Elements stripe={stripePromise}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Checkout</h1>

          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
            {/* Customer Information */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Your Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Gift Card */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gift Card Code (optional)
              </label>
              <input
                type="text"
                value={giftCardCode}
                onChange={(e) => setGiftCardCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Policies */}
            <div>
              <button
                type="button"
                onClick={() => setShowPolicies(!showPolicies)}
                className="text-indigo-600 hover:text-indigo-700 text-sm"
              >
                View Policies
              </button>
              
              {showPolicies && (
                <div className="mt-4 p-4 bg-gray-50 rounded max-h-64 overflow-y-auto">
                  {policies.cancellation_policy && (
                    <div className="mb-4">
                      <h3 className="font-semibold mb-2">Cancellation Policy</h3>
                      <p className="text-sm text-gray-600">{policies.cancellation_policy}</p>
                    </div>
                  )}
                  {policies.no_show_policy && (
                    <div className="mb-4">
                      <h3 className="font-semibold mb-2">No-Show Policy</h3>
                      <p className="text-sm text-gray-600">{policies.no_show_policy}</p>
                    </div>
                  )}
                  {policies.refund_policy && (
                    <div className="mb-4">
                      <h3 className="font-semibold mb-2">Refund Policy</h3>
                      <p className="text-sm text-gray-600">{policies.refund_policy}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Policy Consent */}
            <div className="flex items-start">
              <input
                type="checkbox"
                id="policy-consent"
                checked={policyConsent}
                onChange={(e) => setPolicyConsent(e.target.checked)}
                className="mt-1 mr-2"
                required
              />
              <label htmlFor="policy-consent" className="text-sm text-gray-700">
                I have read and agree to the policies *
              </label>
            </div>

            {/* Payment Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <p className="text-sm text-blue-800">
                <strong>Important:</strong> Your card will be saved securely but you will not be charged now. 
                You'll be charged after your appointment is completed or if a fee applies (see policies).
              </p>
            </div>

            {/* Stripe Elements would go here */}
            {/* BACKEND CHANGE NEEDED: Need SetupIntent client_secret to complete Stripe integration */}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2 border rounded-md"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={createBookingMutation.isPending || !policyConsent}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
              >
                {createBookingMutation.isPending ? 'Processing...' : 'Complete Booking'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Elements>
  );
}

