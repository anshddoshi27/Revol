/**
 * SignUpForm Component
 * 
 * Form component for user registration with validation and error handling.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, SignUpFormData, AuthError } from '../auth';
// generateIdempotencyKey will be used when backend integration is complete
// import { generateIdempotencyKey } from '../api/idempotency';
// import { telemetry } from '../observability';

interface SignUpFormProps {
  onSuccess?: (user: any, onboardingPrefill: any) => void;
  onError?: (error: AuthError) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ onSuccess, onError }) => {
  const [formData, setFormData] = useState<SignUpFormData>({
    email: '',
    password: '',
    phone: '',
    first_name: '',
    last_name: '',
  });
  
  const [errors, setErrors] = useState<Partial<SignUpFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  
  const navigate = useNavigate();

  const validateField = (name: keyof SignUpFormData, value: string): string => {
    switch (name) {
      case 'email':
        if (!value) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
        return '';
      
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters long';
        return '';
      
      case 'phone':
        if (!value) return 'Phone number is required';
        if (!/^\+?[\d\s\-\(\)]+$/.test(value)) return 'Please enter a valid phone number';
        return '';
      
      case 'first_name':
        if (!value) return 'First name is required';
        if (value.length < 2) return 'First name must be at least 2 characters long';
        return '';
      
      case 'last_name':
        if (!value) return 'Last name is required';
        if (value.length < 2) return 'Last name must be at least 2 characters long';
        return '';
      
      default:
        return '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof SignUpFormData;
    
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear field error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
    
    // Clear submit error
    if (submitError) {
      setSubmitError('');
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof SignUpFormData;
    
    const error = validateField(fieldName, value);
    if (error) {
      setErrors(prev => ({ ...prev, [fieldName]: error }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<SignUpFormData> = {};
    let isValid = true;

    (Object.keys(formData) as Array<keyof SignUpFormData>).forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Emit analytics event
    // telemetry.track('auth.signup_submit', {
    //   email: formData.email,
    //   has_phone: !!formData.phone,
    // });

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const result = await authService.signup(formData);
      
      // Emit success analytics event
      // telemetry.track('auth.signup_success', {
      //   user_id: result.user.id,
      //   email: result.user.email,
      // });

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(result.user, result.onboardingPrefill);
      } else {
        // Default behavior: redirect to onboarding
        navigate('/onboarding/step-1', {
          state: { prefill: result.onboardingPrefill },
        });
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Emit error analytics event
      // telemetry.track('auth.signup_error', {
      //   error_code: error.code || 'unknown',
      //   error_message: error.message,
      // });

      // Handle specific error types
      if (error.code === 'TITHI_DUPLICATE_EMAIL_ERROR') {
        setErrors({ email: 'Email already exists. Please use a different email address.' });
      } else if (error.code === 'TITHI_VALIDATION_ERROR') {
        if (error.field) {
          setErrors({ [error.field]: error.message });
        } else {
          setSubmitError(error.message);
        }
      } else {
        setSubmitError(error.message || 'Sign-up failed. Please try again.');
      }

      // Call error callback if provided
      if (onError) {
        onError(error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Submit Error */}
      {submitError && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{submitError}</div>
        </div>
      )}

      {/* First Name */}
      <div>
        <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
          First Name *
        </label>
        <input
          id="first_name"
          name="first_name"
          type="text"
          value={formData.first_name}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            errors.first_name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
          }`}
          required
          aria-describedby={errors.first_name ? 'first_name-error' : undefined}
        />
        {errors.first_name && (
          <p id="first_name-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.first_name}
          </p>
        )}
      </div>

      {/* Last Name */}
      <div>
        <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
          Last Name *
        </label>
        <input
          id="last_name"
          name="last_name"
          type="text"
          value={formData.last_name}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            errors.last_name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
          }`}
          required
          aria-describedby={errors.last_name ? 'last_name-error' : undefined}
        />
        {errors.last_name && (
          <p id="last_name-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.last_name}
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email Address *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
          }`}
          required
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Phone Number *
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            errors.phone ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
          }`}
          required
          aria-describedby={errors.phone ? 'phone-error' : undefined}
        />
        {errors.phone && (
          <p id="phone-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.phone}
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password *
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
          }`}
          required
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.password}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          Password must be at least 8 characters long.
        </p>
      </div>

      {/* Submit Button */}
      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </div>
    </form>
  );
};
