/**
 * AvailabilityCalendar Component
 * 
 * Main calendar component for managing staff availability with drag-drop functionality.
 * Provides visual calendar interface with time blocks, staff management, and scheduling.
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
  DragOverEvent,
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
  Copy,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Coffee,
} from 'lucide-react';
import { TimeBlockEditor } from './TimeBlockEditor';
import { RecurringPatternEditor } from './RecurringPatternEditor';
import type {
  TimeBlock,
  StaffAvailability,
  CalendarView,
} from '../../api/types/availability';
import type { StaffMember } from '../../api/types/onboarding';
import {
  getDayName,
  formatTime,
  calculateDuration,
  sortTimeBlocksByStartTime,
} from '../../utils/availabilityHelpers';
import { DAYS_OF_WEEK_SHORT } from '../../api/types/availability';

interface AvailabilityCalendarProps {
  staffMembers: StaffMember[];
  timeBlocks: TimeBlock[];
  onTimeBlockAdd: (timeBlock: TimeBlock) => void;
  onTimeBlockUpdate: (id: string, updates: Partial<TimeBlock>) => void;
  onTimeBlockDelete: (id: string) => void;
  onCopyWeek: (sourceWeekStart: Date, targetWeekStart: Date) => void;
  onError?: (error: Error) => void;
  className?: string;
}

interface TimeBlockItemProps {
  timeBlock: TimeBlock;
  onEdit: (timeBlock: TimeBlock) => void;
  onDelete: (id: string) => void;
  onDuplicate: (timeBlock: TimeBlock, targetDay?: number) => void;
}

const TimeBlockItem: React.FC<TimeBlockItemProps> = ({
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
          <span className="text-xs text-gray-500">
            {timeBlock.staff_role}
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

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
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
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showTimeBlockEditor, setShowTimeBlockEditor] = useState(false);
  const [showRecurringEditor, setShowRecurringEditor] = useState(false);
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

  // Memoized calendar weeks
  const calendarWeeks = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());
    
    const endDate = new Date(lastDay);
    endDate.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    
    const weeks = [];
    let currentWeekStart = new Date(startDate);
    
    while (currentWeekStart <= endDate) {
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(currentWeekStart.getDate() + i);
        weekDays.push({
          date: dayDate,
          day_of_week: dayDate.getDay(),
          is_today: dayDate.toDateString() === new Date().toDateString(),
          is_past: dayDate < new Date(),
          time_blocks: timeBlocks.filter(block => block.day_of_week === dayDate.getDay()),
        });
      }
      
      weeks.push({
        start_date: new Date(currentWeekStart),
        end_date: new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
        days: weekDays,
      });
      
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
    
    return weeks;
  }, [currentDate, timeBlocks]);

  // Navigation
  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
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

  const handleDuplicateTimeBlock = (timeBlock: TimeBlock, targetDay?: number) => {
    const newTimeBlock: TimeBlock = {
      ...timeBlock,
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      day_of_week: targetDay ?? timeBlock.day_of_week,
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

    // Handle dropping on a day
    if (over.id.toString().startsWith('day-')) {
      const dayOfWeek = parseInt(over.id.toString().split('-')[1]);
      if (dayOfWeek !== timeBlock.day_of_week) {
        onTimeBlockUpdate(timeBlock.id, { day_of_week: dayOfWeek });
      }
    }
  };

  const handleCopyWeek = () => {
    const currentWeekStart = new Date(currentDate);
    currentWeekStart.setDate(currentDate.getDate() - currentDate.getDay());
    
    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(currentWeekStart.getDate() + 7);
    
    onCopyWeek(currentWeekStart, nextWeekStart);
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              Availability Calendar
            </h2>
            <div className="text-sm text-gray-500">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          
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
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => setShowRecurringEditor(true)}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Recurring Pattern
          </button>
          <button
            onClick={handleCopyWeek}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Week
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="p-6">
          {/* Day Headers */}
          <div className="grid grid-cols-8 gap-4 mb-4">
            <div className="text-sm font-medium text-gray-500">Staff</div>
            {DAYS_OF_WEEK_SHORT.map((day, index) => (
              <div key={index} className="text-sm font-medium text-gray-500 text-center">
                {day}
              </div>
            ))}
          </div>

          {/* Staff Rows */}
          {staffAvailability.map((staff) => (
            <div key={staff.staff_id} className="grid grid-cols-8 gap-4 mb-4">
              {/* Staff Info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: staff.color }}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {staff.staff_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {staff.staff_role}
                  </div>
                  <div className="text-xs text-blue-600">
                    {staff.total_hours_per_week.toFixed(1)}h/week
                  </div>
                </div>
              </div>

              {/* Day Columns */}
              {DAYS_OF_WEEK_SHORT.map((_, dayIndex) => (
                <div
                  key={dayIndex}
                  id={`day-${dayIndex}`}
                  className="min-h-[120px] p-2 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <SortableContext
                    items={timeBlocks.filter(block => 
                      block.staff_id === staff.staff_id && block.day_of_week === dayIndex
                    ).map(block => block.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {timeBlocks
                        .filter(block => 
                          block.staff_id === staff.staff_id && block.day_of_week === dayIndex
                        )
                        .map((timeBlock) => (
                          <TimeBlockItem
                            key={timeBlock.id}
                            timeBlock={timeBlock}
                            onEdit={handleEditTimeBlock}
                            onDelete={handleDeleteTimeBlock}
                            onDuplicate={handleDuplicateTimeBlock}
                          />
                        ))}
                    </div>
                  </SortableContext>

                  {/* Add Time Block Button */}
                  <button
                    onClick={() => handleAddTimeBlock(staff.staff_id, dayIndex)}
                    className="w-full mt-2 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-xs">Add</span>
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedTimeBlock ? (
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg opacity-90">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: draggedTimeBlock.color || '#6B7280' }}
                />
                <span className="text-sm font-medium">
                  {draggedTimeBlock.staff_name}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {formatTime(draggedTimeBlock.start_time, '12h')} - {formatTime(draggedTimeBlock.end_time, '12h')}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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

      {showRecurringEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <RecurringPatternEditor
            staffMembers={staffMembers}
            onSave={(pattern) => {
              // Convert pattern to time block
              const timeBlock: TimeBlock = {
                id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                staff_id: pattern.staff_id,
                day_of_week: pattern.day_of_week,
                start_time: pattern.start_time,
                end_time: pattern.end_time,
                break_start: pattern.break_start,
                break_end: pattern.break_end,
                is_recurring: true,
                is_active: true,
                color: staffMembers.find(s => s.id === pattern.staff_id)?.color,
                staff_name: staffMembers.find(s => s.id === pattern.staff_id)?.name,
                staff_role: staffMembers.find(s => s.id === pattern.staff_id)?.role,
              };
              onTimeBlockAdd(timeBlock);
              setShowRecurringEditor(false);
            }}
            onCancel={() => setShowRecurringEditor(false)}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
};
