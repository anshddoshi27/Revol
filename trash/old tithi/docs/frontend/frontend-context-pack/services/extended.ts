import { apiClient, generateIdempotencyKey } from '../apiClient';
import { endpoints } from '../endpoints';
import { FeatureFlag, NotificationTemplate, Payment, RevenueAnalytics } from '../types/core';

export const payments = {
	createIntent: async (payload: { booking_id: string; amount_cents: number; currency_code: string; payment_method?: string; }): Promise<any> => {
		const { data } = await apiClient.post(endpoints.payments.intent, payload, {
			headers: { 'Idempotency-Key': generateIdempotencyKey() },
		});
		return data.payment_intent ?? data;
	},
	confirmIntent: async (payment_intent_id: string, payload: { payment_method_id?: string }): Promise<Payment> => {
		const { data } = await apiClient.post(`${endpoints.payments.intent}/${payment_intent_id}/confirm`, { payment_intent_id, ...payload }, {
			headers: { 'Idempotency-Key': generateIdempotencyKey() },
		});
		return data.payment ?? data;
	},
	listMethods: async (): Promise<any[]> => {
		const { data } = await apiClient.get(endpoints.payments.methods);
		return data.payment_methods ?? data;
	},
	createMethod: async (payload: Record<string, any>): Promise<any> => {
		const { data } = await apiClient.post(endpoints.payments.methods, payload);
		return data.payment_method ?? data;
	},
};

export const promotions = {
	createCoupon: async (payload: Record<string, any>): Promise<any> => {
		const { data } = await apiClient.post(endpoints.promotions.coupons, payload);
		return data.coupon ?? data;
	},
	updateCoupon: async (id: string, payload: Record<string, any>): Promise<any> => {
		const { data } = await apiClient.put(`${endpoints.promotions.coupons}/${id}`, payload);
		return data.coupon ?? data;
	},
	deleteCoupon: async (id: string): Promise<void> => {
		await apiClient.delete(`${endpoints.promotions.coupons}/${id}`);
	},
	validate: async (payload: { code: string; }): Promise<{ valid: boolean; discount_cents?: number; }> => {
		const { data } = await apiClient.post(endpoints.promotions.validate, payload);
		return data;
	},
};

export const notifications = {
	listTemplates: async (): Promise<NotificationTemplate[]> => {
		const { data } = await apiClient.get(endpoints.notifications.templates);
		return data.templates ?? data;
	},
	createTemplate: async (payload: Partial<NotificationTemplate>): Promise<NotificationTemplate> => {
		const { data } = await apiClient.post(endpoints.notifications.templates, payload);
		return data.template ?? data;
	},
	updateTemplate: async (id: string, payload: Partial<NotificationTemplate>): Promise<NotificationTemplate> => {
		const { data } = await apiClient.put(`${endpoints.notifications.templates}/${id}`, payload);
		return data.template ?? data;
	},
	sendEmail: async (payload: Record<string, any>): Promise<any> => {
		const { data } = await apiClient.post(endpoints.notifications.sendEmail, payload);
		return data.notification ?? data;
	},
	sendSms: async (payload: Record<string, any>): Promise<any> => {
		const { data } = await apiClient.post(endpoints.notifications.sendSms, payload);
		return data.notification ?? data;
	},
};

export const analytics = {
	revenue: async (params?: Record<string, any>): Promise<RevenueAnalytics> => {
		const { data } = await apiClient.get(`${endpoints.core.analytics}/revenue`, { params });
		return data;
	},
	bookings: async (params?: Record<string, any>): Promise<any> => {
		const { data } = await apiClient.get(`${endpoints.core.analytics}/bookings`, { params });
		return data;
	},
	customers: async (params?: Record<string, any>): Promise<any> => {
		const { data } = await apiClient.get(`${endpoints.core.analytics}/customers`, { params });
		return data;
	},
};

export const featureFlags = {
	list: async (): Promise<FeatureFlag[]> => {
		const { data } = await apiClient.get(endpoints.core.featureFlags);
		return data.feature_flags ?? data;
	},
	isEnabled: (flags: FeatureFlag[], name: string): boolean => {
		const found = flags.find((f) => f.name === name);
		return !!found?.is_enabled;
	},
};

