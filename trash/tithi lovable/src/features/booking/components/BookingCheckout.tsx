import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, Clock, User, CreditCard, Smartphone, Wallet, Info } from "lucide-react";
import { format } from "date-fns";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface BookingCheckoutProps {
  service: Service;
  selectedDate: Date;
  selectedTime: string;
  onBack: () => void;
  onComplete: () => void;
}

type PaymentMethod = "card" | "apple-pay" | "paypal" | "cash";

export function BookingCheckout({ service, selectedDate, selectedTime, onBack, onComplete }: BookingCheckoutProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [customerInfo, setCustomerInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    firstTime: false
  });
  const [cashAgreement, setCashAgreement] = useState(false);
  const [showCashPolicy, setShowCashPolicy] = useState(false);

  const handleInputChange = (field: string, value: string | boolean) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = () => {
    const basicInfoValid = customerInfo.firstName && customerInfo.lastName && 
                          customerInfo.email && customerInfo.phone;
    
    if (paymentMethod === "cash") {
      return basicInfoValid && cashAgreement;
    }
    
    return basicInfoValid;
  };

  const handleSubmit = () => {
    if (isFormValid()) {
      onComplete();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="touch-target">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-display font-bold">Checkout</h1>
              <p className="text-muted-foreground">Complete your booking</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Booking Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="card-premium p-6">
                <h3 className="font-display font-semibold mb-4">Booking Summary</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <span className="text-xl font-bold text-primary-foreground">
                        {service.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-semibold">{service.name}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {service.duration}min
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          1 person
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-border">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span>{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>{selectedTime}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-lg">
                      <span className="font-semibold">Total</span>
                      <span className="text-2xl font-bold">${service.price}</span>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onBack}
                    className="w-full touch-target"
                  >
                    Change Time
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <Card className="card-premium p-6">
              <h3 className="font-display font-semibold mb-6">Your Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={customerInfo.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    placeholder="Enter your first name"
                    className="touch-target"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={customerInfo.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    placeholder="Enter your last name"
                    className="touch-target"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="your@email.com"
                    className="touch-target"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="(555) 123-4567"
                    className="touch-target"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2 mt-4">
                <Checkbox
                  id="firstTime"
                  checked={customerInfo.firstTime}
                  onCheckedChange={(checked) => handleInputChange("firstTime", checked)}
                />
                <Label htmlFor="firstTime" className="text-sm">
                  This is my first time visiting
                </Label>
              </div>
            </Card>

            {/* Payment Method */}
            <Card className="card-premium p-6">
              <h3 className="font-display font-semibold mb-6">Payment Method</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <Button
                  variant={paymentMethod === "card" ? "default" : "outline"}
                  className={`justify-start h-16 touch-target ${paymentMethod === "card" ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => setPaymentMethod("card")}
                >
                  <CreditCard className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Credit/Debit Card</div>
                    <div className="text-xs opacity-70">Visa, Mastercard, Amex</div>
                  </div>
                </Button>
                
                <Button
                  variant={paymentMethod === "apple-pay" ? "default" : "outline"}
                  className={`justify-start h-16 touch-target ${paymentMethod === "apple-pay" ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => setPaymentMethod("apple-pay")}
                >
                  <Smartphone className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Apple Pay</div>
                    <div className="text-xs opacity-70">Quick & secure</div>
                  </div>
                </Button>
                
                <Button
                  variant={paymentMethod === "paypal" ? "default" : "outline"}
                  className={`justify-start h-16 touch-target ${paymentMethod === "paypal" ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => setPaymentMethod("paypal")}
                >
                  <Wallet className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">PayPal</div>
                    <div className="text-xs opacity-70">Pay with PayPal</div>
                  </div>
                </Button>
                
                <Button
                  variant={paymentMethod === "cash" ? "default" : "outline"}
                  className={`justify-start h-16 touch-target ${paymentMethod === "cash" ? 'bg-primary text-primary-foreground' : ''}`}
                  onClick={() => setPaymentMethod("cash")}
                >
                  <Wallet className="w-5 h-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">Pay by Cash</div>
                    <div className="text-xs opacity-70">Card required for no-shows</div>
                  </div>
                </Button>
              </div>

              {/* Cash Payment Policy */}
              {paymentMethod === "cash" && (
                <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg space-y-3">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Cash Payment Policy</p>
                      <p className="text-sm text-muted-foreground">
                        A backup payment method is required for cash payments. You will only be charged 
                        a 3% no-show fee if you fail to appear for your appointment and don't cancel 
                        the day before.
                      </p>
                      
                      <Dialog open={showCashPolicy} onOpenChange={setShowCashPolicy}>
                        <DialogTrigger asChild>
                          <Button variant="link" className="h-auto p-0 text-primary text-sm">
                            View full policy
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Cash Payment Policy</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 text-sm">
                            <p>
                              When paying by cash, we require a backup payment method on file to ensure 
                              appointment reliability.
                            </p>
                            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                              <li>Your card will NOT be charged if you attend your appointment</li>
                              <li>A 3% no-show fee will be charged only if you miss your appointment</li>
                              <li>You must cancel by the day before to avoid any charges</li>
                              <li>Your payment information is securely stored and processed by Stripe</li>
                            </ul>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="cashAgreement"
                          checked={cashAgreement}
                          onCheckedChange={(checked) => setCashAgreement(checked === true)}
                        />
                        <Label htmlFor="cashAgreement" className="text-sm">
                          I understand and agree to the cash payment policy
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Form */}
              {paymentMethod === "card" && (
                <div className="space-y-4 mt-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input
                        id="cardNumber"
                        placeholder="1234 5678 9012 3456"
                        className="touch-target"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiry">Expiry Date</Label>
                        <Input
                          id="expiry"
                          placeholder="MM/YY"
                          className="touch-target"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="cvc">CVC</Label>
                        <Input
                          id="cvc"
                          placeholder="123"
                          className="touch-target"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Complete Booking Button */}
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid()}
              className="w-full btn-primary h-14 text-lg touch-target"
            >
              Complete Booking - ${service.price}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}