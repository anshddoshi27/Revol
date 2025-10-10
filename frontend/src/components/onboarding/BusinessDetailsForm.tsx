/**
 * BusinessDetailsForm Component
 * 
 * Main form component for Step 1 of the onboarding process.
 * Captures business identity, location, contact info, staff pre-list and social links.
 */

import React, { useEffect } from 'react';
import { useBusinessDetailsForm } from '../../hooks/useBusinessDetailsForm';
import { useSubdomainValidation } from '../../hooks/useSubdomainValidation';
import { AddressGroup } from './AddressGroup';
import { SocialLinksForm } from './SocialLinksForm';
import { StaffRepeater } from './StaffRepeater';
import { COMMON_TIMEZONES, INDUSTRY_OPTIONS } from '../../api/types/onboarding';

interface BusinessDetailsFormProps {
  initialData?: any;
  onSubmit?: (data: any) => Promise<void>;
  onBack?: () => void;
  onNext?: (data: any) => void;
}

export const BusinessDetailsForm: React.FC<BusinessDetailsFormProps> = ({
  initialData,
  onSubmit,
  onBack,
  onNext,
}) => {
  const {
    formData,
    updateField,
    addStaff,
    removeStaff,
    updateStaff,
    updateAddress,
    updateSocialLinks,
    submitForm,
    isSubmitting,
    errors,
    clearErrors,
  } = useBusinessDetailsForm({
    initialData,
    onSubmit,
  });

  const {
    subdomain,
    setSubdomain,
    isValid: isSubdomainValid,
    isChecking: isSubdomainChecking,
    isAvailable: isSubdomainAvailable,
    error: subdomainError,
  } = useSubdomainValidation();

  // Sync subdomain with form data
  useEffect(() => {
    if (subdomain !== formData.slug) {
      updateField('slug', subdomain);
    }
  }, [subdomain, formData.slug, updateField]);

  // Auto-generate slug from business name
  useEffect(() => {
    if (formData.name && !formData.slug) {
      const generatedSlug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setSubdomain(generatedSlug);
    }
  }, [formData.name, formData.slug, setSubdomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    
    try {
      await submitForm();
      if (onNext) {
        onNext(formData);
      }
    } catch (error) {
      console.error('Form submission failed:', error);
    }
  };

  const isFormValid = 
    formData.name.trim() &&
    formData.timezone &&
    formData.slug.trim() &&
    isSubdomainValid &&
    isSubdomainAvailable === true;

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* General Error Display */}
      {errors.general && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{errors.general}</div>
            </div>
          </div>
        </div>
      )}

      {/* Business Information */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Business Information</h3>
          <p className="mt-1 text-sm text-gray-600">
            Tell us about your business so customers can find you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="business-name" className="block text-sm font-medium text-gray-700">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="business-name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.name ? 'border-red-300' : ''
              }`}
              placeholder="My Amazing Salon"
              required
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="business-description" className="block text-sm font-medium text-gray-700">
              Business Description
            </label>
            <textarea
              id="business-description"
              rows={3}
              value={formData.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Brief description of your business and services..."
            />
          </div>

          <div>
            <label htmlFor="dba" className="block text-sm font-medium text-gray-700">
              Doing Business As (DBA)
            </label>
            <input
              type="text"
              id="dba"
              value={formData.dba || ''}
              onChange={(e) => updateField('dba', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Legal business name if different"
            />
          </div>

          <div>
            <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
              Industry
            </label>
            <select
              id="industry"
              value={formData.industry || ''}
              onChange={(e) => updateField('industry', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Select an industry</option>
              {INDUSTRY_OPTIONS.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Subdomain */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Your Booking Website</h3>
          <p className="mt-1 text-sm text-gray-600">
            Choose a unique subdomain for your booking website.
          </p>
        </div>

        <div>
          <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700">
            Subdomain <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="text"
              id="subdomain"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              className={`block w-full rounded-l-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                subdomainError ? 'border-red-300' : ''
              }`}
              placeholder="my-salon"
              required
            />
            <span className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm">
              .tithi.com
            </span>
          </div>
          
          {isSubdomainChecking && (
            <p className="mt-1 text-sm text-blue-600">Checking availability...</p>
          )}
          
          {subdomainError && (
            <p className="mt-1 text-sm text-red-600">{subdomainError}</p>
          )}
          
          {isSubdomainAvailable === true && (
            <p className="mt-1 text-sm text-green-600">✓ Available!</p>
          )}
        </div>
      </div>

      {/* Location & Contact */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Location & Contact</h3>
          <p className="mt-1 text-sm text-gray-600">
            Help customers find and contact your business.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
              Timezone <span className="text-red-500">*</span>
            </label>
            <select
              id="timezone"
              value={formData.timezone}
              onChange={(e) => updateField('timezone', e.target.value)}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.timezone ? 'border-red-300' : ''
              }`}
              required
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.offset})
                </option>
              ))}
            </select>
            {errors.timezone && (
              <p className="mt-1 text-sm text-red-600">{errors.timezone}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone || ''}
              onChange={(e) => updateField('phone', e.target.value)}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.phone ? 'border-red-300' : ''
              }`}
              placeholder="+1 (555) 123-4567"
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
            )}
          </div>

          <div>
            <label htmlFor="website" className="block text-sm font-medium text-gray-700">
              Website
            </label>
            <input
              type="url"
              id="website"
              value={formData.website || ''}
              onChange={(e) => updateField('website', e.target.value)}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.website ? 'border-red-300' : ''
              }`}
              placeholder="https://yourwebsite.com"
            />
            {errors.website && (
              <p className="mt-1 text-sm text-red-600">{errors.website}</p>
            )}
          </div>

          <div>
            <label htmlFor="support-email" className="block text-sm font-medium text-gray-700">
              Support Email
            </label>
            <input
              type="email"
              id="support-email"
              value={formData.support_email || ''}
              onChange={(e) => updateField('support_email', e.target.value)}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.support_email ? 'border-red-300' : ''
              }`}
              placeholder="support@yourbusiness.com"
            />
            {errors.support_email && (
              <p className="mt-1 text-sm text-red-600">{errors.support_email}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Business Address
          </label>
          <AddressGroup
            address={formData.address || {}}
            onChange={updateAddress}
            errors={errors}
          />
        </div>
      </div>

      {/* Team Members */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
          <p className="mt-1 text-sm text-gray-600">
            Add your team members to set up availability and services.
          </p>
        </div>

        <StaffRepeater
          staff={formData.staff}
          onAdd={addStaff}
          onRemove={removeStaff}
          onUpdate={updateStaff}
          errors={errors}
        />
      </div>

      {/* Social Links */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Social Media</h3>
          <p className="mt-1 text-sm text-gray-600">
            Connect your social media profiles to help customers find you online.
          </p>
        </div>

        <SocialLinksForm
          socialLinks={formData.social_links}
          onChange={updateSocialLinks}
          errors={errors}
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-between pt-6 border-t border-gray-200">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Back
          </button>
        )}
        
        <div className="flex-1" />
        
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </form>
  );
};
