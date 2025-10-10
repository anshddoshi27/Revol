/**
 * ChipsConfigurator Component Tests
 * 
 * Unit tests for the ChipsConfigurator component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChipsConfigurator } from '../ChipsConfigurator';
import type { ChipsConfiguration } from '../../../api/types/services';

describe('ChipsConfigurator', () => {
  const mockOnConfigChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the component with header and description', () => {
    render(
      <ChipsConfigurator
        onConfigChange={mockOnConfigChange}
      />
    );

    expect(screen.getByText('Special Requests Configuration')).toBeInTheDocument();
    expect(screen.getByText(/Configure how customers can add special requests/)).toBeInTheDocument();
  });

  it('shows enable/disable toggle', () => {
    render(
      <ChipsConfigurator
        onConfigChange={mockOnConfigChange}
      />
    );

    expect(screen.getByText('Enable Special Requests')).toBeInTheDocument();
    expect(screen.getByText('Allow customers to add special requests or notes')).toBeInTheDocument();
  });

  it('toggles special requests enabled state', () => {
    render(
      <ChipsConfigurator
        onConfigChange={mockOnConfigChange}
      />
    );

    const toggle = screen.getByRole('button', { name: /Enable Special Requests/i });
    fireEvent.click(toggle);

    expect(mockOnConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
      })
    );
  });

  it('shows configuration options when enabled', () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: [],
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    expect(screen.getByText('Character Limit')).toBeInTheDocument();
    expect(screen.getByText('Allow Custom Input')).toBeInTheDocument();
    expect(screen.getByText('Quick Options')).toBeInTheDocument();
  });

  it('updates character limit when changed', () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: [],
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    const limitInput = screen.getByLabelText('Character Limit');
    fireEvent.change(limitInput, { target: { value: '300' } });

    expect(mockOnConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 300,
      })
    );
  });

  it('validates character limit range', async () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: [],
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    const limitInput = screen.getByLabelText('Character Limit');
    fireEvent.change(limitInput, { target: { value: '5' } });

    await waitFor(() => {
      expect(screen.getByText('Limit must be between 10 and 500 characters')).toBeInTheDocument();
    });
  });

  it('toggles allow custom input', () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: [],
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    const toggle = screen.getByRole('button', { name: /Allow Custom Input/i });
    fireEvent.click(toggle);

    expect(mockOnConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        allow_custom: false,
      })
    );
  });

  it('shows common quick chips options', () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: [],
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    expect(screen.getByText('Hair wash included')).toBeInTheDocument();
    expect(screen.getByText('Blow dry included')).toBeInTheDocument();
    expect(screen.getByText('Deep conditioning')).toBeInTheDocument();
  });

  it('adds quick chips when clicked', () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: [],
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    const chipButton = screen.getByText('Hair wash included');
    fireEvent.click(chipButton);

    expect(mockOnConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        quick_chips: ['Hair wash included'],
      })
    );
  });

  it('removes quick chips when clicked again', () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: ['Hair wash included'],
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    // Find the chip button in the "Common Options" section (not the preview)
    const chipButtons = screen.getAllByText('Hair wash included');
    const chipButton = chipButtons.find(button => 
      button.closest('button') && 
      button.closest('button')?.className.includes('bg-blue-100')
    );
    
    if (chipButton) {
      fireEvent.click(chipButton);
    }

    expect(mockOnConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        quick_chips: [],
      })
    );
  });

  it('shows custom chip input when allow custom is enabled', () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: [],
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    expect(screen.getByText('Add Custom Option')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter custom option...')).toBeInTheDocument();
  });

  it('adds custom chip when entered', async () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: [],
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    const customInput = screen.getByPlaceholderText('Enter custom option...');
    fireEvent.change(customInput, { target: { value: 'Custom option' } });

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          quick_chips: ['Custom option'],
        })
      );
    });
  });

  it('validates custom chip length', async () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: [],
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    const customInput = screen.getByPlaceholderText('Enter custom option...');
    fireEvent.change(customInput, { 
      target: { value: 'This is a very long custom option that exceeds the maximum length limit of 50 characters' } 
    });

    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Option text cannot exceed 50 characters')).toBeInTheDocument();
    });
  });

  it('shows preview when enabled', () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: ['Hair wash included', 'Blow dry included'],
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Special Requests')).toBeInTheDocument();
    // Check that the chips appear in the preview section
    expect(screen.getAllByText('Hair wash included')).toHaveLength(3); // Button, selected chip, and preview
    expect(screen.getAllByText('Blow dry included')).toHaveLength(3); // Button, selected chip, and preview
  });

  it('disables form when disabled prop is true', () => {
    render(
      <ChipsConfigurator
        onConfigChange={mockOnConfigChange}
        disabled={true}
      />
    );

    const toggle = screen.getByRole('button', { name: /Enable Special Requests/i });
    expect(toggle).toBeDisabled();
  });

  it('respects maximum quick chips limit', () => {
    const initialConfig: ChipsConfiguration = {
      enabled: true,
      limit: 200,
      quick_chips: Array(10).fill('Test chip'),
      allow_custom: true,
    };

    render(
      <ChipsConfigurator
        initialConfig={initialConfig}
        onConfigChange={mockOnConfigChange}
      />
    );

    // Should not show "Add Custom Option" when at limit
    expect(screen.queryByText('Add Custom Option')).not.toBeInTheDocument();
    
    // Available chips should be disabled
    const chipButton = screen.getByText('Hair wash included');
    expect(chipButton).toBeDisabled();
  });
});
