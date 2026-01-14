import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowRight, Calendar, Zap, Shield, Smartphone, Star, CheckCircle, ChevronDown } from "lucide-react";

interface PlatformLandingProps {
  onTenantSelect: (tenantName: string) => void;
}

const mockTenants = [
  {
    name: "Luxe Spa & Wellness",
    type: "Spa",
    rating: 4.9,
    reviews: 234,
    image: null
  },
  {
    name: "Elite Hair Studio",
    type: "Hair Salon", 
    rating: 4.8,
    reviews: 167,
    image: null
  },
  {
    name: "Zen Massage Therapy",
    type: "Massage",
    rating: 4.9,
    reviews: 145,
    image: null
  },
  {
    name: "Bella Nails & Beauty",
    type: "Nail Salon",
    rating: 4.7,
    reviews: 89,
    image: null
  }
];

export function PlatformLanding({ onTenantSelect }: PlatformLandingProps) {
  const [businessInfo, setBusinessInfo] = useState({
    businessName: "",
    businessType: "",
    contactEmail: "",
    message: ""
  });

  const handleGetOnTithi = () => {
    // This would trigger the client signup flow
    console.log("Starting Tithi client signup flow", businessInfo);
    window.location.hash = "#signup";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-primary rounded-lg">
              <span className="text-xl font-bold text-primary-foreground">T</span>
            </div>
            <span className="text-2xl font-display font-bold">Tithi</span>
          </div>
          
          <div className="flex items-center gap-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  Clients
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background border shadow-lg">
                {mockTenants.map((tenant) => (
                  <DropdownMenuItem 
                    key={tenant.name}
                    onClick={() => onTenantSelect(tenant.name)}
                    className="cursor-pointer hover:bg-muted"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 bg-gradient-primary rounded-md flex items-center justify-center">
                        <span className="text-sm font-bold text-primary-foreground">
                          {tenant.name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{tenant.name}</div>
                        <div className="text-xs text-muted-foreground">{tenant.type}</div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button onClick={handleGetOnTithi}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        <div className="absolute inset-0" style={{background: 'var(--gradient-hero)'}}></div>
        
        <div className="relative z-10 text-center text-white px-4 max-w-6xl mx-auto">
          <div className="space-y-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-md rounded-full mb-8">
              <span className="text-4xl font-bold">T</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-display font-bold leading-tight">
              Tithi
            </h1>
            
            <p className="text-2xl md:text-3xl text-white/90 max-w-4xl mx-auto leading-relaxed">
              Give your business a professional booking page in minutes. 
              Zero risk, zero setup fees, just $11.99/month after 90 days free.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Badge variant="secondary" className="text-lg px-4 py-2 bg-white/20 backdrop-blur-md text-white border-white/30">
                First 90 Days Free
              </Badge>
              <Badge variant="secondary" className="text-lg px-4 py-2 bg-white/20 backdrop-blur-md text-white border-white/30">
                No Setup Fees
              </Badge>
              <Badge variant="secondary" className="text-lg px-4 py-2 bg-white/20 backdrop-blur-md text-white border-white/30">
                Just $11.99/month
              </Badge>
            </div>
            
            <div className="pt-8">
              <Button 
                size="lg"
                className="btn-glass text-xl px-12 py-8 touch-target"
                onClick={handleGetOnTithi}
              >
                Get on Tithi
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Current Tenants */}
      <section className="py-20 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold mb-4">Trusted by Leading Businesses</h2>
            <p className="text-muted-foreground text-xl max-w-3xl mx-auto">
              Join the growing community of service businesses that have transformed their booking experience
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {mockTenants.map((tenant, index) => (
              <Card 
                key={index} 
                className="card-premium p-6 transition-all duration-300 group"
              >
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <span className="text-2xl font-bold text-primary-foreground">
                      {tenant.name.charAt(0)}
                    </span>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{tenant.name}</h3>
                    <Badge variant="outline" className="text-xs">{tenant.type}</Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold text-sm">{tenant.rating}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({tenant.reviews} reviews)
                    </span>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    Powered by Tithi
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">Why Choose Tithi?</h2>
            <p className="text-muted-foreground text-xl max-w-3xl mx-auto">
              Built for the modern service business with everything you need to succeed
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="card-glass p-8 text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-lg mx-auto mb-6 flex items-center justify-center">
                <Zap className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Lightning Fast</h3>
              <p className="text-muted-foreground leading-relaxed">
                Booking takes under 60 seconds. Works offline. Loads in under 2 seconds on any device.
              </p>
            </Card>
            
            <Card className="card-glass p-8 text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-lg mx-auto mb-6 flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Zero Risk</h3>
              <p className="text-muted-foreground leading-relaxed">
                90 days free, no setup costs, no contracts. Pay only when you're ready to scale.
              </p>
            </Card>
            
            <Card className="card-glass p-8 text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-lg mx-auto mb-6 flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Mobile First</h3>
              <p className="text-muted-foreground leading-relaxed">
                Designed for touch. Perfect for elderly customers. Works beautifully on any screen size.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Get on Tithi Section */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-display font-bold mb-4">Ready to Transform Your Business?</h2>
            <p className="text-muted-foreground text-xl">
              Join Tithi today and experience the difference. Book a personalized demo with our team.
            </p>
          </div>
          
          <Card className="card-premium p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="text-2xl font-semibold">Tell us about your business</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Business Name</label>
                    <Input
                      placeholder="Your business name"
                      value={businessInfo.businessName}
                      onChange={(e) => setBusinessInfo(prev => ({ ...prev, businessName: e.target.value }))}
                      className="touch-target"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Business Type</label>
                    <Input
                      placeholder="e.g., Spa, Hair Salon, Fitness Studio"
                      value={businessInfo.businessType}
                      onChange={(e) => setBusinessInfo(prev => ({ ...prev, businessType: e.target.value }))}
                      className="touch-target"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Contact Email</label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={businessInfo.contactEmail}
                      onChange={(e) => setBusinessInfo(prev => ({ ...prev, contactEmail: e.target.value }))}
                      className="touch-target"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <h3 className="text-2xl font-semibold">What you get</h3>
                
                <div className="space-y-3">
                  {[
                    "Personalized onboarding session",
                    "90 days completely free",
                    "Custom branding setup",
                    "Staff training included",
                    "24/7 support during trial"
                  ].map((benefit, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
                
                <div className="pt-4">
                  <Button 
                    onClick={handleGetOnTithi}
                    className="w-full btn-primary text-lg py-6 touch-target"
                  >
                    <Calendar className="w-5 h-5 mr-2" />
                    Schedule Your Demo
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}