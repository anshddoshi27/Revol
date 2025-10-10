/**
 * App Component
 * 
 * Main application component with routing setup.
 */

// React is used implicitly by JSX
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Landing, SignUp, OnboardingStep1, OnboardingStep2, OnboardingStep3, OnboardingStep4, OnboardingStep5, OnboardingStep6, OnboardingStep7, OnboardingStep8 } from './pages';

// Import new pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminBookings from './pages/admin/Bookings';
import AdminServices from './pages/admin/Services';
import BookingPage from './pages/booking/BookingPage';
import CustomerDashboard from './pages/customer/Dashboard';

// Import auth context
import { AuthProvider, AdminRoute, CustomerRoute } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
          {/* Landing page */}
          <Route path="/" element={<Landing />} />
          
          {/* Auth routes */}
          <Route path="/auth/sign-up" element={<SignUp />} />
          
          {/* Onboarding routes */}
          <Route path="/onboarding/step-1" element={<OnboardingStep1 />} />
          <Route path="/onboarding/logo-colors" element={<OnboardingStep2 />} />
          <Route path="/onboarding/services" element={<OnboardingStep3 />} />
          <Route path="/onboarding/availability" element={<OnboardingStep4 />} />
          <Route path="/onboarding/notifications" element={<OnboardingStep5 />} />
          <Route path="/onboarding/policies" element={<OnboardingStep6 />} />
          <Route path="/onboarding/gift-cards" element={<OnboardingStep7 />} />
          <Route path="/onboarding/payments" element={<OnboardingStep8 />} />
          
          {/* Admin routes */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/bookings" element={<AdminRoute><AdminBookings /></AdminRoute>} />
          <Route path="/admin/bookings/new" element={<AdminRoute><AdminBookings /></AdminRoute>} />
          <Route path="/admin/bookings/:id" element={<AdminRoute><AdminBookings /></AdminRoute>} />
          <Route path="/admin/bookings/:id/edit" element={<AdminRoute><AdminBookings /></AdminRoute>} />
          <Route path="/admin/services" element={<AdminRoute><AdminServices /></AdminRoute>} />
          <Route path="/admin/services/new" element={<AdminRoute><AdminServices /></AdminRoute>} />
          <Route path="/admin/services/:id" element={<AdminRoute><AdminServices /></AdminRoute>} />
          <Route path="/admin/services/:id/edit" element={<AdminRoute><AdminServices /></AdminRoute>} />
          <Route path="/admin/customers" element={<AdminRoute><AdminBookings /></AdminRoute>} />
          <Route path="/admin/analytics" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          
          {/* Customer routes */}
          <Route path="/customer" element={<CustomerRoute><CustomerDashboard /></CustomerRoute>} />
          <Route path="/customer/dashboard" element={<CustomerRoute><CustomerDashboard /></CustomerRoute>} />
          <Route path="/customer/bookings" element={<CustomerRoute><CustomerDashboard /></CustomerRoute>} />
          <Route path="/customer/bookings/new" element={<CustomerRoute><CustomerDashboard /></CustomerRoute>} />
          <Route path="/customer/settings" element={<CustomerRoute><CustomerDashboard /></CustomerRoute>} />
          <Route path="/customer/gift-cards" element={<CustomerRoute><CustomerDashboard /></CustomerRoute>} />
          <Route path="/customer/payment-methods" element={<CustomerRoute><CustomerDashboard /></CustomerRoute>} />
          
          {/* Public booking routes */}
          <Route path="/v1/:slug/booking" element={<BookingPage />} />
          <Route path="/v1/:slug/booking/confirmation" element={<BookingPage />} />
          <Route path="/v1/:slug/services" element={<BookingPage />} />
          <Route path="/v1/:slug/availability" element={<BookingPage />} />
          <Route path="/v1/:slug/checkout" element={<BookingPage />} />
          
          {/* Catch-all route */}
          <Route path="*" element={<Landing />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
