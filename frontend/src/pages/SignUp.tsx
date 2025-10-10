/**
 * SignUp Page Component
 * 
 * Page component that contains the sign-up form and handles the sign-up flow.
 */

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SignUpForm } from '../components/SignUpForm';
// import { telemetry } from '../observability';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();

  const handleSignUpSuccess = (_user: any, onboardingPrefill: any) => {
    // Emit analytics event
    // telemetry.track('onboarding.prefill_ready', {
    //   user_id: user.id,
    //   has_prefill: !!onboardingPrefill,
    // });

    // Navigate to onboarding with prefill data
    navigate('/onboarding/step-1', {
      state: { prefill: onboardingPrefill },
    });
  };

  const handleSignUpError = (error: any) => {
    console.error('Sign-up error:', error);
    // Error handling is done in the SignUpForm component
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-1 sm:px-1 lg:px-1">
      <div className="sm:mx-auto sm:w-full sm:max-w-xs">
        <div className="text-center">
          <h1 className="text-xs font-bold text-gray-900">Tithi</h1>
          <h2 className="mt-1 text-xs font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Or{' '}
            <Link
              to="/auth/sign-in"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-1 sm:mx-auto sm:w-full sm:max-w-xs">
        <div className="bg-white py-1 px-1 shadow sm:rounded-lg sm:px-1">
          <SignUpForm
            onSuccess={handleSignUpSuccess}
            onError={handleSignUpError}
          />
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            By creating an account, you agree to our{' '}
            <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
