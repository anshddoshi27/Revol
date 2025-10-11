/**
 * LogoUploader Component Tests
 * 
 * Comprehensive tests for the LogoUploader component including drag & drop,
 * file validation, and error handling.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogoUploader } from '../LogoUploader';
import * as imageProcessing from '../../../utils/imageProcessing';

// ===== MOCK SETUP =====

// Mock the image processing utilities
jest.mock('../../../utils/imageProcessing', () => ({
  validateImageFile: jest.fn(),
  processLogoUpload: jest.fn(),
}));

const mockImageProcessing = imageProcessing as jest.Mocked<typeof imageProcessing>;

// Mock react-dropzone
jest.mock('react-dropzone', () => ({
  useDropzone: jest.fn(() => ({
    getRootProps: jest.fn(() => ({})),
    getInputProps: jest.fn(() => ({})),
    isDragActive: false,
    isDragReject: false,
  })),
}));

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

describe('LogoUploader', () => {
  const defaultProps = {
    onLogoChange: jest.fn(),
    onError: jest.fn(),
  };

  describe('rendering', () => {
    it('should render upload area initially', () => {
      render(<LogoUploader {...defaultProps} />);
      
      expect(screen.getByText('Upload your logo')).toBeInTheDocument();
      expect(screen.getByText('Drag & drop your logo here, or click to browse')).toBeInTheDocument();
      expect(screen.getByText('Choose File')).toBeInTheDocument();
    });

    it('should show file requirements', () => {
      render(<LogoUploader {...defaultProps} />);
      
      expect(screen.getByText('Supported formats: PNG, JPG, SVG')).toBeInTheDocument();
      expect(screen.getByText('Maximum file size: 2MB')).toBeInTheDocument();
      expect(screen.getByText('Recommended size: 640×560px or larger')).toBeInTheDocument();
    });
  });

  describe('file selection', () => {
    it('should handle file input change', async () => {
      const user = userEvent.setup();
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

      render(<LogoUploader {...defaultProps} />);
      
      const fileInput = screen.getByRole('button', { name: /choose file/i });
      await user.click(fileInput);

      // Simulate file selection
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(defaultProps.onLogoChange).toHaveBeenCalledWith(mockProcessedImage);
      });
    });

    it('should handle file validation errors', async () => {
      const file = createMockFile('logo.txt', 'text/plain', 1024);
      const mockValidation = {
        isValid: false,
        errors: ['Invalid file type'],
        warnings: [],
      };

      mockImageProcessing.validateImageFile.mockReturnValue(mockValidation);

      render(<LogoUploader {...defaultProps} />);
      
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Invalid file type')).toBeInTheDocument();
        expect(defaultProps.onError).toHaveBeenCalledWith('Invalid file type');
      });
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

      render(<LogoUploader {...defaultProps} />);
      
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith('Processing failed');
      });
    });
  });

  describe('drag and drop', () => {
    it('should show drag active state', () => {
      const { useDropzone } = require('react-dropzone');
      useDropzone.mockReturnValue({
        getRootProps: jest.fn(() => ({})),
        getInputProps: jest.fn(() => ({})),
        isDragActive: true,
        isDragReject: false,
      });

      render(<LogoUploader {...defaultProps} />);
      
      expect(screen.getByText('Drop your logo here...')).toBeInTheDocument();
    });

    it('should show drag reject state', () => {
      const { useDropzone } = require('react-dropzone');
      useDropzone.mockReturnValue({
        getRootProps: jest.fn(() => ({})),
        getInputProps: jest.fn(() => ({})),
        isDragActive: false,
        isDragReject: true,
      });

      render(<LogoUploader {...defaultProps} />);
      
      expect(screen.getByText('Invalid file type')).toBeInTheDocument();
      expect(screen.getByText('Please upload a PNG, JPG, or SVG file')).toBeInTheDocument();
    });
  });

  describe('logo preview', () => {
    it('should show logo preview when uploaded', async () => {
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

      render(<LogoUploader {...defaultProps} />);
      
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByAltText('Logo preview')).toBeInTheDocument();
        expect(screen.getByText('Logo uploaded successfully!')).toBeInTheDocument();
      });
    });

    it('should allow logo removal', async () => {
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

      render(<LogoUploader {...defaultProps} />);
      
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByAltText('Logo preview')).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText('Remove logo');
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText('Upload your logo')).toBeInTheDocument();
        expect(defaultProps.onLogoChange).toHaveBeenCalledWith(null);
      });
    });
  });

  describe('processing state', () => {
    it('should show processing state', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024 * 1024);
      const mockValidation = {
        isValid: true,
        errors: [],
        warnings: [],
      };

      mockImageProcessing.validateImageFile.mockReturnValue(mockValidation);
      mockImageProcessing.processLogoUpload.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<LogoUploader {...defaultProps} />);
      
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByText('Processing your logo...')).toBeInTheDocument();
    });
  });

  describe('warnings', () => {
    it('should show validation warnings', async () => {
      const file = createMockFile('logo.png', 'image/png', 1024 * 1024);
      const mockValidation = {
        isValid: true,
        errors: [],
        warnings: ['Image aspect ratio differs significantly from recommended'],
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

      render(<LogoUploader {...defaultProps} />);
      
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Image aspect ratio differs significantly from recommended')).toBeInTheDocument();
      });
    });
  });
});
