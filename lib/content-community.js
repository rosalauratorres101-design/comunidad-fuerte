'use strict';
// Other community problems that directly affect residents: gas smell, fallen
// power lines, flooding, water leaks, road damage, streetlights, rental home
// repairs and illegal dumping. Same rules as the rest of the app: every channel
// has a source and a check date; safety protocols are fixed text in 10
// languages (never generated), with extra first steps for gas, power lines and
// flooding.

const { protocols: PROTOCOLS_COMMUNITY, special: SPECIAL_STEPS } = require('./community-protocols.json');

const CHECKED = '2026-10-18';

const CATEGORIES = ['gas_smell', 'power_line', 'flooding', 'water_leak', 'road', 'streetlight', 'rental_repairs', 'illegal_dumping', 'other_community'];

// Starting tier per category, before urgency, injuries and hazardous materials.
const BASE_TIER = {
  gas_smell: 'red', power_line: 'red', flooding: 'yellow', water_leak: 'yellow', road: 'yellow',
  streetlight: 'green', rental_repairs: 'yellow', illegal_dumping: 'green', other_community: 'yellow'
};

const LABELS = {
  gas_smell: { en: 'Gas smell or gas leak', es: 'Olor o fuga de gas' },
  power_line: { en: 'Fallen or low power line', es: 'Cable eléctrico caído o bajo' },
  flooding: { en: 'Flooding or blocked drainage', es: 'Inundación o drenaje tapado' },
  water_leak: { en: 'Water leak, broken main or no water', es: 'Fuga de agua, tubería rota o sin agua' },
  road: { en: 'Pothole or damaged road', es: 'Bache o calle dañada' },
  streetlight: { en: 'Streetlight out', es: 'Alumbrado público apagado' },
  rental_repairs: { en: 'Rental home repairs (no heat or AC, leaks, mold, pests)', es: 'Reparaciones en vivienda rentada (sin calefacción o aire, goteras, moho, plagas)' },
  illegal_dumping: { en: 'Illegal dumping', es: 'Basura tirada ilegalmente' },
  other_community: { en: 'Other community problem', es: 'Otro problema de la comunidad' }
};

const PROTOCOL_ICONS_COMMUNITY = {
  green: ['photo', 'mail', 'folder', 'people'],
  yellow: ['away', 'cone', 'mail', 'calendar'],
  red: ['away', 'call', 'call', 'photo']
};

const SRC = {
  tgs: { title: 'Texas Gas Service: pipeline safety brochure (if you smell gas)', url: 'https://www.texasgasservice.com/media/TGS/Safety/TGS-Pipline-Safety-Outreach-Brochure.pdf' },
  ae: { title: 'Austin Energy: Report a problem (outages and downed lines)', url: 'https://austinenergy.com/commercial/report-a-problem' },
  aw: { title: 'Austin Water: How to report a water leak or problem', url: 'https://austintexas.gov/waterleak' },
  a311: { title: 'Austin 3-1-1: ways to contact', url: 'https://www.austintexas.gov/3-1-1/providing-uncomplicated-access-city-services-and-information' },
  drainage: { title: 'City of Austin: Report drainage issues', url: 'https://www.austintexas.gov/services/report-drainage-issues' },
  flood: { title: 'Ready Central Texas: Flooding preparedness', url: 'https://www.austintexas.gov/ready-central-texas/flooding-preparedness' },
  dumping: { title: 'City of Austin: Illegal dumping', url: 'https://www.austintexas.gov/stop-illegal-dumping' },
  streetlight: { title: 'Austin 3-1-1 request type: Austin Energy Street Light Issue', url: 'https://311.austintexas.gov/tickets/25-00424706' },
  code: { title: 'City of Austin: Code Compliance resources', url: 'https://www.austintexas.gov/department/code-compliance-resources' },
  s92_052: { title: 'Texas Property Code § 92.052 (landlord duty to repair)', url: 'https://texas.public.law/statutes/tex._prop._code_section_92.052' }
};

const t = (en, es) => ({ en, es });

// Austin channels, each verified on CHECKED from the cited page.
const AUSTIN = {
  e911: { id: 'emergency', kind: 'phone', tel: '911', name: t('Emergency services (911)', 'Emergencias (911)'), why: t('Anyone hurt or in immediate danger.', 'Alguien herido o en peligro inmediato.'), basis: [] },
  tgs: { id: 'tgs', kind: 'phone', tel: '1-800-959-5325', name: t('Texas Gas Service emergency line', 'Línea de emergencias de Texas Gas Service'), why: t('Once you are far away, call 911 and the gas company. Warn others to stay away.', 'Cuando estés lejos, llama al 911 y a la compañía de gas. Avisa a otros que no se acerquen.'), basis: [SRC.tgs] },
  ae: { id: 'austin-energy', kind: 'phone', tel: '512-322-9100', name: t('Austin Energy (outages and downed power lines)', 'Austin Energy (apagones y cables caídos)'), why: t('Reports downed lines and outages. Keep your distance.', 'Recibe reportes de cables caídos y apagones. Mantén distancia.'), basis: [SRC.ae] },
  aw: { id: 'austin-water', kind: 'phone', tel: '512-972-1000', name: t('Austin Water Dispatch (24/7)', 'Despacho de Austin Water (24/7)'), why: t('Water leaks, main breaks and water emergencies. Check the Leak Response Map first.', 'Fugas, tuberías rotas y emergencias de agua. Revisa primero el mapa de fugas.'), basis: [SRC.aw] },
  a311: { id: 'city', kind: 'city', name: t('Austin 3-1-1', 'Austin 3-1-1'), contact: t('Call 3-1-1 or 512-974-2000, or use the Austin 3-1-1 app (up to 3 photos). Check current phone hours.', 'Llama al 3-1-1 o al 512-974-2000, o usa la app Austin 3-1-1 (hasta 3 fotos). Verifica el horario telefónico vigente.'), why: t('City service requests, such as potholes. Save the request number.', 'Solicitudes de servicios de la ciudad, como baches. Guarda el número de solicitud.'), basis: [SRC.a311], url: SRC.a311.url },
  drainage: { id: 'city', kind: 'city', name: t('Austin 3-1-1 (drainage and flooding)', 'Austin 3-1-1 (drenaje e inundaciones)'), contact: t('Call 3-1-1 or 512-974-2000, report it online or in the 3-1-1 app.', 'Llama al 3-1-1 o al 512-974-2000, o repórtalo en línea o en la app 3-1-1.'), why: t('Clogged inlets, debris blocking culverts, flooding and erosion. A field investigator assesses it; the response can take up to 10 days.', 'Coladeras tapadas, basura que bloquea alcantarillas, inundaciones y erosión. Un inspector lo evalúa; la respuesta puede tardar hasta 10 días.'), basis: [SRC.drainage], url: SRC.drainage.url },
  dumping: { id: 'city', kind: 'city', name: t('Austin 3-1-1 (illegal dumping)', 'Austin 3-1-1 (basura tirada ilegalmente)'), contact: t('Call 3-1-1, use the Austin 3-1-1 app, or the regional hotline 1-877-NO-DUMPS.', 'Llama al 3-1-1, usa la app Austin 3-1-1 o la línea regional 1-877-NO-DUMPS.'), why: t('Illegal dumping reports.', 'Reportes de basura tirada ilegalmente.'), basis: [SRC.dumping], url: SRC.dumping.url },
  streetlight: { id: 'city', kind: 'city', name: t('Austin 3-1-1 (Austin Energy street light issue)', 'Austin 3-1-1 (problema de alumbrado de Austin Energy)'), contact: t('Call 3-1-1 or use the Austin 3-1-1 app and choose the street light request.', 'Llama al 3-1-1 o usa la app Austin 3-1-1 y elige la solicitud de alumbrado.'), why: t('3-1-1 takes street light requests for Austin Energy.', 'El 3-1-1 recibe solicitudes de alumbrado para Austin Energy.'), basis: [SRC.streetlight], url: SRC.a311.url },
  code: { id: 'city', kind: 'city', name: t('Austin 3-1-1 (Code Compliance)', 'Austin 3-1-1 (Cumplimiento de Código)'), contact: t('Call 3-1-1, use the Austin 3-1-1 app or the online form.', 'Llama al 3-1-1, usa la app Austin 3-1-1 o el formulario en línea.'), why: t('Code inspectors can check unsafe housing conditions and order repairs.', 'Los inspectores de código pueden revisar condiciones de vivienda inseguras y ordenar reparaciones.'), basis: [SRC.code], url: SRC.code.url },
  landlord: { id: 'landlord', kind: 'landlord', name: t('Landlord or property manager', 'Arrendador o administradora'), why: t('In Texas, after notice, must make a diligent effort to repair a condition that materially affects the physical health or safety of an ordinary tenant, if rent is current (§ 92.052).', 'En Texas, tras el aviso, debe hacer un esfuerzo diligente por reparar una condición que afecte materialmente la salud o seguridad física de un inquilino común, si la renta está al corriente (§ 92.052).'), basis: [SRC.s92_052] }
};

// Anywhere else: who usually handles it, plus the live AI search in "Get help".
const GENERIC = {
  e911: { id: 'emergency', kind: 'phone', tel: '', name: t('Local emergency number', 'Número local de emergencias'), why: t('Anyone hurt or in immediate danger.', 'Alguien herido o en peligro inmediato.'), basis: [] },
  gas: { id: 'gas-company', kind: 'info', name: t("Your gas company's emergency line", 'Línea de emergencias de tu compañía de gas'), why: t('Usually printed on the gas bill and the meter. Call only once you are far away.', 'Suele estar impresa en el recibo y en el medidor. Llama solo cuando estés lejos.'), basis: [] },
  power: { id: 'power-company', kind: 'info', name: t("Your electric company's outage line", 'Línea de reportes de tu compañía de luz'), why: t('Reports downed lines. Keep your distance.', 'Recibe reportes de cables caídos. Mantén distancia.'), basis: [] },
  water: { id: 'water-company', kind: 'info', name: t("Your water utility's emergency line", 'Línea de emergencias de tu servicio de agua'), why: t('Leaks and main breaks.', 'Fugas y tuberías rotas.'), basis: [] },
  city: { id: 'city', kind: 'city', name: t('City services line or public works', 'Línea de servicios de la ciudad u obras públicas'), why: t('Roads, drainage, streetlights and dumping.', 'Calles, drenaje, alumbrado y basura.'), basis: [] },
  code: { id: 'city', kind: 'city', name: t('City code enforcement or housing inspection', 'Inspección de código o de vivienda de la ciudad'), why: t('Unsafe housing conditions.', 'Condiciones de vivienda inseguras.'), basis: [] },
  landlord: { id: 'landlord', kind: 'landlord', name: t('Landlord or property manager', 'Arrendador o administradora'), why: t('Usually responsible for repairs that affect tenant health and safety. Check your lease and local tenant law.', 'Suele ser responsable de reparaciones que afectan la salud y seguridad del inquilino. Revisa tu contrato y la ley local.'), basis: [] }
};

function channelsFor(category, { austin, texas, emergency, tier }) {
  const A = austin ? AUSTIN : null;
  const G = GENERIC;
  const pick = (a, g) => (A ? A[a] : G[g]);
  const list = [];
  const addEmergency = () => list.push(A ? A.e911 : G.e911);
  switch (category) {
    case 'gas_smell': addEmergency(); list.push(A ? A.tgs : G.gas); break;
    case 'power_line': list.push(A ? A.ae : G.power); if (emergency) addEmergency(); break;
    case 'flooding': if (emergency || tier === 'red') addEmergency(); list.push(pick('drainage', 'city')); break;
    case 'water_leak': list.push(A ? A.aw : G.water); if (emergency) addEmergency(); break;
    case 'road': list.push(pick('a311', 'city')); break;
    case 'streetlight': list.push(pick('streetlight', 'city')); break;
    case 'rental_repairs': {
      const ll = texas ? AUSTIN.landlord : G.landlord;
      list.push(ll, pick('code', 'code'));
      if (emergency) addEmergency();
      break;
    }
    case 'illegal_dumping': list.push(pick('dumping', 'city')); if (emergency) addEmergency(); break;
    default: list.push(pick('a311', 'city')); if (emergency) addEmergency();
  }
  return list.map((c, i) => ({ ...c, order: c.id === 'emergency' ? 0 : i + 1 }));
}

const PLAN_TEMPLATES_COMMUNITY = {
  'community:green': [
    { category: 'advocacy', amount: 25, title: { en: 'Neighborhood reporting flyers', es: 'Volantes para que los vecinos reporten' }, detail: { en: 'Printed flyers with how to report it, in the languages of the neighborhood.', es: 'Volantes impresos con cómo reportarlo, en los idiomas del vecindario.' }, criteria: { en: 'Photo of the flyers posted.', es: 'Foto de los volantes colocados.' } }
  ],
  'community:yellow': [
    { category: 'barriers', amount: 40, title: { en: 'Warning cones and tape', es: 'Conos y cinta de advertencia' }, detail: { en: 'Only where it is safe to place them, until the responsible service fixes it.', es: 'Solo donde sea seguro colocarlos, hasta que el servicio responsable lo arregle.' }, criteria: { en: 'Photo of the area marked.', es: 'Foto de la zona señalizada.' } },
    { category: 'advocacy', amount: 25, title: { en: 'Neighborhood reporting flyers', es: 'Volantes para que los vecinos reporten' }, detail: { en: 'More reports from neighbors move a case up.', es: 'Más reportes de vecinos hacen que el caso avance.' }, criteria: { en: 'Photo of the flyers posted.', es: 'Foto de los volantes colocados.' } }
  ],
  'community:red': [
    { category: 'advocacy', amount: 25, title: { en: 'Safety flyers for neighbors', es: 'Volantes de seguridad para los vecinos' }, detail: { en: 'What to do and whom to call, in the languages of the neighborhood. Never placed near the hazard.', es: 'Qué hacer y a quién llamar, en los idiomas del vecindario. Nunca se colocan cerca del peligro.' }, criteria: { en: 'Photo of the flyers at a safe place.', es: 'Foto de los volantes en un lugar seguro.' } },
    { category: 'interpretation', amount: 40, title: { en: 'Safety message recorded in local languages', es: 'Mensaje de seguridad grabado en lenguas locales' }, detail: { en: 'A paid community interpreter records the safety steps.', es: 'Una intérprete comunitaria pagada graba los pasos de seguridad.' }, criteria: { en: 'Link to the recording.', es: 'Enlace a la grabación.' } }
  ]
};

const RENTAL_PLAN = [
  { category: 'advocacy', amount: 25, title: { en: 'Send the repair request by certified mail', es: 'Enviar la solicitud de reparación por correo certificado' }, detail: { en: 'Postage with return receipt, so there is proof the landlord was notified.', es: 'Envío con acuse de recibo, para tener prueba de que se avisó al arrendador.' }, criteria: { en: 'Photo of the certified mail receipt.', es: 'Foto del comprobante de correo certificado.' } },
  { category: 'legal', amount: 60, title: { en: 'Tenant rights consultation', es: 'Consulta sobre derechos del inquilino' }, detail: { en: 'With a tenant rights group or legal aid, if the repair does not happen.', es: 'Con un grupo de derechos del inquilino o asesoría legal gratuita, si no se hace la reparación.' }, criteria: { en: 'Photo of the appointment confirmation or receipt.', es: 'Foto de la confirmación de la cita o del recibo.' } }
];
PLAN_TEMPLATES_COMMUNITY['community_rental:green'] = RENTAL_PLAN;
PLAN_TEMPLATES_COMMUNITY['community_rental:yellow'] = RENTAL_PLAN;
PLAN_TEMPLATES_COMMUNITY['community_rental:red'] = RENTAL_PLAN;

const TYPE_LABELS_COMMUNITY = Object.fromEntries(CATEGORIES.map(c => ['cm_' + c, LABELS[c]]));

module.exports = {
  CHECKED, CATEGORIES, BASE_TIER, LABELS, TYPE_LABELS_COMMUNITY, PROTOCOLS_COMMUNITY, SPECIAL_STEPS,
  PROTOCOL_ICONS_COMMUNITY, PLAN_TEMPLATES_COMMUNITY, channelsFor, SRC
};
