'use strict';
/* ========== STORAGE ========== */
const KEY = 'glowmelan_v1';
const store = {
  get(){ try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch(e){ return null; } },
  set(v){ try { localStorage.setItem(KEY, JSON.stringify(v)); } catch(e){} if (typeof scheduleSync === 'function') scheduleSync(); },   // Plus: cloud me bhi
  raw(v){ try { localStorage.setItem(KEY, JSON.stringify(v)); } catch(e){} },                                                          // sirf phone pe
  clear(){ try { localStorage.removeItem(KEY); } catch(e){} }
};

/* ========== DATA ========== */
// Melanin-rich tones (Fitzpatrick III–VI)
const TONES = [
  { c:'#E6BC98', fz:'III', name:'Light-medium' },
  { c:'#D4A27C', fz:'III', name:'Medium' },
  { c:'#C08A63', fz:'IV',  name:'Tan' },
  { c:'#A9714C', fz:'IV',  name:'Warm brown' },
  { c:'#8E5A3A', fz:'V',   name:'Brown' },
  { c:'#74462C', fz:'V',   name:'Deep brown' },
  { c:'#5A3520', fz:'VI',  name:'Deep' },
  { c:'#3F2516', fz:'VI',  name:'Very deep' }
];
// Simple quiz (AAD bare-face idea, in plain words)
const QUIZ = [
  { id:'feel', q:'An hour after washing your face (no products), how does it feel?', multi:false, options:[
    { v:'dry',   t:'Tight or dry',              s:'Maybe a little flaky' },
    { v:'oily',  t:'Shiny all over',            s:'Forehead, nose and cheeks' },
    { v:'combo', t:'Shiny forehead & nose only', s:'Cheeks feel normal' },
    { v:'normal',t:'Comfortable',               s:'Not oily, not tight' } ]},
  { id:'sens', q:'Do new products sting, itch or make your skin red?', multi:false, options:[
    { v:'yes',  t:'Often' }, { v:'some', t:'Sometimes' }, { v:'no', t:'Rarely' } ]},
  { id:'spots', q:'Do you have dark spots? Where?', multi:false, options:[
    { v:'pih',     t:'Where pimples, bites or cuts were', s:'Small marks left behind' },
    { v:'melasma', t:'Patches on cheeks, forehead or upper lip', s:'Larger, often both sides' },
    { v:'both',    t:'Both' },
    { v:'none',    t:'No dark spots' } ]},
  // Fitzpatrick = dhoop ka reaction, rang nahi
  { id:'sun', q:'After an hour in strong sun without sunscreen, your skin…', multi:false, options:[
    { v:'burn',  t:'Burns a little, then tans' },
    { v:'tan',   t:'Rarely burns, tans easily' },
    { v:'deep',  t:'Almost never burns, gets deeper' },
    { v:'never', t:'Never burns' } ]},
  { id:'scar', q:'Has a cut or pimple ever left a raised, thick scar?', multi:false, options:[
    { v:'yes', t:'Yes', s:'Firm and raised above the skin' }, { v:'no', t:'No' }, { v:'unsure', t:'Not sure' } ]},
  { id:'preg', q:'Are you pregnant, trying, or breastfeeding?', sub:'Some ingredients are best avoided then.', multi:false, options:[
    { v:'yes', t:'Yes' }, { v:'no', t:'No' }, { v:'na', t:'Doesn\'t apply to me' }, { v:'skip', t:'Prefer not to say' } ]},
  { id:'rx', q:'Do you use a skin cream or acne pills prescribed by a doctor?', multi:false, options:[
    { v:'yes', t:'Yes', s:'e.g. tretinoin, isotretinoin, a prescribed cream' }, { v:'no', t:'No' } ]},
  { id:'goals', q:'What do you want to work on?', sub:'Pick all that apply', multi:true, options:[
    { v:'spots',  t:'Dark spots' }, { v:'tone', t:'Uneven tone' }, { v:'acne', t:'Breakouts' },
    { v:'dry',    t:'Dryness' }, { v:'oil', t:'Oiliness' }, { v:'glow', t:'Dullness / glow' } ]}
];
const TYPE_TEXT = {
  dry:   { name:'Dry',         tip:'Your skin needs moisture it can hold on to. Cream cleansers and ceramides will be your friends.' },
  oily:  { name:'Oily',        tip:'Your skin makes extra oil. Light gel textures and gentle exfoliation (not scrubs) keep it balanced.' },
  combo: { name:'Combination', tip:'Oily T-zone, normal cheeks. We will treat each zone a little differently.' },
  normal:{ name:'Normal',      tip:'Your skin is fairly balanced. We will focus on protecting it and your goals.' }
};
const GOAL_TEXT = { spots:'Dark spots', tone:'Uneven tone', acne:'Breakouts', dry:'Dryness', oil:'Oiliness', glow:'Glow' };
const SUN = { burn:{ fz:'III', t:'Burns a little, then tans' }, tan:{ fz:'IV', t:'Rarely burns, tans easily' }, deep:{ fz:'V', t:'Almost never burns' }, never:{ fz:'VI', t:'Never burns' } };

/* ========== SANITIZE (backup aur purana data — sirf jaane-pehchane, sahi values) ========== */
const isStr = (v, max) => typeof v === 'string' && v.length <= max;
const isNum = v => typeof v === 'number' && isFinite(v);
const ID_RE = /^[a-z0-9]{1,24}$/i, DAY_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const oneOf = (v, list) => list.includes(v) ? v : undefined;
function cleanProfile(p){
  if (!p || typeof p !== 'object') return null;
  const tone = Number.isInteger(p.tone) && TONES[p.tone] ? p.tone : null;
  const type = oneOf(p.type, Object.keys(TYPE_TEXT));
  if (tone === null || !type) return null;
  const sun = oneOf(p.sun, Object.keys(SUN));
  return {
    tone, toneColor: TONES[tone].c, toneName: TONES[tone].name,   // rang hamesha apni list se, file se nahi
    sun, fitz: sun ? SUN[sun].fz : undefined, type,
    sensitive: !!p.sensitive, spotType: oneOf(p.spotType, ['pih','melasma','both','none']),
    melasma: !!p.melasma, pihProne: !!p.pihProne, keloid: !!p.keloid, pregnant: !!p.pregnant, rx: !!p.rx,
    goals: Array.isArray(p.goals) ? p.goals.filter(g => GOAL_TEXT[g]) : [],
    createdAt: isNum(p.createdAt) ? p.createdAt : Date.now()
  };
}
function cleanSteps(arr){
  return Array.isArray(arr) ? arr.filter(s => s && ID_RE.test(s.id) && isStr(s.n, 60) && s.n.trim()).slice(0, 20)
    .map(s => ({ id:s.id, n:s.n, w: isStr(s.w, 300) ? s.w : '', t: isStr(s.t, 20) ? s.t : '' })) : [];
}
function cleanState(d, keepPlan){
  const out = { profile: cleanProfile(d && d.profile) };
  if (!d || typeof d !== 'object') return out;
  if (d.log && typeof d.log === 'object'){ out.log = {};
    for (const k of Object.keys(d.log).slice(-800)) if (DAY_RE.test(k)){ const l = d.log[k] || {};
      out.log[k] = { am: Array.isArray(l.am) ? l.am.filter(x => ID_RE.test(x)) : [], pm: Array.isArray(l.pm) ? l.pm.filter(x => ID_RE.test(x)) : [] };
      if (typeof l.pmDone === 'boolean') out.log[k].pmDone = l.pmDone; } }
  if (d.custom && typeof d.custom === 'object') out.custom = { am: cleanSteps(d.custom.am), pm: cleanSteps(d.custom.pm) };
  if (d.city && isStr(d.city.name, 80) && isNum(d.city.lat) && isNum(d.city.lon) && Math.abs(d.city.lat) <= 90 && Math.abs(d.city.lon) <= 180)
    out.city = { name:d.city.name, lat:d.city.lat, lon:d.city.lon };
  out.hardWater = oneOf(d.hardWater, ['yes','no','unsure']);
  if (d.times && TIME_RE.test(d.times.am) && TIME_RE.test(d.times.pm)) out.times = { am:d.times.am, pm:d.times.pm };
  if (d.reminder) out.reminder = true;
  if (d.spots && typeof d.spots === 'object'){ const sp = {};
    for (const k of ['front','left','right']){ const v = d.spots[k]; if (v && isNum(v.x) && isNum(v.y) && v.x >= 0 && v.x <= 1 && v.y >= 0 && v.y <= 1) sp[k] = { x:v.x, y:v.y }; }
    if (Object.keys(sp).length) out.spots = sp; }
  if (keepPlan && isNum(d.cloudAt)) out.cloudAt = d.cloudAt;
  if (d.installed) out.installed = true;
  if (keepPlan && d.cloudOK === true) out.cloudOK = true;   // health data cloud pe — sirf user ki saaf ijazat se (backup file se nahi)
  // Plus status sirf server se aata hai; phone pe cache — backup file se kabhi restore nahi
  if (keepPlan && d.sub && typeof d.sub === 'object' && isStr(d.sub.status, 20) && isNum(d.sub.checkedAt))
    out.sub = { status:d.sub.status, endsAt: isStr(d.sub.endsAt, 40) ? d.sub.endsAt : null, renewsAt: isStr(d.sub.renewsAt, 40) ? d.sub.renewsAt : null,
                variant: isStr(d.sub.variant, 80) ? d.sub.variant : '', portal: isStr(d.sub.portal, 500) && /^https:\/\//.test(d.sub.portal) ? d.sub.portal : '', checkedAt:d.sub.checkedAt };
  if (keepPlan && d.wx && isNum(d.wx.at)) out.wx = { at:d.wx.at, temp:+d.wx.temp||0, hum:+d.wx.hum||0, uv:+d.wx.uv||0, aqi: d.wx.aqi == null ? null : +d.wx.aqi||0 };
  return out;
}
const PHOTO_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
function cleanPhotos(list){
  return Array.isArray(list) ? list.filter(p => p && isNum(p.at) && typeof p.img === 'string' && p.img.length < 400000 && PHOTO_RE.test(p.img))
    .map(p => ({ at:p.at, img:p.img, light: oneOf(p.light, ['good','dark','bright','uneven']) || 'good', side: oneOf(p.side, ['front','left','right']) || 'front' })) : [];
}

/* ========== STATE ========== */
let S = cleanState(store.get(), true);
let draft = { tone:null, answers:{} };
let step = 'welcome';   // welcome | tone | q0..q3 | result | home

/* ========== HELPERS ========== */
const $app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = {
  back:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  check:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1A1208" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
  warn:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F2C97A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>'
};
const STEPS = ['tone', ...QUIZ.map((_, i) => 'q' + i)];
function progressBar(){ const i = STEPS.indexOf(step); return `<div class="progress" aria-label="Step ${i+1} of ${STEPS.length}">${STEPS.map((_,k)=>`<i class="${k<=i?'on':''}"></i>`).join('')}</div>`; }
function topBar(){ return `<div class="top"><button class="back" data-act="back" aria-label="Go back">${icon.back}</button><div class="label">Step ${STEPS.indexOf(step)+1} of ${STEPS.length}</div><div style="width:44px"></div></div>`; }
function go(s){
  step = s; render(); window.scrollTo(0,0);
  const h = $app.querySelector('h1,h2'); if (h) h.focus({ preventScroll:true });   // screen reader nayi screen ki heading se shuru kare
}

/* ========== SKIN TYPE LOGIC ========== */
function computeProfile(){
  const a = draft.answers;
  const t = TONES[draft.tone], sun = SUN[a.sun];
  return {
    tone: draft.tone, toneColor: t.c, toneName: t.name,
    sun: a.sun, fitz: sun.fz,                       // dhoop ke jawab se, rang se nahi
    type: a.feel,
    sensitive: a.sens === 'yes',
    spotType: a.spots,
    melasma: a.spots === 'melasma' || a.spots === 'both',
    pihProne: a.spots === 'pih' || a.spots === 'both' || ((sun.fz === 'V' || sun.fz === 'VI') && a.spots !== 'none'),
    keloid: a.scar === 'yes',
    pregnant: a.preg === 'yes',
    rx: a.rx === 'yes',
    goals: a.goals || [],
    createdAt: S.profile ? S.profile.createdAt : Date.now()   // quiz dobara karne se "dheere shuru" dobara na lage
  };
}

/* ========== SCREENS ========== */
function welcome(){
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px;flex:1">
    <div class="logo">glowmelan</div>
    <h1>Skincare made for <em>your</em> skin.</h1>
    <p class="lead">Dark spots, uneven tone, melasma. Answer a few quick questions and get a routine built for melanin-rich skin.</p>
    <div class="tones" aria-hidden="true" style="grid-template-columns:repeat(8,minmax(0,1fr));gap:6px">${TONES.map(t=>`<span style="height:56px;border-radius:99px;background:${t.c}"></span>`).join('')}</div>
    <p class="small">Takes about 1 minute. Your answers stay on this phone.</p>
    <div class="bottom"><button class="btn" data-act="start">Let's start</button></div>
  </div>`;
}
function toneStep(){
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px;flex:1">
    ${topBar()}${progressBar()}
    <h2>Which tone looks most like your skin?</h2>
    <p class="small">Look at your inner arm or jawline in daylight. Closest is fine.</p>
    <div class="tones" role="group" aria-label="Skin tones">
      ${TONES.map((t,i)=>`<button class="tone" data-tone="${i}" aria-pressed="${draft.tone===i}" aria-label="${t.name}"><span class="sw" style="background:${t.c}"></span><span class="t">${t.name}</span></button>`).join('')}
    </div>
    <div class="bottom"><button class="btn" data-act="next" ${draft.tone===null?'disabled':''}>Continue</button></div>
  </div>`;
}
function quizStep(n){
  const Q = QUIZ[n], val = draft.answers[Q.id];
  const isOn = v => Q.multi ? (val||[]).includes(v) : val === v;
  const can = Q.multi ? (val && val.length) : val;
  return `<div class="fade" style="display:flex;flex-direction:column;gap:18px;flex:1">
    ${topBar()}${progressBar()}
    <h2>${esc(Q.q)}</h2>
    ${Q.sub?`<p class="small">${esc(Q.sub)}</p>`:''}
    <div class="opts" role="group">
      ${Q.options.map(o=>`<button class="opt" data-opt="${o.v}" aria-pressed="${isOn(o.v)}"><span class="dot">${isOn(o.v)?icon.check:''}</span><span>${esc(o.t)}${o.s?`<span class="sub">${esc(o.s)}</span>`:''}</span></button>`).join('')}
    </div>
    <div class="bottom"><button class="btn" data-act="next" ${can?'':'disabled'}>${n===QUIZ.length-1?'See my skin profile':'Continue'}</button></div>
  </div>`;
}
function result(){
  const p = S.profile, T = TYPE_TEXT[p.type];
  return `<div class="fade" style="display:flex;flex-direction:column;gap:16px;flex:1">
    <div class="label">Your skin profile</div>
    <h1 style="font-size:40px">Meet your skin, <em>up close.</em></h1>
    <div class="card" style="display:flex;gap:14px;align-items:center">
      <span style="width:60px;height:60px;border-radius:99px;background:${p.toneColor};outline:2px solid var(--gold);outline-offset:3px;flex-shrink:0"></span>
      <div><div class="label">Tone</div><div class="serif" style="font-size:26px">${esc(p.toneName)}</div>${p.sun?`<div class="small">${esc(SUN[p.sun].t)} in the sun</div>`:''}</div>
    </div>
    <div class="card">
      <div class="label">Skin type</div>
      <div class="serif" style="font-size:30px;margin:2px 0 6px">${T.name}${p.sensitive?' + Sensitive':''}</div>
      <p class="small" style="font-size:14px;color:var(--soft)">${T.tip}</p>
    </div>
    <div class="card"><div class="label" style="margin-bottom:10px">Your goals</div><div class="chips">${p.goals.map(g=>`<span class="chip">${GOAL_TEXT[g]}</span>`).join('')}</div></div>
    ${p.pihProne?`<div class="note">${icon.warn}<div>Your skin can get <b>dark marks</b> after pimples or irritation. Gentle care + daily sunscreen matter most. Avoid harsh scrubs.</div></div>`:''}
    ${p.melasma?`<div class="note">${icon.warn}<div>Patches on the cheeks, forehead or lip may be <b>melasma</b>. Sun, heat, visible light and hormones trigger it. Use a <b>tinted</b> sunscreen daily, and see a dermatologist — melasma often needs prescription treatment.</div></div>`:''}
    ${p.keloid?`<div class="note">${icon.warn}<div>You can get <b>raised scars</b>. Don't pick or squeeze pimples, and see a dermatologist early if you get breakouts.</div></div>`:''}
    ${p.pregnant?`<div class="note">${icon.warn}<div>We picked <b>pregnancy-friendly</b> ingredients for you. Still, check with your doctor before starting anything new.</div></div>`:''}
    <div class="bottom">
      <button class="btn" data-act="home">Build my routine</button>
      <p class="small" style="text-align:center">Guidance only, not a medical diagnosis.</p>
    </div>
  </div>`;
}
/* ========== PRODUCT EXAMPLES (well-known, widely sold; examples only, not endorsements) ========== */
const PRODUCTS = {
  'Cream cleanser':           [['Budget','CeraVe Hydrating Facial Cleanser'],['Splurge','La Roche-Posay Toleriane Hydrating Gentle Cleanser']],
  'Gel cleanser':             [['Budget','CeraVe Foaming Facial Cleanser'],['Splurge','La Roche-Posay Effaclar Purifying Foaming Gel']],
  'Gentle gel cleanser':      [['Budget','CeraVe Foaming Facial Cleanser'],['Splurge','Vanicream Gentle Facial Cleanser']],
  'Gentle cleanser':          [['Budget','CeraVe Hydrating Facial Cleanser'],['Splurge','Vanicream Gentle Facial Cleanser']],
  'Oil cleanser or micellar water': [['Budget','Garnier Micellar Cleansing Water'],['Splurge','Banila Co Clean It Zero Cleansing Balm']],
  'Niacinamide serum':        [['Budget','The Ordinary Niacinamide 10% + Zinc 1%'],['Splurge','Paula\'s Choice 10% Niacinamide Booster']],
  'Vitamin C serum':          [['Budget','The Ordinary Ascorbyl Glucoside Solution 12%'],['Splurge','Naturium Vitamin C Complex Serum']],
  'Azelaic acid':             [['Budget','The Ordinary Azelaic Acid Suspension 10%'],['Splurge','Paula\'s Choice 10% Azelaic Acid Booster']],
  'Salicylic acid (BHA)':     [['Budget','The Ordinary Salicylic Acid 2% Solution'],['Splurge','Paula\'s Choice 2% BHA Liquid Exfoliant']],
  'Light gel moisturizer':    [['Budget','Neutrogena Hydro Boost Water Gel (fragrance-free)'],['Splurge','La Roche-Posay Toleriane Double Repair']],
  'Light moisturizer':        [['Budget','CeraVe PM Facial Moisturizing Lotion'],['Splurge','La Roche-Posay Toleriane Double Repair']],
  'Moisturizer':              [['Budget','CeraVe PM Facial Moisturizing Lotion'],['Splurge','La Roche-Posay Toleriane Double Repair']],
  'Rich moisturizer':         [['Budget','CeraVe Moisturizing Cream'],['Splurge','La Roche-Posay Cicaplast Baume B5']],
  'Sunscreen SPF 30+':        [['Budget','Black Girl Sunscreen SPF 30'],['Splurge','Supergoop! Unseen Sunscreen SPF 40']],
  'Tinted sunscreen SPF 30+': [['Budget','CeraVe Hydrating Mineral Sunscreen Sheer Tint SPF 30'],['Splurge','La Roche-Posay Anthelios Mineral Tinted SPF 50']]
};
const PRODUCT_NOTE = {
  'Tinted sunscreen SPF 30+':'Tints can look ashy on very deep skin. Try a sample and match your shade.',
  'Niacinamide serum':'Both examples are 10%. If your skin is sensitive, a 4–5% niacinamide is gentler and works almost as well.'
};
function productCard(steps){
  const rows = steps.filter(s => PRODUCTS[s.n]);
  if (!rows.length) return '';
  return `<details class="card"><summary style="cursor:pointer;min-height:28px;font-weight:600">What to buy · examples</summary>
    <div style="display:flex;flex-direction:column;gap:14px;margin-top:12px">
      ${rows.map(s => `<div><div class="label" style="margin-bottom:6px">${esc(s.n)}</div>${PRODUCTS[s.n].map(p => `<div style="display:flex;gap:10px;align-items:baseline;font-size:14px;margin-top:4px"><span class="chip" style="padding:3px 9px;font-size:11px;flex-shrink:0">${p[0]}</span><span>${esc(p[1])}</span></div>`).join('')}${PRODUCT_NOTE[s.n]?`<div class="small" style="margin-top:6px">${esc(PRODUCT_NOTE[s.n])}</div>`:''}</div>`).join('')}
      <p class="small">Examples only — any product with the same key ingredient works. We are not paid by these brands. Try new products on a small spot first.</p>
    </div>
  </details>`;
}

/* ========== ROUTINE (built from the profile) ========== */
function buildRoutine(p){
  const g = p.goals, spots = g.includes('spots') || g.includes('tone') || p.pihProne || p.melasma, acne = g.includes('acne');
  const cleanser = { dry:'Cream cleanser', oily:'Gel cleanser', combo:'Gentle gel cleanser', normal:'Gentle cleanser' }[p.type];
  const cleanWhy = { dry:'Look for ceramides or glycerin. Skip foaming soaps.', oily:'Light and foamy. Salicylic acid helps clear pores.', combo:'Mild and fragrance-free. Not too stripping.', normal:'Mild and fragrance-free.' }[p.type];
  const moist = { dry:'Rich moisturizer', oily:'Light gel moisturizer', combo:'Light moisturizer', normal:'Moisturizer' }[p.type];
  let amTreat = null, pmTreat = null;
  if (p.sensitive){ amTreat = { n:'Niacinamide serum', w:'Gentle on sensitive skin. Evens tone, calms redness.' }; }
  else if (spots){ amTreat = { n:'Vitamin C serum', w:'Brightens dark spots. Works best under sunscreen.' }; pmTreat = { n:'Azelaic acid', w:'Fades dark marks without bleaching. Start 3 nights a week.' }; }
  else if (acne){ amTreat = { n:'Niacinamide serum', w:'Calms breakouts and oil.' }; pmTreat = { n:'Salicylic acid (BHA)', w:'Clears pores. Start 3 nights a week.' }; }
  if (acne && !p.sensitive && !pmTreat) pmTreat = { n:'Salicylic acid (BHA)', w:'Clears pores. Start 3 nights a week.' };
  // Pregnancy: salicylic acid ki jagah azelaic acid (aam tor pe pregnancy-friendly)
  if (p.pregnant && pmTreat && pmTreat.n === 'Salicylic acid (BHA)') pmTreat = { n:'Azelaic acid', w:'Calms breakouts and fades marks. Usually considered pregnancy-friendly — check with your doctor.' };
  // Gehri skin + daag: tinted (iron oxide) sunscreen visible light bhi rokta hai
  const sunscreen = spots
    ? { n:'Tinted sunscreen SPF 30+', w:'Most important step. The tint (iron oxides) also blocks visible light, which darkens spots and melasma on deeper skin. Use two finger-lengths for face and neck. Reapply every 2 hours outdoors.' }
    : { n:'Sunscreen SPF 30+', w:'Protects from sun damage. Pick one with no white cast. Use two finger-lengths for face and neck; reapply every 2 hours outdoors.' };
  const am = [
    { id:'am1', n:cleanser, w:cleanWhy, t:'30–60 sec' },
    amTreat && { id:'am2', n:amTreat.n, w:amTreat.w },
    { id:'am3', n:moist, w:'Seals in water so skin stays soft.' },
    { id:'am4', n:sunscreen.n, w:sunscreen.w, key:true }
  ].filter(Boolean);
  const pm = [
    { id:'pm1', n:'Oil cleanser or micellar water', w:'Melts sunscreen and makeup first. Then wash.', t:'1 min' },
    { id:'pm2', n:cleanser, w:'Massage gently with fingertips. Rinse with lukewarm water. Pat dry.', t:'30–60 sec' },
    pmTreat && { id:'pm3', n:pmTreat.n, w:pmTreat.w },
    { id:'pm4', n:moist, w:'Your skin repairs itself at night. Help it.' }
  ].filter(Boolean);
  return { am, pm };
}
// Dheere shuru: pehle 14 din treatment steps (serum/acid) nahi — irritation se naye daag na banen
const TREAT_IDS = ['am2','pm3'], SLOW_DAYS = 14;
const slowEnds = p => (p.createdAt || 0) + SLOW_DAYS * 86400000;
// Poori routine (user ki edit ki hui ya suggested). Treatment steps rokne ka asool dono pe lagta hai.
const fullRoutine = () => S.custom || buildRoutine(S.profile);
const onHold = () => S.profile.rx || Date.now() < slowEnds(S.profile);
const isHeld = s => TREAT_IDS.includes(s.id) && onHold();
function getRoutine(){
  const r = fullRoutine();
  return onHold() ? { am: r.am.filter(s => !isHeld(s)), pm: r.pm.filter(s => !isHeld(s)) } : r;
}
const slowDate = () => new Date(slowEnds(S.profile)).toLocaleDateString(undefined, { day:'numeric', month:'short' });
function routineNote(){
  const p = S.profile, r = fullRoutine(), held = [...r.am, ...r.pm].filter(isHeld).map(s => s.n);
  if (!held.length) return '';
  if (p.rx) return `<div class="note">${icon.warn}<div>You use a treatment from your doctor, so we paused ${esc(held.join(' and '))}. Follow your doctor's plan for actives.</div></div>`;
  return `<div class="note">${icon.warn}<div><b>Starting slow.</b> ${esc(held.join(' and '))} ${held.length > 1 ? 'join' : 'joins'} your routine on ${slowDate()}. Too much at once can irritate skin and leave new dark marks.</div></div>`;
}
const dayKey = (d=new Date()) => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
// pmDone us din ki routine ke hisaab se save hota hai — routine badle to purani streak na toote
const allDone = (steps, ticked) => steps.length > 0 && steps.every(s => (ticked||[]).includes(s.id));   // khaali routine kabhi "done" nahi
function dayDone(key){ const l = (S.log||{})[key]; if (!l) return false; if (l.pmDone != null) return l.pmDone; return allDone(getRoutine().pm, l.pm); }
function streak(){
  let n = 0; const d = new Date();
  if (!dayDone(dayKey(d))) d.setDate(d.getDate()-1);   // aaj ki raat abhi baaki ho to streak na tootay
  while (dayDone(dayKey(d))) { n++; d.setDate(d.getDate()-1); }
  return n;
}
let part = new Date().getHours() < 15 ? 'am' : 'pm';
let tab = 'today';   // today | progress | learn

/* ========== INSTALL + NIGHT REMINDER ========== */
let installEvt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (step === 'home') render(); });
addEventListener('appinstalled', () => { track('install', true); installEvt = null; S.installed = true; store.set(S); if (step === 'home') render(); });
// Roz raat ka calendar alarm (.ics) — bina server ke har phone pe chalta hai
const times = () => S.times || { am:'07:30', pm:'21:30' };
function reminderICS(t){
  const d = new Date(), p = n => String(n).padStart(2,'0'), day = `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`;
  const stamp = new Date().toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
  const ev = (k, hhmm, title) => { const [h, m] = hhmm.split(':'); return ['BEGIN:VEVENT', `UID:glowmelan-${k}-${Date.now()}@glowmelan`, `DTSTAMP:${stamp}`,
    `DTSTART:${day}T${p(h)}${p(m)}00`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY', `SUMMARY:Glowmelan · ${title}`, 'DESCRIPTION:Open Glowmelan and tick off your steps.',
    'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:Time for your ${title}`,'TRIGGER:PT0M','END:VALARM','END:VEVENT']; };
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Glowmelan//EN', ...ev('am', t.am, 'morning skincare'), ...ev('pm', t.pm, 'night skincare'), 'END:VCALENDAR'].join('\r\n');
}
// File dena: iPhone par install ki hui app me download nahi chalta — wahan Share sheet use karo
async function giveFile(text, name, type){
  const blob = new Blob([text], { type });
  try {
    const file = new File([blob], name, { type });
    if (isIOS && navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file] }); return true; }
  } catch(e){ if (e && e.name === 'AbortError') return false; }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
async function downloadReminder(t){
  S.times = t; store.set(S);
  if (await giveFile(reminderICS(t), 'glowmelan-reminders.ics', 'text/calendar')){ S.reminder = true; store.set(S); track('reminder', true); }
  render();
}
const readTimes = () => ({ am: (document.getElementById('remAM')||{}).value || times().am, pm: (document.getElementById('remPM')||{}).value || times().pm });
const timeInputs = () => `<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
  <label class="small" style="display:flex;flex-direction:column;gap:4px">Morning<input id="remAM" type="time" value="${times().am}" class="input" style="min-height:48px"></label>
  <label class="small" style="display:flex;flex-direction:column;gap:4px">Night<input id="remPM" type="time" value="${times().pm}" class="input" style="min-height:48px"></label>
</div>`;

/* ========== EDIT MY ROUTINE ========== */
let editMode = false;
function ensureCustom(){ if (!S.custom) S.custom = JSON.parse(JSON.stringify(buildRoutine(S.profile))); }   // poori copy — ruke hue steps bhi
function editView(){
  const steps = fullRoutine()[part];
  const ibtn = (act, i, label, path, dis) => `<button class="back" data-edit="${act}" data-i="${i}" aria-label="${label}" ${dis?'disabled style="opacity:.3"':''}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg></button>`;
  return `<div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="label">Edit your ${part==='am'?'morning':'night'} routine</div>
    ${steps.map((s,i) => `<div style="display:flex;gap:6px;align-items:center">
      <span style="flex:1;font-weight:600;font-size:15px">${i+1}. ${esc(s.n)}${isHeld(s)?`<span class="sub" style="font-weight:400">${S.profile.rx?'Paused (doctor\'s plan)':'Starts '+slowDate()}</span>`:''}</span>
      ${ibtn('up', i, 'Move '+s.n+' up', '<path d="M6 15l6-6 6 6"/>', i===0)}
      ${ibtn('down', i, 'Move '+s.n+' down', '<path d="M6 9l6 6 6-6"/>', i===steps.length-1)}
      ${ibtn('del', i, 'Remove '+s.n, '<path d="M6 6l12 12M18 6L6 18"/>')}
    </div>`).join('') || '<p class="small">No steps yet.</p>'}
    <form data-form="addstep" style="display:flex;gap:8px">
      <label for="newStep" style="position:absolute;left:-9999px">New step</label>
      <input id="newStep" name="n" class="input" maxlength="40" placeholder="Add a step, e.g. Toner" autocomplete="off" required>
      <button class="btn" style="width:auto;padding:0 18px;min-height:52px">Add</button>
    </form>
    <div class="label" style="margin-top:4px">Reminder times</div>
    ${timeInputs()}
    <button class="btn ghost" data-act="remupdate" style="min-height:48px;font-size:15px">${S.reminder?'Update calendar reminders':'Add reminders to calendar'}</button>
    <div style="display:flex;gap:8px">
      ${S.custom?'<button class="btn ghost" data-act="resetroutine" style="min-height:48px;font-size:15px">Reset to suggested</button>':''}
      <button class="btn" data-act="editdone" style="min-height:48px;font-size:15px">Done</button>
    </div>
  </div>`;
}
function helperCards(){
  let out = '';
  if (!isStandalone() && !S.installed){
    if (installEvt) out += `<div class="card" style="display:flex;gap:14px;align-items:center"><img src="icon-192.png" alt="" width="44" height="44" style="border-radius:12px"><div style="flex:1"><b style="font-weight:600">Install Glowmelan</b><div class="small">Opens like an app, works offline.</div></div><button class="btn" data-act="install" style="width:auto;padding:0 18px;min-height:44px;font-size:15px">Install</button></div>`;
    else if (isIOS) out += `<div class="card" style="display:flex;gap:14px;align-items:center"><img src="icon-192.png" alt="" width="44" height="44" style="border-radius:12px"><div class="small" style="flex:1;font-size:14px;color:var(--soft)"><b style="color:var(--text);font-weight:600">Add to your Home Screen:</b> tap Share, then "Add to Home Screen".</div></div>`;
  }
  if (!S.reminder && !editMode) out += `<div class="card" style="display:flex;flex-direction:column;gap:10px">
    <b style="font-weight:600">Never miss your routine</b>
    <div class="small">Adds a daily morning and night alarm to your phone's calendar.</div>
    ${timeInputs()}
    <button class="btn" data-act="reminder" style="min-height:48px;font-size:15px">Add reminders</button>
  </div>`;
  return out;
}

/* ========== CONFIG (launch se pehle bharna — sab public values hain, secret nahi) ========== */
const CONFIG = {
  supabaseUrl: 'https://icfzayrsxhlzzfudfdok.supabase.co',
  supabaseAnonKey: 'sb_publishable_Cs46KGlqni7w_mpY8krQAg_dA7LT7X-',   // publishable (public) key — secret key kabhi yahan nahi
  // Lemon Squeezy checkout — har plan ka apna link (wahi plan pehle se chuna hua aata hai)
  checkout: { monthly: 'https://glowmelan.lemonsqueezy.com/checkout/buy/b56696f6-ef21-47e3-8188-94b282dd4a6c',
              yearly:  'https://glowmelan.lemonsqueezy.com/checkout/buy/184f7648-a33b-4cb9-8df7-2456ca4dd857' },
  // LIVE karte waqt false karo — warna test-card wali subscriptions bhi Plus de dengi
  allowTestPayments: true
};
// App ab poori MUFT hai (30 Oct 2026): login, payment aur cloud backup band. Wapas lana ho to FREE_APP = false.
const FREE_APP = true;
const AUTH_READY = () => !FREE_APP && !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);      // login ke liye
const READY = () => AUTH_READY() && !!(CONFIG.checkout.monthly && CONFIG.checkout.yearly);     // payment ke liye

/* ========== ACCOUNT (Supabase Auth — email pe 6-digit code, password nahi) ========== */
// Tokens alag key me — backup file me kabhi nahi jate
const AKEY = 'glowmelan_auth';
const auth = {
  get(){ try { const a = JSON.parse(localStorage.getItem(AKEY)); return a && a.access && a.uid ? a : null; } catch(e){ return null; } },
  set(a){ try { a ? localStorage.setItem(AKEY, JSON.stringify(a)) : localStorage.removeItem(AKEY); } catch(e){} }
};
const supaHeaders = token => ({ apikey: CONFIG.supabaseAnonKey, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) });
async function supa(path, opts = {}, ms = 10000){
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(CONFIG.supabaseUrl + path, { ...opts, signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.msg || j.error_description || j.message || 'Request failed'), { status: r.status });
    return j;
  } finally { clearTimeout(t); }
}
const saveSession = j => auth.set({ access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, uid: j.user.id, email: j.user.email });
async function validToken(){
  const a = auth.get(); if (!a) return null;
  if (a.exp - 60000 > Date.now()) return a.access;
  try { saveSession(await supa('/auth/v1/token?grant_type=refresh_token', { method:'POST', headers: supaHeaders(), body: JSON.stringify({ refresh_token: a.refresh }) })); return auth.get().access; }
  catch(e){ if (e.status === 400 || e.status === 401){ auth.set(null); return null; }   // session sach me khatam
    throw e; }   // offline: login rehne do, baad me dobara
}
let authStep = null, authEmail = '', authMsg = '', authBusy = false, authAfter = null;
async function sendCode(email){
  authBusy = true; authMsg = ''; render();
  try { await supa('/auth/v1/otp', { method:'POST', headers: supaHeaders(), body: JSON.stringify({ email, create_user: true }) }, 30000);   // email bhejne me waqt lag sakta hai
    authEmail = email; authStep = 'code'; authMsg = 'We sent a code to ' + email + '. Use the newest email.'; }
  catch(e){ authMsg = e.status === 429 ? 'Too many tries. Wait a minute and try again.' : 'Could not send the code. Check the email and your internet.'; }
  authBusy = false; render(); const i = document.getElementById('authCode'); if (i) i.focus();
}
async function verifyCode(code){
  authBusy = true; authMsg = ''; render();
  try { saveSession(await supa('/auth/v1/verify', { method:'POST', headers: supaHeaders(), body: JSON.stringify({ type:'email', email: authEmail, token: code }) }));
    authStep = null; authMsg = ''; track('signin', true); await refreshSub(true);
    const next = authAfter; authAfter = null; authBusy = false; render(); if (next === 'checkout' && !isPlus()) startCheckout(); return; }
  catch(e){ track('signin-fail', true); authMsg = /expired/i.test(e.message) ? 'That code has expired or was already used. Send a new one.' : 'That code did not work. Use the newest email, or send a new code.'; }
  authBusy = false; render();
}
async function signOut(){
  const t = auth.get(); auth.set(null); S.sub = null; store.raw(S); authStep = null; authMsg = ''; syncDown.done = false; lastUploaded = null; render();
  if (t) supa('/auth/v1/logout', { method:'POST', headers: supaHeaders(t.access) }).catch(() => {});
}

/* ========== PLUS STATUS (server se — Lemon Squeezy webhook likhta hai, app sirf padhti hai) ========== */
const PRICE = { monthly: { p:'$4.99', per:'/month', note:'Billed monthly' }, yearly: { p:'$34.99', per:'/year', note:'Just $2.92 a month · save 40%' } };
function isPlus(){
  if (FREE_APP) return true;   // sab features sab ke liye
  const s = S.sub; if (!s || !auth.get()) return false;                 // login ke bina Plus nahi
  if (Date.now() - s.checkedAt > 14 * 86400000) return false;          // 14 din se server se check nahi hua
  if (['on_trial','active','past_due'].includes(s.status)) return true;
  return s.status === 'cancelled' && !!s.endsAt && Date.parse(s.endsAt) > Date.now();   // cancel ke baad bhi paid period tak
}
// 14 din se server se check nahi hua, aur pichhli dafa Plus tha — "khatam" mat kaho, pehle check karwao (dobara khareed na le)
const subStale = () => !!(S.sub && auth.get() && Date.now() - S.sub.checkedAt > 14 * 86400000 && ['on_trial','active','past_due','cancelled'].includes(S.sub.status));
let subBusy = false;
async function refreshSub(force){
  if (!AUTH_READY() || subBusy) return;
  const a = auth.get(); if (!a) return;
  if (!force && S.sub && Date.now() - S.sub.checkedAt < (isPlus() ? 3600000 : 30000)) return;   // Plus: ghante me ek dafa; free: jaldi (shayad abhi pay kiya)
  subBusy = true;
  try {
    const token = await validToken(); if (!token) throw new Error('signed out');
    const rows = await supa('/rest/v1/subscriptions?select=status,ends_at,renews_at,variant_name,customer_portal_url&user_id=eq.' + encodeURIComponent(a.uid)
      + (CONFIG.allowTestPayments ? '' : '&test_mode=eq.false'), { headers: supaHeaders(token) });
    const r = Array.isArray(rows) && rows[0];
    S.sub = r ? { status: String(r.status), endsAt: r.ends_at || null, renewsAt: r.renews_at || null, variant: r.variant_name || '',
                  portal: typeof r.customer_portal_url === 'string' && /^https:\/\//.test(r.customer_portal_url) ? r.customer_portal_url : '', checkedAt: Date.now() }
              : { status: 'none', checkedAt: Date.now() };
    store.raw(S);
    if (isPlus() && !syncDown.done){ syncDown.done = true; syncDown(); }   // har session me ek dafa cloud se milao
  } catch(e){
    if (e.status === 401 || e.message === 'signed out'){ auth.set(null); S.sub = null; store.set(S); }   // nakli/khatam session
    /* warna offline: purana status chalta rahe (14 din tak) */
  }
  subBusy = false; if (step === 'home') render();
}
/* ========== CLOUD BACKUP + SYNC (Plus) — photos kabhi upload nahi hoti ========== */
const syncPayload = () => ({ profile:S.profile, log:S.log, custom:S.custom, city:S.city, hardWater:S.hardWater, times:S.times, reminder:S.reminder, spots:S.spots });
let syncTimer = null, lastUploaded = null, cloudMsg = '', cloudFail = false;
function scheduleSync(){ clearTimeout(syncTimer); syncTimer = setTimeout(syncUp, 2500); }   // har change ke 2.5 sec baad, ek saath
async function syncUp(){
  if (!AUTH_READY() || !isPlus() || !S.profile || !S.cloudOK) return;
  const a = auth.get(); if (!a) return;
  const json = JSON.stringify(syncPayload()); if (json === lastUploaded) return;
  try {
    const token = await validToken(); if (!token) return;
    await supa('/rest/v1/user_data?on_conflict=user_id', { method:'POST',
      headers: { ...supaHeaders(token), Prefer:'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: a.uid, data: JSON.parse(json), updated_at: new Date().toISOString() }) }, 15000);
    lastUploaded = json; S.cloudAt = Date.now(); cloudFail = false; store.raw(S);
    if (step === 'home' && tab === 'learn') render();
  } catch(e){ cloudFail = true; if (step === 'home' && tab === 'learn') render(); }   // agle change pe dobara
}
// Login ke baad / app khulne pe: cloud me naya data ho to wapas lao
async function syncDown(){
  if (!AUTH_READY() || !isPlus() || !S.cloudOK) return;
  const a = auth.get(); if (!a) return;
  try {
    const token = await validToken(); if (!token) return;
    const rows = await supa('/rest/v1/user_data?select=data,updated_at&user_id=eq.' + encodeURIComponent(a.uid), { headers: supaHeaders(token) }, 15000);
    const row = Array.isArray(rows) && rows[0];
    if (!row){ scheduleSync(); return; }                              // cloud khaali: is phone ka data upload
    const cloud = cleanState(row.data, false); if (!cloud.profile) return;
    const localJson = JSON.stringify(syncPayload());
    const sameAsLocal = JSON.stringify({ profile:cloud.profile, log:cloud.log, custom:cloud.custom, city:cloud.city, hardWater:cloud.hardWater, times:cloud.times, reminder:cloud.reminder, spots:cloud.spots }) === localJson;
    if (sameAsLocal){ lastUploaded = localJson; return; }
    const cloudTime = Date.parse(row.updated_at) || 0;
    const useCloud = !S.profile || (cloudTime > (S.cloudAt || 0) &&
      confirm('Your cloud backup from ' + new Date(cloudTime).toLocaleString() + ' is different from this phone.\n\nOK = use the cloud backup here\nCancel = keep this phone\'s data and save it to the cloud'));
    if (useCloud){
      Object.assign(S, { profile:cloud.profile, log:cloud.log, custom:cloud.custom, city:cloud.city, hardWater:cloud.hardWater, times:cloud.times, reminder:cloud.reminder, spots:cloud.spots });
      S.cloudAt = cloudTime; lastUploaded = JSON.stringify(syncPayload()); store.raw(S);
      cloudMsg = 'Restored from your cloud backup.'; if (step !== 'home') step = 'home'; render();
    } else scheduleSync();
  } catch(e){ /* offline */ }
}

// Checkout se wapas aaye (?paid=1): webhook aane me kuch second lagte hain — thodi der baar baar check
async function afterCheckout(){
  if (!/[?&]paid=1/.test(location.search)) return;
  history.replaceState(null, '', location.pathname);
  // iPhone: install ki hui app se pay kiya to wapsi Safari me hoti hai — yahan login nahi hota
  if (!auth.get()){
    payMsg = 'Payment done! Open Glowmelan from your home screen, or sign in here with the email you paid with, to turn on Plus.';
    if (S.profile){ tab = 'learn'; authStep = 'email'; } render();
    const box = document.getElementById('authEmail'); if (box) box.closest('.card').scrollIntoView({ block:'center' });
    return;
  }
  payMsg = 'Activating Plus…'; render();
  for (let i = 0; i < 10 && !isPlus(); i++){ await refreshSub(true); if (!isPlus()) await new Promise(r => setTimeout(r, 3000)); }
  payMsg = isPlus() ? '' : 'Payment received? It can take a minute. Tap "Check my Plus" in Learn.';
  plusJustOn = isPlus(); track(isPlus() ? 'plus-on' : 'plus-slow', true); render();
}
let billing = 'yearly', payMsg = '', plusJustOn = false;
function paywall(title){
  const P = PRICE[billing];
  const feat = (t, soon) => `<div class="tip"><i style="${soon?'background:#5A4A3E':''}"></i><span>${t}${soon?' <span class="chip" style="padding:2px 8px;font-size:11px;margin-left:4px">Soon</span>':''}</span></div>`;
  return `<div class="card" style="border-color:var(--gold);display:flex;flex-direction:column;gap:14px">
    <div class="label" style="color:var(--gold)">Glowmelan Plus</div>
    <div class="serif" style="font-size:28px;line-height:1.1">${esc(title)}</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${feat('Unlimited weekly photos + compare slider')}
      ${feat('Dark spot tracker — watch one spot fade, week by week')}
      ${feat('Weekly report — nights, mornings, streaks')}
      ${feat('Cloud backup — your routine and streak on any phone')}
    </div>
    <div role="group" aria-label="Billing" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
      ${['monthly','yearly'].map(k => `<button class="opt" data-bill="${k}" aria-pressed="${billing===k}" style="flex-direction:column;align-items:flex-start;gap:2px;min-height:68px;padding:12px 14px">
        <span class="small" style="text-transform:uppercase;letter-spacing:1.2px;font-size:11px">${k}</span>
        <b style="font-weight:700;font-size:18px">${PRICE[k].p}<span class="small" style="font-weight:400"> ${PRICE[k].per}</span></b></button>`).join('')}
    </div>
    <div class="small">${P.note}</div>
    ${authStep ? signInForm('Create a free account so Plus stays yours, on any phone.') : subStale()
      ? `<div class="small">We could not check your Plus for a while. Connect to the internet first.</div><button class="btn" data-act="checkplus">Check my Plus</button>`
      : `<button class="btn" data-act="upgrade">Start 7-day free trial</button>`}
    <div class="small" style="text-align:center">Free for 7 days, then ${P.p}${P.per} — renews automatically until you cancel. Cancel anytime before the trial ends and pay nothing. <a href="terms.html">Terms</a> · <a href="refund.html">Refunds</a></div>
    ${payMsg?`<div class="note">${icon.warn}<div>${esc(payMsg)}</div></div>`:''}
  </div>`;
}
function signInForm(lead){
  return `<div style="display:flex;flex-direction:column;gap:10px">
    ${lead?`<div class="small">${esc(lead)}</div>`:''}
    ${authStep === 'email' ? `<form data-form="authemail" style="display:flex;flex-direction:column;gap:8px">
      <label for="authEmail" class="small">Email</label>
      <input id="authEmail" name="email" type="email" class="input" autocomplete="email" inputmode="email" required maxlength="120" value="${esc(authEmail)}">
      <button class="btn" ${authBusy?'disabled':''}>${authBusy?'Sending…':'Send me a code'}</button>
    </form>` : `<form data-form="authcode" style="display:flex;flex-direction:column;gap:8px">
      <label for="authCode" class="small">Code from the email</label>
      <input id="authCode" name="code" class="input" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required style="letter-spacing:6px;font-size:22px;text-align:center">
      <button class="btn" ${authBusy?'disabled':''}>${authBusy?'Checking…':'Continue'}</button>
      <button type="button" class="link" data-act="authresend" style="align-self:center">Send a new code</button>
    </form>`}
    ${authMsg?`<p class="small">${esc(authMsg)}</p>`:''}
    <button type="button" class="link" data-act="authcancel" style="align-self:center">Cancel</button>
  </div>`;
}
function startCheckout(){
  if (!READY()){ payMsg = 'Payments open very soon. We will let you know in the app.'; render(); return; }
  const a = auth.get();
  if (!a){ authStep = 'email'; authAfter = 'checkout'; authMsg = ''; payMsg = ''; render(); const i = document.getElementById('authEmail'); if (i) i.focus(); return; }
  location.href = checkoutUrl(a);
}
// user ki ID checkout me — webhook isi se pehchanta hai ke Plus kis ko dena hai
function checkoutUrl(a){
  const u = new URL(CONFIG.checkout[billing]);
  u.searchParams.set('checkout[custom][user_id]', a.uid);
  u.searchParams.set('checkout[email]', a.email);
  return u.toString();
}
function accountCard(){
  if (!AUTH_READY()) return '';
  const a = auth.get();
  if (!a) return `<div class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="label">Account</div>
    ${payMsg ? `<div class="note" style="background:#17221A;border-color:#284A33;color:#CFEFD9"><div>${esc(payMsg)}</div></div>` : ''}
    ${authStep ? signInForm(authAfter === 'checkout' ? 'Create a free account so Plus stays yours, on any phone.' : 'Already have Plus? Sign in with the email you paid with.') : `<div class="small">Sign in to get Plus back on a new phone.</div>
    <button class="btn ghost" data-act="signin" style="min-height:48px;font-size:15px">Sign in</button>`}
  </div>`;
  const s = S.sub, plus = isPlus();
  const when = d => d ? new Date(d).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' }) : '';
  return `<div class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="label">Account</div>
    <div style="font-weight:600;word-break:break-all">${esc(a.email)}</div>
    <div class="small">${plus ? (s.status === 'on_trial' ? 'Plus · free trial' : s.status === 'cancelled' ? 'Plus until ' + when(s.endsAt) + ' (cancelled)' : s.status === 'past_due' ? 'Plus · payment failed' : 'Plus · active' + (s.renewsAt ? ' · renews ' + when(s.renewsAt) : ''))
      : subStale() ? 'Plus status not checked for a while' : (s && s.status !== 'none' ? 'Plus ended' : 'Free plan')}</div>
    ${plus && s.status === 'past_due' ? `<div class="note">${icon.warn}<div>Your last payment did not go through. Update your card in <b>Manage subscription</b> to keep Plus.</div></div>` : ''}
    ${subStale() ? `<div class="note">${icon.warn}<div>Connect to the internet and tap <b>Check my Plus</b>. If you already pay for Plus, don't buy it again.</div></div>` : ''}
    ${plus && !S.cloudOK ? `<div class="small" style="font-size:14px;color:var(--soft)"><b style="color:var(--text)">Cloud backup is off.</b> Turn it on to keep your skin answers (including pregnancy and skin conditions, if you shared them), routine and streak in your account and use them on any phone. Photos are never uploaded. You can turn it off any time.</div>
    <button class="btn ghost" data-act="cloudon" style="min-height:48px;font-size:15px">Turn on cloud backup</button>` : `
    <div class="small" style="display:flex;gap:8px;align-items:center">${plus
      ? (cloudFail ? 'Cloud backup could not save. We will try again — check your internet.' : S.cloudAt ? 'Cloud backup on · saved ' + new Date(S.cloudAt).toLocaleString(undefined, { day:'numeric', month:'short', hour:'numeric', minute:'2-digit' }) : 'Cloud backup on · saving…')
      : 'Cloud backup across phones is a Plus feature.'}</div>
    ${plus ? '<button class="link" data-act="cloudoff" style="align-self:flex-start;padding-left:0">Turn off cloud backup</button>' : ''}`}
    ${cloudMsg ? `<p class="small" style="color:#CFEFD9">${esc(cloudMsg)}</p>` : ''}
    ${s && s.portal ? `<a class="btn ghost" href="${esc(s.portal)}" target="_blank" rel="noopener" style="min-height:48px;font-size:15px;display:flex;align-items:center;justify-content:center;text-decoration:none">Manage subscription</a>` : ''}
    <button class="btn ghost" data-act="checkplus" style="min-height:48px;font-size:15px" ${subBusy?'disabled':''}>Check my Plus</button>
    <button class="link" data-act="signout" style="align-self:center">Sign out</button>
  </div>`;
}

/* ========== PROGRESS PHOTOS (stay on this phone) ========== */
const PKEY = 'glowmelan_photos';
// Photos IndexedDB me (localStorage ki ~5MB hadd nahi). IndexedDB na mile (kuch private modes) to localStorage.
const IDB = {
  db: null,
  open(){ if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => { const r = indexedDB.open('glowmelan', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(this.db = r.result); r.onerror = () => rej(r.error); }); },
  run(mode, fn){ return this.open().then(db => new Promise((res, rej) => {
    const tx = db.transaction('kv', mode), q = fn(tx.objectStore('kv'));
    tx.oncomplete = () => res(q && q.result); tx.onerror = tx.onabort = () => rej(tx.error); })); },
  get(k){ return this.run('readonly', s => s.get(k)); },
  set(k, v){ return this.run('readwrite', s => s.put(v, k)); },
  del(k){ return this.run('readwrite', s => s.delete(k)); }
};
let photoCache = [], photosReady = false, useLS = false;   // memory cache: render hamesha tez
const photos = {
  all(){ return photoCache; },
  async save(list){
    try { if (useLS) localStorage.setItem(PKEY, JSON.stringify(list)); else await IDB.set('photos', list); photoCache = list; return true; }
    catch(e){ return false; }
  },
  async clear(){ photoCache = []; try { localStorage.removeItem(PKEY); } catch(e){} try { await IDB.del('photos'); } catch(e){} }
};
async function loadPhotos(){
  try {
    let list = await IDB.get('photos');
    const old = (() => { try { return localStorage.getItem(PKEY); } catch(e){ return null; } })();
    if (!list && old){ list = cleanPhotos(JSON.parse(old)); await IDB.set('photos', list); localStorage.removeItem(PKEY); }   // purani photos ek dafa shift
    photoCache = cleanPhotos(list || []);
  } catch(e){
    useLS = true; try { photoCache = cleanPhotos(JSON.parse(localStorage.getItem(PKEY))); } catch(_){ photoCache = []; }
  }
  photosReady = true; if (step === 'home') render();
}
let photoMsg = null, photoBusy = false, photoSide = 'front';
const SIDES = { front:'Front', left:'Left cheek', right:'Right cheek' };
function fmtDate(t){ return new Date(t).toLocaleDateString(undefined, { day:'numeric', month:'short' }); }
// Photo ko chhota karo + roshni check karo — sab phone par hi
function processPhoto(file){
  photoBusy = true; photoMsg = null; render();
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = async () => {
    const W = 480, H = Math.round(img.height * W / img.width), c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url);
    // centre ka hissa (chehra) — left aur right ki roshni alag napo
    const cx0 = Math.round(W*.25), cy0 = Math.round(H*.2), cw = Math.round(W*.5), ch = Math.round(H*.5);
    const d = x.getImageData(cx0, cy0, cw, ch).data; let L = 0, Ll = 0, Lr = 0, n = 0, nl = 0, nr = 0;
    for (let i = 0; i < d.length; i += 16){ const px = (i/4) % cw, l = .299*d[i] + .587*d[i+1] + .114*d[i+2]; L += l; n++; if (px < cw/2){ Ll += l; nl++; } else { Lr += l; nr++; } }
    L /= n; const side = Math.abs(Ll/nl - Lr/nr);
    let light = 'good', advice = 'Good light. Nice photo.';
    if (L < 60){ light = 'dark'; advice = 'A bit dark. Next time, face a window in daytime.'; }
    else if (L > 205){ light = 'bright'; advice = 'Too bright. Step back from direct sun, turn flash off.'; }
    else if (side > 35){ light = 'uneven'; advice = 'One side is darker. Face the window straight on.'; }
    const list = photos.all().slice(); list.push({ at: Date.now(), img: c.toDataURL('image/jpeg', .72), light, side: photoSide });
    // Jagah na ho to kuch delete NAHI karte — user ko batate hain
    if (!(await photos.save(list))){ light = 'bad'; advice = 'Storage for Glowmelan is full on this phone. Delete a few old photos, then try again.'; track('photo-storage-full', true); }
    else track(list.length === 1 ? 'photo-first' : 'photo-more', true);
    photoBusy = false; photoMsg = { light, advice }; render();
  };
  img.onerror = () => { URL.revokeObjectURL(url); photoBusy = false; photoMsg = { light:'bad', advice:'Could not open that photo. Try another.' }; render(); };
  img.src = url;
}
/* ========== WEEKLY REPORT (Plus) ========== */
function weekStats(){
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return dayKey(d); });
  const r = getRoutine();
  const nights = days.filter(dayDone).length;
  const mornings = days.filter(k => { const l = (S.log||{})[k]; return l && allDone(r.am, l.am); }).length;
  let best = 0, cur = 0, prev = null;   // sabse lamba streak, poori history me
  for (const k of Object.keys(S.log||{}).filter(dayDone).sort()){
    const t = Date.parse(k + 'T12:00:00'); cur = (prev !== null && Math.round((t - prev) / 86400000) === 1) ? cur + 1 : 1; best = Math.max(best, cur); prev = t; }
  const pics = photos.all().filter(p => p.at >= Date.now() - 7 * 86400000).length;
  return { nights, mornings, streak: streak(), best, pics };
}
function reportCard(){
  const w = weekStats();
  const line = w.nights >= 6 ? 'Amazing week — your skin loves this.' : w.nights >= 4 ? 'Good week. A couple more nights and you are on fire.'
    : w.nights >= 1 ? 'A start. Try to wash every night this week.' : 'New week, fresh start. Tonight counts.';
  const cell = (v, l) => `<div class="tile"><div class="label" style="font-size:10px">${l}</div><div class="v">${v}</div></div>`;
  return `<div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="label">Your week</div>
    <div class="tiles">${cell(w.nights + '/7', 'Nights')}${cell(w.mornings + '/7', 'Mornings')}${cell(w.pics, 'Photos')}</div>
    <div class="small" style="font-size:14px;color:var(--soft)">${esc(line)} Streak ${w.streak} · best ${w.best}.</div>
  </div>`;
}

/* ========== DARK SPOT TRACKER (Plus) — ek daag chuno, har hafte usi jagah ka zoom ========== */
const spotCache = {};
let spotPicking = false;
function analyseSpot(p, s){
  const k = p.at + '|' + s.x.toFixed(3) + '|' + s.y.toFixed(3);
  if (spotCache[k]) return spotCache[k];
  spotCache[k] = { pending: true };
  const img = new Image();
  img.onload = () => {
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const cx = s.x * W, cy = s.y * H, r = Math.max(6, 0.06 * W);
    const x0 = Math.max(0, Math.floor(cx - 2*r)), x1 = Math.min(W - 1, Math.ceil(cx + 2*r)), y0 = Math.max(0, Math.floor(cy - 2*r)), y1 = Math.min(H - 1, Math.ceil(cy + 2*r));
    const d = x.getImageData(0, 0, W, H).data; let li = 0, ni = 0, lr = 0, nr = 0;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++){
      const dist = Math.hypot(xx - cx, yy - cy); if (dist > 2*r) continue;
      const i = (yy * W + xx) * 4, l = .299*d[i] + .587*d[i+1] + .114*d[i+2];
      if (dist <= r){ li += l; ni++; } else if (dist >= 1.3*r){ lr += l; nr++; } }   // daag vs aas-paas ki skin
    const inner = li / Math.max(1, ni), ring = lr / Math.max(1, nr);
    const t = document.createElement('canvas'); t.width = t.height = 120; const tx = t.getContext('2d'), side = 4 * r;
    tx.drawImage(c, cx - side/2, cy - side/2, side, side, 0, 0, 120, 120);
    tx.strokeStyle = '#F2B33D'; tx.lineWidth = 2; tx.beginPath(); tx.arc(60, 60, 120 * r / side, 0, 7); tx.stroke();
    spotCache[k] = { thumb: t.toDataURL('image/jpeg', .8), contrast: ring > 0 ? Math.round(Math.max(0, (ring - inner) / ring * 100)) : 0 };
    if (step === 'home' && tab === 'progress') render();
  };
  img.onerror = () => { spotCache[k] = { thumb: '', contrast: 0 }; };
  img.src = p.img;
  return spotCache[k];
}
function spotCard(list){
  if (!list.length) return '';
  const s = (S.spots || {})[photoSide];
  if (!s || spotPicking) return `<div class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="label">Dark spot tracker</div>
    <div class="small" style="font-size:14px;color:var(--soft)">Tap the dark spot you want to watch on your first ${SIDES[photoSide].toLowerCase()} photo.</div>
    <button data-spotpick="1" aria-label="Your first photo. Tap the spot to track." style="padding:0;border:0;background:none;cursor:crosshair;display:block;width:100%"><img src="${list[0].img}" alt="" style="width:100%;border-radius:16px;display:block"></button>
    ${s ? '<button class="link" data-act="spotcancel" style="align-self:center">Cancel</button>' : ''}
  </div>`;
  const rows = list.map(p => ({ p, a: analyseSpot(p, s) })), done = rows.filter(r => !r.a.pending && r.a.thumb);
  let trend = '';
  if (done.length >= 2){ const diff = done[0].a.contrast - done[done.length - 1].a.contrast;
    trend = diff >= 3 ? `About ${diff} points lighter than in your first photo.` : diff <= -3 ? `About ${-diff} points darker — check your light, and keep up sunscreen.` : 'About the same so far. Dark spots fade slowly.'; }
  return `<div class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="label">Dark spot tracker · ${SIDES[photoSide]}</div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">${rows.map(r => `<figure style="margin:0;flex:0 0 96px;text-align:center">
      ${r.a.pending || !r.a.thumb ? '<div style="width:96px;height:96px;border-radius:12px;background:#0E0B08"></div>' : `<img src="${r.a.thumb}" alt="Tracked spot on ${fmtDate(r.p.at)}" width="96" height="96" style="border-radius:12px;display:block">`}
      <figcaption class="small">${fmtDate(r.p.at)}${r.a.pending || !r.a.thumb ? '' : '<br>' + r.a.contrast + '% darker'}</figcaption></figure>`).join('')}</div>
    ${trend ? `<div class="small" style="font-size:14px;color:var(--soft)">${esc(trend)}</div>` : ''}
    <p class="small">"% darker" compares the spot with the skin around it. It's an estimate — same window, distance and framing each week keeps it fair.</p>
    <button class="link" data-act="spotmove" style="align-self:flex-start;padding-left:0">Pick a different spot</button>
  </div>`;
}

function progressTab(){
  if (!photosReady) return `<div class="fade"><h2>Progress</h2><p class="small" style="margin-top:12px">Loading your photos…</p></div>`;
  const all = photos.all(), newest = all[all.length-1];
  const days = newest ? Math.floor((Date.now() - newest.at) / 86400000) : null, due = !newest || days >= 7;
  const locked = !isPlus() && all.length >= 1;   // pehli photo free, baaqi Plus
  const list = all.filter(p => (p.side || 'front') === photoSide), last = list[list.length-1], first = list[0];   // compare sirf same side
  return `<div class="fade" style="display:flex;flex-direction:column;gap:16px">
    <div class="top"><h2>Progress</h2>${isPlus() && !FREE_APP ?'<span class="chip">Plus</span>':''}</div>
    ${locked ? `${photoMsg ? `<div class="note" style="${photoMsg.light==='good'?'background:#17221A;border-color:#284A33;color:#CFEFD9':''}">${photoMsg.light==='good'?'':icon.warn}<div>${esc(photoMsg.advice)}</div></div>` : ''}
      ${paywall('Keep tracking. See your spots fade.')}` : `
    <div class="card" style="display:flex;flex-direction:column;gap:12px">
      <div class="label">Weekly photo</div>
      <div class="serif" style="font-size:26px;line-height:1.1">${due ? 'Time for this week\'s photo.' : `Next photo in ${7-days} ${7-days===1?'day':'days'}.`}</div>
      <div role="group" aria-label="Which side" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">
        ${Object.keys(SIDES).map(k => `<button class="opt" data-side="${k}" aria-pressed="${photoSide===k}" style="justify-content:center;min-height:48px;padding:8px;font-size:14px">${SIDES[k]}</button>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <div class="tip"><i></i><span>${photoSide==='front' ? 'Face a window, in daytime.' : 'Turn your head so this cheek faces the camera and the window.'}</span></div>
        <div class="tip"><i></i><span>Same spot and arm's length every time.</span></div>
        <div class="tip"><i></i><span>Flash off. No makeup. Hair away from face.</span></div>
      </div>
      <label class="btn filebtn ${due?'':'ghost'}" style="cursor:pointer">
        <input type="file" accept="image/*" capture="user" data-file="photo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
        ${photoBusy ? 'Saving…' : (due ? 'Take photo' : 'Take one anyway')}
      </label>
      ${photoMsg ? `<div class="note" style="${photoMsg.light==='good'?'background:#17221A;border-color:#284A33;color:#CFEFD9':''}">${photoMsg.light==='good'?'':icon.warn}<div>${esc(photoMsg.advice)}</div></div>` : ''}
      <p class="small" style="display:flex;gap:8px;align-items:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Photos stay on this phone. Never uploaded.</p>
      ${!isPlus() && !all.length ? '<p class="small">Your first photo is free.</p>' : ''}
    </div>`}

    ${isPlus() ? reportCard() + spotCard(list) : ''}

    ${list.length >= 2 && isPlus() ? `<div class="card" style="display:flex;flex-direction:column;gap:12px">
      <div class="label">First vs latest · ${SIDES[photoSide]}</div>
      <div style="position:relative;border-radius:18px;overflow:hidden;aspect-ratio:3/4;background:#0E0B08">
        <img src="${last.img}" alt="Your latest photo, ${fmtDate(last.at)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
        <img id="cmpFirst" src="${first.img}" alt="Your first photo, ${fmtDate(first.at)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;clip-path:inset(0 50% 0 0)">
        <div id="cmpLine" style="position:absolute;top:0;bottom:0;left:50%;width:3px;margin-left:-1.5px;background:var(--gold)"></div>
        <span style="position:absolute;left:10px;top:10px" class="chip">${fmtDate(first.at)}</span>
        <span style="position:absolute;right:10px;top:10px" class="chip">${fmtDate(last.at)}</span>
      </div>
      <label for="cmpRange" class="small">Slide to compare first and latest</label>
      <input id="cmpRange" data-cmp type="range" min="0" max="100" value="50" style="width:100%;accent-color:var(--gold);min-height:32px">
      <p class="small">Dark marks fade slowly — often weeks to months. Keep going.</p>
    </div>` : list.length === 1 ? `<p class="small">One ${SIDES[photoSide].toLowerCase()} photo saved. Take another next week to compare.</p>` : ''}

    ${all.length ? `<div style="display:flex;flex-direction:column;gap:10px">
      <div class="label">All photos (${all.length})</div>
      <div class="thumbs">${all.slice().reverse().map(ph => `<div class="thumb"><img src="${ph.img}" alt="Photo from ${fmtDate(ph.at)}"><button class="del" data-del="${ph.at}" aria-label="Delete photo from ${fmtDate(ph.at)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="small" style="margin-top:4px">${fmtDate(ph.at)} · ${SIDES[ph.side||'front']}</div></div>`).join('')}</div>
    </div>` : ''}
  </div>`;
}
function navBar(){
  const it = (id, label, path) => `<button data-tab="${id}" ${tab===id?'aria-current="page"':''}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>${label}</button>`;
  return `<nav class="nav" aria-label="Main"><div>
    ${it('today','Today','<path d="M4 11l8-7 8 7v9H4z"/>')}
    ${it('progress','Progress','<path d="M4 19h16M7 15l4-4 3 3 5-6"/>')}
    ${it('learn','Learn','<path d="M4 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>')}
  </div></nav>`;
}
/* ========== LEARN (simple, sourced from AAD / dermatology reviews) ========== */
const INGREDIENTS = {
  ceramides:   { n:'Ceramides', w:'Rebuild your skin barrier so it holds water.', for:'all' },
  sunscreen:   { n:'Sunscreen SPF 30+', w:'Every day, every skin tone. Look for "no white cast".', for:'all' },
  tinted:      { n:'Tinted sunscreen (iron oxides)', w:'On deeper skin, visible light also darkens spots and melasma. The tint blocks it.', for:['spots','tone'] },
  niacinamide: { n:'Niacinamide', w:'Evens tone, calms redness and oil. Gentle for most skin.', for:['spots','tone','acne','oil'] },
  azelaic:     { n:'Azelaic acid', w:'Fades dark marks and calms breakouts, without bleaching.', for:['spots','tone','acne'] },
  vitc:        { n:'Vitamin C', w:'Brightens dull skin and dark spots. Use in the morning.', for:['spots','tone','glow'] },
  bha:         { n:'Salicylic acid (BHA)', w:'Clears clogged pores. Start 2–3 times a week.', for:['acne','oil'] },
  glycerin:    { n:'Glycerin & hyaluronic acid', w:'Pull water into dry skin.', for:['dry'] }
};
const AVOID = [
  ['Harsh scrubs and rough cloths', 'Irritation can leave new dark marks on deeper skin.'],
  ['Strong peels or lasers at home', 'Can make pigment worse on darker skin. Ask a dermatologist first.'],
  ['Lemon, bleach or "whitening" creams', 'Can burn skin. Some hide mercury or steroids.'],
  ['Steroid creams for dark spots', 'Unless a doctor prescribes them. Long use thins skin and causes breakouts.'],
  ['Picking or popping pimples', 'Makes dark marks bigger and last longer.'],
  ['Very hot water', 'Dries skin out. Use lukewarm.']
];
const FACTS = [
  ['"Dark skin doesn\'t need sunscreen."', 'False. Daylight darkens spots and melasma on every skin tone.'],
  ['"Only UV causes dark spots."', 'Not on deeper skin. Visible light does too — a tinted sunscreen helps.'],
  ['"Washing more = clearer skin."', 'False. Twice a day is enough. More can dry and irritate.'],
  ['"Results show in a week."', 'Rarely. Dark marks often take weeks to months to fade.']
];
const FLAGS = [
  'Painful, deep pimples, or pimples leaving scars',
  'No improvement after about 3 months of steady care',
  'A new spot or mole, or one that changes size, shape or colour',
  'Dark patches that started in pregnancy or on the pill',
  'Light or white patches that are new or spreading',
  'Rash with swelling, pus or fever'
];
function learnTab(){
  const p = S.profile, g = p.goals.concat(p.type==='dry'?['dry']:[], p.type==='oily'?['oil']:[], (p.pihProne||p.melasma)?['spots']:[]);
  let mine = Object.values(INGREDIENTS).filter(i => i.for==='all' || i.for.some(x => g.includes(x)));
  if (mine.includes(INGREDIENTS.tinted)) mine = mine.filter(i => i !== INGREDIENTS.sunscreen);   // tinted hi kaafi
  // Sensitive skin: routine jaisa hi — tez actives hata kar niacinamide
  if (p.sensitive){ mine = mine.filter(i => i !== INGREDIENTS.vitc && i !== INGREDIENTS.bha && i !== INGREDIENTS.azelaic); if (!mine.includes(INGREDIENTS.niacinamide)) mine.splice(2, 0, INGREDIENTS.niacinamide); }
  if (p.pregnant) mine = mine.filter(i => i !== INGREDIENTS.bha);
  const acneOrSpots = g.includes('acne') || g.includes('spots');
  const flags = p.keloid ? ['Any breakouts — you scar easily, so get help early'].concat(FLAGS) : FLAGS;
  return `<div class="fade" style="display:flex;flex-direction:column;gap:16px">
    <h2>Learn</h2>
    <div class="card" style="display:flex;flex-direction:column;gap:12px">
      <div class="label">Look for these · picked for you</div>
      ${mine.map(i=>`<div><b style="font-weight:600">${esc(i.n)}</b><div class="small" style="font-size:14px;color:var(--soft);margin-top:2px">${esc(i.w)}</div></div>`).join('')}
      ${p.sensitive?`<div class="note">${icon.warn}<div>Sensitive skin: try one new product at a time. Test a small spot on your jaw for 2 days first.</div></div>`:''}
      ${p.pregnant?`<div class="note">${icon.warn}<div>Pregnant or breastfeeding: skip retinoids and strong salicylic acid. Ask your doctor before new products.</div></div>`:''}
    </div>
    ${acneOrSpots && !p.pregnant && !p.sensitive && !p.rx ? `<div class="card" style="display:flex;flex-direction:column;gap:8px">
      <div class="label">Next step · after 4+ weeks</div>
      <b style="font-weight:600">Adapalene (a retinoid)</b>
      <div class="small" style="font-size:14px;color:var(--soft)">One of the strongest options for breakouts and dark marks. Sold without a prescription in some countries (e.g. the US); a doctor can prescribe it elsewhere. Start 2 nights a week, a pea-sized amount. It can dry or irritate at first — irritation can itself leave marks on deeper skin, so go slow.</div>
    </div>` : ''}
    <details class="card"><summary style="cursor:pointer;min-height:28px;font-weight:600">Go easy on these</summary>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">${AVOID.map(a=>`<div><b style="font-weight:600">${esc(a[0])}</b><div class="small" style="font-size:14px;margin-top:2px">${esc(a[1])}</div></div>`).join('')}</div>
    </details>
    <details class="card"><summary style="cursor:pointer;min-height:28px;font-weight:600">Myth or fact?</summary>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">${FACTS.map(f=>`<div><b style="font-weight:600">${esc(f[0])}</b><div class="small" style="font-size:14px;margin-top:2px">${esc(f[1])}</div></div>`).join('')}</div>
    </details>
    <div class="card" style="border-color:#5A3A2A;display:flex;flex-direction:column;gap:10px">
      <div class="label" style="color:#F2C97A">See a dermatologist if</div>
      ${flags.map(f=>`<div class="tip"><i style="background:#F2C97A"></i><span>${esc(f)}</span></div>`).join('')}
    </div>
    ${!isPlus() && READY() && !authStep && !subStale() ? `<div class="card" style="border-color:var(--gold);display:flex;flex-direction:column;gap:10px">
      <div class="label" style="color:var(--gold)">Glowmelan Plus</div>
      <div class="small" style="font-size:14px;color:var(--soft)">Weekly photos with a compare slider, a dark spot tracker, a weekly report and cloud backup. 7 days free, then ${PRICE.yearly.p}/year or ${PRICE.monthly.p}/month — renews automatically until you cancel.</div>
      <button class="btn" data-act="upgrade" style="min-height:48px;font-size:15px">Start 7-day free trial</button>
      ${payMsg?`<p class="small">${esc(payMsg)}</p>`:''}
    </div>` : ''}
    ${accountCard()}
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div class="label">Your data</div>
      <div class="small">${isPlus() && S.cloudOK ? 'Your routine and streak are also backed up to your account. Photos stay only on this phone — save a backup file to move them.' : 'Everything stays on this phone. Save a backup file to move it to a new phone.'}</div>
      <button class="btn ghost" data-act="backup" style="min-height:48px;font-size:15px">Save backup file</button>
      <label class="btn ghost filebtn" style="min-height:48px;font-size:15px;cursor:pointer"><input type="file" accept=".json,application/json" data-file="restore">Restore from backup</label>
      ${backupMsg?`<p class="small" style="color:#CFEFD9">${esc(backupMsg)}</p>`:''}
      <button class="link" data-act="wipe" style="color:#F2A07A;align-self:center">Delete all data</button>
    </div>
    <p class="small" style="text-align:center">Glowmelan gives general guidance, not a medical diagnosis.</p>
    <p class="small" style="text-align:center"><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a>${FREE_APP ? '' : ' · <a href="refund.html">Refunds</a>'}</p>
  </div>`;
}
let backupMsg = '';
async function saveBackup(){
  const st = Object.assign({}, S); delete st.plan; delete st.sub; delete st.wx; delete st.cloudAt;   // Plus status backup me nahi jata
  const data = { app:'glowmelan', v:1, at:Date.now(), state:st, photos:photos.all() };
  if (await giveFile(JSON.stringify(data), 'glowmelan-backup-' + dayKey() + '.json', 'application/json')){ backupMsg = 'Backup saved. Keep the file somewhere safe.'; render(); }
}
function restoreBackup(file){
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || d.app !== 'glowmelan') throw new Error('bad');
      const st = cleanState(d.state, false);              // sirf sahi data; Plus restore nahi hota
      if (!st.profile) throw new Error('bad');
      if (!confirm('Replace the data on this phone with this backup?')) return;
      st.sub = S.sub; S = st; store.set(S);
      photos.save(cleanPhotos(d.photos)).then(ok => { backupMsg = ok ? 'Restored. Welcome back.' : 'Restored, but some photos did not fit on this phone.'; tab = 'today'; render(); });
    } catch(e){ backupMsg = ''; alert('That file is not a Glowmelan backup.'); }
  };
  if (file.size > 30 * 1024 * 1024){ alert('That file is too big to be a Glowmelan backup.'); return; }
  r.readAsText(file);
}

/* ========== WEATHER (Open-Meteo, free, no key) ========== */
// Band: Open-Meteo ki muft API paid apps ke liye allowed nahi. Paid plan le kar true karo (aur index.html CSP me open-meteo wapas daalo).
const WEATHER = false;
let cityMode = null, cityResults = [], cityMsg = '', cityQuery = '', wxLoading = false;
// 8 second me jawab na aaye to chhod do — "Loading…" pe atka na rahe
function getJSON(url, ms = 8000){
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { signal: ctl.signal }).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }).finally(() => clearTimeout(t));
}
async function searchCity(q){
  cityQuery = q; cityMsg = 'Searching…'; cityResults = []; render();
  try {
    const j = await getJSON('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=' + encodeURIComponent(q));
    cityResults = (j.results || []).filter(c => isNum(c.latitude) && isNum(c.longitude) && typeof c.name === 'string')
      .map(c => ({ name:String(c.name).slice(0,80), area:[c.admin1, c.country].filter(Boolean).join(', ').slice(0,120), lat:c.latitude, lon:c.longitude }));
    cityMsg = cityResults.length ? '' : 'No city found. Check the spelling.';
  } catch(e){ cityMsg = 'No internet. Try again.'; }
  render();
}
async function loadWeather(force){
  const c = S.city; if (!WEATHER || !c || wxLoading) return;
  if (!force && S.wx && Date.now() - S.wx.at < 3600000) return;   // 1 ghante ka cache
  wxLoading = true;
  try {
    const [w, a] = await Promise.all([
      getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,relative_humidity_2m&daily=uv_index_max&timezone=auto&forecast_days=1`),
      getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c.lat}&longitude=${c.lon}&current=us_aqi`).catch(() => null)
    ]);
    const n = v => isNum(v) ? Math.round(v) : null;
    const uv = n(w && w.daily && w.daily.uv_index_max && w.daily.uv_index_max[0]), hum = n(w && w.current && w.current.relative_humidity_2m);
    if (uv === null || hum === null) throw new Error('bad weather data');
    S.wx = { at:Date.now(), temp: n(w.current.temperature_2m) ?? 0, hum, uv, aqi: a && a.current ? n(a.current.us_aqi) : null };
    store.set(S);
  } catch(e){ /* purana data dikhta rahe */ }
  wxLoading = false; if (step === 'home') render();
}
function wxTips(){
  const w = S.wx, t = []; if (!w) return t;
  if (w.uv >= 6) t.push(`UV is high (${w.uv}). Sunscreen this morning, and again at lunch if you go out.`);
  else if (w.uv >= 3) t.push(`UV is moderate (${w.uv}). Still wear sunscreen — daylight darkens spots.`);
  else t.push(`UV is low (${w.uv}). Keep your sunscreen habit anyway.`);
  if (w.hum < 35) t.push('Dry air today. Use a little more moisturizer tonight.');
  else if (w.hum > 70) t.push('Humid today. Light layers — skip heavy creams.');
  if (w.aqi != null && w.aqi > 100) t.push(`Air is polluted (AQI ${w.aqi}). Don't skip the oil cleanse tonight.`);
  if (S.hardWater === 'yes') t.push('Hard water can leave skin tight. Rinse with lukewarm water and moisturize right away.');
  return t.slice(0, 3);
}
function weatherCard(){
  if (cityMode === 'search') return `<div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="label">Your city</div>
    <form data-form="city" style="display:flex;gap:8px">
      <label for="cityIn" class="label" style="position:absolute;left:-9999px">City name</label>
      <input id="cityIn" class="input" name="q" placeholder="e.g. London" autocomplete="off" required value="${esc(cityQuery)}">
      <button class="btn" style="width:auto;padding:0 20px;min-height:52px">Find</button>
    </form>
    ${cityMsg?`<p class="small">${esc(cityMsg)}</p>`:''}
    ${cityResults.map((c,i)=>`<button class="opt" data-city="${i}" style="min-height:52px;padding:12px 16px"><span><b style="font-weight:600">${esc(c.name)}</b><span class="sub">${esc(c.area)}</span></span></button>`).join('')}
    <button class="link" data-act="citycancel" style="align-self:center">Cancel</button>
  </div>`;
  if (cityMode === 'water') return `<div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="label">One quick question</div>
    <div class="serif" style="font-size:24px;line-height:1.15">Does your kettle or shower get a white, chalky crust?</div>
    <p class="small">That usually means hard water, which can dry out skin.</p>
    <div class="opts">
      <button class="opt" data-hw="yes"><span class="dot"></span>Yes</button>
      <button class="opt" data-hw="no"><span class="dot"></span>No</button>
      <button class="opt" data-hw="unsure"><span class="dot"></span>Not sure</button>
    </div>
  </div>`;
  if (!S.city) return `<button class="card" data-act="addcity" style="text-align:left;cursor:pointer;display:flex;gap:14px;align-items:center;width:100%;color:var(--text)">
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#F2B33D" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    <span style="flex:1"><b style="font-weight:600;font-size:16px">Add your city</b><span class="sub" style="display:block;font-size:13px;color:var(--muted);margin-top:2px">Get daily tips for UV, dry air and pollution</span></span>
  </button>`;
  const w = S.wx, tips = wxTips();
  return `<div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div class="label">Today in ${esc(S.city.name)}</div>
      <button class="link" data-act="addcity" style="padding:8px;font-size:13px">Change</button>
    </div>
    ${w ? `<div class="tiles">
      <div class="tile"><div class="label" style="font-size:10px">UV</div><div class="v">${w.uv}</div></div>
      <div class="tile"><div class="label" style="font-size:10px">Humidity</div><div class="v">${w.hum}%</div></div>
      <div class="tile"><div class="label" style="font-size:10px">${w.aqi!=null?'Air (AQI)':'Temp'}</div><div class="v">${w.aqi!=null?w.aqi:w.temp+'°'}</div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">${tips.map(t=>`<div class="tip"><i></i><span>${esc(t)}</span></div>`).join('')}</div>`
    : `<p class="small">${wxLoading?'Loading today\'s weather…':'Could not load weather. Check your internet.'}</p>`}
  </div>`;
}

function home(){
  const p = S.profile, T = TYPE_TEXT[p.type], R = getRoutine(), steps = R[part];
  const today = (S.log||{})[dayKey()] || {}, done = today[part] || [];
  const doneN = steps.filter(s => done.includes(s.id)).length, all = allDone(steps, done);
  const st = streak();
  const week = [...Array(7)].map((_,i) => { const d = new Date(); d.setDate(d.getDate()-6+i); return { on: dayDone(dayKey(d)), l: 'SMTWTFS'[d.getDay()], today: i===6 }; });
  return `<div class="fade" style="display:flex;flex-direction:column;gap:16px;flex:1">
    <div class="top"><div class="logo">glowmelan</div><span style="width:40px;height:40px;border-radius:99px;background:${p.toneColor};outline:2px solid var(--gold);outline-offset:2px" role="img" aria-label="Your tone: ${esc(p.toneName)}"></span></div>
    ${payMsg ? `<div class="note">${icon.warn}<div>${esc(payMsg)}</div></div>` : plusJustOn ? `<div class="note" style="background:#17221A;border-color:#284A33;color:#CFEFD9"><div>Welcome to Plus! Your weekly report and dark spot tracker are in the Progress tab. Turn on cloud backup any time in Learn.</div></div>` : ''}

    <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div><div class="label">Night streak</div><div class="serif" style="font-size:40px;line-height:1">${st} <span style="font-size:18px;color:var(--muted)">${st===1?'night':'nights'}</span></div></div>
      <div style="display:flex;gap:6px" aria-label="Last 7 nights">${week.map(w=>`<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="width:14px;height:14px;border-radius:99px;background:${w.on?'var(--gold)':'#33271F'};${w.today?'outline:1.5px solid var(--muted);outline-offset:2px':''}"></span><span style="font-size:10px;color:var(--muted)">${w.l}</span></div>`).join('')}</div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2>${part==='am'?'This morning':'Tonight'}</h2>
      <div role="group" aria-label="Morning or night" style="display:flex;background:var(--card);border:1px solid var(--line);border-radius:99px;padding:4px">
        <button data-part="am" aria-pressed="${part==='am'}" style="border:0;min-height:40px;padding:0 16px;border-radius:99px;font-weight:600;cursor:pointer;background:${part==='am'?'var(--text)':'transparent'};color:${part==='am'?'var(--bg)':'var(--muted)'}">AM</button>
        <button data-part="pm" aria-pressed="${part==='pm'}" style="border:0;min-height:40px;padding:0 16px;border-radius:99px;font-weight:600;cursor:pointer;background:${part==='pm'?'var(--text)':'transparent'};color:${part==='pm'?'var(--bg)':'var(--muted)'}">PM</button>
      </div>
    </div>
    ${editMode ? editView() : `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <div class="small">${steps.length ? `${doneN} of ${steps.length} done · tap a step when you finish it` : 'No steps here yet. Tap Edit to add some.'}</div>
      <button class="link" data-act="edit" style="padding:8px;font-size:14px;flex-shrink:0">Edit</button>
    </div>
    ${routineNote()}
    <div class="opts">
      ${steps.map((s,i)=>{ const on = done.includes(s.id); return `<button class="opt" data-step="${s.id}" aria-pressed="${on}" style="align-items:flex-start">
        <span class="dot" style="margin-top:2px">${on?icon.check:''}</span>
        <span style="flex:1"><span style="display:flex;justify-content:space-between;gap:8px"><b style="font-weight:600;${on?'text-decoration:line-through;color:var(--muted)':''}">${i+1}. ${esc(s.n)}</b>${s.t?`<span class="small">${esc(s.t)}</span>`:''}</span>${s.w?`<span class="sub">${esc(s.w)}</span>`:''}</span>
      </button>`; }).join('')}
    </div>`}

    ${all ? `<div class="note" style="background:#17221A;border-color:#284A33;color:#CFEFD9">Done for ${part==='am'?'this morning':'tonight'}. ${part==='pm'?'Your streak is safe.':'See you tonight.'}</div>` : ''}

    ${productCard(steps)}

    ${helperCards()}

    ${WEATHER ? weatherCard() : ''}
    <div class="bottom"><button class="link" data-act="redo">Retake skin quiz</button></div>
  </div>`;
}

/* ========== RENDER ========== */
function render(){
  if (step === 'welcome') $app.innerHTML = welcome();
  else if (step === 'tone') $app.innerHTML = toneStep();
  else if (step.startsWith('q')) $app.innerHTML = quizStep(+step.slice(1));
  else if (step === 'result') $app.innerHTML = result();
  else if (step === 'home') $app.innerHTML = (tab === 'progress' ? progressTab() : tab === 'learn' ? learnTab() : home()) + navBar();
  $app.classList.toggle('has-nav', step === 'home');
  // Fade sirf nayi screen pe — same screen pe tap karne se flicker na ho
  const key = step + '|' + tab + '|' + editMode;
  if (key === render.lastKey) $app.querySelectorAll('.fade').forEach(el => el.classList.remove('fade'));
  render.lastKey = key;
  const h = $app.querySelector('h1,h2'); if (h) h.setAttribute('tabindex','-1');
}

/* ========== EVENTS ========== */
$app.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.tone != null){ draft.tone = +b.dataset.tone; render(); return; }
  if (b.dataset.part){ part = b.dataset.part; render(); return; }
  if (b.dataset.tab){ tab = b.dataset.tab; photoMsg = null; render(); window.scrollTo(0,0); const h = $app.querySelector('h1,h2'); if (h) h.focus({ preventScroll:true }); return; }
  if (b.dataset.del){ if (confirm('Delete this photo?')) photos.save(photos.all().filter(p => p.at !== +b.dataset.del)).then(render); return; }
  if (b.dataset.city != null){ const c = cityResults[+b.dataset.city]; S.city = { name:c.name, lat:c.lat, lon:c.lon }; S.wx = null; store.set(S); cityResults = [];
    cityMode = S.hardWater ? null : 'water'; render(); loadWeather(true); return; }
  if (b.dataset.hw){ S.hardWater = b.dataset.hw; store.set(S); cityMode = null; render(); return; }
  if (b.dataset.act === 'addcity'){ cityMode = 'search'; cityMsg = ''; cityResults = []; render(); const i = document.getElementById('cityIn'); if (i) i.focus(); return; }
  if (b.dataset.act === 'citycancel'){ cityMode = null; render(); return; }
  if (b.dataset.act === 'install' && installEvt){ installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); return; }
  if (b.dataset.act === 'backup'){ saveBackup(); return; }
  if (b.dataset.act === 'wipe'){
    const au = AUTH_READY() ? auth.get() : null;
    if (!confirm('Delete your profile, routine, streak and all photos from this phone' + (au ? ', and your cloud backup' : '') + '? This cannot be undone.')) return;
    if (au) validToken().then(tok => tok && supa('/rest/v1/user_data?user_id=eq.' + encodeURIComponent(au.uid), { method:'DELETE', headers: supaHeaders(tok) })).catch(() => {});   // cloud backup bhi
    store.clear(); photos.clear(); auth.set(null); syncDown.done = false; lastUploaded = null; clearTimeout(syncTimer);
    S = { profile:null }; draft = { tone:null, answers:{} }; tab = 'today'; editMode = false; go('welcome'); return;
  }
  if (b.dataset.bill){ billing = b.dataset.bill; render(); return; }
  if (b.dataset.side){ photoSide = b.dataset.side; photoMsg = null; spotPicking = false; render(); return; }
  if (b.dataset.spotpick){
    const r = b.querySelector('img').getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1){ S.spots = S.spots || {}; S.spots[photoSide] = { x, y }; spotPicking = false; store.set(S); render(); }
    return;
  }
  if (b.dataset.act === 'spotmove'){ spotPicking = true; render(); return; }
  if (b.dataset.act === 'spotcancel'){ spotPicking = false; render(); return; }
  if (b.dataset.act === 'upgrade'){ track('trial-click-' + tab + '-' + billing); startCheckout(); return; }
  if (b.dataset.act === 'signin'){ authStep = 'email'; authAfter = null; authMsg = ''; render(); const i = document.getElementById('authEmail'); if (i) i.focus(); return; }
  if (b.dataset.act === 'authcancel'){ authStep = null; authAfter = null; authMsg = ''; render(); return; }
  if (b.dataset.act === 'authresend'){ authStep = 'email'; authMsg = ''; render(); return; }
  if (b.dataset.act === 'signout'){ if (confirm('Sign out? Your routine and photos stay on this phone.')) signOut(); return; }
  if (b.dataset.act === 'checkplus'){ refreshSub(true); return; }
  if (b.dataset.act === 'cloudon'){
    if (!confirm('Save your skin answers (which can include pregnancy and skin conditions), routine and streak to your Glowmelan account? Photos are never uploaded.')) return;
    S.cloudOK = true; store.raw(S); syncDown.done = true; syncDown(); track('cloud-on', true); render(); return;
  }
  if (b.dataset.act === 'cloudoff'){
    if (!confirm('Turn off cloud backup and delete the copy in your account? Your data stays on this phone.')) return;
    S.cloudOK = false; S.cloudAt = null; lastUploaded = null; clearTimeout(syncTimer); store.raw(S); render();
    const au = auth.get(); if (au) validToken().then(tok => tok && supa('/rest/v1/user_data?user_id=eq.' + encodeURIComponent(au.uid), { method:'DELETE', headers: supaHeaders(tok) })).catch(() => {});
    return;
  }
  if (b.dataset.act === 'reminder' || b.dataset.act === 'remupdate'){ downloadReminder(readTimes()); return; }
  if (b.dataset.act === 'edit'){ editMode = true; render(); return; }
  if (b.dataset.act === 'editdone'){ S.times = readTimes(); store.set(S); editMode = false; render(); return; }
  if (b.dataset.act === 'resetroutine'){ if (confirm('Go back to the suggested routine? Your changes will be removed.')){ S.custom = null; store.set(S); render(); } return; }
  if (b.dataset.edit){
    ensureCustom(); const arr = S.custom[part], i = +b.dataset.i;
    if (b.dataset.edit === 'del') arr.splice(i, 1);
    if (b.dataset.edit === 'up' && i > 0) [arr[i-1], arr[i]] = [arr[i], arr[i-1]];
    if (b.dataset.edit === 'down' && i < arr.length-1) [arr[i+1], arr[i]] = [arr[i], arr[i+1]];
    store.set(S); render(); return;
  }
  if (b.dataset.step){
    const k = dayKey(); S.log = S.log || {}; const l = S.log[k] = S.log[k] || {}; const arr = l[part] = l[part] || [];
    const id = b.dataset.step; l[part] = arr.includes(id) ? arr.filter(x=>x!==id) : [...arr, id];
    l.pmDone = allDone(getRoutine().pm, l.pm);   // aaj ki routine ke hisaab se
    track('step-tick', true); if (allDone(getRoutine()[part], l[part])) track(part === 'pm' ? 'night-done' : 'morning-done', true);
    store.set(S); render(); return;
  }
  if (b.dataset.opt != null){
    const Q = QUIZ[+step.slice(1)], v = b.dataset.opt;
    if (Q.multi){ const arr = draft.answers[Q.id] || []; draft.answers[Q.id] = arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v]; }
    else draft.answers[Q.id] = v;
    render();
    // Ek jawab wala sawal: tick dikhao, phir khud agla sawal
    if (!Q.multi){ const at = step; setTimeout(() => { if (step === at) $app.querySelector('[data-act=next]').click(); }, 280); }
    return;
  }
  const a = b.dataset.act;
  if (a === 'start'){ track('quiz-start', true); go('tone'); }
  else if (a === 'back'){ const i = STEPS.indexOf(step); go(i<=0 ? 'welcome' : STEPS[i-1]); }
  else if (a === 'next'){
    const i = STEPS.indexOf(step);
    if (i < STEPS.length-1) go(STEPS[i+1]);
    else { S.profile = computeProfile(); if (draft.resetCustom) S.custom = null; store.set(S); track(draft.resetCustom ? 'quiz-retake' : 'quiz-done', true); go('result'); }
  }
  else if (a === 'home') go('home');
  else if (a === 'redo'){
    if (S.custom && !confirm('Retaking the quiz will replace your edited routine with a new suggested one. Continue?')) return;
    draft = { tone:S.profile.tone, answers:{}, resetCustom: true }; go('tone');
  }
});

$app.addEventListener('input', e => {
  if (e.target.dataset.cmp == null) return;
  const v = +e.target.value;   // bina re-render ke — drag smooth rahe
  document.getElementById('cmpFirst').style.clipPath = `inset(0 ${100-v}% 0 0)`;
  document.getElementById('cmpLine').style.left = v + '%';
});
$app.addEventListener('change', e => {
  if (e.target.dataset.file === 'photo' && e.target.files[0]) processPhoto(e.target.files[0]);
  if (e.target.dataset.file === 'restore' && e.target.files[0]) restoreBackup(e.target.files[0]);
});
$app.addEventListener('submit', e => {
  if (e.target.dataset.form === 'authemail'){ e.preventDefault(); const v = e.target.email.value.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !authBusy) sendCode(v); else { authMsg = 'Please enter a valid email.'; render(); } return; }
  if (e.target.dataset.form === 'authcode'){ e.preventDefault(); const v = e.target.code.value.replace(/\D/g, '');
    if (v.length >= 6 && v.length <= 10 && !authBusy) verifyCode(v); else { authMsg = 'Enter the code from the email (all the numbers).'; render(); } return; }
  if (e.target.dataset.form === 'addstep'){
    e.preventDefault(); const n = e.target.n.value.trim(); if (!n) return;
    ensureCustom(); S.custom[part].push({ id:'c' + Date.now(), n, w:'' }); store.set(S); render();
    const i = document.getElementById('newStep'); if (i) i.focus(); return;
  }
  if (e.target.dataset.form !== 'city') return;
  e.preventDefault(); const q = e.target.q.value.trim(); if (q.length >= 2) searchCity(q);
});

/* ========== ANALYTICS (GoatCounter — cookie nahi, koi personal data nahi, sirf ginti) ========== */
const GC_CODE = 'glowmelan';   // GoatCounter site code (glowmelan.goatcounter.com). Khaali = band.
const _sent = {};
function track(name, once){
  if (!GC_CODE || (once && _sent[name])) return; _sent[name] = 1;
  try {
    const q = new URLSearchParams({ p: 'e/' + name, t: name, e: 'true', rnd: Math.random().toString(36).slice(2) });
    fetch('https://' + GC_CODE + '.goatcounter.com/count?' + q, { mode:'no-cors', keepalive:true, credentials:'omit' }).catch(() => {});
  } catch(e){}
}
function trackView(){
  if (!GC_CODE) return;
  try { const q = new URLSearchParams({ p: '/', t: 'Glowmelan', r: document.referrer ? new URL(document.referrer).origin : '', s: screen.width + ',' + screen.height + ',' + (devicePixelRatio || 1), rnd: Math.random().toString(36).slice(2) });
    fetch('https://' + GC_CODE + '.goatcounter.com/count?' + q, { mode:'no-cors', keepalive:true, credentials:'omit' }).catch(() => {}); } catch(e){}
}
// Errors ki ginti (sirf message ka shuru, koi user data nahi) — pata chale kahan toot raha hai
addEventListener('error', e => track('error/' + String(e.message || 'unknown').replace(/[^\w ]/g, '').slice(0, 60), true));
addEventListener('unhandledrejection', e => track('error/promise ' + String((e.reason && e.reason.message) || '').replace(/[^\w ]/g, '').slice(0, 50), true));

/* ========== BOOT ========== */
step = S.profile ? 'home' : 'welcome';
render();
trackView(); track(S.profile ? (isStandalone() ? 'open-app' : 'open-returning') : 'open-new', true);
loadPhotos();
// Browser se kaho ke data khud na mitaye (Safari 7 din baad mita sakta hai)
if (S.profile && navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
if (!FREE_APP){ refreshSub(); afterCheckout(); }
loadWeather();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  loadWeather();
  // App wapas khuli aur Plus nahi: shayad abhi pay kiya — 30 sec me ek dafa check
  if (auth.get() && !isPlus() && (!S.sub || Date.now() - S.sub.checkedAt > 30000)) refreshSub(true).then(() => { if (isPlus()){ plusJustOn = true; render(); } });
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
