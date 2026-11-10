// Pictograms for the safety protocols. Bold strokes, readable at a glance in
// sunlight and understandable without reading any language.
(function () {
  const S = (inner) => `<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const NO = '<circle cx="32" cy="32" r="28"/><line x1="12" y1="52" x2="52" y2="12"/>';
  window.ICONS = {
    gloves: S('<path d="M20 58V30l-4-12a3 3 0 0 1 6-2l4 10V10a3 3 0 0 1 6 0v14V8a3 3 0 0 1 6 0v16V12a3 3 0 0 1 6 0v28c0 10-6 18-14 18z"/>'),
    tools: S('<line x1="14" y1="58" x2="40" y2="18"/><path d="M34 10l16 10-4 6-16-10z"/><line x1="40" y1="18" x2="46" y2="22"/>'),
    nofire: S('<path d="M32 50c-8 0-12-6-12-12 0-8 8-12 8-22 6 4 14 12 14 22 0 6-4 12-10 12z"/>' + NO),
    bag: S('<path d="M18 22h28l4 36H14z"/><path d="M24 22c0-8 4-12 8-12s8 4 8 12"/>'),
    water: S('<path d="M32 8c8 12 16 20 16 30a16 16 0 0 1-32 0c0-10 8-18 16-30z"/>'),
    wind: S('<path d="M6 24h34a6 6 0 1 0-6-6"/><path d="M6 36h44a6 6 0 1 1-6 6"/><path d="M6 48h22"/>'),
    ppe: S('<path d="M8 26c8-4 40-4 48 0v8c0 6-6 10-12 10-6 0-8-6-12-6s-6 6-12 6c-6 0-12-4-12-10z"/><circle cx="20" cy="32" r="3"/><circle cx="44" cy="32" r="3"/>'),
    people: S('<circle cx="22" cy="18" r="6"/><path d="M12 54V36a10 10 0 0 1 20 0v18"/><circle cx="44" cy="26" r="5"/><path d="M36 54V42a8 8 0 0 1 16 0v12"/>'),
    smell: S('<path d="M26 12c-4 8 4 10 0 18M36 10c-4 8 4 10 0 18"/><path d="M20 40c4-4 20-4 24 0l-4 14H24z"/>'),
    health: S('<rect x="10" y="18" width="44" height="36" rx="6"/><path d="M32 26v20M22 36h20"/><path d="M24 18v-6h16v6"/>'),
    notouch: S('<path d="M26 46V24a3 3 0 0 1 6 0v12V18a3 3 0 0 1 6 0v18-12a3 3 0 0 1 6 0v18c0 6-4 10-10 10h-4c-4 0-6-2-8-4l-6-8a3 3 0 0 1 4-4z"/>' + NO),
    away: S('<circle cx="40" cy="10" r="5"/><path d="M38 18l-6 14 8 8v14M32 32l-10 6-6-4M40 26l8 6 8-2M30 40l-6 14"/>'),
    photo: S('<rect x="8" y="18" width="48" height="34" rx="6"/><circle cx="32" cy="35" r="10"/><path d="M22 18l4-6h12l4 6"/>'),
    bolt: S('<path d="M36 6L14 36h16l-4 22 24-32H34z"/>'),
    drop: S('<path d="M32 10c6 10 12 16 12 24a12 12 0 0 1-24 0c0-8 6-14 12-24z"/><path d="M10 54h44"/>'),
    road: S('<path d="M22 6L10 58M42 6l12 52"/><path d="M32 10v8M32 26v8M32 42v8"/><ellipse cx="44" cy="44" rx="5" ry="3"/>'),
    bulb: S('<path d="M22 28a10 10 0 1 1 20 0c0 6-4 8-5 14H27c-1-6-5-8-5-14z"/><path d="M27 48h10M28 54h8"/><path d="M12 10l5 4M52 10l-5 4"/>'),
    house: S('<path d="M8 30L32 10l24 20"/><path d="M14 26v28h36V26"/><path d="M27 54V40h10v14"/>'),
    trash: S('<path d="M14 18h36M26 18v-6h12v6"/><path d="M18 18l3 38h22l3-38"/><path d="M28 26v22M36 26v22"/>'),
    alert: S('<path d="M32 6L60 56H4z"/><path d="M32 24v16"/><circle cx="32" cy="47" r="1.5"/>'),
    shield: S('<path d="M32 6l22 8v16c0 14-10 24-22 28C20 54 10 44 10 30V14z"/><path d="M22 32l7 7 14-15"/>'),
    call: S('<path d="M18 8h10l4 12-6 4c2 6 6 10 12 12l4-6 12 4v10c0 4-4 8-8 8C26 52 12 38 10 16c0-4 4-8 8-8z"/>'),
    // building and infrastructure
    stairs: S('<path d="M6 54h14V42h14V30h14V18h10"/><path d="M6 54v4M58 18V10"/>'),
    nostairs: S('<path d="M10 50h12V40h12V30h12V20h8"/>' + NO),
    railanchor: S('<path d="M10 20l34 12"/><path d="M44 10v26"/><rect x="38" y="34" width="14" height="6"/><path d="M6 46h52"/><path d="M45 40l-4 6 5 6-3 6"/>'),
    crack: S('<rect x="8" y="14" width="48" height="36" rx="2"/><path d="M30 14l-4 10 6 6-6 8 4 12"/>'),
    railing: S('<path d="M8 22l44 14"/><path d="M14 24v26M28 28v24M44 33v20"/><path d="M50 14l6 4M50 22l6-4"/>'),
    rust: S('<rect x="8" y="12" width="48" height="40" rx="2"/><path d="M22 22v10c0 4 4 4 4 8v6M38 22v8c0 4-4 6-4 10"/>'),
    gap: S('<path d="M6 26h22v6H6zM36 32h22v6H36z"/><path d="M28 26l8 6" stroke-dasharray="3 3"/><path d="M20 50l6-6 6 6"/>'),
    falling: S('<path d="M8 14h48v10H8z"/><path d="M20 24l-2 8M32 24l2 10M44 24l-3 6"/><rect x="16" y="40" width="6" height="6"/><rect x="34" y="46" width="6" height="6"/>'),
    water: S('<path d="M8 20h48M8 20v30h48V20"/><path d="M24 30c4 6 4 8 0 10M38 28c4 6 4 8 0 10"/>'),
    ruler: S('<rect x="6" y="22" width="52" height="20" rx="3"/><path d="M14 22v8M22 22v5M30 22v8M38 22v5M46 22v8"/>'),
    calendar: S('<rect x="10" y="14" width="44" height="40" rx="4"/><path d="M10 26h44M22 8v10M42 8v10"/><path d="M20 36h6M32 36h6M20 44h6"/>'),
    mail: S('<rect x="8" y="16" width="48" height="32" rx="4"/><path d="M8 18l24 18 24-18"/>'),
    folder: S('<path d="M8 18h16l4 6h28v26H8z"/>'),
    nolean: S('<path d="M10 20l40 14"/><path d="M26 34l-6 18M20 52h10"/>' + NO),
    cone: S('<path d="M26 10h12l12 40H14z"/><path d="M20 30h24M17 40h30"/><path d="M8 54h48"/>'),
    // observation chips
    sargassum: S('<path d="M8 48c8-8 16 0 24-8s16 0 24-8"/><path d="M14 36c4-6 10-4 12-10M36 30c4-6 10-4 12-10"/><circle cx="20" cy="30" r="2"/><circle cx="42" cy="24" r="2"/>'),
    rotting: S('<path d="M8 50c8-8 16 0 24-8s16 0 24-8"/><path d="M22 30c-4-8 4-10 0-18M36 28c-4-8 4-10 0-18"/>'),
    oil: S('<path d="M32 8c8 12 16 20 16 30a16 16 0 0 1-32 0c0-10 8-18 16-30z" fill="currentColor" fill-opacity=".25"/><path d="M24 40c2 4 6 6 10 6"/>'),
    foam: S('<path d="M6 44c8-6 16 6 26 0s18 6 26 0"/><circle cx="20" cy="30" r="6"/><circle cx="34" cy="26" r="7"/><circle cx="46" cy="32" r="5"/>'),
    deadfish: S('<path d="M8 32c10-12 30-12 40 0-10 12-30 12-40 0z"/><path d="M48 32l10-8v16z"/><path d="M16 28l4 4m0-4l-4 4"/>'),
    drum: S('<ellipse cx="32" cy="14" rx="16" ry="5"/><path d="M16 14v36c0 3 7 6 16 6s16-3 16-6V14"/><path d="M16 26c0 3 7 6 16 6s16-3 16-6M16 40c0 3 7 6 16 6s16-3 16-6"/>'),
    plastic: S('<path d="M26 8h12v8l6 8v30a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V24l6-8z"/><line x1="20" y1="36" x2="44" y2="36"/>'),
    smoke: S('<path d="M20 54c-6-6 6-10 0-18s6-10 0-18"/><path d="M36 54c-6-6 6-10 0-18s6-10 0-18"/><path d="M50 50c-4-4 4-8 0-14"/>'),
    other: S('<circle cx="32" cy="32" r="24"/><path d="M26 24a6 6 0 1 1 8 6c-2 1-2 3-2 6"/><circle cx="32" cy="44" r="1.5" fill="currentColor"/>')
  };
})();
