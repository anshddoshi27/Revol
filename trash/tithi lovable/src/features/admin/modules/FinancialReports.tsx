
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer } from "recharts";
import { DollarSign, TrendingUp, CreditCard, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const FinancialReports = () => {
  const monthlyRevenue = [
    { month: "Jan", revenue: 4200, expenses: 2800, profit: 1400 },
    { month: "Feb", revenue: 3800, expenses: 2600, profit: 1200 },
    { month: "Mar", revenue: 5200, expenses: 3200, profit: 2000 },
    { month: "Apr", revenue: 4800, expenses: 2900, profit: 1900 },
    { month: "May", revenue: 6200, expenses: 3500, profit: 2700 },
    { month: "Jun", revenue: 5800, expenses: 3300, profit: 2500 },
  ];

  const paymentMethods = [
    { method: "Credit Card", amount: 18500, percentage: 65 },
    { method: "Cash", amount: 7200, percentage: 25 },
    { method: "Gift Card", amount: 2100, percentage: 7 },
    { method: "Other", amount: 900, percentage: 3 }
  ];

  const chartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--primary))" },
    expenses: { label: "Expenses", color: "hsl(var(--secondary))" },
    profit: { label: "Profit", color: "hsl(var(--chart-3))" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Financial Reports</h2>
          <p className="text-muted-foreground">Track revenue, expenses, and Stripe payouts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline">View Tax Reports</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$5,800</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +20.8% from last month
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2,500</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +15.2% from last month
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operating Expenses</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$3,300</div>
            <p className="text-xs text-muted-foreground">Including Tithi subscription</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">43.1%</div>
            <p className="text-xs text-muted-foreground">Above industry average</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue & Profit Trend</CardTitle>
            <CardDescription>Monthly financial performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" />
                  <Bar dataKey="profit" fill="var(--color-profit)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Revenue breakdown by payment type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {paymentMethods.map((method, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-primary rounded-full" style={{ opacity: 1 - (index * 0.2) }}></div>
                    <span className="font-medium">{method.method}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">${method.amount.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">{method.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Stripe Payouts</CardTitle>
            <CardDescription>Recent payment transfers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">$1,234.56</div>
                <div className="text-sm text-muted-foreground">Jan 15, 2024</div>
              </div>
              <Badge variant="default">Paid</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">$987.43</div>
                <div className="text-sm text-muted-foreground">Jan 12, 2024</div>
              </div>
              <Badge variant="default">Paid</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <div className="font-medium">$765.21</div>
                <div className="text-sm text-muted-foreground">Jan 10, 2024</div>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Subscription Costs</CardTitle>
            <CardDescription>Monthly platform fees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Tithi Platform</span>
              <span className="font-medium">$11.99/month</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Stripe Processing</span>
              <span className="font-medium">2.9% + $0.30</span>
            </div>
            <div className="flex items-center justify-between">
              <span>SMS (Twilio)</span>
              <span className="font-medium">$0.05/message</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="font-medium">Total This Month</span>
              <span className="font-medium">$89.47</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Tax Information</CardTitle>
            <CardDescription>Quarterly summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Q1 2024 Revenue</span>
              <span className="font-medium">$13,200</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Deductible Expenses</span>
              <span className="font-medium">$8,200</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Taxable Income</span>
              <span className="font-medium">$5,000</span>
            </div>
            <Button variant="outline" className="w-full mt-4">
              Download 1099 Form
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
