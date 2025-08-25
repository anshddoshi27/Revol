
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, Calendar, Clock, User } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const BookingTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const bookings = [
    {
      id: "BK001",
      client: "Sarah Johnson",
      service: "Swedish Massage",
      date: "2024-01-15",
      time: "10:00 AM",
      duration: 60,
      price: 89.99,
      status: "confirmed",
      staff: "Maria Garcia"
    },
    {
      id: "BK002",
      client: "Michael Chen",
      service: "Deep Tissue Massage",
      date: "2024-01-15",
      time: "2:00 PM",
      duration: 90,
      price: 129.99,
      status: "checked-in",
      staff: "David Kim"
    },
    {
      id: "BK003",
      client: "Emily Davis",
      service: "European Facial",
      date: "2024-01-15",
      time: "3:30 PM",
      duration: 75,
      price: 95.99,
      status: "pending",
      staff: "Lisa Wang"
    },
    {
      id: "BK004",
      client: "Robert Wilson",
      service: "Hot Stone Therapy",
      date: "2024-01-15",
      time: "5:00 PM",
      duration: 90,
      price: 149.99,
      status: "no-show",
      staff: "Maria Garcia"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "default";
      case "checked-in": return "secondary";
      case "completed": return "default";
      case "pending": return "outline";
      case "cancelled": return "destructive";
      case "no-show": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Booking Management</h2>
          <p className="text-muted-foreground">View and manage all appointments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookings.length}</div>
            <p className="text-xs text-muted-foreground">4 appointments scheduled</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checked In</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">Currently in service</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$465.97</div>
            <p className="text-xs text-muted-foreground">From 4 bookings</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No-Show Rate</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">25%</div>
            <p className="text-xs text-muted-foreground">1 no-show today</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bookings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{booking.id}</TableCell>
                  <TableCell>{booking.client}</TableCell>
                  <TableCell>{booking.service}</TableCell>
                  <TableCell>
                    <div>
                      <div>{booking.date}</div>
                      <div className="text-sm text-muted-foreground">{booking.time}</div>
                    </div>
                  </TableCell>
                  <TableCell>{booking.staff}</TableCell>
                  <TableCell>{booking.duration} min</TableCell>
                  <TableCell>${booking.price}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(booking.status)}>
                      {booking.status.replace("-", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">View</Button>
                      <Button variant="outline" size="sm">Edit</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
