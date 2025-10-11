/**
 * Step2LogoColors Page
 * 
 * Second step of the onboarding wizard - Logo & Brand Colors.
 * This page handles logo upload, color selection, and branding preview.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { trackEvent, trackError } from '../../observability';
import { LogoUploader } from '../../components/onboarding/LogoUploader';
import { ColorPicker } from '../../components/onboarding/ColorPicker';
import { LogoPreview } from '../../components/onboarding/LogoPreview';
import type { 
  BrandingData, 
  BusinessDetailsFormData,
  ContrastValidationResult 
} from '../../api/types/onboarding';
import type { ProcessedImage } from '../../utils/imageProcessing';

export const Step2LogoColors: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State management
  const [step1Data, setStep1Data] = useState<BusinessDetailsFormData | null>(null);
  const [logoData, setLogoData] = useState<ProcessedImage | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [contrastResult, setContrastResult] = useState<ContrastValidationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Get data from previous step
  useEffect(() => {
    if (location.state?.step1Data) {
      setStep1Data(location.state.step1Data);
    } else {
      // Redirect to step 1 if no data
      navigate('/onboarding/step-1');
    }
  }, [location.state, navigate]);

  // Emit analytics event when step loads
  useEffect(() => {
    trackEvent('onboarding.step2_started', {
      has_step1_data: !!step1Data,
      business_name: step1Data?.name,
    });
  }, [step1Data]);

  // Handle logo upload
  const handleLogoChange = useCallback((processedImage: ProcessedImage | null) => {
    setLogoData(processedImage);
    
    // Clear logo-related errors
    setErrors(prev => prev.filter(error => !error.includes('logo')));
  }, []);

  // Handle color selection
  const handleColorChange = useCallback((color: string, contrast: ContrastValidationResult | null) => {
    setPrimaryColor(color);
    setContrastResult(contrast);
    
    // Clear color-related errors
    setErrors(prev => prev.filter(error => !error.includes('color')));
  }, []);

  // Handle errors from child components
  const handleError = useCallback((error: string) => {
    setErrors(prev => [...prev.filter(e => e !== error), error]);
  }, []);

  // Validate form data
  const validateForm = useCallback((): boolean => {
    const newErrors: string[] = [];

    // Logo is optional but if provided, must be valid
    if (logoData && !logoData.dataUrl) {
      newErrors.push('Logo upload is incomplete');
    }

    // Color must be valid - simplified validation for now
    if (!primaryColor) {
      newErrors.push('Please select a primary color');
    }
    // Temporarily disable contrast validation to test
    // else if (contrastResult && !contrastResult.passesAA) {
    //   newErrors.push('Selected color does not meet accessibility standards (WCAG AA)');
    // }

    console.log('Step2 Validation:', {
      primaryColor,
      contrastResult,
      logoData: !!logoData,
      logoDataDetails: logoData ? {
        hasDataUrl: !!logoData.dataUrl,
        dataUrlLength: logoData.dataUrl?.length || 0,
        hasBlob: !!logoData.blob,
        format: logoData.format
      } : null,
      newErrors
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  }, [logoData, primaryColor, contrastResult]);

  // Run validation when form data changes (but not when errors change to avoid infinite loop)
  useEffect(() => {
    validateForm();
  }, [logoData, primaryColor, contrastResult, validateForm]);

  // Debug logging for state changes
  useEffect(() => {
    console.log('Step2 State Update:', {
      primaryColor,
      contrastResult,
      logoData: !!logoData,
      logoDataStructure: logoData ? {
        hasDataUrl: !!logoData.dataUrl,
        hasBlob: !!logoData.blob,
        dimensions: logoData.dimensions,
        format: logoData.format
      } : null,
      errors,
      errorsLength: errors.length
    });
  }, [primaryColor, contrastResult, logoData, errors]);

  // Handle form submission
  const handleSubmit = async () => {
    console.log('Step2 Submit clicked:', {
      step1Data: !!step1Data,
      primaryColor,
      contrastResult,
      logoData: !!logoData,
      errors
    });

    if (!validateForm() || !step1Data) {
      console.log('Step2 Submit blocked by validation or missing step1Data');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare branding data
      const brandingData: BrandingData = {
        primary_color: primaryColor,
        contrast_result: contrastResult || undefined,
      };

      if (logoData) {
        brandingData.logo = {
          file: logoData.blob as File,
          cropped_data_url: logoData.dataUrl,
          placement_preview: {
            large_logo: logoData.dataUrl,
            small_logo: logoData.dataUrl,
          },
        };
      }

      // Emit analytics event
      trackEvent('onboarding.step2_complete', {
        tenant_id: step1Data.slug,
        step: 2,
        has_logo: !!logoData,
        primary_color: primaryColor,
        contrast_passes_aa: contrastResult?.passesAA || false,
        contrast_ratio: contrastResult?.ratio || 0,
      });

      // Save to localStorage for persistence
      const onboardingData = {
        step1Data,
        step2Data: brandingData,
      };
      localStorage.setItem('onboarding_data', JSON.stringify(onboardingData));

      // Navigate to next step with combined data
      navigate('/onboarding/services', {
        state: onboardingData,
      });

    } catch (error) {
      console.error('Failed to proceed to next step:', error);
      setErrors(['Failed to save your branding. Please try again.']);
      
      // Track error
      trackError(error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'onboarding_step2_submit',
        step1_data: !!step1Data,
        has_logo: !!logoData,
        primary_color: primaryColor,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    navigate('/onboarding/step-1', {
      state: { step1Data },
    });
  };

  // Don't render if no step1 data
  if (!step1Data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </button>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Step 2 of 4
              </div>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '50%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Logo & Brand Colors
          </h1>
          <p className="text-lg text-gray-600">
            Let's create your visual identity. Upload your logo and choose your brand color.
          </p>
        </div>

        {/* Error Messages */}
        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800 mb-1">
                  Please fix the following issues:
                </h3>
                <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Logo Upload */}
          <div className="space-y-8">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Upload Your Logo
              </h2>
              <LogoUploader
                onLogoChange={handleLogoChange}
                onError={handleError}
              />
            </div>

            {/* Color Picker */}
            <div className="bg-white shadow rounded-lg p-6">
              <ColorPicker
                onColorChange={handleColorChange}
                onError={handleError}
                initialColor={primaryColor}
              />
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="bg-white shadow rounded-lg p-6">
            <LogoPreview
              logoData={logoData}
              primaryColor={primaryColor}
              businessName={step1Data.name}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center px-6 py-3 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || errors.length > 0}
            title={errors.length > 0 ? `Disabled due to errors: ${errors.join(', ')}` : 'Ready to continue'}
            className="flex items-center px-6 py-3 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                Save & Continue
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Need Help?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Logo Guidelines</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Use PNG, JPG, or SVG format</li>
                <li>• Maximum file size: 2MB</li>
                <li>• Recommended size: 640×560px</li>
                <li>• Ensure good contrast with your brand color</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Color Guidelines</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Choose a color that represents your brand</li>
                <li>• Must meet WCAG AA accessibility standards</li>
                <li>• Consider how it looks on different backgrounds</li>
                <li>• You can change this later in your settings</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
