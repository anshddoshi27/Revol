
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Users, Calendar, BarChart3, Shield, Bell } from "lucide-react";

export const AdminClientView = () => {
  const adminCapabilities = [
    {
      title: "Booking Management",
      description: "Full access to view, modify, and cancel appointments",
      permissions: ["View all bookings", "Edit appointments", "Cancel bookings", "Add walk-ins"],
      icon: Calendar
    },
    {
      title: "Staff Management", 
      description: "Oversee team schedules and availability",
      permissions: ["View staff schedules", "Modify availability", "Assign staff", "Track performance"],
      icon: Users
    },
    {
      title: "Client Access Control",
      description: "Manage what clients can see and do",
      permissions: ["Control service visibility", "Set booking limits", "Manage promotions", "Override pricing"],
      icon: Shield
    },
    {
      title: "Analytics Dashboard",
      description: "Access to business insights and reports",
      permissions: ["View revenue reports", "Client analytics", "Performance metrics", "Export data"],
      icon: BarChart3
    }
  ];

  const dashboardAccess = [
    { feature: "Availability Scheduler", access: "Full Control", status: "enabled" },
    { feature: "Services & Pricing", access: "Full Control", status: "enabled" },
    { feature: "Booking Management", access: "Full Control", status: "enabled" },
    { feature: "Visual Calendar", access: "Full Control", status: "enabled" },
    { feature: "Analytics Dashboard", access: "View Only", status: "enabled" },
    { feature: "Client CRM", access: "Full Control", status: "enabled" },
    { feature: "Promotions", access: "Full Control", status: "enabled" },
    { feature: "Gift Cards", access: "Limited", status: "enabled" },
    { feature: "Team Management", access: "Limited", status: "enabled" },
    { feature: "Financial Reports", access: "View Only", status: "restricted" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Admin Client View</h2>
          <p className="text-muted-foreground">Configure dashboard access and permissions for business owners</p>
        </div>
        <Button>
          <Settings className="h-4 w-4 mr-2" />
          Configure Permissions
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Admins</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Owner + Manager</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Actions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <p className="text-xs text-muted-foreground">Bookings managed</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7</div>
            <p className="text-xs text-muted-foreground">Pending alerts</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Online</div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Capabilities</CardTitle>
            <CardDescription>What business owners can do through their dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {adminCapabilities.map((capability, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <capability.icon className="h-5 w-5 text-primary mt-1" />
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">{capability.title}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{capability.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {capability.permissions.map((permission, permIndex) => (
                        <Badge key={permIndex} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard Access Control</CardTitle>
            <CardDescription>Configure access levels for each module</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardAccess.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.feature}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={
                        item.access === "Full Control" ? "default" :
                        item.access === "View Only" ? "secondary" : "outline"
                      }
                      className="text-xs"
                    >
                      {item.access}
                    </Badge>
                    <Badge 
                      variant={item.status === "enabled" ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Admin Activity</CardTitle>
          <CardDescription>Latest actions taken by business administrators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">Sarah Johnson (Owner)</div>
                <div className="text-sm text-muted-foreground">Updated service pricing for Swedish Massage</div>
              </div>
              <div className="text-sm text-muted-foreground">2 hours ago</div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">Sarah Johnson (Owner)</div>
                <div className="text-sm text-muted-foreground">Modified staff availability for Maria Garcia</div>
              </div>
              <div className="text-sm text-muted-foreground">4 hours ago</div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">Manager Role</div>
                <div className="text-sm text-muted-foreground">Approved 3 pending gift card redemptions</div>
              </div>
              <div className="text-sm text-muted-foreground">1 day ago</div>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">Sarah Johnson (Owner)</div>
                <div className="text-sm text-muted-foreground">Created new promotion: SUMMER20</div>
              </div>
              <div className="text-sm text-muted-foreground">2 days ago</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Quick Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              Add New Admin User
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Configure Notifications
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Set Business Hours
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Training Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              Admin User Guide
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Video Tutorials
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Best Practices
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              Contact Support
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Report Issue
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Feature Request
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
