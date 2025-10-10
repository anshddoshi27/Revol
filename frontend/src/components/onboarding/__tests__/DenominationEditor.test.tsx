/**
 * DenominationEditor Component Tests
 * 
 * Unit tests for the DenominationEditor component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DenominationEditor } from '../DenominationEditor';
import type { Denomination } from '../../../api/types/giftCards';

describe('DenominationEditor', () => {
  const mockOnAdd = jest.fn();
  const mockOnUpdate = jest.fn();
  const mockOnRemove = jest.fn();

  const mockDenominations: Denomination[] = [
    {
      id: '1',
      amount_cents: 2500,
      is_active: true,
    },
    {
      id: '2',
      amount_cents: 5000,
      is_active: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders denomination editor', () => {
    render(
      <DenominationEditor
        denominations={mockDenominations}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    expect(screen.getByText('Current Gift Card Amounts')).toBeInTheDocument();
    expect(screen.getByText('Add New Amount')).toBeInTheDocument();
  });

  it('displays current denominations', () => {
    render(
      <DenominationEditor
        denominations={mockDenominations}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  it('shows common denomination buttons', () => {
    render(
      <DenominationEditor
        denominations={[]}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    expect(screen.getByText('$25')).toBeInTheDocument();
    expect(screen.getByText('$50')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('adds denomination when common button is clicked', async () => {
    mockOnAdd.mockResolvedValue(true);

    render(
      <DenominationEditor
        denominations={[]}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    const addButton = screen.getByText('$25');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith(2500);
    });
  });

  it('adds custom denomination', async () => {
    mockOnAdd.mockResolvedValue(true);

    render(
      <DenominationEditor
        denominations={[]}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    const input = screen.getByPlaceholderText('0.00');
    fireEvent.change(input, { target: { value: '75.00' } });

    const addButton = screen.getByText('Add Amount');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith(7500);
    });
  });

  it('validates denomination amount', async () => {
    render(
      <DenominationEditor
        denominations={[]}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    const input = screen.getByPlaceholderText('0.00');
    fireEvent.change(input, { target: { value: '2.00' } });

    const addButton = screen.getByText('Add Amount');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Minimum amount is $5.00')).toBeInTheDocument();
    });

    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  it('prevents duplicate denominations', async () => {
    render(
      <DenominationEditor
        denominations={mockDenominations}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    const input = screen.getByPlaceholderText('0.00');
    fireEvent.change(input, { target: { value: '25.00' } });

    const addButton = screen.getByText('Add Amount');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('This amount already exists')).toBeInTheDocument();
    });

    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  it('starts editing denomination', () => {
    render(
      <DenominationEditor
        denominations={mockDenominations}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    const editButton = screen.getAllByText('Edit')[0];
    fireEvent.click(editButton);

    expect(screen.getByDisplayValue('$25.00')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('updates denomination', async () => {
    mockOnUpdate.mockResolvedValue(true);

    render(
      <DenominationEditor
        denominations={mockDenominations}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    const editButton = screen.getAllByText('Edit')[0];
    fireEvent.click(editButton);

    const input = screen.getByDisplayValue('$25.00');
    fireEvent.change(input, { target: { value: '30.00' } });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith('1', 3000);
    });
  });

  it('removes denomination with confirmation', async () => {
    mockOnRemove.mockResolvedValue(true);
    window.confirm = jest.fn().mockReturnValue(true);

    render(
      <DenominationEditor
        denominations={mockDenominations}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    const removeButton = screen.getAllByText('Remove')[0];
    fireEvent.click(removeButton);

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to remove this denomination?');

    await waitFor(() => {
      expect(mockOnRemove).toHaveBeenCalledWith('1');
    });
  });

  it('does not remove denomination without confirmation', async () => {
    window.confirm = jest.fn().mockReturnValue(false);

    render(
      <DenominationEditor
        denominations={mockDenominations}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
      />
    );

    const removeButton = screen.getAllByText('Remove')[0];
    fireEvent.click(removeButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockOnRemove).not.toHaveBeenCalled();
  });

  it('disables buttons when loading', () => {
    render(
      <DenominationEditor
        denominations={mockDenominations}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        isLoading={true}
      />
    );

    const addButton = screen.getByText('Add Amount');
    expect(addButton).toBeDisabled();
  });

  it('displays API errors', () => {
    const errors = {
      amount_cents: 'Invalid amount',
      general: 'Server error',
    };

    render(
      <DenominationEditor
        denominations={[]}
        onAdd={mockOnAdd}
        onUpdate={mockOnUpdate}
        onRemove={mockOnRemove}
        errors={errors}
      />
    );

    expect(screen.getByText('Invalid amount')).toBeInTheDocument();
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });
});
