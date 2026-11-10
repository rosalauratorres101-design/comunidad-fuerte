'use strict';
// Sargassum: every solution found in the science and in practice, including
// ones not yet used in Mexico, sorted by stage. Each one says who can do it
// (community, authorities, industry, research), how proven it is, and any
// caution (arsenic, unknown impacts, rules). Sources opened on CHECKED.

const CHECKED = '2026-10-19';
const t = (en, es) => ({ en, es });
const ALL = ['green', 'yellow', 'red'];
const ACT = ['green', 'yellow'];

// Stage and actor for the sargassum methods already in content.js.
const EXISTING = {
  'sarg-48h': { stage: 'beach', actor: 'community' },
  'sarg-ppe': { stage: 'health', actor: 'community' },
  'sarg-forecast': { stage: 'prediction', actor: 'community' },
  'sarg-no-food': { stage: 'use', actor: 'community' }
};

const SRC = {
  lanot: { title: 'LANOT-UNAM: Monitoreo de sargazo (satélite y pronóstico de recale)', url: 'https://www.lanot.unam.mx/home/sargazo/' },
  semaforo: { title: 'Imagen Radio: cómo consultar el semáforo del sargazo (Red de Monitoreo del Sargazo, 2026)', url: 'https://www.imagenradio.com.mx/noticias/semaforo-sargazo-hoy-como-consultar-playas-limpias-afectadas-caribe-mexicano' },
  coastsnap: { title: 'University of Southampton and UNAM: citizen monitoring for a sargassum early warning system', url: 'https://www.southampton.ac.uk/research/projects/citizen-monitoring-for-the-development-of-a-sargassum-early-warning-system' },
  semar: { title: 'Riviera Maya News: Mexican Navy adds 15 sargassum vessels (Sept 2026)', url: 'https://www.rivieramayanews.mx/mexican-navy-to-reinforce-sargassum-cleanup-with-15-new-vessels-in-the-mexican-caribbean/' },
  record: { title: 'Por Esto: 2026 rompe récord con 138 mil toneladas recolectadas (1 oct 2026)', url: 'https://www.poresto.com/quintana-roo/2026/10/1/sargazo-en-quintana-roo-2026-rompe-record-con-138-mil-toneladas-recolectadas.html' },
  antigua: { title: 'The Caribbean Camera: Antigua deploys sargassum harvester (Sept 2025)', url: 'https://thecaribbeancamera.com/antigua-deploys-sargassum-harvester/' },
  seafields: { title: 'US Harbors: Seafields seaweed baling and sinking test (2023)', url: 'https://www.usharbors.com/2023/09/carbon-removal-start-up-successfully-completes-the-worlds-first-seaweed-baling-and-sinking-test/' },
  semarnat: { title: 'SEMARNAT-INECC (2021): Lineamientos técnicos y de gestión para la atención de la contingencia por sargazo', url: 'https://sargazo.icmyl.unam.mx/en/Files/SEMARNAT2021.pdf' },
  h2s: { title: 'UNAM ICMyL: gas tóxico del sargazo (ácido sulfhídrico) en playas', url: 'https://www.icmyl.unam.mx/Pdf/Home/2024/Nota. gas toxico sargazo.pdf' },
  leachate: { title: 'Leal-Bautista et al. (2024), Water 16(19):2719: lixiviados de sargazo en el Caribe mexicano, movilidad de metales', url: 'https://www.mdpi.com/2073-4441/16/19/2719' },
  sargablock: { title: 'UnoTV: Sargablock beneficia a familias en Quintana Roo (junio 2025)', url: 'https://www.unotv.com/ciencia-y-tecnologia/crean-sargablock-benefician-familias-quintana-roo/' },
  carbonwave: { title: 'Mexico News Daily: From nuisance to raw material (May 2026)', url: 'https://mexiconewsdaily.com/yucatan-peninsula/from-nuisance-to-raw-material-trying-to-solve-the-sargassum-crisis/' },
  review: { title: 'Devault et al. (2020): Sargassum contamination and consequences for downstream uses, a review', url: 'https://sargcoop.org/wp-content/uploads/2020/11/Devault-2020-Sargassum-contamination-and-consequences-for-downstream-uses_-a-review.pdf' },
  veggies: { title: 'DCNA (2022): Sargassum fertilizer transfers heavy metals to vegetables', url: 'https://dcnanature.org/sargassum-fertilizer/' },
  alginate: { title: 'Florida State University: new value in pelagic sargassum, alginate (May 2026)', url: 'https://xray.unicomm.fsu.edu/?p=128089' },
  adsorbent: { title: 'González Fernández et al. (2023), IJERPH 20:2559: Sargassum biomass for heavy-metal-contaminated water', url: 'https://digibug.ugr.es/handle/10481/95099' },
  biogas: { title: 'López-González et al. (2025): Producción de biogás a partir de sargazo, desafíos y estrategias', url: 'https://camjol.info/index.php/PAyDS/article/view/20174' },
  htl: { title: 'Allen and Pearce (2024), ChemEngineering 8(2):29: continuous hydrothermal liquefaction of Mexican Sargassum', url: 'https://doaj.org/article/547ad836107b496e9922f079a36119dd' },
  products: { title: 'UnoTV: qué hacen con el sargazo recolectado, ladrillos, papel y cosméticos (junio 2025)', url: 'https://www.unotv.com/nacional/que-hacen-con-el-sargazo-recolectado-de-residuos-a-ladrillos-papel-y-hasta-cosmeticos/' },
  shoes: { title: 'Mexico News Daily: eco-shoes made with sargassum and plastic bottles (2019)', url: 'https://mexiconewsdaily.com/news/eco-shoes-are-made-with-sargassum-seaweed/' },
  causes: { title: 'Science News on Wang et al. (2019), Science 365:83, The great Atlantic Sargassum belt', url: 'https://www.sciencenews.org/article/largest-seaweed-bloom-ever-detected-atlantic-ocean-2018?tgt=nr' }
};

const src = (k, how, official) => ({ ...SRC[k], checked: CHECKED, how, official: Boolean(official) });

const METHODS = [
  // ---- Prediction and monitoring ----------------------------------------
  { id: 'sarg-lanot', stage: 'prediction', actor: 'community', types: ['sargassum'], tiers: ALL,
    title: t('Check the UNAM satellite map and stranding forecast', 'Consultar el mapa satelital y el pronóstico de recale de la UNAM'),
    summary: t('LANOT-UNAM processes a mosaic of about 18 satellite scenes every five days for the Mexican Caribbean, with a drift and a stranding forecast. Clouds can hide sargassum, so a day without detections does not mean none.', 'El LANOT-UNAM procesa cada cinco días un mosaico de unas 18 escenas satelitales del Caribe mexicano, con pronóstico de deriva y de recale. Las nubes pueden ocultar el sargazo: un día sin detecciones no significa que no haya.'),
    cost: 'low', skill: 'basic', evidence: 'field_tested', time: t('Every 5 days', 'Cada 5 días'), materials: t('Phone with internet', 'Teléfono con internet'), source: src('lanot', 'page_read', true) },
  { id: 'sarg-semaforo', stage: 'prediction', actor: 'community', types: ['sargassum'], tiers: ALL,
    title: t('Quintana Roo: check the daily sargassum traffic light', 'Quintana Roo: consultar el semáforo diario del sargazo'),
    summary: t('The Red de Monitoreo del Sargazo rates 140 coastal points daily in five colors, from blue (none) to red (excessive); it is posted at facebook.com/RedSargazo. It measures how much sargassum there is, not how dangerous it is to work near it: the app\'s safety level is separate.', 'La Red de Monitoreo del Sargazo califica a diario 140 puntos de costa en cinco colores, de azul (sin sargazo) a rojo (excesivo); se publica en facebook.com/RedSargazo. Mide cuánto sargazo hay, no qué tan peligroso es trabajar cerca: el nivel de seguridad de la app es aparte.'),
    cost: 'low', skill: 'basic', evidence: 'field_tested', time: t('Daily', 'Diario'), materials: t('Phone with internet', 'Teléfono con internet'), source: src('semaforo', 'page_read', false) },
  { id: 'sarg-coastsnap', stage: 'prediction', actor: 'community', types: ['sargassum'], tiers: ACT,
    title: t('Join citizen monitoring with fixed photo stations', 'Participar en el monitoreo ciudadano con estaciones fijas de foto'),
    summary: t('A UNAM and University of Southampton project installs CoastSnap stations in Puerto Morelos, Cozumel, Akumal and Xcalak, where residents photograph the coast to build an early warning system. Communities elsewhere can copy the idea with a fixed phone mount.', 'Un proyecto de la UNAM y la Universidad de Southampton instala estaciones CoastSnap en Puerto Morelos, Cozumel, Akumal y Xcalak, donde los vecinos fotografían la costa para crear un sistema de alerta temprana. Otras comunidades pueden copiar la idea con un soporte fijo para teléfono.'),
    cost: 'low', skill: 'basic', evidence: 'experimental', time: t('Ongoing', 'Continuo'), materials: t('Fixed phone mount and a sign', 'Soporte fijo para teléfono y un letrero'), source: src('coastsnap', 'page_read', false) },

  // ---- At sea ------------------------------------------------------------
  { id: 'sarg-semar-sea', stage: 'offshore', actor: 'authorities', types: ['sargassum'], tiers: ALL,
    title: t('Stop it at sea: barriers and collection vessels', 'Detenerlo en el mar: barreras y barcos recolectores'),
    summary: t('In Quintana Roo the Navy (SEMAR) leads at-sea work: 13,380 m of barriers were installed in 2026, 11 collection ships operate (the Natans collects about 250 t a day) and 15 more vessels are being added through 2027. The state reported 138,000 t collected in 2026, a record.', 'En Quintana Roo la Marina (SEMAR) encabeza el trabajo en el mar: en 2026 se instalaron 13,380 m de barreras, operan 11 barcos recolectores (el Natans recoge unas 250 t al día) y se suman 15 embarcaciones más hasta 2027. El estado reportó 138,000 t recolectadas en 2026, un récord.'),
    cost: 'high', skill: 'specialist', evidence: 'field_tested', time: t('Season-long', 'Toda la temporada'), materials: t('Navy vessels and barriers', 'Barcos y barreras de la Marina'), source: src('semar', 'page_read', false) },
  { id: 'sarg-small-harvester', stage: 'offshore', actor: 'authorities', types: ['sargassum'], tiers: ALL,
    title: t('Small coastal harvester boats for towns without a navy fleet', 'Barcos recolectores pequeños para pueblos sin flota naval'),
    summary: t('Antigua and Barbuda received a harvester boat (donated through Japan\'s JICS) that carries up to 7,500 kg and is run by the coast guard, to move "from reactive beach clean-ups to proactive sea-based interception". A model for municipalities and cooperatives seeking international aid.', 'Antigua y Barbuda recibió un barco recolector (donado mediante JICS de Japón) que carga hasta 7,500 kg y lo opera la guardia costera, para pasar "de limpiar playas a interceptar en el mar". Un modelo para municipios y cooperativas que busquen apoyo internacional.'),
    cost: 'high', skill: 'specialist', evidence: 'field_tested', time: t('Months to acquire', 'Meses para adquirir'), materials: t('Harvester boat, trained crew', 'Barco recolector, tripulación capacitada'), source: src('antigua', 'page_read', false) },
  { id: 'sarg-deep-sinking', stage: 'offshore', actor: 'research', types: ['sargassum'], tiers: ALL,
    title: t('Experimental: sinking baled sargassum to the deep sea', 'Experimental: hundir sargazo empacado en el mar profundo'),
    summary: t('A UK company sank test bales at 3,483 m in 2023 to study carbon storage; no results on deep-sea impacts were reported. In Mexico, the 2021 federal guidelines prohibit dumping or sinking collected sargassum at sea.', 'Una empresa británica hundió pacas de prueba a 3,483 m en 2023 para estudiar el almacenamiento de carbono; no se reportaron resultados sobre impactos en el fondo marino. En México, los lineamientos federales de 2021 prohíben verter o hundir en el mar el sargazo recolectado.'),
    caution: t('Not allowed in Mexico. Impacts on deep-sea life are unknown.', 'No está permitido en México. Se desconocen los impactos en la vida del fondo marino.'),
    cost: 'high', skill: 'specialist', evidence: 'experimental', time: t('Research stage', 'En investigación'), materials: t('Not for communities', 'No es para comunidades'), source: src('seafields', 'page_read', false) },

  // ---- On the beach ------------------------------------------------------
  { id: 'sarg-semarnat-rules', stage: 'beach', actor: 'community', types: ['sargassum'], tiers: ACT,
    title: t('Follow the official beach rules: by hand, within 72 hours, never burn or bury', 'Seguir las reglas oficiales en playa: a mano, en menos de 72 horas, nunca quemar ni enterrar'),
    summary: t('Mexico\'s 2021 federal guidelines: remove sargassum by hand; machinery only if volumes make it impossible, light and on soft tires, within 3 m of the high-tide line, never in the dry zone of turtle nesting beaches. Remove within 72 hours, recover the sand for the dunes, keep it separate from other waste, and take it to an authorized site. Burning, burying on the beach and dumping at sea are prohibited.', 'Lineamientos federales de 2021: retirar el sargazo a mano; maquinaria solo si el volumen lo hace imposible, ligera y con llantas suaves, dentro de 3 m de la línea de marea alta, y nunca en la zona seca de playas de anidación de tortugas. Retirarlo en menos de 72 horas, recuperar la arena para las dunas, mantenerlo separado de otros residuos y llevarlo a un sitio autorizado. Se prohíbe quemarlo, enterrarlo en la playa o tirarlo al mar.'),
    cost: 'low', skill: 'basic', evidence: 'field_tested', time: t('Within 72 hours', 'En menos de 72 horas'), materials: t('Rakes, forks, wheelbarrows, sacks; a hauling plan to an authorized site', 'Rastrillos, bieldos, carretillas, costales; un plan de traslado a un sitio autorizado'), source: src('semarnat', 'page_read', true) },
  { id: 'sarg-leachate', stage: 'beach', actor: 'community', types: ['sargassum'], tiers: ALL,
    title: t('Do not leave piles on sand or near cenotes: the runoff carries arsenic', 'No dejar montones en la arena ni cerca de cenotes: el escurrimiento lleva arsénico'),
    summary: t('Leachate from decomposing sargassum in the Mexican Caribbean reached 12 to 14 mg/L of arsenic, far above Mexico\'s wastewater limit (NOM-001-SEMARNAT-2021); the authors warn of risk to coastal water and the shallow karst aquifer. Store it briefly on an impermeable surface away from the beach and water.', 'Los lixiviados del sargazo en descomposición en el Caribe mexicano llegaron a 12 a 14 mg/L de arsénico, muy por encima del límite mexicano para aguas residuales (NOM-001-SEMARNAT-2021); los autores advierten riesgo para el agua costera y el acuífero kárstico somero. Guárdalo poco tiempo sobre una superficie impermeable, lejos de la playa y del agua.'),
    caution: t('Arsenic runoff can reach groundwater in the karst.', 'El escurrimiento con arsénico puede llegar al agua subterránea del karst.'),
    cost: 'low', skill: 'basic', evidence: 'lab_studied', time: t('Every collection', 'En cada recolección'), materials: t('Tarp or impermeable surface', 'Lona o superficie impermeable'), source: src('leachate', 'page_read', false) },

  // ---- Health ------------------------------------------------------------
  { id: 'sarg-h2s-5ppm', stage: 'health', actor: 'community', types: ['sargassum'], tiers: ALL,
    title: t('Gas monitor: move crews away at 5 ppm of hydrogen sulfide', 'Monitor de gas: retirar a la brigada a 5 ppm de ácido sulfhídrico'),
    summary: t('A UNAM study found collectors exposed above 5 ppm of hydrogen sulfide 23.4% of their work time; higher piles trap more gas. It recommends removal within 48 hours, moving crews away at 5 ppm, and limiting time near the piles for pregnant women, children, older adults and people with asthma or heart failure.', 'Un estudio de la UNAM encontró recolectores expuestos a más de 5 ppm de ácido sulfhídrico el 23.4% de su jornada; los montones altos atrapan más gas. Recomienda retirar el sargazo en 48 horas, alejar a la brigada a 5 ppm y limitar el tiempo cerca de los montones para embarazadas, niños, personas mayores y personas con asma o insuficiencia cardiaca.'),
    cost: 'medium', skill: 'basic', evidence: 'field_tested', time: t('Every shift', 'Cada turno'), materials: t('Portable H2S monitor, short shifts, low piles', 'Monitor portátil de H2S, turnos cortos, montones bajos'), source: src('h2s', 'page_read', true) },

  // ---- Uses (valorization) -----------------------------------------------
  { id: 'sarg-sargablock', stage: 'use', actor: 'industry', types: ['sargassum'], tiers: ACT,
    title: t('Building blocks with sargassum (Sargablock)', 'Bloques de construcción con sargazo (Sargablock)'),
    summary: t('Blue Green\'s Sargablock (patented 2019) is 40% sargassum and 60% organic matter; homes for 19 low-income families and public buildings were built with it, using about 1,000 t of sargassum.', 'El Sargablock de Blue Green (patentado en 2019) lleva 40% de sargazo y 60% de materia orgánica; con él se construyeron casas para 19 familias de bajos recursos y edificios públicos, usando unas 1,000 t de sargazo.'),
    cost: 'medium', skill: 'trained', evidence: 'field_tested', time: t('Ongoing production', 'Producción continua'), materials: t('Partner with the producer; fresh, sand-free sargassum', 'Alianza con el productor; sargazo fresco y sin arena'), source: src('sargablock', 'page_read', false) },
  { id: 'sarg-carbonwave', stage: 'use', actor: 'industry', types: ['sargassum'], tiers: ACT,
    title: t('Industrial processing: crop biostimulant and cosmetic emulsifier', 'Procesamiento industrial: bioestimulante agrícola y emulsificante cosmético'),
    summary: t('Carbonwave processes sargassum in Puerto Morelos (about 20,000 t collected last year, about 20 t a day). It sells a crop biostimulant certified in Mexico and a cosmetic emulsifier used in 60 products; a leather-like textile is still a prototype. Yield claims are the company\'s own. Most collected sargassum still goes to landfill.', 'Carbonwave procesa sargazo en Puerto Morelos (unas 20,000 t recolectadas el año pasado, unas 20 t al día). Vende un bioestimulante agrícola certificado en México y un emulsificante cosmético usado en 60 productos; un textil tipo piel sigue en prototipo. Los datos de rendimiento son de la propia empresa. La mayor parte del sargazo recolectado aún termina en relleno sanitario.'),
    cost: 'high', skill: 'specialist', evidence: 'field_tested', time: t('Ongoing', 'Continuo'), materials: t('A buyer agreement; fresh, sand-free sargassum', 'Acuerdo con un comprador; sargazo fresco y sin arena'), source: src('carbonwave', 'page_read', false) },
  { id: 'sarg-cocompost', stage: 'use', actor: 'community', types: ['sargassum'], tiers: ACT,
    title: t('Co-composting: at most 10% sargassum, never for food crops untested', 'Co-composta: máximo 10% de sargazo, nunca para cultivos de comida sin análisis'),
    summary: t('A review found co-composting up to 10% fresh sargassum with green waste or bagasse met French compost standards, with arsenic monitored in the runoff. Spreading raw sargassum on soil does not: vegetables grown with sargassum had up to 37 times more arsenic. Use the compost for ornamental plants, slopes or reforestation unless a lab test clears it.', 'Una revisión encontró que co-compostar hasta 10% de sargazo fresco con residuos verdes o bagazo cumplió las normas francesas de composta, vigilando el arsénico en el escurrimiento. Esparcir sargazo crudo en la tierra no: hortalizas cultivadas con sargazo tuvieron hasta 37 veces más arsénico. Usa la composta en plantas de ornato, taludes o reforestación, salvo que un análisis de laboratorio la apruebe.'),
    caution: t('Arsenic: not for vegetables or animal feed without a lab test.', 'Arsénico: no para hortalizas ni forraje sin análisis de laboratorio.'),
    cost: 'low', skill: 'trained', evidence: 'lab_studied', time: t('2 to 4 months', '2 a 4 meses'), materials: t('Green waste or bagasse, covered site, lab test', 'Residuos verdes o bagazo, sitio techado, análisis de laboratorio'), source: src('review', 'page_read', false), extraSources: [src('veggies', 'page_read', false)] },
  { id: 'sarg-products', stage: 'use', actor: 'community', types: ['sargassum'], tiers: ACT,
    title: t('Small-scale products: paper, packaging, shoes, artisan cosmetics', 'Productos a pequeña escala: papel, empaques, calzado, cosmética artesanal'),
    summary: t('Local makers produce paper and biodegradable packaging from dried sargassum fiber and artisan masks and creams; Renovare designed shoes with soles of 100 g of sargassum plus five recycled PET bottles. Volumes are small, but they create local income and awareness.', 'Productores locales fabrican papel y empaques biodegradables con fibra de sargazo seco, y mascarillas y cremas artesanales; Renovare diseñó zapatos con suela de 100 g de sargazo más cinco botellas de PET recicladas. Los volúmenes son pequeños, pero generan ingreso local y conciencia.'),
    caution: t('Cosmetics on skin need arsenic testing of each batch.', 'Los cosméticos para la piel necesitan análisis de arsénico por lote.'),
    cost: 'low', skill: 'trained', evidence: 'field_tested', time: t('Weeks', 'Semanas'), materials: t('Dried, washed sargassum; simple presses', 'Sargazo seco y lavado; prensas sencillas'), source: src('products', 'page_read', false), extraSources: [src('shoes', 'page_read', false)] },
  { id: 'sarg-alginate', stage: 'use', actor: 'research', types: ['sargassum'], tiers: ACT,
    title: t('Food-grade alginate extracted and purified from sargassum', 'Alginato de grado alimenticio extraído y purificado del sargazo'),
    summary: t('Florida State University (2026) recovered sodium alginate from pelagic sargassum with performance comparable to commercial alginate. Raw sargassum is not edible (salt, fiber, heavy metals); purification removes much of that, and batch safety must be monitored before large-scale use.', 'La Universidad Estatal de Florida (2026) recuperó alginato de sodio del sargazo pelágico con desempeño comparable al comercial. El sargazo crudo no es comestible (sal, fibra, metales pesados); la purificación elimina gran parte, y hay que vigilar la seguridad de cada lote antes de usarlo a gran escala.'),
    cost: 'high', skill: 'specialist', evidence: 'lab_studied', time: t('Research stage', 'En investigación'), materials: t('Laboratory', 'Laboratorio'), source: src('alginate', 'page_read', false) },
  { id: 'sarg-adsorbent', stage: 'use', actor: 'research', types: ['sargassum'], tiers: ACT,
    title: t('Cleaning polluted water: sargassum as a metal adsorbent', 'Limpiar agua contaminada: sargazo como adsorbente de metales'),
    summary: t('In laboratory tests (2023), sargassum biomass captured up to 350 mg of lead and 240 mg of cadmium per gram, outperforming common adsorbents. Not yet tested in the field.', 'En pruebas de laboratorio (2023), la biomasa de sargazo capturó hasta 350 mg de plomo y 240 mg de cadmio por gramo, superando a adsorbentes comunes. Aún no se prueba en campo.'),
    cost: 'medium', skill: 'specialist', evidence: 'lab_studied', time: t('Research stage', 'En investigación'), materials: t('Laboratory', 'Laboratorio'), source: src('adsorbent', 'page_read', false) },
  { id: 'sarg-biogas', stage: 'use', actor: 'research', types: ['sargassum'], tiers: ACT,
    title: t('Biogas from sargassum', 'Biogás a partir de sargazo'),
    summary: t('A 2025 review concludes biogas from sargassum is feasible at laboratory scale; industrial scale depends on technical, economic and social factors. Salt, sand and arsenic complicate digestion and the leftover digestate.', 'Una revisión de 2025 concluye que el biogás de sargazo es factible a escala de laboratorio; la escala industrial depende de factores técnicos, económicos y sociales. La sal, la arena y el arsénico complican la digestión y el residuo que queda.'),
    cost: 'high', skill: 'specialist', evidence: 'lab_studied', time: t('Research stage', 'En investigación'), materials: t('Digester, laboratory support', 'Biodigestor, apoyo de laboratorio'), source: src('biogas', 'page_read', false) },
  { id: 'sarg-biooil', stage: 'use', actor: 'research', types: ['sargassum'], tiers: ACT,
    title: t('Experimental: bio-oil by continuous hydrothermal liquefaction', 'Experimental: bioaceite por licuefacción hidrotérmica continua'),
    summary: t('Researchers ran Mexican sargassum through a continuous-flow hydrothermal liquefaction system (2024) and compared the bio-oil with crude oil fractions. An early industrial route; not for communities yet.', 'Investigadores procesaron sargazo mexicano en un sistema continuo de licuefacción hidrotérmica (2024) y compararon el bioaceite con fracciones de petróleo. Una ruta industrial temprana; todavía no es para comunidades.'),
    cost: 'high', skill: 'specialist', evidence: 'experimental', time: t('Research stage', 'En investigación'), materials: t('Pilot plant', 'Planta piloto'), source: src('htl', 'page_read', false) },

  // ---- Root causes --------------------------------------------------------
  { id: 'sarg-root-causes', stage: 'causes', actor: 'research', types: ['sargassum'], tiers: ALL,
    title: t('Long term: the cause is upstream, in ocean nutrients', 'A largo plazo: la causa está río arriba, en los nutrientes del océano'),
    summary: t('A 2019 study in Science linked the Great Atlantic Sargassum Belt to nutrients from the Amazon River and natural upwelling off West Africa, and warned that more fertilizer use and deforestation could make large blooms a "new normal". Reducing nutrient runoff is the only lever that addresses the source; it needs regional and international policy.', 'Un estudio de 2019 en Science relacionó el Gran Cinturón de Sargazo del Atlántico con nutrientes del río Amazonas y el afloramiento natural frente a África occidental, y advirtió que más fertilizantes y deforestación podrían volver los grandes florecimientos una "nueva normalidad". Reducir los nutrientes que llegan al mar es la única palanca que ataca el origen; requiere política regional e internacional.'),
    cost: 'high', skill: 'specialist', evidence: 'lab_studied', time: t('Decades', 'Décadas'), materials: t('Policy and research', 'Política e investigación'), source: src('causes', 'page_read', false) }
];

// Organizations and channels in Quintana Roo (place-filtered).
const QROO = 'quintana roo|q\\.? ?roo|tulum|canc[uú]n|playa del carmen|puerto morelos|cozumel|akumal|mahahual|xcalak|bacalar|chetumal|holbox|isla mujeres|felipe carrillo|riviera maya';
const ORGS_QROO = [
  { id: 'mx-zofemat', urgency: 'authority', countries: ['MX'], places: QROO,
    name: t('Municipal ZOFEMAT (federal beach zone office of the municipality)', 'ZOFEMAT municipal (Zona Federal Marítimo Terrestre)'),
    contact: t('Ask at the town hall (in Tulum: ZOFEMAT Tulum). Hotels clean their own frontage.', 'Pregunta en el ayuntamiento (en Tulum: ZOFEMAT Tulum). Los hoteles limpian su propio frente de playa.'),
    why: t('Its crews collect sargassum on public beaches with the Navy and the state; coordinate a community brigade with them so the waste goes to an authorized site.', 'Sus cuadrillas recogen el sargazo en playas públicas junto con la Marina y el estado; coordina con ellos una brigada comunitaria para que el sargazo vaya a un sitio autorizado.'),
    source: { title: 'The Tulum Times: ZOFEMAT crews haul sargassum in Tulum (2026)', url: 'https://tulumtimes.com/zofemat-crews-haul-sargassum-tulum', checked: CHECKED, how: 'page_read' }, confidence: 'located' },
  { id: 'mx-redsargazo', urgency: 'science', countries: ['MX'], places: QROO,
    name: t('Red de Monitoreo del Sargazo (daily traffic light)', 'Red de Monitoreo del Sargazo (semáforo diario)'),
    contact: t('facebook.com/RedSargazo', 'facebook.com/RedSargazo'),
    why: t('Daily presence level for 140 coastal points, to plan brigades and warn neighbors.', 'Nivel diario de presencia en 140 puntos de costa, para planear brigadas y avisar a los vecinos.'),
    source: { title: SRC.semaforo.title, url: SRC.semaforo.url, checked: CHECKED, how: 'page_read' }, confidence: 'located' },
  { id: 'mx-lanot', urgency: 'science', countries: ['MX'], places: QROO,
    name: t('LANOT-UNAM sargassum monitoring', 'Monitoreo de sargazo del LANOT-UNAM'),
    contact: t('lanot.unam.mx/home/sargazo', 'lanot.unam.mx/home/sargazo'),
    why: t('Satellite map and stranding forecast every five days.', 'Mapa satelital y pronóstico de recale cada cinco días.'),
    source: { title: SRC.lanot.title, url: SRC.lanot.url, checked: CHECKED, how: 'page_read', official: true }, confidence: 'official' }
];

module.exports = { CHECKED, EXISTING, METHODS, ORGS_QROO, SRC, QROO };
