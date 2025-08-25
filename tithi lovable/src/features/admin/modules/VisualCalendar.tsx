
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";

export const VisualCalendar = () => {
  const timeSlots = Array.from({ length: 13 }, (_, i) => `${i + 10}:00`);
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  
  const appointments = [
    { id: 1, title: "Sarah - Swedish Massage", time: "10:00", duration: 1, staff: "Maria", day: 0 },
    { id: 2, title: "Michael - Deep Tissue", time: "14:00", duration: 1.5, staff: "David", day: 0 },
    { id: 3, title: "Emily - Facial", time: "15:30", duration: 1.25, staff: "Lisa", day: 0 },
    { id: 4, title: "Robert - Hot Stone", time: "17:00", duration: 1.5, staff: "Maria", day: 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Visual Calendar</h2>
          <p className="text-muted-foreground">Drag and drop appointments to manage scheduling</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline">
            Today
          </Button>
          <Button variant="outline">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Card className="w-64">
          <CardHeader>
            <CardTitle>Staff Resources</CardTitle>
            <CardDescription>Available team members</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded border">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Maria Garcia</span>
              <Badge variant="outline" className="ml-auto">4</Badge>
            </div>
            <div className="flex items-center gap-2 p-2 rounded border">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>David Kim</span>
              <Badge variant="outline" className="ml-auto">2</Badge>
            </div>
            <div className="flex items-center gap-2 p-2 rounded border">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span>Lisa Wang</span>
              <Badge variant="outline" className="ml-auto">3</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Week of January 15-21, 2024
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Day</Button>
                <Button variant="outline" size="sm">Week</Button>
                <Button size="sm">Month</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-8 gap-1">
              <div className="p-2"></div>
              {weekDays.map((day, index) => (
                <div key={day} className="p-2 text-center font-medium border-b">
                  <div>{day}</div>
                  <div className="text-sm text-muted-foreground">{15 + index}</div>
                </div>
              ))}
              
              {timeSlots.map((time) => (
                <div key={time} className="contents">
                  <div className="p-2 text-sm text-muted-foreground border-r">{time}</div>
                  {weekDays.map((_, dayIndex) => (
                    <div key={`${time}-${dayIndex}`} className="p-1 border border-muted min-h-16 relative">
                      {dayIndex === 0 && appointments
                        .filter(apt => parseInt(apt.time.split(':')[0]) === parseInt(time.split(':')[0]))
                        .map(apt => (
                          <div
                            key={apt.id}
                            className="absolute inset-1 bg-primary/10 border border-primary rounded p-1 cursor-move hover:bg-primary/20 transition-colors"
                            style={{ height: `${apt.duration * 60 - 8}px` }}
                          >
                            <div className="text-xs font-medium">{apt.title}</div>
                            <div className="text-xs text-muted-foreground">{apt.staff}</div>
                          </div>
                        ))
                      }
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">10:00 AM</span> - Sarah Johnson (Swedish Massage)
            </div>
            <div className="text-sm">
              <span className="font-medium">2:00 PM</span> - Michael Chen (Deep Tissue)
            </div>
            <div className="text-sm">
              <span className="font-medium">3:30 PM</span> - Emily Davis (Facial)
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Resource Utilization</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              Block Time Slot
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Set Recurring Block
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Add Break
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
