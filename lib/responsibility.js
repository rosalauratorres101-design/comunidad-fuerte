'use strict';
// Who is responsible for a damaged stair, railing or walkway, and what the
// next formal step is. Texas has a sourced legal pack; other places get a
// general map and a clear note to check local law. Not legal advice.

const LAW = {
  ch27: { title: 'Texas Property Code, Chapter 27 (Residential Construction Liability Act)', url: 'https://tcss.legis.texas.gov/Docs/PR/htm/PR.27.htm' },
  s82_103: { title: 'Texas Property Code § 82.103 (declarant control of the board)', url: 'https://texas.public.law/statutes/tex._prop._code_section_82.103' },
  s82_119: { title: 'Texas Property Code § 82.119 (association claims for construction defects)', url: 'https://texas.public.law/statutes/tex._prop._code_section_82.119' },
  s92_052: { title: 'Texas Property Code § 92.052 (landlord duty to repair)', url: 'https://texas.public.law/statutes/tex._prop._code_section_92.052' },
  repose: { title: 'Texas Civil Practice and Remedies Code § 16.009 (10-year limit for construction claims)', url: 'https://texas.public.law/statutes/tex._civ._practice_and_remedies_code_section_16.009' },
  hb2024: { title: 'HB 2024 (2023), bill analysis: optional 6-year limit only for contracts signed on or after its effective date', url: 'https://capitol.texas.gov/tlodocs/88R/analysis/html/HB02024E.htm' },
  s82_102: { title: 'Texas Property Code § 82.102(a)(4) (association may sue in its own name for two or more owners)', url: 'https://texas.public.law/statutes/tex._prop._code_section_82.102' },
  s82_107: { title: 'Texas Property Code § 82.107 (association maintains the common elements)', url: 'https://texas.public.law/statutes/tex._prop._code_section_82.107' },
  limits: { title: 'Texas deadlines for defect claims: 2 years negligence, 4 years contract or warranty, from discovery (law firm summary)', url: 'https://jbakerlawgroup.com/how-long-is-a-builder-liable-for-defects-in-texas/' },
  austin311: { title: 'City of Austin: Code Compliance resources', url: 'https://www.austintexas.gov/department/code-compliance-resources' }
};

const PROPERTY_TYPES = ['condo_common', 'condo_unit', 'rental', 'public', 'own_home', 'other'];

function t(en, es) { return { en, es }; }

function cityParty(isAustin) {
  return {
    id: 'city', letter: 'city',
    role: isAustin ? t('City of Austin (3-1-1 Code Compliance)', 'Ciudad de Austin (3-1-1, Cumplimiento de Código)') : t('City code enforcement', 'Inspección de código de la ciudad'),
    duty: isAustin
      ? t('Inspects cracked or loose handrails and unsafe stairs and can issue a Notice of Violation to the property owner with a repair deadline.', 'Inspecciona barandales agrietados o flojos y escaleras inseguras, y puede enviar al propietario un aviso de infracción con plazo de reparación.')
      : t('Most cities inspect unsafe stairs and railings on request. Check your local code enforcement office.', 'La mayoría de las ciudades inspeccionan escaleras y barandales inseguros a petición. Consulta la oficina local de inspección de código.'),
    basis: isAustin ? [LAW.austin311] : []
  };
}

// Plain conclusion: who pays and who acts, with the reasons that support it.
function verdictFor(a, type, tx, built, now) {
  if (!tx || !['condo_common', 'condo_unit', 'own_home'].includes(type)) return null;
  const age = built ? now - built : null;
  const inRepose = age !== null && age < 10;
  const patched = a.builderPatched === 'yes';
  const elsewhere = a.sameDefectElsewhere === 'same_hoa' || a.sameDefectElsewhere === 'other_hoa';
  const reasons = [];
  if (inRepose) reasons.push(t(
    `The building is about ${age} years old, inside the 10-year limit for construction claims in Texas (until about ${built + 10}). A 2023 change allows 6 years only for contracts signed after mid-2023 that include a specific written warranty, so it does not apply to a building completed in ${built}.`,
    `El edificio tiene unos ${age} años, dentro del límite de 10 años para reclamos de construcción en Texas (hasta cerca de ${built + 10}). Un cambio de 2023 permite 6 años solo en contratos firmados después de mediados de 2023 que incluyan cierta garantía escrita, así que no aplica a un edificio terminado en ${built}.`));
  if (patched) reasons.push(t(
    'The builder already patched this damage and it came back. That shows the builder knew of the problem and treated it as its own repair.',
    'La constructora ya parchó este daño y volvió a aparecer. Eso muestra que conocía el problema y lo trató como una reparación suya.'));
  if (elsewhere) reasons.push(t(
    a.sameDefectElsewhere === 'same_hoa' ? 'Another building of the same condominium, by the same builder, shows the same damage. A repeated pattern points to design or construction, not to use or lack of upkeep.' : 'Another building by the same builder shows the same damage. A repeated pattern points to design or construction, not to use or lack of upkeep.',
    a.sameDefectElsewhere === 'same_hoa' ? 'Otro edificio del mismo condominio, de la misma constructora, tiene el mismo daño. Un patrón repetido apunta al diseño o la construcción, no al uso ni a falta de mantenimiento.' : 'Otro edificio de la misma constructora tiene el mismo daño. Un patrón repetido apunta al diseño o la construcción, no al uso ni a falta de mantenimiento.'));
  if (a.boughtFromBuilder === 'yes') reasons.push(t(
    'The person reporting bought the unit directly from the builder, so the purchase contract and any written warranty bind the builder directly to them.',
    'Quien reporta compró su unidad directamente a la constructora, así que el contrato de compra y cualquier garantía escrita obligan directamente a la constructora con esa persona.'));
  const signs = [patched, elsewhere].filter(Boolean).length;
  const strength = inRepose && signs >= 1 ? 'strong' : inRepose ? 'possible' : 'expired';
  const common = type === 'condo_common';
  const pays = strength === 'expired'
    ? t(`The 10-year limit for construction claims has likely passed (completed about ${built}). Repairs now fall on whoever maintains the property, unless a written warranty or concealment says otherwise.`, `Es probable que el límite de 10 años para reclamos de construcción ya haya pasado (terminado cerca de ${built}). La reparación ahora le toca a quien da mantenimiento, salvo que una garantía escrita o un ocultamiento digan otra cosa.`)
    : t(
      `Who pays for the repair: the builder or developer${strength === 'strong' ? ', because the evidence points to a construction defect' : ', if the damage is a construction defect'}. A licensed engineer's report is what confirms the cause.`,
      `Quién paga la reparación: la constructora o desarrolladora${strength === 'strong' ? ', porque la evidencia apunta a un defecto de construcción' : ', si el daño es un defecto de construcción'}. El informe de un ingeniero con licencia es lo que confirma la causa.`);
  const acts = common
    ? t(`Who must act now: the condominium association. It maintains the common elements and must keep them safe meanwhile (§ 82.107), and it can claim in its own name for two or more owners (§ 82.102)${a.sameDefectElsewhere === 'same_hoa' ? ', so one claim can cover both buildings' : ''}. If the engineer finds the cause is upkeep and not construction, the association pays from its budget.`,
      `Quién debe actuar ya: la asociación de condóminos. Mantiene las áreas comunes y debe mantenerlas seguras mientras tanto (§ 82.107), y puede reclamar a nombre propio por dos o más propietarios (§ 82.102)${a.sameDefectElsewhere === 'same_hoa' ? ', así que un solo reclamo puede cubrir los dos edificios' : ''}. Si el ingeniero concluye que la causa es falta de mantenimiento y no la construcción, paga la asociación de su presupuesto.`)
    : t('Who must act now: the owner, with written notice to the builder.', 'Quién debe actuar ya: la persona propietaria, con aviso por escrito a la constructora.');
  const cautions = [];
  if (strength !== 'expired') cautions.push(t(
    `Shorter deadlines may already be running: generally 2 years for negligence and 4 years for breach of contract or warranty, counted from when the damage was or should have been discovered${patched ? '. Because the builder already patched it, that clock may have started then' : ''}. Send written notice now; a written claim presented within the 10-year period also extends that period (§ 16.009(c)).`,
    `Puede que ya corran plazos más cortos: en general 2 años por negligencia y 4 años por incumplimiento de contrato o garantía, contados desde que se descubrió o debió descubrirse el daño${patched ? '. Como la constructora ya lo parchó, ese plazo pudo empezar entonces' : ''}. Envía el aviso por escrito ya; un reclamo escrito presentado dentro de los 10 años también amplía ese periodo (§ 16.009(c)).`));
  cautions.push(t('Find the purchase contract and any written warranty: it may cover structural parts longer, or require a specific claim process.', 'Busca el contrato de compra y cualquier garantía escrita: puede cubrir más tiempo la estructura o exigir un proceso de reclamo específico.'));
  return {
    strength, pays, acts, reasons, cautions,
    basis: [LAW.repose, LAW.hb2024, LAW.limits, LAW.ch27].concat(common ? [LAW.s82_107, LAW.s82_102] : [])
  };
}

function analyze(answers) {
  const a = answers || {};
  const tx = a.jurisdiction === 'US-TX';
  const isAustin = tx && /austin/i.test(a.placeLabel || '');
  const type = PROPERTY_TYPES.includes(a.propertyType) ? a.propertyType : 'other';
  const built = Number(a.builtYear) || null;
  const now = new Date().getFullYear();
  const parties = [];
  const steps = [];
  const warnings = [];
  const deadlines = [];

  const builder = {
    id: 'builder', letter: 'builder',
    role: t('Builder or developer', 'Constructora o desarrolladora'),
    duty: tx
      ? t('Responsible for construction defects under the purchase warranty and Texas law. Chapter 27 covers condominium units and common elements and requires written notice before any lawsuit.', 'Responde por defectos de construcción según la garantía de compra y la ley de Texas. El capítulo 27 incluye unidades y áreas comunes de condominios y exige aviso por escrito antes de cualquier demanda.')
      : t('Usually responsible for construction defects during the warranty and the legal claim period where you live.', 'Suele responder por defectos de construcción durante la garantía y el plazo legal de reclamo de tu lugar.'),
    basis: tx ? [LAW.ch27] : []
  };

  if (type === 'condo_common') {
    parties.push({
      id: 'association', letter: 'association',
      role: t('Condominium association (HOA) and its management company', 'Asociación de condóminos (HOA) y su administradora'),
      duty: t('Maintains and repairs the common elements, such as entrance stairs, and is the party that usually brings a defect claim against the builder.', 'Mantiene y repara las áreas comunes, como la escalera de entrada, y normalmente es quien reclama al constructor por defectos.'),
      basis: tx ? [LAW.s82_119] : []
    });
    parties.push(builder);
    if (tx) {
      steps.push(t('Written notice to the association asking for safety measures, a professional inspection and a claim against the builder.', 'Aviso por escrito a la asociación pidiendo medidas de seguridad, una inspección profesional y un reclamo al constructor.'));
      steps.push(t('Notice to the builder by certified mail, return receipt requested, at least 60 days before any lawsuit (Ch. 27). The builder may inspect within 35 days and offer a settlement within 60 days.', 'Aviso al constructor por correo certificado con acuse de recibo, al menos 60 días antes de cualquier demanda (cap. 27). El constructor puede inspeccionar en 35 días y ofrecer un arreglo en 60 días.'));
      steps.push(t('Before the association can sue (8+ units): independent licensed engineer report, at least 90 days for the builder to correct, and approval by owners with more than 50% of the votes (§ 82.119).', 'Antes de que la asociación pueda demandar (8 o más unidades): informe de un ingeniero independiente con licencia, al menos 90 días para que el constructor corrija y aprobación de propietarios con más del 50% de los votos (§ 82.119).'));
    }
    if (a.developerSelling === 'yes' || a.developerSelling === 'unsure') {
      warnings.push(t(
        'The developer may still control the association board. In Texas, declarant control must end no later than 120 days after 75% of units are sold, and owners must elect at least one third of the board once 50% are sold (§ 82.103). Ask who is on the board today: a board controlled by the builder would be deciding whether to claim against itself.',
        'Es posible que la desarrolladora aún controle la mesa directiva. En Texas, ese control debe terminar a más tardar 120 días después de vender el 75% de las unidades, y los propietarios deben elegir al menos un tercio de la mesa al venderse el 50% (§ 82.103). Pregunta quién integra hoy la mesa: una mesa controlada por la constructora decidiría si reclamarse a sí misma.'));
    }
  } else if (type === 'condo_unit' || type === 'own_home') {
    parties.push({
      id: 'owner', letter: null,
      role: t('The owner', 'La persona propietaria'),
      duty: t('Maintains the property, and can claim construction defects from the builder.', 'Da mantenimiento a la propiedad y puede reclamar defectos de construcción al constructor.'),
      basis: []
    });
    parties.push(builder);
    if (tx) steps.push(t('Notice to the builder by certified mail at least 60 days before any lawsuit (Ch. 27).', 'Aviso al constructor por correo certificado al menos 60 días antes de cualquier demanda (cap. 27).'));
  } else if (type === 'rental') {
    parties.push({
      id: 'landlord', letter: 'landlord',
      role: t('Landlord or property manager', 'Arrendador o administradora'),
      duty: tx
        ? t('Must make a diligent effort to repair a condition that materially affects the physical health or safety of an ordinary tenant, after notice to where rent is paid, if the tenant is current on rent (§ 92.052). If the lease is written and requires it, the notice must be in writing.', 'Debe hacer un esfuerzo diligente por reparar una condición que afecte materialmente la salud o seguridad física de un inquilino común, tras el aviso al lugar donde se paga la renta, si el inquilino está al corriente (§ 92.052). Si el contrato es escrito y lo exige, el aviso debe ser por escrito.')
        : t('Usually responsible for repairs that affect tenant safety. Check your lease and local tenant law.', 'Suele ser responsable de reparaciones que afectan la seguridad del inquilino. Revisa tu contrato y la ley local.'),
      basis: tx ? [LAW.s92_052] : []
    });
    if (tx) steps.push(t('Written notice to the landlord where rent is paid; keep rent current and keep a copy.', 'Aviso por escrito al arrendador donde se paga la renta; mantén la renta al corriente y guarda copia.'));
  } else if (type === 'public') {
    steps.push(t('Report to the city with photos and the exact location.', 'Reporta a la ciudad con fotos y la ubicación exacta.'));
  } else {
    parties.push({ id: 'manager', letter: 'association', role: t('Whoever owns or maintains the property', 'Quien es dueño o da mantenimiento a la propiedad'), duty: t('Usually responsible for repairs to shared areas.', 'Suele ser responsable de reparar las áreas compartidas.'), basis: [] });
  }

  parties.push(cityParty(isAustin));
  if (isAustin) steps.push(t('Report to Austin 3-1-1 (phone, app or online form) if the hazard is not fixed.', 'Reporta al 3-1-1 de Austin (teléfono, app o formulario) si el riesgo no se corrige.'));

  if (built && ['condo_common', 'condo_unit', 'own_home'].includes(type)) {
    const age = now - built;
    if (tx) {
      deadlines.push({
        label: t(`Construction defect claims: about 10 years from substantial completion, so until about ${built + 10} if the building was completed in ${built}.`, `Reclamos por defectos de construcción: unos 10 años desde la terminación sustancial, es decir, hasta cerca de ${built + 10} si el edificio se terminó en ${built}.`),
        year: built + 10, open: built + 10 >= now, basis: [LAW.repose]
      });
    }
    if (age > 2) {
      warnings.push(t(
        `The building is about ${age} years old: short warranties (often 1 year for workmanship and 2 for systems) have probably ended. Check the written warranty for structural coverage. Shorter deadlines can also run from the date damage is discovered, so act promptly.`,
        `El edificio tiene unos ${age} años: las garantías cortas (a menudo 1 año de mano de obra y 2 de sistemas) probablemente vencieron. Revisa la garantía escrita para la parte estructural. También puede haber plazos más cortos desde que se descubre el daño, así que actúa pronto.`));
    }
  }

  return {
    jurisdiction: tx ? 'US-TX' : 'general',
    propertyType: type,
    verdict: verdictFor(a, type, tx, built, now),
    parties, steps, warnings, deadlines,
    note: tx
      ? t('This is general information about Texas law, not legal advice. A Texas construction or property attorney can confirm what applies to your documents.', 'Esto es información general sobre la ley de Texas, no asesoría legal. Un abogado de construcción o propiedad en Texas puede confirmar qué aplica según tus documentos.')
      : t('Laws differ by place. This is a general guide, not legal advice; check local law or a local lawyer.', 'Las leyes cambian según el lugar. Esta es una guía general, no asesoría legal; consulta la ley local o a un abogado local.')
  };
}

module.exports = { analyze, verdictFor, PROPERTY_TYPES, LAW };
