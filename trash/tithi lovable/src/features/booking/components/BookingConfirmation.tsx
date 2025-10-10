import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Calendar, Clock, User, Mail, Phone, Home } from "lucide-react";
import { format } from "date-fns";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface BookingConfirmationProps {
  service: Service;
  selectedDate: Date;
  selectedTime: string;
  customerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  onNewBooking: () => void;
}

export function BookingConfirmation({ 
  service, 
  selectedDate, 
  selectedTime, 
  customerInfo,
  onNewBooking 
}: BookingConfirmationProps) {
  
  useEffect(() => {
    // Add confetti animation
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Create confetti effect
      if (typeof window !== 'undefined' && (window as any).confetti) {
        (window as any).confetti(Object.assign({}, defaults, { 
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        }));
        (window as any).confetti(Object.assign({}, defaults, { 
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        }));
      }
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6 animate-fade-in">
        {/* Success Animation */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-success/10 rounded-full animate-scale-in">
            <CheckCircle className="w-12 h-12 text-success" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-display font-bold">You're Booked!</h1>
            <p className="text-xl text-muted-foreground">
              Your appointment has been confirmed
            </p>
          </div>
        </div>

        {/* Booking Details */}
        <Card className="card-premium p-8 animate-slide-up">
          <div className="space-y-6">
            <div className="text-center pb-6 border-b border-border">
              <h2 className="text-2xl font-display font-semibold mb-2">Booking Confirmation</h2>
              <p className="text-muted-foreground">
                We've sent a confirmation email to {customerInfo.email}
              </p>
            </div>

            {/* Service Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {service.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{service.name}</h3>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {service.duration} minutes
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      1 person
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">${service.price}</div>
                  <div className="text-sm text-muted-foreground">Total paid</div>
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-border">
              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Appointment Details</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium">{format(selectedDate, "EEEE, MMMM d, yyyy")}</div>
                      <div className="text-sm text-muted-foreground">Date</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium">{selectedTime}</div>
                      <div className="text-sm text-muted-foreground">Time</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-lg">Contact Information</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium">{customerInfo.firstName} {customerInfo.lastName}</div>
                      <div className="text-sm text-muted-foreground">Customer</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium">{customerInfo.email}</div>
                      <div className="text-sm text-muted-foreground">Email</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium">{customerInfo.phone}</div>
                      <div className="text-sm text-muted-foreground">Phone</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Reminders Info */}
            <div className="pt-6 border-t border-border">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-medium mb-2">What's Next?</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• You'll receive email and SMS reminders 24 hours before your appointment</li>
                  <li>• A final reminder will be sent 1 hour before your appointment</li>
                  <li>• Need to reschedule? Contact us at least 24 hours in advance</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button 
                onClick={onNewBooking}
                className="flex-1 btn-primary touch-target"
              >
                Book Another Appointment
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 touch-target"
                onClick={() => window.location.href = '/'}
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Add confetti script */}
      <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js"></script>
    </div>
  );
}