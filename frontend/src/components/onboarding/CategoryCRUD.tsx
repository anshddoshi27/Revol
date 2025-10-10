/**
 * CategoryCRUD Component
 * 
 * Component for managing service categories with full CRUD operations.
 * Provides category creation, editing, deletion, and color assignment.
 */

import React, { useState, useCallback } from 'react';
import { useCategoryManagement } from '../../hooks/useCategoryManagement';
import type { CategoryData, CategoryFormData, CategoryColor } from '../../api/types/services';
import { CATEGORY_COLORS } from '../../api/types/services';

interface CategoryCRUDProps {
  initialCategories?: CategoryData[];
  onCategoriesChange?: (categories: CategoryData[]) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

interface CategoryFormProps {
  category?: CategoryData;
  onSave: (data: CategoryFormData) => void;
  onCancel: () => void;
  availableColors: CategoryColor[];
  isSubmitting?: boolean;
  errors?: Record<string, string>;
}

const CategoryForm: React.FC<CategoryFormProps> = ({
  category,
  onSave,
  onCancel,
  availableColors,
  isSubmitting = false,
  errors = {},
}) => {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: category?.name || '',
    description: category?.description || '',
    color: category?.color || availableColors[0],
    sort_order: category?.sort_order || 0,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleInputChange = useCallback((field: keyof CategoryFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [validationErrors]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Category name must be at least 2 characters long';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Category name cannot exceed 100 characters';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Category description cannot exceed 500 characters';
    }

    setValidationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSave(formData);
    }
  }, [formData, validateForm, onSave]);

  const allErrors = { ...errors, ...validationErrors };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          {category ? 'Edit Category' : 'Add New Category'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
          disabled={isSubmitting}
        >
          <span className="sr-only">Close</span>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Category Name */}
      <div>
        <label htmlFor="category-name" className="block text-sm font-medium text-gray-700">
          Category Name *
        </label>
        <input
          id="category-name"
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            allErrors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
          }`}
          placeholder="e.g., Hair Services, Massage, Facials"
          required
          disabled={isSubmitting}
          aria-describedby={allErrors.name ? 'category-name-error' : undefined}
        />
        {allErrors.name && (
          <p id="category-name-error" className="mt-1 text-sm text-red-600" role="alert">
            {allErrors.name}
          </p>
        )}
      </div>

      {/* Category Description */}
      <div>
        <label htmlFor="category-description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="category-description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          rows={3}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            allErrors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
          }`}
          placeholder="Optional description for this category"
          disabled={isSubmitting}
          aria-describedby={allErrors.description ? 'category-description-error' : undefined}
        />
        {allErrors.description && (
          <p id="category-description-error" className="mt-1 text-sm text-red-600" role="alert">
            {allErrors.description}
          </p>
        )}
      </div>

      {/* Category Color */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Category Color
        </label>
        <div className="flex flex-wrap gap-2">
          {availableColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleInputChange('color', color)}
              className={`w-8 h-8 rounded-full border-2 ${
                formData.color === color ? 'border-gray-900' : 'border-gray-300'
              } hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
              style={{ backgroundColor: color }}
              disabled={isSubmitting}
              aria-label={`Select color ${color}`}
            >
              {formData.color === color && (
                <svg className="w-4 h-4 text-white mx-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Choose a color to help organize your services
        </p>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : (category ? 'Update Category' : 'Add Category')}
        </button>
      </div>
    </form>
  );
};

const CategoryCard: React.FC<{
  category: CategoryData;
  onEdit: (category: CategoryData) => void;
  onDelete: (categoryId: string) => void;
  disabled?: boolean;
}> = ({ category, onEdit, onDelete, disabled = false }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = useCallback(() => {
    if (category.id) {
      onDelete(category.id);
      setShowDeleteConfirm(false);
    }
  }, [category.id, onDelete]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: category.color }}
            aria-label={`Category color: ${category.color}`}
          />
          <div>
            <h3 className="text-sm font-medium text-gray-900">{category.name}</h3>
            {category.description && (
              <p className="text-sm text-gray-500 mt-1">{category.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(category)}
            className="text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            disabled={disabled}
            aria-label={`Edit category ${category.name}`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
              disabled={disabled}
              aria-label={`Delete category ${category.name}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center space-x-1">
              <button
                onClick={handleDelete}
                className="text-red-600 hover:text-red-800 text-xs font-medium"
                disabled={disabled}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-gray-500 hover:text-gray-700 text-xs font-medium"
                disabled={disabled}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const CategoryCRUD: React.FC<CategoryCRUDProps> = ({
  initialCategories = [],
  onCategoriesChange,
  onError,
  disabled = false,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryData | undefined>();

  const {
    categories,
    isSubmitting,
    errors,
    createCategory,
    updateCategory,
    deleteCategory,
    getNextAvailableColor,
    availableColors,
  } = useCategoryManagement({
    initialCategories,
    onCategoryCreated: (category) => {
      setShowForm(false);
      setEditingCategory(undefined);
      onCategoriesChange?.(categories);
    },
    onCategoryUpdated: (category) => {
      setShowForm(false);
      setEditingCategory(undefined);
      onCategoriesChange?.(categories);
    },
    onCategoryDeleted: (categoryId) => {
      onCategoriesChange?.(categories);
    },
    onError,
  });

  const handleAddCategory = useCallback(() => {
    setEditingCategory(undefined);
    setShowForm(true);
  }, []);

  const handleEditCategory = useCallback((category: CategoryData) => {
    setEditingCategory(category);
    setShowForm(true);
  }, []);

  const handleSaveCategory = useCallback(async (formData: CategoryFormData) => {
    if (editingCategory) {
      await updateCategory(editingCategory.id!, formData);
    } else {
      await createCategory(formData);
    }
  }, [editingCategory, createCategory, updateCategory]);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingCategory(undefined);
  }, []);

  const handleDeleteCategory = useCallback(async (categoryId: string) => {
    await deleteCategory(categoryId);
  }, [deleteCategory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Service Categories</h2>
          <p className="text-sm text-gray-500 mt-1">
            Organize your services into categories to help customers find what they need
          </p>
        </div>
        <button
          onClick={handleAddCategory}
          disabled={disabled || isSubmitting}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Category
        </button>
      </div>

      {/* Category Form */}
      {showForm && (
        <CategoryForm
          category={editingCategory}
          onSave={handleSaveCategory}
          onCancel={handleCancelForm}
          availableColors={availableColors}
          isSubmitting={isSubmitting}
          errors={errors}
        />
      )}

      {/* Categories List */}
      <div className="space-y-3">
        {categories.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No categories yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first service category.
            </p>
            <div className="mt-6">
              <button
                onClick={handleAddCategory}
                disabled={disabled || isSubmitting}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Category
              </button>
            </div>
          </div>
        ) : (
          categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={handleEditCategory}
              onDelete={handleDeleteCategory}
              disabled={disabled || isSubmitting}
            />
          ))
        )}
      </div>

      {/* Error Display */}
      {Object.keys(errors).length > 0 && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                {Object.entries(errors).map(([field, message]) => (
                  <p key={field}>{message}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
