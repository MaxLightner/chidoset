export const watchMarkup='<span class="watch-spinner" aria-hidden="true"></span><strong data-watch-title>محیط سه‌بعدی در حال آماده‌شدن است</strong><p data-watch-message>در حال بارگذاری ابزارهای نمایش…</p><ol class="watch-steps"><li data-step="account">حساب عامل فروش</li><li data-step="request">ثبت درخواست نمایش</li><li data-step="received">دریافت اعلان در AR</li><li data-step="approved">تأیید در AR</li></ol><progress data-watch-progress aria-label="مدل‌های بارگذاری‌شده" hidden></progress><button type="button" data-watch-retry hidden>تلاش دوباره</button>';
const labels={account:'حساب تأیید شد',request:'درخواست ثبت شد',received:'اعلان در AR دریافت شد',approved:'نمایش در AR تأیید شد'};
export function renderWatchState(root,state){
 root.hidden=state.phase==='connected';root.dataset.phase=state.phase;
 root.setAttribute('aria-busy',String(['requesting','requested','seen','loading','camera'].includes(state.phase)));
 root.querySelector('[data-watch-title]').textContent=state.label;
 root.querySelector('[data-watch-message]').textContent=state.message;
 const flags={account:true,request:state.requested,received:state.received,approved:state.approved};
 for(const [key,done] of Object.entries(flags)){const li=root.querySelector('[data-step='+key+']');li.dataset.done=String(!!done);li.textContent=done?'✓ '+labels[key]:labels[key].replace(/ شد$/,'')+' — در انتظار';}
 const progress=root.querySelector('[data-watch-progress]');progress.hidden=!state.approved||state.total===undefined;progress.max=Math.max(1,state.total||0);progress.value=state.total===0?1:state.loaded||0;
 root.querySelector('[data-watch-retry]').hidden=!['error','model-error','rejected','ended','requested','camera'].includes(state.phase);
}
