/**
 * useCategoryManagement Hook
 * 
 * Custom hook for managing category state and operations.
 * Handles category CRUD operations, validation, and form state management.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { categoriesService } from '../api/services/services';
import type {
  CategoryData,
  CategoryFormData,
  CategoryValidationError,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CategoryColor,
} from '../api/types/services';

interface UseCategoryManagementOptions {
  initialCategories?: CategoryData[];
  onCategoryCreated?: (category: CategoryData) => void;
  onCategoryUpdated?: (category: CategoryData) => void;
  onCategoryDeleted?: (categoryId: string) => void;
  onError?: (error: Error) => void;
}

interface UseCategoryManagementReturn {
  // State
  categories: CategoryData[];
  isLoading: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
  validationErrors: CategoryValidationError[];

  // Category operations
  createCategory: (categoryData: CategoryFormData) => Promise<CategoryData | null>;
  updateCategory: (categoryId: string, categoryData: CategoryFormData) => Promise<CategoryData | null>;
  deleteCategory: (categoryId: string) => Promise<boolean>;
  getCategory: (categoryId: string) => CategoryData | undefined;

  // Form operations
  validateCategory: (categoryData: Partial<CategoryFormData>) => CategoryValidationError[];
  clearErrors: () => void;
  setError: (field: string, message: string) => void;

  // Utility functions
  getNextAvailableColor: () => CategoryColor;
  getCategoryColor: (categoryId: string) => CategoryColor | undefined;
  isCategoryNameUnique: (name: string, excludeId?: string) => boolean;

  // Computed values
  totalCategories: number;
  categoriesWithServices: string[];
  availableColors: CategoryColor[];
}

export const useCategoryManagement = (options: UseCategoryManagementOptions = {}): UseCategoryManagementReturn => {
  const { initialCategories = [], onCategoryCreated, onCategoryUpdated, onCategoryDeleted, onError } = options;

  // State
  const [categories, setCategories] = useState<CategoryData[]>(initialCategories);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<CategoryValidationError[]>([]);

  // Load categories from API on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setIsLoading(true);
        const response = await categoriesService.getCategories();
        const categoriesData: CategoryData[] = response.map(category => ({
          id: category.id,
          name: category.name,
          description: category.description,
          color: category.color,
          sort_order: category.sort_order,
          created_at: category.created_at,
          updated_at: category.updated_at,
        }));
        setCategories(categoriesData);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to load categories'));
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []); // Empty dependency array - only run on mount

  // Category operations
  const createCategory = useCallback(async (categoryData: CategoryFormData): Promise<CategoryData | null> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Validate category data
      const validationErrors = validateCategory(categoryData);
      if (validationErrors.length > 0) {
        setValidationErrors(validationErrors);
        return null;
      }

      // Check for duplicate names
      if (!isCategoryNameUnique(categoryData.name)) {
        setValidationErrors([{
          field: 'name',
          message: 'Category name must be unique',
          code: 'DUPLICATE_NAME',
        }]);
        return null;
      }

      // Convert to API request format
      const createRequest: CreateCategoryRequest = {
        name: categoryData.name,
        description: categoryData.description,
        color: categoryData.color || getNextAvailableColor(),
        sort_order: categoryData.sort_order || categories.length,
      };

      // Create category via API
      const response = await categoriesService.createCategory(createRequest);
      
      // Convert response to CategoryData
      const newCategory: CategoryData = {
        id: response.id,
        name: response.name,
        description: response.description,
        color: response.color,
        sort_order: response.sort_order,
        created_at: response.created_at,
        updated_at: response.updated_at,
      };

      // Update local state
      setCategories(prev => [...prev, newCategory].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));

      // Call success callback
      onCategoryCreated?.(newCategory);

      return newCategory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create category';
      setError('create', errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [categories.length, onCategoryCreated, onError]);

  const updateCategory = useCallback(async (categoryId: string, categoryData: CategoryFormData): Promise<CategoryData | null> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Validate category data
      const validationErrors = validateCategory(categoryData);
      if (validationErrors.length > 0) {
        setValidationErrors(validationErrors);
        return null;
      }

      // Check for duplicate names (excluding current category)
      if (!isCategoryNameUnique(categoryData.name, categoryId)) {
        setValidationErrors([{
          field: 'name',
          message: 'Category name must be unique',
          code: 'DUPLICATE_NAME',
        }]);
        return null;
      }

      // Convert to API request format
      const updateRequest: UpdateCategoryRequest = {
        id: categoryId,
        name: categoryData.name,
        description: categoryData.description,
        color: categoryData.color,
        sort_order: categoryData.sort_order,
      };

      // Update category via API
      const response = await categoriesService.updateCategory(categoryId, updateRequest);
      
      // Convert response to CategoryData
      const updatedCategory: CategoryData = {
        id: response.id,
        name: response.name,
        description: response.description,
        color: response.color,
        sort_order: response.sort_order,
        created_at: response.created_at,
        updated_at: response.updated_at,
      };

      // Update local state
      setCategories(prev => 
        prev.map(category => 
          category.id === categoryId ? updatedCategory : category
        ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      );

      // Call success callback
      onCategoryUpdated?.(updatedCategory);

      return updatedCategory;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update category';
      setError('update', errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [onCategoryUpdated, onError]);

  const deleteCategory = useCallback(async (categoryId: string): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Delete category via API
      await categoriesService.deleteCategory(categoryId);

      // Update local state
      setCategories(prev => prev.filter(category => category.id !== categoryId));

      // Call success callback
      onCategoryDeleted?.(categoryId);

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete category';
      setError('delete', errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onCategoryDeleted, onError]);

  const getCategory = useCallback((categoryId: string): CategoryData | undefined => {
    return categories.find(category => category.id === categoryId);
  }, [categories]);

  // Form operations
  const validateCategory = useCallback((categoryData: Partial<CategoryFormData>): CategoryValidationError[] => {
    const errors: CategoryValidationError[] = [];

    if (!categoryData.name || categoryData.name.trim().length < 2) {
      errors.push({
        field: 'name',
        message: 'Category name must be at least 2 characters long',
        code: 'INVALID_NAME',
      });
    }

    if (categoryData.name && categoryData.name.length > 100) {
      errors.push({
        field: 'name',
        message: 'Category name cannot exceed 100 characters',
        code: 'INVALID_NAME',
      });
    }

    if (categoryData.description && categoryData.description.length > 500) {
      errors.push({
        field: 'description',
        message: 'Category description cannot exceed 500 characters',
        code: 'INVALID_DESCRIPTION',
      });
    }

    return errors;
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
    setValidationErrors([]);
  }, []);

  const setError = useCallback((field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  // Utility functions
  const getNextAvailableColor = useCallback((): CategoryColor => {
    const usedColors = categories.map(cat => cat.color).filter(Boolean) as CategoryColor[];
    const availableColors = CATEGORY_COLORS.filter(color => !usedColors.includes(color));
    return availableColors[0] || CATEGORY_COLORS[0];
  }, [categories]);

  const getCategoryColor = useCallback((categoryId: string): CategoryColor | undefined => {
    const category = getCategory(categoryId);
    return category?.color;
  }, [getCategory]);

  const isCategoryNameUnique = useCallback((name: string, excludeId?: string): boolean => {
    return !categories.some(category => 
      category.id !== excludeId && 
      category.name.toLowerCase() === name.toLowerCase()
    );
  }, [categories]);

  // Computed values
  const totalCategories = useMemo(() => categories.length, [categories]);
  
  const categoriesWithServices = useMemo(() => {
    // This would be populated by services that reference these categories
    // For now, return empty array - this will be updated when services are loaded
    return [];
  }, []);

  const availableColors = useMemo(() => {
    const usedColors = categories.map(cat => cat.color).filter(Boolean) as CategoryColor[];
    return CATEGORY_COLORS.filter(color => !usedColors.includes(color));
  }, [categories]);

  return {
    // State
    categories,
    isLoading,
    isSubmitting,
    errors,
    validationErrors,

    // Category operations
    createCategory,
    updateCategory,
    deleteCategory,
    getCategory,

    // Form operations
    validateCategory,
    clearErrors,
    setError,

    // Utility functions
    getNextAvailableColor,
    getCategoryColor,
    isCategoryNameUnique,

    // Computed values
    totalCategories,
    categoriesWithServices,
    availableColors,
  };
};

// Import category colors from types
import { CATEGORY_COLORS } from '../api/types/services';
