import { Shield, Zap, Heart } from "lucide-react";

export function TrustBadge() {
  return (
    <div className="flex items-center justify-center gap-8 py-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="w-5 h-5 text-primary" />
        <span>90 Days Free</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Zap className="w-5 h-5 text-primary" />
        <span>No Setup Fees</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Heart className="w-5 h-5 text-primary" />
        <span>Loved by 1000+ Businesses</span>
      </div>
    </div>
  );
}