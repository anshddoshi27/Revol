/**
 * Create Business Modal Component
 * Phase 1: Create business and reserve subdomain
 * 
 * Fields: name, DBA (legal_name), industry
 * Subdomain: instant validation with availability check
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateTenant, useCheckSubdomain } from '@/lib/hooks';
import { useAuth } from '@/lib/store';
import { useRouter } from 'next/navigation';

// Reserved subdomain names (client-side check)
const RESERVED_NAMES = [
  'www', 'api', 'admin', 'app', 'mail', 'ftp', 'localhost', 'staging', 'test',
  'dev', 'development', 'production', 'demo', 'docs', 'help', 'support',
  'blog', 'status', 'about', 'contact', 'terms', 'privacy', 'legal'
];

// Profanity filter (basic - server should also validate)
const PROFANITY_WORDS: string[] = []; // Add list if needed

// Validation schema
const createBusinessSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(255),
  legal_name: z.string().optional(),
  industry: z.string().optional(),
  subdomain: z.string()
    .min(2, 'Subdomain must be at least 2 characters')
    .max(50, 'Subdomain must be at most 50 characters')
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      'Subdomain can only contain lowercase letters, numbers, and hyphens. Cannot start or end with hyphen.'
    ),
});

type CreateBusinessForm = z.infer<typeof createBusinessSchema>;

interface CreateBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateBusinessModal({ isOpen, onClose }: CreateBusinessModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const createTenant = useCreateTenant();
  const checkSubdomain = useCheckSubdomain();
  
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const [isCheckingSubdomain, setIsCheckingSubdomain] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState<string>('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<CreateBusinessForm>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: {
      name: '',
      legal_name: '',
      industry: '',
      subdomain: '',
    },
  });

  const watchedSubdomain = watch('subdomain');

  // Validate subdomain format and reserved names (client-side)
  useEffect(() => {
    if (!watchedSubdomain || watchedSubdomain.length < 2) {
      setSubdomainAvailable(null);
      setSubdomainError(null);
      return;
    }

    // Check reserved names
    if (RESERVED_NAMES.includes(watchedSubdomain.toLowerCase())) {
      setSubdomainError(`${watchedSubdomain} is reserved and cannot be used`);
      setSubdomainAvailable(false);
      return;
    }

    // Check format
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(watchedSubdomain.toLowerCase())) {
      setSubdomainError('Invalid subdomain format');
      setSubdomainAvailable(false);
      return;
    }

    // Clear errors and check availability on server
    setSubdomainError(null);
    const normalizedSubdomain = watchedSubdomain.toLowerCase().trim();
    setCheckingSubdomain(normalizedSubdomain);

    // Debounce subdomain check (500ms)
    const timeoutId = setTimeout(async () => {
      setIsCheckingSubdomain(true);
      try {
        const result = await checkSubdomain.mutateAsync(normalizedSubdomain);
        setSubdomainAvailable(result.available);
        if (!result.available) {
          setSubdomainError(`${normalizedSubdomain} is already taken`);
        } else {
          setSubdomainError(null);
        }
      } catch (error: any) {
        // Handle validation errors from backend
        if (error.response?.data?.error?.message) {
          setSubdomainError(error.response.data.error.message);
          setSubdomainAvailable(false);
        } else {
          setSubdomainError('Failed to check subdomain availability');
          setSubdomainAvailable(null);
        }
      } finally {
        setIsCheckingSubdomain(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [watchedSubdomain, checkSubdomain]);

  const onSubmit = async (data: CreateBusinessForm) => {
    // Final validation
    if (!subdomainAvailable) {
      setError('subdomain', {
        type: 'manual',
        message: subdomainError || 'Please check subdomain availability',
      });
      return;
    }

    // Get user email (required by backend)
    if (!user?.email) {
      setError('root', {
        type: 'manual',
        message: 'User email is required. Please log out and log back in.',
      });
      return;
    }

    try {
      const tenant = await createTenant.mutateAsync({
        name: data.name,
        email: user.email, // Required by backend
        legal_name: data.legal_name || undefined,
        industry: data.industry || undefined,
        slug: data.subdomain.toLowerCase().trim(),
        // Backend defaults: timezone: UTC, currency: USD, locale: en_US
      });

      // Close modal and navigate to business admin
      reset();
      onClose();
      router.push(`/app/b/${tenant.id}`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Failed to create business';
      setError('root', {
        type: 'manual',
        message: errorMessage,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create Business</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Business Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('name')}
                type="text"
                id="name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., My Salon"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Legal Name (DBA) */}
            <div>
              <label htmlFor="legal_name" className="block text-sm font-medium text-gray-700 mb-2">
                Legal Business Name (DBA) <span className="text-gray-500 text-xs">(Optional)</span>
              </label>
              <input
                {...register('legal_name')}
                type="text"
                id="legal_name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., My Salon LLC"
              />
              {errors.legal_name && (
                <p className="mt-1 text-sm text-red-600">{errors.legal_name.message}</p>
              )}
            </div>

            {/* Industry */}
            <div>
              <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
                Industry <span className="text-gray-500 text-xs">(Optional)</span>
              </label>
              <input
                {...register('industry')}
                type="text"
                id="industry"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Beauty, Healthcare, Wellness"
              />
              {errors.industry && (
                <p className="mt-1 text-sm text-red-600">{errors.industry.message}</p>
              )}
            </div>

            {/* Subdomain */}
            <div>
              <label htmlFor="subdomain" className="block text-sm font-medium text-gray-700 mb-2">
                Booking Website URL <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center">
                <input
                  {...register('subdomain')}
                  type="text"
                  id="subdomain"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="your-business-name"
                  onChange={(e) => {
                    // Force lowercase and remove spaces
                    const value = e.target.value.toLowerCase().replace(/\s+/g, '');
                    e.target.value = value;
                    register('subdomain').onChange(e);
                  }}
                />
                <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                  .tithi.com
                </span>
              </div>
              
              {/* Subdomain validation status */}
              {watchedSubdomain && watchedSubdomain.length >= 2 && (
                <div className="mt-2">
                  {isCheckingSubdomain ? (
                    <p className="text-sm text-gray-500">Checking availability...</p>
                  ) : subdomainAvailable === true ? (
                    <p className="text-sm text-green-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Available! Your booking site will be at {watchedSubdomain.toLowerCase()}.tithi.com
                    </p>
                  ) : subdomainAvailable === false ? (
                    <p className="text-sm text-red-600">{subdomainError || 'This subdomain is not available'}</p>
                  ) : null}
                </div>
              )}

              {errors.subdomain && (
                <p className="mt-1 text-sm text-red-600">{errors.subdomain.message}</p>
              )}

              <p className="mt-1 text-xs text-gray-500">
                Only lowercase letters, numbers, and hyphens. 2-50 characters.
              </p>
            </div>

            {/* Root error */}
            {errors.root && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errors.root.message}</p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting || !subdomainAvailable || isCheckingSubdomain}
              >
                {isSubmitting ? 'Creating...' : 'Create Business'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
