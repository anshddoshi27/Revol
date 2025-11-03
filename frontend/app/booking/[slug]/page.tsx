/**
 * Public Booking Flow - Catalog Page
 * GET /booking/tenant-data/{tenant_id}
 * 
 * Shows business info, categories, and services
 * Route: /booking/{slug} (handled by Next.js rewrite from /b/{slug})
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenantBookingData } from '@/lib/hooks';
import { bookingFlowApi } from '@/lib/api-client';

export default function BookingCatalogPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  // BACKEND CHANGE NEEDED: Need endpoint to get tenant_id from slug
  // For now, assuming we can derive it or need a lookup endpoint
  const [tenantId, setTenantId] = useState<string | null>(null);
  
  const { data, isLoading, error } = useTenantBookingData(tenantId || '');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Business not found</div>
      </div>
    );
  }

  const { business_info, categories } = data;

  return (
    <div className="min-h-screen bg-white">
      {/* Business Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center mb-4">
            {business_info.logo_url && (
              <img
                src={business_info.logo_url}
                alt={business_info.name}
                className="w-16 h-16 rounded mr-4"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold" style={{ color: business_info.primary_color }}>
                {business_info.name}
              </h1>
              {business_info.description && (
                <p className="text-gray-600 mt-2">{business_info.description}</p>
              )}
            </div>
          </div>
          
          {business_info.address && (
            <div className="text-sm text-gray-600">
              {business_info.address.street}, {business_info.address.city}, {business_info.address.state} {business_info.address.postal_code}
            </div>
          )}
        </div>
      </header>

      {/* Categories and Services */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {categories.map((category) => (
          <div key={category.id} className="mb-12">
            <h2 className="text-2xl font-semibold mb-4" style={{ color: category.color }}>
              {category.name}
            </h2>
            {category.description && (
              <p className="text-gray-600 mb-6">{category.description}</p>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {category.services.map((service) => (
                <div
                  key={service.id}
                  className="border rounded-lg p-6 hover:shadow-lg transition cursor-pointer"
                  onClick={() => router.push(`/booking/${slug}/service/${service.id}`)}
                >
                  <h3 className="text-xl font-semibold mb-2">{service.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{service.description}</p>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      {service.duration_minutes} minutes
                    </div>
                    <div className="text-lg font-semibold">
                      ${(service.price_cents / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

