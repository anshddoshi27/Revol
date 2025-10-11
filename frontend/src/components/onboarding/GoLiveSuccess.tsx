/**
 * GoLiveSuccess Component
 * 
 * Success screen component displayed after a business successfully goes live.
 * Shows celebration message, booking link, and navigation options.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { telemetry } from '../../services/telemetry';
import type { GoLiveData } from '../../api/types/payments';

interface GoLiveSuccessProps {
  goLiveData: GoLiveData;
  tenantId: string;
}

export const GoLiveSuccess: React.FC<GoLiveSuccessProps> = ({
  goLiveData,
  tenantId
}) => {
  const navigate = useNavigate();
  const [copiedLink, setCopiedLink] = useState<'booking' | 'admin' | null>(null);

  useEffect(() => {
    // Emit analytics event
    telemetry.track('owner.go_live_success', {
      tenant_id: tenantId,
      business_name: goLiveData.business_name,
      booking_url: goLiveData.booking_url,
      go_live_date: goLiveData.go_live_date,
    });
  }, [goLiveData, tenantId]);

  const copyToClipboard = async (text: string, type: 'booking' | 'admin') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(type);
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedLink(null), 2000);

      // Emit analytics event
      telemetry.track('owner.link_copied', {
        tenant_id: tenantId,
        link_type: type,
        link_url: text,
      });
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleGoToAdmin = () => {
    // Emit analytics event
    telemetry.track('owner.admin_dashboard_accessed', {
      tenant_id: tenantId,
      source: 'go_live_success',
    });

    navigate('/admin/dashboard');
  };

  const handleViewBookingSite = () => {
    // Emit analytics event
    telemetry.track('owner.booking_site_viewed', {
      tenant_id: tenantId,
      booking_url: goLiveData.booking_url,
      source: 'go_live_success',
    });

    window.open(goLiveData.booking_url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8">
        {/* Success Header */}
        <div className="text-center">
          {/* Confetti Animation */}
          <div className="relative">
            <div className="text-6xl mb-4">🎉</div>
            <div className="absolute -top-2 -left-2 text-4xl animate-bounce">🎊</div>
            <div className="absolute -top-2 -right-2 text-4xl animate-bounce delay-100">✨</div>
            <div className="absolute -bottom-2 -left-4 text-3xl animate-bounce delay-200">🎈</div>
            <div className="absolute -bottom-2 -right-4 text-3xl animate-bounce delay-300">🎁</div>
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {goLiveData.business_name} IS LIVE!
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Congratulations! Your booking site is now live and ready to accept customers.
          </p>
        </div>

        {/* Success Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Your Business is Live!
            </h2>
            <p className="text-gray-600">
              Your booking site went live on {new Date(goLiveData.go_live_date).toLocaleDateString()}
            </p>
          </div>

          {/* Links Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Booking Site Link */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Booking Site</h3>
                  <p className="text-sm text-gray-500">Your public booking page</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={goLiveData.booking_url}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                  />
                  <button
                    onClick={() => copyToClipboard(goLiveData.booking_url, 'booking')}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {copiedLink === 'booking' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={handleViewBookingSite}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  View Booking Site
                </button>
              </div>
            </div>

            {/* Admin Dashboard Link */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Admin Dashboard</h3>
                  <p className="text-sm text-gray-500">Manage your business</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={goLiveData.admin_url}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                  />
                  <button
                    onClick={() => copyToClipboard(goLiveData.admin_url, 'admin')}
                    className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {copiedLink === 'admin' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={handleGoToAdmin}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  Go to Admin Dashboard
                </button>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-4">
              What's Next?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    1
                  </div>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-900">Share Your Booking Link</h4>
                  <p className="text-sm text-blue-700">Send the booking link to your customers and add it to your website.</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    2
                  </div>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-900">Monitor Your Bookings</h4>
                  <p className="text-sm text-blue-700">Use your admin dashboard to manage appointments and track performance.</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    3
                  </div>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-900">Customize Your Experience</h4>
                  <p className="text-sm text-blue-700">Update your services, availability, and branding as needed.</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    4
                  </div>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-900">Get Support</h4>
                  <p className="text-sm text-blue-700">Need help? Check our help center or contact support.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button
              onClick={handleGoToAdmin}
              className="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Go to Admin Dashboard
            </button>
            <button
              onClick={handleViewBookingSite}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              View Booking Site
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

