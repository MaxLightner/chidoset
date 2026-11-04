import { Studio } from './scene.js?v=0.10.0';
import { supabase, authenticateGuest, guestStatus } from './chido-cloud.js?v=0.10.0';

const $ = selector => document.querySelector(selector);
const token = new URLSearchParams(location.search).get('token');
let studio = null;
let channel = null;
let statusTimer = null;
let sessionId = null;

function message(title, text, visible = true) {
  $('#guestMessageTitle').textContent = title;
  $('#guestMessageText').textContent = text;
  $('#guestMessage').hidden = !visible;
}

function setConnection(label, connected = false) {
  $('#guestState').innerHTML = '<i></i> ' + label;
  $('#guestState').classList.toggle('connected', connected);
}

function fitHostAspect(state) {
  const aspect = Number(state?.aspect);
  if (!Number.isFinite(aspect) || aspect < .4 || aspect > 3) return;
  const viewport = $('#viewport');
  const stage = $('.guest-stage');
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const stageAspect = width / Math.max(1, height);
  if (stageAspect > aspect) {
    viewport.style.width = (height * aspect) + 'px';
    viewport.style.height = height + 'px';
  } else {
    viewport.style.width = width + 'px';
    viewport.style.height = (width / aspect) + 'px';
  }
  viewport.style.maxWidth = '100%';
  viewport.style.maxHeight = '100%';
  viewport.style.aspectRatio = String(aspect);
}

function applyScene(state) {
  if (!studio || !state) return;
  studio.clear();
  studio.restoreState(state);
}

function applyCamera(state) {
  if (!studio || !state) return;
  fitHostAspect(state);
  studio.applyExternalCameraState(state);
}

async function loadInitialState() {
  const [sceneResult, cameraResult] = await Promise.all([
    supabase.from('live_session_scenes').select('scene_state').eq('session_id', sessionId).single(),
    supabase.from('live_session_cameras').select('camera_state').eq('session_id', sessionId).single()
  ]);
  if (sceneResult.error) throw sceneResult.error;
  if (cameraResult.error) throw cameraResult.error;
  return { scene: sceneResult.data.scene_state, camera: cameraResult.data.camera_state };
}

async function start() {
  if (!token || token.length < 40) {
    message('لینک نمایش معتبر نیست', 'از فروشنده بخواه QR یا لینک جدیدی ایجاد کند.');
    setConnection('لینک نامعتبر');
    return;
  }

  try {
    const auth = await authenticateGuest(token);
    sessionId = auth.sessionId;
    const initial = await loadInitialState();

    studio = new Studio($('#viewport'), () => {});
    studio.events?.abort();
    studio.applyExternalCameraState(initial.camera);
    fitHostAspect(initial.camera);
    applyScene(initial.scene);

    channel = supabase.channel('chido-guest-' + sessionId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_session_scenes',
        filter: 'session_id=eq.' + sessionId
      }, payload => applyScene(payload.new?.scene_state))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_session_cameras',
        filter: 'session_id=eq.' + sessionId
      }, payload => applyCamera(payload.new?.camera_state))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          setConnection('متصل به نمایش فروشنده', true);
          message('', '', false);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnection('در حال تلاش برای اتصال مجدد');
        }
      });

    statusTimer = setInterval(async () => {
      try {
        const active = await guestStatus(token);
        if (!active) {
          clearInterval(statusTimer);
          if (channel) await supabase.removeChannel(channel);
          studio?.destroy();
          studio = null;
          message('نمایش به پایان رسید', 'فروشنده نمایش زنده را متوقف کرده یا زمان لینک تمام شده است.');
          setConnection('پایان نمایش');
        }
      } catch (error) {
        console.warn('Guest session status check failed', error);
      }
    }, 10000);
  } catch (error) {
    console.error(error);
    message('امکان اتصال به نمایش وجود ندارد', error.message || 'لینک منقضی شده یا دسترسی آن لغو شده است.');
    setConnection('خطا در اتصال');
  }
}

window.addEventListener('pagehide', () => {
  if (statusTimer) clearInterval(statusTimer);
  if (channel) void supabase.removeChannel(channel);
  if (studio) studio.destroy();
});

start();
