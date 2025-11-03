/**
 * Booking Flow - Availability Selection
 * POST /booking/availability
 * 
 * Shows available time slots for a service
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAvailability } from '@/lib/hooks';
import { format, addDays } from 'date-fns';

export default function BookingAvailabilityPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const serviceId = params.serviceId as string;
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const availabilityMutation = useAvailability();
  const [slots, setSlots] = useState<any[]>([]);
  
  // BACKEND CHANGE NEEDED: Need tenant_id - currently using slug, need lookup
  const tenantId = ''; // This should come from a lookup endpoint

  useEffect(() => {
    if (!tenantId || !serviceId) return;

    const startDate = format(selectedDate, 'yyyy-MM-dd');
    const endDate = format(addDays(selectedDate, 7), 'yyyy-MM-dd');

    availabilityMutation.mutate(
      {
        tenant_id: tenantId,
        service_id: serviceId,
        start_date: startDate,
        end_date: endDate,
      },
      {
        onSuccess: (data) => {
          setSlots(data.slots || []);
        },
      }
    );
  }, [selectedDate, serviceId, tenantId]);

  const handleContinue = () => {
    if (selectedSlot) {
      router.push(`/booking/${slug}/checkout?service_id=${serviceId}&slot=${selectedSlot}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Select a Time</h1>

        {/* Date Selector */}
        <div className="mb-8">
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="px-4 py-2 border rounded-md"
          />
        </div>

        {/* Available Slots */}
        {availabilityMutation.isPending ? (
          <div>Loading availability...</div>
        ) : slots.length === 0 ? (
          <div className="text-gray-600">No available slots for this date</div>
        ) : (
          <div className="grid grid-cols-4 gap-4 mb-8">
            {slots.map((slot, index) => (
              <button
                key={index}
                onClick={() => setSelectedSlot(`${slot.start_time}-${slot.team_member_id}`)}
                className={`px-4 py-2 border rounded-md ${
                  selectedSlot === `${slot.start_time}-${slot.team_member_id}`
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                {new Date(slot.start_time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => router.back()}
            className="px-6 py-2 border rounded-md"
          >
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedSlot}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

