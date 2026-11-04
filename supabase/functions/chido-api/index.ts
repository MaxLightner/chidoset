import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Content-Type": "application/json; charset=utf-8",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "aA9!";
}

async function redeemActivationCode(codeValue: string) {
  const code = normalizeCode(codeValue);
  if (code.length < 20 || code.length > 100) return { error: "کد دسترسی معتبر نیست.", status: 400 };
  const codeHash = await sha256(code);
  const { data, error } = await admin
    .from("activation_codes")
    .select("id,company_id,branch_id,role,expires_at,redeemed_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (error || !data || data.redeemed_at || new Date(data.expires_at).getTime() <= Date.now()) {
    return { error: "کد نامعتبر، منقضی یا قبلاً استفاده شده است.", status: 404 };
  }

  const { data: redeemed, error: redeemError } = await admin
    .from("activation_codes")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("redeemed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id,company_id,branch_id,role")
    .maybeSingle();

  if (redeemError || !redeemed) {
    return { error: "این کد هم‌زمان در دستگاه دیگری استفاده شده است.", status: 409 };
  }

  return { code: redeemed };
}

async function activate(req: Request) {
  const body = await req.json().catch(() => ({}));
  const redeemed = await redeemActivationCode(body.code);
  if (redeemed.error) return response({ error: redeemed.error }, redeemed.status);
  const code = redeemed.code;

  if (code.role === "company_admin") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) {
      await admin.from("activation_codes").update({ redeemed_at: null }).eq("id", code.id);
      return response({ error: "ایمیل معتبر و رمز عبور حداقل ۱۰ کاراکتری لازم است." }, 400);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "company_admin", company_id: code.company_id },
    });
    if (createError || !created.user) {
      await admin.from("activation_codes").update({ redeemed_at: null }).eq("id", code.id);
      return response({ error: createError?.message || "ساخت حساب مدیر انجام نشد." }, 400);
    }

    const { error: membershipError } = await admin.from("company_memberships").insert({
      company_id: code.company_id,
      user_id: created.user.id,
      role: "company_admin",
      status: "active",
    });
    if (membershipError) {
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from("activation_codes").update({ redeemed_at: null }).eq("id", code.id);
      return response({ error: "ثبت دسترسی شرکت انجام نشد." }, 500);
    }

    await admin.from("activation_codes").update({ redeemed_user_id: created.user.id }).eq("id", code.id);
    await admin.from("activity_events").insert({
      company_id: code.company_id,
      user_id: created.user.id,
      event_type: "company_admin_activated",
      payload: {},
    });
    return response({ ok: true, role: "company_admin", message: "حساب مدیر شرکت ساخته شد. اکنون با ایمیل و رمز عبور وارد شوید." });
  }

  const syntheticEmail = "branch-" + crypto.randomUUID() + "@device.chido.invalid";
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: randomPassword(),
    email_confirm: true,
    app_metadata: { role: "branch", company_id: code.company_id, branch_id: code.branch_id },
  });
  if (createError || !created.user) {
    await admin.from("activation_codes").update({ redeemed_at: null }).eq("id", code.id);
    return response({ error: createError?.message || "فعال‌سازی شعبه انجام نشد." }, 400);
  }

  const deviceLabel = typeof body.device_label === "string" && body.device_label.trim()
    ? body.device_label.trim().slice(0, 100)
    : "Showroom tablet";

  const { error: membershipError } = await admin.from("company_memberships").insert({
    company_id: code.company_id,
    user_id: created.user.id,
    branch_id: code.branch_id,
    role: "branch",
    status: "active",
  });
  const { error: deviceError } = await admin.from("branch_devices").insert({
    branch_id: code.branch_id,
    user_id: created.user.id,
    device_label: deviceLabel,
  });

  if (membershipError || deviceError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("activation_codes").update({ redeemed_at: null }).eq("id", code.id);
    return response({ error: "ثبت دستگاه نمایشگاه انجام نشد." }, 500);
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("activation_codes").update({ redeemed_at: null }).eq("id", code.id);
    return response({ error: "ساخت نشست امن دستگاه انجام نشد." }, 500);
  }

  await admin.from("activation_codes").update({ redeemed_user_id: created.user.id }).eq("id", code.id);
  await admin.from("activity_events").insert({
    company_id: code.company_id,
    branch_id: code.branch_id,
    user_id: created.user.id,
    event_type: "branch_device_activated",
    payload: { device_label: deviceLabel },
  });

  return response({
    ok: true,
    role: "branch",
    token_hash: tokenHash,
    verification_type: "magiclink",
    message: "دستگاه نمایشگاه فعال شد.",
  });
}

async function guestAuth(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token.length < 40 || token.length > 200) return response({ error: "لینک نمایش معتبر نیست." }, 400);

  const tokenHash = await sha256(token);
  const { data: session, error } = await admin
    .from("live_sessions")
    .select("id,company_id,branch_id,host_user_id,expires_at,revoked_at")
    .eq("guest_token_hash", tokenHash)
    .maybeSingle();

  if (error || !session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    return response({ error: "این نمایش زنده پایان یافته یا لینک آن معتبر نیست." }, 404);
  }

  const { count } = await admin
    .from("live_session_guests")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);
  if ((count ?? 0) >= 50) return response({ error: "ظرفیت مهمان‌های این نمایش تکمیل شده است." }, 429);

  const syntheticEmail = "viewer-" + crypto.randomUUID() + "@guest.chido.invalid";
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: randomPassword(),
    email_confirm: true,
    app_metadata: {
      role: "guest",
      company_id: session.company_id,
      branch_id: session.branch_id,
      host_user_id: session.host_user_id,
      live_session_id: session.id,
    },
  });
  if (createError || !created.user) return response({ error: "ساخت دسترسی مشاهده انجام نشد." }, 500);

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail,
  });
  const tokenHashForAuth = link?.properties?.hashed_token;
  if (linkError || !tokenHashForAuth) {
    await admin.auth.admin.deleteUser(created.user.id);
    return response({ error: "ساخت نشست مشاهده امن انجام نشد." }, 500);
  }

  const { error: guestError } = await admin.from("live_session_guests").insert({
    session_id: session.id,
    user_id: created.user.id,
  });
  if (guestError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return response({ error: "ثبت مهمان نمایش انجام نشد." }, 500);
  }

  return response({
    ok: true,
    session_id: session.id,
    expires_at: session.expires_at,
    token_hash: tokenHashForAuth,
    verification_type: "magiclink",
  });
}

async function cleanupGuestAccounts(sessionId: string) {
  const { data: guests } = await admin.from("live_session_guests").select("user_id").eq("session_id", sessionId);
  for (const guest of guests || []) {
    await admin.auth.admin.deleteUser(guest.user_id);
  }
}

async function revokeLiveSession(req: Request) {
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!bearer) return response({ error: "ورود لازم است." }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: "Bearer " + bearer } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(bearer);
  if (userError || !userData.user) return response({ error: "نشست کاربر معتبر نیست." }, 401);

  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  const { data: session } = await admin
    .from("live_sessions")
    .select("id,company_id,host_user_id,revoked_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.revoked_at) return response({ ok: true });

  let allowed = session.host_user_id === userData.user.id;
  if (!allowed) {
    const { data: membership } = await admin
      .from("company_memberships")
      .select("role")
      .eq("company_id", session.company_id)
      .eq("user_id", userData.user.id)
      .eq("role", "company_admin")
      .eq("status", "active")
      .maybeSingle();
    allowed = !!membership;
  }
  if (!allowed) return response({ error: "اجازه پایان‌دادن به این نمایش را نداری." }, 403);

  await admin.from("live_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);

  await cleanupGuestAccounts(session.id);
  return response({ ok: true, revoked: true });
}

async function guestStatus(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  if (token.length < 40 || token.length > 200) return response({ active: false }, 400);
  const tokenHash = await sha256(token);
  const { data: session } = await admin
    .from("live_sessions")
    .select("id,expires_at,revoked_at")
    .eq("guest_token_hash", tokenHash)
    .maybeSingle();
  const active = !!session && !session.revoked_at && new Date(session.expires_at).getTime() > Date.now();
  if (session && !active) {
    if (!session.revoked_at) await admin.from("live_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);
    await cleanupGuestAccounts(session.id);
  }
  return response({ active, expires_at: session?.expires_at || null });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");

  try {
    if (req.method === "GET" && path.endsWith("/health")) return response({ ok: true, service: "chido-api" });
    if (req.method !== "POST" && !(req.method === "GET" && path.endsWith("/guest/status"))) {
      return response({ error: "Method not allowed." }, 405);
    }
    if (req.method === "POST" && path.endsWith("/activate")) return await activate(req);
    if (req.method === "POST" && path.endsWith("/guest/auth")) return await guestAuth(req);
    if (req.method === "GET" && path.endsWith("/guest/status")) return await guestStatus(req);
    if (req.method === "POST" && path.endsWith("/live/revoke")) return await revokeLiveSession(req);
    return response({ error: "Route not found." }, 404);
  } catch (error) {
    console.error("chido-api", error);
    return response({ error: "درخواست انجام نشد. دوباره تلاش کن." }, 500);
  }
});
