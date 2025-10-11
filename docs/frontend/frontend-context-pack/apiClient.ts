import axios, { AxiosError, AxiosInstance } from 'axios';
import { API_BASE_URL, getToken, DEFAULT_RATE_LIMIT_BACKOFF_MS } from './config';

export interface TithiError {
	type: string;
	title: string;
	status: number;
	detail: string;
	instance: string;
	error_code: string;
	tenant_id?: string;
	user_id?: string;
}

export const handleApiError = (error: AxiosError): TithiError => {
	if (error.response?.data) {
		return error.response.data as TithiError;
	}
	return {
		type: 'about:blank',
		title: 'Unknown Error',
		status: error.response?.status || 500,
		detail: error.message,
		instance: error.config?.url || '',
		error_code: 'UNKNOWN_ERROR',
	};
};

export const generateIdempotencyKey = (): string => {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const createApiClient = (): AxiosInstance => {
	const client = axios.create({
		baseURL: API_BASE_URL,
		headers: { 'Content-Type': 'application/json' },
	});

	client.interceptors.request.use((config) => {
		const token = getToken();
		if (token) {
			config.headers = config.headers || {};
			config.headers['Authorization'] = `Bearer ${token}`;
		}
		return config;
	});

	client.interceptors.response.use(
		(response) => response,
		async (error: AxiosError) => {
			const status = error.response?.status;
			if (status === 429) {
				const retryAfterHeader = (error.response?.headers || {})['retry-after'];
				const retryAfterSec = retryAfterHeader ? parseInt(String(retryAfterHeader)) : 0;
				const delayMs = retryAfterSec > 0 ? retryAfterSec * 1000 : DEFAULT_RATE_LIMIT_BACKOFF_MS;
				await new Promise((r) => setTimeout(r, delayMs));
				return client.request(error.config!);
			}
			return Promise.reject(handleApiError(error));
		}
	);

	return client;
};

export const apiClient = createApiClient();

