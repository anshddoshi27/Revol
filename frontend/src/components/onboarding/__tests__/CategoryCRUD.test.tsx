/**
 * CategoryCRUD Component Tests
 * 
 * Unit tests for the CategoryCRUD component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CategoryCRUD } from '../CategoryCRUD';
import type { CategoryData } from '../../../api/types/services';

// Mock the hooks
jest.mock('../../../hooks/useCategoryManagement', () => ({
  useCategoryManagement: jest.fn(() => ({
    categories: [],
    isSubmitting: false,
    errors: {},
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    getNextAvailableColor: jest.fn(() => '#3B82F6'),
    availableColors: ['#3B82F6', '#10B981', '#F59E0B'],
  })),
}));

describe('CategoryCRUD', () => {
  const mockOnCategoriesChange = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component with header and add button', () => {
    render(
      <CategoryCRUD
        onCategoriesChange={mockOnCategoriesChange}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Service Categories')).toBeInTheDocument();
    expect(screen.getAllByText('Add Category')).toHaveLength(2); // Header button and empty state button
    expect(screen.getByText(/Organize your services into categories/)).toBeInTheDocument();
  });

  it('shows empty state when no categories exist', () => {
    render(
      <CategoryCRUD
        onCategoriesChange={mockOnCategoriesChange}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('No categories yet')).toBeInTheDocument();
    expect(screen.getByText(/Get started by creating your first service category/)).toBeInTheDocument();
  });

  it('displays existing categories', () => {
    const mockCategories: CategoryData[] = [
      {
        id: '1',
        name: 'Hair Services',
        description: 'All hair-related services',
        color: '#3B82F6',
        sort_order: 0,
      },
      {
        id: '2',
        name: 'Massage',
        description: 'Relaxation and therapeutic massage',
        color: '#10B981',
        sort_order: 1,
      },
    ];

    const { useCategoryManagement } = require('../../../hooks/useCategoryManagement');
    useCategoryManagement.mockReturnValue({
      categories: mockCategories,
      isSubmitting: false,
      errors: {},
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      getNextAvailableColor: jest.fn(() => '#3B82F6'),
      availableColors: ['#3B82F6', '#10B981', '#F59E0B'],
    });

    render(
      <CategoryCRUD
        initialCategories={mockCategories}
        onCategoriesChange={mockOnCategoriesChange}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Hair Services')).toBeInTheDocument();
    expect(screen.getByText('All hair-related services')).toBeInTheDocument();
    expect(screen.getByText('Massage')).toBeInTheDocument();
    expect(screen.getByText('Relaxation and therapeutic massage')).toBeInTheDocument();
  });

  it('opens form when add category button is clicked', () => {
    render(
      <CategoryCRUD
        onCategoriesChange={mockOnCategoriesChange}
        onError={mockOnError}
      />
    );

    const addButtons = screen.getAllByText('Add Category');
    fireEvent.click(addButtons[0]); // Click the first "Add Category" button (header button)

    expect(screen.getByText('Add New Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Category Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('validates required fields in the form', async () => {
    // Mock empty categories to ensure we get the empty state
    const { useCategoryManagement } = require('../../../hooks/useCategoryManagement');
    useCategoryManagement.mockReturnValue({
      categories: [],
      isSubmitting: false,
      errors: {},
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      getNextAvailableColor: jest.fn(() => '#3B82F6'),
      availableColors: ['#3B82F6', '#10B981', '#F59E0B'],
    });

    render(
      <CategoryCRUD
        onCategoriesChange={mockOnCategoriesChange}
        onError={mockOnError}
      />
    );

    // Open form
    const addButtons = screen.getAllByText('Add Category');
    fireEvent.click(addButtons[0]); // Click the first "Add Category" button (header button)

    // Try to submit without filling required fields
    const nameInput = screen.getByLabelText('Category Name *');
    fireEvent.submit(nameInput.closest('form')!);

    // The validation should happen immediately since it's synchronous
    expect(screen.getByText('Category name is required')).toBeInTheDocument();
  });

  it('calls createCategory when form is submitted with valid data', async () => {
    const mockCreateCategory = jest.fn();
    const { useCategoryManagement } = require('../../../hooks/useCategoryManagement');
    useCategoryManagement.mockReturnValue({
      categories: [],
      isSubmitting: false,
      errors: {},
      createCategory: mockCreateCategory,
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      getNextAvailableColor: jest.fn(() => '#3B82F6'),
      availableColors: ['#3B82F6', '#10B981', '#F59E0B'],
    });

    render(
      <CategoryCRUD
        onCategoriesChange={mockOnCategoriesChange}
        onError={mockOnError}
      />
    );

    // Open form
    const addButtons = screen.getAllByText('Add Category');
    fireEvent.click(addButtons[0]); // Click the first "Add Category" button (header button)

    // Fill form
    fireEvent.change(screen.getByLabelText('Category Name *'), {
      target: { value: 'Test Category' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Test description' },
    });

    // Submit form
    const saveButtons = screen.getAllByText('Add Category');
    const saveButton = saveButtons.find(button => button.getAttribute('type') === 'submit');
    if (saveButton) {
      fireEvent.click(saveButton);
    }

    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith({
        name: 'Test Category',
        description: 'Test description',
        color: '#3B82F6',
        sort_order: 0,
      });
    });
  });

  it('disables form when disabled prop is true', () => {
    render(
      <CategoryCRUD
        onCategoriesChange={mockOnCategoriesChange}
        onError={mockOnError}
        disabled={true}
      />
    );

    const addButtons = screen.getAllByText('Add Category');
    expect(addButtons[0]).toBeDisabled(); // Check the header button
    expect(addButtons[1]).toBeDisabled(); // Check the empty state button
  });

  it('shows error messages when errors are present', () => {
    const { useCategoryManagement } = require('../../../hooks/useCategoryManagement');
    useCategoryManagement.mockReturnValue({
      categories: [],
      isSubmitting: false,
      errors: { create: 'Failed to create category' },
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      getNextAvailableColor: jest.fn(() => '#3B82F6'),
      availableColors: ['#3B82F6', '#10B981', '#F59E0B'],
    });

    render(
      <CategoryCRUD
        onCategoriesChange={mockOnCategoriesChange}
        onError={mockOnError}
      />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to create category')).toBeInTheDocument();
  });

  it('handles category deletion', async () => {
    const mockDeleteCategory = jest.fn();
    const mockCategories: CategoryData[] = [
      {
        id: '1',
        name: 'Test Category',
        description: 'Test description',
        color: '#3B82F6',
        sort_order: 0,
      },
    ];

    const { useCategoryManagement } = require('../../../hooks/useCategoryManagement');
    useCategoryManagement.mockReturnValue({
      categories: mockCategories,
      isSubmitting: false,
      errors: {},
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: mockDeleteCategory,
      getNextAvailableColor: jest.fn(() => '#3B82F6'),
      availableColors: ['#3B82F6', '#10B981', '#F59E0B'],
    });

    render(
      <CategoryCRUD
        initialCategories={mockCategories}
        onCategoriesChange={mockOnCategoriesChange}
        onError={mockOnError}
      />
    );

    // Find and click delete button
    const deleteButton = screen.getByLabelText('Delete category Test Category');
    fireEvent.click(deleteButton);

    // Click confirm
    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteCategory).toHaveBeenCalledWith('1');
    });
  });
});
