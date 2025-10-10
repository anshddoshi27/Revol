import { useState } from "react";
import { ServiceSelection } from "./components/ServiceSelection";
import { BookingCalendar } from "./components/BookingCalendar";
import { BookingCheckout } from "./components/BookingCheckout";
import { BookingConfirmation } from "./components/BookingConfirmation";

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

interface BookingFlowProps {
  tenantName: string;
}

type BookingStep = "services" | "calendar" | "checkout" | "confirmation";

export function BookingFlow({ tenantName }: BookingFlowProps) {
  const [currentStep, setCurrentStep] = useState<BookingStep>("services");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [customerInfo, setCustomerInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  });

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setCurrentStep("calendar");
  };

  const handleTimeSelect = (date: Date, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setCurrentStep("checkout");
  };

  const handleBackToServices = () => {
    setCurrentStep("services");
    setSelectedService(null);
  };

  const handleBackToCalendar = () => {
    setCurrentStep("calendar");
  };

  const handleBookingComplete = () => {
    setCurrentStep("confirmation");
  };

  const handleNewBooking = () => {
    setCurrentStep("services");
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTime("");
    setCustomerInfo({
      firstName: "",
      lastName: "",
      email: "",
      phone: ""
    });
  };

  switch (currentStep) {
    case "services":
      return (
        <ServiceSelection
          onServiceSelect={handleServiceSelect}
          tenantName={tenantName}
        />
      );

    case "calendar":
      if (!selectedService) return null;
      return (
        <BookingCalendar
          service={selectedService}
          onTimeSelect={handleTimeSelect}
          onBack={handleBackToServices}
        />
      );

    case "checkout":
      if (!selectedService || !selectedDate) return null;
      return (
        <BookingCheckout
          service={selectedService}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onBack={handleBackToCalendar}
          onComplete={handleBookingComplete}
        />
      );

    case "confirmation":
      if (!selectedService || !selectedDate) return null;
      return (
        <BookingConfirmation
          service={selectedService}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          customerInfo={customerInfo}
          onNewBooking={handleNewBooking}
        />
      );

    default:
      return null;
  }
}