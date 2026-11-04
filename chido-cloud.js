import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CHIDO_API_URL } from './backend-config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'chido-auth-v1'
  }
});

async function api(path, { body, token, method = 'POST' } = {}) {
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(CHIDO_API_URL + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'ارتباط با سرویس چیدو برقرار نشد.');
  return data;
}

export async function activateBranch(code, deviceLabel = 'Showroom tablet') {
  const result = await api('/activate', { body: { code, device_label: deviceLabel } });
  if (!result.token_hash) throw new Error(result.message || 'کد فعال‌سازی شعبه پذیرفته نشد.');
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: result.token_hash,
    type: result.verification_type || 'magiclink'
  });
  if (error) throw error;
  return getMembership();
}

export async function activateCompanyAdmin(code, email, password) {
  return api('/activate', { body: { code, email, password } });
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  return getMembership();
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  await logActivity(membership, 'layout_request_created', { set_id: setId });
}

export async function getMembership() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;
  const { data, error } = await supabase
    .from('company_memberships')
    .select('id,company_id,branch_id,role,status,companies(name,slug,status,max_layouts_per_set,max_colorways_per_set)')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, user: userData.user, company: data.companies };
}

export async function loadCompanySets(companyId) {
  const { data, error } = await supabase
    .from('sets')
    .select('id,name,description,created_at,set_products(sort_order,products(id,catalog_index,name,asset_path,thumbnail_path)),layouts(id,name,room,template_kind,capacity,scene_state,status),colorways(id,name,material_map,status)')
    .eq('company_id', companyId)
    .eq('status', 'published')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(set => ({
    ...set,
    products: (set.set_products || []).map(item => item.products).filter(Boolean).sort((a, b) => {
      const left = set.set_products.find(x => x.products?.id === a.id)?.sort_order ?? 0;
      const right = set.set_products.find(x => x.products?.id === b.id)?.sort_order ?? 0;
      return left - right;
    }),
    layouts: (set.layouts || []).filter(item => item.status === 'published'),
    colorways: (set.colorways || []).filter(item => item.status === 'published')
  }));
}

export async function saveOfficialLayout({ setId, layoutId = null, name, room, templateKind, capacity, sceneState }) {
  const membership = await getMembership();
  if (!membership || membership.role !== 'company_admin') throw new Error('ذخیره چیدمان رسمی فقط برای مدیر شرکت فعال است.');
  const { data: set, error: setError } = await supabase
    .from('sets')
    .select('id,company_id,companies(max_layouts_per_set)')
    .eq('id', setId)
    .single();
  if (setError) throw setError;
  const limit = set.companies?.max_layouts_per_set ?? 3;
  if (!layoutId) {
    const { count, error: countError } = await supabase
      .from('layouts')
      .select('id', { count: 'exact', head: true })
      .eq('set_id', setId)
      .neq('status', 'archived');
    if (countError) throw countError;
    if (count >= limit) throw new Error('ظرفیت چیدمان‌های رسمی این ست تکمیل شده است؛ یک چیدمان قبلی را به‌روزرسانی کن.');
  }
  const row = {
    set_id: setId,
    name: name.trim(),
    room,
    template_kind: templateKind || 'empty',
    capacity: Number(capacity) || 5,
    scene_state: sceneState,
    status: 'published',
    updated_at: new Date().toISOString()
  };
  if (layoutId) {
    const { data, error } = await supabase.from('layouts').update(row).eq('id', layoutId).select().single();
    if (error) throw error;
    await logActivity(membership, 'official_layout_updated', { set_id: setId, layout_id: data.id });
    return data;
  }
  const { data, error } = await supabase
    .from('layouts')
    .insert({ ...row, created_by: membership.user.id })
    .select()
    .single();
  if (error) throw error;
  await logActivity(membership, 'official_layout_created', { set_id: setId, layout_id: data.id });
  return data;
}

export async function saveOfficialColorway({ setId, colorwayId = null, name, materialMap }) {
  const membership = await getMembership();
  if (!membership || membership.role !== 'company_admin') throw new Error('ذخیره رنگ‌بندی رسمی فقط برای مدیر شرکت فعال است.');
  const { data: set, error: setError } = await supabase
    .from('sets')
    .select('id,company_id,companies(max_colorways_per_set)')
    .eq('id', setId)
    .single();
  if (setError) throw setError;
  const limit = set.companies?.max_colorways_per_set ?? 5;
  if (!colorwayId) {
    const { count, error: countError } = await supabase
      .from('colorways')
      .select('id', { count: 'exact', head: true })
      .eq('set_id', setId)
      .neq('status', 'archived');
    if (countError) throw countError;
    if (count >= limit) throw new Error('ظرفیت رنگ‌بندی‌های رسمی این ست تکمیل شده است؛ یک رنگ‌بندی قبلی را به‌روزرسانی کن.');
  }
  const row = { set_id: setId, name: name.trim(), material_map: materialMap, status: 'published', updated_at: new Date().toISOString() };
  if (colorwayId) {
    const { data, error } = await supabase.from('colorways').update(row).eq('id', colorwayId).select().single();
    if (error) throw error;
    await logActivity(membership, 'official_colorway_updated', { set_id: setId, colorway_id: data.id });
    return data;
  }
  const { data, error } = await supabase
    .from('colorways')
    .insert({ ...row, created_by: membership.user.id })
    .select()
    .single();
  if (error) throw error;
  await logActivity(membership, 'official_colorway_created', { set_id: setId, colorway_id: data.id });
  return data;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function createLiveSession({ sceneState, cameraState, branchId = null }) {
  const membership = await getMembership();
  if (!membership) throw new Error('برای شروع نمایش زنده باید وارد چیدو شوی.');
  let selectedBranch = branchId || membership.branch_id;
  if (!selectedBranch && membership.role === 'company_admin') {
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .eq('company_id', membership.company_id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1);
    if (branchError) throw branchError;
    selectedBranch = branches?.[0]?.id || null;
  }
  if (!selectedBranch) throw new Error('برای این شرکت هنوز شعبه فعالی ثبت نشده است.');
  const rawToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(Date.now() + 45 * 60 * 1000).toISOString();

  const { data: session, error: sessionError } = await supabase
    .from('live_sessions')
    .insert({
      company_id: membership.company_id,
      branch_id: selectedBranch,
      host_user_id: membership.user.id,
      guest_token_hash: tokenHash,
      expires_at: expiresAt
    })
    .select('id,expires_at')
    .single();
  if (sessionError) throw sessionError;

  const { error: sceneError } = await supabase.from('live_session_scenes').insert({
    session_id: session.id,
    scene_state: sceneState,
    updated_at: new Date().toISOString()
  });
  const { error: cameraError } = await supabase.from('live_session_cameras').insert({
    session_id: session.id,
    camera_state: cameraState,
    updated_at: new Date().toISOString()
  });

  if (sceneError || cameraError) {
    await supabase.from('live_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', session.id);
    throw sceneError || cameraError;
  }

  const guestUrl = new URL('guest.html', window.location.href);
  guestUrl.search = '?token=' + encodeURIComponent(rawToken);
  return { id: session.id, token: rawToken, expiresAt: session.expires_at, url: guestUrl.toString() };
}

export async function publishLiveScene(sessionId, sceneState) {
  const { error } = await supabase
    .from('live_session_scenes')
    .update({ scene_state: sceneState, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId);
  if (error) throw error;
}

export async function publishLiveCamera(sessionId, cameraState) {
  const { error } = await supabase
    .from('live_session_cameras')
    .update({ camera_state: cameraState, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId);
  if (error) throw error;
}

export async function stopLiveSession(sessionId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('نشست مدیر معتبر نیست.');
  return api('/live/revoke', { body: { session_id: sessionId }, token: session.access_token });
}

export async function getCompanyDashboard(membership) {
  if (!membership || membership.role !== 'company_admin') throw new Error('این داشبورد برای مدیر شرکت است.');
  const [branches, subscription, sets, activity] = await Promise.all([
    supabase.from('branches').select('id,name,slug,status,created_at').eq('company_id', membership.company_id).order('created_at'),
    supabase.from('subscriptions').select('plan_code,status,starts_at,ends_at').eq('company_id', membership.company_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('sets').select('id,name,status,layouts(id),colorways(id),set_products(product_id)').eq('company_id', membership.company_id),
    supabase.from('activity_events').select('id,event_type,payload,created_at').eq('company_id', membership.company_id).order('created_at', { ascending: false }).limit(12)
  ]);
  for (const result of [branches, subscription, sets, activity]) if (result.error) throw result.error;
  return {
    branches: branches.data || [],
    subscription: subscription.data || null,
    sets: sets.data || [],
    activity: activity.data || []
  };
}

export async function requestCompanyAccess(values) {
  const { error } = await supabase.from('company_access_requests').insert({
    contact_name: values.contact_name.trim(),
    company_name: values.company_name.trim(),
    email: values.email.trim().toLowerCase(),
    phone: (values.phone || '').trim(),
    message: (values.message || '').trim()
  });
  if (error) throw error;
}

export async function logActivity(membership, eventType, payload = {}) {
  if (!membership) return;
  const { error } = await supabase.from('activity_events').insert({
    company_id: membership.company_id,
    branch_id: membership.branch_id,
    user_id: membership.user.id,
    event_type: eventType,
    payload
  });
  if (error) console.warn('Chido activity event failed', error.message);
}

export async function updateDeviceHeartbeat(membership) {
  if (!membership || membership.role !== 'branch') return;
  const { error } = await supabase
    .from('branch_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('user_id', membership.user.id)
    .eq('branch_id', membership.branch_id);
  if (error) console.warn('Chido heartbeat failed', error.message);
}

export async function getApiHealth() {
  return api('/health', { method: 'GET' });
}

export async function guestStatus(token) {
  const response = await fetch(CHIDO_API_URL + '/guest/status?token=' + encodeURIComponent(token), {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
  });
  const data = await response.json().catch(() => ({}));
  return response.ok && data.active === true;
}

export async function authenticateGuest(token) {
  const result = await api('/guest/auth', { body: { token } });
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: result.token_hash,
    type: result.verification_type || 'magiclink'
  });
  if (error) throw error;
  return { sessionId: result.session_id, expiresAt: result.expires_at, user: data.user };
}

export async function requestOfficialLayout({ setId, description }) {
  const membership = await getMembership();
  if (!membership || membership.role !== 'branch') throw new Error('ثبت درخواست از حساب نمایشگاه انجام می‌شود.');
  const { error } = await supabase.from('layout_requests').insert({
    company_id: membership.company_id,
    branch_id: membership.branch_id,
    set_id: setId,
    requested_by: membership.user.id,
    description: description.trim()
  });
  if (error) throw error;
}

export async function archiveOfficialLayout(layoutId) {
  const membership = await getMembership();
  if (!membership || membership.role !== 'company_admin') throw new Error('آرشیو چیدمان رسمی فقط برای مدیر شرکت فعال است.');
  const { data, error } = await supabase.from('layouts')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', layoutId).select('id,set_id').single();
  if (error) throw error;
  await logActivity(membership, 'official_layout_archived', { set_id: data.set_id, layout_id: data.id });
  return data;
}

export async function archiveOfficialColorway(colorwayId) {
  const membership = await getMembership();
  if (!membership || membership.role !== 'company_admin') throw new Error('آرشیو رنگ‌بندی رسمی فقط برای مدیر شرکت فعال است.');
  const { data, error } = await supabase.from('colorways')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', colorwayId).select('id,set_id').single();
  if (error) throw error;
  await logActivity(membership, 'official_colorway_archived', { set_id: data.set_id, colorway_id: data.id });
  return data;
}
