import { apiClient, generateIdempotencyKey } from '../apiClient';
import { endpoints } from '../endpoints';
import { AvailabilitySlot, Booking, Service as Svc, Tenant } from '../types/core';

export const tenants = {
	list: async (): Promise<Tenant[]> => {
		const { data } = await apiClient.get(endpoints.core.tenants);
		return data.tenants ?? data;
	},
	get: async (id: string): Promise<Tenant> => {
		const { data } = await apiClient.get(`${endpoints.core.tenants}/${id}`);
		return data.tenant ?? data;
	},
	create: async (payload: Partial<Tenant>): Promise<Tenant> => {
		const { data } = await apiClient.post(endpoints.core.tenants, payload, {
			headers: { 'Idempotency-Key': generateIdempotencyKey() },
		});
		return data.tenant ?? data;
	},
	update: async (id: string, payload: Partial<Tenant>): Promise<Tenant> => {
		const { data } = await apiClient.put(`${endpoints.core.tenants}/${id}`, payload);
		return data.tenant ?? data;
	},
};

export const services = {
	list: async (): Promise<Svc[]> => {
		const { data } = await apiClient.get(endpoints.core.services);
		return data.services ?? data;
	},
	create: async (payload: Partial<Svc>): Promise<Svc> => {
		const { data } = await apiClient.post(endpoints.core.services, payload, {
			headers: { 'Idempotency-Key': generateIdempotencyKey() },
		});
		return data.service ?? data;
	},
	update: async (id: string, payload: Partial<Svc>): Promise<Svc> => {
		const { data } = await apiClient.put(`${endpoints.core.services}/${id}`, payload);
		return data.service ?? data;
	},
	remove: async (id: string): Promise<void> => {
		await apiClient.delete(`${endpoints.core.services}/${id}`);
	},
};

export const bookings = {
	list: async (params?: Record<string, any>): Promise<Booking[]> => {
		const { data } = await apiClient.get(endpoints.core.bookings, { params });
		return data.bookings ?? data;
	},
	create: async (payload: Partial<Booking>): Promise<Booking> => {
		const { data } = await apiClient.post(endpoints.core.bookings, payload, {
			headers: { 'Idempotency-Key': generateIdempotencyKey() },
		});
		return data.booking ?? data;
	},
	update: async (id: string, payload: Partial<Booking>): Promise<Booking> => {
		const { data } = await apiClient.put(`${endpoints.core.bookings}/${id}`, payload);
		return data.booking ?? data;
	},
	confirm: async (id: string): Promise<Booking> => {
		const { data } = await apiClient.post(`${endpoints.core.bookings}/${id}/confirm`, {}, {
			headers: { 'Idempotency-Key': generateIdempotencyKey() },
		});
		return data.booking ?? data;
	},
	cancel: async (id: string): Promise<Booking> => {
		const { data } = await apiClient.post(`${endpoints.core.bookings}/${id}/cancel`, {}, {
			headers: { 'Idempotency-Key': generateIdempotencyKey() },
		});
		return data.booking ?? data;
	},
	complete: async (id: string): Promise<Booking> => {
		const { data } = await apiClient.post(`${endpoints.core.bookings}/${id}/complete`, {}, {
			headers: { 'Idempotency-Key': generateIdempotencyKey() },
		});
		return data.booking ?? data;
	},
};

export const availability = {
	get: async (params: { resource_id: string; service_id: string; date: string; }): Promise<AvailabilitySlot[]> => {
		const { data } = await apiClient.get(endpoints.core.availability, { params });
		return data.slots ?? data;
	},
};

export const publicCatalog = {
	listServices: async (slug: string): Promise<Svc[]> => {
		const { data } = await apiClient.get(endpoints.public(slug).services);
		return data.services ?? data;
	},
};

