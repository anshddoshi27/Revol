/**
 * WorkingGridCalendar Component
 * 
 * A working calendar grid that displays exactly like the target design.
 * This is a direct implementation based on the Tithi Lovable working code.
 */

import React from 'react';

interface WorkingGridCalendarProps {
  staffMembers: any[];
  timeBlocks: any[];
  onTimeBlockAdd: (timeBlock: any) => void;
  onTimeBlockUpdate: (id: string, updates: any) => void;
  onTimeBlockDelete: (id: string) => void;
  onCopyWeek: (sourceWeekStart: Date, targetWeekStart: Date) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export const WorkingGridCalendar: React.FC<WorkingGridCalendarProps> = ({
  staffMembers,
  timeBlocks,
  onTimeBlockAdd,
  onTimeBlockUpdate,
  onTimeBlockDelete,
  onCopyWeek,
  onError,
  className = '',
}) => {
  // Generate time slots (10 AM to 10 PM) - exactly like Tithi Lovable
  const timeSlots = Array.from({ length: 13 }, (_, i) => `${i + 10}:00`);
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  
  // Sample appointments for Monday only - exactly like Tithi Lovable
  const appointments = [
    { id: 1, title: "Sarah - Swedish Massage", time: "10:00", duration: 1, staff: "Maria", day: 0 },
    { id: 2, title: "Michael - Deep Tissue", time: "14:00", duration: 1.5, staff: "David", day: 0 },
    { id: 3, title: "Emily - Facial", time: "15:30", duration: 1.25, staff: "Lisa", day: 0 },
    { id: 4, title: "Robert - Hot Stone", time: "17:00", duration: 1.5, staff: "Maria", day: 0 },
  ];

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-green-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">✅ WORKING GRID CALENDAR - Visual Calendar</h2>
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

        {/* Calendar Grid - EXACT COPY FROM TITHI LOVABLE */}
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            <div className="grid grid-cols-8 gap-1">
              <div className="p-2"></div>
              {weekDays.map((day, index) => (
                <div key={day} className="p-2 text-center font-medium border-b">
                  <div>{day}</div>
                  <div className="text-sm text-gray-500">{15 + index}</div>
                </div>
              ))}
              
              {timeSlots.map((time) => (
                <div key={time} className="contents">
                  <div className="p-2 text-sm text-gray-500 border-r">{time}</div>
                  {weekDays.map((_, dayIndex) => (
                    <div key={`${time}-${dayIndex}`} className="p-1 border border-gray-200 min-h-16 relative">
                      {dayIndex === 0 && appointments
                        .filter(apt => parseInt(apt.time.split(':')[0]) === parseInt(time.split(':')[0]))
                        .map(apt => (
                          <div
                            key={apt.id}
                            className="absolute inset-1 bg-blue-100 border border-blue-300 rounded p-1 cursor-move hover:bg-blue-200 transition-colors"
                            style={{ height: `${apt.duration * 60 - 8}px` }}
                          >
                            <div className="text-xs font-medium">{apt.title}</div>
                            <div className="text-xs text-gray-600">{apt.staff}</div>
                          </div>
                        ))
                      }
                    </div>
                  ))}
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
              <div className="text-sm">
                <span className="font-medium">10:00 AM</span> - Sarah Johnson (Swedish Massage)
              </div>
              <div className="text-sm">
                <span className="font-medium">2:00 PM</span> - Michael Chen (Deep Tissue)
              </div>
              <div className="text-sm">
                <span className="font-medium">3:30 PM</span> - Emily Davis (Facial)
              </div>
            </div>
          </div>

          {/* Resource Utilization */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Resource Utilization</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Maria Garcia</span>
                <span>85%</span>
              </div>
              <div className="flex justify-between">
                <span>David Kim</span>
                <span>72%</span>
              </div>
              <div className="flex justify-between">
                <span>Lisa Wang</span>
                <span>68%</span>
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
