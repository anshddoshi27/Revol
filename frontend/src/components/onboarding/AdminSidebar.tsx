/**
 * AdminSidebar Component
 * 
 * Sidebar navigation for the admin panel with business management modules.
 * Matches the design from the visual calendar interface.
 */

import React from 'react';
import {
  Calendar,
  BarChart3,
  Users,
  Settings,
  Bell,
  Gift,
  CreditCard,
  FileText,
  UserCheck,
  Palette,
  TrendingUp,
  Eye,
} from 'lucide-react';

interface AdminSidebarProps {
  activeModule?: string;
  onModuleChange?: (module: string) => void;
  className?: string;
}

const navigationModules = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'calendar', label: 'Visual Calendar', icon: Calendar },
  { id: 'availability', label: 'Availability Scheduler', icon: Calendar },
  { id: 'services', label: 'Services & Pricing', icon: Settings },
  { id: 'booking', label: 'Booking Management', icon: Calendar },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'crm', label: 'Client CRM', icon: Users },
  { id: 'promotions', label: 'Promotions', icon: Gift },
  { id: 'gift-cards', label: 'Gift Cards', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'team', label: 'Team Management', icon: UserCheck },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'reports', label: 'Financial Reports', icon: FileText },
  { id: 'client-view', label: 'Admin Client View', icon: Eye },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeModule = 'calendar',
  onModuleChange,
  className = '',
}) => {
  return (
    <div className={`w-64 bg-gray-800 text-white ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-lg font-semibold text-white">Elite Hair Studio Admin</h1>
        <p className="text-sm text-gray-400 mt-1">Business Management</p>
      </div>

      {/* Navigation */}
      <nav className="p-4">
        <ul className="space-y-2">
          {navigationModules.map((module) => {
            const Icon = module.icon;
            const isActive = activeModule === module.id;
            
            return (
              <li key={module.id}>
                <button
                  onClick={() => onModuleChange?.(module.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {module.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};
