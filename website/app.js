import { CHIDO_CONFIG, SAMPLE_PRODUCTS } from './config.js';
import { mountHero, createProductImages, mountViewer, startAR } from './scene.js';

const $ = selector => document.querySelector(selector);
document.querySelector('[data-open-app]')?.setAttribute('href', CHIDO_CONFIG.applicationUrl);
const $$ = selector => Array.from(document.querySelectorAll(selector));
const money = number => Number(number).toLocaleString('fa-IR') + ' تومان';
const clamp01 = number => Math.max(0, Math.min(1, number));
const smoothstep = number => { const t = clamp01(number); return t * t * (3 - 2 * t); };
const escapeHtml = input => String(input ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const initialState = { products: SAMPLE_PRODUCTS, categories: ['مبل راحتی', 'مبل ال', 'مبلمان مدرن', 'اکسسوری'], storeName: 'فروشگاه نمونه', campaignApproved: false };
let state;
try { state = { ...initialState, ...(JSON.parse(localStorage.getItem('chido-front-demo') || '{}')) }; } catch { state = structuredClone(initialState); }
if (!Array.isArray(state.products) || state.products.length !== 3) state.products = structuredClone(SAMPLE_PRODUCTS);
if (!Array.isArray(state.categories)) state.categories = [...initialState.categories];
let dashboardTab = 'overview', category = 'همه', searchText = '', viewer = null, arController = null, arProduct = null, lastActiveRoute = '';
let toastTimer;
const save = () => { try { localStorage.setItem('chido-front-demo', JSON.stringify(state)); } catch {} };
function toast(message) { const node = $('#toast'); node.textContent = message; node.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 3900); }
function labels() { $('#side-store-name').textContent = state.storeName || 'فروشگاه نمونه'; }

// Scroll selects a chapter; an independent, serialized timeline performs
// the exit and entrance. No two headlines or CTA buttons can overlap.
let displayedStory = 0;
let desiredStory = 0;
let storyIsTransitioning = false;
const storyTitles = [['آریا', 'سه‌نفره مدرن'], ['نوا', 'مبل ال مینیمال'], ['رُزا', 'ماژولار لوکس']];

function updateStoryLabels() {
  $('#story-count').textContent = `0${displayedStory + 1} / 03`;
  $('#model-label').innerHTML = `<span class="model-dot"></span><strong>${storyTitles[displayedStory][0]}</strong><span>${storyTitles[displayedStory][1]}</span>`;
}

function advanceStory() {
  if (storyIsTransitioning || displayedStory === desiredStory) return;
  const panels = $$('.story-panel');
  const direction = desiredStory > displayedStory ? 1 : -1;
  const outgoing = panels[displayedStory];
  const next = displayedStory + direction;
  storyIsTransitioning = true;
  outgoing.style.setProperty('--story-exit-x', `${-direction * 42}px`);
  outgoing.classList.add('is-leaving');
  outgoing.classList.remove('is-active');

  // Exit completely before starting the incoming sheet of text.
  setTimeout(() => {
    outgoing.classList.remove('is-leaving');
    const incoming = panels[next];
    incoming.style.setProperty('--story-enter-x', `${direction * 45}px`);
    displayedStory = next;
    updateStoryLabels();
    requestAnimationFrame(() => {
      incoming.classList.add('is-active');
      setTimeout(() => {
        storyIsTransitioning = false;
        advanceStory();
      }, 610);
    });
  }, 290);
}

function updateStory() {
  const node = $('#scroll-experience');
  if (!node || $('#home-page').hidden) return 0;
  const span = Math.max(1, node.offsetHeight - window.innerHeight + 110);
  const p = clamp01((scrollY - node.offsetTop + 110) / span);
  desiredStory = Math.min(2, Math.floor(p * 3));
  advanceStory();
  $('#track-progress').style.width = Math.round(p * 100) + '%';
  return p;
}

// A time-paced, scroll-directed deck. A large wheel gesture may jump the
// destination, but it cannot skip any individual sheet landing.
let deckVisualPosition = 0;
let deckTargetPosition = 0;
let deckAnimationFrame = 0;
let deckPreviousFrameTime = 0;

function paintFallingCards() {
  const cards = $$('[data-fall-card]');
  const count = cards.length;
  if (!count) return;
  cards.forEach((card, i) => {
    // Only the current sheet can be moving. Earlier sheets stay flat,
    // and later sheets are completely hidden until their turn arrives.
    const t = clamp01(deckVisualPosition - i);
    const inv = t - 1;
    const sheetLanding = t === 0 ? 0 : 1 + 2.4 * inv * inv * inv + 1.4 * inv * inv;
    card.style.setProperty('--fall-y', `${(-255 * (1 - sheetLanding)).toFixed(2)}px`);
    card.style.setProperty('--fall-rotate', `${(85 * (1 - sheetLanding)).toFixed(2)}deg`);
    card.style.setProperty('--fall-tilt', `${((i % 2 ? 1 : -1) * 8 * (1 - sheetLanding)).toFixed(2)}deg`);
    card.style.setProperty('--fall-scale', (0.83 + 0.17 * sheetLanding).toFixed(4));
    card.style.setProperty('--fall-opacity', smoothstep(t * 4.2).toFixed(3));
    card.style.setProperty('--fall-blur', `${(Math.max(0, 1.5 * (1 - t))).toFixed(2)}px`);
    card.style.visibility = t <= 0 ? 'hidden' : 'visible';
    card.style.pointerEvents = t >= 1 ? 'auto' : 'none';
    card.setAttribute('aria-hidden', String(t <= 0));
  });
  const completed = Math.min(count, Math.floor(deckVisualPosition + .0001));
  const number = $('#extras-number');
  if (number) number.textContent = `${Math.max(0, completed).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })} / ${count.toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}`;
  const meter = $('#extras-meter-fill');
  if (meter) meter.style.width = `${Math.round(deckVisualPosition / count * 100)}%`;
}

function animateFallingCards(now) {
  const elapsed = deckPreviousFrameTime ? Math.min(.065, (now - deckPreviousFrameTime) / 1000) : 1 / 60;
  deckPreviousFrameTime = now;
  const distance = deckTargetPosition - deckVisualPosition;
  // Around 400ms per complete sheet, forward AND backward. This rate limit
  // is independent of mouse-wheel speed and the operating system's motion setting.
  const maxStep = elapsed * 2.5;
  deckVisualPosition += Math.max(-maxStep, Math.min(maxStep, distance));
  if (Math.abs(deckTargetPosition - deckVisualPosition) < .0005) deckVisualPosition = deckTargetPosition;
  paintFallingCards();
  if (deckVisualPosition !== deckTargetPosition) {
    deckAnimationFrame = requestAnimationFrame(animateFallingCards);
  } else {
    deckAnimationFrame = 0;
    deckPreviousFrameTime = 0;
  }
}

function updateFallingCards() {
  const stage = $('#extras-stage');
  if (!stage || $('#home-page').hidden) return;
  const count = $$('[data-fall-card]').length;
  if (!count) return;
  const pinnedLayout = innerWidth >= 800 && innerHeight >= 680;
  const position = stage.getBoundingClientRect().top;
  // Keep an unchanged two-row grid. Each separate segment of the scroll
  // timeline lowers precisely ONE card, and rewinding lifts it back up.
  const travel = pinnedLayout
    ? Math.max(1, stage.offsetHeight - innerHeight)
    : Math.max(1, stage.offsetHeight + innerHeight * .34);
  const progress = clamp01((
    (pinnedLayout ? 78 : innerHeight * .8) - position
  ) / travel);
  deckTargetPosition = progress * count;
  if (!deckAnimationFrame) deckAnimationFrame = requestAnimationFrame(animateFallingCards);
}

function updateTyping() {
  const node = $('#cta-typewriter');
  const section = $('#consult');
  if (!node || !section || $('#home-page').hidden) return;
  const text = node.dataset.copy || '';
  const progress = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 1 : clamp01((innerHeight * .82 - section.getBoundingClientRect().top) / (innerHeight * .48));
  const count = Math.round(progress * Array.from(text).length);
  node.textContent = Array.from(text).slice(0, count).join('');
  const reveal = smoothstep((progress - .35) / .65);
  section.style.setProperty('--typed-reveal', reveal.toFixed(3));
  section.style.setProperty('--typed-y', `${((1 - reveal) * 17).toFixed(2)}px`);
  section.classList.toggle('typing-active', progress > 0 && progress < 1);
}

let currentProgress = 0;
let rafPending = false;
function onScroll() {
  if (!rafPending) requestAnimationFrame(() => {
    currentProgress = updateStory();
    updateFallingCards();
    updateTyping();
    rafPending = false;
  });
  rafPending = true;
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
mountHero($('#hero-3d'), () => currentProgress);

const revealObserver = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); } }); }, { rootMargin: '0px 0px -45px 0px', threshold: 0.1 });
function watchReveals() { $$('.reveal:not(.visible)').forEach(node => revealObserver.observe(node)); }

const extraFeatures = [
  ['♧', 'مدیریت مشتریان', 'ثبت و پیگیری ارتباط با مشتریان فروشگاه', 'در نقشه راه'],
  ['▥', 'حسابداری ساده', 'ابزار رایگان و سبک برای مدیریت مالی اولیه', 'به‌زودی'],
  ['⚙', 'پنل مدیریت', 'کنترل محصولات، رنگ‌ها، قیمت و چیدمان فروشگاه', 'پیش‌نمایش فعال'],
  ['▣', 'سازگاری دستگاه‌ها', 'تجربه واکنش‌گرا روی موبایل، تبلت و دسکتاپ', 'بسته به دستگاه'],
  ['✺', 'پشتیبانی هوشمند', 'پاسخ‌گویی راهنما به پرسش‌های پرتکرار در تمام ساعات', 'در نقشه راه'],
  ['✧', 'همکاری تخصصی', 'مسیر همکاری با مجموعه‌های نرم‌افزاری حوزه معماری و چیدمان', 'پس از نهایی‌شدن'],
  ['◫', 'فروشگاه‌ساز', 'فروش آنلاین با کاتالوگ سه‌بعدی محصولات', 'نسخه نمایشی'],
  ['✦', 'کمپین و کاتالوگ', 'پیشنهاد جشنواره، بنر و محتوای کانال تلگرام با تأیید شما', 'در نقشه راه'],
];
$('#extras-grid').innerHTML = extraFeatures.map(([icon, title, description, status], i) => `<article class="extra-card" data-fall-card="${i}"><span class="extra-icon">${icon}</span><h3>${title}</h3><p>${description}</p><span class="status-label">${status}</span></article>`).join('');

function productCard(product) {
  const activeColor = product.color || product.colors[0];
  return `<article class="product-card"><div class="product-image"><img data-sofa-image="${product.variant}" alt="نمای نمونه ${escapeHtml(product.name)}" /><span class="product-badge">${escapeHtml(product.category)}</span></div><div class="product-details"><div class="product-meta"><span>CHIDO / ${escapeHtml(product.id.toUpperCase())}</span><span>● موجود</span></div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.subtitle)}</p><div class="swatches">${product.colors.map(c => `<button class="swatch" style="background:${c};${activeColor===c?'outline:2px solid #2d705c;outline-offset:2px;':''}" data-action="color" data-id="${product.id}" data-color="${c}" aria-label="انتخاب رنگ ${c}"></button>`).join('')}</div><div class="product-price">${money(product.price)} <small>قیمت نمونه</small></div><div class="product-buttons"><button data-action="viewer" data-id="${product.id}">◈ نمایش ۳بعدی</button><button data-action="ar" data-id="${product.id}">⌑ مشاهده AR</button></div></div></article>`;
}
function renderProducts() {
  const products = state.products.filter(p => (category === 'همه' || p.category === category) && (p.name + p.subtitle).includes(searchText));
  $('#products-grid').innerHTML = products.length ? products.map(productCard).join('') : '<div class="dash-card" style="grid-column:1/-1">محصولی با این مشخصات پیدا نشد.</div>';
  createProductImages();
}

function stat(label, value, note) { return `<div class="stat-card"><span>${label}</span><strong>${value}</strong><p>${note}</p></div>`; }
function productRows(editable = false) {
  return state.products.map(p => `<tr><td><div class="product-mini"><img data-sofa-image="${p.variant}" alt=""/><strong>${escapeHtml(p.name)}</strong></div></td><td>${escapeHtml(p.category)}</td><td>${money(p.price)}</td><td>${p.stock} عدد</td><td><button class="link-button" data-action="edit-product" data-id="${p.id}">${editable?'ویرایش':'مشاهده'}</button></td></tr>`).join('');
}
function dashboardOverview() {
  return `<div class="dash-stats">${stat('محصولات نمونه', '۳', 'برای ساخت پیش‌نمایش')}${stat('دسته‌بندی‌ها', state.categories.length.toLocaleString('fa-IR'), 'قابل تغییر در فروشگاه من')}${stat('رسانه‌های نمونه', '۱۵', 'گالری نمایشی')}</div><div class="dash-cols"><section class="dash-card"><div class="dash-card-heading"><h2>محصولات فروشگاه</h2><button class="soft-button" data-action="dash-tab" data-tab="products">مدیریت محصولات ←</button></div><div class="table-wrap"><table class="dash-table"><thead><tr><th>نام محصول</th><th>دسته</th><th>قیمت</th><th>موجودی</th><th></th></tr></thead><tbody>${productRows()}</tbody></table></div></section><section class="dash-card"><h2>مراحل راه‌اندازی</h2><p>مسیر شروع کار با چیدو</p><div class="activity-list"><div class="activity-item"><span class="activity-bullet"></span><div><strong>مشخصات فروشگاه</strong><p>نام و اطلاعات فروشگاه را تنظیم کنید.</p></div></div><div class="activity-item"><span class="activity-bullet"></span><div><strong>اولین محصول</strong><p>تصاویر و مشخصات محصول را اضافه کنید.</p></div></div><div class="activity-item"><span class="activity-bullet"></span><div><strong>مدل سه‌بعدی</strong><p>فرایند ساخت مدل بعداً به سرویس پردازش وصل می‌شود.</p></div></div><div class="activity-item"><span class="activity-bullet"></span><div><strong>انتشار فروشگاه</strong><p>پس از اتصال زیرساخت فعال خواهد شد.</p></div></div></div></section></div>`;
}
function dashboardProducts() {
  return `<section class="dash-card"><div class="dash-card-heading"><div><h2>موجودی، مدل‌ها، پارچه و قیمت</h2><p>محصول نمونه را برای ویرایش انتخاب کنید. تغییرات فقط در این مرورگر ذخیره می‌شوند.</p></div><button class="soft-button" data-action="not-connected">+ محصول جدید</button></div><div class="table-wrap"><table class="dash-table"><thead><tr><th>محصول</th><th>دسته</th><th>قیمت</th><th>موجودی</th><th></th></tr></thead><tbody>${productRows(true)}</tbody></table></div></section><section class="dash-card"><h2>بارگذاری تصاویر و مدل GLB</h2><p>در نسخه نهایی، عکس‌های محصول در این قسمت آپلود می‌شوند و مدل سه‌بعدی پس از آماده‌سازی به محصول متصل می‌شود.</p><button class="soft-button" data-action="not-connected">انتخاب فایل نمونه (به‌زودی)</button></section>`;
}
function dashboardStore() {
  return `<div class="editor-grid"><section class="dash-card"><h2>دسته‌بندی‌های فروشگاه</h2><p>با فلش‌ها ترتیب نمایش را تغییر دهید.</p><div class="dashboard-list">${state.categories.map((c,i)=>`<div class="sort-row"><strong>${escapeHtml(c)}</strong><div><button data-action="move-category" data-index="${i}" data-direction="-1" aria-label="بالا بردن دسته">↑</button><button data-action="move-category" data-index="${i}" data-direction="1" aria-label="پایین بردن دسته">↓</button></div></div>`).join('')}</div><div class="form-row"><button class="soft-button" data-action="not-connected">+ دسته‌بندی جدید</button></div></section><section class="dash-card"><h2>بنرها و چیدمان صفحه</h2><p>بخش‌های نمایشی فروشگاه با تأیید شما منتشر می‌شوند.</p><div class="campaign-preview"><strong>بنر اول:</strong><p>انتخاب مبل مناسب، با واقعیت افزوده</p><span class="chip">نمایش در صفحه اصلی فروشگاه</span></div><div class="campaign-preview"><strong>چیدمان محصولات:</strong><p>مرتب‌سازی محصولات منتخب و پرفروش</p><span class="chip warning">اتصال به داده واقعی: بعداً</span></div></section></div>`;
}
function dashboardGallery() {
  return `<section class="dash-card"><div class="dash-card-heading"><div><h2>گالری رسانه</h2><p>تصاویر کاتالوگ، بنر و عکس‌های ساخته‌شده برای فروشگاه</p></div><button class="soft-button" data-action="not-connected">+ افزودن تصویر</button></div><div class="gallery-grid">${state.products.map(p=>`<div class="gallery-tile"><img data-sofa-image="${p.variant}" alt="رندر نمایشی ${escapeHtml(p.name)}"/><div>رندر نمونه ${escapeHtml(p.name)}</div></div>`).join('')}</div><p style="margin-top:23px">تولید خودکار بنر و ذخیره نسخه‌های نهایی پس از اتصال سرویس رسانه فعال می‌شود.</p></section>`;
}
function dashboardCampaigns() {
  return `<section class="campaign-draft"><p class="eyebrow">پیشنهاد هوشمند / نسخه نمایشی</p><h3>جشنواره انتخاب هوشمند پاییز</h3><p>بنر فروشگاهی، کاتالوگ دیجیتال و محتوای تلگرام پس از اتصال سرویس، برای بررسی شما آماده می‌شود. هیچ پیامی بدون تأیید شما منتشر نخواهد شد.</p><div class="campaign-preview"><strong>پیشنهاد متن کمپین</strong><p>مبل دلخواهتان را قبل از خرید، در خانه خودتان ببینید. مجموعه منتخب این هفته را با واقعیت افزوده تجربه کنید.</p><span class="chip warning">نمونه پیشنهادی — منتشر نشده</span></div><div class="form-row"><button class="pill-btn primary" data-action="campaign-approve">${state.campaignApproved?'تأیید نمایشی ثبت شد':'تأیید پیشنهادی (نمایشی)'} <span>✓</span></button><button class="outline-pill" data-action="not-connected">اتصال کانال تلگرام ↗</button></div></section>`;
}
function dashboardSettings() {
  return `<section class="dash-card"><h2>اطلاعات فروشگاه</h2><p>این فرم فقط تنظیمات نمونه را در مرورگر تغییر می‌دهد.</p><form id="store-settings-form"><div class="settings-grid"><label class="field">نام نمایشی فروشگاه<input name="storeName" value="${escapeHtml(state.storeName)}" required /></label><label class="field">نشانی فروشگاه<select name="storeUrl"><option>دامنه اختصاصی — پس از راه‌اندازی</option></select></label><label class="field">شماره تماس فروشگاه<input placeholder="09xxxxxxxxx" disabled /></label><label class="field">پلن اشتراک<select><option>نسخه نمایشی</option></select></label></div><div class="form-row"><button class="pill-btn primary" type="submit">ذخیره تنظیمات <span>✓</span></button></div></form></section><section class="dash-card"><h2>دسترسی و اتصال‌ها</h2><p>ثبت‌نام پیامکی، مدیریت نشست دستگاه‌ها، درگاه پرداخت و ارسال تلگرام بعداً به API داخلی متصل می‌شوند.</p><span class="chip warning">سرویس واقعی هنوز متصل نیست</span></section>`;
}

const dashboardTabMap = {
  overview: ['صبح بخیر، به چیدو خوش آمدید.', dashboardOverview],
  products: ['محصولات فروشگاه', dashboardProducts],
  store: ['چیدمان فروشگاه من', dashboardStore],
  gallery: ['گالری تصاویر و رسانه', dashboardGallery],
  campaigns: ['کمپین‌ها و جشنواره‌ها', dashboardCampaigns],
  settings: ['تنظیمات فروشگاه', dashboardSettings],
};
function renderDashboard() {
  labels();
  const [title, render] = dashboardTabMap[dashboardTab] || dashboardTabMap.overview;
  $('#dashboard-page-title').textContent = title;
  $$('#dashboard-tabs button').forEach(btn => btn.classList.toggle('active', btn.dataset.dashboardTab === dashboardTab));
  $('#dashboard-content').innerHTML = render();
  createProductImages();
}

function openModal(content) {
  if (viewer) { viewer.dispose(); viewer = null; }
  $('#modal-content').innerHTML = content;
  $('#modal-backdrop').hidden = false;
  document.body.classList.add('modal-open');
}
function closeModal() {
  if (viewer) { viewer.dispose(); viewer = null; }
  $('#modal-backdrop').hidden = true;
  $('#modal-content').replaceChildren();
  document.body.classList.remove('modal-open');
}
function openViewer(id) {
  const p = state.products.find(item => item.id === id);
  if (!p) return;
  openModal(`<div class="viewer-modal-grid"><div class="product-viewer-container" id="viewer-slot"></div><div class="viewer-details"><p class="eyebrow">نمایش سه‌بعدی محصول</p><h2 id="modal-title">${escapeHtml(p.name)}</h2><p>${escapeHtml(p.subtitle)} — مدل سه‌بعدی نمونه برای طراحی سایت</p><div class="product-price">${money(p.price)}</div><p>رنگ پارچه را انتخاب کنید:</p><div class="viewer-color-list">${p.colors.map(c=>`<button data-action="viewer-color" data-color="${c}" class="${(p.color||p.colors[0])===c?'active':''}" style="background:${c}" aria-label="انتخاب رنگ"></button>`).join('')}</div><p class="viewer-hint">با کشیدن انگشت یا ماوس، مدل را بچرخانید.</p><button class="pill-btn primary" data-action="ar" data-id="${p.id}">نمایش محصول در فضای واقعی <span>↗</span></button></div></div>`);
  viewer = mountViewer($('#viewer-slot'), p.variant, p.color);
}
function openEditProduct(id) {
  const p = state.products.find(item => item.id === id);
  if (!p) return;
  openModal(`<h2 id="modal-title">ویرایش ${escapeHtml(p.name)}</h2><p class="modal-intro">نمونه ویرایش موجودی، قیمت و مشخصات پارچه</p><form id="edit-product-form" data-id="${p.id}"><div class="editor-grid"><div class="editor-photo"><img data-sofa-image="${p.variant}" alt="${escapeHtml(p.name)}" /></div><div class="product-edit-grid"><label class="field">نام محصول<input name="name" required value="${escapeHtml(p.name)}" /></label><label class="field">قیمت (تومان)<input type="number" name="price" min="0" required value="${p.price}" /></label><label class="field">موجودی<input type="number" name="stock" min="0" required value="${p.stock}" /></label><label class="field">پارچه<input name="material" required value="${escapeHtml(p.material)}" /></label><label class="field">دسته‌بندی<select name="category"><option ${p.category==='راحتی'?'selected':''}>راحتی</option><option ${p.category==='ال'?'selected':''}>ال</option></select></label></div></div><div class="form-row"><button class="pill-btn primary" type="submit">ذخیره در مرورگر <span>✓</span></button></div></form>`);
  createProductImages();
}
function openLogin() {
  openModal(`<div class="login-form"><span class="form-mark">◈</span><h2 id="modal-title">ورود به چیدو</h2><p class="modal-intro">در نسخه نهایی، ورود اولیه با تأیید شماره و نگهداری نشست روی دستگاه مورد اعتماد انجام می‌شود.</p><form id="login-form"><label>شماره موبایل<input required type="tel" inputmode="numeric" pattern="09[0-9]{9}" placeholder="09xxxxxxxxx" /></label><label class="check-line"><input type="checkbox" checked /><span>این دستگاه را به خاطر بسپار</span></label><button type="submit" class="pill-btn primary">ادامه و دریافت کد تأیید <span>←</span></button></form><div class="form-info"><span>ⓘ</span><p>ارسال پیامک واقعی هنوز وصل نشده است. برای مشاهده بخش مدیریت، وارد داشبورد نمونه شوید.</p></div><button class="demo-entry" data-action="demo-login">ورود به داشبورد نمونه ←</button></div>`);
}

const legalDocs = {
  terms: { title: 'قوانین استفاده', sections: [
    ['۱. ماهیت خدمات', 'چیدو بستری برای نمایش و مدیریت محتوای سه‌بعدی محصولات مبلمان است. امکانات و حدود سرویس در قرارداد نهایی اشتراک تعیین می‌شوند.'],
    ['۲. حساب کاربری', 'ثبت‌نام نهایی نیازمند تأیید مالکیت شماره تماس و رعایت دستورالعمل‌های امنیت حساب خواهد بود. صاحب حساب مسئول دسترسی‌های کاربران زیرمجموعه فروشگاه است.'],
    ['۳. مالکیت تصاویر و مدل‌ها', 'فروشگاه باید مجاز به استفاده از تصاویر، نام تجاری و مشخصات محصولاتی باشد که بارگذاری می‌کند. شرایط استفاده از مدل‌های تولیدشده در قرارداد جداگانه مشخص می‌شود.'],
    ['۴. اشتراک و دوره آزمایشی', 'مدت دوره آزمایشی، تعداد محصولات مجاز، تعرفه‌ها، تمدید و لغو اشتراک پیش از شروع فروش عمومی اعلام خواهند شد.'],
    ['۵. فروش و سفارش', 'قیمت‌ها، موجودی، تحویل، گارانتی و تعهدات فروشگاه در فروش آنلاین مطابق قرارداد فروشگاه و شرایط نهایی پلتفرم مشخص می‌شوند.'],
  ] },
  privacy: { title: 'حریم خصوصی', sections: [
    ['۱. اطلاعات حساب', 'اطلاعات تماس و مشخصات فروشگاه فقط برای ارائه خدمات و مدیریت حساب استفاده خواهند شد؛ جزئیات نگهداری داده پس از راه‌اندازی بک‌اند نهایی می‌شوند.'],
    ['۲. دوربین و واقعیت افزوده', 'دسترسی دوربین فقط پس از اجازه کاربر و برای نمایش AR درخواست می‌شود. طراحی محصول بر پایه پردازش تصویر دوربین روی همان دستگاه است.'],
    ['۳. فایل‌های محصولات', 'عکس‌ها و مدل‌های بارگذاری‌شده با سطح دسترسی مناسب نگهداری می‌شوند. حقوق مالکیت و میزان دسترسی مطابق قرارداد خدمات مشخص می‌شود.'],
    ['۴. امنیت و نشست‌ها', 'در نسخه نهایی، نشست‌های قابل ابطال و روش تأیید دستگاه جدید پیاده‌سازی خواهند شد. این پیش‌نمایش حساب کاربری واقعی ندارد.'],
    ['۵. حذف اطلاعات', 'مسیر درخواست خروجی و حذف اطلاعات فروشگاه پیش از عرضه عمومی تعیین و منتشر خواهد شد.'],
  ] },
};
function renderLegal(which) {
  const doc = legalDocs[which] || legalDocs.terms;
  $('#legal-title').textContent = doc.title;
  $('#legal-content').innerHTML = doc.sections.map(([title,text]) => `<section><h2>${title}</h2><p>${text}</p></section>`).join('');
}

function route() {
  closeModal();
  const path = location.hash.replace(/^#\/?/, '').split('?')[0] || '';
  if (path === 'signup') { location.replace(CHIDO_CONFIG.workspaceUrl); return; }
  const page = path.startsWith('shop') ? 'shop' : path.startsWith('dashboard') ? 'dashboard' : path.startsWith('signup') ? 'signup' : ['terms','privacy'].includes(path) ? 'legal' : 'home';
  $$('.page').forEach(el => { el.hidden = el.id !== `${page}-page`; el.classList.toggle('active-page', !el.hidden); });
  $$('.desktop-nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === page || (page === 'legal' && a.dataset.nav === 'terms')));
  $('#mobile-nav').hidden = true;
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
  if (page === 'shop') renderProducts();
  if (page === 'dashboard') renderDashboard();
  if (page === 'legal') renderLegal(path);
  if (page === 'home') { currentProgress = 0; updateStory(); }
  if (lastActiveRoute !== page) window.scrollTo({ top: 0, behavior: 'instant' });
  lastActiveRoute = page;
  watchReveals();
  createProductImages();
  onScroll();
}

document.addEventListener('click', async event => {
  const navToggle = event.target.closest('#menu-toggle');
  if (navToggle) { const opened = $('#mobile-nav').hidden; $('#mobile-nav').hidden = !opened; navToggle.setAttribute('aria-expanded', String(opened)); return; }
  const close = event.target.closest('#modal-close');
  if (close || event.target === $('#modal-backdrop')) { closeModal(); return; }
  const categoryButton = event.target.closest('[data-category]');
  if (categoryButton) { category = categoryButton.dataset.category; $$('#shop-categories button').forEach(b => b.classList.toggle('active', b === categoryButton)); renderProducts(); return; }
  const dash = event.target.closest('[data-dashboard-tab]');
  if (dash) { dashboardTab = dash.dataset.dashboardTab; renderDashboard(); return; }
  const actionNode = event.target.closest('[data-action]');
  if (!actionNode) return;
  const action = actionNode.dataset.action, id = actionNode.dataset.id;
  if (action === 'login') { location.assign(CHIDO_CONFIG.workspaceUrl); return; }
  if (action === 'demo-login') { closeModal(); location.hash = '#/dashboard'; toast('در حال مشاهده داشبورد نمونه هستید؛ هیچ حساب واقعی ایجاد نشده است.'); return; }
  if (action === 'not-connected') return toast('این امکان پس از اتصال بک‌اند و فضای ذخیره‌سازی فعال خواهد شد.');
  if (action === 'dash-tab') { dashboardTab = actionNode.dataset.tab; renderDashboard(); return; }
  if (action === 'viewer') return openViewer(id);
  if (action === 'edit-product') return openEditProduct(id);
  if (action === 'color') { const p = state.products.find(item => item.id === id); if (p) { p.color = actionNode.dataset.color; save(); renderProducts(); } return; }
  if (action === 'viewer-color') { $$('.viewer-color-list button').forEach(b => b.classList.toggle('active', b === actionNode)); viewer?.setColor(actionNode.dataset.color); return; }
  if (action === 'ar') { await showAR(id); return; }
  if (action === 'move-category') { const i=Number(actionNode.dataset.index), j=i+Number(actionNode.dataset.direction); if (j<0 || j>=state.categories.length) return; [state.categories[i],state.categories[j]]=[state.categories[j],state.categories[i]]; save(); renderDashboard(); return; }
  if (action === 'campaign-approve') { state.campaignApproved = true; save(); renderDashboard(); toast('تأیید فقط برای پیش‌نمایش ثبت شد؛ هیچ کمپینی منتشر نشد.'); return; }
});

document.addEventListener('submit', event => {
  if (event.target.id === 'signup-form') {
    event.preventDefault();
    const data = new FormData(event.target);
    state.storeName = String(data.get('storeName') || 'فروشگاه نمونه').trim(); save();
    toast('فرم نمایشی است؛ ارسال پیامک و ایجاد حساب پس از اتصال بک‌اند فعال می‌شود.');
    return;
  }
  if (event.target.id === 'login-form') { event.preventDefault(); toast('ارسال پیامک در این نسخه نمایشی فعال نیست.'); return; }
  if (event.target.id === 'store-settings-form') { event.preventDefault(); state.storeName = String(new FormData(event.target).get('storeName') || '').trim() || 'فروشگاه نمونه'; save(); renderDashboard(); toast('تنظیمات در همین مرورگر ذخیره شد.'); return; }
  if (event.target.id === 'edit-product-form') {
    event.preventDefault(); const data=new FormData(event.target); const p=state.products.find(item=>item.id===event.target.dataset.id);
    if (p) { p.name=String(data.get('name')).trim(); p.price=Math.max(0,Number(data.get('price'))||0); p.stock=Math.max(0,Number(data.get('stock'))||0); p.material=String(data.get('material')).trim(); p.category=String(data.get('category')); save(); closeModal(); renderDashboard(); toast('تغییرات نمونه در مرورگر ذخیره شد.'); } return;
  }
});

$('#shop-search').addEventListener('input', e => { searchText = e.target.value.trim(); renderProducts(); });
$('#demo-dashboard').addEventListener('click', () => { location.hash = '#/dashboard'; toast('داشبورد نمونه، بدون ورود واقعی'); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

async function showAR(id) {
  const p = state.products.find(item => item.id === id); if (!p) return;
  closeModal();
  const shell = $('#ar-shell'); shell.hidden = false; arProduct = p;
  $('#ar-message').textContent = 'دوربین را به سمت کف بگیرید.';
  $('#ar-colors').innerHTML = p.colors.map(c=>`<button style="background:${c}" data-color="${c}" aria-label="انتخاب رنگ"></button>`).join('');
  arController = await startAR(shell, p.variant, p.color, text => { $('#ar-message').textContent = text; });
  if (!arController) { shell.hidden = true; openViewer(id); toast('AR روی این دستگاه در دسترس نبود؛ نمای سه‌بعدی باز شد.'); }
}
$('#ar-exit').addEventListener('click', async()=>{ await arController?.stop(); arController=null; $('#ar-shell').hidden=true; });
$('#ar-rotate-left').addEventListener('click',()=>arController?.rotate(-Math.PI/12));
$('#ar-rotate-right').addEventListener('click',()=>arController?.rotate(Math.PI/12));
$('#ar-reset').addEventListener('click',()=>arController?.reset());
$('#ar-colors').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b)return; arController?.setColor(b.dataset.color); $$('#ar-colors button').forEach(el=>el.classList.toggle('active',el===b)); });

window.addEventListener('hashchange', route);
window.addEventListener('pageshow', onScroll);
route();
watchReveals();
setTimeout(() => createProductImages(), 400);
