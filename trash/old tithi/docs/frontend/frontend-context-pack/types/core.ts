export interface Tenant {
	id: string;
	slug: string;
	name: string;
	description?: string;
	timezone: string;
	logo_url?: string;
	primary_color: string;
	settings?: Record<string, any>;
	created_at?: string;
	updated_at?: string;
}

export interface Service {
	id: string;
	tenant_id: string;
	name: string;
	description: string;
	duration_minutes: number;
	price_cents: number;
	category?: string;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Booking {
	id: string;
	tenant_id: string;
	customer_id: string;
	service_id: string;
	resource_id: string;
	start_at: string;
	end_at: string;
	status: BookingStatus;
	attendee_count?: number;
	client_generated_id?: string;
	created_at?: string;
	updated_at?: string;
}

export type PaymentStatus = 'requires_action' | 'succeeded' | 'failed' | 'cancelled';
export type PaymentMethodType = 'card' | 'apple_pay' | 'google_pay' | 'paypal';

export interface Payment {
	id: string;
	tenant_id: string;
	booking_id: string;
	customer_id: string;
	amount_cents: number;
	currency_code: string;
	status: PaymentStatus;
	method: PaymentMethodType;
	provider_payment_id: string;
	created_at?: string;
	updated_at?: string;
}

export interface AvailabilitySlot {
	resource_id: string;
	service_id: string;
	start_time: string;
	end_time: string;
	is_available: boolean;
}

export interface NotificationTemplate {
	id: string;
	tenant_id: string;
	name: string;
	channel: 'email' | 'sms' | 'push';
	subject?: string;
	content: string;
	variables?: Record<string, any>;
	required_variables?: string[];
	trigger_event?: string;
	category?: string;
	is_active: boolean;
}

export interface FeatureFlag {
	name: string;
	is_enabled: boolean;
	context?: Record<string, any>;
}

export interface RevenueAnalytics {
	tenant_id: string;
	period: string;
	total_revenue_cents: number;
	booking_count: number;
	average_booking_value_cents: number;
	no_show_rate: number;
	top_services: Array<{ service_id: string; service_name: string; revenue_cents: number; booking_count: number; }>
}

