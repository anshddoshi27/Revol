/**
 * Public Booking Page
 * 
 * Customer-facing booking interface where customers can browse services,
 * select staff, choose time slots, and complete bookings.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  User, 
  DollarSign, 
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Star,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { getPublicServices, createPublicBooking } from '../../api/services/bookingApi';
import { getPublicAvailableTimeSlots } from '../../api/services/availabilityApi';
import { getPublicServices as getPublicServicesApi } from '../../api/services/serviceApi';

interface Business {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  rating: number;
  reviewCount: number;
  logo?: string;
  coverImage?: string;
}

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
}

interface Staff {
  id: string;
  name: string;
  bio: string;
  specialties: string[];
  avatar?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  staffId: string;
  staffName: string;
}

interface BookingForm {
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes?: string;
}

const BookingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(1);
  
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    serviceId: '',
    staffId: '',
    date: '',
    time: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    notes: ''
  });

  useEffect(() => {
    if (slug) {
      loadBusinessData();
    }
  }, [slug]);

  useEffect(() => {
    if (selectedDate && bookingForm.serviceId && bookingForm.staffId) {
      loadTimeSlots();
    }
  }, [selectedDate, bookingForm.serviceId, bookingForm.staffId]);

  const loadBusinessData = async () => {
    try {
      if (!slug) return;

      // Load business data from real API
      const [servicesResponse] = await Promise.all([
        getPublicServicesApi(slug, { isActive: true })
      ]);

      // Mock business data (this would come from a business API)
      const mockBusiness: Business = {
        id: '1',
        name: 'Elegant Salon & Spa',
        slug: slug,
        description: 'Professional hair and beauty services in a relaxing environment',
        address: '123 Main Street, Downtown, NY 10001',
        phone: '+1 (555) 123-4567',
        email: 'info@elegantsalon.com',
        rating: 4.8,
        reviewCount: 127
      };

      // Mock staff data (this would come from a staff API)
      const mockStaff: Staff[] = [
        {
          id: '1',
          name: 'Emma Wilson',
          bio: 'Senior stylist with 8 years of experience in hair cutting and coloring',
          specialties: ['Hair Cutting', 'Color Treatment', 'Styling']
        },
        {
          id: '2',
          name: 'Alex Rodriguez',
          bio: 'Expert in men\'s grooming and beard styling',
          specialties: ['Beard Trimming', 'Hair Cutting', 'Grooming']
        }
      ];

      setBusiness(mockBusiness);
      setServices(servicesResponse.services);
      setStaff(mockStaff);
    } catch (error) {
      console.error('Failed to load business data:', error);
      // Fallback to mock data if API fails
      const mockBusiness: Business = {
        id: '1',
        name: 'Elegant Salon & Spa',
        slug: slug || 'elegant-salon',
        description: 'Professional hair and beauty services in a relaxing environment',
        address: '123 Main Street, Downtown, NY 10001',
        phone: '+1 (555) 123-4567',
        email: 'info@elegantsalon.com',
        rating: 4.8,
        reviewCount: 127
      };

      const mockServices: Service[] = [
        {
          id: '1',
          name: 'Haircut & Style',
          description: 'Professional haircut with styling and blow-dry',
          duration: 60,
          price: 75,
          category: 'Hair Services'
        },
        {
          id: '2',
          name: 'Beard Trim',
          description: 'Professional beard trimming and shaping',
          duration: 30,
          price: 25,
          category: 'Grooming'
        },
        {
          id: '3',
          name: 'Color Treatment',
          description: 'Full hair coloring service with consultation',
          duration: 120,
          price: 120,
          category: 'Hair Services'
        }
      ];

      const mockStaff: Staff[] = [
        {
          id: '1',
          name: 'Emma Wilson',
          bio: 'Senior stylist with 8 years of experience in hair cutting and coloring',
          specialties: ['Hair Cutting', 'Color Treatment', 'Styling']
        },
        {
          id: '2',
          name: 'Alex Rodriguez',
          bio: 'Expert in men\'s grooming and beard styling',
          specialties: ['Beard Trimming', 'Hair Cutting', 'Grooming']
        }
      ];

      setBusiness(mockBusiness);
      setServices(mockServices);
      setStaff(mockStaff);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeSlots = async () => {
    try {
      if (!slug || !selectedDate || !bookingForm.serviceId || !bookingForm.staffId) return;

      // Load time slots from real API
      const selectedService = services.find(s => s.id === bookingForm.serviceId);
      const timeSlots = await getPublicAvailableTimeSlots(slug, {
        staffId: bookingForm.staffId,
        date: selectedDate,
        serviceId: bookingForm.serviceId,
        duration: selectedService?.duration
      });

      setTimeSlots(timeSlots);
    } catch (error) {
      console.error('Failed to load time slots:', error);
      // Fallback to mock time slots if API fails
      const mockTimeSlots: TimeSlot[] = [
        { time: '09:00', available: true, staffId: bookingForm.staffId, staffName: staff.find(s => s.id === bookingForm.staffId)?.name || '' },
        { time: '10:00', available: false, staffId: bookingForm.staffId, staffName: staff.find(s => s.id === bookingForm.staffId)?.name || '' },
        { time: '11:00', available: true, staffId: bookingForm.staffId, staffName: staff.find(s => s.id === bookingForm.staffId)?.name || '' },
        { time: '12:00', available: true, staffId: bookingForm.staffId, staffName: staff.find(s => s.id === bookingForm.staffId)?.name || '' },
        { time: '13:00', available: false, staffId: bookingForm.staffId, staffName: staff.find(s => s.id === bookingForm.staffId)?.name || '' },
        { time: '14:00', available: true, staffId: bookingForm.staffId, staffName: staff.find(s => s.id === bookingForm.staffId)?.name || '' },
        { time: '15:00', available: true, staffId: bookingForm.staffId, staffName: staff.find(s => s.id === bookingForm.staffId)?.name || '' },
        { time: '16:00', available: false, staffId: bookingForm.staffId, staffName: staff.find(s => s.id === bookingForm.staffId)?.name || '' },
        { time: '17:00', available: true, staffId: bookingForm.staffId, staffName: staff.find(s => s.id === bookingForm.staffId)?.name || '' }
      ];

      setTimeSlots(mockTimeSlots);
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    setBookingForm(prev => ({ ...prev, serviceId }));
    setCurrentStep(2);
  };

  const handleStaffSelect = (staffId: string) => {
    setBookingForm(prev => ({ ...prev, staffId }));
    setCurrentStep(3);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setBookingForm(prev => ({ ...prev, date }));
    setCurrentStep(4);
  };

  const handleTimeSelect = (time: string) => {
    setBookingForm(prev => ({ ...prev, time }));
    setCurrentStep(5);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!slug) return;

      // Submit booking via real API
      const selectedService = services.find(s => s.id === bookingForm.serviceId);
      const endTime = new Date(bookingForm.startTime);
      endTime.setMinutes(endTime.getMinutes() + (selectedService?.duration || 60));

      const bookingData = {
        serviceId: bookingForm.serviceId,
        staffId: bookingForm.staffId,
        customerName: bookingForm.customerName,
        customerEmail: bookingForm.customerEmail,
        customerPhone: bookingForm.customerPhone,
        startTime: bookingForm.startTime,
        endTime: endTime.toISOString(),
        notes: bookingForm.notes
      };

      const booking = await createPublicBooking(slug, bookingData);
      
      // Navigate to confirmation page
      navigate(`/v1/${slug}/booking/confirmation`, { state: { booking } });
    } catch (error) {
      console.error('Failed to submit booking:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  };

  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Business Not Found</h1>
          <p className="text-gray-600">The business you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate(-1)}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
                <div className="flex items-center mt-1">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < Math.floor(business.rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="ml-2 text-sm text-gray-600">
                    {business.rating} ({business.reviewCount} reviews)
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="h-4 w-4 mr-1" />
                {business.address}
              </div>
              <div className="flex items-center text-sm text-gray-600 mt-1">
                <Phone className="h-4 w-4 mr-1" />
                {business.phone}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { step: 1, title: 'Service', icon: <CheckCircle className="h-5 w-5" /> },
              { step: 2, title: 'Staff', icon: <User className="h-5 w-5" /> },
              { step: 3, title: 'Date', icon: <Calendar className="h-5 w-5" /> },
              { step: 4, title: 'Time', icon: <Clock className="h-5 w-5" /> },
              { step: 5, title: 'Details', icon: <CheckCircle className="h-5 w-5" /> }
            ].map((item, index) => (
              <div key={item.step} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  currentStep >= item.step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {item.icon}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep >= item.step ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {item.title}
                </span>
                {index < 4 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    currentStep > item.step ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Step 1: Service Selection */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Choose a Service</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => handleServiceSelect(service.id)}
                    className="border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{service.name}</h3>
                    <p className="text-gray-600 mb-4">{service.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatDuration(service.duration)}
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatCurrency(service.price)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Staff Selection */}
          {currentStep === 2 && (
            <div>
              <div className="flex items-center mb-6">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="mr-4 p-2 text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900">Choose a Staff Member</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staff.map((staffMember) => (
                  <div
                    key={staffMember.id}
                    onClick={() => handleStaffSelect(staffMember.id)}
                    className="border border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{staffMember.name}</h3>
                    <p className="text-gray-600 mb-4">{staffMember.bio}</p>
                    <div className="flex flex-wrap gap-2">
                      {staffMember.specialties.map((specialty, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Date Selection */}
          {currentStep === 3 && (
            <div>
              <div className="flex items-center mb-6">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="mr-4 p-2 text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900">Choose a Date</h2>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {getAvailableDates().map((date) => (
                  <button
                    key={date}
                    onClick={() => handleDateSelect(date)}
                    className="p-4 text-center border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                  >
                    <div className="text-sm text-gray-500">
                      {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      {new Date(date).getDate()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(date).toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Time Selection */}
          {currentStep === 4 && (
            <div>
              <div className="flex items-center mb-6">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="mr-4 p-2 text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900">Choose a Time</h2>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => slot.available && handleTimeSelect(slot.time)}
                    disabled={!slot.available}
                    className={`p-3 text-center border rounded-lg transition-all ${
                      slot.available
                        ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-gray-900'
                        : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Customer Details */}
          {currentStep === 5 && (
            <div>
              <div className="flex items-center mb-6">
                <button
                  onClick={() => setCurrentStep(4)}
                  className="mr-4 p-2 text-gray-400 hover:text-gray-600"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900">Your Details</h2>
              </div>
              
              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={bookingForm.customerName}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, customerName: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={bookingForm.customerEmail}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={bookingForm.customerPhone}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Requests (Optional)
                  </label>
                  <textarea
                    value={bookingForm.notes}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any special requests or notes for your appointment..."
                  />
                </div>

                {/* Booking Summary */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Service:</span>
                      <span className="font-medium">{services.find(s => s.id === bookingForm.serviceId)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Staff:</span>
                      <span className="font-medium">{staff.find(s => s.id === bookingForm.staffId)?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium">{new Date(bookingForm.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Time:</span>
                      <span className="font-medium">{bookingForm.time}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(services.find(s => s.id === bookingForm.serviceId)?.price || 0)}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
                >
                  Confirm Booking
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingPage;

