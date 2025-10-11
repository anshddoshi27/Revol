/**
 * Image Processing Utilities Tests
 * 
 * Comprehensive tests for image processing utilities including validation,
 * cropping, resizing, and format conversion.
 */

import {
  validateImageFile,
  validateImageDimensions,
  loadImageDimensions,
  fileToDataUrl,
  cropImage,
  resizeImage,
  generateImageSizes,
  createCenterCropArea,
  processLogoUpload,
  LOGO_CONSTRAINTS,
  type ImageValidationResult,
  type CropArea,
  type ProcessedImage,
} from '../imageProcessing';

// ===== MOCK SETUP =====

// Mock File constructor
const createMockFile = (name: string, type: string, size: number): File => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Mock Image constructor
const mockImage = {
  naturalWidth: 800,
  naturalHeight: 600,
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
  src: '',
};

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockObjectURL = 'mock-object-url';
const mockRevokeObjectURL = jest.fn();

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: jest.fn(() => mockObjectURL),
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

// Mock FileReader
const mockFileReader = {
  result: 'data:image/png;base64,mock-data',
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
  readAsDataURL: jest.fn(),
};

Object.defineProperty(global, 'FileReader', {
  value: jest.fn(() => mockFileReader),
  writable: true,
});

// Mock HTMLCanvasElement
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: jest.fn(() => ({
    drawImage: jest.fn(),
  })),
  toBlob: jest.fn(),
  toDataURL: jest.fn(() => 'data:image/png;base64,mock-data'),
};

Object.defineProperty(global, 'HTMLCanvasElement', {
  value: jest.fn(() => mockCanvas),
  writable: true,
});

// Mock Image constructor
Object.defineProperty(global, 'Image', {
  value: jest.fn(() => mockImage),
  writable: true,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockImage.onload = null;
  mockImage.onerror = null;
  mockFileReader.onload = null;
  mockFileReader.onerror = null;
});

// ===== TEST SUITE =====

describe('Image Processing Utilities', () => {
  describe('validateImageFile', () => {
    it('should validate a valid PNG file', () => {
      const file = createMockFile('logo.png', 'image/png', 1024 * 1024); // 1MB
      const result = validateImageFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid file type', () => {
      const file = createMockFile('logo.txt', 'text/plain', 1024);
      const result = validateImageFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid file type');
    });

    it('should reject file that is too large', () => {
      const file = createMockFile('logo.png', 'image/png', 3 * 1024 * 1024); // 3MB
      const result = validateImageFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('File size too large');
    });

    it('should accept valid JPEG file', () => {
      const file = createMockFile('logo.jpg', 'image/jpeg', 1024 * 1024);
      const result = validateImageFile(file);
      
      expect(result.isValid).toBe(true);
    });

    it('should accept valid SVG file', () => {
      const file = createMockFile('logo.svg', 'image/svg+xml', 1024);
      const result = validateImageFile(file);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateImageDimensions', () => {
    it('should validate dimensions that meet minimum requirements', () => {
      const result = validateImageDimensions(800, 600);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject dimensions that are too small', () => {
      const result = validateImageDimensions(200, 200);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Image too small');
    });

    it('should warn about aspect ratio differences', () => {
      const result = validateImageDimensions(1000, 300); // Wide but meets minimum height
      
      expect(result.isValid).toBe(true);
      expect(result.warnings[0]).toContain('aspect ratio differs');
    });
  });

  describe('loadImageDimensions', () => {
    it('should load image dimensions successfully', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024);
      
      // Simulate successful image load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);

      const dimensions = await loadImageDimensions(file);
      
      expect(dimensions).toEqual({
        width: 800,
        height: 600,
      });
    });

    it('should reject on image load error', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024);
      
      // Simulate image load error
      setTimeout(() => {
        if (mockImage.onerror) {
          mockImage.onerror();
        }
      }, 0);

      await expect(loadImageDimensions(file)).rejects.toThrow('Failed to load image');
    });
  });

  describe('fileToDataUrl', () => {
    it('should convert file to data URL successfully', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024);
      
      // Simulate successful file read
      setTimeout(() => {
        if (mockFileReader.onload) {
          mockFileReader.onload();
        }
      }, 0);

      const dataUrl = await fileToDataUrl(file);
      
      expect(dataUrl).toBe('data:image/png;base64,mock-data');
      expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(file);
    });

    it('should reject on file read error', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024);
      
      // Simulate file read error
      setTimeout(() => {
        if (mockFileReader.onerror) {
          mockFileReader.onerror();
        }
      }, 0);

      await expect(fileToDataUrl(file)).rejects.toThrow('Failed to read file');
    });
  });

  describe('createCenterCropArea', () => {
    it('should create center crop area for square image', () => {
      const cropArea = createCenterCropArea(800, 800, 400);
      
      expect(cropArea).toEqual({
        x: 200,
        y: 200,
        width: 400,
        height: 400,
      });
    });

    it('should create center crop area for rectangular image', () => {
      const cropArea = createCenterCropArea(800, 600, 400);
      
      expect(cropArea).toEqual({
        x: 200,
        y: 100,
        width: 400,
        height: 400,
      });
    });

    it('should handle crop size larger than image', () => {
      const cropArea = createCenterCropArea(300, 300, 400);
      
      expect(cropArea).toEqual({
        x: 0,
        y: 0,
        width: 300,
        height: 300,
      });
    });
  });

  describe('processLogoUpload', () => {
    it('should process a valid logo upload', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024 * 1024);
      
      // Mock successful image load
      setTimeout(() => {
        if (mockImage.onload) {
          mockImage.onload();
        }
      }, 0);

      // Mock successful file read
      setTimeout(() => {
        if (mockFileReader.onload) {
          mockFileReader.onload();
        }
      }, 10);

      const result = await processLogoUpload(file);
      
      expect(result).toMatchObject({
        dataUrl: 'data:image/png;base64,mock-data',
        dimensions: { width: 800, height: 600 },
        fileSize: 1024 * 1024,
        format: 'image/png',
      });
    });

    it('should reject invalid file type', async () => {
      const file = createMockFile('logo.txt', 'text/plain', 1024);
      
      await expect(processLogoUpload(file)).rejects.toThrow('Invalid file type');
    });

    it('should reject file that is too large', async () => {
      const file = createMockFile('logo.png', 'image/png', 3 * 1024 * 1024);
      
      await expect(processLogoUpload(file)).rejects.toThrow('File size too large');
    });
  });

  describe('LOGO_CONSTRAINTS', () => {
    it('should have correct constraint values', () => {
      expect(LOGO_CONSTRAINTS.maxSizeBytes).toBe(2 * 1024 * 1024);
      expect(LOGO_CONSTRAINTS.allowedTypes).toEqual([
        'image/png',
        'image/jpeg',
        'image/svg+xml',
      ]);
      expect(LOGO_CONSTRAINTS.recommendedDimensions).toEqual({
        width: 640,
        height: 560,
      });
      expect(LOGO_CONSTRAINTS.minDimensions).toEqual({
        width: 256,
        height: 256,
      });
    });
  });
});
