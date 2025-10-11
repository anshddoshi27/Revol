
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, MessageSquare, Settings } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const NotificationSettings = () => {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  
  const notificationTypes = [
    {
      name: "Booking Confirmations",
      email: true,
      sms: true,
      template: "booking_confirmation",
      description: "Sent when a booking is confirmed"
    },
    {
      name: "24h Reminders",
      email: true,
      sms: true,
      template: "reminder_24h",
      description: "Sent 24 hours before appointment"
    },
    {
      name: "1h Reminders",
      email: false,
      sms: true,
      template: "reminder_1h",
      description: "Sent 1 hour before appointment"
    },
    {
      name: "No-Show Alerts",
      email: true,
      sms: false,
      template: "no_show",
      description: "Sent when client doesn't show up"
    },
    {
      name: "Feedback Requests",
      email: true,
      sms: false,
      template: "feedback_request",
      description: "Sent after service completion"
    }
  ];

  const templates = [
    {
      id: 1,
      name: "Booking Confirmation",
      type: "Email",
      subject: "Your appointment is confirmed at {business_name}",
      lastModified: "2024-01-10",
      status: "active"
    },
    {
      id: 2,
      name: "24h Reminder",
      type: "SMS",
      subject: "Reminder: {service} tomorrow at {time}",
      lastModified: "2024-01-08",
      status: "active"
    },
    {
      id: 3,
      name: "No Show Alert",
      type: "Email",
      subject: "We missed you at your appointment",
      lastModified: "2024-01-05",
      status: "active"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Notification Settings</h2>
          <p className="text-muted-foreground">Configure SMS and email templates and triggers</p>
        </div>
        <Button>
          <Settings className="h-4 w-4 mr-2" />
          Configure Providers
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Notifications</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">Sent this month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SMS Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">856</div>
            <p className="text-xs text-muted-foreground">Sent this month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.5%</div>
            <p className="text-xs text-muted-foreground">Successful delivery</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Notification Types</CardTitle>
            <CardDescription>Configure which notifications to send and how</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notificationTypes.map((notification, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{notification.name}</h4>
                    <p className="text-sm text-muted-foreground">{notification.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Switch checked={notification.email} />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <Switch checked={notification.sms} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider Settings</CardTitle>
            <CardDescription>Configure your email and SMS providers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Email Provider (SendGrid)</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status</span>
                    <Badge variant="default">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">API Key</span>
                    <span className="text-sm text-muted-foreground">SG.****...****</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">From Email</span>
                    <span className="text-sm">noreply@luxespa.com</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">SMS Provider (Twilio)</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status</span>
                    <Badge variant="default">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Phone Number</span>
                    <span className="text-sm">+1 (555) 123-4567</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Credits Remaining</span>
                    <span className="text-sm">2,340</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message Templates</CardTitle>
          <CardDescription>Customize your notification messages</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject/Content</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{template.type}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{template.subject}</TableCell>
                  <TableCell>{template.lastModified}</TableCell>
                  <TableCell>
                    <Badge variant="default">{template.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">Edit</Button>
                      <Button variant="outline" size="sm">Test</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Placeholders</CardTitle>
          <CardDescription>Use these placeholders in your templates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium mb-2">Customer</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div><code>{"{customer_name}"}</code></div>
                <div><code>{"{customer_email}"}</code></div>
                <div><code>{"{customer_phone}"}</code></div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Booking</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div><code>{"{service_name}"}</code></div>
                <div><code>{"{appointment_date}"}</code></div>
                <div><code>{"{appointment_time}"}</code></div>
                <div><code>{"{staff_name}"}</code></div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Business</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div><code>{"{business_name}"}</code></div>
                <div><code>{"{business_address}"}</code></div>
                <div><code>{"{business_phone}"}</code></div>
                <div><code>{"{cancellation_link}"}</code></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
