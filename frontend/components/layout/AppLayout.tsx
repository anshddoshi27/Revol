/**
 * Main application layout wrapper
 * Includes navbar with tenant switcher
 */

'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/store';
import Navbar from './Navbar';

interface AppLayoutProps {
  children: ReactNode;
  requiresAuth?: boolean;
}

export default function AppLayout({ children, requiresAuth = false }: AppLayoutProps) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (requiresAuth && !isAuthenticated) {
      router.push('/login');
    }
  }, [requiresAuth, isAuthenticated, router]);

  if (requiresAuth && !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthenticated && <Navbar />}
      <main>{children}</main>
    </div>
  );
}

