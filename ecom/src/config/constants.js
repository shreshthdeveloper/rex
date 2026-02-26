const orgSlug = (import.meta.env.VITE_ORG_SLUG || 'demo-store').trim();
const apiPrefix = (import.meta.env.VITE_API_BASE_PREFIX || '/api/store').replace(/\/$/, '');

export const ORG_SLUG = orgSlug;
export const API_BASE = `${apiPrefix}/${ORG_SLUG}`;
export const CURRENCY = '₹';
export const STORE_NAME = 'REX STORE';
