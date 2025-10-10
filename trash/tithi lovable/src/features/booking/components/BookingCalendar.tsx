import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Clock, Calendar, User } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, isToday } from "date-fns";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
  price?: number;
}

interface BookingCalendarProps {
  service: Service;
  onTimeSelect: (date: Date, time: string) => void;
  onBack: () => void;
}

const timeSlots: TimeSlot[] = [
  { time: "9:00 AM", available: false },
  { time: "9:30 AM", available: true },
  { time: "10:00 AM", available: true },
  { time: "10:30 AM", available: false },
  { time: "11:00 AM", available: true },
  { time: "11:30 AM", available: true },
  { time: "12:00 PM", available: false },
  { time: "12:30 PM", available: true },
  { time: "1:00 PM", available: false },
  { time: "1:30 PM", available: true },
  { time: "2:00 PM", available: true },
  { time: "2:30 PM", available: true },
  { time: "3:00 PM", available: false },
  { time: "3:30 PM", available: true },
  { time: "4:00 PM", available: true },
  { time: "4:30 PM", available: true },
  { time: "5:00 PM", available: false },
  { time: "5:30 PM", available: true }
];

export function BookingCalendar({ service, onTimeSelect, onBack }: BookingCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date()));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const handlePrevWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    onTimeSelect(selectedDate, time);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="touch-target">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-display font-bold">Select Date & Time</h1>
              <p className="text-muted-foreground">Choose when you'd like your appointment</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Service Summary - Sticky on Desktop */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <Card className="card-premium p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <span className="text-xl font-bold text-primary-foreground">
                        {service.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{service.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {service.duration}min
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          1 person
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total</span>
                      <span className="text-2xl font-bold">${service.price}</span>
                    </div>
                  </div>

                  {selectedDate && selectedTime && (
                    <div className="pt-4 border-t border-border space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span>{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>{selectedTime}</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* Calendar & Time Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Week Navigation */}
            <Card className="card-premium p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-semibold">Select Date</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrevWeek} className="touch-target">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[120px] text-center">
                    {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
                  </span>
                  <Button variant="outline" size="sm" onClick={handleNextWeek} className="touch-target">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, index) => (
                  <div
                    key={index}
                    className={`p-3 text-center rounded-lg cursor-pointer transition-all duration-200 touch-target ${
                      isSameDay(day, selectedDate)
                        ? 'bg-primary text-primary-foreground shadow-purple'
                        : 'hover:bg-accent'
                    } ${isToday(day) ? 'ring-2 ring-primary ring-opacity-50' : ''}`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="text-xs text-muted-foreground mb-1">
                      {format(day, "EEE")}
                    </div>
                    <div className="text-lg font-semibold">
                      {format(day, "d")}
                    </div>
                    {isToday(day) && (
                      <Badge variant="outline" className="text-xs mt-1">
                        Today
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Time Slots */}
            <Card className="card-premium p-6">
              <h2 className="text-xl font-display font-semibold mb-6">Available Times</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {timeSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={selectedTime === slot.time ? "default" : "outline"}
                      disabled={!slot.available}
                      onClick={() => handleTimeSelect(slot.time)}
                      className={`touch-target h-12 ${
                        selectedTime === slot.time ? 'btn-primary' : ''
                      } ${!slot.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded"></div>
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border border-border rounded"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-muted rounded"></div>
                    <span>Unavailable</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Floating Continue Button for Mobile */}
      {selectedDate && selectedTime && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border lg:hidden">
          <Button 
            onClick={() => onTimeSelect(selectedDate, selectedTime)} 
            className="w-full btn-primary touch-target"
          >
            Continue to Checkout <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}