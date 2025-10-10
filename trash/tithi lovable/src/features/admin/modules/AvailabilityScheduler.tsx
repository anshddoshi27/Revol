
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Plus, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const AvailabilityScheduler = () => {
  const [selectedDay, setSelectedDay] = useState("monday");
  
  const weekDays = [
    { id: "monday", label: "Monday", hours: "10:00 AM - 11:00 PM" },
    { id: "tuesday", label: "Tuesday", hours: "10:00 AM - 11:00 PM" },
    { id: "wednesday", label: "Wednesday", hours: "10:00 AM - 11:00 PM" },
    { id: "thursday", label: "Thursday", hours: "10:00 AM - 11:00 PM" },
    { id: "friday", label: "Friday", hours: "10:00 AM - 11:00 PM" },
    { id: "saturday", label: "Saturday", hours: "9:00 AM - 10:00 PM" },
    { id: "sunday", label: "Sunday", hours: "Closed" },
  ];

  const timeSlots = Array.from({ length: 52 }, (_, i) => {
    const hour = Math.floor(i / 4) + 10;
    const minute = (i % 4) * 15;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Availability Scheduler</h2>
          <p className="text-muted-foreground">Set your business hours and manage time slots</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Sync Google Calendar
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Exception
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Schedule</CardTitle>
            <CardDescription>Configure your standard operating hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {weekDays.map((day) => (
              <div
                key={day.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedDay === day.id ? "bg-primary/10 border-primary" : "hover:bg-muted"
                }`}
                onClick={() => setSelectedDay(day.id)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{day.label}</span>
                  <Badge variant={day.hours === "Closed" ? "secondary" : "default"}>
                    {day.hours}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Slot Management - {weekDays.find(d => d.id === selectedDay)?.label}
            </CardTitle>
            <CardDescription>Drag to select available time slots (15-minute intervals)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-8 gap-1 max-h-96 overflow-y-auto">
              {timeSlots.map((time) => (
                <Button
                  key={time}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs hover:bg-primary hover:text-primary-foreground"
                >
                  {time}
                </Button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-primary rounded"></div>
                Available
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-destructive rounded"></div>
                Blocked
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-muted border rounded"></div>
                Unavailable
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Exceptions</CardTitle>
          <CardDescription>Holidays, special hours, and one-time schedule changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <span className="font-medium">Christmas Day</span>
                <span className="text-sm text-muted-foreground ml-2">Dec 25, 2024 - Closed</span>
              </div>
              <Button variant="outline" size="sm">Edit</Button>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <span className="font-medium">New Year's Eve</span>
                <span className="text-sm text-muted-foreground ml-2">Dec 31, 2024 - 10:00 AM - 6:00 PM</span>
              </div>
              <Button variant="outline" size="sm">Edit</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
