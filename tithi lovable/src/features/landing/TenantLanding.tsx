
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Phone, Clock, Calendar, Settings } from "lucide-react";
import { TrustBadge } from "./components/TrustBadge";

interface TenantLandingProps {
  tenantName: string;
  onStartBooking: () => void;
  onAdminAccess?: () => void;
}

export const TenantLanding = ({ tenantName, onStartBooking, onAdminAccess }: TenantLandingProps) => {
  // Convert kebab-case to display format
  const displayName = tenantName.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  const services = [
    {
      name: "Swedish Massage",
      duration: "60 min",
      price: "$89",
      description: "Relaxing full-body massage with essential oils",
      image: "/placeholder.svg"
    },
    {
      name: "Deep Tissue Massage", 
      duration: "90 min",
      price: "$129",
      description: "Therapeutic massage targeting muscle tension",
      image: "/placeholder.svg"
    },
    {
      name: "European Facial",
      duration: "75 min", 
      price: "$95",
      description: "Cleansing and rejuvenating facial treatment",
      image: "/placeholder.svg"
    }
  ];

  const testimonials = [
    {
      name: "Sarah M.",
      rating: 5,
      text: "Amazing experience! The staff was professional and the massage was exactly what I needed."
    },
    {
      name: "Michael R.",
      rating: 5,
      text: "Clean facility, great ambiance, and excellent service. Will definitely be back!"
    },
    {
      name: "Jennifer L.",
      rating: 5,
      text: "Best spa in the area. The facial treatment left my skin glowing for days."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/5 to-secondary/5 py-20">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-4xl md:text-6xl font-bold mb-4">
                {displayName}
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Experience luxury wellness and relaxation
              </p>
            </div>
            {onAdminAccess && (
              <Button 
                variant="outline" 
                onClick={onAdminAccess}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Admin
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <Badge variant="secondary" className="px-3 py-1">
                  <Star className="h-4 w-4 mr-1 fill-current" />
                  4.9 Rating
                </Badge>
                <Badge variant="outline" className="px-3 py-1">
                  500+ Reviews
                </Badge>
              </div>
              
              <Button 
                size="lg" 
                onClick={onStartBooking}
                className="w-full lg:w-auto px-8 py-4 text-lg"
              >
                <Calendar className="h-5 w-5 mr-2" />
                Book Your Appointment
              </Button>
              
              <div className="mt-8 space-y-3">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-5 w-5" />
                  <span>123 Wellness Ave, Spa District, CA 90210</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="h-5 w-5" />
                  <span>(555) 123-RELAX</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Clock className="h-5 w-5" />
                  <span>Mon-Sun: 9:00 AM - 9:00 PM</span>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <img 
                src="/assets/spa-hero.jpg"
                alt="Spa Interior"
                className="rounded-2xl shadow-2xl w-full h-96 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Our Specialties */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Specialties</h2>
            <p className="text-xl text-muted-foreground">
              Discover our signature treatments designed for your wellness
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video bg-muted relative">
                  <img 
                    src={service.image} 
                    alt={service.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl">{service.name}</CardTitle>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{service.price}</div>
                      <div className="text-sm text-muted-foreground">{service.duration}</div>
                    </div>
                  </div>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full" 
                    onClick={onStartBooking}
                  >
                    Book Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* What Our Clients Say */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What Our Clients Say</h2>
            <p className="text-xl text-muted-foreground">
              Real experiences from our valued customers
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4">"{testimonial.text}"</p>
                  <p className="font-semibold">- {testimonial.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Visit Us */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Visit Us</h2>
            <p className="text-xl text-muted-foreground">
              Find us in the heart of the wellness district
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-semibold mb-3">Location & Hours</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-primary mt-1" />
                      <div>
                        <p className="font-medium">123 Wellness Avenue</p>
                        <p className="text-muted-foreground">Spa District, CA 90210</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-primary mt-1" />
                      <div>
                        <p className="font-medium">Open 7 Days a Week</p>
                        <p className="text-muted-foreground">Monday - Sunday: 9:00 AM - 9:00 PM</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="h-5 w-5 text-primary mt-1" />
                      <div>
                        <p className="font-medium">(555) 123-RELAX</p>
                        <p className="text-muted-foreground">Call us for appointments</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button 
                  size="lg" 
                  onClick={onStartBooking}
                  className="w-full lg:w-auto"
                >
                  Book Your Visit Today
                </Button>
              </div>
            </div>
            
            <div className="bg-muted rounded-2xl h-96 flex items-center justify-center">
              <p className="text-muted-foreground">Interactive Map Coming Soon</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badge */}
      <section className="py-12 border-t">
        <div className="container mx-auto px-4">
          <TrustBadge />
        </div>
      </section>
    </div>
  );
};
