// Comunidad Fuerte — single-page app (no build step, works offline for the
// safety protocol once loaded; AI and payments need a connection).
(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // State and small helpers
  // -------------------------------------------------------------------------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (_) { /* ignore */ } }
  };

  const state = {
    cfg: null,
    lang: store.get('lang', (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'),
    draft: null,
    inc: null,
    tab: 'safety',
    protoLang: null,
    busy: false
  };

  const $app = document.getElementById('app');
  const t = (k, vars) => window.I18N.t(state.lang, k, vars);
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = o => (o ? (o[state.lang] || o.en || '') : '');
  const icon = k => (window.ICONS && window.ICONS[k]) || '';
  const fmtMoney = n => new Intl.NumberFormat(state.lang === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);
  const fmtDate = d => (d ? new Date(d).toLocaleString(state.lang === 'es' ? 'es-MX' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '');
  const short = h => (h ? h.slice(0, 12) + '…' : '');

  // Privacy: each report can be opened only with its access key. The keys of the
  // reports made on this device are kept here, in this browser only.
  const owned = {
    all() { const m = store.get('owned', {}); return m && typeof m === 'object' ? m : {}; },
    key(id) { return owned.all()[id]; },
    add(id, key) { if (!id || !key) return; const m = owned.all(); m[id] = key; store.set('owned', m); },
    remove(id) { const m = owned.all(); delete m[id]; store.set('owned', m); },
    list() { return Object.entries(owned.all()).map(([id, key]) => ({ id, key })); },
    code(id) { const k = owned.key(id); return k ? id + '.' + k : ''; }
  };
  function parseCode(code) {
    const m = /^\s*(inc_[a-f0-9]{6,20})\.([A-Za-z0-9_-]{16,100})\s*$/.exec(String(code || ''));
    return m ? { id: m[1], key: m[2] } : null;
  }

  async function api(path, opts) {
    const o = opts || {};
    const headers = {};
    if (o.body) headers['Content-Type'] = 'application/json';
    const mid = /^\/api\/incidents\/([^/?]+)/.exec(path);
    if (mid && mid[1] !== 'mine' && owned.key(decodeURIComponent(mid[1]))) headers['X-Owner-Key'] = owned.key(decodeURIComponent(mid[1]));
    const res = await fetch(path, {
      method: o.method || (o.body ? 'POST' : 'GET'),
      headers,
      body: o.body ? JSON.stringify(o.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || t('err.generic'));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error(t('err.file')));
      r.readAsDataURL(file);
    });
  }

  function toast(msg, kind) {
    document.querySelectorAll('.toast').forEach(x => x.remove()); // one message at a time
    const el = document.createElement('div');
    el.className = 'toast notice ' + (kind || '');
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:50;max-width:640px;margin:0 auto;box-shadow:0 4px 18px rgba(0,0,0,.18)';
    el.innerHTML = `<p>${esc(msg)}</p>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5200);
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = esc(label || t('common.working')); }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  const dialog = document.getElementById('dialog');
  function openDialog(html) {
    document.getElementById('dialog-body').innerHTML = html;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function closeDialog() { if (dialog.open) dialog.close(); }
  dialog.addEventListener('click', e => { if (e.target === dialog) closeDialog(); });

  // Hazard level shown with the safety colour and signal word of the country where it happens.
  function hzWord(hz, lang) { return hz ? (hz.word[lang || state.lang] || hz.word.en) : ''; }
  function hzStyle(hz) { return hz ? ` style="background:${esc(hz.bg)};color:${esc(hz.fg)}"` : ''; }
  function tierChip(tier, hz, lang) {
    if (!hz && state.inc && state.inc.hazard && state.inc.assessment && state.inc.assessment.tier === tier) hz = state.inc.hazard;
    if (!hz) return `<span class="tier ${esc(tier)}"><span class="dot ${esc(tier)}"></span>${esc(t('tier.' + tier))}</span>`;
    return `<span class="tier hz ${esc(tier)} lvl-${esc(hz.level)}"${hzStyle(hz)} title="${esc(L(hz.standard.name))}">${icon(hz.level === 'green' ? 'shield' : 'alert')}${esc(hzWord(hz, lang))}</span>`;
  }

  // -------------------------------------------------------------------------
  // Chrome: nav, mode bar, language
  // -------------------------------------------------------------------------
  function renderChrome(route) {
    document.documentElement.lang = state.lang;
    const links = [['#/', 'nav.home'], ['#/report', 'nav.report'], ['#/stats', 'nav.stats'], ['#/ledger', 'nav.ledger'], ['#/learn', 'nav.learn']];
    document.getElementById('nav').innerHTML = links.map(([href, k]) => {
      const current = route === href || (href !== '#/' && route.startsWith(href));
      return `<a href="${href}" ${current ? 'aria-current="page"' : ''}>${esc(t(k))}</a>`;
    }).join('');
    document.querySelectorAll('.lang-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    const c = state.cfg || {};
    document.getElementById('modebar').innerHTML = `<div class="modebar-inner">
      <span><b>${esc(t('mode.ai'))}:</b> ${esc(c.aiLive ? t('mode.aiLive') : t('mode.aiDemo'))}</span>
      <span><b>PayPal:</b> ${esc(c.paypalLive ? t('mode.ppLive') : t('mode.ppSim'))}</span>
      ${navigator.onLine === false ? `<span><b>${esc(t('off.badge'))}</b> ${esc(t('off.text'))}</span>` : ''}
      ${outbox().length ? `<span><b>${esc(t('off.queued', { n: outbox().length }))}</b></span>` : ''}</div>`;
  }

  document.querySelectorAll('.lang-switch button').forEach(b => b.addEventListener('click', () => {
    state.lang = b.dataset.lang;
    store.set('lang', state.lang);
    route();
  }));

  // -------------------------------------------------------------------------
  // Router
  // -------------------------------------------------------------------------
  async function route() {
    const hash = location.hash || '#/';
    renderChrome(hash);
    const parts = hash.replace(/^#\/?/, '').split('/');
    try {
      if (parts[0] === '' ) return await viewHome();
      if (parts[0] === 'report') return viewReport();
      if (parts[0] === 'incident' && parts[1]) return await viewIncident(parts[1], parts[2]);
      if (parts[0] === 'evidence' && parts[1]) return await viewEvidenceFile(parts[1]);
      if (parts[0] === 'ledger') return await viewLedger();
      if (parts[0] === 'stats') return await viewStats();
      if (parts[0] === 'support' && parts[1]) return await viewSupport(parts[1]);
      if (parts[0] === 'official' && parts[1]) return await viewOfficial(parts[1]);
      if (parts[0] === 'learn') return await viewLearn();
      if (parts[0] === 'poster' && parts[2]) return await viewPoster(parts[1], parts[2]);
      if (parts[0] === 'sponsor' && parts[2]) return await viewSponsorSim(parts[1], parts[2]);
      $app.innerHTML = `<div class="panel"><h1>${esc(t('err.notFound'))}</h1><a class="btn" href="#/">${esc(t('nav.home'))}</a></div>`;
    } catch (err) {
      $app.innerHTML = `<div class="panel"><h1>${esc(t('err.loadTitle'))}</h1><p class="error">${esc(err.message)}</p><a class="btn" href="#/">${esc(t('nav.home'))}</a></div>`;
    }
  }
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });

  // -------------------------------------------------------------------------
  // Home
  // -------------------------------------------------------------------------
  async function viewHome() {
    const incidents = owned.list().length ? await api('/api/incidents/mine', { body: { owned: owned.list() } }).catch(() => []) : [];
    const impact = await api('/api/impact').catch(() => null);
    const list = incidents.length ? `<ul class="incident-list">${incidents.map(i => `
      <li><a href="#/incident/${esc(i.id)}"><span class="dot ${esc(i.assessment.tier)}" aria-hidden="true"${i.hazard ? ` style="background:${esc(i.hazard.bg)}"` : ''}></span>
        <span><strong>${esc(L(state.cfg.typeLabels[i.assessment.type]))}</strong> · ${esc(i.location && i.location.label || t('home.noPlace'))}<br>
        <span class="muted">${esc(fmtDate(i.createdAt))} · ${esc(t('tier.' + i.assessment.tier))} · ${esc(t('fund.raised'))} ${esc(fmtMoney(i.fund.raised))}</span></span></a></li>`).join('')}</ul>`
      : `<p class="muted">${esc(t('home.empty'))}</p>`;
    $app.innerHTML = `
      <section class="hero">
        <div>
          <h1>${esc(t('home.title'))}</h1>
          <p>${esc(t('home.lead'))}</p>
          <div class="btn-row"><a class="btn" href="#/report" data-action="new-report" data-domain="environment">${esc(t('home.cta'))}</a><a class="btn" href="#/report" data-action="new-report" data-domain="infrastructure">${esc(t('home.ctaInfra'))}</a><a class="btn" href="#/report" data-action="new-report" data-domain="community">${esc(t('home.ctaCommunity'))}</a><a class="btn secondary" href="#/ledger">${esc(t('home.seeLedger'))}</a></div>
        </div>
        <div class="hero-signal" aria-label="${esc(t('home.tiersLabel'))}">
          <div style="background:var(--go-bg);color:var(--go)">${icon('gloves')}<span>${esc(t('home.tierGreen'))}</span></div>
          <div style="background:var(--caution-bg);color:#7a4c0b">${icon('ppe')}<span>${esc(t('home.tierYellow'))}</span></div>
          <div style="background:var(--stop-bg);color:var(--stop)">${icon('notouch')}<span>${esc(t('home.tierRed'))}</span></div>
        </div>
      </section>
      ${impact ? impactHtml(impact) : ''}
      <section class="panel">
        <h2>${esc(t('home.demoTitle'))}</h2>
        <p class="muted">${esc(t('home.demoLead'))}</p>
        <div class="scenarios">
          <div class="scenario"><img src="/samples/A_before.jpg" alt=""><div><h3>${esc(t('home.scenA'))}</h3><p class="muted">${esc(t('home.scenAText'))}</p><button class="btn small" data-action="scenario" data-id="A">${esc(t('home.tryIt'))}</button></div></div>
          <div class="scenario"><img src="/samples/B_river.jpg" alt=""><div><h3>${esc(t('home.scenB'))}</h3><p class="muted">${esc(t('home.scenBText'))}</p><button class="btn small" data-action="scenario" data-id="B">${esc(t('home.tryIt'))}</button></div></div>
          <div class="scenario"><img src="/samples/C_stairs.jpg" alt=""><div><h3>${esc(t('home.scenC'))}</h3><p class="muted">${esc(t('home.scenCText'))}</p><button class="btn small" data-action="scenario" data-id="C">${esc(t('home.tryIt'))}</button></div></div>
          <div class="scenario"><div class="scenario-icon" aria-hidden="true">${icon('road')}</div><div><h3>${esc(t('home.scenD'))}</h3><p class="muted">${esc(t('home.scenDText'))}</p><button class="btn small" data-action="scenario" data-id="D">${esc(t('home.tryIt'))}</button></div></div>
        </div>
        <div class="btn-row"><button class="btn secondary small" data-action="seed">${esc(t('home.seed'))}</button><span class="hint">${esc(t('home.seedHint'))}</span></div>
      </section>
      <section class="panel"><h2>${esc(t('home.reports'))}</h2>
        <p class="privacy-note">${icon('shield')}<span>${esc(t('priv.homeNote'))}</span></p>${list}
        <details class="open-code"><summary>${esc(t('priv.openTitle'))}</summary>
          <label for="open-code">${esc(t('priv.openLabel'))}</label>
          <div class="btn-row"><input id="open-code" type="text" autocomplete="off" spellcheck="false" placeholder="inc_…"><button class="btn small" data-action="open-code">${esc(t('priv.openBtn'))}</button></div>
          <p class="hint">${esc(t('priv.openHint'))}</p></details></section>
      <section class="panel"><h2>${esc(t('home.howTitle'))}</h2>
        <ol>${[1, 2, 3, 4, 5].map(n => `<li>${esc(t('home.how' + n))}</li>`).join('')}</ol></section>`;
  }

  function impactHtml(m) {
    const tiles = [
      [m.incidents, t('imp.reports'), `<span class="tier green">${m.byTier.green}</span> <span class="tier yellow">${m.byTier.yellow}</span> <span class="tier red">${m.byTier.red}</span>`],
      [fmtMoney(m.raised), t('imp.raised'), esc(t('imp.paid', { amount: fmtMoney(m.paidOut) }))],
      [m.milestonesPaid, t('imp.milestones'), esc(t('imp.verified', { ai: m.verifiedByAI, human: m.humanReviewed, rejected: m.rejectedEvidence }))],
      [m.protocolLanguages + (m.localRecordings ? ' + ' + m.localRecordings : ''), t('imp.languages'), esc(t('imp.languagesHint'))]
    ];
    return `<section class="panel" aria-labelledby="impact-h"><h2 id="impact-h">${esc(t('imp.title'))}</h2>
      <div class="impact">${tiles.map(([v, label, sub]) => `<div><strong>${esc(v)}</strong><span>${esc(label)}</span><small>${sub}</small></div>`).join('')}</div>
      <p class="hint">${m.chain.ok ? esc(t('ev.chainOk', { n: m.chain.total })) : esc(t('ev.chainBroken', { n: m.chain.brokenAt }))}</p></section>`;
  }

  // -------------------------------------------------------------------------
  // Report: guided interview
  // -------------------------------------------------------------------------
  const OBS = [['sargassum_fresh', 'sargassum'], ['sargassum_rotting', 'rotting'], ['oil', 'oil'], ['foam_color', 'foam'], ['dead_animals', 'deadfish'], ['containers', 'drum'], ['plastic', 'plastic'], ['smoke', 'smoke'], ['other', 'other']];
  const SYMPTOMS = ['none', 'eyes', 'throat', 'headache', 'nausea', 'skin', 'breathing'];
  const SMELLS = ['none', 'rotten_egg', 'chemical', 'fuel', 'other'];
  const AFFECTED = ['none', 'few_animals', 'many_animals', 'people'];
  const COUNTRIES = ['MX', 'US', 'BR', 'FR', 'OTHER'];
  const SAMPLE_IDS = ['A_before', 'A_after_good', 'A_after_partial', 'A_ppe', 'A_truck', 'B_river', 'B_labslip', 'C_stairs', 'C_cones', 'C_mail', 'C_report'];
  const INFRA_OBS = [['crack_anchor', 'railanchor'], ['crack', 'crack'], ['handrail_loose', 'railing'], ['rust_stain', 'rust'], ['gap_trip', 'gap'], ['falling_pieces', 'falling'], ['water_infiltration', 'water'], ['other_infra', 'other']];
  const PROPERTY_TYPES = ['condo_common', 'rental', 'public', 'condo_unit', 'own_home', 'other'];
  const JURISDICTIONS = ['US-TX', 'US-other', 'MX', 'other'];

  const ENV_STEPS = ['observations', 'safeDistance', 'symptoms', 'smell', 'affected', 'containers', 'photos', 'place', 'review'];
  const INFRA_STEPS = ['infraObs', 'injuries', 'movement', 'crackWidth', 'property', 'photos', 'place', 'review'];
  const COMMUNITY_STEPS = ['cmCategory', 'urgency', 'cmInjuries', 'photos', 'place', 'review'];
  const CM_CATEGORIES = [['gas_smell', 'smell'], ['power_line', 'bolt'], ['flooding', 'water'], ['water_leak', 'drop'], ['road', 'road'], ['streetlight', 'bulb'], ['rental_repairs', 'house'], ['illegal_dumping', 'trash'], ['other_community', 'other']];
  function stepsOf(d) { return d.domain === 'infrastructure' ? INFRA_STEPS : d.domain === 'community' ? COMMUNITY_STEPS : ENV_STEPS; }
  function domainOf(x) { return ['infrastructure', 'community'].includes(x) ? x : 'environment'; }

  function newDraft(domain) {
    return {
      step: 0, domain: domainOf(domain),
      answers: { domain: domainOf(domain), category: '', urgency: '', hazardous: '', observations: [], safeDistance: '', symptoms: [], smell: '', affected: '', containers: '', description: '', helpers: '', tools: '', placeLabel: '', country: domain === 'infrastructure' || domain === 'community' ? 'US' : 'MX',
        injuries: '', movement: '', crackWidth: '', propertyType: '', jurisdiction: domain === 'infrastructure' ? 'US-TX' : '', builtYear: '', developerSelling: '', builderPatched: '', sameDefectElsewhere: '', boughtFromBuilder: '' },
      photos: {}, voice: null, anonymous: true, name: '', consent: false, statsOptIn: true, lat: null, lng: null
    };
  }

  const SCENARIOS = {
    A: () => ({
      ...newDraft(), step: 8,
      answers: { observations: ['sargassum_rotting'], safeDistance: 'yes', symptoms: ['eyes'], smell: 'rotten_egg', affected: 'none', containers: 'no',
        description: t('scen.A.desc'), helpers: 8, tools: t('scen.A.tools'), placeLabel: 'Mahahual, Quintana Roo (demo)', country: 'MX' },
      photos: { wide: { sampleId: 'A_before', preview: '/samples/A_before.jpg' } }
    }),
    B: () => ({
      ...newDraft(), step: 8,
      answers: { observations: ['foam_color', 'containers'], safeDistance: 'yes', symptoms: ['throat'], smell: 'chemical', affected: 'few_animals', containers: 'yes',
        description: t('scen.B.desc'), helpers: 0, tools: '', placeLabel: t('scen.B.place'), country: 'MX' },
      photos: { wide: { sampleId: 'B_river', preview: '/samples/B_river.jpg' } }
    }),
    C: () => {
      const d = newDraft('infrastructure');
      d.step = INFRA_STEPS.length - 1;
      Object.assign(d.answers, { observations: ['crack_anchor', 'rust_stain', 'gap_trip'], injuries: 'none', movement: 'unsure', crackWidth: '1to3',
        propertyType: 'condo_common', jurisdiction: 'US-TX', builtYear: 2020, developerSelling: 'yes', builderPatched: 'yes', sameDefectElsewhere: 'same_hoa', description: t('scen.C.desc'), placeLabel: 'Entrance stairs, condominium in Austin, TX (demo)', country: 'US' });
      d.photos = { wide: { sampleId: 'C_stairs', preview: '/samples/C_stairs.jpg' } };
      return d;
    },
    D: () => {
      const d = newDraft('community');
      d.step = COMMUNITY_STEPS.length - 1;
      Object.assign(d.answers, { category: 'road', observations: ['road'], urgency: 'soon', injuries: 'none', description: t('scen.D.desc'), placeLabel: 'Street in Austin, TX (demo)', country: 'US' });
      return d;
    }
  };

  function redFlag(a) {
    if (a.domain === 'community') return ['gas_smell', 'power_line'].includes(a.category) || a.injuries === 'serious' || a.hazardous === 'yes' || (a.urgency === 'immediate' && ['flooding', 'water_leak', 'road', 'other_community'].includes(a.category));
    if (a.domain === 'infrastructure') return a.movement === 'yes' || a.observations.includes('handrail_loose') || a.observations.includes('falling_pieces') || a.injuries === 'serious';
    return a.containers === 'yes' || a.observations.includes('containers') || a.smell === 'chemical' || a.symptoms.includes('breathing') ||
      a.affected === 'people' || a.affected === 'many_animals' || a.observations.includes('smoke');
  }
  function emergency(a) { return a.domain === 'community' ? (a.injuries === 'serious' || a.category === 'gas_smell' || (a.category === 'flooding' && a.urgency === 'immediate')) : a.domain === 'infrastructure' ? a.injuries === 'serious' : (a.symptoms.includes('breathing') || a.affected === 'people'); }

  function viewReport() {
    if (!state.draft) state.draft = store.get('draft', null) || newDraft();
    const d = state.draft;
    const a = d.answers;
    const STEPS = stepsOf(d).length;
    const banners = [];
    if (emergency(a)) banners.push(`<div class="notice stop"><p><strong>${esc(t('rep.emergencyTitle'))}</strong> ${esc(t(a.domain === 'infrastructure' ? 'inf.emergencyText' : a.domain === 'community' ? 'cm.emergencyText' : 'rep.emergencyText'))}</p></div>`);
    if (a.domain === 'community' && redFlag(a)) {
      const sp = (state.cfg.specialSteps[state.lang] || state.cfg.specialSteps.en)[a.category];
      banners.push(`<div class="notice stop"><p><strong>${esc(t('cm.redTitle'))}</strong> ${esc(sp || t('cm.redText'))}</p></div>`);
    } else if (d.step > 0 && redFlag(a)) banners.push(a.domain === 'infrastructure'
      ? `<div class="notice stop"><p><strong>${esc(t('inf.redTitle'))}</strong> ${esc(t('inf.redText'))}</p></div>`
      : `<div class="notice stop"><p><strong>${esc(t('rep.redTitle'))}</strong> ${esc(t('rep.redText'))}</p></div>`);
    if (a.safeDistance === 'no') banners.push(`<div class="notice warn"><p>${esc(t('rep.moveAway'))}</p></div>`);
    const progress = Array.from({ length: STEPS }, (_, i) => `<span class="${i <= d.step ? 'done' : ''}"></span>`).join('');
    $app.innerHTML = `<div class="narrow">
      <p class="step-count">${esc(t('rep.stepOf', { n: d.step + 1, total: STEPS }))}</p>
      <div class="progress" aria-hidden="true">${progress}</div>
      ${banners.join('')}
      <section class="panel" aria-live="polite">${stepHtml(d)}</section>
      <div class="btn-row">
        ${d.step > 0 ? `<button class="btn secondary" data-action="step-back">${esc(t('common.back'))}</button>` : ''}
        ${d.step < STEPS - 1 ? `<button class="btn" data-action="step-next" ${d.step === 0 && !a.observations.length ? 'disabled' : ''}>${esc(t('common.next'))}</button>` : ''}
        <button class="btn secondary" data-action="draft-clear">${esc(t('rep.startOver'))}</button>
      </div></div>`;
  }

  function choiceGrid(name, options, selected, multi, icons) {
    return `<div class="choices" role="group">${options.map((o, i) => {
      const on = multi ? selected.includes(o) : selected === o;
      return `<button type="button" class="choice ${icons ? '' : 'wide'}" data-action="choose" data-name="${name}" data-value="${o}" data-multi="${multi ? 1 : 0}" aria-pressed="${on}">
        ${icons ? icon(icons[i]) : ''}<span>${esc(t('opt.' + name + '.' + o))}</span></button>`;
    }).join('')}</div>`;
  }

  function stepHtml(d) {
    const a = d.answers;
    switch (stepsOf(d)[d.step]) {
      case 'cmCategory': return `<h1>${esc(t('cm.q.category'))}</h1>${choiceGrid('cmCategory', CM_CATEGORIES.map(o => o[0]), a.category, false, CM_CATEGORIES.map(o => o[1]))}
        ${a.category === 'illegal_dumping' ? `<label>${esc(t('cm.q.hazardous'))}</label>${choiceGrid('hazardous', ['yes', 'no', 'unsure'], a.hazardous, false)}` : ''}
        ${a.category === 'rental_repairs' ? `<p class="hint">${esc(t('cm.rentalHint'))}</p>` : ''}`;
      case 'cmInjuries': return `<h1>${esc(t('cm.q.injuries'))}</h1>${choiceGrid('cmInjuries', ['none', 'minor', 'serious'], a.injuries, false)}`;
      case 'urgency': return `<h1>${esc(t('cm.q.urgency'))}</h1>${choiceGrid('urgency', ['immediate', 'soon', 'not_urgent'], a.urgency, false)}`;
      case 'infraObs': return `<h1>${esc(t('inf.q.obs'))}</h1><p class="hint">${esc(t('rep.multi'))}</p>${choiceGrid('infraObs', INFRA_OBS.map(o => o[0]), a.observations, true, INFRA_OBS.map(o => o[1]))}`;
      case 'injuries': return `<h1>${esc(t('inf.q.injuries'))}</h1>${choiceGrid('injuries', ['none', 'minor', 'serious'], a.injuries, false)}`;
      case 'movement': return `<h1>${esc(t('inf.q.movement'))}</h1><div class="notice warn"><p>${esc(t('inf.movementHint'))}</p></div>${choiceGrid('movement', ['no', 'yes', 'unsure'], a.movement, false)}`;
      case 'crackWidth': return `<h1>${esc(t('inf.q.width'))}</h1><p class="hint">${esc(t('inf.widthHint'))}</p>${choiceGrid('crackWidth', ['hairline', '1to3', 'over3', 'unknown'], a.crackWidth, false)}`;
      case 'property': return `<h1>${esc(t('inf.q.property'))}</h1>${choiceGrid('propertyType', PROPERTY_TYPES, a.propertyType, false)}
        <div class="field-row"><div><label for="jurisdiction">${esc(t('inf.jurisdiction'))}</label><select id="jurisdiction" data-bind="jurisdiction">${JURISDICTIONS.map(j => `<option value="${j}" ${a.jurisdiction === j ? 'selected' : ''}>${esc(t('jur.' + j))}</option>`).join('')}</select></div>
        <div><label for="builtYear">${esc(t('inf.builtYear'))}</label><input id="builtYear" type="number" min="1900" max="2100" data-bind="builtYear" value="${esc(a.builtYear)}" placeholder="2020"></div></div>
        ${['condo_common', 'condo_unit'].includes(a.propertyType) ? `<label>${esc(t('inf.q.selling'))}</label>${choiceGrid('developerSelling', ['yes', 'no', 'unsure'], a.developerSelling, false)}` : ''}
        ${['condo_common', 'condo_unit', 'own_home'].includes(a.propertyType) ? `<label>${esc(t('inf.q.patched'))}</label>${choiceGrid('builderPatched', ['yes', 'no', 'unsure'], a.builderPatched, false)}
        <label>${esc(t('inf.q.elsewhere'))}</label>${choiceGrid('sameDefectElsewhere', ['same_hoa', 'other_hoa', 'no', 'unsure'], a.sameDefectElsewhere, false)}
        <label>${esc(t('inf.q.bought'))}</label>${choiceGrid('boughtFromBuilder', ['yes', 'no', 'unsure'], a.boughtFromBuilder, false)}` : ''}`;
      case 'photos': return photoStep(d);
      case 'place': return placeStep(d);
      case 'review': return reviewStep(d);
    }
    switch (d.step) {
      case 0: return `<h1>${esc(t('rep.q.observations'))}</h1><p class="hint">${esc(t('rep.multi'))}</p>${choiceGrid('observations', OBS.map(o => o[0]), a.observations, true, OBS.map(o => o[1]))}`;
      case 1: return `<h1>${esc(t('rep.q.safeDistance'))}</h1>${choiceGrid('safeDistance', ['yes', 'no'], a.safeDistance, false)}`;
      case 2: return `<h1>${esc(t('rep.q.symptoms'))}</h1><p class="hint">${esc(t('rep.multi'))}</p>${choiceGrid('symptoms', SYMPTOMS, a.symptoms, true)}`;
      case 3: return `<h1>${esc(t('rep.q.smell'))}</h1>${choiceGrid('smell', SMELLS, a.smell, false)}`;
      case 4: return `<h1>${esc(t('rep.q.affected'))}</h1>${choiceGrid('affected', AFFECTED, a.affected, false)}`;
      case 5: return `<h1>${esc(t('rep.q.containers'))}</h1><p class="hint">${esc(t('rep.containersHint'))}</p>${choiceGrid('containers', ['yes', 'no', 'unsure'], a.containers, false)}`;
      case 6: return photoStep(d);
      default: return '';
    }
  }

  function countryOptions(selected) {
    const list = state.cfg.countries.slice().sort((x, y) => L(x.name).localeCompare(L(y.name), state.lang));
    return list.map(c => `<option value="${c.code}" ${selected === c.code ? 'selected' : ''}>${esc(L(c.name))}</option>`).join('') + `<option value="OTHER" ${selected === 'OTHER' ? 'selected' : ''}>${esc(t('country.OTHER'))}</option>`;
  }

  function placeStep(d) {
    const a = d.answers;
    {
      return `<h1>${esc(t('rep.q.place'))}</h1>
        <label for="placeLabel">${esc(t('rep.placeLabel'))}</label><input id="placeLabel" type="text" data-bind="placeLabel" value="${esc(a.placeLabel)}" placeholder="${esc(t('rep.placePh'))}">
        <div class="field-row"><div><label for="country">${esc(t('rep.country'))}</label><select id="country" data-bind="country">${countryOptions(a.country)}</select></div>
        ${d.domain !== 'environment' ? '</div>' : `<div><label for="helpers">${esc(t('rep.helpers'))}</label><input id="helpers" type="number" min="0" max="500" data-bind="helpers" value="${esc(a.helpers)}"></div></div>`}
        <div class="btn-row"><button class="btn secondary small" data-action="geolocate">${esc(t('rep.useLocation'))}</button><span class="hint" id="geo-status">${d.lat ? esc(t('rep.locationSaved')) : ''}</span></div>
        <label for="description">${esc(t('rep.description'))}</label><textarea id="description" data-bind="description" placeholder="${esc(t('rep.descPh'))}">${esc(a.description)}</textarea>
        ${d.domain !== 'environment' ? '' : `<label for="tools">${esc(t('rep.tools'))}</label><input id="tools" type="text" data-bind="tools" value="${esc(a.tools)}">`}
        <h3 style="margin-top:18px">${esc(t('rep.voiceTitle'))}</h3><p class="hint">${esc(t('rep.voiceHint'))}</p>
        <div class="btn-row"><button class="btn secondary small" data-action="voice-record" id="voice-btn">${esc(t('rep.record'))}</button>
          <span class="btn secondary small file-btn">${esc(t('rep.voiceFile'))}<input type="file" accept="audio/*" data-action-change="voice-file"></span>
          <span class="hint" id="voice-status">${d.voice ? esc(t('rep.voiceSaved')) : ''}</span></div>`;
    }
  }

  function photoSlots(a) {
    if (a.domain === 'infrastructure') return [['wide', 'inf.slot.wide'], ['close', 'inf.slot.coin'], ['anchor', 'inf.slot.anchor']];
    if (a.domain === 'community') return [['wide', 'cm.slot.wide'], ['close', 'cm.slot.close']];
    return redFlag(a) ? [['wide', 'rep.slot.wideZoom'], ['label', 'rep.slot.labelZoom']] : [['wide', 'rep.slot.wide'], ['close', 'rep.slot.close'], ['scale', 'rep.slot.scale']];
  }

  function sampleSelect(action, extra) {
    return `<select aria-label="${esc(t('rep.sample'))}" data-action-change="${action}" ${extra || ''}><option value="">${esc(t('rep.sample'))}</option>${SAMPLE_IDS.map(s => `<option value="${s}">${esc(t('sample.' + s))}</option>`).join('')}</select>`;
  }

  function photoStep(d) {
    const a = d.answers;
    const slots = photoSlots(a);
    const intro = a.domain === 'community' ? (redFlag(a) ? `<div class="notice stop"><p>${esc(t('cm.photoRed'))}</p></div>` : `<p>${esc(t('cm.photoGuide'))}</p>`)
      : a.domain === 'infrastructure' ? `<p>${esc(t('inf.photoGuide'))}</p>`
      : redFlag(a) ? `<div class="notice stop"><p>${esc(t('rep.photoRed'))}</p></div>` : `<p>${esc(t('rep.photoGuide'))}</p>`;
    return `<h1>${esc(t('rep.q.photos'))}</h1>${intro}
      <div class="photo-grid">${slots.map(([slot, key]) => {
        const p = d.photos[slot];
        return `<div class="photo-slot"><div class="slot-title">${esc(t(key))}</div>
          ${p ? `<img src="${esc(p.preview)}" alt="${esc(t(key))}">` : ''}
          <span class="btn secondary small file-btn" style="width:100%">${esc(p ? t('rep.replace') : t('rep.takePhoto'))}<input type="file" accept="image/*" capture="environment" data-action-change="photo-file" data-slot="${slot}"></span>
          <div style="margin-top:6px">${sampleSelect('photo-sample', `data-slot="${slot}"`)}</div></div>`;
      }).join('')}</div><p class="hint">${esc(t('rep.photoPrivacy'))}</p>`;
  }

  function reviewStep(d) {
    const a = d.answers;
    const photos = Object.entries(d.photos).filter(([, p]) => p);
    const list = (arr, name) => (arr.length ? arr.map(v => t('opt.' + name + '.' + v)).join(', ') : '—');
    return `<h1>${esc(t('rep.reviewTitle'))}</h1>
      <dl class="reason-grid">
        ${a.domain === 'community' ? `<div><dt>${esc(t('cm.sum.category'))}</dt><dd>${esc(a.category ? t('opt.cmCategory.' + a.category) : '—')}</dd></div>
        <div><dt>${esc(t('cm.sum.urgency'))}</dt><dd>${esc(a.urgency ? t('opt.urgency.' + a.urgency) : '—')}</dd></div>` : a.domain === 'infrastructure' ? `<div><dt>${esc(t('rep.sum.saw'))}</dt><dd>${esc(list(a.observations, 'infraObs'))}</dd></div>
        <div><dt>${esc(t('inf.sum.property'))}</dt><dd>${esc(a.propertyType ? t('opt.propertyType.' + a.propertyType) : '—')}</dd></div>
        <div><dt>${esc(t('inf.builtYear'))}</dt><dd>${esc(a.builtYear || '—')}</dd></div>` : `<div><dt>${esc(t('rep.sum.saw'))}</dt><dd>${esc(list(a.observations, 'observations'))}</dd></div>
        <div><dt>${esc(t('rep.sum.symptoms'))}</dt><dd>${esc(list(a.symptoms, 'symptoms'))}</dd></div>
        <div><dt>${esc(t('rep.sum.smell'))}</dt><dd>${esc(a.smell ? t('opt.smell.' + a.smell) : '—')}</dd></div>`}
        <div><dt>${esc(t('rep.sum.place'))}</dt><dd>${esc(a.placeLabel || '—')}</dd></div>
        <div><dt>${esc(t('rep.sum.photos'))}</dt><dd>${photos.length}</dd></div>
      </dl>
      <div class="thumbs">${photos.map(([, p]) => `<img src="${esc(p.preview)}" alt="">`).join('')}</div>
      <h2 style="margin-top:18px">${esc(t('rep.privacyTitle'))}</h2>
      <label class="check"><input type="checkbox" data-bind-check="anonymous" ${d.anonymous ? 'checked' : ''}> <span>${esc(t('rep.anonymous'))}</span></label>
      ${d.anonymous ? '' : `<label for="name">${esc(t('rep.name'))}</label><input id="name" type="text" data-bind-root="name" value="${esc(d.name)}">`}
      <label class="check"><input type="checkbox" data-bind-check="statsOptIn" ${d.statsOptIn !== false ? 'checked' : ''}> <span>${esc(t('stats.optIn'))}</span></label>
      <p class="hint">${esc(t('stats.optInHint'))}</p>
      <label class="check"><input type="checkbox" data-bind-check="consent" ${d.consent ? 'checked' : ''}> <span>${esc(t('rep.consent'))}</span></label>
      <div class="btn-row"><button class="btn" data-action="submit-report" ${d.consent ? '' : 'disabled'}>${esc(t('rep.submit'))}</button></div>
      <p class="hint">${esc(t('rep.submitHint'))}</p>`;
  }

  function reportBody(d) {
    const photos = Object.entries(d.photos).filter(([, p]) => p).map(([role, p]) => (p.sampleId ? { role, sampleId: p.sampleId } : { role, dataUrl: p.dataUrl }));
    return { answers: d.answers, photos, voiceDataUrl: d.voice, anonymous: d.anonymous, reporterName: d.anonymous ? '' : d.name, consent: d.consent, statsOptIn: d.statsOptIn !== false, lang: state.lang, lat: d.lat, lng: d.lng };
  }

  // Offline outbox: reports made without signal are kept on the phone and sent on reconnect.
  function outbox() { return store.get('outbox', []); }
  function queueReport(body) {
    const list = outbox().concat([{ body, at: new Date().toISOString() }]);
    try { localStorage.setItem('outbox', JSON.stringify(list)); return true; } catch (_) { return false; }
  }
  let flushing = false;
  async function flushOutbox() {
    if (flushing || !navigator.onLine) return;
    const list = outbox();
    if (!list.length) return;
    flushing = true;
    const remaining = [];
    let sent = 0;
    for (const item of list) {
      try { const inc = await api('/api/incidents', { body: item.body }); owned.add(inc.id, inc.ownerKey); sent++; } catch (err) { if (err.status === undefined) remaining.push(item); }
    }
    store.set('outbox', remaining);
    flushing = false;
    if (sent) { toast(t('off.sent', { n: sent })); route(); }
  }
  window.addEventListener('online', () => { flushOutbox(); renderChrome(location.hash || '#/'); });
  window.addEventListener('offline', () => renderChrome(location.hash || '#/'));

  function saveDraft() {
    // Photos as data URLs can exceed storage quotas; keep only samples in storage.
    const d = state.draft;
    const slim = { ...d, voice: null, photos: Object.fromEntries(Object.entries(d.photos).filter(([, p]) => p && p.sampleId)) };
    store.set('draft', slim);
  }

  // -------------------------------------------------------------------------
  // Incident view
  // -------------------------------------------------------------------------
  const ENV_TABS = ['summary', 'safety', 'report', 'solutions', 'help', 'fund', 'evidence'];
  const INFRA_TABS = ['summary', 'safety', 'report', 'solutions', 'fund', 'evidence'];
  const COMMUNITY_TABS = ['summary', 'safety', 'report', 'help', 'fund', 'evidence'];
  function tabsOf(inc) { return inc.domain === 'infrastructure' ? INFRA_TABS : inc.domain === 'community' ? COMMUNITY_TABS : ENV_TABS; }

  async function viewIncident(id, tab) {
    state.inc = await api('/api/incidents/' + encodeURIComponent(id));
    state.report = null;
    state.cost = null;
    state.summary = null;
    state.tab = tabsOf(state.inc).includes(tab) ? tab : 'safety';
    renderIncident();
  }

  function renderIncident() {
    const inc = state.inc;
    const a = inc.assessment;
    $app.innerHTML = `
      <div class="incident-head">
        <div><h1>${esc(L(state.cfg.typeLabels[a.type]))}</h1>
          <p class="muted">${esc(inc.location && inc.location.label || t('home.noPlace'))} · ${esc(fmtDate(inc.createdAt))} · <span class="hash">${esc(inc.id)}</span></p>
          <p class="private-badge">${icon('shield')}<span>${esc(t('priv.badge'))}</span></p></div>
        <div>${tierChip(a.tier)}</div>
      </div>
      <div class="tabs" role="tablist">${tabsOf(inc).map(k => `<button role="tab" id="tab-${k}" aria-selected="${state.tab === k}" data-action="tab" data-tab="${k}">${esc(t((inc.domain === 'infrastructure' && k === 'solutions' ? 'tab.whatToDo' : 'tab.' + k)))}</button>`).join('')}</div>
      <div role="tabpanel" id="tabpanel" aria-labelledby="tab-${state.tab}">${tabHtml()}</div>`;
    afterTabRender();
  }

  function tabHtml() {
    switch (state.tab) {
      case 'safety': return safetyTab();
      case 'solutions': return solutionsTab();
      case 'help': return helpTab();
      case 'fund': return fundTab();
      case 'report': return '<div id="report-slot" class="panel">' + esc(t('common.loading')) + '</div>';
      case 'summary': return '<div id="summary-slot" class="panel">' + esc(t('common.loading')) + '</div>';
      case 'evidence': return '<div id="evidence-slot" class="panel">' + esc(t('common.loading')) + '</div>';
      default: return '';
    }
  }

  async function afterTabRender() {
    if (state.tab === 'summary') {
      if (!state.sumLang) state.sumLang = state.cfg.protocols[state.lang] ? state.lang : 'en';
      await loadSummary();
    }
    if (state.tab === 'evidence') {
      const ev = await api('/api/incidents/' + state.inc.id + '/evidence');
      const a = state.inc.answers || {};
      ev.privacyLaws = await api(`/api/legal/app?country=${encodeURIComponent(a.country || '')}&state=${encodeURIComponent(a.region || (/^[A-Z]{2}-/.test(a.jurisdiction || '') ? a.jurisdiction : '') || (/austin|texas|, ?tx\b/i.test(a.placeLabel || '') ? 'US-TX' : ''))}`).catch(() => null);
      document.getElementById('evidence-slot').outerHTML = evidenceHtml(ev);
    }
    if (state.tab === 'fund') mountPayPal();
    if (state.tab === 'report') {
      if (!state.report) state.report = await api('/api/incidents/' + state.inc.id + '/report-targets');
      if (state.inc.domain === 'infrastructure' && !state.cost) state.cost = await api('/api/incidents/' + state.inc.id + '/cost').catch(() => null);
      const slot = document.getElementById('report-slot');
      if (slot) slot.outerHTML = reportTabHtml(state.report);
    }
  }


  // ---- Summary -----------------------------------------------------------
  async function loadSummary() {
    const slot = document.getElementById('summary-slot');
    if (!slot) return;
    slot.innerHTML = esc(t('common.loading'));
    try {
      state.summary = await api(`/api/incidents/${state.inc.id}/summary?lang=${encodeURIComponent(state.sumLang)}`);
    } catch (err) { slot.textContent = err.message; return; }
    if (state.tab === 'summary') slot.outerHTML = summaryHtml(state.summary);
  }

  function summaryHtml(s) {
    const langs = Object.keys(state.cfg.protocols);
    const notice = s.translation === 'machine' ? `<p class="badge warn">${esc(t('sum.machine'))}</p>`
      : (s.translation === 'unavailable' || s.translation === 'failed') ? `<p class="hint">${esc(t('sum.partial'))}</p>` : '';
    const body = s.sections.map(sec => `<section class="sum-sec sum-${esc(sec.id)}"><h3>${esc(sec.title)}</h3>${sec.tier ? tierChip(sec.tier, sec.hazard, s.lang) + ' ' : ''}${sec.text ? `<p dir="auto">${esc(sec.text)}</p>` : ''}${sec.items ? `<${sec.id === 'todo' ? 'ol' : 'ul'}>${sec.items.map(i => `<li dir="auto">${esc(i)}</li>`).join('')}</${sec.id === 'todo' ? 'ol' : 'ul'}>` : ''}</section>`).join('');
    return `<div id="summary-slot" class="panel summary">
      <div class="btn-row no-print sum-tools">
        <label for="sum-lang">${esc(t('sum.lang'))}</label>
        <select id="sum-lang">${langs.map(l => `<option value="${l}" ${l === state.sumLang ? 'selected' : ''}>${esc(state.cfg.protocols[l].name)}</option>`).join('')}</select>
        <button class="btn" data-action="print">${esc(t('ev.print'))}</button>
        <button class="btn secondary" data-action="sum-copy">${esc(t('sum.copy'))}</button>
        <button class="btn secondary" data-action="sum-share">${esc(t('sum.share'))}</button>
      </div>
      ${notice}
      <article id="sum-doc" lang="${esc(s.lang)}" dir="${esc(s.dir)}">
        <h2>${esc(s.title)}</h2>
        <p class="muted">${esc(s.generated)}</p>
        ${body}
        <p class="hint" dir="auto">${esc(s.disclaimer)}</p>
      </article></div>`;
  }

  function summaryText(s) {
    const lines = [s.title, s.generated, ''];
    s.sections.forEach(sec => {
      lines.push(sec.title.toUpperCase());
      if (sec.text) lines.push(sec.text);
      (sec.items || []).forEach((i, n) => lines.push((sec.id === 'todo' ? (n + 1) + '. ' : '- ') + i));
      lines.push('');
    });
    lines.push(s.disclaimer);
    return lines.join('\n');
  }

  document.addEventListener('change', e => {
    if (e.target && e.target.id === 'sum-lang') { state.sumLang = e.target.value; loadSummary(); }
  });

  // ---- Safety ------------------------------------------------------------
  function protocolOptions() {
    const p = state.cfg.protocols;
    const langs = Object.keys(p).map(k => `<option value="${k}" ${state.protoLang === k ? 'selected' : ''}>${esc(p[k].name)}</option>`).join('');
    const local = state.cfg.localLanguages.map(l => `<option value="${l.code}" ${state.protoLang === l.code ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
    return `<optgroup label="${esc(t('safety.majorLangs'))}">${langs}</optgroup><optgroup label="${esc(t('safety.localLangs'))}">${local}</optgroup>`;
  }

  function safetyTab() {
    const inc = state.inc;
    const a = inc.assessment;
    const tier = a.tier;
    if (!state.protoLang) state.protoLang = state.lang;
    const local = state.cfg.localLanguages.find(l => l.code === state.protoLang);
    const infra = inc.domain === 'infrastructure';
    const comm = inc.domain === 'community';
    const hz = inc.hazard || { level: tier, bg: '', fg: '', word: { en: t('tier.' + tier) }, standard: { name: { en: '' }, country: { en: '' }, url: '#' } };
    const protoSet = infra ? state.cfg.protocolsInfra : comm ? state.cfg.protocolsCommunity : state.cfg.protocols;
    const baseLang = local ? state.lang : state.protoLang;
    const proto = { ...(protoSet[baseLang] || protoSet.en), dir: (state.cfg.protocols[baseLang] || {}).dir || 'ltr' };
    let icons = (infra ? state.cfg.protocolIconsInfra : comm ? state.cfg.protocolIconsCommunity : state.cfg.protocolIcons)[tier];
    let steps = proto[tier].steps;
    const special = comm && (state.cfg.specialSteps[baseLang] || state.cfg.specialSteps.en)[inc.answers.category];
    if (special) { steps = [special, ...steps]; icons = ['away', ...icons]; }
    const review = local ? 'local' : state.cfg.protocolReview[state.protoLang];
    const reviewBadge = review === 'machine_translation' ? `<span class="badge warn">${esc(t('safety.machine'))}</span>`
      : review === 'pending_team_review' ? `<span class="badge warn">${esc(t('safety.pendingReview'))}</span>`
      : review === 'team_reviewed' ? `<span class="badge ok">${esc(t('safety.reviewed'))}</span>` : '';
    const recordings = (inc.interpreters || []).filter(r => local && r.language.toLowerCase().includes(local.name.split(' ')[0].toLowerCase()));
    const localBlock = local ? `<div class="notice" style="color:var(--ink)"><p><strong>${esc(local.name)}.</strong> ${esc(t('safety.localNote'))}</p>
        ${recordings.length ? recordings.map(r => `<p>${esc(r.name)} · ${esc(r.language)} ${r.status === 'paid' ? `<span class="badge ok">${esc(t('interp.approved'))}</span>` : `<span class="badge warn">${esc(t('interp.pending'))}</span>`}<br><audio controls src="${esc(r.recording.publicUrl)}"></audio></p>`).join('') : `<p>${esc(t('safety.noRecording'))}</p>`}</div>` : '';
    const emergencyBanner = a.emergency ? `<div class="notice stop"><p><strong>${esc(t('rep.emergencyTitle'))}</strong> ${esc(t(comm ? 'cm.emergencyText' : infra ? 'inf.emergencyText' : 'rep.emergencyText'))}</p></div>` : '';
    const aiErr = a.aiError ? `<div class="notice warn"><p>${esc(t('safety.aiUnavailable'))}</p></div>` : '';
    const followUp = (a.followUp || []).length && !(inc.followUpAnswers || []).length ? `
      <section class="panel"><h2>${esc(t('safety.followTitle'))}</h2><p class="hint">${esc(t('safety.followHint'))}</p>
        ${a.followUp.map((q, i) => `<label for="fu-${i}">${esc(L(q))}</label><textarea id="fu-${i}" data-fu="${i}" style="min-height:60px"></textarea>`).join('')}
        <div class="btn-row"><button class="btn" data-action="followup">${esc(t('safety.followSend'))}</button></div></section>` : '';
    return `${emergencyBanner}${aiErr}
      <section class="signal ${tier} lvl-${esc(hz.level)} ${hz.fg === '#ffffff' ? 'on-dark' : 'on-light'}" style="background:${esc(hz.bg)};color:${esc(hz.fg)}" aria-label="${esc(t('safety.signalLabel'))}">
        <div class="hz-panel" lang="${esc(baseLang)}">${icon(hz.level === 'green' ? 'shield' : 'alert')}<span>${esc(hz.word[baseLang] || hz.word.en)}</span></div>
        <div class="signal-head"><div><div>${esc(inc.hazard ? t('hzcolor.' + hz.color) : t('tier.' + tier))}</div><h2>${esc(local ? t((infra ? 'inf.pictoTitle.' : comm ? 'cm.pictoTitle.' : 'safety.pictoTitle.') + tier) : proto[tier].title)}</h2></div></div>
        <ol class="signal-steps" dir="${local ? 'ltr' : esc(proto.dir)}">${steps.map((s, i) => `<li>${icon(icons[i])}<span>${local ? '' : esc(s)}</span></li>`).join('')}</ol>
        <div class="signal-meta"><label for="proto-lang" style="margin:0;color:inherit">${esc(t('safety.protocolLang'))}</label>
          <select id="proto-lang" data-action-change="proto-lang">${protocolOptions()}</select>${reviewBadge}</div>
        <p class="hz-std">${esc(t('hz.standard', { name: L(hz.standard.name), country: L(hz.standard.country) }))} <a href="${esc(hz.standard.url)}" target="_blank" rel="noopener">${esc(t('common.source'))}</a></p>
      </section>
      ${localBlock}
      ${followUp}
      <section class="panel"><h2>${esc(t('safety.whyTitle'))}</h2>
        <p>${esc(L(a.reasoning))}</p>
        <dl class="reason-grid">
          <div><dt>${esc(t('safety.rules'))}</dt><dd>${esc(t('tier.' + a.ruleFloor))}</dd></div>
          <div><dt>${esc(t('safety.ai'))} (${esc(t('source.' + a.source))})</dt><dd>${esc(t('tier.' + a.aiTier))} · ${Math.round((a.confidence || 0) * 100)}%</dd></div>
          <div><dt>${esc(t('safety.final'))}</dt><dd>${esc(t('tier.' + a.tier))}</dd></div>
        </dl>
        ${(a.flags || []).length ? `<p style="margin-top:12px"><strong>${esc(t('safety.signals'))}</strong> ${a.flags.map(f => `<span class="badge">${esc(t('flag.' + f))}</span>`).join('')}</p>` : ''}
        ${(a.notes || []).map(n => `<p class="hint">${esc(t('note.' + n))}</p>`).join('')}
        ${(a.observations || []).length ? `<p class="hint">${esc(t('safety.observed'))}: ${a.observations.map(esc).join('; ')}</p>` : ''}
        <p class="hint">${esc(t('safety.ruleExplain'))}</p>
      </section>
      <section class="panel"><h2>${esc(t('safety.changeTitle'))}</h2><p>${esc(t('safety.changeText'))}</p>
        <label for="reassess-file">${esc(t('safety.newPhoto'))}</label>
        <span class="btn secondary small file-btn">${esc(t('rep.takePhoto'))}<input id="reassess-file" type="file" accept="image/*" capture="environment" data-action-change="reassess-file"></span>
        ${sampleSelect('reassess-sample')}
        <p class="hint" id="reassess-status"></p>
        <div class="btn-row"><button class="btn secondary" data-action="reassess">${esc(t('safety.reassess'))}</button></div>
        <label for="dispute">${esc(t('safety.disagree'))}</label><textarea id="dispute" style="min-height:60px"></textarea>
        <div class="btn-row"><button class="btn secondary small" data-action="dispute">${esc(t('safety.disagreeSend'))}</button></div>
      </section>
      ${infra ? monitorPanel() : ''}
      ${interpretersPanel()}`;
  }

  function interpretersPanel() {
    const inc = state.inc;
    const list = (inc.interpreters || []).map(r => `<div class="card"><h3>${esc(r.name)} · ${esc(r.language)}</h3>
      <audio controls src="${esc(r.recording.publicUrl)}"></audio>
      <p class="hash">SHA-256 ${esc(r.recording.sha256)}</p>
      ${r.status === 'paid'
        ? `<p><span class="badge ok">${esc(t('interp.paid', { amount: fmtMoney(r.fee) }))}</span> ${r.payout && r.payout.simulated ? `<span class="badge warn">${esc(t('fund.simulated'))}</span>` : ''} ${esc(t('interp.approvedBy', { name: r.approval && r.approval.by }))}</p>`
        : `<div class="field-row"><div><label>${esc(t('ms.verifierName'))}</label><input type="text" data-ip-name="${esc(r.id)}"></div><div><label>${esc(t('ms.verifierEmail'))}</label><input type="email" data-ip-email="${esc(r.id)}"></div></div>
           <div class="btn-row"><button class="btn small" data-action="interp-approve" data-id="${esc(r.id)}">${esc(t('interp.approvePay', { amount: fmtMoney(r.fee) }))}</button></div>`}
      </div>`).join('');
    return `<section class="panel"><h2>${esc(t('interp.title'))}</h2><p>${esc(t('interp.lead'))}</p>
      <div class="card-list">${list || `<p class="muted">${esc(t('interp.none'))}</p>`}</div>
      <h3 style="margin-top:18px">${esc(t('interp.add'))}</h3>
      <div class="field-row"><div><label for="ip-name">${esc(t('interp.name'))}</label><input id="ip-name" type="text"></div>
        <div><label for="ip-email">${esc(t('interp.email'))}</label><input id="ip-email" type="email" placeholder="name@example.com"></div></div>
      <label for="ip-lang">${esc(t('interp.language'))}</label>
      <input id="ip-lang" type="text" list="ip-lang-list" placeholder="${esc(t('interp.langPh'))}">
      <datalist id="ip-lang-list">${state.cfg.localLanguages.map(l => `<option value="${esc(l.name)}">`).join('')}</datalist>
      <div class="btn-row"><button class="btn secondary small" data-action="ip-record" id="ip-record-btn">${esc(t('rep.record'))}</button>
        <span class="btn secondary small file-btn">${esc(t('rep.voiceFile'))}<input type="file" accept="audio/*" data-action-change="ip-file"></span><span class="hint" id="ip-status"></span></div>
      <label class="check"><input type="checkbox" id="ip-consent"> <span>${esc(t('interp.consent'))}</span></label>
      <div class="btn-row"><button class="btn" data-action="ip-submit">${esc(t('interp.submit'))}</button></div></section>`;
  }

  // ---- Crack monitoring (infrastructure) ----------------------------------
  function monitorPanel() {
    const mon = state.inc.monitoring || [];
    const first = mon[0];
    const last = mon[mon.length - 1];
    const growth = mon.length >= 2 ? Math.round((last.widthMm - first.widthMm) * 10) / 10 : null;
    return `<section class="panel"><h2>${esc(t('mon.title'))}</h2><p>${esc(t('mon.lead'))}</p>
      ${growth !== null && growth >= 0.5 ? `<div class="notice stop"><p><strong>${esc(t('mon.growing', { mm: growth }))}</strong> ${esc(t('mon.growingText'))}</p></div>` : ''}
      ${mon.length ? `<table class="mon-table"><thead><tr><th>${esc(t('mon.date'))}</th><th>${esc(t('mon.width'))}</th><th>${esc(t('mon.photo'))}</th></tr></thead><tbody>
        ${mon.map(m => `<tr><td>${esc(fmtDate(m.at))}</td><td>${esc(m.widthMm)} mm</td><td>${m.photo ? `<img src="${esc(m.photo.publicUrl)}" alt="" class="mon-thumb">` : '—'}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${esc(t('mon.none'))}</p>`}
      <div class="field-row"><div><label for="mon-width">${esc(t('mon.widthInput'))}</label><input id="mon-width" type="number" min="0" max="200" step="0.1" inputmode="decimal"></div>
        <div><label>${esc(t('mon.photo'))}</label><span class="btn secondary small file-btn">${esc(t('rep.takePhoto'))}<input type="file" accept="image/*" capture="environment" data-action-change="mon-file"></span> ${sampleSelect('mon-sample')}<span class="hint" id="mon-status"></span></div></div>
      <p class="hint">${esc(t('mon.hint'))}</p>
      <div class="btn-row"><button class="btn" data-action="mon-submit">${esc(t('mon.save'))}</button></div></section>`;
  }

  // ---- Report to the right institution -----------------------------------
  const METHOD_ICON = { certified_mail: 'mail', email_and_mail: 'mail', written_notice: 'mail', austin_311: 'call', phone: 'call', official_channel: 'mail', email: 'mail', read: 'folder' };

  function srcLinks(basis, laws) {
    return basis.map(b => {
      const st = laws && laws[b.url];
      const badge = !st ? '' : st.state === 'current' ? ` <span class="law-chk">${esc(t('law.checkedShort', { date: st.lastChecked }))}</span>`
        : ` <span class="badge warn">${esc(t('law.state.' + st.state))}</span>`;
      return `<a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a>${badge}`;
    }).join(' · ');
  }
  function lawWarnings(laws) {
    const changed = Object.entries(laws || {}).filter(([, v]) => v.state === 'changed');
    return changed.map(([, v]) => `<div class="notice stop"><p><strong>${esc(t('law.changedTitle'))}</strong> ${esc(v.note)}</p></div>`).join('');
  }

  // What an answer means, and a reply.
  function answerHtml(x, g) {
    if (x.status !== 'answered' || !g) return '';
    return `<div class="notice answer-help"><p><strong>${esc(t('ans.title', { type: t('ans.type.' + x.responseType) }))}</strong>${x.responder ? ' · ' + esc(x.responder) : ''}</p>
      ${x.responseNote ? `<p class="muted">“${esc(x.responseNote)}”</p>` : ''}
      <ol>${g.points.map(p => `<li>${esc(L(p))}</li>`).join('')}</ol>
      ${g.basis.length ? `<p class="source">${esc(t('common.source'))}: ${g.basis.map(b => `<a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a>`).join(' · ')}</p>` : ''}
      <div class="btn-row"><button class="btn small" data-action="ans-draft" data-id="${esc(x.id)}">${esc(t('ans.prepare'))}</button></div></div>`;
  }

  // Escalation when nobody answers.
  function escalationHtml(e) {
    if (!e) return '';
    const steps = e.next.length ? `<ol class="esc-steps">${e.next.map(n => `<li><span class="lvl-tag">${esc(t('lvl.' + n.level))}</span> ${esc(L(n.how))}
        <div class="source"><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a></div>
        <button class="btn small" data-action="esc-draft" data-report="${esc(e.reportId)}" data-rule="${esc(n.ruleId)}">${esc(t('esc.prepare'))}</button></li>`).join('')}</ol>`
      : `<p>${esc(t('esc.noneVerified'))}</p>`;
    return `<div class="notice warn esc"><p><strong>${esc(t('esc.title', { date: e.overdueSince }))}</strong></p><p>${esc(t('esc.lead'))}</p>${steps}</div>`;
  }

  // Calendar file (.ics) with every follow-up date, made on the device.
  function icsText(inc, report) {
    const escTxt = v => String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Comunidad Fuerte//Follow-ups//' + (state.lang === 'es' ? 'ES' : 'EN'), 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    let n = 0;
    for (const r of report.sent || []) {
      if (r.status === 'resolved') continue;
      for (const f of r.followUps || []) {
        const d = f.date.replace(/-/g, '');
        const next = new Date(Date.parse(f.date + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10).replace(/-/g, '');
        n++;
        lines.push('BEGIN:VEVENT', `UID:${inc.id}-${r.id}-${d}@comunidad-fuerte`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`,
          'SUMMARY:' + escTxt(t('cal.summary', { name: r.targetName })), 'DESCRIPTION:' + escTxt(L(f.label) + '\n' + t('cal.desc', { date: r.sentAt })),
          'BEGIN:VALARM', 'TRIGGER:-PT9H', 'ACTION:DISPLAY', 'DESCRIPTION:' + escTxt(L(f.label)), 'END:VALARM', 'END:VEVENT');
      }
    }
    lines.push('END:VCALENDAR');
    return { text: lines.join('\r\n') + '\r\n', count: n };
  }

  // Official link for the authority (owner side).
  const OFF_STATUS_BADGE = { received: '', in_progress: 'warn', resolved: 'ok', forwarded: '', not_ours: 'warn' };
  function officialUpdatesHtml(updates) {
    if (!updates || !updates.length) return `<p class="muted">${esc(t('gov.noUpdates'))}</p>`;
    return `<ol class="timeline off-updates">${updates.slice().reverse().map(u => `<li><div><span class="badge ${OFF_STATUS_BADGE[u.status] || ''}">${esc(t('gov.st.' + u.status))}</span> <strong>${esc(u.office)}</strong>${u.officer ? ' · ' + esc(u.officer) : ''} · ${esc(fmtDate(u.at))}
      ${u.caseNumber ? `<div>${esc(t('gov.case'))}: <span class="hash">${esc(u.caseNumber)}</span></div>` : ''}
      ${u.eta ? `<div>${esc(t('gov.eta'))}: ${esc(u.eta)}</div>` : ''}
      ${u.forwardedTo ? `<div>${esc(t('gov.forwardedTo'))}: ${esc(u.forwardedTo)}</div>` : ''}
      ${u.note ? `<p>${esc(u.note)}</p>` : ''}</div></li>`).join('')}</ol>`;
  }
  function officialPanelHtml() {
    const of = state.inc.official;
    const token = (store.get('officialTokens', {}) || {})[state.inc.id];
    const link = of && of.active && token ? location.origin + '/#/official/' + token : '';
    return `<section class="panel official-panel"><h2>${icon('shield')} ${esc(t('gov.title'))}</h2>
      <p>${esc(t('gov.lead'))}</p>
      ${link ? `<label for="off-link">${esc(t('gov.linkLabel'))}</label><div class="btn-row"><input id="off-link" type="text" readonly value="${esc(link)}"><button class="btn small" data-action="off-copy">${esc(t('sup.copy'))}</button></div>
        <p class="hint">${esc(t('gov.linkHint'))}</p>
        <div class="btn-row"><button class="btn secondary small" data-action="off-off">${esc(t('sup.off'))}</button></div>`
      : `<div class="btn-row"><button class="btn small" data-action="off-create">${esc(of && !of.active ? t('gov.recreate') : t('gov.create'))}</button></div>${of && of.active && !token ? `<p class="hint">${esc(t('sup.lostLink'))}</p>` : ''}`}
      <h3>${esc(t('gov.updatesTitle'))}</h3>${officialUpdatesHtml(of && of.updates)}
      <p class="hint">${esc(t('gov.privacy'))}</p></section>`;
  }

  // Neighbor support panel (owner side).
  function supportPanelHtml() {
    const sp = state.inc.support;
    const token = (store.get('supportTokens', {}) || {})[state.inc.id];
    const link = sp && sp.active && token ? location.origin + '/#/support/' + token : '';
    const names = sp ? sp.entries.filter(x => x.kind === 'cosign').map(x => x.name) : [];
    return `<section class="panel support-panel"><h2>${icon('people')} ${esc(t('sup.title'))}</h2>
      <p>${esc(t('sup.lead'))}</p>
      ${sp ? `<p><strong>${esc(t('sup.counts', { confirmed: sp.confirmed, cosigned: sp.cosigned }))}</strong>${names.length ? ' · ' + esc(names.join(', ')) : ''}</p>` : ''}
      ${link ? `<label for="sup-link">${esc(t('sup.linkLabel'))}</label><div class="btn-row"><input id="sup-link" type="text" readonly value="${esc(link)}"><button class="btn small" data-action="sup-copy">${esc(t('sup.copy'))}</button></div>
        <p class="hint">${esc(t('sup.linkHint'))}</p>
        <div class="btn-row"><button class="btn secondary small" data-action="sup-off">${esc(t('sup.off'))}</button></div>`
      : `<div class="btn-row"><button class="btn small" data-action="sup-create">${esc(sp && !sp.active ? t('sup.recreate') : t('sup.create'))}</button></div>${sp && sp.active && !token ? `<p class="hint">${esc(t('sup.lostLink'))}</p>` : ''}`}
      <p class="hint">${esc(t('sup.privacy'))}</p></section>`;
  }

  // Laws by level: international, national, state or province, local.
  function legalHtml(legal) {
    if (!legal) return '';
    const stBadge = r => (r.state === 'current' ? `<span class="law-chk">${esc(t('law.checkedShort', { date: r.lastChecked }))}</span>` : `<span class="badge warn">${esc(t('law.state.' + r.state))}</span>`);
    const where = ['country', 'state', 'locality'].map(k => legal.where[k]).filter(Boolean).map(c => L(legal.where.names[c])).join(' › ');
    const layers = legal.layers.map(ly => {
      const place = ly.places.map(p => L(p.name)).join(', ');
      let body;
      if (ly.coverage === 'covered') {
        body = ly.rules.map(r => `<details class="law-rule"><summary><span class="badge">${esc(t('law.kind.' + r.kind))}</span> ${esc(r.title)}</summary>
          <ul>${r.facts.map(f => `<li>${esc(L(f))}</li>`).join('')}</ul>
          ${r.caution ? `<div class="notice warn"><p>${esc(L(r.caution))}</p></div>` : ''}
          <p class="source"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(t('common.source'))}</a> ${stBadge(r)}</p></details>`).join('');
      } else if (ly.coverage === 'not_verified') body = `<p class="muted">${esc(t('lvl.notVerified', { place }))}</p>`;
      else if (ly.coverage === 'none_for_topic') body = `<p class="muted">${esc(t('lvl.noneForTopic', { place }))}</p>`;
      else body = `<p class="muted">${esc(t(ly.level === 'international' ? 'lvl.noIntl' : 'lvl.placeUnknown'))}</p>`;
      return `<div class="lvl lvl-${esc(ly.level)}"><h3><span class="lvl-tag">${esc(t('lvl.' + ly.level))}</span>${place ? ' ' + esc(place) : ''}</h3>${body}</div>`;
    }).join('');
    return `<section class="panel legal-levels"><h2>${icon('shield')} ${esc(t('lvl.title'))}</h2>
      <p>${esc(t('lvl.lead'))}</p>
      <p><strong>${esc(t('lvl.where'))}:</strong> ${esc(where || t('lvl.whereUnknown'))}</p>
      ${!legal.where.locality ? `<p class="hint">${esc(t('lvl.addPlace'))}</p>` : ''}
      ${layers}
      <div class="notice"><p>${esc(t('lvl.stricter'))}</p></div></section>`;
  }

  function reportTabHtml(data) {
    const r = data.responsibility;
    const sender = store.get('sender', {});
    const sentByTarget = {};
    (data.sent || []).forEach(x => { (sentByTarget[x.targetId] = sentByTarget[x.targetId] || []).push(x); });
    const v = r && r.verdict;
    const verdict = v ? `<section class="panel verdict ${esc(v.strength)}"><h2>${esc(t('rp.verdictTitle'))}</h2>
        <p class="verdict-line"><strong>${esc(L(v.pays))}</strong></p><p class="verdict-line">${esc(L(v.acts))}</p>
        ${v.reasons.length ? `<h3>${esc(t('rp.why'))}</h3><ul>${v.reasons.map(x => `<li>${esc(L(x))}</li>`).join('')}</ul>` : ''}
        ${v.cautions.map(c => `<div class="notice warn"><p>${esc(L(c))}</p></div>`).join('')}
        <p class="source">${esc(t('common.source'))}: ${srcLinks(v.basis, data.laws)}</p></section>` : '';
    const resp = r ? `${verdict}<section class="panel"><h2>${esc(t('rp.whoTitle'))}</h2>
        <div class="card-list">${r.parties.map(p => `<article class="card"><h3>${esc(L(p.role))}</h3><p>${esc(L(p.duty))}</p>
          ${p.basis.length ? `<p class="source">${esc(t('common.source'))}: ${srcLinks(p.basis, data.laws)}</p>` : ''}</article>`).join('')}</div>
        ${r.warnings.map(w => `<div class="notice warn"><p>${esc(L(w))}</p></div>`).join('')}
        ${r.deadlines.map(dl => `<div class="notice ${dl.open ? '' : 'stop'}"><p><strong>${esc(t('rp.deadline'))}</strong> ${esc(L(dl.label))}</p><p class="source">${srcLinks(dl.basis, data.laws)}</p></div>`).join('')}
        ${r.steps.length ? `<h3>${esc(t('rp.steps'))}</h3><ol>${r.steps.map(x => `<li>${esc(L(x))}</li>`).join('')}</ol>` : ''}
        <p class="hint">${esc(L(r.note))}</p></section>` : '';
    const targets = data.targets.map((tg, i) => {
      const sent = sentByTarget[tg.id] || [];
      return `<article class="card target">
        <div class="target-head"><span class="target-n">${i + 1}</span><div><h3>${esc(L(tg.name))}</h3>
          <p><span class="badge">${icon(METHOD_ICON[tg.method] || 'mail')} ${esc(t('method.' + tg.method))}</span>
          ${tg.confidence ? (tg.confidence === 'official' ? `<span class="badge ok">${esc(t('conf.official'))}</span>` : tg.confidence === 'located' ? `<span class="badge">${esc(t('conf.located'))}</span>` : `<span class="badge warn">${esc(t('conf.not_confirmed'))}</span>`) : ''}
          ${sent.length ? `<span class="badge ok">${esc(t('rp.sentBadge', { n: sent.length }))}</span>` : ''}</p></div></div>
        <p>${esc(L(tg.why))}</p>${tg.contact ? `<p><strong>${esc(L(tg.contact))}</strong></p>` : ''}
        ${tg.basis && tg.basis.length ? `<p class="source">${esc(t('common.source'))}: ${srcLinks(tg.basis, data.laws)}</p>` : ''}
        <div class="btn-row">${tg.kind === 'info' ? '' : tg.kind === 'phone' ? (tg.tel === undefined || tg.tel === '911' ? `<a class="btn danger small" href="tel:911">${esc(t('rp.call911'))}</a>` : tg.tel ? `<a class="btn ${tg.id === 'emergency' ? 'danger' : ''} small" href="tel:${esc(tg.tel.replace(/[^0-9+]/g, ''))}">${esc(t('rp.callNum', { n: tg.tel }))}</a>` : '') : `<button class="btn small" data-action="rp-prepare" data-i="${i}">${esc(t('rp.prepare'))}</button>`}
          ${tg.url ? `<a class="btn secondary small" href="${esc(tg.url)}" target="_blank" rel="noopener">${esc(t('rp.openChannel'))}</a>` : ''}
          ${tg.kind === 'phone' || tg.kind === 'info' ? '' : `<button class="btn secondary small" data-action="rp-mark" data-i="${i}">${esc(t('rp.markSent'))}</button>`}</div>
        ${sent.map(x => `<div class="sent-row"><p><strong>${esc(t('rp.sentOn', { date: x.sentAt }))}</strong> · ${esc(t('method.' + x.method))}${x.tracking ? ` · ${esc(t('rp.tracking'))}: <span class="hash">${esc(x.tracking)}</span>` : ''} · <span class="badge ${x.status === 'resolved' ? 'ok' : x.status === 'no_answer' ? 'warn' : ''}">${esc(t('rps.' + x.status))}</span></p>
          <ul class="followups">${x.followUps.map(f => `<li>${esc(f.date)}: ${esc(L(f.label))}</li>`).join('')}</ul>
          ${escalationHtml((data.escalation || []).find(e => e.reportId === x.id))}
          ${answerHtml(x, (data.guidance || {})[x.id])}
          ${x.status === 'resolved' ? '' : `<div class="btn-row">${['answered', 'resolved', 'no_answer'].map(st => `<button class="btn secondary small" data-action="rp-status" data-id="${esc(x.id)}" data-status="${st}">${esc(t('rps.set.' + st))}</button>`).join('')}</div>`}</div>`).join('')}
      </article>`;
    }).join('');
    return `<div id="report-slot">${lawWarnings(data.laws)}${resp}${legalHtml(data.legal)}${state.inc.domain === 'infrastructure' && state.cost ? costPanel(state.cost) : ''}
      ${officialPanelHtml()}
      ${supportPanelHtml()}
      <section class="panel"><h2>${esc(t('rp.title'))}</h2><p>${esc(t('rp.lead'))}</p>
        ${(data.sent || []).length ? `<div class="btn-row"><button class="btn secondary small" data-action="cal-download">${icon('calendar')} ${esc(t('cal.button'))}</button><span class="hint">${esc(t('cal.hint'))}</span></div>` : ''}
        <details ${sender.name ? '' : 'open'}><summary>${esc(t('rp.yourData'))}</summary>
          <p class="hint">${esc(t('rp.yourDataHint'))}</p>
          <div class="field-row"><div><label for="snd-name">${esc(t('rp.name'))}</label><input id="snd-name" type="text" value="${esc(sender.name || '')}"></div>
          <div><label for="snd-unit">${esc(t('rp.unit'))}</label><input id="snd-unit" type="text" value="${esc(sender.unit || '')}"></div>
          <div><label for="snd-contact">${esc(t('rp.contact'))}</label><input id="snd-contact" type="text" value="${esc(sender.contact || '')}"></div></div>
          <div class="btn-row"><button class="btn secondary small" data-action="rp-save-sender">${esc(t('rp.saveSender'))}</button></div></details>
        <div class="card-list" style="margin-top:12px">${targets || `<p class="muted">${esc(t('rp.none'))}</p>`}</div></section></div>`;
  }

  function money(n, cur) {
    try { return new Intl.NumberFormat(state.lang === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); }
    catch (_) { return `${Math.round(n).toLocaleString()} ${cur}`; }
  }

  function costPanel(c) {
    const showLocal = c.currency !== 'USD';
    const both = (usd, local) => esc(money(usd, 'USD')) + (showLocal ? ` <span class="muted">(${esc(money(local, c.currency))})</span>` : '');
    const currencies = [...new Set(['USD', c.currency, ...state.cfg.countries.map(x => x.currency)])];
    return `<section class="panel"><h2>${esc(t('cost.title'))}</h2>
      <p>${esc(t('cost.lead'))}</p>
      <div class="cost-total"><span>${esc(t('cost.range'))}</span><strong>${esc(money(c.lowUsd, 'USD'))} – ${esc(money(c.highUsd, 'USD'))}</strong>
        ${showLocal ? `<span>${esc(money(c.lowLocal, c.currency))} – ${esc(money(c.highLocal, c.currency))}</span>` : ''}</div>
      <p class="hint">${esc(L(c.factor.label))}${c.factor.sources.length ? ' · ' + c.factor.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(' · ') : ''}</p>
      <table class="mon-table cost-table"><thead><tr><th>${esc(t('cost.item'))}</th><th>${esc(t('cost.estimate'))}</th></tr></thead><tbody>
        ${c.items.map(it => `<tr><td>${esc(L(it.label))}${it.basis.kind === 'community' ? ` <span class="badge ok">${esc(t('cost.community', { n: it.basis.n }))}</span>` : ''}${it.range ? `<div class="hint">${esc(t('cost.typical', { low: money(it.range[0], 'USD'), high: money(it.range[1], 'USD') }))}</div>` : ''}${it.note ? `<div class="hint">${esc(L(it.note))}</div>` : ''}
          <div class="source"><a href="${esc(it.source.url)}" target="_blank" rel="noopener">${esc(it.source.title)}</a></div></td><td>${both(it.usd, it.local)}</td></tr>`).join('')}
        <tr><th>${esc(t('cost.total'))}</th><th>${both(c.totalUsd, c.totalLocal)}</th></tr></tbody></table>
      <div class="notice"><p><strong>${esc(t('cost.whoPays'))}</strong> ${esc(t('cost.whoPaysText'))}</p></div>
      <details><summary>${esc(t('cost.method'))}</summary><p>${esc(L(c.method))}</p><p class="hint">${esc(t('cost.retrieved', { date: c.retrieved }))}</p></details>
      <p class="hint">${esc(L(c.disclaimer))}</p>
      <h3 style="margin-top:16px">${esc(t('cost.quoteTitle'))}</h3><p class="hint">${esc(t('cost.quoteLead'))}</p>
      <div class="field-row"><div><label for="q-item">${esc(t('cost.item'))}</label><select id="q-item">${Object.entries(state.cfg.costItems).map(([id, lab]) => `<option value="${id}">${esc(L(lab))}</option>`).join('')}</select></div>
        <div><label for="q-provider">${esc(t('cost.provider'))}</label><input id="q-provider" type="text"></div>
        <div><label for="q-amount">${esc(t('cost.amount'))}</label><input id="q-amount" type="number" min="1" step="1" inputmode="decimal"></div>
        <div><label for="q-currency">${esc(t('cost.currency'))}</label><select id="q-currency">${currencies.map(cur => `<option value="${cur}" ${cur === c.currency ? 'selected' : ''}>${cur}</option>`).join('')}</select></div></div>
      <div class="btn-row"><button class="btn secondary" data-action="quote-save">${esc(t('cost.quoteSave'))}</button></div>
      ${(c.quotes || []).length ? `<ul class="followups">${c.quotes.map(q => `<li>${esc(L(state.cfg.costItems[q.item]))}: ${esc(money(q.amount, q.currency))}${q.provider ? ' · ' + esc(q.provider) : ''}</li>`).join('')}</ul>` : ''}
    </section>`;
  }

  function readSender() {
    const v = id => (document.getElementById(id) || {}).value || '';
    const sender = { name: v('snd-name'), unit: v('snd-unit'), contact: v('snd-contact') };
    store.set('sender', sender);
    return sender;
  }

  async function prepareReport(i) {
    const tg = state.report.targets[i];
    const sender = readSender();
    const langs = tg.kind === 'org' ? Object.keys(state.cfg.protocols) : ['en', 'es'];
    const defaultLang = tg.kind === 'org' ? state.lang : (tg.kind === 'city' || tg.kind === 'builder' || tg.kind === 'association' || tg.kind === 'landlord') && state.inc.answers.country === 'US' ? 'en' : state.lang;
    openDialog(`<h2>${esc(L(tg.name))}</h2>
      <div class="field-row"><div><label for="rp-lang">${esc(t('help.draftLang'))}</label><select id="rp-lang">${langs.map(l => `<option value="${l}" ${l === defaultLang ? 'selected' : ''}>${esc(state.cfg.protocols[l].name)}</option>`).join('')}</select></div>
        <div><label for="rp-recipient">${esc(t('rp.recipient'))}</label><input id="rp-recipient" type="text" placeholder="${esc(t('rp.recipientPh'))}"></div></div>
      <label for="rp-subject">${esc(t('rp.subject'))}</label><input id="rp-subject" type="text">
      <label for="rp-body">${esc(t('rp.body'))}</label><textarea id="rp-body" style="min-height:300px">${esc(t('common.loading'))}</textarea>
      ${tg.method === 'certified_mail' ? `<div class="notice warn"><p>${esc(t('rp.certifiedHint'))}</p></div>` : ''}
      <div class="btn-row"><button class="btn" data-action="rp-copy">${esc(t('help.copy'))}</button><button class="btn secondary" data-action="rp-email">${esc(t('rp.email'))}</button>
        <button class="btn secondary" data-action="rp-print">${esc(t('rp.print'))}</button><button class="btn secondary" data-action="dialog-close">${esc(t('common.close'))}</button></div>`);
    const load = async () => {
      document.getElementById('rp-body').value = t('common.loading');
      try {
        const r = await api(`/api/incidents/${state.inc.id}/report-draft`, { body: { kind: tg.kind, orgId: tg.id, lang: document.getElementById('rp-lang').value, sender, recipient: { name: document.getElementById('rp-recipient').value } } });
        document.getElementById('rp-subject').value = r.subject;
        const otok = (store.get('officialTokens', {}) || {})[state.inc.id];
        const olink = otok && state.inc.official && state.inc.official.active ? '\n\n' + t('gov.letterLine', { link: location.origin + '/#/official/' + otok }) : '';
        document.getElementById('rp-body').value = r.body + olink;
      } catch (err) { document.getElementById('rp-body').value = err.message; }
    };
    document.getElementById('rp-lang').addEventListener('change', load);
    document.getElementById('rp-recipient').addEventListener('change', load);
    load();
  }

  function markSentDialog(i) {
    const tg = state.report.targets[i];
    const today = new Date().toISOString().slice(0, 10);
    const methods = ['certified_mail', 'email', 'email_and_mail', 'austin_311', 'official_channel', 'written_notice', 'phone'];
    openDialog(`<h2>${esc(t('rp.markTitle'))}</h2><p>${esc(L(tg.name))}</p>
      <div class="field-row"><div><label for="ms-date">${esc(t('rp.sentDate'))}</label><input id="ms-date" type="date" value="${today}" max="${today}"></div>
        <div><label for="ms-method">${esc(t('rp.method'))}</label><select id="ms-method">${methods.map(m => `<option value="${m}" ${m === tg.method ? 'selected' : ''}>${esc(t('method.' + m))}</option>`).join('')}</select></div></div>
      <label for="ms-tracking">${esc(t('rp.trackingInput'))}</label><input id="ms-tracking" type="text" placeholder="${esc(t('rp.trackingPh'))}">
      <div class="btn-row"><button class="btn" data-action="rp-save-sent" data-i="${i}">${esc(t('rp.saveSent'))}</button><button class="btn secondary" data-action="dialog-close">${esc(t('common.close'))}</button></div>`);
  }

  // ---- Solutions -----------------------------------------------------------
  const LBL = (group, v) => t(group + '.' + v);

  function methodCard(m) {
    const o = m.outcomes || { n: 0 };
    return `<article class="card">
      <p>${m.review === 'approved' ? `<span class="badge ok">${esc(t('kb.approved'))}</span>` : `<span class="badge warn">${esc(t('kb.pending'))}</span>`}
        ${m.freshness === 'recheck' ? `<span class="badge warn">${esc(t('kb.recheck'))}</span>` : ''}
        <span class="badge">${esc(t('sol.cost'))}: ${esc(LBL('cost', m.cost))}</span>
        <span class="badge">${esc(t('sol.skill'))}: ${esc(LBL('skill', m.skill))}</span>
        <span class="badge">${esc(t('sol.evidence'))}: ${esc(LBL('evidence', m.evidence))}</span>
        ${m.actor ? `<span class="badge actor-${esc(m.actor)}">${esc(t('sol.who'))}: ${esc(LBL('actor', m.actor))}</span>` : ''}</p>
      <h3>${esc(L(m.title))}</h3><p>${esc(L(m.summary))}</p>
      ${m.caution ? `<div class="notice warn"><p><strong>${esc(t('sol.caution'))}</strong> ${esc(L(m.caution))}</p></div>` : ''}
      <p class="hint"><strong>${esc(t('sol.materials'))}:</strong> ${esc(L(m.materials))} · <strong>${esc(t('sol.time'))}:</strong> ${esc(L(m.time))}</p>
      ${o.n ? `<p class="hint">${esc(t('sol.outcomes', { n: o.n, worked: o.worked, partly: o.partly, failed: o.failed }))}</p>` : ''}
      <p class="source">${esc(t('common.source'))}: <a href="${esc(m.source.url)}" target="_blank" rel="noopener">${esc(m.source.title)}</a> · ${esc(t('how.' + m.source.how, { date: m.source.checked }))}${(m.extraSources || []).map(x => ` · <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join('')}</p>
      <button class="btn secondary small" data-action="feedback" data-target="${esc(L(m.title))}">${esc(t('kb.reportError'))}</button>
    </article>`;
  }

  function solutionsTab() {
    const r = state.inc.remediation;
    const head = `<section class="panel"><h2>${esc(t('sol.title'))}</h2><p>${esc(t('sol.lead'))}</p>
      <div class="btn-row"><button class="btn" data-action="find-solutions">${esc(r ? t('sol.refresh') : t('sol.find'))}</button></div></section>`;
    if (!r) return head;
    const notes = [];
    if (r.mode === 'demo') notes.push(t('sol.demoNote'));
    if (r.liveAdded) notes.push(t('sol.liveAdded', { n: r.liveAdded }));
    if (r.dropped) notes.push(t('sol.dropped', { n: r.dropped }));
    if (r.error) notes.push(t('sol.liveError'));
    const STAGES = ['prediction', 'offshore', 'beach', 'health', 'use', 'causes'];
    const staged = r.methods.some(m => m.stage);
    const body = !r.methods.length ? `<div class="notice warn"><p>${esc(t('sol.none'))}</p></div>`
      : !staged ? `<div class="card-list">${r.methods.map(methodCard).join('')}</div>`
      : `<p class="hint">${esc(t('sol.stagedLead'))}</p>` + [...STAGES, null].map(st => {
          const list = r.methods.filter(m => (m.stage || null) === st || (st === null && m.stage && !STAGES.includes(m.stage)));
          return list.length ? `<section class="stage" id="stage-${esc(st || 'other')}"><h2>${esc(t('stage.' + (st || 'other')))}</h2><p class="hint">${esc(t('stage.' + (st || 'other') + '.lead'))}</p><div class="card-list">${list.map(methodCard).join('')}</div></section>` : '';
        }).join('');
    return head + notes.map(n => `<div class="notice"><p>${esc(n)}</p></div>`).join('') + body;
  }

  // ---- Help --------------------------------------------------------------
  function helpTab() {
    const h = state.inc.help;
    const head = `<section class="panel"><h2>${esc(t('help.title'))}</h2><p>${esc(t('help.lead'))}</p>
      <div class="btn-row"><button class="btn" data-action="find-help">${esc(h ? t('sol.refresh') : t('help.find'))}</button></div></section>`;
    if (!h) return head;
    const groups = {};
    h.orgs.forEach(o => { (groups[o.urgency] = groups[o.urgency] || []).push(o); });
    const conf = c => (c === 'official' ? `<span class="badge ok">${esc(t('conf.official'))}</span>` : c === 'located' ? `<span class="badge">${esc(t('conf.located'))}</span>` : `<span class="badge warn">${esc(t('conf.not_confirmed'))}</span>`);
    const notes = [];
    if (h.mode === 'demo') notes.push(t('help.demoNote'));
    if (h.liveAdded) notes.push(t('sol.liveAdded', { n: h.liveAdded }));
    if (h.dropped) notes.push(t('sol.dropped', { n: h.dropped }));
    return head + notes.map(n => `<div class="notice"><p>${esc(n)}</p></div>`).join('') + Object.keys(groups).map(g => `
      <h3 class="group-title">${esc(t('urg.' + g))}</h3><div class="card-list">${groups[g].map(o => `
        <article class="card"><p>${conf(o.confidence)} ${o.review === 'pending' ? `<span class="badge warn">${esc(t('kb.pending'))}</span>` : ''} ${o.phoneUnconfirmed ? `<span class="badge warn">${esc(t('help.phoneUnconfirmed'))}</span>` : ''}</p>
          <h3>${esc(L(o.name))}</h3><p><strong>${esc(L(o.contact))}</strong></p><p class="hint">${esc(L(o.why))}</p>
          ${o.source ? `<p class="source">${esc(t('common.source'))}: <a href="${esc(o.source.url)}" target="_blank" rel="noopener">${esc(o.source.title)}</a> · ${esc(t('how.' + o.source.how, { date: o.source.checked }))}</p>` : `<p class="source muted">${esc(t('help.noSource'))}</p>`}
          <div class="btn-row"><button class="btn secondary small" data-action="draft" data-org="${esc(o.id)}">${esc(t('help.draft'))}</button>
          <button class="btn secondary small" data-action="feedback" data-target="${esc(L(o.name))}">${esc(t('kb.reportError'))}</button></div></article>`).join('')}</div>`).join('');
  }

  // ---- Fund & work ---------------------------------------------------------
  // Matching funds pledged by an office through the official link.
  function matchHtml(m) {
    if (!m) return `<p class="hint">${esc(t('match.none'))}</p>`;
    const inv = m.invoices.map(i => `<li>${esc(fmtMoney(i.amount))} · <span class="hash">${esc(i.invoiceId)}</span> · <span class="badge ${i.status === 'PAID' ? 'ok' : ''}">${esc(i.status === 'PAID' ? t('match.paid') : t('match.sent'))}</span>
      ${i.status === 'PAID' ? '' : (i.simulated ? `<button class="btn small" data-action="match-check" data-id="${esc(i.id)}" data-sim="1">${esc(t('sp.simPay'))}</button>` : `<button class="btn small" data-action="match-check" data-id="${esc(i.id)}">${esc(t('sp.check'))}</button>`)}</li>`).join('');
    return `<div class="notice match"><p><strong>${esc(t('match.title', { office: m.office, cap: fmtMoney(m.cap) }))}</strong></p>
      <p>${esc(t('match.progress', { community: fmtMoney(m.communityRaised), eligible: fmtMoney(m.eligible), paid: fmtMoney(m.paid) }))}</p>
      ${m.owed > 0 ? `<div class="btn-row"><button class="btn small" data-action="match-request">${esc(t('match.request', { amount: fmtMoney(m.owed) }))}</button></div>` : `<p class="hint">${esc(t('match.nothing'))}</p>`}
      ${inv ? `<ul>${inv}</ul>` : ''}
      <p class="hint">${esc(t('match.how'))}</p></div>`;
  }

  function fundTab() {
    const inc = state.inc;
    const f = inc.fund;
    const total = inc.plan.milestones.reduce((s, m) => s + Number(m.amount), 0) + (inc.interpreters || []).length * state.cfg.interpreterFee;
    const pct = total ? Math.min(100, Math.round((f.raised / total) * 100)) : 0;
    const anyPaid = inc.plan.milestones.some(m => m.status === 'paid');
    const allowed = inc.domain === 'infrastructure' ? state.cfg.allowedCategoriesInfra : inc.domain === 'community' ? state.cfg.allowedCategoriesCommunity[inc.assessment.tier] : state.cfg.allowedCategories[inc.assessment.tier];
    return `<section class="panel"><h2>${esc(t('fund.title'))}</h2>
        <p>${esc(t('fund.lead'))}</p>
        ${inc.assessment.tier === 'red' ? `<div class="notice stop"><p>${esc(t('fund.redRule'))}</p></div>` : ''}
        <div class="fund-stats"><div><span class="muted">${esc(t('fund.raised'))}</span><strong>${esc(fmtMoney(f.raised))}</strong></div>
          <div><span class="muted">${esc(t('fund.paid'))}</span><strong>${esc(fmtMoney(f.paid))}</strong></div>
          <div><span class="muted">${esc(t('fund.available'))}</span><strong>${esc(fmtMoney(f.available))}</strong></div></div>
        ${matchHtml(inc.match)}
        <div class="bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <p class="hint">${esc(t('fund.goal', { pct, total: fmtMoney(total) }))}</p>
        <h3>${esc(t('fund.donate'))}</h3>
        <div class="amounts" role="group">${[10, 25, 50, 100].map(v => `<button type="button" class="choice" data-action="amount" data-value="${v}" aria-pressed="${Number(state.amount || 25) === v}">${esc(fmtMoney(v))}</button>`).join('')}</div>
        <label for="amount-custom">${esc(t('fund.custom'))}</label><input id="amount-custom" type="number" min="1" step="1" value="${esc(state.amount || 25)}" data-action-change="amount-custom">
        <div id="paypal-slot" style="margin-top:14px"></div>
        <p class="hint">${esc(state.cfg.paypalLive ? t('fund.sandboxNote') : t('fund.simNote'))}</p>
      </section>
      <section class="panel"><h2>${esc(t('ms.title'))}</h2><p>${esc(t('ms.lead'))}</p>
        <p class="hint">${esc(t('ms.allowed'))}: ${allowed.map(c => esc(t('cat.' + c))).join(', ')}</p>
        ${inc.plan.milestones.map((m, i) => milestoneHtml(m, i)).join('')}</section>
      ${sponsorPanel()}
      ${anyPaid ? `<section class="panel"><h2>${esc(t('rate.title'))}</h2><p>${esc(t('rate.lead'))}</p>
        ${inc.rating ? `<p><span class="badge ok">${esc(t('rate.thanks', { rating: t('rate.' + inc.rating.rating) }))}</span></p>` : ''}
        <div class="btn-row">${['worked', 'partly', 'failed'].map(r => `<button class="btn secondary" data-action="rate" data-value="${r}">${esc(t('rate.' + r))}</button>`).join('')}</div></section>` : ''}`;
  }

  function milestoneHtml(m, i) {
    const ms = state.inc.plan.milestones;
    const locked = ms.slice(0, i).some(x => x.status !== 'paid');
    const v = m.verification;
    const est = m.estimate && m.estimate.basis === 'community_data' ? t('ms.estCommunity', { n: m.estimate.n }) : t('ms.estTemplate');
    let actions = '';
    if (m.status === 'paid') {
      actions = `<div class="notice"><p><strong>${esc(t('ms.paidTo', { amount: fmtMoney(m.amount), name: m.payout.recipientName || m.payout.receiver }))}</strong> ${m.payout.simulated ? `<span class="badge warn">${esc(t('fund.simulated'))}</span>` : `<span class="badge ok">PayPal sandbox</span>`}</p>
        <p class="hint">${esc(t('ms.batch'))}: <span class="hash">${esc(m.payout.batchId)}</span> · ${esc(t('ms.approvedBy', { name: m.approval.by }))}</p></div>`;
    } else if (locked) {
      actions = `<p class="hint">${esc(t('ms.locked'))}</p>`;
    } else if (m.status === 'verified' || m.status === 'needs_review') {
      actions = `<h4>${esc(t('ms.approveTitle'))}</h4>
        <div class="field-row"><div><label>${esc(t('ms.verifierName'))}</label><input type="text" data-ms-field="approverName"></div>
          <div><label>${esc(t('ms.verifierEmail'))}</label><input type="email" data-ms-field="approverEmail"></div>
          <div><label>${esc(t('ms.recipientName'))}</label><input type="text" data-ms-field="recipientName"></div>
          <div><label>${esc(t('ms.recipientEmail'))}</label><input type="email" data-ms-field="recipientEmail" placeholder="sb-…@personal.example.com"></div></div>
        <label class="check"><input type="checkbox" data-ms-field="reviewed"> <span>${esc(t('ms.reviewedPhotos'))}</span></label>
        <div class="btn-row"><button class="btn" data-action="approve" data-id="${esc(m.id)}">${esc(t('ms.approvePay', { amount: fmtMoney(m.amount) }))}</button></div>
        <p class="hint">${esc(t('ms.approveHint'))}</p>`;
    } else {
      actions = `<h4>${esc(t('ms.evidenceTitle'))}</h4><p class="hint">${esc(L(m.criteria))}</p>
        <span class="btn secondary small file-btn">${esc(t('ms.addPhotos'))}<input type="file" accept="image/*" multiple data-action-change="ms-files" data-id="${esc(m.id)}"></span>
        ${sampleSelect('ms-sample', `data-id="${esc(m.id)}"`)}
        <div class="thumbs" data-ms-preview="${esc(m.id)}"></div>
        <div class="btn-row"><button class="btn" data-action="ms-submit" data-id="${esc(m.id)}">${esc(t('ms.submit'))}</button></div>`;
    }
    const verdict = v ? `<div class="notice ${v.decision === 'pass' ? '' : v.decision === 'fail' ? 'stop' : 'warn'}"><p><strong>${esc(t('verdict.' + v.decision))}</strong> · ${esc(t('source.' + v.source))}${v.confidence ? ' · ' + Math.round(v.confidence * 100) + '%' : ''}</p><p>${esc(L(v.reasoning))}</p></div>` : '';
    return `<article class="milestone ${locked && m.status !== 'paid' ? 'locked' : ''}">
      <div class="milestone-head"><h3>${i + 1}. ${esc(L(m.title))}</h3><span class="amount">${esc(fmtMoney(m.amount))}</span></div>
      <p><span class="badge">${esc(t('cat.' + m.category))}</span> <span class="status ${esc(m.status)}">${esc(t('status.' + m.status))}</span></p>
      <p>${esc(L(m.detail))}</p><p class="hint">${esc(est)}</p>
      ${(m.evidence || []).length ? `<div class="thumbs">${m.evidence.map(p => `<img src="${esc(p.publicUrl)}" alt="${esc(t('ms.evidencePhoto'))}">`).join('')}</div>` : ''}
      ${verdict}${actions}</article>`;
  }

  // ---- Fundraising agent (sponsor invoices) --------------------------------
  function sponsorPanel() {
    const inc = state.inc;
    const sps = inc.sponsorships || [];
    const open = inc.plan.milestones.filter(m => m.status !== 'paid' && !sps.some(sp => sp.milestoneId === m.id && ['SENT', 'PAID'].includes(sp.status)));
    const form = open.length ? `<div class="field-row">
        <div><label for="sp-ms">${esc(t('sp.milestone'))}</label><select id="sp-ms">${open.map(m => `<option value="${esc(m.id)}">${esc(L(m.title))} · ${esc(fmtMoney(m.amount))}</option>`).join('')}</select></div>
        <div><label for="sp-name">${esc(t('sp.name'))}</label><input id="sp-name" type="text" placeholder="${esc(t('sp.namePh'))}"></div>
        <div><label for="sp-email">${esc(t('sp.email'))}</label><input id="sp-email" type="email" placeholder="sponsor@example.com"></div></div>
        <div class="btn-row"><button class="btn" data-action="sponsor-run">${esc(t('sp.run'))}</button></div>` : `<p class="muted">${esc(t('sp.noneOpen'))}</p>`;
    return `<section class="panel"><h2>${esc(t('sp.title'))}</h2><p>${esc(t('sp.lead'))}</p>
      <div class="notice"><p>${esc(t('sp.rule'))}</p></div>${form}
      <div class="card-list" style="margin-top:12px">${sps.slice().reverse().map(sponsorCard).join('')}</div></section>`;
  }

  function sponsorCard(sp) {
    const m = state.inc.plan.milestones.find(x => x.id === sp.milestoneId);
    const paid = sp.status === 'PAID';
    return `<article class="card sponsor">
      <div class="sponsor-grid"><img class="qr" src="${esc(sp.qr)}" alt="${esc(t('sp.qrAlt'))}">
      <div><p>${paid ? `<span class="badge ok">${esc(t('sp.paid'))}</span>` : `<span class="badge warn">${esc(t('sp.sent'))}</span>`} ${sp.simulated ? `<span class="badge warn">${esc(t('fund.simulated'))}</span>` : '<span class="badge ok">PayPal sandbox</span>'}</p>
        <h3>${esc(sp.sponsor.name)} · ${esc(fmtMoney(sp.amount))}</h3>
        <p class="hint">${esc(m ? L(m.title) : sp.milestoneId)}</p>
        <p class="hash">${esc(t('sp.invoice'))}: ${esc(sp.invoiceId)}</p>
        <p>${esc(sp.summary || '')}</p>
        <div class="btn-row"><a class="btn secondary small" href="#/poster/${esc(state.inc.id)}/${esc(sp.id)}">${esc(t('sp.poster'))}</a>
        ${paid ? '' : (sp.simulated
          ? `<button class="btn small" data-action="sponsor-check" data-id="${esc(sp.id)}" data-sim="1">${esc(t('sp.simPay'))}</button>`
          : `<button class="btn small" data-action="sponsor-check" data-id="${esc(sp.id)}">${esc(t('sp.check'))}</button>`)}</div></div></div>
      <details><summary>${esc(t('sp.log', { n: sp.log.length }))}</summary><ol class="agent-log">${sp.log.map(l => `<li><code>${esc(l.tool)}</code> ${l.blocked ? `<span class="badge stop">${esc(t('sp.blocked'))}</span>` : ''}${l.error ? `<span class="badge stop">${esc(t('sp.error'))}</span>` : ''}<div class="hash">${esc(l.input)}</div><div>${esc(l.result)}</div></li>`).join('')}</ol></details>
    </article>`;
  }

  async function findSponsorship(incId, sid) {
    const inc = await api('/api/incidents/' + encodeURIComponent(incId));
    const sp = (inc.sponsorships || []).find(x => x.id === sid);
    if (!sp) throw new Error(t('err.notFound'));
    return { inc, sp, m: inc.plan.milestones.find(x => x.id === sp.milestoneId) };
  }

  async function viewPoster(incId, sid) {
    const { inc, sp, m } = await findSponsorship(incId, sid);
    const other = state.lang === 'es' ? 'en' : 'es';
    const T = (k, v) => window.I18N.t(other, k, v);
    const place = inc.location && inc.location.label || '';
    const problem = L(state.cfg.typeLabels[inc.assessment.type]);
    $app.innerHTML = `<div class="btn-row no-print"><button class="btn" data-action="print">${esc(t('ev.print'))}</button><a class="btn secondary" href="#/incident/${esc(inc.id)}/fund">${esc(t('common.back'))}</a></div>
      <article class="poster">
        <p class="poster-tier">${tierChip(inc.assessment.tier)}</p>
        <h1>${esc(t('poster.title', { place }))}</h1>
        <p class="poster-sub">${esc(T('poster.title', { place }))}</p>
        <div class="poster-body"><img src="${esc(sp.qr)}" alt="${esc(t('sp.qrAlt'))}">
          <div><p class="poster-amount">${esc(fmtMoney(sp.amount))}</p>
            <p><strong>${esc(problem)}</strong> · ${esc(m ? L(m.title) : '')}</p>
            <p>${esc(t('poster.scan'))}</p><p class="muted">${esc(T('poster.scan'))}</p>
            <p class="hint">${esc(t('poster.promise'))}</p><p class="hint">${esc(T('poster.promise'))}</p>
            ${sp.simulated ? `<p class="badge warn">${esc(t('poster.sim'))}</p>` : ''}</div></div>
        <p class="hash">${esc(sp.invoiceId)} · ${esc(inc.id)}</p>
      </article>`;
  }

  async function viewSponsorSim(incId, sid) {
    const { inc, sp, m } = await findSponsorship(incId, sid);
    $app.innerHTML = `<div class="narrow"><section class="panel"><p><span class="badge warn">${esc(t('fund.simulated'))}</span></p>
      <h1>${esc(t('sim.title'))}</h1><p>${esc(t('sim.lead'))}</p>
      <dl class="reason-grid"><div><dt>${esc(t('sp.name'))}</dt><dd>${esc(sp.sponsor.name)}</dd></div><div><dt>${esc(t('sp.invoice'))}</dt><dd class="hash">${esc(sp.invoiceId)}</dd></div>
        <div><dt>${esc(t('ledger.col.amount'))}</dt><dd>${esc(fmtMoney(sp.amount))}</dd></div><div><dt>${esc(t('sp.milestone'))}</dt><dd>${esc(m ? L(m.title) : '')}</dd></div></dl>
      ${sp.status === 'PAID' ? `<p style="margin-top:12px"><span class="badge ok">${esc(t('sp.paid'))}</span></p>` : `<div class="btn-row"><button class="btn" data-action="sponsor-check" data-inc="${esc(inc.id)}" data-id="${esc(sp.id)}" data-sim="1">${esc(t('sp.simPay'))}</button></div>`}
      <div class="btn-row"><a class="btn secondary" href="#/incident/${esc(inc.id)}/fund">${esc(t('sim.back'))}</a></div></section></div>`;
  }

  // PayPal buttons (sandbox) or a clearly labeled simulation.
  let paypalSdkLoading = null;
  function loadPayPalSdk() {
    if (window.paypal) return Promise.resolve();
    if (paypalSdkLoading) return paypalSdkLoading;
    paypalSdkLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(state.cfg.paypalClientId)}&currency=USD&intent=capture`;
      s.onload = resolve;
      s.onerror = () => { paypalSdkLoading = null; reject(new Error(t('fund.sdkError'))); };
      document.head.appendChild(s);
    });
    return paypalSdkLoading;
  }

  function currentAmount() { return Math.max(1, Math.round(Number(state.amount || 25))); }

  async function mountPayPal() {
    const slot = document.getElementById('paypal-slot');
    if (!slot) return;
    if (!state.cfg.paypalLive) {
      slot.innerHTML = `<button class="btn" data-action="donate-sim">${esc(t('fund.donateSim', { amount: fmtMoney(currentAmount()) }))}</button>`;
      return;
    }
    try {
      await loadPayPalSdk();
      slot.innerHTML = '';
      window.paypal.Buttons({
        createOrder: async () => (await api(`/api/incidents/${state.inc.id}/donations/order`, { body: { amount: currentAmount() } })).id,
        onApprove: async data => {
          await api(`/api/incidents/${state.inc.id}/donations/capture`, { body: { orderId: data.orderID } });
          toast(t('fund.thanks'));
          await reloadIncident('fund');
        },
        onError: err => toast(err && err.message ? err.message : t('err.generic'), 'stop')
      }).render(slot);
    } catch (err) {
      slot.innerHTML = `<p class="error">${esc(err.message)}</p>`;
    }
  }

  async function reloadIncident(tab) {
    state.inc = await api('/api/incidents/' + state.inc.id);
    state.tab = tab || state.tab;
    renderIncident();
  }

  // ---- Evidence --------------------------------------------------------------
  function evidenceHtml(ev) {
    const inc = ev.incident;
    const photos = [...inc.photos, ...inc.plan.milestones.flatMap(m => m.evidence || [])];
    const code = owned.code(inc.id);
    return `<section class="panel privacy-panel"><h2>${icon('shield')} ${esc(t('priv.title'))}</h2>
        <p>${esc(t('priv.lead'))}</p>
        ${code ? `<label for="access-code">${esc(t('priv.codeLabel'))}</label>
        <div class="btn-row"><input id="access-code" type="text" readonly value="${esc(code)}" spellcheck="false"><button class="btn small" data-action="code-copy">${esc(t('priv.copy'))}</button></div>
        <p class="hint">${esc(t('priv.codeHint'))}</p>
        <div class="btn-row"><button class="btn secondary small" data-action="code-forget">${esc(t('priv.forget'))}</button></div>` : ''}
        ${ev.privacyLaws ? `<h3>${esc(t('priv.lawsTitle'))}</h3>${ev.privacyLaws.covered ? `<ul>${ev.privacyLaws.rules.map(r => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>: ${esc(r.facts.map(f => L(f)).join(' '))}</li>`).join('')}</ul>` : `<p class="muted">${esc(t('priv.lawsNone'))}</p>`}<p class="hint">${esc(t('priv.lawsHow'))}</p>` : ''}
        <label class="check"><input type="checkbox" id="stats-optin" data-action-change="stats-optin" ${inc.statsOptIn !== false ? 'checked' : ''}> <span>${esc(t('stats.optIn'))}</span></label>
        <p class="hint">${esc(t('stats.optInHint'))}</p></section>
      <section class="panel"><h2>${esc(t('ev.title'))}</h2>
        <p>${ev.chain.ok ? `<span class="badge ok">${esc(t('ev.chainOk', { n: ev.chain.total }))}</span>` : `<span class="badge stop">${esc(t('ev.chainBroken', { n: ev.chain.brokenAt }))}</span>`}</p>
        <p class="hint">${esc(t('ev.explain'))}</p>
        <div class="btn-row"><a class="btn" href="#/evidence/${esc(inc.id)}">${esc(t('ev.openFile'))}</a></div></section>
      <section class="panel"><h2>${esc(t('ev.files'))}</h2>
        ${photos.map(p => `<div class="card" style="display:flex;gap:12px;align-items:center;margin-bottom:8px"><img src="${esc(p.publicUrl)}" alt="" style="width:96px;height:72px;object-fit:cover;border-radius:6px">
          <div><strong>${esc(p.role)}</strong> · ${esc(fmtDate(p.at))}<div class="hash">SHA-256 ${esc(p.sha256)}</div></div></div>`).join('') || `<p class="muted">—</p>`}
      </section>
      <section class="panel"><h2>${esc(t('ev.timeline'))}</h2><ol class="timeline">${ev.events.map(e => `<li><span class="seq">#${e.seq}</span><div><strong>${esc(t('event.' + e.type))}</strong> · ${esc(fmtDate(e.at))}<div class="hash">${esc(e.hash)}</div></div></li>`).join('')}</ol></section>`;
  }

  async function viewEvidenceFile(id) {
    const ev = await api('/api/incidents/' + encodeURIComponent(id) + '/evidence');
    const inc = ev.incident;
    const a = inc.assessment;
    $app.innerHTML = `<div class="narrow">
      <div class="btn-row no-print"><button class="btn" data-action="print">${esc(t('ev.print'))}</button><a class="btn secondary" href="#/incident/${esc(inc.id)}/evidence">${esc(t('common.back'))}</a></div>
      <section class="panel"><h1>${esc(t('ev.fileTitle'))}</h1>
        <p><strong>${esc(t('ev.ref'))}:</strong> <span class="hash">${esc(inc.id)}</span><br><strong>${esc(t('ev.generated'))}:</strong> ${esc(fmtDate(ev.generatedAt))}</p>
        <dl class="reason-grid"><div><dt>${esc(t('ev.type'))}</dt><dd>${esc(L(state.cfg.typeLabels[a.type]))}</dd></div>
          <div><dt>${esc(t('ev.tier'))}</dt><dd>${esc(t('tier.' + a.tier))}</dd></div>
          <div><dt>${esc(t('rep.sum.place'))}</dt><dd>${esc(inc.location && inc.location.label || '—')}</dd></div>
          <div><dt>${esc(t('ev.reported'))}</dt><dd>${esc(fmtDate(inc.createdAt))}</dd></div></dl>
        <p style="margin-top:12px">${esc(L(a.reasoning))}</p>
        <p>${ev.chain.ok ? esc(t('ev.chainOk', { n: ev.chain.total })) : esc(t('ev.chainBroken', { n: ev.chain.brokenAt }))}</p></section>
      ${evidenceHtml(ev).replace(/<div class="btn-row"><a class="btn" href="#\/evidence[^<]*<\/a><\/div>/, '')}
      <p class="hint">${esc(t('ev.footer'))}</p></div>`;
  }

  // -------------------------------------------------------------------------
  // Official page: the authority sees the shared report and records its answer
  // -------------------------------------------------------------------------
  async function viewOfficial(token) {
    state.officialToken = token;
    let v;
    try { v = await api('/api/official/' + encodeURIComponent(token)); }
    catch (err) { $app.innerHTML = `<div class="panel narrow"><h1>${esc(t('gov.pageTitle'))}</h1><p>${esc(t('sup.inactive'))}</p></div>`; return; }
    renderOfficialPage(v);
  }

  function renderOfficialPage(v) {
    const a = v.assessment;
    const saved = store.get('officialOffice', {}) || {};
    const loc = v.location || {};
    const map = loc.lat && loc.lng ? ` · <a href="https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=17/${loc.lat}/${loc.lng}" target="_blank" rel="noopener">${esc(t('gov.map'))}</a>` : '';
    $app.innerHTML = `<div class="narrow">
      <section class="panel"><p class="private-badge">${icon('shield')}<span>${esc(t('gov.badge'))}</span></p>
        <h1>${esc(L(state.cfg.typeLabels[a.type]))}</h1>
        <p>${tierChip(a.tier, v.hazard)}</p>
        <dl class="reason-grid">
          <div><dt>${esc(t('rep.sum.place'))}</dt><dd>${esc(loc.label || '—')}${map}</dd></div>
          <div><dt>${esc(t('ev.reported'))}</dt><dd>${esc(fmtDate(v.createdAt))}</dd></div>
          <div><dt>${esc(t('gov.reporter'))}</dt><dd>${esc(v.reporter && v.reporter.name ? v.reporter.name : t('gov.anonymous'))}</dd></div>
          <div><dt>${esc(t('ev.ref'))}</dt><dd class="hash">${esc(v.id)}</dd></div></dl>
        ${v.answers && v.answers.description ? `<h2>${esc(t('gov.description'))}</h2><p>${esc(v.answers.description)}</p>` : ''}
        <p>${esc(L(a.reasoning))}</p>
        ${v.support && v.support.confirmed ? `<p><strong>${esc(t('sup.counts', { confirmed: v.support.confirmed, cosigned: v.support.cosigned }))}</strong></p>` : ''}
        ${(v.photos || []).length ? `<div class="thumbs">${v.photos.map(p => `<img src="${esc(p.publicUrl)}" alt="${esc(p.role)}">`).join('')}</div>` : ''}</section>
      <section class="panel"><h2>${esc(t('gov.formTitle'))}</h2><p>${esc(t('gov.formLead'))}</p>
        <div class="choices">${['received', 'in_progress', 'resolved', 'forwarded', 'not_ours'].map((k, i) => `<label class="check"><input type="radio" name="off-status" value="${k}" ${i === 0 ? 'checked' : ''}> <span>${esc(t('gov.st.' + k))}</span></label>`).join('')}</div>
        <div class="field-row"><div><label for="off-office">${esc(t('gov.office'))} *</label><input id="off-office" type="text" maxlength="120" value="${esc(saved.office || '')}"></div>
          <div><label for="off-officer">${esc(t('gov.officer'))}</label><input id="off-officer" type="text" maxlength="80" value="${esc(saved.officer || '')}"></div></div>
        <div class="field-row"><div><label for="off-case">${esc(t('gov.case'))}</label><input id="off-case" type="text" maxlength="60"></div>
          <div><label for="off-eta">${esc(t('gov.eta'))}</label><input id="off-eta" type="date"></div></div>
        <label for="off-fwd">${esc(t('gov.forwardedTo'))}</label><input id="off-fwd" type="text" maxlength="160" placeholder="${esc(t('gov.fwdPh'))}">
        <label for="off-note">${esc(t('gov.note'))}</label><textarea id="off-note" rows="4" maxlength="1000"></textarea>
        <div class="btn-row"><button class="btn" data-action="off-send">${esc(t('gov.send'))}</button></div>
        <p class="hint">${esc(t('gov.recordHint'))}</p></section>
      <section class="panel"><h2>${esc(t('gov.updatesTitle'))}</h2>${officialUpdatesHtml(v.updates)}</section>
      <section class="panel"><h2>${esc(t('match.offerTitle'))}</h2>
        ${v.match ? `<p><strong>${esc(t('match.title', { office: v.match.office, cap: fmtMoney(v.match.cap) }))}</strong></p><p>${esc(t('match.progress', { community: fmtMoney(v.match.communityRaised), eligible: fmtMoney(v.match.eligible), paid: fmtMoney(v.match.paid) }))}</p>`
        : `<p>${esc(t('match.offerLead'))}</p>
        <div class="field-row"><div><label for="mt-email">${esc(t('match.email'))}</label><input id="mt-email" type="email" maxlength="120"></div>
          <div><label for="mt-cap">${esc(t('match.cap'))}</label><input id="mt-cap" type="number" min="1" step="1" inputmode="numeric"></div></div>
        <div class="btn-row"><button class="btn secondary" data-action="off-match">${esc(t('match.offerBtn'))}</button></div>
        <p class="hint">${esc(t('match.offerHint'))}</p>`}</section>
      ${legalHtml(v.legal)}
      <section class="panel"><h2>${esc(t('ev.title'))}</h2>
        <p>${v.chain.ok ? `<span class="badge ok">${esc(t('ev.chainOk', { n: v.chain.total }))}</span>` : `<span class="badge stop">${esc(t('ev.chainBroken', { n: v.chain.brokenAt }))}</span>`}</p>
        ${(v.photos || []).map(p => `<div class="hash">${esc(p.role)} · SHA-256 ${esc(p.sha256)}</div>`).join('')}</section>
    </div>`;
  }

  // -------------------------------------------------------------------------
  // Neighbor support page (public, limited view)
  // -------------------------------------------------------------------------
  async function viewSupport(token) {
    state.supportToken = token;
    let v;
    try { v = await api('/api/support/' + encodeURIComponent(token)); }
    catch (err) { $app.innerHTML = `<div class="panel narrow"><h1>${esc(t('sup.pageTitle'))}</h1><p>${esc(t('sup.inactive'))}</p><a class="btn" href="#/">${esc(t('nav.home'))}</a></div>`; return; }
    renderSupportPage(v, store.get('supported:' + token, false));
  }

  function renderSupportPage(v, done) {
    const hz = v.hazard;
    const [y, m] = String(v.month).split('-');
    const month = y ? new Date(Date.UTC(+y, +m - 1, 15)).toLocaleDateString(state.lang === 'es' ? 'es-MX' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
    $app.innerHTML = `<div class="narrow"><section class="panel">
      <h1>${esc(t('sup.pageTitle'))}</h1>
      <p>${esc(t('sup.pageLead'))}</p>
      <dl class="reason-grid"><div><dt>${esc(t('ev.type'))}</dt><dd>${esc(L(state.cfg.typeLabels[v.type]) || v.type)}</dd></div>
        <div><dt>${esc(t('ev.tier'))}</dt><dd>${tierChip(v.tier, hz)}</dd></div>
        <div><dt>${esc(t('sup.area'))}</dt><dd>${esc(v.area ? L(v.area) : '—')}</dd></div>
        <div><dt>${esc(t('sup.month'))}</dt><dd>${esc(month)}</dd></div></dl>
      <p><strong>${esc(t('sup.counts', { confirmed: v.confirmed, cosigned: v.cosigned }))}</strong></p></section>
      ${done ? `<section class="panel"><h2>${esc(t('sup.thanks'))}</h2><p>${esc(t('sup.thanksText'))}</p></section>` : `<section class="panel">
        <h2>${esc(t('sup.q'))}</h2>
        <div class="choices">${['me', 'family', 'neighbors', 'seen'].map((k, i) => `<label class="check"><input type="radio" name="sup-aff" value="${k}" ${i === 3 ? 'checked' : ''}> <span>${esc(t('sup.aff.' + k))}</span></label>`).join('')}</div>
        <div class="btn-row"><button class="btn" data-action="sup-send" data-kind="confirm">${esc(t('sup.confirm'))}</button></div>
        <p class="hint">${esc(t('sup.confirmHint'))}</p>
        <details><summary>${esc(t('sup.cosignTitle'))}</summary>
          <label for="sup-name">${esc(t('sup.name'))}</label><input id="sup-name" type="text" maxlength="80" autocomplete="name">
          <label class="check"><input type="checkbox" id="sup-agree"> <span>${esc(t('sup.agree'))}</span></label>
          <div class="btn-row"><button class="btn secondary" data-action="sup-send" data-kind="cosign">${esc(t('sup.cosign'))}</button></div></details>
      </section>`}
      <p class="hint">${esc(t('sup.publicPrivacy'))}</p></div>`;
  }

  // -------------------------------------------------------------------------
  // Anonymous community statistics
  // -------------------------------------------------------------------------
  function statLabel(sec, key) {
    if (key === 'other') return t('stats.other');
    if (sec === 'byType') return L(state.cfg.typeLabels[key]) || key;
    if (sec === 'byTier') return t('tier.' + key);
    if (sec === 'byDomain') return t('stats.domain.' + key);
    if (sec === 'byCategory') return t('opt.cmCategory.' + key);
    if (sec === 'byCountry') { const c = state.cfg.countries.find(x => x.code === key); return c ? L(c.name) : key === 'unknown' ? t('stats.unknown') : key; }
    if (sec === 'byMonth') { const [y, m] = key.split('-'); return new Date(Date.UTC(+y, +m - 1, 15)).toLocaleDateString(state.lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }); }
    return key;
  }
  const statNum = (v, k) => (v === null || v === undefined ? t('stats.fewer', { k }) : String(v));
  const statShort = (v, k) => (v === null || v === undefined ? '<' + k : String(v));

  function barsHtml(sec, rows, k, opts) {
    if (!rows || !rows.length) return `<p class="muted">${esc(t('stats.none'))}</p>`;
    const max = Math.max(1, ...rows.map(r => r.n || 0));
    const tierColor = { green: 'var(--go)', yellow: '#c98a00', red: 'var(--stop)' };
    return `<ul class="bars">${rows.map(r => {
      const label = statLabel(sec, r.key);
      const pct = r.n ? Math.max(2, Math.round((r.n / max) * 100)) : 0;
      const color = sec === 'byTier' ? tierColor[r.key] || 'var(--tide)' : 'var(--tide)';
      return `<li title="${esc(label)}: ${esc(statNum(r.n, k))}"><span class="bar-label">${esc(label)}${r.key === 'other' && r.groups ? ` <span class="muted">(${esc(t('stats.groups', { n: r.groups }))})</span>` : ''}</span>
        <span class="bar-track">${r.n ? `<span class="bar-fill" style="width:${pct}%;background:${color}"></span>` : `<span class="bar-fewer">${esc(t('stats.fewer', { k }))}</span>`}</span>
        <span class="bar-value">${r.n ? esc(String(r.n)) : '—'}</span></li>`;
    }).join('')}</ul>`;
  }

  async function viewStats() {
    const q = state.statsQuery || '';
    const s = await api('/api/stats' + (q ? '?' + q : ''));
    const f = s.filters || {};
    const k = s.k;
    const opt = (v, label, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(label)}</option>`;
    const filters = `<div class="stats-filters">
        <div><label for="st-country">${esc(t('stats.f.country'))}</label><select id="st-country">${opt('', t('stats.f.all'), f.country)}${state.cfg.countries.map(c => opt(c.code, L(c.name), f.country)).join('')}</select></div>
        <div><label for="st-domain">${esc(t('stats.f.domain'))}</label><select id="st-domain">${opt('', t('stats.f.all'), f.domain)}${['environment', 'infrastructure', 'community'].map(d => opt(d, t('stats.domain.' + d), f.domain)).join('')}</select></div>
        <div><label for="st-from">${esc(t('stats.f.from'))}</label><input id="st-from" type="month" value="${esc(f.from || '')}"></div>
        <div><label for="st-to">${esc(t('stats.f.to'))}</label><input id="st-to" type="month" value="${esc(f.to || '')}"></div>
        <div class="btn-row"><button class="btn small" data-action="stats-apply">${esc(t('stats.f.apply'))}</button>${q ? `<button class="btn secondary small" data-action="stats-clear">${esc(t('stats.f.clear'))}</button>` : ''}</div></div>`;
    const head = `<h1>${esc(t('stats.title'))}</h1><p>${esc(t('stats.lead'))}</p>
      <div class="notice"><p>${icon('shield')} ${esc(t('stats.rules', { k }))}</p></div>
      <section class="panel">${filters}</section>`;
    if (!s.enough) {
      $app.innerHTML = head + `<section class="panel"><h2>${esc(t('stats.notEnoughTitle'))}</h2><p>${esc(t('stats.notEnough', { k }))}</p></section>`;
      return;
    }
    const a = s.authorities;
    const answeredPct = a.sent && a.answered ? Math.round((a.answered / a.sent) * 100) + '%' : '';
    const tiles = [
      [String(s.total), t('stats.t.reports'), s.optedOut ? t('stats.t.optedOut', { n: s.optedOut }) : ''],
      [statShort(a.sent, k), t('stats.t.sent'), ''],
      [statShort(a.answered, k), t('stats.t.answered'), answeredPct ? t('stats.t.ofSent', { pct: answeredPct }) : ''],
      [a.medianDaysToAnswer === null ? '—' : t('stats.t.days', { n: a.medianDaysToAnswer }), t('stats.t.median'), a.medianDaysToAnswer === null ? t('stats.fewer', { k }) : ''],
      [statShort(s.work.milestonesPaid, k), t('stats.t.milestones'), s.work.paidOut !== null ? t('stats.t.paid', { amount: fmtMoney(s.work.paidOut) }) : ''],
      [statShort(s.outcomes.worked, k), t('stats.t.worked'), s.outcomes.rated ? t('stats.t.rated', { n: statNum(s.outcomes.rated, k) }) : '']
    ];
    const csv = '/api/stats.csv' + (q ? '?' + q : '');
    $app.innerHTML = head + `
      <section class="panel"><h2>${esc(t('stats.overview'))}</h2>
        <div class="impact">${tiles.map(([v, label, sub]) => `<div><strong>${esc(v)}</strong><span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`).join('')}</div>
        <div class="btn-row" style="margin-top:12px"><a class="btn secondary small" href="${esc(csv)}" download>${esc(t('stats.csv'))}</a><span class="hint">${esc(t('stats.csvHint'))}</span></div>
        <p class="hint">${esc(t('stats.t.lessNote', { k }))}</p></section>
      <div class="stats-grid">
        <section class="panel"><h2>${esc(t('stats.byType'))}</h2>${barsHtml('byType', s.byType, k)}</section>
        <section class="panel"><h2>${esc(t('stats.byTier'))}</h2>${barsHtml('byTier', s.byTier, k)}</section>
        <section class="panel"><h2>${esc(t('stats.byMonth'))}</h2>${barsHtml('byMonth', s.byMonth, k)}</section>
        <section class="panel"><h2>${esc(t('stats.byCountry'))}</h2>${barsHtml('byCountry', s.byCountry, k)}</section>
        <section class="panel"><h2>${esc(t('stats.byDomain'))}</h2>${barsHtml('byDomain', s.byDomain, k)}</section>
        ${s.byCategory.length ? `<section class="panel"><h2>${esc(t('stats.byCategory'))}</h2>${barsHtml('byCategory', s.byCategory, k)}</section>` : ''}
      </div>
      <section class="panel"><h2>${esc(t('stats.hotspots'))}</h2><p class="hint">${esc(t('stats.hotspotsHint', { k }))}</p>
        ${s.hotspots.length ? `<div class="table-wrap"><table class="simple"><thead><tr><th>${esc(t('stats.h.area'))}</th><th>${esc(t('stats.h.reports'))}</th><th>${esc(t('stats.h.top'))}</th></tr></thead><tbody>
        ${s.hotspots.map(h => `<tr><td><a href="https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lng}#map=12/${h.lat}/${h.lng}" target="_blank" rel="noopener">${h.lat.toFixed(1)}, ${h.lng.toFixed(1)}</a></td><td>${h.n}</td><td>${esc(h.topType ? statLabel('byType', h.topType) : t('stats.mixed'))}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">${esc(t('stats.noHotspots', { k }))}</p>`}</section>
      <section class="panel"><h2>${esc(t('stats.learning'))}</h2>
        <p>${esc(t('stats.learningLead'))}</p>
        <ul><li>${esc(t('stats.l.costs', { n: statNum(s.learning.costRecords, k) }))}${s.learning.medianActualVsEstimate !== null ? ' ' + esc(t('stats.l.ratio', { pct: Math.round(s.learning.medianActualVsEstimate * 100) })) : ''}</li>
          <li>${esc(t('stats.l.outcomes', { worked: statNum(s.outcomes.worked, k), partly: statNum(s.outcomes.partly, k), failed: statNum(s.outcomes.notWorked, k) }))}</li>
          <li>${esc(t('stats.l.authorities', { resolved: statNum(a.resolved, k), none: statNum(a.noAnswer, k) }))}</li></ul>
        <p class="hint">${esc(t('stats.generated', { date: fmtDate(s.generatedAt) }))}</p></section>
      <section class="panel"><h2>${esc(t('grid.statsTitle'))}</h2><p class="hint">${esc(t('grid.statsHint', { k }))}</p>
        ${gridToolbar('stats-grid', 'comunidad-fuerte-statistics.csv')}
        <div id="stats-grid" class="data-grid"></div></section>`;
    const rows = [];
    for (const sec of ['byType', 'byTier', 'byCountry', 'byMonth', 'byDomain', 'byCategory']) {
      for (const r of s[sec] || []) rows.push({ section: t('stats.' + sec), category: statLabel(sec, r.key), reports: r.n, share: r.n && s.total ? Math.round((r.n / s.total) * 1000) / 10 : null });
    }
    for (const h of s.hotspots || []) rows.push({ section: t('stats.hotspots'), category: `${h.lat.toFixed(1)}, ${h.lng.toFixed(1)}${h.topType ? ' · ' + statLabel('byType', h.topType) : ''}`, reports: h.n, share: s.total ? Math.round((h.n / s.total) * 1000) / 10 : null });
    dataGrid('stats-grid', rows, [
      { field: 'section', headerName: t('grid.col.section'), maxWidth: 220 },
      { field: 'category', headerName: t('grid.col.category'), minWidth: 200, flex: 2 },
      { field: 'reports', headerName: t('stats.h.reports'), type: 'rightAligned', maxWidth: 140, valueFormatter: p => (p.value === null || p.value === undefined ? '<' + k : String(p.value)), filter: 'agNumberColumnFilter' },
      { field: 'share', headerName: t('grid.col.share'), type: 'rightAligned', maxWidth: 160, valueFormatter: p => (p.value === null || p.value === undefined ? '—' : p.value + ' %'), filter: 'agNumberColumnFilter' }
    ]);
  }

  // -------------------------------------------------------------------------
  // AG Grid helper: sortable, filterable tables with CSV export
  // -------------------------------------------------------------------------
  state.grids = {};
  function dataGrid(id, rows, columnDefs, extra) {
    const el = document.getElementById(id);
    const grid = window.agGrid;
    if (!el) return null;
    if (!grid) { el.innerHTML = `<p class="error">${esc(t('ledger.noGrid'))}</p>`; return null; }
    if (grid.ModuleRegistry && grid.AllCommunityModule && !window.__agRegistered) { grid.ModuleRegistry.registerModules([grid.AllCommunityModule]); window.__agRegistered = true; }
    const small = rows.length <= 20;
    el.classList.toggle('auto', small);
    const api_ = grid.createGrid(el, {
      rowData: rows, columnDefs,
      defaultColDef: { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110, wrapText: true, autoHeight: true },
      domLayout: small ? 'autoHeight' : 'normal', pagination: !small, paginationPageSize: 20,
      overlayNoRowsTemplate: `<span>${esc(t('stats.none'))}</span>`,
      ...(extra || {})
    });
    state.grids[id] = api_;
    return api_;
  }
  function gridToolbar(id, fileName) {
    return `<div class="grid-tools"><div><label for="${id}-filter">${esc(t('grid.filter'))}</label><input id="${id}-filter" type="text" data-grid-filter="${id}" placeholder="${esc(t('grid.filterPh'))}"></div>
      <button class="btn secondary small" data-action="grid-csv" data-grid="${id}" data-file="${esc(fileName)}">${esc(t('grid.csv'))}</button></div>`;
  }
  document.addEventListener('input', e => {
    const id = e.target && e.target.dataset && e.target.dataset.gridFilter;
    if (id && state.grids[id]) state.grids[id].setGridOption('quickFilterText', e.target.value);
  });

  // -------------------------------------------------------------------------
  // Ledger (AG Grid)
  // -------------------------------------------------------------------------
  async function viewLedger() {
    const rows = await api('/api/ledger');
    const raised = rows.filter(r => r.kind === 'donation').reduce((s, r) => s + r.amount, 0);
    const paid = rows.filter(r => r.kind === 'payout').reduce((s, r) => s + r.amount, 0);
    $app.innerHTML = `<h1>${esc(t('ledger.title'))}</h1><p>${esc(t('ledger.lead'))}</p>
      <div class="fund-stats"><div><span class="muted">${esc(t('fund.raised'))}</span><strong>${esc(fmtMoney(raised))}</strong></div>
        <div><span class="muted">${esc(t('fund.paid'))}</span><strong>${esc(fmtMoney(paid))}</strong></div>
        <div><span class="muted">${esc(t('ledger.count'))}</span><strong>${rows.length}</strong></div></div>
      <label for="ledger-filter">${esc(t('ledger.filter'))}</label><input id="ledger-filter" type="text" placeholder="${esc(t('ledger.filterPh'))}">
      <div class="btn-row"><button class="btn secondary small" data-action="grid-csv" data-grid="ledger-grid" data-file="comunidad-fuerte-ledger.csv">${esc(t('grid.csv'))}</button></div>
      <div id="ledger-grid" class="${rows.length <= 20 ? 'auto' : ''}" style="margin-top:12px"></div>`;
    const grid = window.agGrid;
    if (!grid) { document.getElementById('ledger-grid').innerHTML = `<p class="error">${esc(t('ledger.noGrid'))}</p>`; return; }
    if (grid.ModuleRegistry && grid.AllCommunityModule && !window.__agRegistered) { grid.ModuleRegistry.registerModules([grid.AllCommunityModule]); window.__agRegistered = true; }
    const api_ = grid.createGrid(document.getElementById('ledger-grid'), {
      rowData: rows,
      columnDefs: [
        { field: 'createdAt', headerName: t('ledger.col.date'), valueFormatter: p => fmtDate(p.value), sort: 'desc', minWidth: 170 },
        { field: 'kind', headerName: t('ledger.col.kind'), valueFormatter: p => t('ledger.kind.' + p.value), maxWidth: 130 },
        { field: 'amount', headerName: t('ledger.col.amount'), valueFormatter: p => fmtMoney(p.value), type: 'rightAligned', maxWidth: 130 },
        { field: 'incidentLabel', headerName: t('ledger.col.incident'), minWidth: 220 },
        { field: 'tier', headerName: t('ledger.col.tier'), valueFormatter: p => (p.value ? t('tier.' + p.value) : ''), maxWidth: 120 },
        { field: 'purpose', headerName: t('ledger.col.purpose'), valueGetter: p => p.data.purpose || t('ledger.donation'), minWidth: 200 },
        { field: 'counterparty', headerName: t('ledger.col.counterparty'), minWidth: 160 },
        { field: 'approvedBy', headerName: t('ledger.col.approvedBy') },
        { field: 'status', headerName: t('ledger.col.status'), maxWidth: 130 },
        { field: 'simulated', headerName: t('ledger.col.mode'), valueFormatter: p => (p.value ? t('fund.simulated') : 'Sandbox'), maxWidth: 140 },
        { headerName: t('ledger.col.paypalId'), valueGetter: p => p.data.captureId || p.data.paypalInvoiceId || p.data.paypalBatchId || p.data.paypalOrderId, minWidth: 180 },
        { field: 'eventHash', headerName: t('ledger.col.hash'), valueFormatter: p => short(p.value), minWidth: 150 }
      ],
      defaultColDef: { sortable: true, filter: true, resizable: true, flex: 1, minWidth: 110 },
      domLayout: rows.length <= 20 ? 'autoHeight' : 'normal',
      pagination: rows.length > 20,
      paginationPageSize: 20,
      overlayNoRowsTemplate: `<span>${esc(t('ledger.empty'))}</span>`
    });
    state.grids['ledger-grid'] = api_;
    document.getElementById('ledger-filter').addEventListener('input', e => api_.setGridOption('quickFilterText', e.target.value));
  }

  // -------------------------------------------------------------------------
  // Learning: living knowledge base
  // -------------------------------------------------------------------------
  function lawSection(rules) {
    const order = { changed: 0, pending_change: 1, unclear: 2, due: 3, current: 4 };
    const sorted = rules.slice().sort((a, b) => order[a.state] - order[b.state]);
    const counts = rules.reduce((m, r) => { m[r.state] = (m[r.state] || 0) + 1; return m; }, {});
    return `<section class="panel" id="laws"><h2>${esc(t('law.title'))}</h2><p>${esc(t('law.lead'))}</p>
      <p class="hint">${esc(t('law.counts', { total: rules.length, current: counts.current || 0, due: (counts.due || 0) + (counts.unclear || 0), review: (counts.pending_change || 0) + (counts.changed || 0) }))}</p>
      <h3>${esc(t('grid.lawTitle'))}</h3><p class="hint">${esc(t('grid.lawHint'))}</p>
      ${gridToolbar('law-grid', 'comunidad-fuerte-rules.csv')}
      <div id="law-grid" class="data-grid"></div>
      <h3>${esc(t('grid.lawCards'))}</h3>
      <div class="card-list">${sorted.map(r => `<article class="card law ${esc(r.state)}">
        <h3><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a></h3>
        <p><span class="badge ${r.state === 'current' ? 'ok' : 'warn'}">${esc(t('law.state.' + r.state))}</span> <span class="badge">${esc(t('law.kind.' + r.kind))}</span> <span class="muted">${esc(r.jurisdiction)}</span></p>
        <ul>${r.facts.map(x => `<li>${esc(L(x))}</li>`).join('')}</ul>
        <p class="hint">${esc(t('law.checked', { date: r.lastChecked, by: r.checkedBy, next: r.nextCheck }))}</p>
        ${r.pending.map(c => `<div class="notice warn"><p><strong>${esc(t('law.pendingTitle'))}</strong> ${esc(c.note)}${c.sourceUrl ? ` <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.sourceTitle || t('common.source'))}</a>` : ''}</p>
          <div class="btn-row"><button class="btn small" data-action="law-resolve" data-id="${esc(c.id)}" data-decision="accepted">${esc(t('law.accept'))}</button><button class="btn secondary small" data-action="law-resolve" data-id="${esc(c.id)}" data-decision="declined">${esc(t('law.decline'))}</button></div></div>`).join('')}
        ${r.accepted.map(c => `<div class="notice stop"><p><strong>${esc(t('law.changedTitle'))}</strong> ${esc(c.note)}</p></div>`).join('')}
        <div class="btn-row"><button class="btn secondary small" data-action="law-verify" data-id="${esc(r.id)}">${esc(t('law.verify'))}</button><button class="btn secondary small" data-action="law-report" data-id="${esc(r.id)}">${esc(t('law.report'))}</button>${state.cfg.aiLive ? `<button class="btn secondary small" data-action="law-check" data-id="${esc(r.id)}">${esc(t('law.checkNow'))}</button>` : ''}</div>
      </article>`).join('')}</div></section>`;
  }

  async function viewLearn() {
    const k = await api('/api/knowledge');
    const lawData = await api('/api/laws').catch(() => ({ rules: [] }));
    const lr = k.lastRefresh;
    const reviewer = `<label for="kb-reviewer">${esc(t('kb.reviewerName'))}</label><input id="kb-reviewer" type="text" value="${esc(store.get('reviewer', ''))}">`;
    const pending = [...k.pendingMethods.map(m => ({ ...m, kind: 'methods', label: L(m.title) })), ...k.pendingOrgs.map(o => ({ ...o, kind: 'orgs', label: L(o.name) }))];
    $app.innerHTML = `<div class="narrow"><h1>${esc(t('kb.title'))}</h1><p>${esc(t('kb.lead'))}</p>
      <section class="panel"><h2>${esc(t('kb.h1'))}</h2><p>${esc(t('kb.p1'))}</p>
        <p class="hint">${lr ? esc(t('kb.lastRefresh', { date: fmtDate(lr.at), mode: t('kb.mode.' + lr.mode), added: lr.added || 0 })) : esc(t('kb.never'))}</p>
        ${k.staleCurated.length ? `<p class="hint">${esc(t('kb.stale', { n: k.staleCurated.length }))}</p>` : ''}
        <div class="btn-row"><button class="btn" data-action="kb-refresh">${esc(t('kb.refresh'))}</button></div></section>
      <section class="panel"><h2>${esc(t('kb.h2'))}</h2><p>${esc(t('kb.p2'))}</p>
        <p class="hint">${esc(t('kb.outcomes', { n: k.outcomes, rated: k.rated }))}</p></section>
      <section class="panel"><h2>${esc(t('kb.h3'))}</h2><p>${esc(t('kb.p3'))}</p>${reviewer}
        <h3 style="margin-top:16px">${esc(t('kb.pendingTitle'))}</h3>
        ${pending.length ? pending.map(p => `<div class="card"><h3>${esc(p.label)}</h3>${p.source ? `<p class="source"><a href="${esc(p.source.url)}" target="_blank" rel="noopener">${esc(p.source.title)}</a></p>` : ''}
          <div class="btn-row"><button class="btn small" data-action="kb-review" data-kind="${p.kind}" data-id="${esc(p.id)}" data-decision="approved">${esc(t('kb.approve'))}</button>
          <button class="btn secondary small" data-action="kb-review" data-kind="${p.kind}" data-id="${esc(p.id)}" data-decision="rejected">${esc(t('kb.reject'))}</button></div></div>`).join('') : `<p class="muted">${esc(t('kb.noPending'))}</p>`}
        <h3 style="margin-top:16px">${esc(t('kb.corrections'))}</h3>
        ${k.openSuggestions.length ? k.openSuggestions.map(s => `<div class="card"><p><strong>${esc(s.target)}</strong> · ${esc(s.by)} · ${esc(fmtDate(s.at))}</p><p>${esc(s.text)}</p>
          <div class="btn-row"><button class="btn small" data-action="fb-resolve" data-id="${esc(s.id)}" data-decision="accepted">${esc(t('kb.accept'))}</button>
          <button class="btn secondary small" data-action="fb-resolve" data-id="${esc(s.id)}" data-decision="declined">${esc(t('kb.decline'))}</button></div></div>`).join('') : `<p class="muted">${esc(t('kb.noCorrections'))}</p>`}
        <div class="btn-row"><button class="btn secondary" data-action="feedback" data-target="general">${esc(t('kb.reportError'))}</button></div></section>
      ${lawSection(lawData.rules)}
      <section class="panel"><h2>${esc(t('kb.changelog'))}</h2>${k.changelog.length ? `<ol class="timeline">${k.changelog.map((c, i) => `<li><span class="seq">${i + 1}</span><div><strong>${esc(t('kb.kind.' + c.kind))}</strong> · ${esc(fmtDate(c.at))}<div>${esc(c.summary)}</div></div></li>`).join('')}</ol>` : `<p class="muted">${esc(t('kb.noChanges'))}</p>`}</section>
      ${state.cfg.allowReset ? `<section class="panel"><h2>${esc(t('kb.resetTitle'))}</h2><p class="hint">${esc(t('kb.resetHint'))}</p><button class="btn danger small" data-action="demo-reset">${esc(t('kb.reset'))}</button></section>` : ''}</div>`;
    mountLawGrid(lawData.rules);
  }

  function levelOfCode(code) {
    if (code === 'INTL' || code === 'EU') return 'international';
    const n = String(code).split('-').length;
    return n === 1 ? 'national' : n === 2 ? 'state' : 'local';
  }
  function mountLawGrid(rules) {
    const lvlOrder = { international: 0, national: 1, state: 2, local: 3 };
    const rows = rules.map(r => ({ level: levelOfCode(r.jurisdiction), jurisdiction: r.jurisdiction, kind: r.kind, title: r.title, url: r.url, state: r.state, lastChecked: r.lastChecked, nextCheck: r.nextCheck, topics: (r.topics || []).join(', '), facts: r.facts.map(f => L(f)).join(' ') }));
    dataGrid('law-grid', rows, [
      { field: 'level', headerName: t('grid.col.level'), valueFormatter: p => t('lvl.' + p.value), comparator: (a, b) => lvlOrder[a] - lvlOrder[b], sort: 'asc', width: 140, flex: 0 },
      { field: 'title', headerName: t('grid.col.rule'), minWidth: 320, flex: 1, cellRenderer: p => { const a = document.createElement('a'); a.href = p.data.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = p.value; return a; } },
      { field: 'jurisdiction', headerName: t('grid.col.jurisdiction'), width: 130, flex: 0 },
      { field: 'kind', headerName: t('grid.col.kind'), valueFormatter: p => t('law.kind.' + p.value), width: 170, flex: 0 },
      { field: 'state', headerName: t('grid.col.state'), valueFormatter: p => t('law.state.' + p.value), width: 140, flex: 0 },
      { field: 'lastChecked', headerName: t('grid.col.checked'), width: 140, flex: 0 },
      { field: 'nextCheck', headerName: t('grid.col.next'), width: 140, flex: 0 },
      { field: 'topics', headerName: t('grid.col.topics'), width: 200, flex: 0 },
      { field: 'facts', headerName: t('grid.col.facts'), hide: true }
    ]);
  }

  // -------------------------------------------------------------------------
  // Voice recording helper (MediaRecorder)
  // -------------------------------------------------------------------------
  let recorder = null;
  async function toggleRecording(btn, onDone) {
    if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast(t('rep.noMic'), 'warn'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(tr => tr.stop());
        const blob = new Blob(chunks, { type: (recorder.mimeType || 'audio/webm').split(';')[0] });
        btn.textContent = t('rep.record');
        onDone(await readFile(blob));
      };
      recorder.start();
      btn.textContent = t('rep.stop');
    } catch (_) {
      toast(t('rep.noMic'), 'warn');
    }
  }

  // -------------------------------------------------------------------------
  // Actions (event delegation)
  // -------------------------------------------------------------------------
  const pending = { msPhotos: {}, reassess: null, ipAudio: null, monitor: null };

  const actions = {
    'new-report': el => {
      const domain = domainOf(el.dataset.domain);
      const saved = state.draft || store.get('draft', null);
      state.draft = saved && (saved.domain || 'environment') === domain ? saved : newDraft(domain);
      saveDraft();
    },
    scenario: el => { state.draft = SCENARIOS[el.dataset.id](); saveDraft(); location.hash = '#/report'; },
    'step-next': () => { state.draft.step = Math.min(stepsOf(state.draft).length - 1, state.draft.step + 1); saveDraft(); viewReport(); window.scrollTo(0, 0); },
    'step-back': () => { state.draft.step = Math.max(0, state.draft.step - 1); saveDraft(); viewReport(); window.scrollTo(0, 0); },
    'draft-clear': () => { state.draft = newDraft(state.draft && state.draft.domain); store.del('draft'); viewReport(); },
    choose: el => {
      const a = state.draft.answers;
      if (el.dataset.name === 'cmCategory') { a.category = el.dataset.value; a.observations = [el.dataset.value]; saveDraft(); viewReport(); return; }
      const name = el.dataset.name === 'infraObs' ? 'observations' : el.dataset.name === 'cmInjuries' ? 'injuries' : el.dataset.name;
      const v = el.dataset.value;
      if (el.dataset.multi === '1') {
        let arr = a[name] || [];
        if (v === 'none') arr = arr.includes('none') ? [] : ['none'];
        else { arr = arr.filter(x => x !== 'none'); arr = arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v); }
        a[name] = arr;
      } else {
        a[name] = v;
      }
      saveDraft();
      viewReport();
    },
    geolocate: () => {
      const status = document.getElementById('geo-status');
      if (!navigator.geolocation) { status.textContent = t('rep.noGeo'); return; }
      status.textContent = t('common.working');
      navigator.geolocation.getCurrentPosition(pos => {
        state.draft.lat = pos.coords.latitude; state.draft.lng = pos.coords.longitude; saveDraft();
        status.textContent = t('rep.locationSaved');
      }, () => { status.textContent = t('rep.noGeo'); }, { timeout: 10000 });
    },
    'voice-record': el => toggleRecording(el, dataUrl => { state.draft.voice = dataUrl; document.getElementById('voice-status').textContent = t('rep.voiceSaved'); }),
    'submit-report': async el => {
      const d = state.draft;
      setBusy(el, true, t('rep.analyzing'));
      try {
        const inc = await api('/api/incidents', { body: reportBody(d) });
        owned.add(inc.id, inc.ownerKey);
        state.draft = null; store.del('draft');
        state.protoLang = state.lang;
        location.hash = '#/incident/' + inc.id;
      } catch (err) {
        setBusy(el, false);
        if (err.status === undefined) { // network failure: keep the report and send it later
          if (queueReport(reportBody(d))) {
            state.draft = null; store.del('draft');
            toast(t('off.saved'), 'warn');
            location.hash = '#/';
            return;
          }
          toast(t('off.tooBig'), 'stop');
          return;
        }
        toast(err.message, 'stop');
      }
    },
    tab: el => { state.tab = el.dataset.tab; history.replaceState(null, '', `#/incident/${state.inc.id}/${state.tab}`); renderIncident(); document.getElementById('tab-' + state.tab).focus(); },
    followup: async el => {
      const answers = state.inc.assessment.followUp.map((q, i) => ({ q: L(q), a: (document.querySelector(`[data-fu="${i}"]`) || {}).value || '' })).filter(x => x.a.trim());
      if (!answers.length) { toast(t('safety.followEmpty'), 'warn'); return; }
      setBusy(el, true);
      try { state.inc = await api(`/api/incidents/${state.inc.id}/followup`, { body: { answers } }); toast(t('safety.followThanks')); renderIncident(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    dispute: async el => {
      const note = document.getElementById('dispute').value.trim();
      if (!note) { toast(t('safety.disagreeEmpty'), 'warn'); return; }
      setBusy(el, true);
      try { await api(`/api/incidents/${state.inc.id}/dispute`, { body: { note } }); toast(t('safety.disagreeSaved')); document.getElementById('dispute').value = ''; }
      catch (err) { toast(err.message, 'stop'); }
      setBusy(el, false);
    },
    reassess: async el => {
      setBusy(el, true, t('rep.analyzing'));
      try {
        const photos = pending.reassess ? [pending.reassess] : [];
        state.inc = await api(`/api/incidents/${state.inc.id}/reassess`, { body: { photos } });
        pending.reassess = null;
        toast(t('safety.reassessed'));
        renderIncident();
      } catch (err) {
        setBusy(el, false);
        toast(err.message, 'stop');
        if (err.data && err.data.incident) { state.inc = err.data.incident; }
      }
    },
    'interp-approve': async el => {
      const id = el.dataset.id;
      const name = (document.querySelector(`[data-ip-name="${id}"]`) || {}).value || '';
      const email = (document.querySelector(`[data-ip-email="${id}"]`) || {}).value || '';
      setBusy(el, true);
      try { state.inc = await api(`/api/incidents/${state.inc.id}/interpreters/${id}/approve`, { body: { approver: { name, email } } }); toast(t('interp.paidToast')); renderIncident(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'ip-record': el => toggleRecording(el, dataUrl => { pending.ipAudio = dataUrl; document.getElementById('ip-status').textContent = t('rep.voiceSaved'); }),
    'ip-submit': async el => {
      const body = {
        name: document.getElementById('ip-name').value, email: document.getElementById('ip-email').value,
        language: document.getElementById('ip-lang').value, consent: document.getElementById('ip-consent').checked, audioDataUrl: pending.ipAudio
      };
      if (!body.audioDataUrl) { toast(t('interp.needAudio'), 'warn'); return; }
      setBusy(el, true);
      try { state.inc = await api(`/api/incidents/${state.inc.id}/interpreters`, { body }); pending.ipAudio = null; toast(t('interp.saved')); renderIncident(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'find-solutions': async el => {
      setBusy(el, true, t('sol.searching'));
      try { state.inc.remediation = await api(`/api/incidents/${state.inc.id}/remediation`, { body: {} }); renderIncident(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'find-help': async el => {
      setBusy(el, true, t('sol.searching'));
      try { state.inc.help = await api(`/api/incidents/${state.inc.id}/help`, { body: {} }); renderIncident(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    draft: async el => {
      const orgId = el.dataset.org;
      const langs = Object.keys(state.cfg.protocols);
      openDialog(`<h2>${esc(t('help.draftTitle'))}</h2><label for="draft-lang">${esc(t('help.draftLang'))}</label>
        <select id="draft-lang">${langs.map(l => `<option value="${l}" ${l === state.lang ? 'selected' : ''}>${esc(state.cfg.protocols[l].name)}</option>`).join('')}</select>
        ${state.cfg.aiLive ? '' : `<p class="hint">${esc(t('help.draftDemo'))}</p>`}
        <textarea id="draft-text" style="min-height:260px;margin-top:12px">${esc(t('common.loading'))}</textarea>
        <div class="btn-row"><button class="btn" data-action="draft-copy">${esc(t('help.copy'))}</button><button class="btn secondary" data-action="dialog-close">${esc(t('common.close'))}</button></div>`);
      const load = async () => {
        document.getElementById('draft-text').value = t('common.loading');
        try { const r = await api(`/api/incidents/${state.inc.id}/draft`, { body: { orgId, lang: document.getElementById('draft-lang').value } }); document.getElementById('draft-text').value = r.text; }
        catch (err) { document.getElementById('draft-text').value = err.message; }
      };
      document.getElementById('draft-lang').addEventListener('change', load);
      load();
    },
    'draft-copy': async () => {
      const ta = document.getElementById('draft-text');
      try { await navigator.clipboard.writeText(ta.value); toast(t('help.copied')); } catch (_) { ta.select(); document.execCommand('copy'); toast(t('help.copied')); }
    },
    'ans-save': async el => {
      const body = { status: 'answered', responseType: (document.querySelector('input[name="ans-type"]:checked') || {}).value || 'other', responder: document.getElementById('ans-who').value, note: document.getElementById('ans-note').value };
      setBusy(el, true);
      try { state.report = await api(`/api/incidents/${state.inc.id}/reports/${el.dataset.id}/response`, { body }); closeDialog(); toast(t('rp.statusSaved')); renderIncident(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'ans-draft': async el => {
      setBusy(el, true);
      try {
        const d = await api(`/api/incidents/${state.inc.id}/reports/${el.dataset.id}/reply-draft`, { body: { lang: state.lang, sender: store.get('sender', {}) } });
        setBusy(el, false);
        openDialog(`<h2>${esc(t('ans.dialogReply'))}</h2>
          <label for="draft-text">${esc(t('rp.body'))}</label><textarea id="draft-text" rows="18">${esc(d.subject + '\n\n' + d.body)}</textarea>
          <p class="hint">${esc(t('ans.replyHint'))}</p>
          <div class="btn-row"><button class="btn" data-action="draft-copy">${esc(t('help.copy'))}</button><button class="btn secondary" data-action="dialog-close">${esc(t('common.close'))}</button></div>`);
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'esc-draft': async el => {
      setBusy(el, true);
      try {
        const d = await api(`/api/incidents/${state.inc.id}/escalation-draft`, { body: { reportId: el.dataset.report, ruleId: el.dataset.rule, lang: state.lang, sender: store.get('sender', {}) } });
        setBusy(el, false);
        openDialog(`<h2>${esc(t('esc.dialogTitle'))}</h2>
          <label for="esc-subject">${esc(t('rp.subject'))}</label><input id="esc-subject" type="text" value="${esc(d.subject)}">
          <label for="draft-text">${esc(t('rp.body'))}</label><textarea id="draft-text" rows="16">${esc(d.subject + '\n\n' + d.body)}</textarea>
          <p class="source">${d.step ? `<a href="${esc(d.step.url)}" target="_blank" rel="noopener">${esc(d.step.title)}</a>` : ''}</p>
          <div class="btn-row"><button class="btn" data-action="draft-copy">${esc(t('help.copy'))}</button><button class="btn secondary" data-action="dialog-close">${esc(t('common.close'))}</button></div>`);
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'cal-download': () => {
      const { text, count } = icsText(state.inc, state.report);
      if (!count) { toast(t('cal.none'), 'warn'); return; }
      const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = `comunidad-fuerte-${state.inc.id}.ics`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(t('cal.done', { n: count }));
    },
    'off-create': async el => {
      setBusy(el, true);
      try {
        const r = await api(`/api/incidents/${state.inc.id}/official-link`, { body: {} });
        const m = store.get('officialTokens', {}) || {}; m[state.inc.id] = r.officialToken; store.set('officialTokens', m);
        delete r.officialToken; state.inc = r; renderIncident();
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'off-off': async el => {
      if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = t('sup.offConfirm'); return; }
      try { state.inc = await api(`/api/incidents/${state.inc.id}/official-link`, { body: { off: true } }); const m = store.get('officialTokens', {}) || {}; delete m[state.inc.id]; store.set('officialTokens', m); toast(t('sup.offDone')); renderIncident(); }
      catch (err) { toast(err.message, 'stop'); }
    },
    'off-copy': async () => {
      const el = document.getElementById('off-link');
      try { await navigator.clipboard.writeText(el.value); } catch (_) { el.select(); document.execCommand('copy'); }
      toast(t('help.copied'));
    },
    'match-request': async el => {
      setBusy(el, true);
      try { state.inc = await api(`/api/incidents/${state.inc.id}/match/request`, { body: { lang: state.lang } }); toast(t('match.requested')); renderIncident(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'match-check': async el => {
      setBusy(el, true);
      try { state.inc = await api(`/api/incidents/${state.inc.id}/match/${el.dataset.id}/check`, { body: { simulatePaid: el.dataset.sim === '1' } }); renderIncident(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'off-match': async el => {
      const g = id => (document.getElementById(id) || {}).value || '';
      setBusy(el, true);
      try {
        const v = await api('/api/official/' + encodeURIComponent(state.officialToken) + '/match', { body: { office: g('off-office') || g('mt-office'), email: g('mt-email'), cap: Number(g('mt-cap')) } });
        toast(t('match.pledged'));
        renderOfficialPage(v);
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'off-send': async el => {
      const g = id => (document.getElementById(id) || {}).value || '';
      const body = { status: (document.querySelector('input[name="off-status"]:checked') || {}).value, office: g('off-office'), officer: g('off-officer'), caseNumber: g('off-case'), eta: g('off-eta'), forwardedTo: g('off-fwd'), note: g('off-note') };
      setBusy(el, true);
      try {
        const v = await api('/api/official/' + encodeURIComponent(state.officialToken), { body });
        store.set('officialOffice', { office: body.office, officer: body.officer });
        toast(t('gov.saved'));
        renderOfficialPage(v);
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'sup-create': async el => {
      setBusy(el, true);
      try {
        const r = await api(`/api/incidents/${state.inc.id}/support-link`, { body: {} });
        const m = store.get('supportTokens', {}) || {}; m[state.inc.id] = r.supportToken; store.set('supportTokens', m);
        delete r.supportToken; state.inc = r; renderIncident();
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'sup-off': async el => {
      if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = t('sup.offConfirm'); return; }
      try { state.inc = await api(`/api/incidents/${state.inc.id}/support-link`, { body: { off: true } }); const m = store.get('supportTokens', {}) || {}; delete m[state.inc.id]; store.set('supportTokens', m); toast(t('sup.offDone')); renderIncident(); }
      catch (err) { toast(err.message, 'stop'); }
    },
    'sup-copy': async () => {
      const el = document.getElementById('sup-link');
      try { await navigator.clipboard.writeText(el.value); } catch (_) { el.select(); document.execCommand('copy'); }
      toast(t('help.copied'));
    },
    'sup-send': async el => {
      const kind = el.dataset.kind;
      const body = { kind, affected: (document.querySelector('input[name="sup-aff"]:checked') || {}).value || 'seen' };
      if (kind === 'cosign') { body.name = document.getElementById('sup-name').value; body.agree = document.getElementById('sup-agree').checked; }
      setBusy(el, true);
      try {
        const v = await api('/api/support/' + encodeURIComponent(state.supportToken), { body });
        store.set('supported:' + state.supportToken, true);
        renderSupportPage(v, true);
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'grid-csv': el => {
      const g = state.grids[el.dataset.grid];
      if (g) g.exportDataAsCsv({ fileName: el.dataset.file || 'comunidad-fuerte.csv' });
    },
    'stats-apply': () => {
      const q = new URLSearchParams();
      for (const k of ['country', 'domain', 'from', 'to']) { const v = document.getElementById('st-' + k).value; if (v) q.set(k, v); }
      state.statsQuery = q.toString();
      viewStats();
    },
    'stats-clear': () => { state.statsQuery = ''; viewStats(); },
    'open-code': async () => {
      const c = parseCode(document.getElementById('open-code').value);
      if (!c) { toast(t('priv.badCode'), 'stop'); return; }
      try {
        const found = await api('/api/incidents/mine', { body: { owned: [c] } });
        if (!found.length) { toast(t('priv.badCode'), 'stop'); return; }
        owned.add(c.id, c.key);
        location.hash = '#/incident/' + c.id;
      } catch (err) { toast(err.message, 'stop'); }
    },
    'code-copy': async () => {
      const el = document.getElementById('access-code');
      try { await navigator.clipboard.writeText(el.value); } catch (_) { el.select(); document.execCommand('copy'); }
      toast(t('help.copied'));
    },
    'code-forget': async el => {
      if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = t('priv.forgetConfirm'); return; }
      owned.remove(state.inc.id);
      toast(t('priv.forgotten'));
      location.hash = '#/';
    },
    'sum-copy': async () => {
      const text = summaryText(state.summary);
      try { await navigator.clipboard.writeText(text); } catch (_) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      toast(t('help.copied'));
    },
    'sum-share': async () => {
      const text = summaryText(state.summary);
      if (navigator.share) { try { await navigator.share({ title: state.summary.title, text }); return; } catch (err) { if (err && err.name === 'AbortError') return; } }
      location.href = 'mailto:?subject=' + encodeURIComponent(state.summary.title) + '&body=' + encodeURIComponent(text);
    },
    'dialog-close': () => closeDialog(),
    amount: el => { state.amount = Number(el.dataset.value); renderIncident(); },
    'donate-sim': async el => {
      setBusy(el, true);
      try {
        const order = await api(`/api/incidents/${state.inc.id}/donations/order`, { body: { amount: currentAmount() } });
        await api(`/api/incidents/${state.inc.id}/donations/capture`, { body: { orderId: order.id } });
        toast(t('fund.thanks'));
        await reloadIncident('fund');
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'ms-submit': async el => {
      const id = el.dataset.id;
      const photos = pending.msPhotos[id] || [];
      if (!photos.length) { toast(t('ms.needPhoto'), 'warn'); return; }
      setBusy(el, true, t('ms.verifying'));
      try { state.inc = await api(`/api/incidents/${state.inc.id}/milestones/${id}/evidence`, { body: { photos } }); delete pending.msPhotos[id]; renderIncident(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    approve: async el => {
      const box = el.closest('.milestone');
      const v = f => { const i = box.querySelector(`[data-ms-field="${f}"]`); return i ? (i.type === 'checkbox' ? i.checked : i.value) : ''; };
      setBusy(el, true, t('ms.paying'));
      try {
        state.inc = await api(`/api/incidents/${state.inc.id}/milestones/${el.dataset.id}/approve`, {
          body: { approver: { name: v('approverName'), email: v('approverEmail') }, recipient: { name: v('recipientName'), email: v('recipientEmail') }, reviewedPhotos: v('reviewed') }
        });
        toast(t('ms.paidToast'));
        renderIncident();
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    rate: async el => {
      try {
        await api(`/api/incidents/${state.inc.id}/rate`, { body: { rating: el.dataset.value, methodIds: ((state.inc.remediation || {}).methods || []).slice(0, 3).map(m => m.id) } });
        await reloadIncident('fund');
        toast(t('rate.saved'));
      } catch (err) { toast(err.message, 'stop'); }
    },
    'mon-submit': async el => {
      const width = document.getElementById('mon-width').value;
      if (width === '') { toast(t('mon.needWidth'), 'warn'); return; }
      setBusy(el, true);
      try { state.inc = await api(`/api/incidents/${state.inc.id}/monitor`, { body: { widthMm: Number(width), photo: pending.monitor } }); pending.monitor = null; state.report = null; state.cost = null; toast(t('mon.saved')); renderIncident(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'rp-save-sender': () => { readSender(); toast(t('rp.senderSaved')); },
    'quote-save': async el => {
      setBusy(el, true);
      try {
        state.cost = await api(`/api/incidents/${state.inc.id}/quotes`, { body: { item: document.getElementById('q-item').value, amount: Number(document.getElementById('q-amount').value), currency: document.getElementById('q-currency').value, provider: document.getElementById('q-provider').value } });
        toast(t('cost.quoteSaved')); renderIncident();
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'rp-prepare': el => prepareReport(Number(el.dataset.i)),
    'rp-copy': async () => {
      const text = document.getElementById('rp-subject').value + '\n\n' + document.getElementById('rp-body').value;
      try { await navigator.clipboard.writeText(text); } catch (_) { const ta = document.getElementById('rp-body'); ta.select(); document.execCommand('copy'); }
      toast(t('help.copied'));
    },
    'rp-email': () => {
      const subject = encodeURIComponent(document.getElementById('rp-subject').value);
      const body = encodeURIComponent(document.getElementById('rp-body').value);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    },
    'rp-print': () => {
      const w = window.open('', '_blank');
      if (!w) { toast(t('rp.popup'), 'warn'); return; }
      const doc = w.document;
      doc.title = document.getElementById('rp-subject').value;
      const pre = doc.createElement('pre');
      pre.style.cssText = 'font: 12pt/1.5 Georgia, serif; white-space: pre-wrap; max-width: 7in; margin: 0.8in auto';
      pre.textContent = document.getElementById('rp-body').value;
      doc.body.appendChild(pre);
      w.print();
    },
    'rp-mark': el => markSentDialog(Number(el.dataset.i)),
    'rp-save-sent': async el => {
      const tg = state.report.targets[Number(el.dataset.i)];
      setBusy(el, true);
      try {
        state.report = await api(`/api/incidents/${state.inc.id}/reports`, { body: { targetId: tg.id, kind: tg.kind, targetName: L(tg.name), method: document.getElementById('ms-method').value, tracking: document.getElementById('ms-tracking').value, sentAt: document.getElementById('ms-date').value } });
        closeDialog(); toast(t('rp.sentSaved')); renderIncident();
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'rp-status': async el => {
      if (el.dataset.status === 'answered' && !el.dataset.confirmed) {
        openDialog(`<h2>${esc(t('ans.dialogTitle'))}</h2>
          <div class="choices">${['warranty_denied', 'self_repair', 'will_inspect', 'other'].map((k, i) => `<label class="check"><input type="radio" name="ans-type" value="${k}" ${i === 3 ? 'checked' : ''}> <span>${esc(t('ans.type.' + k))}</span></label>`).join('')}</div>
          <label for="ans-who">${esc(t('ans.who'))}</label><input id="ans-who" type="text" maxlength="120">
          <label for="ans-note">${esc(t('ans.note'))}</label><textarea id="ans-note" rows="5" maxlength="1000"></textarea>
          <div class="btn-row"><button class="btn" data-action="ans-save" data-id="${esc(el.dataset.id)}">${esc(t('ans.save'))}</button><button class="btn secondary" data-action="dialog-close">${esc(t('common.close'))}</button></div>`);
        return;
      }
      try { state.report = await api(`/api/incidents/${state.inc.id}/reports/${el.dataset.id}/response`, { body: { status: el.dataset.status } }); toast(t('rp.statusSaved')); renderIncident(); }
      catch (err) { toast(err.message, 'stop'); }
    },
    print: () => window.print(),
    seed: async el => {
      setBusy(el, true);
      try { const r = await api('/api/demo/seed', { body: {} }); (r.owned || []).forEach(o => owned.add(o.id, o.key)); toast(t('home.seeded')); viewHome(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'sponsor-run': async el => {
      const body = { milestoneId: document.getElementById('sp-ms').value, sponsor: { name: document.getElementById('sp-name').value, email: document.getElementById('sp-email').value }, lang: state.lang };
      setBusy(el, true, t('sp.running'));
      try { state.inc = await api(`/api/incidents/${state.inc.id}/sponsor`, { body }); toast(t('sp.done')); renderIncident(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'sponsor-check': async el => {
      const incId = el.dataset.inc || state.inc.id;
      setBusy(el, true);
      try {
        const inc = await api(`/api/incidents/${incId}/sponsor/${el.dataset.id}/check`, { body: { simulatePaid: el.dataset.sim === '1' } });
        const sp = inc.sponsorships.find(x => x.id === el.dataset.id);
        toast(sp.status === 'PAID' ? t('sp.paidToast') : t('sp.notYet', { status: sp.status }));
        if (el.dataset.inc) { route(); } else { state.inc = inc; renderIncident(); }
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    feedback: el => {
      openDialog(`<h2>${esc(t('kb.reportError'))}</h2><p class="hint">${esc(t('kb.feedbackHint'))}</p>
        <label for="fb-target">${esc(t('kb.about'))}</label><input id="fb-target" type="text" value="${esc(el.dataset.target || '')}">
        <label for="fb-text">${esc(t('kb.whatWrong'))}</label><textarea id="fb-text"></textarea>
        <label for="fb-by">${esc(t('kb.yourName'))}</label><input id="fb-by" type="text">
        <div class="btn-row"><button class="btn" data-action="feedback-send">${esc(t('kb.send'))}</button><button class="btn secondary" data-action="dialog-close">${esc(t('common.close'))}</button></div>`);
    },
    'feedback-send': async el => {
      setBusy(el, true);
      try {
        await api('/api/feedback', { body: { target: document.getElementById('fb-target').value, text: document.getElementById('fb-text').value, by: document.getElementById('fb-by').value } });
        closeDialog(); toast(t('kb.feedbackThanks'));
        if ((location.hash || '').startsWith('#/learn')) viewLearn();
      } catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'kb-refresh': async el => {
      setBusy(el, true, t('sol.searching'));
      try { await api('/api/knowledge/refresh', { body: {} }); toast(t('kb.refreshed')); viewLearn(); }
      catch (err) { setBusy(el, false); toast(err.message, 'stop'); }
    },
    'kb-review': async el => {
      const reviewer = document.getElementById('kb-reviewer').value;
      store.set('reviewer', reviewer);
      try { await api('/api/knowledge/review', { body: { kind: el.dataset.kind, id: el.dataset.id, decision: el.dataset.decision, reviewer } }); toast(t('kb.reviewSaved')); viewLearn(); }
      catch (err) { toast(err.message, 'stop'); }
    },
    'law-verify': async el => {
      const reviewer = document.getElementById('kb-reviewer').value;
      store.set('reviewer', reviewer);
      try { await api(`/api/laws/${el.dataset.id}/verify`, { body: { reviewer } }); toast(t('law.verified')); viewLearn(); }
      catch (err) { toast(err.message, 'stop'); }
    },
    'law-check': async el => {
      el.disabled = true;
      try { const r = await api(`/api/laws/${el.dataset.id}/check`, { body: {} }); toast(t('law.checkDone', { result: t('law.result.' + r.result) })); viewLearn(); }
      catch (err) { toast(err.message, 'stop'); el.disabled = false; }
    },
    'law-resolve': async el => {
      const reviewer = document.getElementById('kb-reviewer').value;
      store.set('reviewer', reviewer);
      try { await api(`/api/laws/changes/${el.dataset.id}`, { body: { decision: el.dataset.decision, reviewer } }); toast(t('kb.reviewSaved')); viewLearn(); }
      catch (err) { toast(err.message, 'stop'); }
    },
    'law-report': el => {
      openDialog(`<h2>${esc(t('law.report'))}</h2><p class="hint">${esc(t('law.reportHint'))}</p>
        <label for="lc-note">${esc(t('law.whatChanged'))}</label><textarea id="lc-note"></textarea>
        <label for="lc-url">${esc(t('law.whereSeen'))}</label><input id="lc-url" type="url" placeholder="https://">
        <div class="btn-row"><button class="btn" data-action="law-report-send" data-id="${esc(el.dataset.id)}">${esc(t('kb.send'))}</button><button class="btn secondary" data-action="dialog-close">${esc(t('common.close'))}</button></div>`);
    },
    'law-report-send': async el => {
      try {
        await api('/api/laws/changes', { body: { lawId: el.dataset.id, note: document.getElementById('lc-note').value, sourceUrl: document.getElementById('lc-url').value, by: store.get('reviewer', '') } });
        closeDialog(); toast(t('kb.feedbackThanks')); viewLearn();
      } catch (err) { toast(err.message, 'stop'); }
    },
    'fb-resolve': async el => {
      const reviewer = document.getElementById('kb-reviewer').value;
      store.set('reviewer', reviewer);
      try { await api(`/api/feedback/${el.dataset.id}/resolve`, { body: { decision: el.dataset.decision, reviewer } }); toast(t('kb.reviewSaved')); viewLearn(); }
      catch (err) { toast(err.message, 'stop'); }
    },
    'demo-reset': async el => {
      if (!window.confirm(t('kb.resetConfirm'))) return;
      try { await api('/api/demo/reset', { body: { confirm: 'RESET' } }); state.draft = null; store.del('draft'); toast(t('kb.resetDone')); location.hash = '#/'; }
      catch (err) { toast(err.message, 'stop'); }
    }
  };

  const changeActions = {
    'stats-optin': async el => {
      try { state.inc = await api(`/api/incidents/${state.inc.id}/stats-optin`, { body: { optIn: el.checked } }); toast(t(el.checked ? 'stats.optOnSaved' : 'stats.optOffSaved')); }
      catch (err) { el.checked = !el.checked; toast(err.message, 'stop'); }
    },
    'photo-file': async el => {
      const file = el.files && el.files[0];
      if (!file) return;
      const dataUrl = await readFile(file);
      state.draft.photos[el.dataset.slot] = { dataUrl, preview: dataUrl };
      viewReport();
    },
    'photo-sample': el => {
      if (!el.value) return;
      state.draft.photos[el.dataset.slot] = { sampleId: el.value, preview: `/samples/${el.value}.jpg` };
      saveDraft();
      viewReport();
    },
    'voice-file': async el => {
      const file = el.files && el.files[0];
      if (!file) return;
      state.draft.voice = await readFile(file);
      document.getElementById('voice-status').textContent = t('rep.voiceSaved');
    },
    'mon-file': async el => {
      const file = el.files && el.files[0];
      if (!file) return;
      pending.monitor = { role: 'monitor', dataUrl: await readFile(file) };
      document.getElementById('mon-status').textContent = t('safety.photoReady');
    },
    'mon-sample': el => {
      if (!el.value) return;
      pending.monitor = { role: 'monitor', sampleId: el.value };
      document.getElementById('mon-status').textContent = t('safety.photoReady');
    },
    'proto-lang': el => { state.protoLang = el.value; renderIncident(); },
    'reassess-file': async el => {
      const file = el.files && el.files[0];
      if (!file) return;
      pending.reassess = { role: 'reassess', dataUrl: await readFile(file) };
      document.getElementById('reassess-status').textContent = t('safety.photoReady');
    },
    'reassess-sample': el => {
      if (!el.value) return;
      pending.reassess = { role: 'reassess', sampleId: el.value };
      document.getElementById('reassess-status').textContent = t('safety.photoReady');
    },
    'ip-file': async el => {
      const file = el.files && el.files[0];
      if (!file) return;
      pending.ipAudio = await readFile(file);
      document.getElementById('ip-status').textContent = t('rep.voiceSaved');
    },
    // Update the label in place: re-rendering here would replace the button
    // between mousedown and click when the field loses focus.
    'amount-custom': el => {
      state.amount = Number(el.value) || 25;
      const btn = document.querySelector('[data-action="donate-sim"]');
      if (btn) btn.textContent = t('fund.donateSim', { amount: fmtMoney(currentAmount()) });
      document.querySelectorAll('[data-action="amount"]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.value) === currentAmount())));
    },
    'ms-files': async el => {
      const id = el.dataset.id;
      const files = Array.from(el.files || []).slice(0, 4);
      pending.msPhotos[id] = await Promise.all(files.map(async f => ({ role: 'evidence', dataUrl: await readFile(f) })));
      document.querySelector(`[data-ms-preview="${id}"]`).innerHTML = pending.msPhotos[id].map(p => `<img src="${p.dataUrl}" alt="">`).join('');
    },
    'ms-sample': el => {
      if (!el.value) return;
      const id = el.dataset.id;
      pending.msPhotos[id] = [{ role: 'evidence', sampleId: el.value }];
      document.querySelector(`[data-ms-preview="${id}"]`).innerHTML = `<img src="/samples/${el.value}.jpg" alt="">`;
    }
  };

  $app.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el || !actions[el.dataset.action]) return;
    if (el.tagName === 'A' && el.dataset.action === 'new-report') { actions['new-report'](el, e); return; }
    e.preventDefault();
    actions[el.dataset.action](el, e);
  });
  document.getElementById('dialog').addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) { e.preventDefault(); actions[el.dataset.action](el, e); }
  });
  $app.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.actionChange && changeActions[el.dataset.actionChange]) { changeActions[el.dataset.actionChange](el, e); return; }
    if (el.dataset.bindCheck && state.draft) { state.draft[el.dataset.bindCheck] = el.checked; saveDraft(); viewReport(); }
  });
  $app.addEventListener('input', e => {
    const el = e.target;
    if (!state.draft) return;
    if (el.dataset.bind) {
      state.draft.answers[el.dataset.bind] = el.value;
      // Keep the price country in step with the legal location when it is known.
      if (el.dataset.bind === 'jurisdiction') {
        if (el.value.startsWith('US')) state.draft.answers.country = 'US';
        else if (el.value === 'MX') state.draft.answers.country = 'MX';
      }
      saveDraft();
    }
    if (el.dataset.bindRoot) { state.draft[el.dataset.bindRoot] = el.value; saveDraft(); }
  });

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------
  (async function boot() {
    if (window.CF_OLD_BROWSER) return;
    try {
      state.cfg = await api('/api/config');
    } catch (err) {
      $app.innerHTML = `<div class="panel"><h1>Comunidad Fuerte</h1><p class="error">${esc(err.message)}</p></div>`;
      return;
    }
    route();
    flushOutbox();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support unavailable */ });
  })();
})();
