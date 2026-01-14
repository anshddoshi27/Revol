
import { useState } from "react";
import { Calendar, Users, Settings, BarChart3, CreditCard, Gift, Bell, Palette, FileText, Clock, Scissors } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AvailabilityScheduler } from "./modules/AvailabilityScheduler";
import { ServicesManager } from "./modules/ServicesManager";
import { BookingTable } from "./modules/BookingTable";
import { VisualCalendar } from "./modules/VisualCalendar";
import { AnalyticsDashboard } from "./modules/AnalyticsDashboard";
import { ClientCRM } from "./modules/ClientCRM";
import { PromoEngine } from "./modules/PromoEngine";
import { GiftCardManager } from "./modules/GiftCardManager";
import { NotificationSettings } from "./modules/NotificationSettings";
import { TeamManagement } from "./modules/TeamManagement";
import { BrandingControls } from "./modules/BrandingControls";
import { FinancialReports } from "./modules/FinancialReports";
import { AdminClientView } from "./modules/AdminClientView";

const adminModules = [
  { id: "overview", title: "Overview", icon: BarChart3 },
  { id: "availability", title: "Availability Scheduler", icon: Clock },
  { id: "services", title: "Services & Pricing", icon: Scissors },
  { id: "bookings", title: "Booking Management", icon: Calendar },
  { id: "visual-calendar", title: "Visual Calendar", icon: Calendar },
  { id: "analytics", title: "Analytics", icon: BarChart3 },
  { id: "crm", title: "Client CRM", icon: Users },
  { id: "promos", title: "Promotions", icon: Gift },
  { id: "gift-cards", title: "Gift Cards", icon: CreditCard },
  { id: "notifications", title: "Notifications", icon: Bell },
  { id: "team", title: "Team Management", icon: Users },
  { id: "branding", title: "Branding", icon: Palette },
  { id: "financials", title: "Financial Reports", icon: FileText },
  { id: "admin-view", title: "Admin Client View", icon: Settings },
];

interface AdminDashboardProps {
  tenantName: string;
}

export const AdminDashboard = ({ tenantName }: AdminDashboardProps) => {
  const [activeModule, setActiveModule] = useState("overview");

  const renderModule = () => {
    switch (activeModule) {
      case "availability":
        return <AvailabilityScheduler />;
      case "services":
        return <ServicesManager />;
      case "bookings":
        return <BookingTable />;
      case "visual-calendar":
        return <VisualCalendar />;
      case "analytics":
        return <AnalyticsDashboard />;
      case "crm":
        return <ClientCRM />;
      case "promos":
        return <PromoEngine />;
      case "gift-cards":
        return <GiftCardManager />;
      case "notifications":
        return <NotificationSettings />;
      case "team":
        return <TeamManagement />;
      case "branding":
        return <BrandingControls />;
      case "financials":
        return <FinancialReports />;
      case "admin-view":
        return <AdminClientView />;
      default:
        return <AdminOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <Sidebar className="w-64">
            <SidebarContent>
              <div className="p-4 border-b">
                <h1 className="text-xl font-bold">{tenantName} Admin</h1>
                <p className="text-sm text-muted-foreground">Business Management</p>
              </div>
              
              <SidebarGroup>
                <SidebarGroupLabel>Dashboard Modules</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminModules.map((module) => (
                      <SidebarMenuItem key={module.id}>
                        <SidebarMenuButton
                          onClick={() => setActiveModule(module.id)}
                          isActive={activeModule === module.id}
                        >
                          <module.icon className="h-4 w-4" />
                          <span>{module.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <SidebarInset className="flex-1">
            <main className="p-6">
              {renderModule()}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
};

const AdminOverview = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Dashboard Overview</h2>
        <p className="text-muted-foreground">Manage your business operations from one central location</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+2 from yesterday</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Today</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$1,234</div>
            <p className="text-xs text-muted-foreground">+15% from yesterday</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">456</div>
            <p className="text-xs text-muted-foreground">+12 this week</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No-Show Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3.2%</div>
            <p className="text-xs text-muted-foreground">-1.1% from last month</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
