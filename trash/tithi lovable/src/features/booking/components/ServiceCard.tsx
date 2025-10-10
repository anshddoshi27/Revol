import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Star } from "lucide-react";

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

interface ServiceCardProps {
  service: Service;
  onSelect: (service: Service) => void;
  isSelected?: boolean;
}

export function ServiceCard({ service, onSelect, isSelected = false }: ServiceCardProps) {
  return (
    <Card 
      className={`group cursor-pointer transition-all duration-300 hover:shadow-purple hover:-translate-y-1 card-premium touch-target ${
        isSelected ? 'ring-2 ring-primary shadow-purple' : ''
      }`}
      onClick={() => onSelect(service)}
    >
      <div className="aspect-[4/3] relative overflow-hidden rounded-t-lg">
        {service.image ? (
          <img 
            src={service.image} 
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-primary flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-foreground">
              {service.name.charAt(0)}
            </span>
          </div>
        )}
        <Badge 
          variant="secondary" 
          className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm"
        >
          {service.category}
        </Badge>
        {service.rating && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium">{service.rating}</span>
          </div>
        )}
      </div>
      
      <div className="p-4 space-y-3">
        <div className="space-y-2">
          <h3 className="font-display font-semibold text-lg leading-tight">{service.name}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-2xl font-bold">${service.price}</div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="w-4 h-4 mr-1" />
              {service.duration}min
            </div>
          </div>
          
          <Button 
            variant={isSelected ? "default" : "outline"}
            className={`touch-target ${isSelected ? 'btn-primary' : ''}`}
          >
            {isSelected ? 'Selected' : 'Book'}
          </Button>
        </div>
        
        {service.included && service.included.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Includes:</p>
            <div className="flex flex-wrap gap-1">
              {service.included.map((item, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}