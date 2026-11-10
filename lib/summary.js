'use strict';
// One-page case summary in plain language, in any of the 10 app languages.
// Headings and safety steps are pre-written in all 10 languages. Case-specific
// text is written in English and Spanish; for the other 8 languages it is
// machine translated when an AI key is set, and the summary says so.

const content = require('./content');

const HEAD = {
  en: { laws: 'Laws that apply, by level', why: 'Why', watch: 'Deadlines and documents', risk: 'Safety level', happened: 'What happened', todo: 'What to do now', responsible: 'Who is responsible', contacts: 'Who to contact', reports: 'Reports sent', cost: 'Approximate repair cost', fund: 'Community fund', evidence: 'Evidence', next: 'Next steps', generated: 'Summary generated', none: 'None yet', tier: { green: 'Green', yellow: 'Yellow', red: 'Red' } },
  es: { laws: 'Leyes que aplican, por nivel', why: 'Por qué', watch: 'Plazos y documentos', risk: 'Nivel de seguridad', happened: 'Qué pasó', todo: 'Qué hacer ahora', responsible: 'Quién es responsable', contacts: 'A quién contactar', reports: 'Reportes enviados', cost: 'Costo aproximado de reparación', fund: 'Fondo comunitario', evidence: 'Evidencia', next: 'Próximos pasos', generated: 'Resumen generado', none: 'Ninguno todavía', tier: { green: 'Verde', yellow: 'Amarillo', red: 'Rojo' } },
  fr: { laws: 'Lois applicables, par niveau', why: 'Pourquoi', watch: 'Délais et documents', risk: 'Niveau de sécurité', happened: "Ce qui s'est passé", todo: 'Que faire maintenant', responsible: 'Qui est responsable', contacts: 'Qui contacter', reports: 'Signalements envoyés', cost: 'Coût approximatif de réparation', fund: 'Fonds communautaire', evidence: 'Preuves', next: 'Prochaines étapes', generated: 'Résumé généré', none: 'Aucun pour le moment', tier: { green: 'Vert', yellow: 'Jaune', red: 'Rouge' } },
  pt: { laws: 'Leis aplicáveis, por nível', why: 'Por quê', watch: 'Prazos e documentos', risk: 'Nível de segurança', happened: 'O que aconteceu', todo: 'O que fazer agora', responsible: 'Quem é responsável', contacts: 'Quem contatar', reports: 'Relatos enviados', cost: 'Custo aproximado de reparo', fund: 'Fundo comunitário', evidence: 'Evidências', next: 'Próximos passos', generated: 'Resumo gerado', none: 'Nenhum ainda', tier: { green: 'Verde', yellow: 'Amarelo', red: 'Vermelho' } },
  zh: { laws: '适用的法律（按层级）', why: '原因', watch: '期限和文件', risk: '安全等级', happened: '发生了什么', todo: '现在该做什么', responsible: '谁应负责', contacts: '联系谁', reports: '已发送的报告', cost: '大致维修费用', fund: '社区基金', evidence: '证据', next: '下一步', generated: '摘要生成时间', none: '暂无', tier: { green: '绿色', yellow: '黄色', red: '红色' } },
  hi: { laws: 'लागू कानून, स्तर के अनुसार', why: 'क्यों', watch: 'समय-सीमा और दस्तावेज़', risk: 'सुरक्षा स्तर', happened: 'क्या हुआ', todo: 'अभी क्या करें', responsible: 'कौन ज़िम्मेदार है', contacts: 'किससे संपर्क करें', reports: 'भेजी गई रिपोर्टें', cost: 'मरम्मत की अनुमानित लागत', fund: 'सामुदायिक कोष', evidence: 'सबूत', next: 'अगले कदम', generated: 'सारांश बनाया गया', none: 'अभी कोई नहीं', tier: { green: 'हरा', yellow: 'पीला', red: 'लाल' } },
  ar: { laws: 'القوانين المطبقة حسب المستوى', why: 'لماذا', watch: 'المواعيد والوثائق', risk: 'مستوى السلامة', happened: 'ماذا حدث', todo: 'ماذا تفعل الآن', responsible: 'من المسؤول', contacts: 'بمن تتصل', reports: 'البلاغات المرسلة', cost: 'التكلفة التقريبية للإصلاح', fund: 'صندوق المجتمع', evidence: 'الأدلة', next: 'الخطوات التالية', generated: 'تاريخ إنشاء الملخص', none: 'لا شيء بعد', tier: { green: 'أخضر', yellow: 'أصفر', red: 'أحمر' } },
  bn: { laws: 'প্রযোজ্য আইন, স্তর অনুযায়ী', why: 'কেন', watch: 'সময়সীমা ও নথি', risk: 'নিরাপত্তার স্তর', happened: 'কী ঘটেছে', todo: 'এখন কী করবেন', responsible: 'কে দায়ী', contacts: 'কার সাথে যোগাযোগ করবেন', reports: 'পাঠানো রিপোর্ট', cost: 'আনুমানিক মেরামত খরচ', fund: 'কমিউনিটি তহবিল', evidence: 'প্রমাণ', next: 'পরবর্তী পদক্ষেপ', generated: 'সারাংশ তৈরি', none: 'এখনো কিছু নেই', tier: { green: 'সবুজ', yellow: 'হলুদ', red: 'লাল' } },
  ru: { laws: 'Применимые законы по уровням', why: 'Почему', watch: 'Сроки и документы', risk: 'Уровень безопасности', happened: 'Что случилось', todo: 'Что делать сейчас', responsible: 'Кто отвечает', contacts: 'Куда обращаться', reports: 'Отправленные сообщения', cost: 'Примерная стоимость ремонта', fund: 'Фонд сообщества', evidence: 'Доказательства', next: 'Следующие шаги', generated: 'Сводка создана', none: 'Пока нет', tier: { green: 'Зелёный', yellow: 'Жёлтый', red: 'Красный' } },
  id: { laws: 'Hukum yang berlaku, menurut tingkat', why: 'Mengapa', watch: 'Tenggat dan dokumen', risk: 'Tingkat keamanan', happened: 'Apa yang terjadi', todo: 'Apa yang harus dilakukan sekarang', responsible: 'Siapa yang bertanggung jawab', contacts: 'Siapa yang dihubungi', reports: 'Laporan terkirim', cost: 'Perkiraan biaya perbaikan', fund: 'Dana komunitas', evidence: 'Bukti', next: 'Langkah berikutnya', generated: 'Ringkasan dibuat', none: 'Belum ada', tier: { green: 'Hijau', yellow: 'Kuning', red: 'Merah' } }
};

const LANGS = Object.keys(HEAD);

function money(n, cur, lang) {
  try { return new Intl.NumberFormat(lang === 'es' ? 'es-MX' : lang, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); } catch (_) { return `${Math.round(n)} ${cur}`; }
}

function T(o, base) { return o ? (o[base] || o.en || '') : ''; }

const TXT = {
  photos: ['{n} photo(s) with SHA-256 fingerprints', '{n} foto(s) con huella digital SHA-256'],
  chainOk: ['Record intact (linked entries: {n})', 'Registro íntegro (entradas enlazadas: {n})'],
  chainBad: ['Warning: the record was altered', 'Alerta: el registro fue alterado'],
  sent: ['Sent {date} by {method}', 'Enviado el {date} por {method}'],
  followUp: ['next follow-up {date}: {label}', 'próximo seguimiento {date}: {label}'],
  status: { sent: ['waiting for answer', 'en espera de respuesta'], answered: ['answered', 'respondieron'], resolved: ['resolved', 'resuelto'], no_answer: ['no answer', 'sin respuesta'] },
  fund: ['Raised {raised}, paid {paid}, available {available}. {done} of {total} milestones paid.', 'Recaudado {raised}, pagado {paid}, disponible {available}. {done} de {total} etapas pagadas.'],
  costLine: ['Likely range {low} to {high}', 'Rango probable de {low} a {high}'],
  costWho: ['If it is a construction defect, the builder pays; otherwise the party with the repair duty (association or landlord), not an individual resident.', 'Si es un defecto de construcción, paga la constructora; si no, quien tiene la obligación de reparar (asociación o arrendador), no un residente en lo individual.'],
  measured: ['Crack measured {n} time(s); latest {mm} mm', 'Grieta medida {n} vez(ces); última {mm} mm'],
  growing: ['The crack is growing.', 'La grieta está creciendo.'],
  nextFirst: ['Send the first report to: {name}.', 'Envía el primer reporte a: {name}.'],
  nextFollow: ['Follow up with {name}: {label} ({date}).', 'Da seguimiento a {name}: {label} ({date}).'],
  nextMeasure: ['Measure the widest point of the crack with a coin or ruler and save it.', 'Mide la parte más ancha de la grieta con una moneda o regla y guárdala.'],
  nextFund: ['Open the fund: share it with neighbors or ask a sponsor.', 'Abre el fondo: compártelo con los vecinos o pide a un patrocinador.'],
  nextEmergency: ['Someone may be in danger: call emergency services first.', 'Alguien puede estar en peligro: llama primero a emergencias.'],
  nextWait: ['Wait for answers and keep documenting with dated photos.', 'Espera respuestas y sigue documentando con fotos fechadas.'],
  level: { international: ['International', 'Internacional'], national: ['National', 'Nacional'], state: ['State or province', 'Estado o provincia'], local: ['Local', 'Local'] },
  notVerified: ['{level}: the app has not verified the rules for {place} yet. Ask the local authority.', '{level}: la app aún no ha verificado las reglas de {place}. Consulte a la autoridad local.'],
  placeUnknown: ['{level}: place not identified. Add the state and city to the place to see these rules.', '{level}: lugar no identificado. Agregue el estado y la ciudad al lugar para ver estas reglas.'],
  answerType: {
    warranty_denied: ['answer: the warranty expired / the builder will not pay', 'respuesta: la garantía venció / la constructora no pagará'],
    self_repair: ['answer: the association will repair it directly', 'respuesta: la asociación lo reparará directamente'],
    will_inspect: ['answer: they will inspect it', 'respuesta: lo van a inspeccionar'],
    other: ['answer recorded', 'respuesta registrada']
  },
  nextReplyAnswer: ['Reply to the answer: an expired written warranty does not by itself end the builder\'s responsibility; ask for a licensed engineer to document the cause before any repair, and for a copy of the builder\'s written statement.', 'Responda a la respuesta: que venza la garantía escrita no termina por sí solo la responsabilidad de la constructora; pida que un ingeniero con licencia documente la causa antes de reparar, y una copia de lo que escribió la constructora.'],
  nextCh27: ['An email does not replace the Texas Chapter 27 notice: to keep the option of a claim, send the builder notice by certified mail, return receipt requested (talk to a lawyer first).', 'Un correo no reemplaza el aviso del capítulo 27 de Texas: para conservar la opción de reclamar, envíe el aviso a la constructora por correo certificado con acuse de recibo (consulte antes a un abogado).'],
  disclaimer: ['Prepared with Comunidad Fuerte. General information, not legal or medical advice.', 'Preparado con Comunidad Fuerte. Información general, no asesoría legal ni médica.']
};

function tx(key, base, vars) {
  const pair = key.split('.').reduce((o, k) => o[k], TXT);
  let s = pair[base === 'es' ? 1 : 0];
  for (const [k, v] of Object.entries(vars || {})) s = s.split('{' + k + '}').join(String(v));
  return s;
}

const METHOD = {
  certified_mail: ['certified mail', 'correo certificado'], email_and_mail: ['email and letter', 'correo electrónico y carta'], written_notice: ['written notice', 'aviso por escrito'],
  austin_311: ['Austin 3-1-1', '3-1-1 de Austin'], phone: ['phone', 'teléfono'], official_channel: ['official channel', 'canal oficial'], email: ['email', 'correo electrónico']
};

// Builds the summary. `base` is 'en' or 'es' (case text); `lang` is the
// requested language for headings and protocol steps.
function build({ inc, targets, resp, sent, cost, fund, chain, lang, base, legal }) {
  const h = HEAD[lang] || HEAD.en;
  const a = inc.assessment;
  const infra = inc.domain === 'infrastructure';
  const community = inc.domain === 'community';
  const protoSet = infra ? content.PROTOCOLS_INFRA : community ? content.PROTOCOLS_COMMUNITY : content.PROTOCOLS;
  let proto = (protoSet[lang] || protoSet[base] || protoSet.en)[a.tier];
  if (community) {
    const special = (content.SPECIAL_STEPS[lang] || content.SPECIAL_STEPS.en)[inc.answers.category];
    if (special) proto = { ...proto, steps: [special, ...proto.steps] };
  }
  const label = content.TYPE_LABELS[a.type] || content.TYPE_LABELS.unknown;
  const today = new Date().toISOString().slice(0, 10);

  const sections = [];
  const hz = require('./hazard').forIncident(inc);
  sections.push({ id: 'risk', title: h.risk, tier: a.tier, hazard: hz, text: `${hz.word[lang] || hz.word.en}: ${proto.title}`, items: [`${hz.standard.name[base]} · ${hz.standard.country[base]}`], fixed: true });
  const happened = [T(a.reasoning, base)];
  if (inc.answers.description) happened.push(inc.answers.description);
  sections.push({ id: 'happened', title: h.happened, items: happened });
  sections.push({ id: 'todo', title: h.todo, items: proto.steps, fixed: true });

  const v = resp && resp.verdict;
  if (v) {
    sections.push({ id: 'who', title: h.responsible, items: [T(v.pays, base), T(v.acts, base)] });
    if (v.reasons.length) sections.push({ id: 'why', title: h.why, items: v.reasons.map(r => T(r, base)) });
    sections.push({ id: 'watch', title: h.watch, items: v.cautions.map(c => T(c, base)).concat(v.basis.map(b => b.title + ': ' + b.url)) });
  }
  sections.push({
    id: v ? 'contacts' : 'who', title: infra && !v ? h.responsible : h.contacts,
    items: targets.length ? targets.map(t => `${T(t.name, base)}${t.tel ? ' (' + t.tel + ')' : ''}: ${T(t.why, base)}${t.contact ? ' ' + T(t.contact, base) : ''}`) : [h.none]
  });

  if (legal) {
    const items = [];
    for (const L of legal.layers) {
      const lvl = tx('level.' + L.level, base);
      const place = L.places.map(p => T(p.name, base)).join(', ');
      if (L.coverage === 'covered') for (const r of L.rules) items.push(`${lvl}${place ? ' · ' + place : ''}: ${r.title}. ${r.facts.map(f => T(f, base)).join(' ')}`);
      else if (L.coverage === 'not_verified') items.push(tx('notVerified', base, { level: lvl, place }));
      else if (L.coverage === 'place_unknown' && L.level !== 'international') items.push(tx('placeUnknown', base, { level: lvl }));
    }
    if (items.length) sections.push({ id: 'laws', title: h.laws, items });
  }

  const reportItems = sent.map(r => {
    const next = (r.followUps || []).find(f => f.date >= today);
    let s = `${r.targetName} — ${tx('sent', base, { date: r.sentAt, method: (METHOD[r.method] || [r.method, r.method])[base === 'es' ? 1 : 0] })} (${tx('status.' + (r.status || 'sent'), base)})`;
    if (next && r.status === 'sent') s += '; ' + tx('followUp', base, { date: next.date, label: T(next.label, base) });
    if (r.status === 'answered' && r.responseType) s += ' — ' + tx('answerType.' + r.responseType, base) + (r.responder ? ` (${r.responder})` : '');
    return s;
  });
  sections.push({ id: 'reports', title: h.reports, items: reportItems.length ? reportItems : [h.none] });

  if (infra && cost) {
    const items = [tx('costLine', base, { low: money(cost.lowUsd, 'USD', base), high: money(cost.highUsd, 'USD', base) }) + (cost.currency !== 'USD' ? ` (${money(cost.lowLocal, cost.currency, base)} – ${money(cost.highLocal, cost.currency, base)})` : ''), tx('costWho', base)];
    sections.push({ id: 'cost', title: h.cost, items });
  }

  const ms = (inc.plan && inc.plan.milestones) || [];
  sections.push({ id: 'fund', title: h.fund, items: [tx('fund', base, { raised: money(fund.raised, 'USD', base), paid: money(fund.paid, 'USD', base), available: money(fund.available, 'USD', base), done: ms.filter(m => m.status === 'paid').length, total: ms.length })] });

  const ev = [tx('photos', base, { n: (inc.photos || []).length + (inc.monitoring || []).filter(m => m.photo).length }), chain.ok ? tx('chainOk', base, { n: chain.total }) : tx('chainBad', base)];
  const mon = inc.monitoring || [];
  if (mon.length) {
    ev.push(tx('measured', base, { n: mon.length, mm: mon[mon.length - 1].widthMm }));
    if (inc.answers.crackGrowing) ev.push(tx('growing', base));
  }
  ev.push(`ID: ${inc.id}`);
  sections.push({ id: 'evidence', title: h.evidence, items: ev });

  const next = [];
  if (a.emergency) next.push(tx('nextEmergency', base));
  const reportable = targets.filter(t => t.kind !== 'phone' && t.kind !== 'info');
  const sentIds = new Set(sent.map(r => r.targetId));
  const firstUnsent = reportable.find(t => !sentIds.has(t.id));
  if (!sent.length && firstUnsent) next.push(tx('nextFirst', base, { name: T(firstUnsent.name, base) }));
  for (const r of sent) {
    const due = (r.followUps || []).find(f => f.date <= today);
    if (r.status === 'sent' && due) next.push(tx('nextFollow', base, { name: r.targetName, label: T(due.label, base), date: due.date }));
  }
  if (sent.length && firstUnsent && next.length < 3) next.push(tx('nextFirst', base, { name: T(firstUnsent.name, base) }));
  if (sent.some(r => r.status === 'answered' && ['warranty_denied', 'self_repair'].includes(r.responseType))) next.unshift(tx('nextReplyAnswer', base));
  const txState = inc.answers && (inc.answers.jurisdiction === 'US-TX' || /\b(tx|texas)\b/i.test(inc.answers.placeLabel || ''));
  if (infra && txState && sent.some(r => r.kind === 'builder') && !sent.some(r => r.kind === 'builder' && r.method === 'certified_mail')) next.push(tx('nextCh27', base));
  if (infra && !mon.length) next.push(tx('nextMeasure', base));
  if (fund.raised === 0 && ms.length) next.push(tx('nextFund', base));
  if (!next.length) next.push(tx('nextWait', base));
  sections.push({ id: 'next', title: h.next, items: next });

  return {
    lang, base,
    title: `${T(label, base)} — ${inc.answers.placeLabel || inc.id}`,
    generated: `${h.generated}: ${today}`,
    dir: (content.PROTOCOLS[lang] || {}).dir || 'ltr',
    sections,
    disclaimer: tx('disclaimer', base)
  };
}

module.exports = { build, LANGS, HEAD };
