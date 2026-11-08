import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const read=name=>readFileSync(join(root,name),'utf8');

test('guest viewer follows the host tracked pose without requesting camera or AR access',()=>{
 const html=read('guest.html'),js=read('guest.js'),watch=read('live-watch.js');
 assert.match(html,/guest\.js/);
 assert.doesNotMatch(html,/<video\b/i);
 assert.doesNotMatch(js,/getUserMedia|requestSession\s*\(|startAR\s*\(/);
 assert.match(js,/authenticateGuest\(token\)/);
 assert.match(js,/ApprovedLiveWatch/);
 assert.match(watch,/this\.viewerCamera\.setPose\(state\)/);
 assert.match(read('live-view-camera.js'),/sceneOverviewBounds/);
 assert.match(watch,/live_session_scenes/);
 assert.match(watch,/live_session_cameras/);
 assert.match(js,/studio\.events\?\.abort\(\)/);
});

test('the host shares scene and camera state, not a screen or camera stream',()=>{
 const app=read('app.js'),cloud=read('chido-cloud.js'),studio=read('studio.js');
 assert.match(app,/createLiveSession\(/);
 assert.match(app,/studio\.cameraSnapshot\(\)/);
 assert.match(app,/publishLiveCamera\(/);
 assert.match(app,/publishLiveScene\(/);
 assert.match(studio,/cameraSnapshot\(\)/);
 assert.match(studio,/applyExternalCameraState\(state\)/);
 assert.match(studio,/this\.onFrame\?\.\(time,frame\)/);
 assert.doesNotMatch(cloud,/getUserMedia|MediaRecorder|RTCPeerConnection/);
});

test('branch recovery is temporary and only managers can save official layouts',()=>{
 const app=read('app.js');
 assert.match(read('app-recovery.js'),/member\.role==='branch'\?globalThis\.sessionStorage:globalThis\.localStorage/);
 assert.match(app,/saveRecovery\(cloudMembership,currentSceneRecord\(\)\)/);
 assert.match(app,/cloudMembership\?\.role!=='company_admin'\|\|!activeCloudSetId/);
 assert.match(app,/saveOfficialLayout/);
});

test('official layouts and colorways are separate records with configurable limits',()=>{
 const cloud=read('chido-cloud.js'),migration=read('supabase/migrations/20261104202352_chido_stage1_reinitialize.sql');
 assert.match(cloud,/saveOfficialLayout/);
 assert.match(cloud,/saveOfficialColorway/);
 assert.match(cloud,/max_layouts_per_set/);
 assert.match(cloud,/max_colorways_per_set/);
 assert.match(migration,/create table public\.layouts/);
 assert.match(migration,/create table public\.colorways/);
 assert.match(migration,/create table public\.products/);
 assert.match(migration,/create table public\.set_products/);
});

test('guest access is scoped to one active session and expires or revokes cleanly',()=>{
 const sql=read('supabase/migrations/20261104203657_chido_membership_rls_recursion_fix.sql');
 const base=read('supabase/migrations/20261104202352_chido_stage1_reinitialize.sql');
 const api=read('supabase/functions/chido-api/index.ts');
 assert.match(base,/private\.chido_guest_session_active\(session_id\)/);
 assert.match(base,/create table public\.live_session_scenes/);
 assert.match(base,/create table public\.live_session_cameras/);
 assert.match(sql,/security definer/);
 assert.match(api,/async function guestAuth/);
 assert.match(api,/async function guestStatus/);
 assert.match(api,/async function revokeLiveSession/);
 assert.match(api,/cleanupGuestAccounts/);
});

test('browser configuration exposes only the publishable key',()=>{
 const config=read('backend-config.js'),cloud=read('chido-cloud.js');
 assert.match(config,/SUPABASE_PUBLISHABLE_KEY/);
 assert.doesNotMatch(config,/SERVICE_ROLE|service_role|secret/i);
 assert.match(cloud,/auth:\s*\{/);
 assert.match(cloud,/storageKey:.*chido-guest-auth-v1.*chido-auth-v1/);
});
