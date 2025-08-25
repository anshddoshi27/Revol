
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, User, Calendar, Settings, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const TeamManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const teamMembers = [
    {
      id: 1,
      name: "Maria Garcia",
      role: "Senior Massage Therapist",
      email: "maria@luxespa.com",
      phone: "(555) 123-4567",
      specialties: ["Swedish Massage", "Deep Tissue", "Hot Stone"],
      schedule: "Mon-Fri, 9am-6pm",
      status: "active",
      permissions: "staff"
    },
    {
      id: 2,
      name: "David Kim",
      role: "Massage Therapist",
      email: "david@luxespa.com",
      phone: "(555) 987-6543",
      specialties: ["Deep Tissue", "Sports Massage"],
      schedule: "Tue-Sat, 10am-7pm",
      status: "active",
      permissions: "staff"
    },
    {
      id: 3,
      name: "Lisa Wang",
      role: "Esthetician",
      email: "lisa@luxespa.com",
      phone: "(555) 456-7890",
      specialties: ["European Facial", "Chemical Peels"],
      schedule: "Wed-Sun, 11am-8pm",
      status: "active",
      permissions: "staff"
    },
    {
      id: 4,
      name: "Sarah Johnson",
      role: "Manager",
      email: "sarah@luxespa.com",
      phone: "(555) 321-0987",
      specialties: ["Management", "Customer Service"],
      schedule: "Mon-Fri, 8am-5pm",
      status: "active",
      permissions: "admin"
    }
  ];

  const scheduleTemplates = [
    { name: "Full Time", hours: "Mon-Fri, 9am-6pm" },
    { name: "Part Time", hours: "Tue-Thu, 10am-4pm" },
    { name: "Weekend", hours: "Sat-Sun, 10am-6pm" },
    { name: "Evening", hours: "Mon-Fri, 2pm-10pm" }
  ];

  const getRoleColor = (role: string) => {
    if (role.includes("Manager")) return "default";
    if (role.includes("Senior")) return "secondary";
    return "outline";
  };

  const getPermissionColor = (permission: string) => {
    switch (permission) {
      case "admin": return "default";
      case "staff": return "secondary";
      case "viewer": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Team Management</h2>
          <p className="text-muted-foreground">Manage staff schedules, roles, and permissions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Roles & Permissions
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Team Member
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">Active staff</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Staff</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Working today</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilization</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78%</div>
            <p className="text-xs text-muted-foreground">Average booking rate</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
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
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Specialties</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="font-medium">{member.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleColor(member.role)}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm">{member.email}</div>
                      <div className="text-sm text-muted-foreground">{member.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.specialties.map((specialty, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{member.schedule}</TableCell>
                  <TableCell>
                    <Badge variant={getPermissionColor(member.permissions)}>
                      {member.permissions}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{member.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">Edit</Button>
                      <Button variant="outline" size="sm">Schedule</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Schedule Templates</CardTitle>
            <CardDescription>Quick setup for common work schedules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scheduleTemplates.map((template, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{template.name}</div>
                  <div className="text-sm text-muted-foreground">{template.hours}</div>
                </div>
                <Button variant="outline" size="sm">Apply</Button>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Permission Levels</CardTitle>
            <CardDescription>Define access controls for your team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Owner</div>
                  <div className="text-sm text-muted-foreground">Full access to all features</div>
                </div>
                <Badge variant="default">1 user</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Admin</div>
                  <div className="text-sm text-muted-foreground">Manage bookings, staff, and settings</div>
                </div>
                <Badge variant="secondary">1 user</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Staff</div>
                  <div className="text-sm text-muted-foreground">View schedule and manage own bookings</div>
                </div>
                <Badge variant="outline">3 users</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Viewer</div>
                  <div className="text-sm text-muted-foreground">Read-only access to reports</div>
                </div>
                <Badge variant="outline">0 users</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
