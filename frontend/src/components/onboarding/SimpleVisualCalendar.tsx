/**
 * SimpleVisualCalendar Component
 * 
 * A simplified visual calendar that displays as a proper grid layout.
 */

import React, { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TimeBlock } from '../../api/types/availability';
import type { StaffMember } from '../../api/types/onboarding';

interface SimpleVisualCalendarProps {
  staffMembers: StaffMember[];
  timeBlocks: TimeBlock[];
  onTimeBlockAdd: (timeBlock: TimeBlock) => void;
  onTimeBlockUpdate: (id: string, updates: Partial<TimeBlock>) => void;
  onTimeBlockDelete: (id: string) => void;
  onCopyWeek: (sourceWeekStart: Date, targetWeekStart: Date) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export const SimpleVisualCalendar: React.FC<SimpleVisualCalendarProps> = ({
  staffMembers,
  timeBlocks,
  onTimeBlockAdd,
  onTimeBlockUpdate,
  onTimeBlockDelete,
  onCopyWeek,
  onError,
  className = '',
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');

  // Generate time slots (10 AM to 10 PM)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 10; hour <= 22; hour++) {
      slots.push({
        hour,
        label: hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`,
        time: `${hour.toString().padStart(2, '0')}:00`,
      });
    }
    return slots;
  }, []);

  // Generate week days (October 6-12, 2025)
  const weekDays = useMemo(() => {
    const startDate = new Date(2025, 9, 6); // October 6, 2025
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push({
        date: day,
        dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: day.getDate(),
        isToday: false,
      });
    }
    return days;
  }, []);

  // Sample appointments for Monday
  const sampleAppointments = useMemo(() => {
    return [
      {
        id: 'sample-1',
        staff_id: staffMembers[0]?.id || 'staff-1',
        staff_name: staffMembers[0]?.name || 'Ansh Doshi',
        day_of_week: 0, // Monday
        start_time: '10:00',
        end_time: '11:00',
        clientName: 'Sarah',
        serviceName: 'Swedish Massage',
        color: '#3B82F6',
      },
      {
        id: 'sample-2',
        staff_id: staffMembers[1]?.id || 'staff-2',
        staff_name: staffMembers[1]?.name || 'kojn',
        day_of_week: 0, // Monday
        start_time: '14:00',
        end_time: '15:00',
        clientName: 'Michael',
        serviceName: 'Deep Tissue',
        color: '#10B981',
      },
      {
        id: 'sample-3',
        staff_id: staffMembers[2]?.id || 'staff-3',
        staff_name: 'Lisa Wang',
        day_of_week: 0, // Monday
        start_time: '15:00',
        end_time: '16:00',
        clientName: 'Emily',
        serviceName: 'Facial',
        color: '#8B5CF6',
      },
      {
        id: 'sample-4',
        staff_id: staffMembers[0]?.id || 'staff-1',
        staff_name: staffMembers[0]?.name || 'Ansh Doshi',
        day_of_week: 0, // Monday
        start_time: '17:00',
        end_time: '18:00',
        clientName: 'Robert',
        serviceName: 'Hot Stone',
        color: '#3B82F6',
      },
    ];
  }, [staffMembers]);

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Visual Calendar</h2>
            <p className="text-sm text-gray-600 mt-1">
              Drag and drop appointments to manage scheduling.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Navigation Controls */}
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                Today
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(['day', 'week', 'month'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setCalendarView(view)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    calendarView === view
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>

            {/* New Appointment Button */}
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Appointment
            </button>
          </div>
        </div>

        {/* Date Range */}
        <div className="mt-4 text-sm text-gray-600">
          Week of October 6 - October 12
        </div>
      </div>

      {/* Main Calendar Content */}
      <div className="flex">
        {/* Staff Resources Sidebar */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Staff Resources</h3>
          <p className="text-xs text-gray-600 mb-4">Available team members</p>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Ansh Doshi</div>
                <div className="text-xs text-gray-500">2 appointments</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">kojn</div>
                <div className="text-xs text-gray-500">1 appointments</div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            {/* Day Headers */}
            <div className="grid grid-cols-8 gap-0 mb-0">
              <div className="text-sm font-medium text-gray-500 p-2 border-r border-gray-200 bg-gray-50">Time</div>
              {weekDays.map((day, index) => (
                <div key={index} className="text-sm font-medium text-gray-500 text-center p-2 border-r border-gray-200 bg-gray-50">
                  <div>{day.dayName} {day.dayNumber}</div>
                </div>
              ))}
            </div>

            {/* Time Slots Grid */}
            <div className="border border-gray-200">
              {timeSlots.map((slot) => (
                <div key={slot.hour} className="grid grid-cols-8 gap-0 h-12 border-b border-gray-200">
                  {/* Time Label */}
                  <div className="flex items-center text-sm text-gray-500 p-2 border-r border-gray-200 bg-gray-50">
                    {slot.label}
                  </div>

                  {/* Day Columns */}
                  {weekDays.map((day, dayIndex) => {
                    // Find appointments for this time slot
                    const slotAppointments = sampleAppointments.filter(block => {
                      const blockStartHour = parseInt(block.start_time.split(':')[0]);
                      const blockEndHour = parseInt(block.end_time.split(':')[0]);
                      return block.day_of_week === dayIndex && 
                             slot.hour >= blockStartHour && 
                             slot.hour < blockEndHour;
                    });

                    return (
                      <div
                        key={dayIndex}
                        className="border-r border-gray-200 bg-white hover:bg-gray-50 transition-colors relative h-12 p-1"
                      >
                        <div className="h-full">
                          {slotAppointments.map((timeBlock) => (
                            <div
                              key={timeBlock.id}
                              className="bg-gray-100 border border-gray-200 rounded p-1 text-xs cursor-move hover:bg-gray-200 transition-colors h-full"
                              style={{ 
                                backgroundColor: `${timeBlock.color}15`,
                                borderColor: timeBlock.color
                              }}
                            >
                              <div className="font-medium text-gray-800 truncate">
                                {timeBlock.clientName} - {timeBlock.serviceName}
                              </div>
                              <div className="text-gray-600 truncate text-xs">
                                {timeBlock.staff_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Panels */}
      <div className="border-t border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Today's Schedule</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">No appointments today</p>
            </div>
          </div>

          {/* Resource Utilization */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Resource Utilization</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Ansh Doshi</span>
                <span className="font-medium">5%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">kojn</span>
                <span className="font-medium">3%</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                Block Time Slot
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                Set Recurring Block
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
                Add Break
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
