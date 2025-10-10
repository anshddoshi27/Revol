/**
 * Image Processing Utilities
 * 
 * Utilities for handling logo upload, cropping, and processing for onboarding Step 2.
 * Provides image validation, resizing, and format conversion capabilities.
 */

// ===== TYPES =====

export interface ImageConstraints {
  maxSizeBytes: number;
  allowedTypes: string[];
  recommendedDimensions: {
    width: number;
    height: number;
  };
  minDimensions: {
    width: number;
    height: number;
  };
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessedImage {
  dataUrl: string;
  blob: Blob;
  dimensions: {
    width: number;
    height: number;
  };
  fileSize: number;
  format: string;
}

export interface ImageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ===== CONSTANTS =====

export const LOGO_CONSTRAINTS: ImageConstraints = {
  maxSizeBytes: 2 * 1024 * 1024, // 2MB
  allowedTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
  recommendedDimensions: {
    width: 640,
    height: 560,
  },
  minDimensions: {
    width: 256,
    height: 256,
  },
};

// ===== VALIDATION FUNCTIONS =====

/**
 * Validates an uploaded image file against constraints
 */
export const validateImageFile = (file: File): ImageValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file type
  if (!LOGO_CONSTRAINTS.allowedTypes.includes(file.type)) {
    errors.push(
      `Invalid file type. Allowed types: ${LOGO_CONSTRAINTS.allowedTypes.join(', ')}`
    );
  }

  // Check file size
  if (file.size > LOGO_CONSTRAINTS.maxSizeBytes) {
    errors.push(
      `File size too large. Maximum size: ${Math.round(LOGO_CONSTRAINTS.maxSizeBytes / 1024 / 1024)}MB`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validates image dimensions after loading
 */
export const validateImageDimensions = (
  width: number,
  height: number
): ImageValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check minimum dimensions
  if (width < LOGO_CONSTRAINTS.minDimensions.width || 
      height < LOGO_CONSTRAINTS.minDimensions.height) {
    errors.push(
      `Image too small. Minimum dimensions: ${LOGO_CONSTRAINTS.minDimensions.width}x${LOGO_CONSTRAINTS.minDimensions.height}px`
    );
  }

  // Check aspect ratio (warn if very different from recommended)
  const recommendedRatio = LOGO_CONSTRAINTS.recommendedDimensions.width / LOGO_CONSTRAINTS.recommendedDimensions.height;
  const actualRatio = width / height;
  const ratioDifference = Math.abs(actualRatio - recommendedRatio);

  if (ratioDifference > 0.5) {
    warnings.push(
      `Image aspect ratio differs significantly from recommended ${LOGO_CONSTRAINTS.recommendedDimensions.width}x${LOGO_CONSTRAINTS.recommendedDimensions.height}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

// ===== IMAGE PROCESSING FUNCTIONS =====

/**
 * Loads an image file and returns dimensions
 */
export const loadImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

/**
 * Converts a file to data URL
 */
export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      resolve(reader.result as string);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
};

/**
 * Crops an image based on the specified crop area
 */
export const cropImage = (
  imageDataUrl: string,
  cropArea: CropArea,
  outputFormat: string = 'image/png',
  outputQuality: number = 0.9
): Promise<ProcessedImage> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Set canvas dimensions to crop area
        canvas.width = cropArea.width;
        canvas.height = cropArea.height;

        // Draw the cropped portion
        ctx.drawImage(
          img,
          cropArea.x,
          cropArea.y,
          cropArea.width,
          cropArea.height,
          0,
          0,
          cropArea.width,
          cropArea.height
        );

        // Convert to blob and data URL
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            const dataUrl = canvas.toDataURL(outputFormat, outputQuality);
            
            resolve({
              dataUrl,
              blob,
              dimensions: {
                width: cropArea.width,
                height: cropArea.height,
              },
              fileSize: blob.size,
              format: outputFormat,
            });
          },
          outputFormat,
          outputQuality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for cropping'));
    };

    img.src = imageDataUrl;
  });
};

/**
 * Resizes an image to fit within specified dimensions while maintaining aspect ratio
 */
export const resizeImage = (
  imageDataUrl: string,
  maxWidth: number,
  maxHeight: number,
  outputFormat: string = 'image/png',
  outputQuality: number = 0.9
): Promise<ProcessedImage> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          
          if (width > height) {
            width = Math.min(width, maxWidth);
            height = width / aspectRatio;
          } else {
            height = Math.min(height, maxHeight);
            width = height * aspectRatio;
          }
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw the resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob and data URL
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            const dataUrl = canvas.toDataURL(outputFormat, outputQuality);
            
            resolve({
              dataUrl,
              blob,
              dimensions: { width, height },
              fileSize: blob.size,
              format: outputFormat,
            });
          },
          outputFormat,
          outputQuality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = imageDataUrl;
  });
};

/**
 * Generates multiple sizes of an image for different use cases
 */
export const generateImageSizes = async (
  imageDataUrl: string,
  sizes: Array<{ name: string; width: number; height: number }>
): Promise<Record<string, ProcessedImage>> => {
  const results: Record<string, ProcessedImage> = {};

  for (const size of sizes) {
    try {
      const processed = await resizeImage(
        imageDataUrl,
        size.width,
        size.height,
        'image/png',
        0.9
      );
      results[size.name] = processed;
    } catch (error) {
      console.error(`Failed to generate ${size.name} size:`, error);
      throw error;
    }
  }

  return results;
};

/**
 * Creates a square crop area from the center of an image
 */
export const createCenterCropArea = (
  imageWidth: number,
  imageHeight: number,
  cropSize: number
): CropArea => {
  const size = Math.min(imageWidth, imageHeight, cropSize);
  
  return {
    x: Math.max(0, (imageWidth - size) / 2),
    y: Math.max(0, (imageHeight - size) / 2),
    width: size,
    height: size,
  };
};

/**
 * Validates and processes an uploaded logo file
 */
export const processLogoUpload = async (file: File): Promise<ProcessedImage> => {
  // Validate file
  const fileValidation = validateImageFile(file);
  if (!fileValidation.isValid) {
    throw new Error(fileValidation.errors.join(', '));
  }

  // Load and validate dimensions
  const dimensions = await loadImageDimensions(file);
  const dimensionValidation = validateImageDimensions(dimensions.width, dimensions.height);
  if (!dimensionValidation.isValid) {
    throw new Error(dimensionValidation.errors.join(', '));
  }

  // Convert to data URL
  const dataUrl = await fileToDataUrl(file);

  // If image is too large, resize it
  const maxDimension = 1024;
  if (dimensions.width > maxDimension || dimensions.height > maxDimension) {
    return await resizeImage(dataUrl, maxDimension, maxDimension);
  }

  // Return original if within limits
  return {
    dataUrl,
    blob: file,
    dimensions,
    fileSize: file.size,
    format: file.type,
  };
};
