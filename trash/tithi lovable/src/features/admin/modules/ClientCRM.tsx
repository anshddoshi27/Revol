
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, User, Calendar, DollarSign, Star } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const ClientCRM = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const clients = [
    {
      id: 1,
      name: "Sarah Johnson",
      email: "sarah.j@email.com",
      phone: "(555) 123-4567",
      visits: 12,
      totalSpent: 1080.50,
      lastVisit: "2024-01-10",
      loyaltyTier: "Gold",
      firstTime: false,
      notes: "Prefers deep pressure massage, allergic to lavender"
    },
    {
      id: 2,
      name: "Michael Chen",
      email: "m.chen@email.com",
      phone: "(555) 987-6543",
      visits: 3,
      totalSpent: 389.97,
      lastVisit: "2024-01-08",
      loyaltyTier: "Bronze",
      firstTime: false,
      notes: "Regular customer, books monthly deep tissue"
    },
    {
      id: 3,
      name: "Emily Davis",
      email: "emily.davis@email.com",
      phone: "(555) 456-7890",
      visits: 1,
      totalSpent: 95.99,
      lastVisit: "2024-01-15",
      loyaltyTier: "New",
      firstTime: true,
      notes: "First time visitor, interested in facial treatments"
    },
    {
      id: 4,
      name: "Robert Wilson",
      email: "r.wilson@email.com",
      phone: "(555) 321-0987",
      visits: 8,
      totalSpent: 720.00,
      lastVisit: "2024-01-12",
      loyaltyTier: "Silver",
      firstTime: false,
      notes: "Prefers evening appointments, frequent no-shows"
    }
  ];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Gold": return "default";
      case "Silver": return "secondary";
      case "Bronze": return "outline";
      case "New": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Client CRM</h2>
          <p className="text-muted-foreground">Manage customer relationships and loyalty tracking</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">456</div>
            <p className="text-xs text-muted-foreground">+12 this month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repeat Customers</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">68%</div>
            <p className="text-xs text-muted-foreground">Return rate</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Lifetime Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$545</div>
            <p className="text-xs text-muted-foreground">Per customer</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">New clients</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
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
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Loyalty Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{client.name}</div>
                      <div className="text-sm text-muted-foreground">{client.notes}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm">{client.email}</div>
                      <div className="text-sm text-muted-foreground">{client.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>{client.visits}</TableCell>
                  <TableCell>${client.totalSpent.toFixed(2)}</TableCell>
                  <TableCell>{client.lastVisit}</TableCell>
                  <TableCell>
                    <Badge variant={getTierColor(client.loyaltyTier)}>
                      {client.loyaltyTier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.firstTime ? "secondary" : "default"}>
                      {client.firstTime ? "First Time" : "Returning"}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Loyalty Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Gold (10+ visits)</span>
              </div>
              <span className="font-medium">15%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span>Silver (5-9 visits)</span>
              </div>
              <span className="font-medium">25%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-600 rounded-full"></div>
                <span>Bronze (2-4 visits)</span>
              </div>
              <span className="font-medium">35%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>New (1 visit)</span>
              </div>
              <span className="font-medium">25%</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Sarah Johnson</span> booked Swedish Massage
              <div className="text-muted-foreground text-xs">2 hours ago</div>
            </div>
            <div className="text-sm">
              <span className="font-medium">Michael Chen</span> completed Deep Tissue
              <div className="text-muted-foreground text-xs">1 day ago</div>
            </div>
            <div className="text-sm">
              <span className="font-medium">Emily Davis</span> left 5-star review
              <div className="text-muted-foreground text-xs">2 days ago</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              Send Birthday Offers
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Follow Up No-Shows
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Export Client List
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
