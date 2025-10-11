/**
 * LogoUploader Component
 * 
 * Drag & drop logo upload component for onboarding Step 2.
 * Provides file validation, preview, and processing functionality.
 */

import React, { useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useLogoUpload } from '../../hooks/useLogoUpload';
import type { LogoUploadState } from '../../hooks/useLogoUpload';

// ===== TYPES =====

interface LogoUploaderProps {
  onLogoChange: (logoData: LogoUploadState['processedImage'] | null) => void;
  onError: (error: string) => void;
  className?: string;
}

// ===== COMPONENT =====

export const LogoUploader: React.FC<LogoUploaderProps> = ({
  onLogoChange,
  onError,
  className = '',
}) => {
  const { state, actions } = useLogoUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection from input
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      actions.handleFileSelect(file);
    }
  }, [actions]);

  // Handle dropzone file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      actions.handleFileSelect(file);
    }
  }, [actions]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/svg+xml': ['.svg'],
    },
    multiple: false,
    maxSize: 2 * 1024 * 1024, // 2MB
  });

  // Notify parent of logo changes
  React.useEffect(() => {
    onLogoChange(state.processedImage);
  }, [state.processedImage, onLogoChange]);

  // Notify parent of errors
  React.useEffect(() => {
    if (state.error) {
      onError(state.error);
    }
  }, [state.error, onError]);

  // Render upload area
  const renderUploadArea = () => {
    if (state.isProcessing) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
          <p className="text-sm text-gray-600">Processing your logo...</p>
        </div>
      );
    }

    if (state.processedImage && state.previewUrl) {
      return (
        <div className="relative">
          <div className="flex items-center justify-center p-4">
            <img
              src={state.previewUrl}
              alt="Logo preview"
              className="max-h-32 max-w-full object-contain rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={actions.clearLogo}
            className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-50 transition-colors"
            aria-label="Remove logo"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4">
          {isDragReject ? (
            <AlertCircle className="h-12 w-12 text-red-500" />
          ) : (
            <Upload className="h-12 w-12 text-gray-400" />
          )}
        </div>
        
        {isDragActive ? (
          <p className="text-lg font-medium text-blue-600 mb-2">
            Drop your logo here...
          </p>
        ) : isDragReject ? (
          <div>
            <p className="text-lg font-medium text-red-600 mb-2">
              Invalid file type
            </p>
            <p className="text-sm text-gray-600">
              Please upload a PNG, JPG, or SVG file
            </p>
          </div>
        ) : (
          <div>
            <p className="text-lg font-medium text-gray-900 mb-2">
              Upload your logo
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Drag & drop your logo here, or click to browse
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Choose File
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render validation messages
  const renderValidationMessages = () => {
    if (!state.validation) return null;

    const { errors, warnings } = state.validation;

    return (
      <div className="mt-4 space-y-2">
        {errors.map((error, index) => (
          <div key={index} className="flex items-center text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ))}
        
        {warnings.map((warning, index) => (
          <div key={index} className="flex items-center text-sm text-yellow-600">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{warning}</span>
          </div>
        ))}
      </div>
    );
  };

  // Render success message
  const renderSuccessMessage = () => {
    if (state.processedImage && state.validation?.isValid) {
      return (
        <div className="mt-4 flex items-center text-sm text-green-600">
          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>Logo uploaded successfully!</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg transition-colors
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
          ${isDragReject ? 'border-red-400 bg-red-50' : ''}
          ${state.processedImage ? 'border-green-300 bg-green-50' : ''}
          ${state.isProcessing ? 'border-blue-300 bg-blue-50' : ''}
          hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        `}
      >
        <input
          {...getInputProps()}
          ref={fileInputRef}
          onChange={handleFileInputChange}
          className="hidden"
          accept="image/png,image/jpeg,image/svg+xml"
        />
        
        {renderUploadArea()}
      </div>

      {renderValidationMessages()}
      {renderSuccessMessage()}

      {/* File requirements */}
      <div className="mt-4 text-xs text-gray-500">
        <p>Supported formats: PNG, JPG, SVG</p>
        <p>Maximum file size: 2MB</p>
        <p>Recommended size: 640×560px or larger</p>
      </div>
    </div>
  );
};
