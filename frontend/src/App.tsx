/**
 * App Component
 * 
 * Main application component with routing setup.
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Landing, SignUp, OnboardingStep1, OnboardingStep2, OnboardingStep3, OnboardingStep4, OnboardingStep5, OnboardingStep6, OnboardingStep7, OnboardingStep8 } from './pages';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
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
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;