/**
 * Booking Confirmation Page
 * GET /booking/{booking_id}
 * 
 * Shows booking confirmation with all details
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { bookingFlowApi } from '@/lib/api-client';

export default function BookingConfirmationPage() {
  const params = useParams();
  const bookingCode = params.bookingCode as string;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // BACKEND CHANGE NEEDED: Need endpoint to get booking by code
    // For now using booking_id endpoint pattern
    bookingFlowApi.getBooking(bookingCode)
      .then((data) => {
        setBooking(data.booking);
      })
      .catch((err) => {
        console.error('Failed to load booking', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [bookingCode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading confirmation...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Booking not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
            <p className="text-gray-600">Your booking is pending. No charge has been made yet.</p>
          </div>

          <div className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Booking Details</h2>
            
            <div className="space-y-4 text-left">
              <div>
                <strong>Service:</strong> {booking.service?.name || 'N/A'}
              </div>
              <div>
                <strong>Date & Time:</strong>{' '}
                {new Date(booking.start_at).toLocaleString()}
              </div>
              <div>
                <strong>Duration:</strong> {booking.service?.duration_minutes || 0} minutes
              </div>
              <div>
                <strong>Price:</strong> ${((booking.service?.price_cents || 0) / 100).toFixed(2)}
              </div>
              {booking.service?.pre_appointment_instructions && (
                <div>
                  <strong>Pre-Appointment Instructions:</strong>
                  <p className="text-gray-600 mt-1">
                    {booking.service.pre_appointment_instructions}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> You have not been charged yet. Your card has been saved securely. 
                You will be charged after your appointment is completed or if a fee applies (see policies).
              </p>
            </div>

            <div className="mt-8">
              <p className="text-sm text-gray-600">
                Booking Code: <strong>{bookingCode}</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

