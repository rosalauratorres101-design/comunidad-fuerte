'use strict';
// Law and contact watch: every legal rule, deadline and phone number the app
// relies on is listed here with the exact facts it uses, the date a person last
// verified it and how often it must be re-checked.
//
//  - Live mode: the scheduled refresh asks Claude (with web search) whether each
//    fact is still accurate. Only answers backed by a page the search actually
//    retrieved count. A possible change becomes a "pending review" item.
//  - Nothing in the app text changes automatically. A named reviewer accepts or
//    declines each change; an accepted change shows a warning on every report
//    that cites that rule until the content is updated.
//  - A reviewer can also mark a rule as re-checked by hand (works in demo mode).

const { newId } = require('./store');
const knowledge = require('./knowledge');

const VERIFIED = '2026-10-18';
function bad(message) { const e = new Error(message); e.status = 400; return e; }
const f = (en, es) => ({ en, es });

const REGISTRY = [
  { id: 'tx_ch27', kind: 'law', jurisdiction: 'US-TX', title: 'Texas Property Code, Chapter 27 (Residential Construction Liability Act)', url: 'https://tcss.legis.texas.gov/Docs/PR/htm/PR.27.htm', reviewEveryDays: 180,
    facts: [f('Written notice by certified mail, return receipt requested, at least 60 days before filing suit.', 'Aviso por escrito por correo certificado con acuse de recibo, al menos 60 días antes de demandar.'),
      f('The contractor may inspect during the 35 days after receiving the notice.', 'El constructor puede inspeccionar durante los 35 días siguientes al aviso.'),
      f('The contractor may make a written settlement offer within 60 days after receiving the notice.', 'El constructor puede hacer una oferta por escrito dentro de los 60 días siguientes al aviso.')] },
  { id: 'tx_82_102', kind: 'law', jurisdiction: 'US-TX', title: 'Texas Property Code § 82.102(a)(4)', url: 'https://texas.public.law/statutes/tex._prop._code_section_82.102', reviewEveryDays: 180,
    facts: [f('The association may sue in its own name for itself or two or more owners on matters affecting the condominium, unless the declaration says otherwise.', 'La asociación puede demandar a nombre propio por sí o por dos o más propietarios en asuntos del condominio, salvo que la declaración diga otra cosa.')] },
  { id: 'tx_82_103', kind: 'law', jurisdiction: 'US-TX', title: 'Texas Property Code § 82.103 (declarant control of the board)', url: 'https://texas.public.law/statutes/tex._prop._code_section_82.103', reviewEveryDays: 180,
    facts: [f('Declarant control ends no later than 120 days after 75% of the units are sold.', 'El control del declarante termina a más tardar 120 días después de vender el 75% de las unidades.'),
      f('Owners elect at least one third of the board once 50% of the units are sold.', 'Los propietarios eligen al menos un tercio de la mesa al venderse el 50% de las unidades.')] },
  { id: 'tx_82_107', kind: 'law', jurisdiction: 'US-TX', title: 'Texas Property Code § 82.107 (upkeep of the condominium)', url: 'https://texas.public.law/statutes/tex._prop._code_section_82.107', reviewEveryDays: 180,
    facts: [f('The association maintains the common elements, unless the declaration provides otherwise.', 'La asociación mantiene las áreas comunes, salvo que la declaración diga otra cosa.')] },
  { id: 'tx_82_119', kind: 'law', jurisdiction: 'US-TX', title: 'Texas Property Code § 82.119 (association construction defect claims)', url: 'https://texas.public.law/statutes/tex._prop._code_section_82.119', reviewEveryDays: 180,
    facts: [f('Associations of 8 or more units need an independent licensed engineer report, notice to the builder, at least 90 days to correct, and approval by owners with more than 50% of the votes before suing.', 'Las asociaciones de 8 o más unidades necesitan informe de ingeniero independiente con licencia, aviso al constructor, al menos 90 días para corregir y aprobación de más del 50% de los votos antes de demandar.')] },
  { id: 'tx_92_052', kind: 'law', jurisdiction: 'US-TX', title: 'Texas Property Code § 92.052 (landlord duty to repair)', url: 'https://texas.public.law/statutes/tex._prop._code_section_92.052', reviewEveryDays: 180,
    facts: [f('After notice, the landlord must make a diligent effort to repair a condition that materially affects the physical health or safety of an ordinary tenant, if rent is current.', 'Tras el aviso, el arrendador debe hacer un esfuerzo diligente por reparar una condición que afecte materialmente la salud o seguridad física de un inquilino común, si la renta está al corriente.')] },
  { id: 'tx_16_009', kind: 'law', jurisdiction: 'US-TX', title: 'Texas Civil Practice and Remedies Code § 16.009', url: 'https://texas.public.law/statutes/tex._civ._practice_and_remedies_code_section_16.009', reviewEveryDays: 180,
    facts: [f('Claims against a person who constructs or repairs an improvement must be brought within 10 years after substantial completion.', 'Los reclamos contra quien construye o repara una mejora deben presentarse dentro de los 10 años desde la terminación sustancial.'),
      f('A written claim presented during the period extends it.', 'Un reclamo por escrito presentado dentro del plazo lo amplía.')] },
  { id: 'tx_hb2024', kind: 'law', jurisdiction: 'US-TX', title: 'HB 2024 (2023): optional 6-year limit for some residences', url: 'https://capitol.texas.gov/tlodocs/88R/analysis/html/HB02024E.htm', reviewEveryDays: 365,
    facts: [f('The 6-year limit applies only to residences (one- or two-family homes, townhouses) with a qualifying written warranty, and does not apply to work under contracts signed before the law took effect.', 'El límite de 6 años solo aplica a viviendas (casas para una o dos familias, townhouses) con cierta garantía escrita, y no aplica a obras con contratos firmados antes de la ley.')] },
  { id: 'tx_limits', kind: 'secondary', jurisdiction: 'US-TX', title: 'Texas deadlines for defect claims (law firm summary)', url: 'https://jbakerlawgroup.com/how-long-is-a-builder-liable-for-defects-in-texas/', reviewEveryDays: 180,
    facts: [f('Generally 2 years for negligence and 4 years for breach of contract or warranty, counted from discovery.', 'En general 2 años por negligencia y 4 por incumplimiento de contrato o garantía, desde el descubrimiento.')] },
  { id: 'atx_code', kind: 'contact', jurisdiction: 'US-TX-Austin', title: 'City of Austin: Code Compliance resources', url: 'https://www.austintexas.gov/department/code-compliance-resources', reviewEveryDays: 90,
    facts: [f('Code Compliance takes reports about unsafe conditions through 3-1-1.', 'Cumplimiento de Código recibe reportes de condiciones inseguras por el 3-1-1.')] },
  { id: 'atx_311', kind: 'contact', jurisdiction: 'US-TX-Austin', title: 'Austin 3-1-1: ways to contact', url: 'https://www.austintexas.gov/3-1-1/providing-uncomplicated-access-city-services-and-information', reviewEveryDays: 90,
    facts: [f('Call 3-1-1 or 512-974-2000, use the Austin 3-1-1 app, or the online form.', 'Llamar al 3-1-1 o al 512-974-2000, usar la app Austin 3-1-1 o el formulario en línea.')] },
  { id: 'atx_drainage', kind: 'contact', jurisdiction: 'US-TX-Austin', title: 'City of Austin: Report drainage issues', url: 'https://www.austintexas.gov/services/report-drainage-issues', reviewEveryDays: 90,
    facts: [f('Drainage and flooding problems are reported through 3-1-1; the response can take up to 10 days.', 'Los problemas de drenaje e inundación se reportan por el 3-1-1; la respuesta puede tardar hasta 10 días.'),
      f('From November 1, 2026 the 3-1-1 phone line is open 7 a.m. to 9 p.m.', 'Desde el 1 de noviembre de 2026 la línea telefónica 3-1-1 atiende de 7 a. m. a 9 p. m.')] },
  { id: 'atx_dumping', kind: 'contact', jurisdiction: 'US-TX-Austin', title: 'City of Austin: Illegal dumping', url: 'https://www.austintexas.gov/stop-illegal-dumping', reviewEveryDays: 90,
    facts: [f('Report illegal dumping to 3-1-1, the Austin 3-1-1 app, or 1-877-NO-DUMPS.', 'Reportar basura ilegal al 3-1-1, la app Austin 3-1-1 o al 1-877-NO-DUMPS.')] },
  { id: 'atx_streetlight', kind: 'contact', jurisdiction: 'US-TX-Austin', title: 'Austin 3-1-1 request type: Austin Energy Street Light Issue', url: 'https://311.austintexas.gov/tickets/25-00424706', reviewEveryDays: 90,
    facts: [f('Street light problems are reported through 3-1-1 as an Austin Energy request.', 'Los problemas de alumbrado se reportan por el 3-1-1 como solicitud de Austin Energy.')] },
  { id: 'atx_energy', kind: 'contact', jurisdiction: 'US-TX-Austin', title: 'Austin Energy: Report a problem', url: 'https://austinenergy.com/commercial/report-a-problem', reviewEveryDays: 90,
    facts: [f('Report downed power lines and outages at 512-322-9100.', 'Reportar cables caídos y apagones al 512-322-9100.')] },
  { id: 'atx_water', kind: 'contact', jurisdiction: 'US-TX-Austin', title: 'Austin Water: How to report a water leak or problem', url: 'https://austintexas.gov/waterleak', reviewEveryDays: 90,
    facts: [f('Austin Water Dispatch, available 24/7, at 512-972-1000.', 'Despacho de Austin Water, 24/7, al 512-972-1000.')] },
  { id: 'tx_gas', kind: 'contact', jurisdiction: 'US-TX', title: 'Texas Gas Service: pipeline safety brochure', url: 'https://www.texasgasservice.com/media/TGS/Safety/TGS-Pipline-Safety-Outreach-Brochure.pdf', reviewEveryDays: 90,
    facts: [f('If you smell gas, leave on foot, avoid switches, phones and vehicles nearby, then call 911 and 800-959-5325 from a safe place.', 'Si hueles gas, sal a pie, evita interruptores, teléfonos y vehículos cerca, y llama al 911 y al 800-959-5325 desde un lugar seguro.')] },
  { id: 'atx_flood', kind: 'contact', jurisdiction: 'US-TX-Austin', title: 'Ready Central Texas: Flooding preparedness', url: 'https://www.austintexas.gov/ready-central-texas/flooding-preparedness', reviewEveryDays: 180,
    facts: [f('Turn around, don\'t drown: cars can be washed away in as little as six inches of water; call 911 for emergencies.', 'Da la vuelta: un auto puede ser arrastrado con solo seis pulgadas de agua; llama al 911 en emergencias.')] },
  { id: 'mx_sargazo_2021', kind: 'law', jurisdiction: 'MX', title: 'SEMARNAT-INECC (2021): Lineamientos técnicos y de gestión para la atención de la contingencia por sargazo', url: 'https://sargazo.icmyl.unam.mx/en/Files/SEMARNAT2021.pdf', reviewEveryDays: 180,
    facts: [f('Remove sargassum from beaches by hand within 72 hours of arrival; light machinery only when volumes require it, never in the dry zone of turtle nesting beaches.', 'Retirar el sargazo de las playas a mano en menos de 72 horas; maquinaria ligera solo si el volumen lo exige, nunca en la zona seca de playas de anidación de tortugas.'),
      f('Burning, burying on beaches, depositing at unauthorized sites and dumping or sinking at sea are prohibited.', 'Se prohíbe quemarlo, enterrarlo en la playa, depositarlo en sitios no autorizados y verterlo o hundirlo en el mar.')] },
  { id: 'mx_h2s_unam', kind: 'secondary', jurisdiction: 'MX', title: 'UNAM ICMyL: gas tóxico del sargazo (ácido sulfhídrico)', url: 'https://www.icmyl.unam.mx/Pdf/Home/2024/Nota. gas toxico sargazo.pdf', reviewEveryDays: 365,
    facts: [f('Collectors were exposed above 5 ppm of H2S 23.4% of their work time; move crews away at 5 ppm.', 'Los recolectores estuvieron expuestos a más de 5 ppm de H2S el 23.4% de su jornada; retirar a la brigada a 5 ppm.')] },
  { id: 'qroo_semaforo', kind: 'contact', jurisdiction: 'MX-ROO', title: 'Semáforo del sargazo, Red de Monitoreo del Sargazo (facebook.com/RedSargazo)', url: 'https://www.imagenradio.com.mx/noticias/semaforo-sargazo-hoy-como-consultar-playas-limpias-afectadas-caribe-mexicano', reviewEveryDays: 90,
    facts: [f('Daily rating of 140 coastal points in five colors, published at facebook.com/RedSargazo.', 'Calificación diaria de 140 puntos de costa en cinco colores, publicada en facebook.com/RedSargazo.')] },
  { id: 'mx_lanot', kind: 'contact', jurisdiction: 'MX', title: 'LANOT-UNAM: Monitoreo de sargazo', url: 'https://www.lanot.unam.mx/home/sargazo/', reviewEveryDays: 180,
    facts: [f('Satellite mosaic and stranding forecast about every five days for the Mexican Caribbean.', 'Mosaico satelital y pronóstico de recale cada cinco días aproximadamente para el Caribe mexicano.')] }
  ,{ id: 'std_nom026', kind: 'law', jurisdiction: 'MX', title: 'NOM-026-STPS-2008: colores y señales de seguridad (guía informativa STPS)', url: 'https://www.gob.mx/cms/uploads/attachment/file/807422/GUIA_INFORMATIVA_NOM-026.pdf', reviewEveryDays: 365,
    facts: [f('Red: stop, prohibition, fire equipment. Yellow: hazard warning, area limits. Green: safe condition. Blue: obligation.', 'Rojo: paro, prohibición, equipo contra incendio. Amarillo: advertencia de peligro, delimitación de áreas. Verde: condición segura. Azul: obligación.')] },
  { id: 'std_osha', kind: 'law', jurisdiction: 'US', title: 'OSHA 29 CFR 1910.145: specifications for accident prevention signs and tags', url: 'https://www.govinfo.gov/content/pkg/CFR-2018-title29-vol5/pdf/CFR-2018-title29-vol5-sec1910-145.pdf', reviewEveryDays: 365,
    facts: [f('Danger signs red (immediate danger); caution signs yellow (potential hazards); safety instruction signs green; warning tags orange, between caution and danger.', 'Señales de peligro en rojo (peligro inmediato); de precaución en amarillo (peligros potenciales); de instrucciones de seguridad en verde; etiquetas de advertencia en naranja, entre precaución y peligro.')] },
  { id: 'std_ansi', kind: 'secondary', jurisdiction: 'US', title: 'ANSI Z535 signal words (EC&M summary)', url: 'https://www.ecmag.com/magazine/articles/article-detail/codes-standards-signal-words', reviewEveryDays: 365,
    facts: [f('DANGER red: will result in death or injury; WARNING orange: could result in death or injury; CAUTION yellow: may result in minor injury.', 'PELIGRO rojo: causará muerte o lesión; ADVERTENCIA naranja: podría causar muerte o lesión; PRECAUCIÓN amarillo: puede causar lesión menor.')] },
  { id: 'std_eu', kind: 'law', jurisdiction: 'EU', title: 'Directive 92/58/EEC, safety colours (UK Annex text)', url: 'https://gov.uk/government/publications/mgn-556-mf-amendment-2-safety-signs-and-signals-regulations-2001/annex-1-text-to-the-annexes-to-council-directive-9258ec', reviewEveryDays: 365,
    facts: [f('Red: prohibition, danger alarm (evacuate); yellow or amber: warning; blue: mandatory; green: emergency escape and first aid.', 'Rojo: prohibición, alarma de peligro (evacuar); amarillo o ámbar: advertencia; azul: obligación; verde: salida de emergencia y primeros auxilios.')] },
  { id: 'std_iso3864', kind: 'secondary', jurisdiction: 'INTL', title: 'ISO 3864 safety colours and signal words (summary)', url: 'https://en.wikipedia.org/wiki/ISO_3864', reviewEveryDays: 365,
    facts: [f('ISO 3864-1: red prohibition, yellow warning, blue mandatory, green safe condition. ISO 3864-2: CAUTION yellow, WARNING orange, DANGER red.', 'ISO 3864-1: rojo prohibición, amarillo advertencia, azul obligación, verde condición segura. ISO 3864-2: PRECAUCIÓN amarillo, ADVERTENCIA naranja, PELIGRO rojo.')] },

  // ---- Added 2026-10-19: rules by level (international, national, state, local) ----
  { id: 'intl_escazu', kind: 'treaty', jurisdiction: 'INTL', countries: ['MX'], verified: '2026-10-19', reviewEveryDays: 365,
    title: 'Escazú Agreement (Regional Agreement on Access to Information, Public Participation and Justice in Environmental Matters in Latin America and the Caribbean)',
    url: 'https://embamex.sre.gob.mx/australia/images/pdf/Comunicados/2021/MultilateralesResuelveN14.pdf',
    facts: [f('In force since April 22, 2021; Mexico ratified it on January 22, 2021.', 'En vigor desde el 22 de abril de 2021; México lo ratificó el 22 de enero de 2021.'),
      f('It covers access to environmental information, public participation and access to justice in environmental matters, and is the first agreement with binding provisions to protect environmental defenders.', 'Abarca el acceso a la información ambiental, la participación pública y el acceso a la justicia en asuntos ambientales, y es el primer acuerdo con disposiciones vinculantes para proteger a las personas defensoras del ambiente.')] },
  { id: 'mx_lgeepa_189', kind: 'law', jurisdiction: 'MX', verified: '2026-10-19', reviewEveryDays: 365,
    title: 'Ley General del Equilibrio Ecológico y la Protección al Ambiente (LGEEPA), art. 189: denuncia popular',
    url: 'https://mley.mx/LGEEPA/articulo/189/',
    facts: [f('Any person, community group, NGO or association may report to PROFEPA or other authorities any act or omission that harms or may harm the environment or breaks environmental law.', 'Toda persona, grupo social, organización no gubernamental o asociación puede denunciar ante la PROFEPA u otras autoridades todo hecho u omisión que dañe o pueda dañar el ambiente o contravenga la ley ambiental.'),
      f('Where there is no PROFEPA office, the report can be filed with the municipal authority, which forwards federal matters to PROFEPA.', 'Donde no haya oficina de la PROFEPA, la denuncia puede presentarse ante la autoridad municipal, que turna a la PROFEPA los asuntos federales.')] },
  { id: 'mx_lfpdppp_2025', kind: 'secondary', jurisdiction: 'MX', verified: '2026-10-19', reviewEveryDays: 180,
    title: 'Ley Federal de Protección de Datos Personales en Posesión de los Particulares (2025), EY summary',
    url: 'https://www.ey.com/es_mx/technical/tax/boletines-fiscales/nueva-ley-federal-proteccion-datos-personal-posesion-particulares',
    facts: [f('The new law was published in the Diario Oficial on March 20, 2025 and took effect on March 21, 2025.', 'La nueva ley se publicó en el Diario Oficial el 20 de marzo de 2025 y entró en vigor el 21 de marzo de 2025.'),
      f('Oversight passed from INAI to the Secretaría Anticorrupción y Buen Gobierno.', 'La supervisión pasó del INAI a la Secretaría Anticorrupción y Buen Gobierno.'),
      f('Transfers of personal data outside the legal exceptions require the person\'s consent, so the privacy notice must mention them.', 'Las transferencias de datos personales fuera de las excepciones legales requieren el consentimiento de la persona, por lo que el aviso de privacidad debe mencionarlas.')] },
  { id: 'qroo_ppa', kind: 'contact', jurisdiction: 'MX-ROO', verified: '2026-10-19', reviewEveryDays: 90,
    title: 'Procuraduría de Protección al Ambiente de Quintana Roo (PPA): privacy notice for environmental complaints (2017)',
    url: 'https://transparenciafocalizada.qroo.gob.mx/sites/default/files/2017-10/Aviso%20de%20Privacidad%20Simplificado%20Denuncias%20en%20Materia%20Ambiental.pdf',
    caution: f('Contact details come from a 2017 notice; confirm them before sending.', 'Los datos de contacto vienen de un aviso de 2017; confírmelos antes de enviar.'),
    facts: [f('The PPA receives environmental complaints under articles 185 to 194 of the state Ley de Equilibrio Ecológico y la Protección del Ambiente.', 'La PPA recibe denuncias ambientales conforme a los artículos 185 a 194 de la Ley de Equilibrio Ecológico y la Protección del Ambiente del estado.'),
      f('Complaints by email to denunciasppa@qroo.gob.mx or in person at its transparency unit.', 'Denuncias por correo a denunciasppa@qroo.gob.mx o en persona en su unidad de transparencia.')] },
  { id: 'tulum_zofemat', kind: 'contact', jurisdiction: 'MX-ROO-Tulum', verified: '2026-10-19', reviewEveryDays: 90,
    title: 'Tulum: ZOFEMAT directorate and sargassum removal (Por Esto, March 2026)',
    url: 'https://www.poresto.com/quintana-roo/riviera-maya/2026/3/10/playas-de-tulum-enfrentan-recale-constante-de-sargazo-brigadas-retiran-mas-de-600-toneladas-durante-el-dia.html',
    facts: [f('Sargassum on Tulum beaches is removed by the Zona Federal Marítimo Terrestre directorate (Zofemat Tulum), with support from the Secretaría de Marina.', 'El sargazo de las playas de Tulum lo retira la Dirección de la Zona Federal Marítimo Terrestre (Zofemat Tulum), con apoyo de la Secretaría de Marina.')] },
  { id: 'us_epa_tips', kind: 'contact', jurisdiction: 'US', verified: '2026-10-19', reviewEveryDays: 180,
    title: 'U.S. EPA: Report Environmental Violations', url: 'https://echo.epa.gov/node/338',
    facts: [f('Possible violations of environmental law can be reported with EPA\'s online form; contact information is optional.', 'Las posibles violaciones a la ley ambiental se reportan con el formulario en línea de la EPA; los datos de contacto son opcionales.'),
      f('For an immediate threat to health or the environment, call 911, then the National Response Center at 1-800-424-8802.', 'Ante una amenaza inmediata a la salud o al ambiente, llamar al 911 y después al National Response Center al 1-800-424-8802.')] },
  { id: 'tx_tceq', kind: 'contact', jurisdiction: 'US-TX', verified: '2026-10-19', reviewEveryDays: 180,
    title: 'Texas Commission on Environmental Quality (TCEQ): how we handle complaints', url: 'https://www.tceq.texas.gov/compliance/complaints/handle-complaint',
    facts: [f('TCEQ receives environmental complaints 24 hours a day, online or by telephone.', 'La TCEQ recibe quejas ambientales las 24 horas, en línea o por teléfono.'),
      f('Complaints can be anonymous, but then TCEQ may not be able to report the results back.', 'Las quejas pueden ser anónimas, pero entonces la TCEQ quizá no pueda informar los resultados.')] },
  { id: 'tx_tdpsa', kind: 'law', jurisdiction: 'US-TX', verified: '2026-10-19', reviewEveryDays: 180,
    title: 'Texas Data Privacy and Security Act (Texas Attorney General)', url: 'https://texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/texas-data-privacy-and-security-act',
    facts: [f('In effect since July 1, 2024.', 'Vigente desde el 1 de julio de 2024.'),
      f('Precise geolocation is sensitive data and may be processed only with the person\'s consent.', 'La geolocalización precisa es un dato sensible y solo puede tratarse con el consentimiento de la persona.'),
      f('People have the right to know, correct and delete their data, and to a clear privacy notice; complaints go to the Texas Attorney General.', 'Las personas tienen derecho a saber, corregir y borrar sus datos y a un aviso de privacidad claro; las quejas van al Procurador General de Texas.')] },
  { id: 'tx_centex_buecher', kind: 'secondary', jurisdiction: 'US-TX', verified: '2026-10-19', reviewEveryDays: 365,
    title: 'Centex Homes v. Buecher, Texas Supreme Court (2002): implied warranties for new homes (case brief)',
    url: 'https://www.lexplug.com/casebrief/centex_homes_v_buecher_66f061fc6807cf34c77abf97',
    facts: [f('The implied warranty of habitability for a new home generally cannot be disclaimed; a waiver is allowed only for specific defects disclosed to the buyer.', 'La garantía implícita de habitabilidad de una vivienda nueva en general no se puede renunciar; solo se permite para defectos específicos informados al comprador.'),
      f('The implied warranty of good and workmanlike construction can be replaced by an express agreement that covers the quality of construction.', 'La garantía implícita de construcción de buena calidad puede reemplazarse por un acuerdo expreso que cubra la calidad de la construcción.')] },
  { id: 'eu_gdpr', kind: 'law', jurisdiction: 'EU', verified: '2026-10-19', reviewEveryDays: 365,
    title: 'General Data Protection Regulation, Regulation (EU) 2016/679', url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
    facts: [f('Applies since May 25, 2018 to personal data of people in the EU.', 'Aplica desde el 25 de mayo de 2018 a los datos personales de personas en la UE.'),
      f('Data must be processed on a lawful basis such as consent; people can access, correct and erase their data.', 'Los datos deben tratarse con una base legal como el consentimiento; las personas pueden acceder, corregir y borrar sus datos.')] }
];

// Topics decide which rules are shown for a report (a pothole does not cite condo law).
const TOPICS = {
  tx_ch27: ['construction'], tx_82_102: ['construction', 'condo'], tx_82_103: ['construction', 'condo'], tx_82_107: ['construction', 'condo'],
  tx_82_119: ['construction', 'condo'], tx_92_052: ['tenant'], tx_16_009: ['construction'], tx_hb2024: ['construction'], tx_limits: ['construction'],
  atx_code: ['construction', 'tenant', 'reporting'], atx_311: ['reporting'], atx_drainage: ['flooding'], atx_dumping: ['dumping'],
  atx_streetlight: ['streetlight'], atx_energy: ['power'], atx_water: ['water'], tx_gas: ['gas'], atx_flood: ['flooding'],
  mx_sargazo_2021: ['sargassum'], mx_h2s_unam: ['sargassum'], qroo_semaforo: ['sargassum'], mx_lanot: ['sargassum'],
  std_nom026: ['safety_signs'], std_osha: ['safety_signs'], std_ansi: ['safety_signs'], std_eu: ['safety_signs'], std_iso3864: ['safety_signs'],
  intl_escazu: ['environment', 'sargassum', 'dumping'], mx_lgeepa_189: ['environment', 'sargassum', 'dumping'], mx_lfpdppp_2025: ['privacy'],
  qroo_ppa: ['environment', 'sargassum', 'dumping'], tulum_zofemat: ['sargassum'], us_epa_tips: ['environment', 'dumping'],
  tx_tceq: ['environment', 'dumping'], tx_tdpsa: ['privacy'], eu_gdpr: ['privacy'], tx_centex_buecher: ['construction']
};
for (const r of REGISTRY) r.topics = r.topics || TOPICS[r.id] || [];

const BY_URL = new Map(REGISTRY.map(r => [r.url, r]));
const DAY = 864e5;

function kb() {
  const k = knowledge._kb();
  k.lawChecks = k.lawChecks || {};
  k.lawChanges = k.lawChanges || [];
  return k;
}

function status(entry) {
  const k = kb();
  const check = k.lawChecks[entry.id];
  const lastChecked = check && check.at && check.at > entry.verified ? check.at.slice(0, 10) : (entry.verified || VERIFIED);
  const pending = k.lawChanges.filter(c => c.lawId === entry.id && c.status === 'open');
  const accepted = k.lawChanges.filter(c => c.lawId === entry.id && c.status === 'accepted' && !c.resolvedInContent);
  const age = (Date.now() - Date.parse(lastChecked)) / DAY;
  const state = accepted.length ? 'changed' : pending.length ? 'pending_change' : (check && check.result === 'unclear') ? 'unclear' : age > entry.reviewEveryDays ? 'due' : 'current';
  return {
    id: entry.id, kind: entry.kind, title: entry.title, url: entry.url, jurisdiction: entry.jurisdiction, countries: entry.countries || null, topics: entry.topics || [], caution: entry.caution || null, facts: entry.facts,
    reviewEveryDays: entry.reviewEveryDays, lastChecked, checkedBy: check ? check.by : 'Comunidad Fuerte', method: check ? check.method : 'page_read',
    nextCheck: new Date(Date.parse(lastChecked) + entry.reviewEveryDays * DAY).toISOString().slice(0, 10),
    state, pending, accepted
  };
}

function list() { return REGISTRY.map(r => status({ ...r, verified: r.verified || VERIFIED })); }
function byId(id) { const r = REGISTRY.find(x => x.id === id); return r ? status({ ...r, verified: r.verified || VERIFIED }) : null; }

// Compact status for the report tab, keyed by the URL each citation uses.
function statusByUrl() {
  const out = {};
  for (const s of list()) out[s.url] = { state: s.state, lastChecked: s.lastChecked, note: s.accepted.length ? s.accepted[0].note : '' };
  return out;
}

function due() { return list().filter(s => s.state === 'due' || s.state === 'unclear'); }

function recordCheck(lawId, { result, by, method, note, sourceUrl }) {
  const entry = REGISTRY.find(r => r.id === lawId);
  if (!entry) throw bad('Rule not found.');
  kb().lawChecks[lawId] = { at: new Date().toISOString(), result, by, method, note: note || '', sourceUrl: sourceUrl || '' };
  knowledge._log('law', `${entry.title}: ${result === 'still_accurate' ? 'still accurate' : result} (${by}).`);
  knowledge._save();
}

// A reviewer confirms by hand that the rule still says what the app uses.
function markVerified(lawId, reviewer, note) {
  if (!reviewer || !String(reviewer).trim()) throw bad('A named reviewer is required.');
  recordCheck(lawId, { result: 'still_accurate', by: String(reviewer).trim().slice(0, 80), method: 'human', note: String(note || '').slice(0, 500) });
  // Re-checking after a confirmed change means the app text was updated to match.
  kb().lawChanges.filter(c => c.lawId === lawId && c.status === 'accepted').forEach(c => { c.resolvedInContent = true; });
  knowledge._save();
  return status({ ...REGISTRY.find(r => r.id === lawId), verified: VERIFIED });
}

function proposeChange(lawId, { facts, note, sourceUrl, sourceTitle, by }) {
  const entry = REGISTRY.find(r => r.id === lawId);
  if (!entry) throw bad('Rule not found.');
  const c = { id: newId('law'), lawId, title: entry.title, facts: facts || [], note: String(note || '').slice(0, 1000), sourceUrl: sourceUrl || '', sourceTitle: sourceTitle || '', by: by || 'live check', status: 'open', at: new Date().toISOString() };
  kb().lawChanges.unshift(c);
  knowledge._log('law', `Possible change found in ${entry.title}; waiting for a reviewer.`);
  knowledge._save();
  return c;
}

function resolveChange(id, decision, reviewer, note) {
  if (!['accepted', 'declined'].includes(decision)) throw bad('Decision must be accepted or declined.');
  if (!reviewer || !String(reviewer).trim()) throw bad('A named reviewer is required.');
  const c = kb().lawChanges.find(x => x.id === id);
  if (!c) throw bad('Change not found.');
  Object.assign(c, { status: decision, reviewer: String(reviewer).trim().slice(0, 80), reviewNote: String(note || '').slice(0, 500), resolvedAt: new Date().toISOString() });
  if (decision === 'declined') recordCheck(c.lawId, { result: 'still_accurate', by: c.reviewer, method: 'human', note: 'Proposed change declined: ' + (note || '') });
  knowledge._log('law', `${c.reviewer} ${decision} the proposed change to ${c.title}.`);
  knowledge._save();
  return c;
}

async function checkOne(ai, lawId) {
  const s = list().find(r => r.id === lawId);
  if (!s) throw bad('Rule not found.');
  const r = await ai.checkRule(s);
  if (r.result === 'changed') proposeChange(lawId, { facts: r.facts, note: r.note, sourceUrl: r.sourceUrl, sourceTitle: r.sourceTitle, by: 'live check (Claude + web search)' });
  else recordCheck(lawId, { result: r.result, by: 'live check (Claude + web search)', method: 'ai_web', note: r.note, sourceUrl: r.sourceUrl });
  return { result: r.result, rule: list().find(x => x.id === lawId) };
}

// Live re-check of the rules that are due. At most `limit` per run to keep cost low.
async function checkDue(ai, limit = 6) {
  const todo = due().slice(0, limit);
  let checked = 0;
  let changes = 0;
  for (const s of todo) {
    try {
      const r = await ai.checkRule(s);
      checked++;
      if (r.result === 'changed') {
        proposeChange(s.id, { facts: r.facts, note: r.note, sourceUrl: r.sourceUrl, sourceTitle: r.sourceTitle, by: 'live check (Claude + web search)' });
        changes++;
      } else {
        recordCheck(s.id, { result: r.result, by: 'live check (Claude + web search)', method: 'ai_web', note: r.note, sourceUrl: r.sourceUrl });
      }
    } catch (err) {
      knowledge._log('error', `Rule check failed for ${s.title}: ${err.message}`);
    }
  }
  knowledge._save();
  return { checked, changes, due: todo.length };
}

module.exports = { REGISTRY, byId, checkOne, list, statusByUrl, due, markVerified, proposeChange, resolveChange, checkDue, BY_URL, VERIFIED };
