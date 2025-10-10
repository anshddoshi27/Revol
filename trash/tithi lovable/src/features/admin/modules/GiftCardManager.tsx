
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Gift, DollarSign, CreditCard } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const GiftCardManager = () => {
  const [searchTerm, setSearchTerm] = useState("");
  
  const giftCards = [
    {
      id: "GC001",
      code: "GIFT-ABCD-1234",
      amount: 100.00,
      balance: 100.00,
      purchaser: "John Smith",
      recipient: "Jane Doe",
      purchaseDate: "2024-01-10",
      expiryDate: "2025-01-10",
      status: "active"
    },
    {
      id: "GC002",
      code: "GIFT-EFGH-5678",
      amount: 150.00,
      balance: 75.00,
      purchaser: "Sarah Johnson",
      recipient: "Maria Garcia",
      purchaseDate: "2024-01-08",
      expiryDate: "2025-01-08",
      status: "active"
    },
    {
      id: "GC003",
      code: "GIFT-IJKL-9012",
      amount: 200.00,
      balance: 0.00,
      purchaser: "Michael Chen",
      recipient: "David Kim",
      purchaseDate: "2023-12-15",
      expiryDate: "2024-12-15",
      status: "redeemed"
    },
    {
      id: "GC004",
      code: "GIFT-MNOP-3456",
      amount: 75.00,
      balance: 75.00,
      purchaser: "Emily Davis",
      recipient: "Lisa Wang",
      purchaseDate: "2023-11-20",
      expiryDate: "2024-11-20",
      status: "expired"
    }
  ];

  const recentTransactions = [
    { id: 1, cardCode: "GIFT-ABCD-1234", amount: 0, type: "purchase", date: "2024-01-10" },
    { id: 2, cardCode: "GIFT-EFGH-5678", amount: -75.00, type: "redemption", date: "2024-01-12" },
    { id: 3, cardCode: "GIFT-IJKL-9012", amount: -50.00, type: "redemption", date: "2024-01-13" },
    { id: 4, cardCode: "GIFT-IJKL-9012", amount: -150.00, type: "redemption", date: "2024-01-14" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "redeemed": return "secondary";
      case "expired": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Gift Card Management</h2>
          <p className="text-muted-foreground">Issue, track, and manage digital gift cards</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Issue Gift Card
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Issued</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$525</div>
            <p className="text-xs text-muted-foreground">4 gift cards</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$175</div>
            <p className="text-xs text-muted-foreground">Available to redeem</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redeemed</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$350</div>
            <p className="text-xs text-muted-foreground">66.7% redemption rate</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">New gift cards</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gift Card Registry</CardTitle>
          <CardDescription>View and manage all issued gift cards</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, purchaser, or recipient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gift Card Code</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Purchaser</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {giftCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {card.code}
                      </code>
                    </TableCell>
                    <TableCell>${card.amount.toFixed(2)}</TableCell>
                    <TableCell className="font-medium">${card.balance.toFixed(2)}</TableCell>
                    <TableCell>{card.purchaser}</TableCell>
                    <TableCell>{card.recipient}</TableCell>
                    <TableCell>{card.expiryDate}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(card.status)}>
                        {card.status}
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
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest gift card activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{transaction.cardCode}</div>
                    <div className="text-sm text-muted-foreground">
                      {transaction.type === "purchase" ? "Gift card issued" : "Redeemed"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${transaction.amount < 0 ? "text-red-600" : "text-green-600"}`}>
                      {transaction.amount === 0 ? "Issued" : `${transaction.amount < 0 ? "-" : "+"}$${Math.abs(transaction.amount).toFixed(2)}`}
                    </div>
                    <div className="text-sm text-muted-foreground">{transaction.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common gift card operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              <Gift className="h-4 w-4 mr-2" />
              Bulk Issue Gift Cards
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <CreditCard className="h-4 w-4 mr-2" />
              Check Balance
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <DollarSign className="h-4 w-4 mr-2" />
              Process Redemption
            </Button>
            
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Gift Card Settings</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>Default Expiry: 1 year from issue</div>
                <div>Minimum Amount: $25</div>
                <div>Maximum Amount: $500</div>
                <div>Transfer Fee: $5</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
