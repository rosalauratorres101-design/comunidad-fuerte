'use strict';
// Formal reports and letters for the right institution. Each one carries the
// evidence reference and SHA-256 fingerprints so the recipient can verify the
// photos. Personal details are typed by the user and are not stored.

const content = require('./content');

const FLAG_TEXT = {
  crack_at_railing_anchor: ['a crack that starts at the base plate of the handrail post and runs through the step', 'una grieta que nace en la placa base del poste del barandal y atraviesa el escalón'],
  rust_from_embedded_steel: ['rust stains bleeding from the concrete, which may indicate corroding embedded steel', 'manchas de óxido que salen del concreto, lo que puede indicar acero interno en corrosión'],
  gap_or_trip_hazard: ['an open gap or uneven joint between steps (trip hazard and water entry)', 'una separación abierta o junta desnivelada entre escalones (riesgo de tropiezo y entrada de agua)'],
  water_entering_structure: ['water entering the structure', 'entrada de agua a la estructura'],
  crack_1_to_3mm: ['crack width of about 1 to 3 mm', 'ancho de grieta de aproximadamente 1 a 3 mm'],
  crack_wider_3mm: ['crack width greater than 3 mm', 'ancho de grieta mayor de 3 mm'],
  railing_moves: ['a handrail that moves or is loose', 'un barandal que se mueve o está flojo'],
  pieces_falling: ['concrete pieces breaking off', 'pedazos de concreto que se desprenden'],
  someone_fell_or_tripped: ['a person has already tripped or fallen', 'una persona ya tropezó o se cayó'],
  serious_injury: ['a person was seriously injured', 'una persona resultó gravemente lesionada'],
  crack_growing: ['the crack has grown between dated photos', 'la grieta creció entre fotos fechadas']
};

const TIER = { green: ['Green (cosmetic)', 'Verde (superficial)'], yellow: ['Yellow (use with caution)', 'Amarillo (usar con precaución)'], red: ['Red (do not use)', 'Rojo (no usar)'] };
const TIER_COMMUNITY = { green: ['Green (not urgent)', 'Verde (no urgente)'], yellow: ['Yellow (take care, report today)', 'Amarillo (precaución, reportar hoy)'], red: ['Red (danger)', 'Rojo (peligro)'] };
function tierText(inc, lang) { return (inc.domain === 'community' ? TIER_COMMUNITY : TIER)[inc.assessment.tier][L(lang)]; }

function L(lang) { return lang === 'es' ? 1 : 0; }

function dateStr(d, lang) {
  return new Date(d).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function defects(inc, lang) {
  const i = L(lang);
  if (inc.domain === 'community') {
    const label = (content.TYPE_LABELS[inc.assessment.type] || content.TYPE_LABELS.unknown)[lang === 'es' ? 'es' : 'en'];
    const list = [label];
    if (inc.answers.urgency === 'immediate') list.push(lang === 'es' ? 'representa un peligro inmediato' : 'it is an immediate danger');
    if (inc.answers.injuries === 'minor' || inc.answers.injuries === 'serious') list.push(lang === 'es' ? 'una persona ya resultó lastimada' : 'a person has already been hurt');
    if (inc.answers.hazardous === 'yes') list.push(lang === 'es' ? 'puede incluir residuos peligrosos (envases, químicos)' : 'it may include hazardous waste (containers, chemicals)');
    if (inc.answers.description) list.push((lang === 'es' ? 'Descripción del residente: ' : 'Resident description: ') + inc.answers.description);
    return list;
  }
  const list = (inc.assessment.flags || []).filter(f => FLAG_TEXT[f]).map(f => FLAG_TEXT[f][i]);
  if (inc.answers.description) list.push((lang === 'es' ? 'Descripción del residente: ' : 'Resident description: ') + inc.answers.description);
  return list;
}

function evidenceBlock(inc, lang) {
  const es = lang === 'es';
  const photos = [...(inc.photos || []), ...((inc.monitoring || []).map(m => m.photo).filter(Boolean))];
  const lines = photos.map((p, n) => `  ${n + 1}. ${dateStr(p.at, lang)} — SHA-256 ${p.sha256}`);
  const mon = (inc.monitoring || []).filter(m => m.widthMm).map(m => `  - ${dateStr(m.at, lang)}: ${m.widthMm} mm`);
  return [
    es ? `Expediente de evidencia: ${inc.id}` : `Evidence file: ${inc.id}`,
    es ? `Fotos adjuntas (${photos.length}), con huella digital para verificar que no fueron alteradas:` : `Attached photos (${photos.length}), with fingerprints to verify they were not altered:`,
    ...lines,
    ...(mon.length ? [es ? 'Seguimiento del ancho de la grieta:' : 'Crack width tracking:', ...mon] : [])
  ].join('\n');
}

function signature(sender, lang) {
  const es = lang === 'es';
  return [
    es ? 'Atentamente,' : 'Sincerely,',
    '',
    sender.name || (es ? '[Tu nombre]' : '[Your name]'),
    sender.unit || (es ? '[Unidad / domicilio]' : '[Unit / address]'),
    sender.contact || (es ? '[Teléfono o correo]' : '[Phone or email]')
  ].join('\n');
}

const FOOT = ['Prepared with Comunidad Fuerte. This is not legal advice.', 'Preparado con Comunidad Fuerte. No es asesoría legal.'];

function placeOf(inc, lang) {
  return inc.answers.placeLabel || (lang === 'es' ? '[dirección de la propiedad]' : '[property address]');
}

function bullets(arr) { return arr.map(x => `  - ${x}`).join('\n'); }

// --- Letter builders -------------------------------------------------------
// Facts that point to a construction defect, stated as the resident reported them.
function history(inc, lang) {
  const a = inc.answers || {};
  const es = lang === 'es';
  const out = [];
  if (a.builderPatched === 'yes') out.push(es ? 'La constructora ya parchó esta zona anteriormente y el daño volvió a aparecer.' : 'The builder previously patched this area, and the damage has returned.');
  if (a.sameDefectElsewhere === 'same_hoa') out.push(es ? 'Otro edificio de este mismo condominio, construido por la misma constructora, presenta las mismas condiciones.' : 'Another building in this same condominium, built by the same builder, shows the same conditions.');
  if (a.sameDefectElsewhere === 'other_hoa') out.push(es ? 'Otro edificio de la misma constructora presenta las mismas condiciones.' : 'Another building by the same builder shows the same conditions.');
  if (a.builtYear) out.push(es ? `El edificio se terminó alrededor de ${a.builtYear}.` : `The building was completed around ${a.builtYear}.`);
  return out;
}

function association(inc, lang, sender, recipient) {
  const es = lang === 'es';
  const today = dateStr(Date.now(), lang);
  const place = placeOf(inc, lang);
  const to = recipient.name || (es ? 'Mesa directiva y administración de la asociación' : 'Board of Directors and Management of the Association');
  const tier = TIER[inc.assessment.tier][L(lang)];
  const subject = es
    ? `Asunto: Condición insegura en área común (${place}) y solicitud de reclamo al constructor`
    : `Subject: Unsafe condition in a common element (${place}) and request to notify the builder`;
  const body = es ? `${today}

${to}

${subject}

Por medio de la presente notifico por escrito una condición insegura en un área común: ${place}.

Condiciones observadas:
${bullets(defects(inc, lang))}

${history(inc, lang).length ? 'Antecedentes:\n' + bullets(history(inc, lang)) + '\n\n' : ''}Evaluación de seguridad inicial: ${tier}.

Solicito respetuosamente:
  1. Medidas de seguridad inmediatas: señalizar la zona y que un profesional revise el anclaje del barandal.
  2. Una inspección por un ingeniero profesional con licencia para determinar la causa y la reparación.
  3. Que la asociación notifique al constructor o desarrollador bajo la garantía aplicable y el capítulo 27 del Código de Propiedad de Texas, si la causa es un defecto de construcción.
  4. Copia de: la declaración del condominio, la garantía del constructor para las áreas comunes, los registros de reparaciones previas de esta escalera y la lista actual de integrantes de la mesa directiva, indicando si el declarante aún controla la mesa.
  5. Una respuesta por escrito en un plazo de 10 días hábiles con las medidas y fechas previstas.${inc.answers && inc.answers.sameDefectElsewhere === 'same_hoa' ? '\n  6. Que la inspección, el aviso y el reclamo al constructor incluyan también el otro edificio con las mismas condiciones, y que el aviso se envíe pronto para no perder plazos legales.' : ''}

${evidenceBlock(inc, lang)}

${signature(sender, lang)}

${FOOT[1]}` : `${today}

${to}

${subject}

This letter gives written notice of an unsafe condition in a common element: ${place}.

Conditions observed:
${bullets(defects(inc, lang))}

${history(inc, lang).length ? 'Background:\n' + bullets(history(inc, lang)) + '\n\n' : ''}Initial safety assessment: ${tier}.

I respectfully request:
  1. Immediate safety measures: mark the area and have a professional check the handrail anchorage.
  2. An inspection by a licensed professional engineer to determine the cause and the repair.
  3. That the Association notify the builder or developer under the applicable warranty and Chapter 27 of the Texas Property Code, if the cause is a construction defect.
  4. Copies of: the condominium declaration, the builder's warranty for the common elements, records of prior repairs to these stairs, and the current list of board members, stating whether the declarant still controls the board.
  5. A written response within 10 business days with the planned measures and dates.${inc.answers && inc.answers.sameDefectElsewhere === 'same_hoa' ? '\n  6. That the inspection, the notice and the claim to the builder also cover the other building with the same conditions, and that notice be sent promptly so legal deadlines are not lost.' : ''}

${evidenceBlock(inc, lang)}

${signature(sender, lang)}

${FOOT[0]}`;
  return { subject, body };
}

function builder(inc, lang, sender, recipient) {
  const es = lang === 'es';
  const today = dateStr(Date.now(), lang);
  const place = placeOf(inc, lang);
  const to = recipient.name || (es ? '[Nombre legal de la constructora o desarrolladora]' : '[Legal name of the builder or developer]');
  const subject = es
    ? `Asunto: Aviso de defectos de construcción, Código de Propiedad de Texas § 27.004 — ${place}`
    : `Subject: Notice of Construction Defects under Texas Property Code § 27.004 — ${place}`;
  const body = es ? `${today}
ENVIADO POR CORREO CERTIFICADO CON ACUSE DE RECIBO

${to}

${subject}

Por medio de la presente, y conforme al capítulo 27 del Código de Propiedad de Texas, notifico los siguientes defectos de construcción en ${place}:

${bullets(defects(inc, lang))}

${history(inc, lang).length ? 'Antecedentes:\n' + bullets(history(inc, lang)) + '\n\n' : ''}Fecha en que se documentó la condición: ${dateStr(inc.createdAt, lang)}.

Este aviso describe los defectos con el detalle disponible. Pueden solicitar la inspección de la propiedad dentro del plazo que establece la ley y enviar por escrito su propuesta para corregir los defectos. Coordinen el acceso con la asociación de condóminos, responsable de las áreas comunes.

Solicito además copia de cualquier garantía escrita que cubra estas áreas y de los registros de las reparaciones anteriores.

Este aviso no renuncia a ningún derecho ni recurso.

${evidenceBlock(inc, lang)}

${signature(sender, lang)}
c.c. Asociación de condóminos

${FOOT[1]}` : `${today}
SENT BY CERTIFIED MAIL, RETURN RECEIPT REQUESTED

${to}

${subject}

Under Chapter 27 of the Texas Property Code, this letter gives notice of the following construction defects at ${place}:

${bullets(defects(inc, lang))}

${history(inc, lang).length ? 'Background:\n' + bullets(history(inc, lang)) + '\n\n' : ''}Date the condition was documented: ${dateStr(inc.createdAt, lang)}.

This notice describes the defects in the detail currently available. You may request to inspect the property within the period set by statute and send a written proposal to correct the defects. Please coordinate access with the condominium association, which is responsible for the common elements.

I also request a copy of any written warranty covering these areas and the records of the earlier repairs.

This notice does not waive any rights or remedies.

${evidenceBlock(inc, lang)}

${signature(sender, lang)}
cc: Condominium Association

${FOOT[0]}`;
  return { subject, body };
}

function landlord(inc, lang, sender, recipient) {
  const es = lang === 'es';
  const today = dateStr(Date.now(), lang);
  const place = placeOf(inc, lang);
  const to = recipient.name || (es ? '[Arrendador o administradora]' : '[Landlord or property manager]');
  const subject = es ? `Asunto: Solicitud de reparación por condición insegura — ${place}` : `Subject: Repair request for an unsafe condition — ${place}`;
  const body = es ? `${today}

${to}

${subject}

Solicito por escrito la reparación de una condición que afecta la seguridad física de los inquilinos en ${place}:

${bullets(defects(inc, lang))}

Estoy al corriente en el pago de la renta. Conforme al § 92.052 del Código de Propiedad de Texas, solicito que hagan un esfuerzo diligente por repararla y que me informen por escrito la fecha prevista.

${evidenceBlock(inc, lang)}

${signature(sender, lang)}

${FOOT[1]}` : `${today}

${to}

${subject}

I am requesting in writing the repair of a condition that affects the physical safety of tenants at ${place}:

${bullets(defects(inc, lang))}

I am current on rent. Under Texas Property Code § 92.052, I ask that you make a diligent effort to repair it and tell me in writing when the repair is planned.

${evidenceBlock(inc, lang)}

${signature(sender, lang)}

${FOOT[0]}`;
  return { subject, body };
}

function city(inc, lang) {
  const es = lang === 'es';
  const place = placeOf(inc, lang);
  const label = (content.TYPE_LABELS[inc.assessment.type] || content.TYPE_LABELS.unknown)[es ? 'es' : 'en'];
  const subject = inc.domain === 'community' ? (es ? `Reporte: ${label}` : `Report: ${label}`) : (es ? 'Reporte: escalera o barandal inseguro' : 'Report: unsafe stairs or handrail');
  const ask = inc.domain === 'community' ? (es ? 'Solicito que lo atiendan y me compartan el número de seguimiento.' : 'Requesting service and a tracking number.') : (es ? 'Solicito una inspección.' : 'Requesting an inspection.');
  const body = es
    ? `Ubicación: ${place}\nProblema: ${defects(inc, lang).join('; ').replace(/\.$/, '')}.\nNivel de seguridad: ${tierText(inc, lang)}.\nDocumentado desde: ${dateStr(inc.createdAt, lang)}. Hay fotos fechadas disponibles (expediente ${inc.id}).\n${ask}`
    : `Location: ${place}\nIssue: ${defects(inc, lang).join('; ').replace(/\.$/, '')}.\nSafety level: ${tierText(inc, lang)}.\nDocumented since: ${dateStr(inc.createdAt, lang)}. Dated photos available (evidence file ${inc.id}).\n${ask}`;
  return { subject, body };
}

const BUILDERS = { association, builder, landlord, city };

function build(kind, inc, lang, sender, recipient) {
  const fn = BUILDERS[kind];
  if (!fn) throw new Error('Unknown report type.');
  return fn(inc, lang === 'es' ? 'es' : 'en', sender || {}, recipient || {});
}

// How each report is sent, and the follow-up dates it starts.
const CHANNELS = {
  association: { method: 'email_and_mail', followUps: [{ days: 14, label: ['Expect a written reply (10 business days requested)', 'Esperar respuesta por escrito (10 días hábiles solicitados)'] }] },
  builder: { method: 'certified_mail', followUps: [
    { days: 35, label: ['Builder inspection window ends (Ch. 27)', 'Termina el plazo de inspección del constructor (cap. 27)'] },
    { days: 60, label: ['Builder settlement offer deadline; earliest date to file suit (Ch. 27)', 'Plazo para la oferta del constructor; fecha más temprana para demandar (cap. 27)'] }
  ] },
  landlord: { method: 'written_notice', followUps: [{ days: 7, label: ['Check on the repair; keep rent current', 'Revisar la reparación; mantener la renta al corriente'] }] },
  city: { method: 'austin_311', followUps: [{ days: 14, label: ['Check the status of the 3-1-1 case', 'Revisar el estado del caso en el 3-1-1'] }] },
  org: { method: 'email', followUps: [{ days: 7, label: ['Follow up if there is no answer', 'Dar seguimiento si no hay respuesta'] }] }
};

function followUps(kind, sentAt) {
  const c = CHANNELS[kind] || CHANNELS.org;
  return c.followUps.map(f => ({ date: new Date(new Date(sentAt).getTime() + f.days * 864e5).toISOString().slice(0, 10), label: { en: f.label[0], es: f.label[1] } }));
}

module.exports = { build, followUps, CHANNELS, defects };
