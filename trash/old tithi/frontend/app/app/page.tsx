/**
 * Dashboard - Shows user's businesses
 * GET /api/v1/tenants
 * After login, user can select a tenant here or via navbar switcher
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/store';
import { useTenants } from '@/lib/hooks';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { data, isLoading, error } = useTenants();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading businesses...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Error loading businesses</div>
      </div>
    );
  }

  const tenants = data?.tenants || [];

  return (
    <AppLayout requiresAuth>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Businesses</h1>
        
        {tenants.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">You don't have any businesses yet.</p>
            <Link
              href="/signup"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
            >
              Create Your First Business
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tenants.map((tenant) => (
              <Link
                key={tenant.id}
                href={`/app/b/${tenant.id}`}
                className="block bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
              >
                <div className="flex items-center mb-4">
                  {tenant.logo_url && (
                    <img
                      src={tenant.logo_url}
                      alt={tenant.name}
                      className="w-12 h-12 rounded mr-4"
                    />
                  )}
                  <h2 className="text-xl font-semibold text-gray-900">{tenant.name}</h2>
                </div>
                {tenant.description && (
                  <p className="text-gray-600 text-sm mb-4">{tenant.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded text-xs ${
                    tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {tenant.status}
                  </span>
                  <span className="text-sm text-gray-500">
                    {tenant.slug}.tithi.com
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

