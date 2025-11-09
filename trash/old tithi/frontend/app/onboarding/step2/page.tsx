/**
 * Onboarding Step 2: Branding
 * Form for: logo upload, brand color picker
 * Autosaves to: PUT /api/admin/branding (requires X-Tenant-ID header)
 * Logo upload: POST /api/admin/branding/upload-logo (multipart/form-data)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/store';
import { tenantsApi, brandingApi } from '@/lib/api-client';
import LivePreview from '@/components/onboarding/LivePreview';
import { useDebounce } from '@/lib/hooks/use-debounce';

interface BrandingForm {
  logo_url: string;
  primary_color: string;
  secondary_color?: string;
}

export default function OnboardingStep2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentTenant, isAuthenticated } = useAuth();
  const tenantId = searchParams.get('tenant_id') || currentTenant?.id || '';

  const [formData, setFormData] = useState<BrandingForm>({
    logo_url: '',
    primary_color: '#6366f1', // Default indigo
    secondary_color: '#8b5cf6',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounced form data for autosave
  const debouncedFormData = useDebounce(formData, 1000);

  // Fetch existing branding data
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (!tenantId) {
      router.push('/onboarding');
      return;
    }

    const fetchBrandingData = async () => {
      try {
        setLoading(true);
        const response = await tenantsApi.get(tenantId);
        const tenant = response.tenant;

        setFormData({
          logo_url: tenant.logo_url || '',
          primary_color: tenant.primary_color || '#6366f1',
          secondary_color: tenant.settings?.secondary_color || '#8b5cf6',
        });
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load branding settings');
      } finally {
        setLoading(false);
      }
    };

    fetchBrandingData();
  }, [tenantId, isAuthenticated, router]);

  // Autosave when form data changes (colors)
  useEffect(() => {
    if (!tenantId || !debouncedFormData.primary_color) return;

    const autosave = async () => {
      try {
        setSaving(true);
        
        // Update branding via branding API
        await brandingApi.update({
          primary_color: debouncedFormData.primary_color,
          secondary_color: debouncedFormData.secondary_color,
        });

        setLastSaved(new Date());
      } catch (err: any) {
        console.error('Autosave failed:', err);
      } finally {
        setSaving(false);
      }
    };

    autosave();
  }, [debouncedFormData.primary_color, debouncedFormData.secondary_color, tenantId]);

  const handleColorChange = (field: 'primary_color' | 'secondary_color', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a valid image file (PNG, JPG, GIF, SVG, or WebP)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    try {
      setUploadingLogo(true);
      setError('');

      const result = await brandingApi.uploadLogo(file);
      setFormData((prev) => ({ ...prev, logo_url: result.logo_url }));
      setLastSaved(new Date());
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setFormData((prev) => ({ ...prev, logo_url: '' }));
    // Optionally call API to remove logo
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      
      // Final save before moving to next step
      await brandingApi.update({
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
      });

      router.push(`/onboarding/step3?tenant_id=${tenantId}`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save branding settings');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !formData.primary_color) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading branding settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Step 2: Branding</h1>
                <p className="text-gray-600">Customize the look of your booking site</p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>
              )}

              {saving && (
                <div className="bg-blue-50 text-blue-700 p-2 rounded mb-4 text-sm flex items-center">
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </div>
              )}

              {lastSaved && (
                <div className="bg-green-50 text-green-700 p-2 rounded mb-4 text-sm">
                  ✓ Saved {lastSaved.toLocaleTimeString()}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Logo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo
                  </label>
                  <div className="flex items-center space-x-4">
                    {formData.logo_url ? (
                      <div className="flex items-center space-x-4">
                        <img
                          src={formData.logo_url}
                          alt="Logo preview"
                          className="h-20 w-20 object-contain border border-gray-300 rounded"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingLogo}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">PNG, JPG, GIF, SVG or WebP (max 5MB)</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Color */}
                <div>
                  <label htmlFor="primary_color" className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Brand Color *
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      id="primary_color"
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => handleColorChange('primary_color', e.target.value)}
                      className="h-12 w-20 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.primary_color}
                      onChange={(e) => handleColorChange('primary_color', e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="#6366f1"
                      pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                    />
                  </div>
                </div>

                {/* Secondary Color (Optional) */}
                <div>
                  <label htmlFor="secondary_color" className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Color (Optional)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      id="secondary_color"
                      type="color"
                      value={formData.secondary_color || '#8b5cf6'}
                      onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                      className="h-12 w-20 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.secondary_color || ''}
                      onChange={(e) => handleColorChange('secondary_color', e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="#8b5cf6"
                      pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                    />
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => router.push(`/onboarding/step1?tenant_id=${tenantId}`)}
                    className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !formData.primary_color}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Saving...' : 'Continue to Services'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Live Preview Section */}
          <div className="lg:col-span-1">
            <LivePreview tenantId={tenantId} brandingData={formData} />
          </div>
        </div>
      </div>
    </div>
  );
}
