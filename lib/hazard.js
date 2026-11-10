'use strict';
// Hazard level display by country. The app's internal safety logic keeps three
// tiers (green, yellow, red). How a tier is SHOWN follows the official safety
// colour and signal-word standard of the country where the situation happens:
//
//   US      ANSI Z535 / OSHA 29 CFR 1910.145: DANGER red, WARNING orange,
//           CAUTION yellow, safety instructions green.
//   MX      NOM-026-STPS-2008: red = prohibition, yellow = hazard warning,
//           green = safe condition (no orange level).
//   EU, UK  Directive 92/58/EEC (UK: Safety Signs and Signals Regulations 1996):
//           red = prohibition / danger alarm, yellow or amber = warning,
//           green = emergency escape and first aid (no orange level).
//   other   ISO 3864-1 colours and ISO 3864-2 signal words: DANGER red,
//           WARNING orange, CAUTION yellow, safe condition green.
//
// Where a standard has an orange WARNING level, a yellow incident whose signs
// could cause serious injury (gas, a failing railing anchor, a fall, rising
// water) is shown as WARNING; otherwise as CAUTION. Screen colours are close
// approximations of the standard colours.

const t = (en, es) => ({ en, es });

const COLORS = {
  red: { bg: '#9B2423', fg: '#ffffff' },
  orange: { bg: '#E8701A', fg: '#111111' },
  yellow: { bg: '#F9A900', fg: '#111111' },
  green: { bg: '#237F52', fg: '#ffffff' }
};

// Signal words in the app's 10 languages.
const WORDS = {
  danger: { en: 'DANGER', es: 'PELIGRO', fr: 'DANGER', pt: 'PERIGO', zh: '危险', hi: 'खतरा', ar: 'خطر', bn: 'বিপদ', ru: 'ОПАСНО', id: 'BAHAYA' },
  warning: { en: 'WARNING', es: 'ADVERTENCIA', fr: 'AVERTISSEMENT', pt: 'ADVERTÊNCIA', zh: '警告', hi: 'चेतावनी', ar: 'تحذير', bn: 'সতর্কতা', ru: 'ПРЕДУПРЕЖДЕНИЕ', id: 'PERINGATAN' },
  caution: { en: 'CAUTION', es: 'PRECAUCIÓN', fr: 'ATTENTION', pt: 'CUIDADO', zh: '注意', hi: 'सावधानी', ar: 'تنبيه', bn: 'সাবধান', ru: 'ОСТОРОЖНО', id: 'HATI-HATI' },
  prohibition: { en: 'PROHIBITION: DO NOT', es: 'PROHIBICIÓN', fr: 'INTERDICTION', pt: 'PROIBIÇÃO', zh: '禁止', hi: 'निषेध', ar: 'ممنوع', bn: 'নিষেধ', ru: 'ЗАПРЕЩЕНО', id: 'DILARANG' },
  hazard_warning: { en: 'HAZARD WARNING', es: 'ADVERTENCIA DE PELIGRO', fr: 'AVERTISSEMENT DE DANGER', pt: 'ADVERTÊNCIA DE PERIGO', zh: '危险警告', hi: 'खतरे की चेतावनी', ar: 'تحذير من خطر', bn: 'বিপদের সতর্কতা', ru: 'ПРЕДУПРЕЖДЕНИЕ ОБ ОПАСНОСТИ', id: 'PERINGATAN BAHAYA' },
  safe: { en: 'SAFE CONDITION', es: 'CONDICIÓN SEGURA', fr: 'CONDITION SÛRE', pt: 'CONDIÇÃO SEGURA', zh: '安全状态', hi: 'सुरक्षित स्थिति', ar: 'حالة آمنة', bn: 'নিরাপদ অবস্থা', ru: 'БЕЗОПАСНОЕ СОСТОЯНИЕ', id: 'KONDISI AMAN' },
  safety_instructions: { en: 'SAFETY INSTRUCTIONS', es: 'INSTRUCCIONES DE SEGURIDAD', fr: 'CONSIGNES DE SÉCURITÉ', pt: 'INSTRUÇÕES DE SEGURANÇA', zh: '安全须知', hi: 'सुरक्षा निर्देश', ar: 'تعليمات السلامة', bn: 'নিরাপত্তা নির্দেশনা', ru: 'УКАЗАНИЯ ПО БЕЗОПАСНОСТИ', id: 'PETUNJUK KESELAMATAN' }
};

const STANDARDS = {
  ANSI: {
    id: 'ANSI', country: t('United States', 'Estados Unidos'),
    name: t('ANSI Z535 and OSHA 29 CFR 1910.145', 'ANSI Z535 y OSHA 29 CFR 1910.145'),
    url: 'https://www.govinfo.gov/content/pkg/CFR-2018-title29-vol5/pdf/CFR-2018-title29-vol5-sec1910-145.pdf',
    levels: { red: ['danger', 'red'], warning: ['warning', 'orange'], yellow: ['caution', 'yellow'], green: ['safety_instructions', 'green'] },
    hasWarning: true
  },
  NOM026: {
    id: 'NOM026', country: t('Mexico', 'México'),
    name: t('NOM-026-STPS-2008 (safety colours and signs)', 'NOM-026-STPS-2008 (colores y señales de seguridad)'),
    url: 'https://www.gob.mx/cms/uploads/attachment/file/807422/GUIA_INFORMATIVA_NOM-026.pdf',
    levels: { red: ['prohibition', 'red'], yellow: ['hazard_warning', 'yellow'], green: ['safe', 'green'] },
    hasWarning: false
  },
  EU: {
    id: 'EU', country: t('European Union and United Kingdom', 'Unión Europea y Reino Unido'),
    name: t('Directive 92/58/EEC (UK: Safety Signs and Signals Regulations 1996)', 'Directiva 92/58/CEE (Reino Unido: Safety Signs and Signals Regulations 1996)'),
    url: 'https://gov.uk/government/publications/mgn-556-mf-amendment-2-safety-signs-and-signals-regulations-2001/annex-1-text-to-the-annexes-to-council-directive-9258ec',
    levels: { red: ['danger', 'red'], yellow: ['warning', 'yellow'], green: ['safe', 'green'] },
    hasWarning: false
  },
  ISO: {
    id: 'ISO', country: t('International (other countries)', 'Internacional (otros países)'),
    name: t('ISO 3864-1 colours and ISO 3864-2 signal words', 'ISO 3864-1 (colores) e ISO 3864-2 (palabras de señal)'),
    url: 'https://en.wikipedia.org/wiki/ISO_3864',
    levels: { red: ['danger', 'red'], warning: ['warning', 'orange'], yellow: ['caution', 'yellow'], green: ['safe', 'green'] },
    hasWarning: true
  }
};

const EU_COUNTRIES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB'];

function standardFor(country) {
  const c = String(country || '').toUpperCase();
  if (c === 'US') return STANDARDS.ANSI;
  if (c === 'MX') return STANDARDS.NOM026;
  if (EU_COUNTRIES.includes(c)) return STANDARDS.EU;
  return STANDARDS.ISO;
}

// Signs at a yellow tier that could cause death or serious injury.
const SERIOUS = new Set([
  'decomposing_sargassum', 'rotten_egg_odor_h2s', 'fuel_odor', 'symptoms_reported',
  'crack_at_railing_anchor', 'rust_from_embedded_steel', 'crack_wider_3mm', 'crack_growing', 'someone_fell_or_tripped',
  'immediate_danger', 'someone_hurt', 'category_flooding', 'category_water_leak'
]);

function display(tier, flags, country) {
  const std = standardFor(country);
  let key = tier === 'red' ? 'red' : tier === 'green' ? 'green' : 'yellow';
  if (key === 'yellow' && std.hasWarning && (flags || []).some(f => SERIOUS.has(f))) key = 'warning';
  const [word, color] = std.levels[key];
  return {
    tier, level: key, color, word: WORDS[word], wordKey: word, bg: COLORS[color].bg, fg: COLORS[color].fg,
    standard: { id: std.id, name: std.name, url: std.url, country: std.country }
  };
}

function forIncident(inc) {
  const a = inc.assessment || {};
  const country = (inc.answers && inc.answers.country) || (inc.location && inc.location.country) || '';
  return display(a.tier, a.flags, country);
}

module.exports = { STANDARDS, WORDS, COLORS, SERIOUS, EU_COUNTRIES, standardFor, display, forIncident };
