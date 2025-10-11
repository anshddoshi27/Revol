/**
 * QuietHoursConfig Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuietHoursConfig } from '../QuietHoursConfig';
import type { QuietHoursConfig as QuietHoursConfigType } from '../../../api/types/notifications';

describe('QuietHoursConfig', () => {
  const mockOnConfigChange = jest.fn();

  const defaultConfig: QuietHoursConfigType = {
    enabled: false,
    start_time: '22:00',
    end_time: '08:00',
    timezone: 'America/New_York',
  };

  const defaultProps = {
    initialConfig: defaultConfig,
    onConfigChange: mockOnConfigChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<QuietHoursConfig {...defaultProps} />);
    expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
  });

  it('shows disabled state when quiet hours are disabled', () => {
    render(<QuietHoursConfig {...defaultProps} />);
    expect(screen.getByText('Quiet hours are disabled. Notifications will be sent immediately.')).toBeInTheDocument();
  });

  it('enables quiet hours when toggle is clicked', async () => {
    render(<QuietHoursConfig {...defaultProps} />);
    
    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);
    
    await waitFor(() => {
      expect(mockOnConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
        })
      );
    });
  });

  it('shows configuration options when enabled', () => {
    const enabledConfig = { ...defaultConfig, enabled: true };
    render(<QuietHoursConfig {...defaultProps} initialConfig={enabledConfig} />);
    
    expect(screen.getByText('Start Time')).toBeInTheDocument();
    expect(screen.getByText('End Time')).toBeInTheDocument();
    expect(screen.getByText('Timezone')).toBeInTheDocument();
  });

  it('updates start time when changed', async () => {
    const enabledConfig = { ...defaultConfig, enabled: true };
    render(<QuietHoursConfig {...defaultProps} initialConfig={enabledConfig} />);
    
    const startTimeSelect = screen.getByDisplayValue('10:00 PM');
    fireEvent.change(startTimeSelect, { target: { value: '23:00' } });
    
    await waitFor(() => {
      expect(mockOnConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          start_time: '23:00',
        })
      );
    });
  });

  it('updates end time when changed', async () => {
    const enabledConfig = { ...defaultConfig, enabled: true };
    render(<QuietHoursConfig {...defaultProps} initialConfig={enabledConfig} />);
    
    const endTimeSelect = screen.getByDisplayValue('8:00 AM');
    fireEvent.change(endTimeSelect, { target: { value: '09:00' } });
    
    await waitFor(() => {
      expect(mockOnConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          end_time: '09:00',
        })
      );
    });
  });

  it('updates timezone when changed', async () => {
    const enabledConfig = { ...defaultConfig, enabled: true };
    render(<QuietHoursConfig {...defaultProps} initialConfig={enabledConfig} />);
    
    const timezoneSelect = screen.getByDisplayValue('Eastern Time (ET)');
    fireEvent.change(timezoneSelect, { target: { value: 'America/Los_Angeles' } });
    
    await waitFor(() => {
      expect(mockOnConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          timezone: 'America/Los_Angeles',
        })
      );
    });
  });

  it('shows quiet hours summary', () => {
    const enabledConfig = { ...defaultConfig, enabled: true };
    render(<QuietHoursConfig {...defaultProps} initialConfig={enabledConfig} />);
    
    expect(screen.getByText('Quiet Hours Summary')).toBeInTheDocument();
    expect(screen.getByText(/Notifications will be paused from/)).toBeInTheDocument();
  });

  it('shows policy note when enabled', () => {
    render(<QuietHoursConfig {...defaultProps} showPolicyNote={true} />);
    expect(screen.getByText('Quiet Hours Policy')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(<QuietHoursConfig {...defaultProps} disabled={true} />);
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('can hide timezone section', () => {
    const enabledConfig = { ...defaultConfig, enabled: true };
    render(<QuietHoursConfig {...defaultProps} initialConfig={enabledConfig} showTimezone={false} />);
    expect(screen.queryByText('Timezone')).not.toBeInTheDocument();
  });

  it('can hide policy note', () => {
    render(<QuietHoursConfig {...defaultProps} showPolicyNote={false} />);
    expect(screen.queryByText('Quiet Hours Policy')).not.toBeInTheDocument();
  });
});
