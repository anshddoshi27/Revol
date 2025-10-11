/**
 * NotificationPreview Component
 * 
 * Component for previewing notification templates with sample data.
 * Shows how the template will look when rendered with actual booking data.
 */

import React, { useState, useCallback } from 'react';
import { useNotificationTemplates } from '../../hooks/useNotificationTemplates';
import { SAMPLE_PLACEHOLDER_DATA } from '../../api/types/notifications';
import type { NotificationTemplate, PlaceholderData } from '../../api/types/notifications';

interface NotificationPreviewProps {
  template: NotificationTemplate;
  sampleData?: PlaceholderData;
  onSendTest?: (templateId: string, sampleData: PlaceholderData) => Promise<boolean>;
  className?: string;
  showSendTest?: boolean;
  showSampleDataEditor?: boolean;
}

export const NotificationPreview: React.FC<NotificationPreviewProps> = ({
  template,
  sampleData = SAMPLE_PLACEHOLDER_DATA,
  onSendTest,
  className = '',
  showSendTest = true,
  showSampleDataEditor = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [customSampleData, setCustomSampleData] = useState<PlaceholderData>(sampleData);
  const [testSent, setTestSent] = useState(false);

  const { previewTemplate, sendTestNotification } = useNotificationTemplates();

  // Generate preview content
  const generatePreview = useCallback(async () => {
    if (!template.id) return;

    setIsLoading(true);
    try {
      const content = await previewTemplate(template.id, customSampleData);
      if (content) {
        setPreviewContent(content);
        
        // Generate subject preview for email templates
        if (template.channel === 'email' && template.subject) {
          let subject = template.subject;
          Object.entries(customSampleData).forEach(([key, value]) => {
            subject = subject.replace(new RegExp(`{${key}}`, 'g'), String(value));
          });
          setPreviewSubject(subject);
        }
      }
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setIsLoading(false);
    }
  }, [template, customSampleData, previewTemplate]);

  // Send test notification
  const handleSendTest = useCallback(async () => {
    if (!template.id) return;

    setIsLoading(true);
    try {
      let success = false;
      
      if (onSendTest) {
        success = await onSendTest(template.id, customSampleData);
      } else {
        success = await sendTestNotification(template.id, customSampleData);
      }
      
      if (success) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 3000);
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
    } finally {
      setIsLoading(false);
    }
  }, [template.id, customSampleData, onSendTest, sendTestNotification]);

  // Update sample data
  const updateSampleData = useCallback((field: keyof PlaceholderData, value: string) => {
    setCustomSampleData(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Get channel icon
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'sms':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'push':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.828 7l2.586 2.586a2 2 0 002.828 0L12.828 7H4.828zM4.828 17h8l-2.586-2.586a2 2 0 00-2.828 0L4.828 17z" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Get channel color
  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'email':
        return 'text-blue-600 bg-blue-100';
      case 'sms':
        return 'text-green-600 bg-green-100';
      case 'push':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={`border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${getChannelColor(template.channel)}`}>
              {getChannelIcon(template.channel)}
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {template.name}
              </h3>
              <p className="text-sm text-gray-500 capitalize">
                {template.channel} notification
                {template.category && ` • ${template.category}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={generatePreview}
              disabled={isLoading || !template.id}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview
                </>
              )}
            </button>

            {showSendTest && (
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isLoading || !template.id || testSent}
                className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                  testSent
                    ? 'border-green-300 text-green-700 bg-green-50'
                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                }`}
              >
                {testSent ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Sent!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Test
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sample Data Editor */}
      {showSampleDataEditor && (
        <div className="p-4 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-md p-2"
          >
            <span className="text-sm font-medium text-gray-900">
              Customize Sample Data
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transform transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-3">
              {Object.entries(customSampleData).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => updateSampleData(key as keyof PlaceholderData, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Content */}
      <div className="p-4">
        {previewContent ? (
          <div className="space-y-4">
            {/* Email Subject */}
            {template.channel === 'email' && previewSubject && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Subject</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <p className="text-sm text-gray-900">{previewSubject}</p>
                </div>
              </div>
            )}

            {/* Content */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Content</h4>
              <div className={`border rounded-md p-4 ${
                template.channel === 'email' 
                  ? 'bg-white border-gray-200' 
                  : template.channel === 'sms'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-purple-50 border-purple-200'
              }`}>
                <div className={`text-sm whitespace-pre-wrap ${
                  template.channel === 'email' 
                    ? 'text-gray-900' 
                    : template.channel === 'sms'
                    ? 'text-green-900'
                    : 'text-purple-900'
                }`}>
                  {previewContent}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No preview available</h3>
            <p className="mt-1 text-sm text-gray-500">
              Click "Preview" to generate a preview of your template
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
