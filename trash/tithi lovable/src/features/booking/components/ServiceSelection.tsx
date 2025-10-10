import { useState } from "react";
import { ServiceCard } from "./ServiceCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  rating?: number;
  image?: string;
  included?: string[];
}

interface Deal {
  id: string;
  title: string;
  description: string;
  originalPrice: number;
  dealPrice: number;
  validUntil: string;
  services: string[];
}

interface ServiceSelectionProps {
  onServiceSelect: (service: Service) => void;
  tenantName: string;
}

const mockServices: Service[] = [
  {
    id: "1",
    name: "Premium Facial Treatment",
    description: "Deep cleansing facial with hydrating mask and moisturizer",
    price: 85,
    duration: 60,
    category: "Facial",
    rating: 4.9,
    included: ["Cleansing", "Exfoliation", "Mask", "Moisturizer"]
  },
  {
    id: "2",
    name: "Relaxing Massage",
    description: "Full body massage to relieve tension and stress",
    price: 120,
    duration: 90,
    category: "Massage",
    rating: 4.8,
    included: ["Hot stones", "Essential oils", "Aromatherapy"]
  },
  {
    id: "3",
    name: "Classic Manicure",
    description: "Complete nail care with polish and hand treatment",
    price: 35,
    duration: 45,
    category: "Nails",
    rating: 4.7,
    included: ["Cuticle care", "Polish", "Hand massage"]
  },
  {
    id: "4",
    name: "Hair Cut & Style",
    description: "Professional cut and styling for any occasion",
    price: 65,
    duration: 75,
    category: "Hair",
    rating: 4.9,
    included: ["Wash", "Cut", "Style", "Consultation"]
  },
  {
    id: "5",
    name: "Eyebrow Threading",
    description: "Precise eyebrow shaping using traditional threading",
    price: 25,
    duration: 20,
    category: "Beauty",
    rating: 4.6,
    included: ["Shaping", "Trimming", "Aftercare"]
  },
  {
    id: "6",
    name: "Deep Tissue Massage",
    description: "Therapeutic massage targeting muscle knots and tension",
    price: 140,
    duration: 60,
    category: "Massage",
    rating: 4.9,
    included: ["Consultation", "Targeted therapy", "Heat therapy"]
  }
];

const mockDeals: Deal[] = [
  {
    id: "deal1",
    title: "Pamper Package",
    description: "Facial + Manicure combo",
    originalPrice: 120,
    dealPrice: 95,
    validUntil: "2025-08-31",
    services: ["1", "3"]
  },
  {
    id: "deal2", 
    title: "Relaxation Special",
    description: "90min massage + aromatherapy",
    originalPrice: 140,
    dealPrice: 110,
    validUntil: "2025-08-25",
    services: ["2"]
  }
];

export function ServiceSelection({ onServiceSelect, tenantName }: ServiceSelectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const categories = ["All", ...Array.from(new Set(mockServices.map(s => s.category)))];
  const filteredServices = selectedCategory === "All" 
    ? mockServices 
    : mockServices.filter(s => s.category === selectedCategory);

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
  };

  const handleContinue = () => {
    if (selectedService) {
      onServiceSelect(selectedService);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold">{tenantName}</h1>
              <p className="text-muted-foreground">Choose your service</p>
            </div>
            {selectedService && (
              <Button onClick={handleContinue} className="btn-primary">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              className={`cursor-pointer whitespace-nowrap touch-target ${
                selectedCategory === category ? 'bg-primary text-primary-foreground' : ''
              }`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Badge>
          ))}
        </div>

        {/* Deals Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-display font-semibold">Special Deals</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {mockDeals.map((deal) => (
              <div
                key={deal.id}
                className="min-w-[280px] card-glass p-4 rounded-lg cursor-pointer hover:shadow-purple transition-all duration-300"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="destructive" className="text-xs">
                      Save ${deal.originalPrice - deal.dealPrice}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Until {new Date(deal.validUntil).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{deal.title}</h3>
                    <p className="text-sm text-muted-foreground">{deal.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">${deal.dealPrice}</span>
                    <span className="text-sm text-muted-foreground line-through">
                      ${deal.originalPrice}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Services Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-display font-semibold">All Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onSelect={handleServiceSelect}
                isSelected={selectedService?.id === service.id}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating Continue Button for Mobile */}
      {selectedService && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border md:hidden">
          <Button onClick={handleContinue} className="w-full btn-primary touch-target">
            Continue with {selectedService.name} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}