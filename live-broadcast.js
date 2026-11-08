// Approved requests and host client IDs are separately generated UUIDs. The
// paired topic is an unguessable, per-approval capability; no public session ID
// is used as a broadcast address. Permanent snapshots remain protected by RLS.
export function approvedLiveTopic(requestId,hostClientId){
 if(!/^[0-9a-f-]{36}$/i.test(requestId||'')||!/^[0-9a-f-]{36}$/i.test(hostClientId||''))return null;
 return 'chido-view-pose:'+requestId+':'+hostClientId;
}
