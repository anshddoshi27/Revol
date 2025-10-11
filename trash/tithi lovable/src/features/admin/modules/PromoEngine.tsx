
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Gift, Percent, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const PromoEngine = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const promotions = [
    {
      id: 1,
      name: "New Client Special",
      type: "Percentage",
      value: 20,
      code: "WELCOME20",
      validUntil: "2024-12-31",
      usageCount: 45,
      usageLimit: 100,
      status: "active"
    },
    {
      id: 2,
      name: "Loyalty Reward",
      type: "Fixed Amount",
      value: 25,
      code: "LOYAL25",
      validUntil: "2024-06-30",
      usageCount: 12,
      usageLimit: 50,
      status: "active"
    },
    {
      id: 3,
      name: "Holiday Special",
      type: "Percentage",
      value: 15,
      code: "HOLIDAY15",
      validUntil: "2024-01-31",
      usageCount: 89,
      usageLimit: 200,
      status: "expired"
    }
  ];

  const referrals = [
    { id: 1, referrer: "Sarah Johnson", referee: "Emma Smith", reward: "$15", status: "completed" },
    { id: 2, referrer: "Michael Chen", referee: "David Park", reward: "$15", status: "pending" },
    { id: 3, referrer: "Emily Davis", referee: "Lisa Brown", reward: "$15", status: "completed" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "expired": return "secondary";
      case "completed": return "default";
      case "pending": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Promo Engine</h2>
          <p className="text-muted-foreground">Manage coupons, discounts, and referral programs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Gift className="h-4 w-4 mr-2" />
            Create Referral
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Promotion
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Promotions</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Redemptions</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">146</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referral Revenue</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$450</div>
            <p className="text-xs text-muted-foreground">From referrals</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Discount</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">17.5%</div>
            <p className="text-xs text-muted-foreground">Per promotion</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Promotions</CardTitle>
            <CardDescription>Manage your discount codes and offers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search promotions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions.map((promo) => (
                    <TableRow key={promo.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{promo.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Expires: {promo.validUntil}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-sm">
                          {promo.code}
                        </code>
                      </TableCell>
                      <TableCell>
                        {promo.type === "Percentage" ? `${promo.value}%` : `$${promo.value}`}
                      </TableCell>
                      <TableCell>
                        {promo.usageCount}/{promo.usageLimit}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(promo.status)}>
                          {promo.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referral Program</CardTitle>
            <CardDescription>Track customer referrals and rewards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Referral Settings</h4>
                <div className="space-y-2 text-sm">
                  <div>Referrer Reward: <span className="font-medium">$15 credit</span></div>
                  <div>Referee Discount: <span className="font-medium">20% off first visit</span></div>
                  <div>Min. Purchase: <span className="font-medium">$50</span></div>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referrer</TableHead>
                    <TableHead>Referee</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell className="font-medium">{referral.referrer}</TableCell>
                      <TableCell>{referral.referee}</TableCell>
                      <TableCell>{referral.reward}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(referral.status)}>
                          {referral.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promotion Performance</CardTitle>
          <CardDescription>Analytics for your promotional campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Most Popular</h4>
              <div className="text-2xl font-bold">WELCOME20</div>
              <p className="text-sm text-muted-foreground">45 redemptions</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Highest Conversion</h4>
              <div className="text-2xl font-bold">LOYAL25</div>
              <p className="text-sm text-muted-foreground">85% conversion rate</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Total Savings Given</h4>
              <div className="text-2xl font-bold">$2,340</div>
              <p className="text-sm text-muted-foreground">This month</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
