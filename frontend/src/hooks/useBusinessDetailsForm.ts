/**
 * useBusinessDetailsForm Hook
 * 
 * Custom hook for managing business details form state and validation.
 */

import { useState, useCallback, useMemo } from 'react';
import { onboardingService } from '../api/services/onboarding';
import { STAFF_COLORS } from '../api/types/onboarding';
import type { 
  BusinessDetailsFormData, 
  StaffMember, 
  AddressData, 
  SocialLinksData 
} from '../api/types/onboarding';

interface UseBusinessDetailsFormOptions {
  initialData?: Partial<BusinessDetailsFormData>;
  onSubmit?: (data: BusinessDetailsFormData) => Promise<void>;
}

interface UseBusinessDetailsFormReturn {
  formData: BusinessDetailsFormData;
  updateField: <K extends keyof BusinessDetailsFormData>(
    field: K, 
    value: BusinessDetailsFormData[K]
  ) => void;
  addStaff: (staff: Omit<StaffMember, 'id' | 'color'>) => void;
  removeStaff: (index: number) => void;
  updateStaff: (index: number, updates: Partial<StaffMember>) => void;
  updateAddress: (address: Partial<AddressData>) => void;
  updateSocialLinks: (links: Partial<SocialLinksData>) => void;
  validateForm: () => boolean;
  submitForm: () => Promise<void>;
  isSubmitting: boolean;
  errors: Record<string, string>;
  clearErrors: () => void;
}

export const useBusinessDetailsForm = (
  options: UseBusinessDetailsFormOptions = {}
): UseBusinessDetailsFormReturn => {
  const { initialData = {}, onSubmit } = options;

  const [formData, setFormData] = useState<BusinessDetailsFormData>({
    name: '',
    description: '',
    timezone: 'America/New_York',
    slug: '',
    dba: '',
    industry: '',
    address: {
      street: '',
      city: '',
      state_province: '',
      postal_code: '',
      country: 'US',
    },
    website: '',
    phone: '',
    support_email: '',
    staff: [],
    social_links: {
      instagram: '',
      facebook: '',
      tiktok: '',
      youtube: '',
      x: '',
      website: '',
    },
    ...initialData,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get used staff colors
  const usedColors = useMemo(() => 
    formData.staff.map(staff => staff.color), 
    [formData.staff]
  );

  // Get next available color
  const getNextColor = useCallback(() => {
    const availableColors = STAFF_COLORS.filter(color => !usedColors.includes(color));
    return availableColors[0] || STAFF_COLORS[0];
  }, [usedColors]);

  // Update form field
  const updateField = useCallback(<K extends keyof BusinessDetailsFormData>(
    field: K, 
    value: BusinessDetailsFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  // Add staff member
  const addStaff = useCallback((staff: Omit<StaffMember, 'id' | 'color'>) => {
    const newStaff: StaffMember = {
      ...staff,
      id: `staff-${Date.now()}`,
      color: getNextColor(),
    };
    
    setFormData(prev => ({
      ...prev,
      staff: [...prev.staff, newStaff],
    }));
  }, [getNextColor]);

  // Remove staff member
  const removeStaff = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      staff: prev.staff.filter((_, i) => i !== index),
    }));
  }, []);

  // Update staff member
  const updateStaff = useCallback((index: number, updates: Partial<StaffMember>) => {
    setFormData(prev => ({
      ...prev,
      staff: prev.staff.map((staff, i) => 
        i === index ? { ...staff, ...updates } : staff
      ),
    }));
  }, []);

  // Update address
  const updateAddress = useCallback((address: Partial<AddressData>) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, ...address },
    }));
  }, []);

  // Update social links
  const updateSocialLinks = useCallback((links: Partial<SocialLinksData>) => {
    setFormData(prev => ({
      ...prev,
      social_links: { ...prev.social_links, ...links },
    }));
  }, []);

  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Business name is required';
    }

    if (!formData.timezone) {
      newErrors.timezone = 'Timezone is required';
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Subdomain is required';
    }

    // Email validation
    if (formData.support_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.support_email)) {
      newErrors.support_email = 'Please enter a valid email address';
    }

    // Website validation
    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      newErrors.website = 'Please enter a valid website URL (include http:// or https://)';
    }

    // Phone validation (basic)
    if (formData.phone && !/^[\+]?[\d\s\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Staff validation
    formData.staff.forEach((staff, index) => {
      if (!staff.name.trim()) {
        newErrors[`staff.${index}.name`] = 'Staff name is required';
      }
      if (!staff.role.trim()) {
        newErrors[`staff.${index}.role`] = 'Staff role is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Submit form
  const submitForm = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Convert form data to API format
      const apiData = {
        business_name: formData.name,
        category: formData.industry,
        owner_email: formData.support_email || '',
        owner_name: formData.name, // This should come from user context
        timezone: formData.timezone,
        currency: 'USD',
        locale: 'en_US',
      };

      if (onSubmit) {
        await onSubmit(formData);
      } else {
        await onboardingService.register(apiData);
      }
    } catch (error: any) {
      console.error('Form submission error:', error);
      
      // Handle validation errors
      if (error.status === 400 && error.validation_errors) {
        const validationErrors: Record<string, string> = {};
        error.validation_errors.forEach((err: any) => {
          validationErrors[err.field] = err.message;
        });
        setErrors(validationErrors);
      } else {
        setErrors({ 
          general: error.message || 'Failed to submit form. Please try again.' 
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, onSubmit]);

  // Clear errors
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    formData,
    updateField,
    addStaff,
    removeStaff,
    updateStaff,
    updateAddress,
    updateSocialLinks,
    validateForm,
    submitForm,
    isSubmitting,
    errors,
    clearErrors,
  };
};
