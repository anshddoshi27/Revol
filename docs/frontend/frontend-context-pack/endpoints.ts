export const endpoints = {
	public: (slug: string) => ({
		root: `/v1/${slug}`,
		services: `/v1/${slug}/services`,
	}),
	core: {
		tenants: '/api/v1/tenants',
		services: '/api/v1/services',
		bookings: '/api/v1/bookings',
		availability: '/api/v1/availability',
		customers: '/api/v1/customers',
		analytics: '/api/v1/analytics',
		featureFlags: '/api/v1/feature-flags',
	},
	admin: {
		dashboard: '/api/v1/admin/dashboard',
		services: '/api/v1/admin/services',
		bookings: '/api/v1/admin/bookings',
		staff: '/api/v1/admin/staff',
		branding: '/api/v1/admin/branding',
	},
	payments: {
		intent: '/api/v1/payments/intent',
		methods: '/api/v1/payments/methods',
	},
	promotions: {
		coupons: '/api/v1/promotions/coupons',
		validate: '/api/v1/promotions/validate',
	},
	notifications: {
		templates: '/api/v1/notifications/templates',
		notifications: '/api/v1/notifications',
		sendEmail: '/api/v1/notifications/email/send',
		sendSms: '/api/v1/notifications/sms/send',
	},
	health: {
		live: '/health/live',
		ready: '/health/ready',
		metrics: '/metrics',
	},
} as const;

