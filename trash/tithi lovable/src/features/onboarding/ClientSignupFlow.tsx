import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Plus, 
  Trash2, 
  Upload,
  Building2,
  User,
  Clock,
  DollarSign,
  Users,
  Palette,
  Gift,
  Bell,
  CreditCard
} from "lucide-react";

interface ClientSignupFlowProps {
  onComplete: () => void;
  onBack: () => void;
}

type SignupStep = 
  | "business-info" 
  | "owner-details" 
  | "services" 
  | "availability" 
  | "team" 
  | "branding" 
  | "promotions" 
  | "gift-cards"
  | "notifications"
  | "payment"
  | "review";

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  services: string[];
}

export function ClientSignupFlow({ onComplete, onBack }: ClientSignupFlowProps) {
  const [currentStep, setCurrentStep] = useState<SignupStep>("business-info");
  const [formData, setFormData] = useState({
    // Business Info
    businessName: "",
    businessType: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    website: "",
    description: "",
    
    // Owner Details
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    password: "",
    confirmPassword: "",
    
    // Services
    services: [] as Service[],
    
    // Availability
    businessHours: {
      monday: { open: "09:00", close: "17:00", closed: false },
      tuesday: { open: "09:00", close: "17:00", closed: false },
      wednesday: { open: "09:00", close: "17:00", closed: false },
      thursday: { open: "09:00", close: "17:00", closed: false },
      friday: { open: "09:00", close: "17:00", closed: false },
      saturday: { open: "10:00", close: "16:00", closed: false },
      sunday: { open: "10:00", close: "16:00", closed: true },
    },
    
    // Team
    teamMembers: [] as TeamMember[],
    
    // Branding
    primaryColor: "#000000",
    secondaryColor: "#ffffff",
    logo: null as File | null,
    
    // Promotions
    enableNewClientDiscount: false,
    newClientDiscountPercent: 10,
    enableReferralProgram: false,
    referralReward: 25,
    
    // Gift Cards
    enableGiftCards: false,
    giftCardAmounts: [50, 100, 200],
    
    // Notifications
    emailNotifications: true,
    smsNotifications: false,
    bookingReminders: true,
    marketingEmails: false,
    
    // Payment
    acceptCash: true,
    acceptCard: true,
    stripeAccount: "",
  });

  const steps: Array<{ key: SignupStep; title: string; icon: any }> = [
    { key: "business-info", title: "Business Info", icon: Building2 },
    { key: "owner-details", title: "Owner Details", icon: User },
    { key: "services", title: "Services", icon: DollarSign },
    { key: "availability", title: "Availability", icon: Clock },
    { key: "team", title: "Team", icon: Users },
    { key: "branding", title: "Branding", icon: Palette },
    { key: "promotions", title: "Promotions", icon: Gift },
    { key: "gift-cards", title: "Gift Cards", icon: CreditCard },
    { key: "notifications", title: "Notifications", icon: Bell },
    { key: "payment", title: "Payment", icon: CreditCard },
    { key: "review", title: "Review", icon: Check },
  ];

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].key);
    } else {
      console.log("Final signup data:", formData);
      onComplete();
    }
  };

  const handlePrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].key);
    } else {
      onBack();
    }
  };

  const addService = () => {
    const newService: Service = {
      id: Date.now().toString(),
      name: "",
      description: "",
      duration: 60,
      price: 100,
      category: "General"
    };
    setFormData(prev => ({
      ...prev,
      services: [...prev.services, newService]
    }));
  };

  const updateService = (id: string, updates: Partial<Service>) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.map(service => 
        service.id === id ? { ...service, ...updates } : service
      )
    }));
  };

  const removeService = (id: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.filter(service => service.id !== id)
    }));
  };

  const addTeamMember = () => {
    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: "",
      email: "",
      role: "Staff",
      services: []
    };
    setFormData(prev => ({
      ...prev,
      teamMembers: [...prev.teamMembers, newMember]
    }));
  };

  const updateTeamMember = (id: string, updates: Partial<TeamMember>) => {
    setFormData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.map(member => 
        member.id === id ? { ...member, ...updates } : member
      )
    }));
  };

  const removeTeamMember = (id: string) => {
    setFormData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.filter(member => member.id !== id)
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case "business-info":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Tell us about your business</h2>
              <p className="text-muted-foreground">Let's start with the basics</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                  placeholder="Luxe Spa & Wellness"
                />
              </div>
              
              <div>
                <Label htmlFor="businessType">Business Type *</Label>
                <Select onValueChange={(value) => setFormData(prev => ({ ...prev, businessType: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spa">Spa & Wellness</SelectItem>
                    <SelectItem value="salon">Hair Salon</SelectItem>
                    <SelectItem value="massage">Massage Therapy</SelectItem>
                    <SelectItem value="nails">Nail Salon</SelectItem>
                    <SelectItem value="fitness">Fitness Studio</SelectItem>
                    <SelectItem value="medical">Medical Spa</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Business Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="hello@luxespa.com"
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main Street"
                />
              </div>
              
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="New York"
                />
              </div>
              
              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="NY"
                />
              </div>
              
              <div>
                <Label htmlFor="zipCode">Zip Code *</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                  placeholder="10001"
                />
              </div>
              
              <div>
                <Label htmlFor="website">Website (Optional)</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="www.luxespa.com"
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="description">Business Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your business, services, and what makes you special..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case "owner-details":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <User className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Owner Account Details</h2>
              <p className="text-muted-foreground">Create your admin account</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ownerName">Full Name *</Label>
                <Input
                  id="ownerName"
                  value={formData.ownerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, ownerName: e.target.value }))}
                  placeholder="John Smith"
                />
              </div>
              
              <div>
                <Label htmlFor="ownerEmail">Email *</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, ownerEmail: e.target.value }))}
                  placeholder="john@luxespa.com"
                />
              </div>
              
              <div>
                <Label htmlFor="ownerPhone">Phone Number *</Label>
                <Input
                  id="ownerPhone"
                  value={formData.ownerPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, ownerPhone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Create a strong password"
                />
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm your password"
                />
              </div>
            </div>
          </div>
        );

      case "services":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Your Services</h2>
              <p className="text-muted-foreground">Add the services you offer</p>
            </div>
            
            <div className="space-y-4">
              {formData.services.map((service) => (
                <Card key={service.id} className="p-4">
                  <div className="grid md:grid-cols-5 gap-4 items-end">
                    <div>
                      <Label>Service Name *</Label>
                      <Input
                        value={service.name}
                        onChange={(e) => updateService(service.id, { name: e.target.value })}
                        placeholder="Deep Tissue Massage"
                      />
                    </div>
                    
                    <div>
                      <Label>Category</Label>
                      <Select onValueChange={(value) => updateService(service.id, { category: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="massage">Massage</SelectItem>
                          <SelectItem value="facial">Facial</SelectItem>
                          <SelectItem value="hair">Hair</SelectItem>
                          <SelectItem value="nails">Nails</SelectItem>
                          <SelectItem value="body">Body Treatment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Duration (min)</Label>
                      <Input
                        type="number"
                        value={service.duration}
                        onChange={(e) => updateService(service.id, { duration: parseInt(e.target.value) })}
                        placeholder="60"
                      />
                    </div>
                    
                    <div>
                      <Label>Price ($)</Label>
                      <Input
                        type="number"
                        value={service.price}
                        onChange={(e) => updateService(service.id, { price: parseInt(e.target.value) })}
                        placeholder="100"
                      />
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => removeService(service.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="mt-3">
                    <Label>Description</Label>
                    <Textarea
                      value={service.description}
                      onChange={(e) => updateService(service.id, { description: e.target.value })}
                      placeholder="A relaxing deep tissue massage to relieve tension..."
                      rows={2}
                    />
                  </div>
                </Card>
              ))}
              
              <Button onClick={addService} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </div>
          </div>
        );

      case "availability":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Business Hours</h2>
              <p className="text-muted-foreground">When are you open?</p>
            </div>
            
            <div className="space-y-4">
              {Object.entries(formData.businessHours).map(([day, hours]) => (
                <div key={day} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="w-24">
                    <span className="font-medium capitalize">{day}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!hours.closed}
                      onCheckedChange={(checked) => {
                        setFormData(prev => ({
                          ...prev,
                          businessHours: {
                            ...prev.businessHours,
                            [day]: { ...hours, closed: !checked }
                          }
                        }));
                      }}
                    />
                    <span className="text-sm">Open</span>
                  </div>
                  
                  {!hours.closed && (
                    <>
                      <Input
                        type="time"
                        value={hours.open}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            businessHours: {
                              ...prev.businessHours,
                              [day]: { ...hours, open: e.target.value }
                            }
                          }));
                        }}
                        className="w-32"
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        value={hours.close}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            businessHours: {
                              ...prev.businessHours,
                              [day]: { ...hours, close: e.target.value }
                            }
                          }));
                        }}
                        className="w-32"
                      />
                    </>
                  )}
                  
                  {hours.closed && (
                    <Badge variant="outline">Closed</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case "team":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Team Members</h2>
              <p className="text-muted-foreground">Add your staff (optional)</p>
            </div>
            
            <div className="space-y-4">
              {formData.teamMembers.map((member) => (
                <Card key={member.id} className="p-4">
                  <div className="grid md:grid-cols-4 gap-4 items-end">
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={member.name}
                        onChange={(e) => updateTeamMember(member.id, { name: e.target.value })}
                        placeholder="Jane Doe"
                      />
                    </div>
                    
                    <div>
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={member.email}
                        onChange={(e) => updateTeamMember(member.id, { email: e.target.value })}
                        placeholder="jane@luxespa.com"
                      />
                    </div>
                    
                    <div>
                      <Label>Role</Label>
                      <Select onValueChange={(value) => updateTeamMember(member.id, { role: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Manager">Manager</SelectItem>
                          <SelectItem value="Staff">Staff</SelectItem>
                          <SelectItem value="Therapist">Therapist</SelectItem>
                          <SelectItem value="Stylist">Stylist</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => removeTeamMember(member.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
              
              <Button onClick={addTeamMember} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Team Member
              </Button>
            </div>
          </div>
        );

      case "branding":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Palette className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Branding</h2>
              <p className="text-muted-foreground">Customize your booking page</p>
            </div>
            
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-16 h-12"
                    />
                    <Input
                      value={formData.primaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                      placeholder="#000000"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Secondary Color</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-16 h-12"
                    />
                    <Input
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <Label>Logo Upload</Label>
                <div className="mt-2 border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop your logo here, or click to browse
                  </p>
                  <Button variant="outline" size="sm">
                    Choose File
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case "promotions":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Gift className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Promotions</h2>
              <p className="text-muted-foreground">Setup initial promotions</p>
            </div>
            
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">New Client Discount</h3>
                    <p className="text-sm text-muted-foreground">
                      Offer a discount to first-time customers
                    </p>
                  </div>
                  <Checkbox
                    checked={formData.enableNewClientDiscount}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, enableNewClientDiscount: !!checked }))
                    }
                  />
                </div>
                
                {formData.enableNewClientDiscount && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Discount Percentage</Label>
                      <Input
                        type="number"
                        value={formData.newClientDiscountPercent}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          newClientDiscountPercent: parseInt(e.target.value) 
                        }))}
                        placeholder="10"
                      />
                    </div>
                  </div>
                )}
              </Card>
              
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Referral Program</h3>
                    <p className="text-sm text-muted-foreground">
                      Reward clients for referring friends
                    </p>
                  </div>
                  <Checkbox
                    checked={formData.enableReferralProgram}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, enableReferralProgram: !!checked }))
                    }
                  />
                </div>
                
                {formData.enableReferralProgram && (
                  <div>
                    <Label>Referral Reward ($)</Label>
                    <Input
                      type="number"
                      value={formData.referralReward}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        referralReward: parseInt(e.target.value) 
                      }))}
                      placeholder="25"
                    />
                  </div>
                )}
              </Card>
            </div>
          </div>
        );

      case "gift-cards":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Gift Cards</h2>
              <p className="text-muted-foreground">Setup gift card options</p>
            </div>
            
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Enable Gift Cards</h3>
                  <p className="text-sm text-muted-foreground">
                    Allow customers to purchase gift cards
                  </p>
                </div>
                <Checkbox
                  checked={formData.enableGiftCards}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, enableGiftCards: !!checked }))
                  }
                />
              </div>
              
              {formData.enableGiftCards && (
                <div>
                  <Label className="mb-3 block">Gift Card Amounts ($)</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {formData.giftCardAmounts.map((amount, index) => (
                      <Input
                        key={index}
                        type="number"
                        value={amount}
                        onChange={(e) => {
                          const newAmounts = [...formData.giftCardAmounts];
                          newAmounts[index] = parseInt(e.target.value);
                          setFormData(prev => ({ ...prev, giftCardAmounts: newAmounts }));
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Bell className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Notifications</h2>
              <p className="text-muted-foreground">Setup communication preferences</p>
            </div>
            
            <div className="space-y-4">
              {[
                { key: "emailNotifications", label: "Email Notifications", description: "Receive booking alerts via email" },
                { key: "smsNotifications", label: "SMS Notifications", description: "Receive booking alerts via text" },
                { key: "bookingReminders", label: "Booking Reminders", description: "Send reminders to clients" },
                { key: "marketingEmails", label: "Marketing Emails", description: "Receive tips and promotions from Tithi" },
              ].map((option) => (
                <Card key={option.key} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{option.label}</h3>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    <Checkbox
                      checked={formData[option.key as keyof typeof formData] as boolean}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, [option.key]: !!checked }))
                      }
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );

      case "payment":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Payment Methods</h2>
              <p className="text-muted-foreground">How will you accept payments?</p>
            </div>
            
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Cash Payments</h3>
                    <p className="text-sm text-muted-foreground">Accept cash at your location</p>
                  </div>
                  <Checkbox
                    checked={formData.acceptCash}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, acceptCash: !!checked }))
                    }
                  />
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium">Card Payments</h3>
                    <p className="text-sm text-muted-foreground">Accept credit/debit cards online</p>
                  </div>
                  <Checkbox
                    checked={formData.acceptCard}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, acceptCard: !!checked }))
                    }
                  />
                </div>
                
                {formData.acceptCard && (
                  <div>
                    <Label>Stripe Account (Optional)</Label>
                    <Input
                      value={formData.stripeAccount}
                      onChange={(e) => setFormData(prev => ({ ...prev, stripeAccount: e.target.value }))}
                      placeholder="Connect your Stripe account later"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      You can connect your Stripe account after signup
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        );

      case "review":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Check className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Review & Submit</h2>
              <p className="text-muted-foreground">Almost done! Review your information</p>
            </div>
            
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-semibold mb-3">Business Information</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div><strong>Name:</strong> {formData.businessName}</div>
                  <div><strong>Type:</strong> {formData.businessType}</div>
                  <div><strong>Email:</strong> {formData.email}</div>
                  <div><strong>Phone:</strong> {formData.phone}</div>
                  <div className="md:col-span-2"><strong>Address:</strong> {formData.address}, {formData.city}, {formData.state} {formData.zipCode}</div>
                </div>
              </Card>
              
              <Card className="p-6">
                <h3 className="font-semibold mb-3">Services ({formData.services.length})</h3>
                <div className="space-y-2">
                  {formData.services.slice(0, 3).map((service) => (
                    <div key={service.id} className="flex justify-between text-sm">
                      <span>{service.name}</span>
                      <span>${service.price} ({service.duration}min)</span>
                    </div>
                  ))}
                  {formData.services.length > 3 && (
                    <div className="text-sm text-muted-foreground">
                      +{formData.services.length - 3} more services
                    </div>
                  )}
                </div>
              </Card>
              
              <Card className="p-6">
                <h3 className="font-semibold mb-3">Features Enabled</h3>
                <div className="flex flex-wrap gap-2">
                  {formData.enableNewClientDiscount && <Badge>New Client Discount</Badge>}
                  {formData.enableReferralProgram && <Badge>Referral Program</Badge>}
                  {formData.enableGiftCards && <Badge>Gift Cards</Badge>}
                  {formData.acceptCard && <Badge>Online Payments</Badge>}
                  {formData.acceptCash && <Badge>Cash Payments</Badge>}
                </div>
              </Card>
              
              <Card className="p-6 bg-muted/50">
                <h3 className="font-semibold mb-3">What happens next?</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span>Your Tithi page will be created instantly</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span>90 days free trial starts immediately</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span>We'll schedule a setup call within 24 hours</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span>Start taking bookings right away</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        );

      default:
        return <div>Step not found</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="container max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold text-primary-foreground">T</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Join Tithi</h1>
                <p className="text-muted-foreground">Setup your booking page</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                Step {currentStepIndex + 1} of {steps.length}
              </div>
              <div className="font-medium">{steps[currentStepIndex].title}</div>
            </div>
          </div>
          
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handlePrev}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStepIndex === 0 ? "Back to Homepage" : "Previous"}
          </Button>
          
          <Button 
            onClick={handleNext}
            className="flex items-center gap-2"
          >
            {currentStepIndex === steps.length - 1 ? "Complete Setup" : "Next"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}