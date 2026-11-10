'use strict';
// Approximate repair cost by place.
//
// Method (stated in the app, not hidden):
//  1. Base prices: US national averages from published cost guides.
//  2. Inside the US: scaled by the BEA Regional Price Parity of the area.
//  3. Other countries: the labor share of each item is scaled by the World
//     Bank price level (PPP conversion factor / market exchange rate); the
//     materials share stays at US prices, since cement and steel trade
//     internationally. Shown in USD and in local currency.
//  4. When a community records 3 or more real local quotes for an item, the
//     median of those quotes replaces the formula for that item.
// The app adds a ±30% band to show uncertainty; that band is the app's
// assumption, not part of any source.

const RETRIEVED = '2026-10-18';

const SOURCES = {
  homeadvisorSteps: { title: 'HomeAdvisor: Concrete step repair cost (updated Jun 19, 2026)', url: 'https://www.homeadvisor.com/cost/stairs-and-railings/concrete-step-repair-cost' },
  engineer: { title: "Today's Homeowner: Structural engineer cost (updated May 22, 2025)", url: 'https://todayshomeowner.com/foundation/cost/structural-engineer-cost/' },
  rppAustin: { title: 'BEA Regional Price Parities via FRED: Austin-Round Rock, TX, 2024', url: 'https://fred.stlouisfed.org/series/RPPALL12420' },
  rppTexas: { title: 'BEA Regional Price Parities via FRED: Texas metropolitan portion, 2024', url: 'https://fred.stlouisfed.org/series/TXMPRPPALL' },
  ppp: { title: 'World Bank WDI: PPP conversion factor, GDP (PA.NUS.PPP), 2025', url: 'https://api.worldbank.org/v2/country/MEX/indicator/PA.NUS.PPP?format=json&mrnev=1' },
  fx: { title: 'World Bank WDI: Official exchange rate (PA.NUS.FCRF), 2025', url: 'https://api.worldbank.org/v2/country/MEX/indicator/PA.NUS.FCRF?format=json&mrnev=1' }
};

// Labor is 75% to 90% of concrete step repair cost (HomeAdvisor); the app uses 80%.
const LABOR_SHARE = 0.8;

const ITEMS = {
  seal_cracks: { usd: 100, labor: LABOR_SHARE, source: 'homeadvisorSteps', label: { en: 'Seal cracks', es: 'Sellar grietas' } },
  reinforcement: { usd: 200, labor: LABOR_SHARE, source: 'homeadvisorSteps', label: { en: 'Add reinforcement (rebar or wire mesh)', es: 'Agregar refuerzo (varilla o malla)' } },
  leveling: { usd: 400, labor: LABOR_SHARE, source: 'homeadvisorSteps', label: { en: 'Level uneven steps and close the gap', es: 'Nivelar escalones y cerrar la separación' } },
  patch: { usd: 650, labor: LABOR_SHARE, source: 'homeadvisorSteps', label: { en: 'Patch damaged or rusting sections', es: 'Parchar secciones dañadas o con óxido' } },
  handrail: { usd: 700, labor: LABOR_SHARE, source: 'homeadvisorSteps', label: { en: 'Re-anchor or replace the handrail section', es: 'Reanclar o reemplazar el tramo de barandal' }, note: { en: 'Source price is for installing new handrails; labor share assumed equal to concrete work.', es: 'El precio de la fuente es para instalar barandales nuevos; se asume la misma proporción de mano de obra que en concreto.' } },
  replace_step: { usd: 3500, labor: LABOR_SHARE, source: 'homeadvisorSteps', label: { en: 'Replace the damaged step', es: 'Reemplazar el escalón dañado' } },
  engineer: { usd: 800, low: 400, high: 1200, labor: 1, source: 'engineer', label: { en: 'Structural engineer inspection', es: 'Inspección de ingeniero estructural' } }
};

// World Bank 2025 (Viet Nam excluded: exchange rate only available for 2024).
const COUNTRIES = {
  US: { name: { en: 'United States', es: 'Estados Unidos' }, ppp: 1, fx: 1, currency: 'USD' },
  MX: { name: { en: 'Mexico', es: 'México' }, ppp: 10.328951, fx: 19.2375083333333, currency: 'MXN' },
  GT: { name: { en: 'Guatemala', es: 'Guatemala' }, ppp: 3.33451157924276, fx: 7.68012458333333, currency: 'GTQ' },
  HN: { name: { en: 'Honduras', es: 'Honduras' }, ppp: 11.8640844280338, fx: 25.9526748179551, currency: 'HNL' },
  SV: { name: { en: 'El Salvador', es: 'El Salvador' }, ppp: 0.408953489712557, fx: 1, currency: 'USD' },
  NI: { name: { en: 'Nicaragua', es: 'Nicaragua' }, ppp: 12.5185500987327, fx: 36.6243, currency: 'NIO' },
  CR: { name: { en: 'Costa Rica', es: 'Costa Rica' }, ppp: 297.351768, fx: 503.496832373272, currency: 'CRC' },
  PA: { name: { en: 'Panama', es: 'Panamá' }, ppp: 0.45076892365416, fx: 1, currency: 'USD' },
  DO: { name: { en: 'Dominican Republic', es: 'República Dominicana' }, ppp: 23.8682512750234, fx: 61.9865666666666, currency: 'DOP' },
  HT: { name: { en: 'Haiti', es: 'Haití' }, ppp: 112.359715746475, fx: 130.626409210526, currency: 'HTG' },
  PR: { name: { en: 'Puerto Rico', es: 'Puerto Rico' }, ppp: 0.778230137047568, fx: 1, currency: 'USD' },
  CO: { name: { en: 'Colombia', es: 'Colombia' }, ppp: 1532.719303, fx: 4053.13583333333, currency: 'COP' },
  EC: { name: { en: 'Ecuador', es: 'Ecuador' }, ppp: 0.425220703426529, fx: 1, currency: 'USD' },
  PE: { name: { en: 'Peru', es: 'Perú' }, ppp: 1.83592285276037, fx: 3.56706380329909, currency: 'PEN' },
  BO: { name: { en: 'Bolivia', es: 'Bolivia' }, ppp: 2.76324583616839, fx: 6.91, currency: 'BOB' },
  BR: { name: { en: 'Brazil', es: 'Brasil' }, ppp: 2.55440835439356, fx: 5.58728623856661, currency: 'BRL' },
  CL: { name: { en: 'Chile', es: 'Chile' }, ppp: 453.188563, fx: 951.329454191033, currency: 'CLP' },
  AR: { name: { en: 'Argentina', es: 'Argentina' }, ppp: 567.297421343424, fx: 1240.85125, currency: 'ARS' },
  CA: { name: { en: 'Canada', es: 'Canadá' }, ppp: 1.166683, fx: 1.39810565893901, currency: 'CAD' },
  ES: { name: { en: 'Spain', es: 'España' }, ppp: 0.570991, fx: 0.88496895841236, currency: 'EUR' },
  FR: { name: { en: 'France', es: 'Francia' }, ppp: 0.677618, fx: 0.88496895841236, currency: 'EUR' },
  PT: { name: { en: 'Portugal', es: 'Portugal' }, ppp: 0.534218, fx: 0.88496895841236, currency: 'EUR' },
  IT: { name: { en: 'Italy', es: 'Italia' }, ppp: 0.610275, fx: 0.88496895841236, currency: 'EUR' },
  DE: { name: { en: 'Germany', es: 'Alemania' }, ppp: 0.709983, fx: 0.88496895841236, currency: 'EUR' },
  GB: { name: { en: 'United Kingdom', es: 'Reino Unido' }, ppp: 0.677133, fx: 0.759473957338607, currency: 'GBP' },
  TR: { name: { en: 'Türkiye', es: 'Turquía' }, ppp: 16.203626, fx: 39.4548130977982, currency: 'TRY' },
  EG: { name: { en: 'Egypt', es: 'Egipto' }, ppp: 7.58370974796763, fx: 49.2277558333333, currency: 'EGP' },
  NG: { name: { en: 'Nigeria', es: 'Nigeria' }, ppp: 195.022548515709, fx: 1518.38094813367, currency: 'NGN' },
  KE: { name: { en: 'Kenya', es: 'Kenia' }, ppp: 43.5471478663385, fx: 129.302572099377, currency: 'KES' },
  ZA: { name: { en: 'South Africa', es: 'Sudáfrica' }, ppp: 7.42029658394341, fx: 17.8887489855833, currency: 'ZAR' },
  IN: { name: { en: 'India', es: 'India' }, ppp: 20.0886288014602, fx: 87.1584483507393, currency: 'INR' },
  PK: { name: { en: 'Pakistan', es: 'Pakistán' }, ppp: 67.8368115155746, fx: 281.143001173202, currency: 'PKR' },
  BD: { name: { en: 'Bangladesh', es: 'Bangladés' }, ppp: 30.9160155190794, fx: 121.920836605034, currency: 'BDT' },
  CN: { name: { en: 'China', es: 'China' }, ppp: 3.39768588417447, fx: 7.18984737402171, currency: 'CNY' },
  JP: { name: { en: 'Japan', es: 'Japón' }, ppp: 97.08005, fx: 149.657926890951, currency: 'JPY' },
  ID: { name: { en: 'Indonesia', es: 'Indonesia' }, ppp: 4720.99750025346, fx: 16477.8651797835, currency: 'IDR' },
  PH: { name: { en: 'Philippines', es: 'Filipinas' }, ppp: 19.069580238078, fx: 57.5050971489714, currency: 'PHP' },
  TH: { name: { en: 'Thailand', es: 'Tailandia' }, ppp: 10.0922556843405, fx: 32.882809252867, currency: 'THB' },
  RU: { name: { en: 'Russia', es: 'Rusia' }, ppp: 29.6122633846497, fx: 83.6525, currency: 'RUB' }
};

function priceLevel(code) {
  const c = COUNTRIES[code];
  return c ? c.ppp / c.fx : null;
}

// Which repairs the reported signs usually call for.
function itemsFor(flags, tier) {
  const f = new Set(flags || []);
  const ids = ['seal_cracks'];
  if (f.has('crack_at_railing_anchor') || f.has('railing_moves')) ids.push('reinforcement', 'handrail');
  if (f.has('rust_from_embedded_steel')) ids.push('patch', 'reinforcement');
  if (f.has('gap_or_trip_hazard')) ids.push('leveling');
  if (f.has('pieces_falling') || f.has('crack_wider_3mm') || f.has('crack_growing')) ids.push('replace_step');
  if (tier === 'yellow' || tier === 'red') ids.unshift('engineer');
  return [...new Set(ids)];
}

function locationFactor(answers) {
  const a = answers || {};
  const country = (a.country || '').toUpperCase() || (String(a.jurisdiction || '').startsWith('US') ? 'US' : '');
  if (country === 'US' || String(a.jurisdiction || '').startsWith('US')) {
    if (a.jurisdiction === 'US-TX' && /austin/i.test(a.placeLabel || '')) return { kind: 'rpp', value: 0.98066, code: 'US', label: { en: 'Austin-Round Rock, TX price level (US = 100): 98.1', es: 'Nivel de precios de Austin-Round Rock, TX (EE. UU. = 100): 98.1' }, sources: [SOURCES.rppAustin] };
    if (a.jurisdiction === 'US-TX') return { kind: 'rpp', value: 0.9793, code: 'US', label: { en: 'Texas metropolitan price level (US = 100): 97.9', es: 'Nivel de precios de zonas metropolitanas de Texas (EE. UU. = 100): 97.9' }, sources: [SOURCES.rppTexas] };
    return { kind: 'none', value: 1, code: 'US', label: { en: 'US national average', es: 'Promedio nacional de EE. UU.' }, sources: [] };
  }
  const pl = priceLevel(country);
  if (pl) {
    const n = COUNTRIES[country].name;
    return { kind: 'pli', value: pl, code: country, label: { en: `${n.en} price level vs. US: ${(pl * 100).toFixed(0)}%`, es: `Nivel de precios de ${n.es} frente a EE. UU.: ${(pl * 100).toFixed(0)}%` }, sources: [SOURCES.ppp, SOURCES.fx] };
  }
  return { kind: 'unknown', value: 1, code: country || null, label: { en: 'No price data for this country yet: showing US averages', es: 'Aún no hay datos de precios para este país: se muestran promedios de EE. UU.' }, sources: [] };
}

function median(nums) {
  const s = [...nums].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function adjust(usd, labor, factor) {
  if (factor.kind === 'rpp' || factor.kind === 'none' || factor.kind === 'unknown') return usd * factor.value;
  return usd * (labor * factor.value + (1 - labor));
}

// quotes: [{ item, usd, country }] recorded by communities (real local prices)
function estimate(answers, flags, tier, quotes) {
  const factor = locationFactor(answers);
  const country = COUNTRIES[factor.code] || COUNTRIES.US;
  const rate = factor.kind === 'unknown' ? 1 : country.fx;
  const currency = factor.kind === 'unknown' ? 'USD' : country.currency;
  const items = itemsFor(flags, tier).map(id => {
    const it = ITEMS[id];
    const local = (quotes || []).filter(q => q.item === id && q.country === factor.code && q.usd > 0);
    let usd;
    let basis;
    if (local.length >= 3) {
      usd = median(local.map(q => q.usd));
      basis = { kind: 'community', n: local.length };
    } else {
      usd = adjust(it.usd, it.labor, factor);
      basis = { kind: 'formula' };
    }
    const range = it.low ? [adjust(it.low, it.labor, factor), adjust(it.high, it.labor, factor)] : null;
    return { id, label: it.label, usd: Math.round(usd), local: Math.round(usd * rate), range: range && range.map(Math.round), basis, note: it.note || null, source: SOURCES[it.source] };
  });
  const total = items.reduce((s, x) => s + x.usd, 0);
  return {
    items,
    totalUsd: Math.round(total),
    lowUsd: Math.round(total * 0.7),
    highUsd: Math.round(total * 1.3),
    currency, rate,
    totalLocal: Math.round(total * rate), lowLocal: Math.round(total * 0.7 * rate), highLocal: Math.round(total * 1.3 * rate),
    factor,
    laborShare: LABOR_SHARE,
    retrieved: RETRIEVED,
    method: {
      en: 'US national averages from published cost guides. In the US, scaled by the area price level (BEA). Elsewhere, the labor part (80%; labor is 75–90% of concrete step repair) is scaled by the World Bank price level and materials stay at US prices. The ±30% range is the app\'s uncertainty band. Real local quotes replace the formula once 3 or more are recorded.',
      es: 'Promedios nacionales de EE. UU. tomados de guías de costos publicadas. En EE. UU., se ajustan con el nivel de precios de la zona (BEA). En otros países, la mano de obra (80%; es entre 75% y 90% del costo de reparar escalones de concreto) se ajusta con el nivel de precios del Banco Mundial y los materiales quedan a precio de EE. UU. El rango de ±30% es el margen de incertidumbre de la app. Las cotizaciones locales reales reemplazan la fórmula cuando hay 3 o más.'
    },
    disclaimer: { en: 'Approximate estimate to plan and negotiate, not a quote. Ask licensed local contractors for at least two written quotes.', es: 'Estimado aproximado para planear y negociar, no una cotización. Pide al menos dos cotizaciones por escrito a contratistas locales con licencia.' }
  };
}

function toUsd(amount, currency) {
  const cur = String(currency || 'USD').toUpperCase();
  if (cur === 'USD') return Number(amount);
  const c = Object.values(COUNTRIES).find(x => x.currency === cur);
  return c ? Number(amount) / c.fx : null;
}

module.exports = { estimate, locationFactor, priceLevel, itemsFor, toUsd, COUNTRIES, ITEMS, SOURCES, LABOR_SHARE };
