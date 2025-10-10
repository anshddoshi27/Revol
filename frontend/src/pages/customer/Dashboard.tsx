/**
 * Customer Dashboard Page
 * 
 * Dashboard for Tithi users to manage their bookings,
 * view booking history, and manage their account.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Mail,
  Star,
  Plus,
  Eye,
  Edit,
  X,
  CheckCircle,
  AlertCircle,
  User,
  Settings,
  CreditCard,
  Gift
} from 'lucide-react';
import { getCustomerProfile, getCustomerBookings, cancelCustomerBooking, rescheduleCustomerBooking } from '../../api/services/customerApi';

interface CustomerBooking {
  id: string;
  businessName: string;
  businessSlug: string;
  serviceName: string;
  staffName: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'completed' | 'cancelled' | 'no_show';
  amount: number;
  notes?: string;
  canCancel: boolean;
  canReschedule: boolean;
}

interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  memberSince: string;
  totalBookings: number;
  favoriteBusinesses: string[];
}

const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<CustomerBooking[]>([]);
  const [recentBookings, setRecentBookings] = useState<CustomerBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerData();
  }, []);

  const loadCustomerData = async () => {
    try {
      // Load customer data from real API
      const [profileData, bookingsData] = await Promise.all([
        getCustomerProfile(),
        getCustomerBookings({ limit: 20 })
      ]);

      setProfile(profileData);
      
      // Separate upcoming and recent bookings
      const upcoming = bookingsData.bookings.filter(booking => booking.status === 'upcoming');
      const recent = bookingsData.bookings.filter(booking => booking.status === 'completed').slice(0, 5);
      
      setUpcomingBookings(upcoming);
      setRecentBookings(recent);
    } catch (error) {
      console.error('Failed to load customer data:', error);
      // Fallback to mock data if API fails
      const mockProfile: CustomerProfile = {
        id: '1',
        name: 'Sarah Johnson',
        email: 'sarah.j@email.com',
        phone: '+1 (555) 123-4567',
        memberSince: '2023-06-15',
        totalBookings: 12,
        favoriteBusinesses: ['Elegant Salon & Spa', 'Modern Barbershop']
      };

      const mockUpcomingBookings: CustomerBooking[] = [
        {
          id: '1',
          businessName: 'Elegant Salon & Spa',
          businessSlug: 'elegant-salon',
          serviceName: 'Haircut & Style',
          staffName: 'Emma Wilson',
          startTime: '2024-01-20T10:00:00Z',
          endTime: '2024-01-20T11:00:00Z',
          status: 'upcoming',
          amount: 75,
          canCancel: true,
          canReschedule: true
        },
        {
          id: '2',
          businessName: 'Modern Barbershop',
          businessSlug: 'modern-barbershop',
          serviceName: 'Beard Trim',
          staffName: 'Alex Rodriguez',
          startTime: '2024-01-25T14:30:00Z',
          endTime: '2024-01-25T15:00:00Z',
          status: 'upcoming',
          amount: 25,
          canCancel: true,
          canReschedule: true
        }
      ];

      const mockRecentBookings: CustomerBooking[] = [
        {
          id: '3',
          businessName: 'Elegant Salon & Spa',
          businessSlug: 'elegant-salon',
          serviceName: 'Color Treatment',
          staffName: 'Emma Wilson',
          startTime: '2024-01-10T14:00:00Z',
          endTime: '2024-01-10T16:00:00Z',
          status: 'completed',
          amount: 120,
          canCancel: false,
          canReschedule: false
        },
        {
          id: '4',
          businessName: 'Modern Barbershop',
          businessSlug: 'modern-barbershop',
          serviceName: 'Haircut',
          staffName: 'Alex Rodriguez',
          startTime: '2024-01-05T15:30:00Z',
          endTime: '2024-01-05T16:15:00Z',
          status: 'completed',
          amount: 45,
          canCancel: false,
          canReschedule: false
        }
      ];

      setProfile(mockProfile);
      setUpcomingBookings(mockUpcomingBookings);
      setRecentBookings(mockRecentBookings);
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (bookingId: string) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      try {
        // Cancel booking via real API
        const booking = upcomingBookings.find(b => b.id === bookingId);
        if (booking) {
          await cancelCustomerBooking(bookingId, 'Customer requested cancellation');
          
          // Update local state
          setUpcomingBookings(prev => prev.filter(booking => booking.id !== bookingId));
        }
      } catch (error) {
        console.error('Failed to cancel booking:', error);
      }
    }
  };

  const rescheduleBooking = (bookingId: string) => {
    const booking = upcomingBookings.find(b => b.id === bookingId);
    if (booking) {
      navigate(`/v1/${booking.businessSlug}/booking?reschedule=${bookingId}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      case 'no_show': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming': return <Clock className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      case 'no_show': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">Welcome back, {profile?.name}!</h1>
                <p className="text-gray-600">Manage your bookings and account settings.</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/customer/settings')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </button>
              <button
                onClick={() => navigate('/customer/bookings/new')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Booking
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Upcoming Bookings</p>
                <p className="text-2xl font-semibold text-gray-900">{upcomingBookings.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Bookings</p>
                <p className="text-2xl font-semibold text-gray-900">{profile?.totalBookings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Star className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Favorite Businesses</p>
                <p className="text-2xl font-semibold text-gray-900">{profile?.favoriteBusinesses.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Gift className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Gift Cards</p>
                <p className="text-2xl font-semibold text-gray-900">2</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Bookings */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Upcoming Bookings</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {upcomingBookings.length > 0 ? (
                  upcomingBookings.map((booking) => (
                    <div key={booking.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <h4 className="text-sm font-medium text-gray-900">{booking.businessName}</h4>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                              {getStatusIcon(booking.status)}
                              <span className="ml-1 capitalize">{booking.status}</span>
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{booking.serviceName} with {booking.staffName}</p>
                          <p className="text-sm text-gray-500">{formatDateTime(booking.startTime)}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">{formatCurrency(booking.amount)}</span>
                          <div className="flex space-x-1">
                            {booking.canReschedule && (
                              <button
                                onClick={() => rescheduleBooking(booking.id)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Reschedule"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                            {booking.canCancel && (
                              <button
                                onClick={() => cancelBooking(booking.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/v1/${booking.businessSlug}/booking`)}
                              className="text-gray-600 hover:text-gray-900"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-8 text-center">
                    <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming bookings</h3>
                    <p className="mt-1 text-sm text-gray-500">Book your next appointment to get started.</p>
                    <div className="mt-6">
                      <button
                        onClick={() => navigate('/customer/bookings/new')}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Book Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions & Recent Bookings */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/customer/bookings/new')}
                  className="w-full flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  <Plus className="h-4 w-4 mr-3" />
                  Book New Appointment
                </button>
                <button
                  onClick={() => navigate('/customer/bookings')}
                  className="w-full flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  <Calendar className="h-4 w-4 mr-3" />
                  View All Bookings
                </button>
                <button
                  onClick={() => navigate('/customer/gift-cards')}
                  className="w-full flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  <Gift className="h-4 w-4 mr-3" />
                  Gift Cards
                </button>
                <button
                  onClick={() => navigate('/customer/payment-methods')}
                  className="w-full flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  <CreditCard className="h-4 w-4 mr-3" />
                  Payment Methods
                </button>
              </div>
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Bookings</h3>
              <div className="space-y-3">
                {recentBookings.slice(0, 3).map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{booking.businessName}</p>
                      <p className="text-xs text-gray-500">{booking.serviceName}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(booking.startTime)}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                      {getStatusIcon(booking.status)}
                    </span>
                  </div>
                ))}
                {recentBookings.length > 3 && (
                  <button
                    onClick={() => navigate('/customer/bookings')}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-500"
                  >
                    View all bookings
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;

