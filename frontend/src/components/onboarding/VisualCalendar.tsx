/**
 * VisualCalendar Component
 * 
 * Modern visual calendar interface for managing staff availability and appointments.
 * Features drag-and-drop functionality, time slot management, and real-time scheduling.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Calendar,
  Clock,
  User,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Settings,
  BarChart3,
  Users,
  Coffee,
  Edit,
  Trash2,
  Copy,
} from 'lucide-react';
import { TimeBlockEditor } from './TimeBlockEditor';
import type {
  TimeBlock,
  StaffAvailability,
} from '../../api/types/availability';
import type { StaffMember } from '../../api/types/onboarding';
import {
  formatTime,
  calculateDuration,
  sortTimeBlocksByStartTime,
} from '../../utils/availabilityHelpers';

interface VisualCalendarProps {
  staffMembers: StaffMember[];
  timeBlocks: TimeBlock[];
  onTimeBlockAdd: (timeBlock: TimeBlock) => void;
  onTimeBlockUpdate: (id: string, updates: Partial<TimeBlock>) => void;
  onTimeBlockDelete: (id: string) => void;
  onCopyWeek: (sourceWeekStart: Date, targetWeekStart: Date) => void;
  onError?: (error: Error) => void;
  className?: string;
}

interface AppointmentBlockProps {
  timeBlock: TimeBlock;
  onEdit: (timeBlock: TimeBlock) => void;
  onDelete: (id: string) => void;
  onDuplicate: (timeBlock: TimeBlock) => void;
}

const AppointmentBlock: React.FC<AppointmentBlockProps> = ({
  timeBlock,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: timeBlock.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const duration = calculateDuration(timeBlock.start_time, timeBlock.end_time);
  const breakDuration = timeBlock.break_start && timeBlock.break_end 
    ? calculateDuration(timeBlock.break_start, timeBlock.break_end)
    : 0;
  const netDuration = duration - breakDuration;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-move ${
        isDragging ? 'opacity-50 z-50' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      {/* Staff Color Indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: timeBlock.color || '#6B7280' }}
      />
      
      <div className="ml-2">
        {/* Staff Info */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: timeBlock.color || '#6B7280' }}
          />
          <span className="text-sm font-medium text-gray-900">
            {timeBlock.staff_name}
          </span>
        </div>

        {/* Time Range */}
        <div className="flex items-center gap-1 text-sm text-gray-700 mb-1">
          <Clock className="w-3 h-3" />
          <span>
            {formatTime(timeBlock.start_time, '12h')} - {formatTime(timeBlock.end_time, '12h')}
          </span>
        </div>

        {/* Duration */}
        <div className="text-xs text-gray-500 mb-2">
          {Math.floor(netDuration / 60)}h {netDuration % 60}m
          {breakDuration > 0 && (
            <span className="ml-1 text-orange-600">
              (Break: {Math.floor(breakDuration / 60)}h {breakDuration % 60}m)
            </span>
          )}
        </div>

        {/* Break Info */}
        {timeBlock.break_start && timeBlock.break_end && (
          <div className="flex items-center gap-1 text-xs text-orange-600 mb-2">
            <Coffee className="w-3 h-3" />
            <span>
              Break: {formatTime(timeBlock.break_start, '12h')} - {formatTime(timeBlock.break_end, '12h')}
            </span>
          </div>
        )}

        {/* Recurring Indicator */}
        {timeBlock.is_recurring && (
          <div className="text-xs text-blue-600 mb-2">
            Recurring weekly
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(timeBlock);
            }}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit time block"
          >
            <Edit className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(timeBlock);
            }}
            className="p-1 text-gray-400 hover:text-green-600 transition-colors"
            title="Duplicate time block"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(timeBlock.id);
            }}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete time block"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const VisualCalendar: React.FC<VisualCalendarProps> = ({
  staffMembers,
  timeBlocks,
  onTimeBlockAdd,
  onTimeBlockUpdate,
  onTimeBlockDelete,
  onCopyWeek,
  onError,
  className = '',
}) => {
  // State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showTimeBlockEditor, setShowTimeBlockEditor] = useState(false);
  const [editingTimeBlock, setEditingTimeBlock] = useState<TimeBlock | null>(null);
  const [draggedTimeBlock, setDraggedTimeBlock] = useState<TimeBlock | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Memoized staff availability
  const staffAvailability = useMemo(() => {
    return staffMembers.map(staff => {
      const staffTimeBlocks = timeBlocks.filter(block => block.staff_id === staff.id);
      return {
        staff_id: staff.id || '',
        staff_name: staff.name,
        staff_role: staff.role,
        color: staff.color,
        time_blocks: sortTimeBlocksByStartTime(staffTimeBlocks),
        total_hours_per_week: staffTimeBlocks.reduce((total, block) => {
          const duration = calculateDuration(block.start_time, block.end_time);
          const breakDuration = block.break_start && block.break_end 
            ? calculateDuration(block.break_start, block.break_end)
            : 0;
          return total + (duration - breakDuration) / 60;
        }, 0),
      };
    });
  }, [staffMembers, timeBlocks]);

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

  // Generate week days
  const weekDays = useMemo(() => {
    // Use a fixed week for demonstration (October 6-12, 2025)
    const startDate = new Date(2025, 9, 6); // October 6, 2025 (month is 0-indexed)
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push({
        date: day,
        dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: day.getDate(),
        isToday: false, // Set to false for demo
      });
    }
    return days;
  }, [currentDate]);

  // Add sample appointments for demonstration (matching the first image)
  const sampleAppointments = useMemo(() => {
    if (timeBlocks.length > 0) return timeBlocks; // Use existing data if available
    
    // Create sample appointments for Monday (day 0) to match the first image
    const sampleBlocks: (TimeBlock & { serviceName: string; clientName: string })[] = [
      {
        id: 'sample-1',
        staff_id: staffMembers[0]?.id || 'staff-1',
        staff_name: staffMembers[0]?.name || 'Ansh Doshi',
        staff_role: staffMembers[0]?.role || 'Stylist',
        day_of_week: 0, // Monday
        start_time: '10:00',
        end_time: '11:00',
        is_recurring: false,
        is_active: true,
        color: staffMembers[0]?.color || '#3B82F6',
        break_start: undefined,
        break_end: undefined,
        serviceName: 'Swedish Massage',
        clientName: 'Sarah',
      },
      {
        id: 'sample-2',
        staff_id: staffMembers[1]?.id || 'staff-2',
        staff_name: staffMembers[1]?.name || 'kojn',
        staff_role: staffMembers[1]?.role || 'Stylist',
        day_of_week: 0, // Monday
        start_time: '14:00',
        end_time: '15:00',
        is_recurring: false,
        is_active: true,
        color: staffMembers[1]?.color || '#10B981',
        break_start: undefined,
        break_end: undefined,
        serviceName: 'Deep Tissue',
        clientName: 'Michael',
      },
      {
        id: 'sample-3',
        staff_id: staffMembers[2]?.id || 'staff-3',
        staff_name: staffMembers[2]?.name || 'Lisa Wang',
        staff_role: staffMembers[2]?.role || 'Stylist',
        day_of_week: 0, // Monday
        start_time: '15:00',
        end_time: '16:00',
        is_recurring: false,
        is_active: true,
        color: staffMembers[2]?.color || '#8B5CF6',
        break_start: undefined,
        break_end: undefined,
        serviceName: 'Facial',
        clientName: 'Emily',
      },
      {
        id: 'sample-4',
        staff_id: staffMembers[0]?.id || 'staff-1',
        staff_name: staffMembers[0]?.name || 'Ansh Doshi',
        staff_role: staffMembers[0]?.role || 'Stylist',
        day_of_week: 0, // Monday
        start_time: '17:00',
        end_time: '18:00',
        is_recurring: false,
        is_active: true,
        color: staffMembers[0]?.color || '#3B82F6',
        break_start: undefined,
        break_end: undefined,
        serviceName: 'Hot Stone',
        clientName: 'Robert',
      },
    ];
    
    return sampleBlocks;
  }, [timeBlocks, staffMembers]);

  // Navigation
  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    switch (calendarView) {
      case 'day':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    setCurrentDate(newDate);
  };

  // Time block operations
  const handleAddTimeBlock = (staffId: string, dayOfWeek: number) => {
    setSelectedStaff(staffId);
    setSelectedDay(dayOfWeek);
    setEditingTimeBlock(null);
    setShowTimeBlockEditor(true);
  };

  const handleEditTimeBlock = (timeBlock: TimeBlock) => {
    setEditingTimeBlock(timeBlock);
    setShowTimeBlockEditor(true);
  };

  const handleDeleteTimeBlock = (id: string) => {
    if (window.confirm('Are you sure you want to delete this time block?')) {
      onTimeBlockDelete(id);
    }
  };

  const handleDuplicateTimeBlock = (timeBlock: TimeBlock) => {
    const newTimeBlock: TimeBlock = {
      ...timeBlock,
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    onTimeBlockAdd(newTimeBlock);
  };

  const handleTimeBlockSave = (timeBlock: TimeBlock) => {
    if (editingTimeBlock) {
      onTimeBlockUpdate(editingTimeBlock.id, timeBlock);
    } else {
      onTimeBlockAdd(timeBlock);
    }
    setShowTimeBlockEditor(false);
    setEditingTimeBlock(null);
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const timeBlock = timeBlocks.find(block => block.id === active.id);
    setDraggedTimeBlock(timeBlock || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedTimeBlock(null);

    if (!over) return;

    const timeBlock = timeBlocks.find(block => block.id === active.id);
    if (!timeBlock) return;

    // Handle dropping on a time slot
    if (over.id.toString().startsWith('slot-')) {
      const [_, dayIndex, hour] = over.id.toString().split('-');
      const newStartTime = `${hour.padStart(2, '0')}:00`;
      const duration = calculateDuration(timeBlock.start_time, timeBlock.end_time);
      const newEndTime = `${(parseInt(hour) + Math.floor(duration / 60)).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`;
      
      onTimeBlockUpdate(timeBlock.id, { 
        day_of_week: parseInt(dayIndex),
        start_time: newStartTime,
        end_time: newEndTime,
      });
    }
  };

  // Get today's schedule
  const todaysSchedule = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    return sampleAppointments
      .filter(block => block.day_of_week === dayOfWeek)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [sampleAppointments]);

  // Calculate resource utilization
  const resourceUtilization = useMemo(() => {
    return staffAvailability.map(staff => {
      // Calculate utilization based on sample appointments
      const staffAppointments = sampleAppointments.filter(block => block.staff_id === staff.staff_id);
      const totalHours = staffAppointments.reduce((total, block) => {
        const duration = calculateDuration(block.start_time, block.end_time);
        return total + duration / 60; // Convert to hours
      }, 0);
      
      const totalPossibleHours = 40; // Assuming 40 hours per week
      const utilization = Math.min((totalHours / totalPossibleHours) * 100, 100);
      return {
        ...staff,
        utilization: Math.round(utilization),
      };
    });
  }, [staffAvailability, sampleAppointments]);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
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
                <button
                  onClick={() => navigateCalendar('prev')}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => navigateCalendar('next')}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
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
              <button
                onClick={() => setShowTimeBlockEditor(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Appointment
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="mt-4 text-sm text-gray-600">
            {calendarView === 'week' && (
              <span>
                Week of {weekDays[0].date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekDays[6].date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Main Calendar Content */}
        <div className="flex">
          {/* Staff Resources Sidebar */}
          <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Staff Resources</h3>
            <p className="text-xs text-gray-600 mb-4">Available team members</p>
            
            <div className="space-y-3">
              {staffAvailability.map((staff, index) => {
                // Count appointments for this staff member
                const appointmentCount = sampleAppointments.filter(block => block.staff_id === staff.staff_id).length;
                return (
                  <div key={staff.staff_id} className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: staff.color }}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {staff.staff_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {appointmentCount} appointments
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto">
            <div className="p-4">
              {/* Day Headers */}
              <div className="grid grid-cols-8 gap-1 mb-2">
                <div className="text-sm font-medium text-gray-500 p-2">Time</div>
                {weekDays.map((day, index) => (
                  <div key={index} className="text-sm font-medium text-gray-500 text-center p-2">
                    <div className={`${day.isToday ? 'text-blue-600 font-semibold' : ''}`}>
                      {day.dayName} {day.dayNumber}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time Slots Grid */}
              <div className="space-y-0">
                {timeSlots.map((slot) => (
                  <div key={slot.hour} className="grid grid-cols-8 gap-1 h-12 border-b border-gray-100">
                    {/* Time Label */}
                    <div className="flex items-center text-sm text-gray-500 p-2 border-r border-gray-200">
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
                          id={`slot-${dayIndex}-${slot.hour}`}
                          className="border border-gray-200 bg-white hover:bg-gray-50 transition-colors relative min-h-[48px] p-1"
                        >
                          <div className="h-full">
                            {slotAppointments.map((timeBlock) => (
                              <div
                                key={timeBlock.id}
                                className="bg-gray-100 border border-gray-200 rounded p-2 mb-1 text-xs cursor-move hover:bg-gray-200 transition-colors"
                                style={{ 
                                  backgroundColor: timeBlock.color ? `${timeBlock.color}15` : '#F3F4F6',
                                  borderColor: timeBlock.color || '#D1D5DB'
                                }}
                              >
                                <div className="font-medium text-gray-800 truncate">
                                  {(timeBlock as any).clientName} - {(timeBlock as any).serviceName}
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
                {todaysSchedule.length > 0 ? (
                  todaysSchedule.map((block) => (
                    <div key={block.id} className="flex items-center gap-3 text-sm">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: block.color || '#6B7280' }}
                      />
                      <span className="text-gray-600">
                        {formatTime(block.start_time, '12h')} - {(block as any).clientName} ({(block as any).serviceName})
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No appointments today</p>
                )}
              </div>
            </div>

            {/* Resource Utilization */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Resource Utilization</h3>
              <div className="space-y-2">
                {resourceUtilization.map((staff) => (
                  <div key={staff.staff_id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{staff.staff_name}</span>
                    <span className="font-medium">{staff.utilization}%</span>
                  </div>
                ))}
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

      {/* Modals */}
      {showTimeBlockEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <TimeBlockEditor
            staffMembers={staffMembers}
            existingTimeBlocks={timeBlocks}
            initialData={editingTimeBlock || undefined}
            onSave={handleTimeBlockSave}
            onCancel={() => {
              setShowTimeBlockEditor(false);
              setEditingTimeBlock(null);
            }}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
};
