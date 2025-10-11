/**
 * useLogoUpload Hook Tests
 * 
 * Comprehensive tests for the useLogoUpload hook including file validation,
 * processing, and state management.
 */

import { renderHook, act } from '@testing-library/react';
import { useLogoUpload } from '../useLogoUpload';
import * as imageProcessing from '../../utils/imageProcessing';

// ===== MOCK SETUP =====

// Mock the image processing utilities
jest.mock('../../utils/imageProcessing', () => ({
  validateImageFile: jest.fn(),
  processLogoUpload: jest.fn(),
}));

const mockImageProcessing = imageProcessing as jest.Mocked<typeof imageProcessing>;

// Mock File constructor
const createMockFile = (name: string, type: string, size: number): File => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
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

beforeEach(() => {
  jest.clearAllMocks();
});

// ===== TEST SUITE =====

describe('useLogoUpload', () => {
  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useLogoUpload());
      
      expect(result.current.state).toEqual({
        file: null,
        processedImage: null,
        validation: null,
        isProcessing: false,
        isUploading: false,
        error: null,
        previewUrl: null,
      });
    });
  });

  describe('handleFileSelect', () => {
    it('should process a valid file successfully', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024 * 1024);
      const mockValidation = {
        isValid: true,
        errors: [],
        warnings: [],
      };
      const mockProcessedImage = {
        dataUrl: 'data:image/png;base64,mock-data',
        blob: file,
        dimensions: { width: 800, height: 600 },
        fileSize: 1024 * 1024,
        format: 'image/png',
      };

      mockImageProcessing.validateImageFile.mockReturnValue(mockValidation);
      mockImageProcessing.processLogoUpload.mockResolvedValue(mockProcessedImage);

      const { result } = renderHook(() => useLogoUpload());

      await act(async () => {
        await result.current.actions.handleFileSelect(file);
      });

      expect(result.current.state.file).toBe(file);
      expect(result.current.state.processedImage).toEqual(mockProcessedImage);
      expect(result.current.state.validation).toEqual(mockValidation);
      expect(result.current.state.previewUrl).toBe(mockObjectURL);
      expect(result.current.state.isProcessing).toBe(false);
      expect(result.current.state.error).toBe(null);
    });

    it('should handle file validation errors', async () => {
      const file = createMockFile('logo.txt', 'text/plain', 1024);
      const mockValidation = {
        isValid: false,
        errors: ['Invalid file type'],
        warnings: [],
      };

      mockImageProcessing.validateImageFile.mockReturnValue(mockValidation);

      const { result } = renderHook(() => useLogoUpload());

      await act(async () => {
        await result.current.actions.handleFileSelect(file);
      });

      expect(result.current.state.validation).toEqual(mockValidation);
      expect(result.current.state.error).toBe('Invalid file type');
      expect(result.current.state.isProcessing).toBe(false);
      expect(result.current.state.processedImage).toBe(null);
    });

    it('should handle processing errors', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024 * 1024);
      const mockValidation = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      mockImageProcessing.validateImageFile.mockReturnValue(mockValidation);
      mockImageProcessing.processLogoUpload.mockRejectedValue(
        new Error('Processing failed')
      );

      const { result } = renderHook(() => useLogoUpload());

      await act(async () => {
        await result.current.actions.handleFileSelect(file);
      });

      expect(result.current.state.error).toBe('Processing failed');
      expect(result.current.state.isProcessing).toBe(false);
      expect(result.current.state.processedImage).toBe(null);
    });

    it('should handle unknown processing errors', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024 * 1024);
      const mockValidation = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      mockImageProcessing.validateImageFile.mockReturnValue(mockValidation);
      mockImageProcessing.processLogoUpload.mockRejectedValue('Unknown error');

      const { result } = renderHook(() => useLogoUpload());

      await act(async () => {
        await result.current.actions.handleFileSelect(file);
      });

      expect(result.current.state.error).toBe('Failed to process image');
      expect(result.current.state.isProcessing).toBe(false);
    });
  });

  describe('handleFileDrop', () => {
    it('should handle file drop with valid file', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024 * 1024);
      const fileList = {
        0: file,
        length: 1,
        item: (index: number) => (index === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as FileList;

      const mockValidation = {
        isValid: true,
        errors: [],
        warnings: [],
      };
      const mockProcessedImage = {
        dataUrl: 'data:image/png;base64,mock-data',
        blob: file,
        dimensions: { width: 800, height: 600 },
        fileSize: 1024 * 1024,
        format: 'image/png',
      };

      mockImageProcessing.validateImageFile.mockReturnValue(mockValidation);
      mockImageProcessing.processLogoUpload.mockResolvedValue(mockProcessedImage);

      const { result } = renderHook(() => useLogoUpload());

      await act(async () => {
        await result.current.actions.handleFileDrop(fileList);
      });

      expect(result.current.state.file).toBe(file);
      expect(result.current.state.processedImage).toEqual(mockProcessedImage);
    });

    it('should handle empty file list', async () => {
      const fileList = {
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {
          // Empty iterator
        },
      } as FileList;

      const { result } = renderHook(() => useLogoUpload());

      await act(async () => {
        await result.current.actions.handleFileDrop(fileList);
      });

      expect(result.current.state.file).toBe(null);
      expect(result.current.state.processedImage).toBe(null);
    });
  });

  describe('clearLogo', () => {
    it('should clear logo and clean up preview URL', () => {
      const { result } = renderHook(() => useLogoUpload());

      // Set up initial state with preview URL
      act(() => {
        result.current.state.previewUrl = mockObjectURL;
      });

      act(() => {
        result.current.actions.clearLogo();
      });

      expect(result.current.state.file).toBe(null);
      expect(result.current.state.processedImage).toBe(null);
      expect(result.current.state.previewUrl).toBe(null);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockObjectURL);
    });
  });

  describe('retryUpload', () => {
    it('should retry upload with existing file', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024 * 1024);
      const mockValidation = {
        isValid: true,
        errors: [],
        warnings: [],
      };
      const mockProcessedImage = {
        dataUrl: 'data:image/png;base64,mock-data',
        blob: file,
        dimensions: { width: 800, height: 600 },
        fileSize: 1024 * 1024,
        format: 'image/png',
      };

      mockImageProcessing.validateImageFile.mockReturnValue(mockValidation);
      mockImageProcessing.processLogoUpload.mockResolvedValue(mockProcessedImage);

      const { result } = renderHook(() => useLogoUpload());

      // Set up initial state with file
      act(() => {
        result.current.state.file = file;
      });

      await act(async () => {
        await result.current.actions.retryUpload();
      });

      expect(mockImageProcessing.processLogoUpload).toHaveBeenCalledWith(file);
      expect(result.current.state.processedImage).toEqual(mockProcessedImage);
    });

    it('should not retry if no file exists', async () => {
      const { result } = renderHook(() => useLogoUpload());

      await act(async () => {
        await result.current.actions.retryUpload();
      });

      expect(mockImageProcessing.processLogoUpload).not.toHaveBeenCalled();
    });
  });
});
