export const getTenantSlug = (): string | null => {
	const pathMatch = window.location.pathname.match(/\/v1\/b\/([^\/]+)/);
	if (pathMatch) return pathMatch[1];
	const subdomain = window.location.hostname.split('.')[0];
	return subdomain && subdomain !== 'www' ? subdomain : null;
};

export const requireTenantSlug = (): string => {
	const slug = getTenantSlug();
	if (!slug) throw new Error('Tenant slug not found in URL or subdomain');
	return slug;
};

