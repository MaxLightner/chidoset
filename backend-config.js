// Public browser configuration. Service credentials belong only in Edge Functions.
export const SUPABASE_URL = 'https://zeeztpblibcqtxompvxa.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sIWVZUTe8gWC6F6stYuUEg_HjzoBiOr';
export const CHIDO_API_URL = SUPABASE_URL + '/functions/v1/chido-api';

// Private Supabase Storage uses signed URLs. Set this only for a future public/CDN asset host.
export const ASSET_BASE_URL = String(globalThis.CHIDO_ASSET_BASE_URL || '').replace(/\/+$/, '');
