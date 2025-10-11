/**
 * useLogoUpload Hook
 * 
 * Custom hook for handling logo upload functionality in onboarding Step 2.
 * Provides file validation, processing, and upload state management.
 */

import { useState, useCallback } from 'react';
import { 
  processLogoUpload, 
  validateImageFile, 
  loadImageDimensions,
  type ProcessedImage,
  type ImageValidationResult 
} from '../utils/imageProcessing';
import { trackEvent, trackError } from '../observability';

// ===== TYPES =====

export interface LogoUploadState {
  file: File | null;
  processedImage: ProcessedImage | null;
  validation: ImageValidationResult | null;
  isProcessing: boolean;
  isUploading: boolean;
  error: string | null;
  previewUrl: string | null;
}

export interface LogoUploadActions {
  handleFileSelect: (file: File) => Promise<void>;
  handleFileDrop: (files: FileList) => Promise<void>;
  clearLogo: () => void;
  retryUpload: () => Promise<void>;
}

export interface UseLogoUploadReturn {
  state: LogoUploadState;
  actions: LogoUploadActions;
}

// ===== HOOK IMPLEMENTATION =====

export const useLogoUpload = (): UseLogoUploadReturn => {
  const [state, setState] = useState<LogoUploadState>({
    file: null,
    processedImage: null,
    validation: null,
    isProcessing: false,
    isUploading: false,
    error: null,
    previewUrl: null,
  });

  const handleFileSelect = useCallback(async (file: File) => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      error: null,
      validation: null,
    }));

    try {
      // Validate file
      const validation = validateImageFile(file);
      setState(prev => ({ ...prev, validation }));

      if (!validation.isValid) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          error: validation.errors.join(', '),
        }));
        return;
      }

      // Process the image
      const processedImage = await processLogoUpload(file);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(processedImage.blob);

      setState(prev => ({
        ...prev,
        file,
        processedImage,
        previewUrl,
        isProcessing: false,
        error: null,
      }));

      // Emit analytics event
      trackEvent('onboarding.logo_uploaded', {
        file_size: file.size,
        file_type: file.type,
        dimensions: processedImage.dimensions,
        has_warnings: validation.warnings.length > 0,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMessage,
      }));

      // Emit analytics event
      trackError(new Error(errorMessage), {
        error_type: 'logo_processing',
        error_message: errorMessage,
        file_size: file.size,
        file_type: file.type,
      });
    }
  }, []);

  const handleFileDrop = useCallback(async (files: FileList) => {
    if (files.length === 0) return;
    
    const file = files[0];
    await handleFileSelect(file);
  }, [handleFileSelect]);

  const clearLogo = useCallback(() => {
    // Clean up preview URL
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    setState({
      file: null,
      processedImage: null,
      validation: null,
      isProcessing: false,
      isUploading: false,
      error: null,
      previewUrl: null,
    });
  }, [state.previewUrl]);

  const retryUpload = useCallback(async () => {
    if (state.file) {
      await handleFileSelect(state.file);
    }
  }, [state.file, handleFileSelect]);

  return {
    state,
    actions: {
      handleFileSelect,
      handleFileDrop,
      clearLogo,
      retryUpload,
    },
  };
};
