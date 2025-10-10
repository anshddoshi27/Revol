/**
 * Step5Notifications Page
 * 
 * Fifth step of the onboarding wizard - Notifications.
 * This page allows business owners to create notification templates and configure quiet hours.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotificationTemplates } from '../../hooks/useNotificationTemplates';
import { NotificationTemplateEditor } from '../../components/onboarding/NotificationTemplateEditor';
import { QuietHoursConfig } from '../../components/onboarding/QuietHoursConfig';
import { NotificationPreview } from '../../components/onboarding/NotificationPreview';
import type { 
  NotificationTemplate, 
  NotificationTemplateFormData,
  QuietHoursConfig as QuietHoursConfigType,
  UpdateQuietHoursRequest 
} from '../../api/types/notifications';

export const Step5Notifications: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepData, setStepData] = useState<any>(null);

  // State for UI
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [isConfiguringQuietHours, setIsConfiguringQuietHours] = useState(false);
  const [quietHoursConfig, setQuietHoursConfig] = useState<QuietHoursConfigType>({
    enabled: false,
    start_time: '22:00',
    end_time: '08:00',
    timezone: 'America/New_York',
  });

  // Notification templates hook
  const {
    templates,
    isLoading,
    isSubmitting,
    errors,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getQuietHours,
    updateQuietHours,
    checkTemplateLimit,
    canAddConfirmation,
    canAddReminder,
    totalTemplates,
  } = useNotificationTemplates({
    onTemplateCreated: (template) => {
      console.log('Template created:', template);
      // Emit analytics event
      // telemetry.track('notifications.template_create', {
      //   template_id: template.id,
      //   channel: template.channel,
      //   category: template.category,
      // });
    },
    onTemplateUpdated: (template) => {
      console.log('Template updated:', template);
      // Emit analytics event
      // telemetry.track('notifications.template_update', {
      //   template_id: template.id,
      //   channel: template.channel,
      //   category: template.category,
      // });
    },
    onTemplateDeleted: (templateId) => {
      console.log('Template deleted:', templateId);
      // Emit analytics event
      // telemetry.track('notifications.template_delete', {
      //   template_id: templateId,
      // });
    },
  });

  // Load step data and quiet hours on mount
  useEffect(() => {
    // Get prefill data from navigation state
    if (location.state?.step4Data) {
      setStepData(location.state.step4Data);
    }

    // Load quiet hours configuration
    loadQuietHours();

    // Emit analytics event
    // telemetry.track('onboarding.step5_started', {
    //   has_step4_data: !!location.state?.step4Data,
    // });
  }, [location.state]);

  // Load quiet hours configuration
  const loadQuietHours = useCallback(async () => {
    try {
      const config = await getQuietHours();
      if (config) {
        setQuietHoursConfig(config);
      }
    } catch (error) {
      console.error('Failed to load quiet hours:', error);
    }
  }, [getQuietHours]);

  // Handle template creation
  const handleCreateTemplate = useCallback(async (templateData: NotificationTemplateFormData) => {
    const template = await createTemplate(templateData);
    if (template) {
      setIsEditingTemplate(false);
      setEditingTemplate(null);
      return true;
    }
    return false;
  }, [createTemplate]);

  // Handle template update
  const handleUpdateTemplate = useCallback(async (templateData: NotificationTemplateFormData) => {
    if (!editingTemplate?.id) return false;
    
    const template = await updateTemplate(editingTemplate.id, templateData);
    if (template) {
      setIsEditingTemplate(false);
      setEditingTemplate(null);
      return true;
    }
    return false;
  }, [editingTemplate, updateTemplate]);

  // Handle template deletion
  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      await deleteTemplate(templateId);
    }
  }, [deleteTemplate]);

  // Handle quiet hours update
  const handleQuietHoursUpdate = useCallback(async (config: UpdateQuietHoursRequest) => {
    const success = await updateQuietHours(config);
    if (success) {
      setQuietHoursConfig({
        enabled: config.enabled,
        start_time: config.start_time,
        end_time: config.end_time,
        timezone: config.timezone,
      });
      setIsConfiguringQuietHours(false);
    }
    return success;
  }, [updateQuietHours]);

  // Handle continue to next step
  const handleContinue = useCallback(() => {
    // Validate that at least one confirmation template exists
    const confirmationTemplates = templates.filter(t => t.category === 'confirmation');
    if (confirmationTemplates.length === 0) {
      alert('Please create at least one confirmation template before continuing.');
      return;
    }

    // Emit analytics event
    // telemetry.track('onboarding.step5_complete', {
    //   total_templates: totalTemplates,
    //   confirmation_templates: confirmationTemplates.length,
    //   reminder_templates: templates.filter(t => t.category === 'reminder').length,
    //   quiet_hours_enabled: quietHoursConfig.enabled,
    // });

    // Navigate to next step with form data
    navigate('/onboarding/policies', {
      state: {
        step5Data: {
          templates,
          quietHoursConfig,
        },
        ...stepData,
      },
    });
  }, [navigate, templates, quietHoursConfig, stepData, totalTemplates]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/onboarding/availability', {
      state: {
        step4Data: stepData,
      },
    });
  }, [navigate, stepData]);

  // Get template category display name
  const getCategoryDisplayName = (category: string) => {
    const names: Record<string, string> = {
      confirmation: 'Confirmation',
      reminder: 'Reminder',
      follow_up: 'Follow-up',
      cancellation: 'Cancellation',
      reschedule: 'Reschedule',
    };
    return names[category] || category;
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Notification Templates
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Set up automated messages for your customers
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  Step 5 of 8
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '62.5%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isEditingTemplate ? (
          /* Template Editor */
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4">
              <NotificationTemplateEditor
                template={editingTemplate}
                onSave={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                onCancel={() => {
                  setIsEditingTemplate(false);
                  setEditingTemplate(null);
                }}
                isSubmitting={isSubmitting}
                errors={errors}
                showPreview={true}
                showPlaceholderValidator={true}
              />
            </div>
          </div>
        ) : isConfiguringQuietHours ? (
          /* Quiet Hours Configuration */
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Configure Quiet Hours
                </h2>
                <button
                  type="button"
                  onClick={() => setIsConfiguringQuietHours(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <QuietHoursConfig
                initialConfig={quietHoursConfig}
                onConfigChange={handleQuietHoursUpdate}
                showTimezone={true}
                showPolicyNote={true}
              />
            </div>
          </div>
        ) : (
          /* Main Dashboard */
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Templates
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {totalTemplates} / 3
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Confirmation Templates
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {templates.filter(t => t.category === 'confirmation').length} / 1
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Reminder Templates
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {templates.filter(t => t.category === 'reminder').length} / 2
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900">
                    Notification Templates
                  </h2>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsConfiguringQuietHours(true)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Quiet Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplate(null);
                        setIsEditingTemplate(true);
                      }}
                      disabled={totalTemplates >= 3}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create Template
                    </button>
                  </div>
                </div>

                {/* Templates List */}
                {isLoading ? (
                  <div className="text-center py-8">
                    <svg className="animate-spin mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">Loading templates...</p>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No templates</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Get started by creating your first notification template.
                    </p>
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTemplate(null);
                          setIsEditingTemplate(true);
                        }}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create Template
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {templates.map((template) => (
                      <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {getChannelIcon(template.channel)}
                            </div>
                            <div>
                              <h3 className="text-sm font-medium text-gray-900">
                                {template.name}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {template.channel} • {getCategoryDisplayName(template.category || 'confirmation')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              template.is_active 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {template.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTemplate(template);
                                setIsEditingTemplate(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => template.id && handleDeleteTemplate(template.id)}
                              className="text-red-600 hover:text-red-900 text-sm font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Template Limits Info */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">
                        Template Limits
                      </h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>
                          You can create up to 3 notification templates total:
                        </p>
                        <ul className="mt-1 list-disc list-inside space-y-1">
                          <li>1 confirmation template (required)</li>
                          <li>Up to 2 reminder templates (optional)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </button>

              <button
                type="button"
                onClick={handleContinue}
                disabled={templates.filter(t => t.category === 'confirmation').length === 0}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
