/**
 * Landing Page - tithi.com
 * Shows "Join Tithi Now" and "Login" buttons
 */

'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-8">Tithi</h1>
        <p className="text-xl text-indigo-100 mb-12">
          White-label booking and payments platform
        </p>
        <div className="space-x-4">
          <Link
            href="/signup"
            className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition"
          >
            Join Tithi Now
          </Link>
          <Link
            href="/login"
            className="inline-block bg-indigo-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-800 transition"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}

