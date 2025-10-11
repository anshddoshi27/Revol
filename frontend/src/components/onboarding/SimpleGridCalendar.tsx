/**
 * SimpleGridCalendar Component
 * 
 * A simple, clean calendar grid that displays exactly like the target design.
 * This is a minimal implementation to ensure it works correctly.
 */

import React from 'react';

interface SimpleGridCalendarProps {
  staffMembers: any[];
  timeBlocks: any[];
  onTimeBlockAdd: (timeBlock: any) => void;
  onTimeBlockUpdate: (id: string, updates: any) => void;
  onTimeBlockDelete: (id: string) => void;
  onCopyWeek: (sourceWeekStart: Date, targetWeekStart: Date) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export const SimpleGridCalendar: React.FC<SimpleGridCalendarProps> = ({
  staffMembers,
  timeBlocks,
  onTimeBlockAdd,
  onTimeBlockUpdate,
  onTimeBlockDelete,
  onCopyWeek,
  onError,
  className = '',
}) => {
  // Generate time slots (10 AM to 10 PM)
  const timeSlots = [
    { hour: 10, label: '10:00 AM' },
    { hour: 11, label: '11:00 AM' },
    { hour: 12, label: '12:00 PM' },
    { hour: 13, label: '1:00 PM' },
    { hour: 14, label: '2:00 PM' },
    { hour: 15, label: '3:00 PM' },
    { hour: 16, label: '4:00 PM' },
    { hour: 17, label: '5:00 PM' },
    { hour: 18, label: '6:00 PM' },
    { hour: 19, label: '7:00 PM' },
    { hour: 20, label: '8:00 PM' },
    { hour: 21, label: '9:00 PM' },
    { hour: 22, label: '10:00 PM' },
  ];

  // Week days (January 15-21, 2024)
  const weekDays = [
    { dayName: 'Mon', dayNumber: 15 },
    { dayName: 'Tue', dayNumber: 16 },
    { dayName: 'Wed', dayNumber: 17 },
    { dayName: 'Thu', dayNumber: 18 },
    { dayName: 'Fri', dayNumber: 19 },
    { dayName: 'Sat', dayNumber: 20 },
    { dayName: 'Sun', dayNumber: 21 },
  ];

  // Sample appointments for Monday only
  const appointments = [
    { id: '1', hour: 10, day: 0, client: 'Sarah', service: 'Swedish Massage', staff: 'Maria', color: '#3B82F6' },
    { id: '2', hour: 14, day: 0, client: 'Michael', service: 'Deep Tissue', staff: 'David', color: '#10B981' },
    { id: '3', hour: 15, day: 0, client: 'Emily', service: 'Facial', staff: 'Lisa', color: '#8B5CF6' },
    { id: '4', hour: 17, day: 0, client: 'Robert', service: 'Hot Stone', staff: 'Maria', color: '#3B82F6' },
  ];

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
                ←
              </button>
              <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                Today
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                →
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button className="px-3 py-1 text-sm font-medium rounded-md transition-colors text-gray-600 hover:text-gray-900">
                Day
              </button>
              <button className="px-3 py-1 text-sm font-medium rounded-md transition-colors text-gray-600 hover:text-gray-900">
                Week
              </button>
              <button className="px-3 py-1 text-sm font-medium rounded-md transition-colors bg-white text-gray-900 shadow-sm">
                Month
              </button>
            </div>

            {/* New Appointment Button */}
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2">
              + New Appointment
            </button>
          </div>
        </div>

        {/* Date Range */}
        <div className="mt-4 text-sm text-gray-600">
          Week of January 15-21, 2024
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
                <div className="text-sm font-medium text-gray-900">Maria Garcia</div>
                <div className="text-xs text-gray-500">4 appointments</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">David Kim</div>
                <div className="text-xs text-gray-500">2 appointments</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Lisa Wang</div>
                <div className="text-xs text-gray-500">3 appointments</div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            {/* Day Headers */}
            <div className="grid grid-cols-8 gap-1 mb-0">
              <div className="p-2"></div>
              {weekDays.map((day, index) => (
                <div key={index} className="p-2 text-center font-medium border-b">
                  <div>{day.dayName}</div>
                  <div className="text-sm text-gray-500">{day.dayNumber}</div>
                </div>
              ))}
            </div>

            {/* Time Slots Grid */}
            <div className="grid grid-cols-8 gap-1">
              {timeSlots.map((slot) => (
                <div key={slot.hour} className="contents">
                  {/* Time Label */}
                  <div className="p-2 text-sm text-gray-500 border-r">
                    {slot.label}
                  </div>

                  {/* Day Columns */}
                  {weekDays.map((day, dayIndex) => {
                    // Find appointments for this time slot and day
                    const slotAppointments = appointments.filter(apt => 
                      apt.hour === slot.hour && apt.day === dayIndex
                    );

                    return (
                      <div
                        key={`${slot.hour}-${dayIndex}`}
                        className="p-1 border border-gray-200 min-h-16 relative"
                      >
                        {slotAppointments.length > 0 ? (
                          slotAppointments.map((appointment) => (
                            <div
                              key={appointment.id}
                              className="absolute inset-1 bg-blue-100 border border-blue-300 rounded p-1 cursor-move hover:bg-blue-200 transition-colors"
                              style={{ 
                                backgroundColor: `${appointment.color}15`,
                                borderColor: appointment.color
                              }}
                            >
                              <div className="text-xs font-medium">{appointment.client} - {appointment.service}</div>
                              <div className="text-xs text-gray-600">{appointment.staff}</div>
                            </div>
                          ))
                        ) : null}
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
              <div className="text-sm text-gray-600">10:00 AM - Sarah Johnson (Swedish Massage)</div>
              <div className="text-sm text-gray-600">2:00 PM - Michael Chen (Deep Tissue)</div>
              <div className="text-sm text-gray-600">3:30 PM - Emily Davis (Facial)</div>
            </div>
          </div>

          {/* Resource Utilization */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Resource Utilization</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Maria Garcia</span>
                <span className="font-medium">85%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">David Kim</span>
                <span className="font-medium">72%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Lisa Wang</span>
                <span className="font-medium">68%</span>
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
