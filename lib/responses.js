'use strict';
// What an answer means, and how to reply.
//
// When the institution answers, the person records what kind of answer it was.
// Two answers are common and easy to misread:
//   - warranty_denied: "the warranty expired, the builder will not pay"
//   - self_repair:     "the association will repair it directly" (often without
//                      an engineer's report, which can erase the evidence)
// For each, the app explains in plain words what the answer does and does not
// mean, cites only rules verified for the place (Texas today; elsewhere it says
// the rules are not verified), and drafts a polite reply in English or Spanish.
// General information, not legal advice.

const jurisdiction = require('./jurisdiction');

const TYPES = ['warranty_denied', 'self_repair', 'will_inspect', 'other'];

const T = (en, es) => ({ en, es });

function isTexas(inc) {
  const w = jurisdiction.resolve(inc.answers);
  return w.state === 'US-TX';
}

function builtYear(inc) {
  const y = Number(inc.answers && inc.answers.builtYear);
  return y >= 1800 && y <= 2100 ? y : null;
}

// Plain-language points for one answer type.
function points(inc, type) {
  const tx = isTexas(inc);
  const year = builtYear(inc);
  const until = year ? year + 10 : null;
  const sameElsewhere = /same/.test(String(inc.answers && inc.answers.sameDefectElsewhere || ''));
  const boughtFromBuilder = (inc.answers && inc.answers.boughtFromBuilder) === 'yes';
  const out = [];
  const basis = [];
  if (type === 'warranty_denied' || type === 'self_repair') {
    out.push(T('The written warranty and the builder\'s legal responsibility are two different things. An expired written warranty does not, by itself, end the builder\'s responsibility for a construction defect.',
      'La garantía escrita y la responsabilidad legal de la constructora son cosas distintas. Que venza la garantía escrita no termina por sí solo la responsabilidad de la constructora por un defecto de construcción.'));
    if (tx) {
      out.push(until
        ? T(`In Texas, a claim for a construction defect can be brought up to 10 years after the building was completed. For a building completed in ${year}, that is until about ${until}.`, `En Texas, un reclamo por defecto de construcción puede presentarse hasta 10 años después de terminado el edificio. Para un edificio terminado en ${year}, eso es hasta más o menos ${until}.`)
        : T('In Texas, a claim for a construction defect can be brought up to 10 years after the building was completed.', 'En Texas, un reclamo por defecto de construcción puede presentarse hasta 10 años después de terminado el edificio.'));
      out.push(T('Texas also recognizes an implied warranty that a new home be safe to live in; in general a builder cannot remove it through its contract. Whether it applies to this damage is a question for a lawyer.',
        'Texas también reconoce una garantía implícita de que una vivienda nueva sea segura para vivir; en general la constructora no puede quitarla con su contrato. Si aplica a este daño lo decide un abogado.'));
      out.push(T('Shorter deadlines may already be running: generally 2 years for negligence and 4 years for contract or warranty claims, from when the damage was or should have been discovered.',
        'Puede haber plazos más cortos corriendo: en general 2 años por negligencia y 4 por contrato o garantía, desde que se descubrió o debió descubrirse el daño.'));
      basis.push('tx_16_009', 'tx_centex_buecher', 'tx_limits');
    } else {
      out.push(T('The app has not verified the rules for this place yet. Ask a local lawyer how long a builder remains responsible for construction defects here.',
        'La app aún no ha verificado las reglas de este lugar. Pregunte a un abogado local por cuánto tiempo responde una constructora por defectos de construcción aquí.'));
    }
    if (sameElsewhere) out.push(T('The same damage in another building by the same builder points to design or construction, not to wear or lack of upkeep.', 'El mismo daño en otro edificio de la misma constructora apunta al diseño o la construcción, no al uso ni a la falta de mantenimiento.'));
    if (boughtFromBuilder) out.push(T('You bought directly from the builder, so ask the builder to confirm its position to you in writing and to send the warranty document.', 'Usted compró directamente a la constructora: pídale que le confirme su postura por escrito y que le envíe el documento de garantía.'));
  }
  if (type === 'self_repair' || type === 'warranty_denied') {
    out.push(T('Before any repair, a licensed engineer should inspect the damage as it is now and document the cause. If it is patched first, the evidence disappears and the cost falls on all owners.',
      'Antes de cualquier reparación, un ingeniero con licencia debe revisar el daño tal como está y documentar la causa. Si primero lo parchan, la evidencia desaparece y el costo recae en todos los propietarios.'));
    out.push(T('Ask for dated photos, measurements and any removed parts to be kept.', 'Pida que se guarden fotos fechadas, medidas y las piezas que se retiren.'));
    if (tx && /condo|hoa/.test(String(inc.answers && inc.answers.propertyType || ''))) {
      out.push(T('For a Texas condominium association to claim against the builder, the law asks for an engineer\'s report, notice to the builder, time to repair and a vote of the owners (Property Code § 82.119).',
        'Para que una asociación de condominio en Texas reclame a la constructora, la ley pide un informe de ingeniero, aviso a la constructora, plazo para reparar y una votación de los propietarios (Código de Propiedad § 82.119).'));
      basis.push('tx_82_119');
    }
    out.push(T('Caution tape warns people but does not stop them from leaning on a damaged railing; ask for a temporary measure.', 'La cinta de precaución avisa, pero no impide apoyarse en un barandal dañado; pida una medida temporal.'));
  }
  if (type === 'will_inspect') {
    out.push(T('Good: ask for the inspection date and a copy of the findings in writing.', 'Bien: pida la fecha de la inspección y una copia por escrito de los resultados.'));
  }
  if (type === 'other' || !out.length) {
    out.push(T('Keep the answer in writing and note the next follow-up date.', 'Guarde la respuesta por escrito y anote la siguiente fecha de seguimiento.'));
  }
  out.push(T('General information, not legal advice.', 'Información general, no asesoría legal.'));
  return { points: out, basis: [...new Set(basis)] };
}

function guidance(inc, type, lawList) {
  const p = points(inc, type);
  const rules = (lawList || []).filter(r => p.basis.includes(r.id)).map(r => ({ id: r.id, title: r.title, url: r.url, state: r.state, lastChecked: r.lastChecked }));
  return { type, points: p.points, basis: rules };
}

// A reply the person can send (written by the app; no third-party text).
function draft(inc, report, lang, sender) {
  const es = lang === 'es';
  const type = report.responseType || 'other';
  const p = points(inc, type).points.filter(x => !/General information/.test(x.en));
  const L = o => (es ? o.es : o.en);
  const name = (sender && sender.name) || (es ? 'Un/a residente' : 'A resident');
  const unit = sender && sender.unit ? `\n${sender.unit}` : '';
  const place = (inc.answers && inc.answers.placeLabel) || '';
  const who = report.responder || (es ? 'equipo' : 'team');
  const reasons = p.filter(x => !/^(Before any repair|Antes de cualquier|Ask for dated|Pida que se guarden|Caution tape|La cinta)/.test(x.en) && !/^(Before any repair|Antes de cualquier|Ask for dated|Pida que se guarden|Caution tape|La cinta)/.test(x.es))
    .filter(x => !/^You bought directly|^Usted compró/.test(x.en + x.es));
  const asks = es
    ? ['Compartir una copia de la confirmación por escrito sobre la garantía y del documento de garantía al que se refiere.',
      'Que un ingeniero estructural con licencia evalúe la causa del daño antes de cualquier reparación.',
      'Documentar y conservar la evidencia antes de cualquier trabajo (fotos fechadas, medidas y piezas retiradas).',
      'Confirmar que la reparación atiende la causa y no solo la superficie.',
      'Considerar una medida temporal que impida apoyarse en las partes dañadas hasta terminar la reparación.']
    : ['Share a copy of the written confirmation about the warranty, and the warranty document it refers to.',
      'Have a licensed structural engineer evaluate the cause of the damage before any repair.',
      'Document and preserve the evidence before any work (dated photos, measurements and any removed parts).',
      'Confirm that the repair addresses the cause, not only the surface.',
      'Consider a temporary measure that keeps people from relying on the damaged parts until the repair is complete.'];
  const subject = es ? `RE: ${place ? 'Daño en ' + place : 'Reporte de daño'}` : `RE: ${place ? 'Damage at ' + place : 'Damage report'}`;
  const body = es
    ? `Hola ${who}:

Gracias por su respuesta y por dar prioridad a este asunto.

Quisiera compartir lo que entiendo, porque afecta a todos los propietarios:

${reasons.map((x, i) => `${i + 1}. ${L(x)}`).join('\n')}

Por eso, antes de cualquier reparación, solicito respetuosamente:

${asks.map(x => `- ${x}`).join('\n')}

No soy abogada/o; esto es lo que entiendo de las reglas generales. Solo quiero asegurar que no se pierda la opción de pedir a la constructora que pague antes de que la reparación borre la evidencia.

Gracias,
${name}${unit}`
    : `Hello ${who},

Thank you for your reply and for treating this as a priority.

I would like to share my understanding, because it affects every owner:

${reasons.map((x, i) => `${i + 1}. ${L(x)}`).join('\n')}

For these reasons, before any repair work begins, I respectfully ask to:

${asks.map(x => `- ${x}`).join('\n')}

I am not a lawyer, and this is my understanding of the general rules. I simply want to make sure we do not lose the option of asking the builder to pay before the evidence is repaired away.

Thank you,
${name}${unit}`;
  return { subject, body };
}

module.exports = { TYPES, points, guidance, draft };
