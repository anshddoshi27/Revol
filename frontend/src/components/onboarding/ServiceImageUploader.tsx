/**
 * ServiceImageUploader Component
 * 
 * Component for uploading and managing service images with drag & drop,
 * cropping, and validation functionality.
 */

import React, { useState, useCallback, useRef } from 'react';
import { servicesService } from '../../api/services/services';
import { onboardingStep3Observability, onboardingStep3ErrorTracking, onboardingStep3PerformanceTracking } from '../../observability/onboarding';
import type { ServiceImageUploadData, ServiceImageUploadResponse } from '../../api/types/services';

interface ServiceImageUploaderProps {
  serviceId?: string;
  initialImageUrl?: string;
  onImageUploaded?: (response: ServiceImageUploadResponse) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  maxFileSize?: number; // in bytes
  acceptedFormats?: string[];
}

interface ImagePreviewProps {
  imageUrl: string;
  onRemove: () => void;
  onReplace: () => void;
  disabled?: boolean;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ imageUrl, onRemove, onReplace, disabled = false }) => {
  return (
    <div className="relative group">
      <div className="aspect-square w-full max-w-xs mx-auto">
        <img
          src={imageUrl}
          alt="Service preview"
          className="w-full h-full object-cover rounded-lg border border-gray-200"
        />
      </div>
      
      {/* Overlay with actions */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
        <div className="flex space-x-2">
          <button
            onClick={onReplace}
            disabled={disabled}
            className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Replace
          </button>
          <button
            onClick={onRemove}
            disabled={disabled}
            className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

interface CropModalProps {
  imageUrl: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const CropModal: React.FC<CropModalProps> = ({ imageUrl, onCrop, onCancel }) => {
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropArea.x, y: e.clientY - cropArea.y });
  }, [cropArea]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    setCropArea(prev => ({
      ...prev,
      x: Math.max(0, Math.min(newX, 200 - prev.width)),
      y: Math.max(0, Math.min(newY, 200 - prev.height)),
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCrop = useCallback(() => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    if (!ctx) return;

    // Set canvas size to crop area
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;

    // Draw cropped portion
    ctx.drawImage(
      img,
      cropArea.x, cropArea.y, cropArea.width, cropArea.height,
      0, 0, cropArea.width, cropArea.height
    );

    // Get cropped image as data URL
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCrop(croppedDataUrl);
  }, [cropArea, onCrop]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Crop Image</h3>
        
        <div className="relative mb-4">
          <div className="relative w-64 h-64 mx-auto border border-gray-300 overflow-hidden">
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Crop preview"
              className="w-full h-full object-cover"
              style={{ maxWidth: 'none', maxHeight: 'none' }}
            />
            
            {/* Crop overlay */}
            <div
              className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 cursor-move"
              style={{
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.width,
                height: cropArea.height,
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Crop & Save
          </button>
        </div>

        {/* Hidden canvas for cropping */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export const ServiceImageUploader: React.FC<ServiceImageUploaderProps> = ({
  serviceId,
  initialImageUrl,
  onImageUploaded,
  onError,
  disabled = false,
  maxFileSize = 2 * 1024 * 1024, // 2MB default
  acceptedFormats = ['image/jpeg', 'image/png', 'image/webp'],
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | undefined>(initialImageUrl);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [showCropModal, setShowCropModal] = useState(false);
  const [error, setError] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!acceptedFormats.includes(file.type)) {
      return `File type not supported. Please use: ${acceptedFormats.map(format => format.split('/')[1].toUpperCase()).join(', ')}`;
    }

    // Check file size
    if (file.size > maxFileSize) {
      const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
      return `File size too large. Maximum size is ${maxSizeMB}MB`;
    }

    return null;
  }, [acceptedFormats, maxFileSize]);

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setShowCropModal(true);
  }, [validateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [disabled, isUploading, handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setDragActive(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleUpload = useCallback(async (file: File, croppedDataUrl?: string) => {
    const startTime = Date.now();
    
    try {
      setIsUploading(true);
      setError('');

      const uploadData: ServiceImageUploadData = {
        file,
        service_id: serviceId,
        cropped_data_url: croppedDataUrl,
      };

      const response = await servicesService.uploadServiceImage(uploadData);
      
      const uploadTime = Date.now() - startTime;
      
      setUploadedImageUrl(response.image_url);
      setPreviewUrl(undefined);
      setShowCropModal(false);
      
      // Track successful upload
      onboardingStep3Observability.trackImageUploaded({
        service_id: serviceId,
        file_size: file.size,
        file_type: file.type,
        upload_duration: uploadTime,
      });
      
      onboardingStep3PerformanceTracking.trackImageUploadTime(uploadTime, file.size);
      
      onImageUploaded?.(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload image';
      const uploadTime = Date.now() - startTime;
      
      setError(errorMessage);
      
      // Track upload error
      onboardingStep3Observability.trackImageUploadError({
        service_id: serviceId,
        file_size: file.size,
        file_type: file.type,
        upload_duration: uploadTime,
        error_code: 'UPLOAD_FAILED',
        error_message: errorMessage,
      });
      
      onboardingStep3ErrorTracking.trackFileUploadError({
        file_type: file.type,
        file_size: file.size,
        error_type: 'upload_failed',
        message: errorMessage,
      });
      
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsUploading(false);
    }
  }, [serviceId, onImageUploaded, onError]);

  const handleCropComplete = useCallback((croppedDataUrl: string) => {
    if (previewUrl) {
      // Convert data URL back to file for upload
      fetch(croppedDataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
          handleUpload(file, croppedDataUrl);
        })
        .catch(error => {
          setError('Failed to process cropped image');
          onError?.(error);
        });
    }
  }, [previewUrl, handleUpload, onError]);

  const handleRemoveImage = useCallback(() => {
    setUploadedImageUrl(undefined);
    setPreviewUrl(undefined);
    setError('');
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleReplaceImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCancelCrop = useCallback(() => {
    setShowCropModal(false);
    setPreviewUrl(undefined);
    setError('');
  }, []);

  if (uploadedImageUrl) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Image
          </label>
          <ImagePreview
            imageUrl={uploadedImageUrl}
            onRemove={handleRemoveImage}
            onReplace={handleReplaceImage}
            disabled={disabled || isUploading}
          />
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled || isUploading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Service Image
        </label>
        
        {/* Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
            dragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300'
          } ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled || isUploading}
          />
          
          <div className="space-y-2">
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
            
            <div className="text-sm text-gray-600">
              <span className="font-medium text-blue-600 hover:text-blue-500">
                Click to upload
              </span>
              {' '}or drag and drop
            </div>
            
            <p className="text-xs text-gray-500">
              PNG, JPG, WEBP up to {Math.round(maxFileSize / (1024 * 1024))}MB
            </p>
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="mt-4">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">Uploading image...</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Crop Modal */}
      {showCropModal && previewUrl && (
        <CropModal
          imageUrl={previewUrl}
          onCrop={handleCropComplete}
          onCancel={handleCancelCrop}
        />
      )}
    </div>
  );
};
