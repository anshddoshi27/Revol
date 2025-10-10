/**
 * LogoPreview Component
 * 
 * Logo placement preview component for onboarding Step 2.
 * Shows how the logo will appear in different contexts (large header, small navigation).
 */

import React from 'react';
import { Monitor, Smartphone, Eye } from 'lucide-react';
import type { ProcessedImage } from '../../utils/imageProcessing';

// ===== TYPES =====

interface LogoPreviewProps {
  logoData: ProcessedImage | null;
  primaryColor: string;
  businessName: string;
  className?: string;
}

interface PreviewContext {
  name: string;
  description: string;
  icon: React.ReactNode;
  renderPreview: (logoUrl: string, color: string, businessName: string) => React.ReactNode;
}

// ===== PREVIEW COMPONENTS =====

const WelcomeHeaderPreview: React.FC<{
  logoUrl: string;
  color: string;
  businessName: string;
}> = ({ logoUrl, color, businessName }) => (
  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
    {/* Header */}
    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
        <div className="text-xs text-gray-500">booking.yourbusiness.com</div>
      </div>
    </div>
    
    {/* Welcome section with large logo */}
    <div className="p-8 text-center" style={{ backgroundColor: color + '10' }}>
      <div className="mb-6">
        <img
          src={logoUrl}
          alt={`${businessName} logo`}
          className="h-16 mx-auto object-contain"
        />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Welcome to {businessName}
      </h1>
      <p className="text-gray-600 mb-6">
        Book your appointment with us today
      </p>
      <button
        className="px-6 py-3 text-white font-medium rounded-lg"
        style={{ backgroundColor: color }}
      >
        Book Now
      </button>
    </div>
  </div>
);

const NavigationPreview: React.FC<{
  logoUrl: string;
  color: string;
  businessName: string;
}> = ({ logoUrl, color, businessName }) => (
  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
    {/* Navigation bar */}
    <div className="bg-white px-4 py-3 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src={logoUrl}
            alt={`${businessName} logo`}
            className="h-8 object-contain"
          />
          <span className="font-medium text-gray-900">{businessName}</span>
        </div>
        <div className="flex items-center space-x-4">
          <button className="text-sm text-gray-600 hover:text-gray-900">Services</button>
          <button className="text-sm text-gray-600 hover:text-gray-900">About</button>
          <button
            className="px-4 py-2 text-white text-sm font-medium rounded-md"
            style={{ backgroundColor: color }}
          >
            Book
          </button>
        </div>
      </div>
    </div>
    
    {/* Page content */}
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Our Services</h2>
      <div className="space-y-3">
        <div className="p-3 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Haircut & Style</h3>
              <p className="text-sm text-gray-600">45 minutes</p>
            </div>
            <span className="font-medium text-gray-900">$45</span>
          </div>
        </div>
        <div className="p-3 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Color Treatment</h3>
              <p className="text-sm text-gray-600">90 minutes</p>
            </div>
            <span className="font-medium text-gray-900">$120</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const MobilePreview: React.FC<{
  logoUrl: string;
  color: string;
  businessName: string;
}> = ({ logoUrl, color, businessName }) => (
  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-xs mx-auto">
    {/* Mobile header */}
    <div className="bg-white px-4 py-3 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img
            src={logoUrl}
            alt={`${businessName} logo`}
            className="h-6 object-contain"
          />
          <span className="font-medium text-gray-900 text-sm">{businessName}</span>
        </div>
        <button
          className="px-3 py-1 text-white text-xs font-medium rounded"
          style={{ backgroundColor: color }}
        >
          Book
        </button>
      </div>
    </div>
    
    {/* Mobile content */}
    <div className="p-4">
      <div className="text-center mb-4">
        <img
          src={logoUrl}
          alt={`${businessName} logo`}
          className="h-12 mx-auto object-contain mb-3"
        />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Book with {businessName}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Choose a service and time that works for you
        </p>
        <button
          className="w-full py-3 text-white font-medium rounded-lg"
          style={{ backgroundColor: color }}
        >
          Select Service
        </button>
      </div>
    </div>
  </div>
);

// ===== MAIN COMPONENT =====

export const LogoPreview: React.FC<LogoPreviewProps> = ({
  logoData,
  primaryColor,
  businessName,
  className = '',
}) => {
  const previewContexts: PreviewContext[] = [
    {
      name: 'Welcome Page',
      description: 'Large logo on your booking welcome page',
      icon: <Monitor className="h-4 w-4" />,
      renderPreview: (logoUrl, color, name) => (
        <WelcomeHeaderPreview logoUrl={logoUrl} color={color} businessName={name} />
      ),
    },
    {
      name: 'Navigation',
      description: 'Small logo in navigation and other pages',
      icon: <Monitor className="h-4 w-4" />,
      renderPreview: (logoUrl, color, name) => (
        <NavigationPreview logoUrl={logoUrl} color={color} businessName={name} />
      ),
    },
    {
      name: 'Mobile',
      description: 'Optimized for mobile devices',
      icon: <Smartphone className="h-4 w-4" />,
      renderPreview: (logoUrl, color, name) => (
        <MobilePreview logoUrl={logoUrl} color={color} businessName={name} />
      ),
    },
  ];

  if (!logoData) {
    return (
      <div className={`${className} p-8 text-center`}>
        <Eye className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Logo Preview
        </h3>
        <p className="text-gray-600">
          Upload a logo to see how it will appear on your booking pages
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Logo Preview
        </h3>
        <p className="text-sm text-gray-600">
          See how your logo will appear across your booking site
        </p>
      </div>

      <div className="space-y-6">
        {previewContexts.map((context, index) => (
          <div key={index} className="space-y-3">
            <div className="flex items-center space-x-2">
              {context.icon}
              <div>
                <h4 className="text-sm font-medium text-gray-900">
                  {context.name}
                </h4>
                <p className="text-xs text-gray-600">
                  {context.description}
                </p>
              </div>
            </div>
            
            <div className="transform scale-75 origin-top-left">
              {context.renderPreview(logoData.dataUrl, primaryColor, businessName)}
            </div>
          </div>
        ))}
      </div>

      {/* Preview note */}
      <div className="mt-6 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-start">
          <Eye className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Live Preview</p>
            <p>
              This preview shows how your logo will appear to customers. 
              The actual placement may vary slightly based on your content.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
