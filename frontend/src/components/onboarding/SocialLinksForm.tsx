/**
 * SocialLinksForm Component
 * 
 * Form component for capturing social media links.
 */

import React from 'react';
import type { SocialLinksData } from '../../api/types/onboarding';

interface SocialLinksFormProps {
  socialLinks: SocialLinksData;
  onChange: (links: Partial<SocialLinksData>) => void;
  errors?: Record<string, string>;
}

export const SocialLinksForm: React.FC<SocialLinksFormProps> = ({
  socialLinks,
  onChange,
  errors = {},
}) => {
  const handleFieldChange = (field: keyof SocialLinksData, value: string) => {
    onChange({ [field]: value });
  };

  const socialFields = [
    {
      key: 'website' as keyof SocialLinksData,
      label: 'Website',
      placeholder: 'https://yourwebsite.com',
      icon: '🌐',
    },
    {
      key: 'instagram' as keyof SocialLinksData,
      label: 'Instagram',
      placeholder: '@yourusername or https://instagram.com/yourusername',
      icon: '📷',
    },
    {
      key: 'facebook' as keyof SocialLinksData,
      label: 'Facebook',
      placeholder: 'https://facebook.com/yourpage',
      icon: '📘',
    },
    {
      key: 'tiktok' as keyof SocialLinksData,
      label: 'TikTok',
      placeholder: '@yourusername or https://tiktok.com/@yourusername',
      icon: '🎵',
    },
    {
      key: 'youtube' as keyof SocialLinksData,
      label: 'YouTube',
      placeholder: 'https://youtube.com/c/yourchannel',
      icon: '📺',
    },
    {
      key: 'x' as keyof SocialLinksData,
      label: 'X (Twitter)',
      placeholder: '@yourusername or https://x.com/yourusername',
      icon: '🐦',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Add your social media profiles to help customers find you online. All fields are optional.
      </div>
      
      {socialFields.map((field) => (
        <div key={field.key}>
          <label htmlFor={field.key} className="block text-sm font-medium text-gray-700">
            <span className="mr-2">{field.icon}</span>
            {field.label}
          </label>
          <input
            type="url"
            id={field.key}
            value={socialLinks[field.key] || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              errors[field.key] ? 'border-red-300' : ''
            }`}
            placeholder={field.placeholder}
          />
          {errors[field.key] && (
            <p className="mt-1 text-sm text-red-600">{errors[field.key]}</p>
          )}
        </div>
      ))}
    </div>
  );
};
