
import { useState, useEffect } from "react";
import { PlatformLanding } from "@/features/landing/PlatformLanding";
import { TenantLanding } from "@/features/landing/TenantLanding";
import { BookingFlow } from "@/features/booking/BookingFlow";
import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { ClientSignupFlow } from "@/features/onboarding/ClientSignupFlow";

type AppState = "platform" | "tenant" | "booking" | "admin" | "signup";

const Index = () => {
  const [appState, setAppState] = useState<AppState>("platform");
  const [currentTenant, setCurrentTenant] = useState<string>("");

  useEffect(() => {
    const host = window.location.host;
    const pathname = window.location.pathname;
    const hash = window.location.hash;
    
    console.log('Routing check:', { host, pathname, hash });
    
    // Check for signup hash
    if (hash === "#signup") {
      console.log('Signup flow detected');
      setAppState("signup");
      return;
    }
    
    // Check for admin routes
    if (pathname.includes('/admin')) {
      const pathParts = pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2 && pathParts[1] === 'admin') {
        console.log('Admin route detected for tenant:', pathParts[0]);
        setCurrentTenant(pathParts[0]);
        setAppState("admin");
        return;
      }
    }
    
    // Check for subdomain routing (e.g., luxespa.tithi.com)
    if (host !== "localhost:8080" && host !== "localhost:5173" && !host.includes("lovableproject.com") && !host.includes("lovable.app") && !host.includes("tithi.com")) {
      const tenantName = host.split('.')[0];
      console.log('Subdomain tenant detected:', tenantName);
      setCurrentTenant(tenantName);
      setAppState("tenant");
      return;
    }
    
    // Check for path-based routing (e.g., tithi.com/luxespa)
    const pathParts = pathname.split('/').filter(Boolean);
    console.log('Path parts:', pathParts);
    
    if (pathParts.length > 0 && pathParts[0] !== '' && !pathParts[0].startsWith('api')) {
      const knownTenants = ['luxe-spa-wellness', 'elite-hair-studio', 'zen-massage-therapy', 'bella-nails-beauty'];
      const normalizedPath = pathParts[0].toLowerCase().replace(/\s+/g, '-');
      
      if (knownTenants.includes(normalizedPath)) {
        console.log('Path-based tenant detected:', pathParts[0]);
        setCurrentTenant(pathParts[0]);
        setAppState("tenant");
        return;
      }
    }
    
    console.log('Defaulting to platform landing');
    setAppState("platform");
  }, []);

  const handleTenantSelect = (tenantName: string) => {
    setCurrentTenant(tenantName);
    setAppState("tenant");
  };

  const handleStartBooking = () => {
    setAppState("booking");
  };

  const handleBackToTenant = () => {
    setAppState("tenant");
  };

  const handleAdminAccess = (tenantName: string) => {
    setCurrentTenant(tenantName);
    setAppState("admin");
  };

  const handleSignupComplete = () => {
    // After signup completion, show success or redirect to tenant page
    console.log("Signup completed successfully!");
    window.location.hash = "";
    setAppState("platform");
  };

  const handleBackToPlatform = () => {
    window.location.hash = "";
    setAppState("platform");
  };

  switch (appState) {
    case "platform":
      return <PlatformLanding onTenantSelect={handleTenantSelect} />;
      
    case "tenant":
      return (
        <TenantLanding 
          tenantName={currentTenant}
          onStartBooking={handleStartBooking}
          onAdminAccess={() => handleAdminAccess(currentTenant)}
        />
      );
      
    case "booking":
      return <BookingFlow tenantName={currentTenant} />;
      
    case "admin":
      return <AdminDashboard tenantName={currentTenant} />;
      
    case "signup":
      return (
        <ClientSignupFlow 
          onComplete={handleSignupComplete}
          onBack={handleBackToPlatform}
        />
      );
      
    default:
      return <PlatformLanding onTenantSelect={handleTenantSelect} />;
  }
};

export default Index;
