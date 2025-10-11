/**
 * App Component - Simplified Version
 * 
 * Main application component with routing setup.
 */

import React from 'react';
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
          
          {/* Authentication routes */}
          <Route path="/auth/sign-up" element={<SignUp />} />
          
          {/* Onboarding routes */}
          <Route path="/onboarding/step-1" element={<OnboardingStep1 />} />
          <Route path="/onboarding/step-2" element={<OnboardingStep2 />} />
          <Route path="/onboarding/step-3" element={<OnboardingStep3 />} />
          <Route path="/onboarding/step-4" element={<OnboardingStep4 />} />
          <Route path="/onboarding/step-5" element={<OnboardingStep5 />} />
          <Route path="/onboarding/step-6" element={<OnboardingStep6 />} />
          <Route path="/onboarding/step-7" element={<OnboardingStep7 />} />
          <Route path="/onboarding/step-8" element={<OnboardingStep8 />} />
          
          {/* Admin routes */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/bookings" element={<AdminRoute><AdminBookings /></AdminRoute>} />
          <Route path="/admin/services" element={<AdminRoute><AdminServices /></AdminRoute>} />
          
          {/* Customer routes */}
          <Route path="/customer" element={<CustomerRoute><CustomerDashboard /></CustomerRoute>} />
          
          {/* Public booking routes */}
          <Route path="/booking/:businessSlug" element={<BookingPage />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
