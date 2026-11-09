// Marketing/storefront demo data stays separate from the real company workspace.
// Workspace and application links share the backend configured in ../backend-config.js.
import {CHIDO_URLS, deployedChidoHost} from '../chido-urls.js';
const hosted = deployedChidoHost() || globalThis.location?.hostname.endsWith('.chatgpt.site');
const applicationRoot = hosted ? CHIDO_URLS.application : new URL('../', import.meta.url).href;
export const CHIDO_CONFIG = Object.freeze({
  mode: 'frontend-demo',
  workspaceUrl: hosted ? new URL('login.html', CHIDO_URLS.website).href : new URL('login.html', applicationRoot).href,
  centralUrl: hosted ? CHIDO_URLS.central : new URL('central.html', applicationRoot).href,
  applicationUrl: hosted ? CHIDO_URLS.application : new URL('index.html', applicationRoot).href,
  domain: 'chidoset.ir',
  endpoints: {
    api: '',
    assets: '',
    otpSend: '',
    otpVerify: '',
    catalog: '',
    campaigns: '',
    mediaUpload: '',
    checkout: '',
  },
  auth: { rememberDays: 30, requireVerifiedPhone: true },
  features: {
    liveAuthentication: false,
    liveCommerce: false,
    automaticCampaigns: false,
    telegramPublishing: false,
    accounting: false,
  },
});

export const SAMPLE_PRODUCTS = [
  { id: 'aria', name: 'مبل آریا', subtitle: 'سه‌نفره مدرن', category: 'راحتی', price: 34500000, stock: 8, variant: 0, colors: ['#d7c6ad','#8eaba3','#b58c7f'], color: '#d7c6ad', material: 'بوکله کرم', imageCount: 4 },
  { id: 'nava', name: 'مبل نوا', subtitle: 'ال مینیمال', category: 'ال', price: 49800000, stock: 4, variant: 1, colors: ['#345f69','#b9b3a5','#c68b69'], color: '#345f69', material: 'مخمل مات', imageCount: 6 },
  { id: 'roza', name: 'مبل رُزا', subtitle: 'ماژولار لوکس', category: 'راحتی', price: 42600000, stock: 11, variant: 2, colors: ['#bb7960','#d7d0be','#66796d'], color: '#bb7960', material: 'کتان بافت‌دار', imageCount: 5 },
];

export function createApiAdapter() {
  const unavailable = async () => { throw new Error('این قابلیت پس از اتصال زیرساخت فعال می‌شود.'); };
  return {
    sendOtp: unavailable,
    verifyOtp: unavailable,
    getSession: unavailable,
    getCatalog: unavailable,
    saveProduct: unavailable,
    uploadMedia: unavailable,
    approveCampaign: unavailable,
    checkout: unavailable,
  };
}
