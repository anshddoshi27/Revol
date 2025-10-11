/**
 * Step1BusinessDetails Page
 * 
 * First step of the onboarding wizard - Business Details.
 * This page captures business identity, location, contact info, staff pre-list and social links.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BusinessDetailsForm } from '../../components/onboarding/BusinessDetailsForm';
import type { BusinessDetailsFormData } from '../../api/types/onboarding';

export const Step1BusinessDetails: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [prefillData, setPrefillData] = useState<any>(null);

  useEffect(() => {
    // Get prefill data from navigation state (from signup)
    if (location.state?.prefill) {
      setPrefillData(location.state.prefill);
      
      // Emit analytics event
      // telemetry.track('onboarding.step1_started', {
      //   has_prefill: true,
      //   prefill_fields: Object.keys(location.state.prefill),
      // });
    } else {
      // telemetry.track('onboarding.step1_started', {
      //   has_prefill: false,
      // });
    }
  }, [location.state]);

  const handleSubmit = async (data: BusinessDetailsFormData) => {
    try {
      // Emit analytics event
      // telemetry.track('onboarding.step1_complete', {
      //   tenant_id: data.slug,
      //   step: 1,
      //   has_staff: data.staff.length > 0,
      //   has_address: !!data.address?.street,
      //   has_social_links: Object.values(data.social_links).some(link => !!link),
      // });

      // Save to localStorage for persistence
      const onboardingData = {
        step1Data: data,
        prefill: prefillData,
      };
      localStorage.setItem('onboarding_data', JSON.stringify(onboardingData));

      // Navigate to next step with form data
      navigate('/onboarding/logo-colors', {
        state: onboardingData,
      });
    } catch (error) {
      console.error('Failed to proceed to next step:', error);
      // Error handling is done in the form component
    }
  };

  const handleBack = () => {
    navigate('/signup');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Set Up Your Business</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Step 1 of 8</span>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '12.5%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Business Details
              </h2>
              <p className="text-gray-600">
                Let's start by gathering some basic information about your business. 
                This will help us set up your booking page and connect you with customers.
              </p>
            </div>

            {/* Prefill Data Display */}
            {prefillData && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  Information from your account:
                </h3>
                <div className="text-sm text-blue-700 space-y-1">
                  {prefillData.owner_email && (
                    <p>Email: {prefillData.owner_email}</p>
                  )}
                  {prefillData.owner_name && (
                    <p>Name: {prefillData.owner_name}</p>
                  )}
                  {prefillData.phone && (
                    <p>Phone: {prefillData.phone}</p>
                  )}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  This information will be pre-filled in the form below.
                </p>
              </div>
            )}

            <BusinessDetailsForm
              initialData={prefillData}
              onSubmit={handleSubmit}
              onBack={handleBack}
              onNext={handleSubmit}
            />
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Need Help?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Here are some tips to help you complete this step:
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>
                  <strong>Business Name:</strong> Use the name customers know you by
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>
                  <strong>Subdomain:</strong> This will be your booking website URL (e.g., mysalon.tithi.com)
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>
                  <strong>Team Members:</strong> Add anyone who provides services to customers
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span>
                  <strong>Social Media:</strong> Help customers find you on social platforms
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
