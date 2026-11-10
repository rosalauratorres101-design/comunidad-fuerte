'use strict';
// Curated knowledge base used in demo mode and as the verified seed list in
// live mode. Rule: every remediation method and every organization carries a
// source URL and how it was checked. Nothing without a source is shown as fact.

const CHECKED = '2026-10-17';

const TYPE_LABELS = {
  sargassum: { en: 'Sargassum seaweed', es: 'Sargazo' },
  oil: { en: 'Oil or fuel', es: 'Aceite o combustible' },
  water_discoloration: { en: 'Foam or discolored water', es: 'Espuma o agua de color extraño' },
  wildlife_mortality: { en: 'Dead fish or animals', es: 'Peces o animales muertos' },
  chemical_unknown: { en: 'Unknown chemical', es: 'Químico desconocido' },
  plastic_waste: { en: 'Plastic and solid waste', es: 'Plástico y residuos sólidos' },
  smoke_burning: { en: 'Smoke or burning', es: 'Humo o quema' },
  structural_damage: { en: 'Damaged stairs, railing or walkway', es: 'Escalera, barandal o andador dañado' },
  unknown: { en: 'Not yet identified', es: 'Aún sin identificar' }
};

// ---------------------------------------------------------------------------
// Safety protocols per tier, 10 languages. Each step has a pictogram key.
// reviewStatus: English and Spanish are drafts awaiting the author's expert
// review; the other eight are machine translations awaiting native review.
// ---------------------------------------------------------------------------
const PROTOCOL_ICONS = {
  green: ['gloves', 'tools', 'nofire', 'bag', 'water'],
  yellow: ['wind', 'ppe', 'people', 'smell', 'health'],
  red: ['notouch', 'away', 'people', 'photo', 'call']
};

const PROTOCOLS = {
  en: {
    name: 'English', dir: 'ltr',
    green: { title: 'You can act, with care', steps: ['Wear gloves and closed shoes.', 'Use rakes and shovels, not bare hands.', 'Never burn waste or seaweed.', 'Bag the waste and take it to the agreed collection point.', 'Drink water and rest in the shade.'] },
    yellow: { title: 'Act only with protection', steps: ['Stand with the wind at your back and work in short shifts (30 minutes at most).', 'Gloves, boots and eye protection are required.', 'Keep children, pregnant people and people with asthma away.', 'A rotten-egg smell means hydrogen sulfide gas. If the smell suddenly disappears, leave: the gas may be too strong to smell.', 'Headache, dizziness or burning eyes: stop, move away and get medical care.'] },
    red: { title: 'Do not touch. Move away.', steps: ['Do not touch, open, move or smell anything.', 'Move at least 100 meters away, with the wind at your back, to higher ground.', 'Keep everyone away, including animals. Do not use the water.', 'Take photos only from where you are, using zoom.', 'Call emergency services if anyone feels sick. Report it here.'] }
  },
  es: {
    name: 'Español', dir: 'ltr',
    green: { title: 'Puedes actuar, con cuidado', steps: ['Usa guantes y zapatos cerrados.', 'Usa rastrillos y palas, no las manos.', 'Nunca quemes la basura ni el sargazo.', 'Embolsa los residuos y llévalos al punto de acopio acordado.', 'Toma agua y descansa a la sombra.'] },
    yellow: { title: 'Actúa solo con protección', steps: ['Colócate con el viento a tu espalda y trabaja en turnos cortos (30 minutos como máximo).', 'Guantes, botas y protección para los ojos son obligatorios.', 'Mantén lejos a niños, embarazadas y personas con asma.', 'El olor a huevo podrido es gas sulfhídrico. Si el olor desaparece de repente, aléjate: puede estar tan fuerte que ya no lo hueles.', 'Dolor de cabeza, mareo u ojos irritados: detente, aléjate y busca atención médica.'] },
    red: { title: 'No toques. Aléjate.', steps: ['No toques, abras, muevas ni huelas nada.', 'Aléjate al menos 100 metros, con el viento a tu espalda, hacia un lugar alto.', 'Mantén a todos lejos, también a los animales. No uses el agua.', 'Toma fotos solo desde donde estás, con zoom.', 'Llama a emergencias si alguien se siente mal. Repórtalo aquí.'] }
  },
  fr: {
    name: 'Français', dir: 'ltr',
    green: { title: 'Vous pouvez agir, avec prudence', steps: ['Portez des gants et des chaussures fermées.', 'Utilisez des râteaux et des pelles, pas les mains nues.', 'Ne brûlez jamais les déchets ni les algues.', 'Mettez les déchets en sac et apportez-les au point de collecte convenu.', "Buvez de l'eau et reposez-vous à l'ombre."] },
    yellow: { title: 'Agissez seulement avec protection', steps: ['Placez-vous dos au vent et travaillez par courtes périodes (30 minutes maximum).', 'Gants, bottes et protection des yeux obligatoires.', 'Éloignez les enfants, les femmes enceintes et les personnes asthmatiques.', "Une odeur d'œuf pourri signale du sulfure d'hydrogène. Si l'odeur disparaît soudain, partez : le gaz peut être trop concentré pour être senti.", 'Mal de tête, vertiges ou yeux qui brûlent : arrêtez, éloignez-vous et consultez un médecin.'] },
    red: { title: 'Ne touchez pas. Éloignez-vous.', steps: ["Ne touchez, n'ouvrez, ne déplacez et ne sentez rien.", "Éloignez-vous d'au moins 100 mètres, dos au vent, vers un point élevé.", "Gardez tout le monde à distance, animaux compris. N'utilisez pas l'eau.", 'Prenez des photos uniquement depuis votre position, avec le zoom.', "Appelez les secours si quelqu'un se sent mal. Signalez-le ici."] }
  },
  pt: {
    name: 'Português', dir: 'ltr',
    green: { title: 'Você pode agir, com cuidado', steps: ['Use luvas e sapatos fechados.', 'Use ancinhos e pás, não as mãos.', 'Nunca queime lixo nem sargaço.', 'Ensaque os resíduos e leve ao ponto de coleta combinado.', 'Beba água e descanse na sombra.'] },
    yellow: { title: 'Aja somente com proteção', steps: ['Fique de costas para o vento e trabalhe em turnos curtos (no máximo 30 minutos).', 'Luvas, botas e proteção para os olhos são obrigatórias.', 'Mantenha afastados crianças, gestantes e pessoas com asma.', 'Cheiro de ovo podre indica gás sulfídrico. Se o cheiro sumir de repente, afaste-se: o gás pode estar forte demais para ser sentido.', 'Dor de cabeça, tontura ou olhos ardendo: pare, afaste-se e procure atendimento médico.'] },
    red: { title: 'Não toque. Afaste-se.', steps: ['Não toque, abra, mova nem cheire nada.', 'Afaste-se pelo menos 100 metros, de costas para o vento, para um lugar alto.', 'Mantenha todos afastados, inclusive animais. Não use a água.', 'Tire fotos apenas de onde você está, usando o zoom.', 'Chame a emergência se alguém passar mal. Registre aqui.'] }
  },
  zh: {
    name: '中文', dir: 'ltr',
    green: { title: '可以行动，但要小心', steps: ['戴手套，穿不露脚趾的鞋。', '用耙子和铁锹，不要徒手。', '绝不要焚烧垃圾或海藻。', '把垃圾装袋，送到约定的收集点。', '多喝水，在阴凉处休息。'] },
    yellow: { title: '必须有防护才能行动', steps: ['背对风向站立，分短班工作（每次最多30分钟）。', '必须戴手套、穿靴子并保护眼睛。', '让儿童、孕妇和哮喘患者远离。', '臭鸡蛋味表示有硫化氢气体。如果气味突然消失，请立即离开：气体可能浓到闻不出来。', '头痛、头晕或眼睛灼痛：停下、离开并就医。'] },
    red: { title: '不要触碰。立即远离。', steps: ['不要触碰、打开、移动或闻任何东西。', '至少远离100米，背对风向，前往高处。', '让所有人和动物远离。不要使用这里的水。', '只在原地用变焦拍照。', '如有人身体不适，请拨打急救电话，并在此报告。'] }
  },
  hi: {
    name: 'हिन्दी', dir: 'ltr',
    green: { title: 'आप काम कर सकते हैं, सावधानी से', steps: ['दस्ताने और बंद जूते पहनें।', 'हाथों से नहीं, रेक और फावड़े से काम करें।', 'कचरा या समुद्री शैवाल कभी न जलाएँ।', 'कचरे को थैलों में भरकर तय संग्रह स्थान पर ले जाएँ।', 'पानी पिएँ और छाया में आराम करें।'] },
    yellow: { title: 'केवल सुरक्षा उपकरणों के साथ काम करें', steps: ['हवा को अपनी पीठ की ओर रखकर खड़े हों और छोटी पालियों में काम करें (अधिकतम 30 मिनट)।', 'दस्ताने, जूते और आँखों की सुरक्षा ज़रूरी है।', 'बच्चों, गर्भवती महिलाओं और दमा के रोगियों को दूर रखें।', 'सड़े अंडे जैसी गंध हाइड्रोजन सल्फ़ाइड गैस का संकेत है। अगर गंध अचानक गायब हो जाए तो तुरंत हट जाएँ: गैस इतनी तेज़ हो सकती है कि गंध महसूस न हो।', 'सिरदर्द, चक्कर या आँखों में जलन हो तो रुकें, दूर जाएँ और चिकित्सा सहायता लें।'] },
    red: { title: 'न छुएँ। दूर हट जाएँ।', steps: ['कुछ भी न छुएँ, न खोलें, न हिलाएँ, न सूँघें।', 'कम से कम 100 मीटर दूर, हवा को पीठ की ओर रखकर ऊँची जगह पर जाएँ।', 'सभी लोगों और जानवरों को दूर रखें। इस पानी का उपयोग न करें।', 'जहाँ हैं वहीं से ज़ूम करके ही फ़ोटो लें।', 'किसी की तबीयत बिगड़े तो आपातकालीन सेवा को फ़ोन करें। यहाँ रिपोर्ट करें।'] }
  },
  ar: {
    name: 'العربية', dir: 'rtl',
    green: { title: 'يمكنك التصرف، بحذر', steps: ['ارتدِ قفازات وحذاءً مغلقًا.', 'استخدم المجارف والمعاول، لا يديك.', 'لا تحرق النفايات أو الطحالب أبدًا.', 'ضع النفايات في أكياس وانقلها إلى نقطة الجمع المتفق عليها.', 'اشرب الماء واسترح في الظل.'] },
    yellow: { title: 'تصرّف فقط مع وسائل الحماية', steps: ['قف والريح خلف ظهرك، واعمل في نوبات قصيرة (30 دقيقة كحد أقصى).', 'القفازات والأحذية الطويلة وحماية العينين إلزامية.', 'أبعد الأطفال والحوامل ومرضى الربو.', 'رائحة البيض الفاسد تعني وجود غاز كبريتيد الهيدروجين. إذا اختفت الرائحة فجأة فابتعد فورًا: قد يكون الغاز قويًا لدرجة أنك لا تشمّه.', 'صداع أو دوار أو حرقان في العينين: توقف وابتعد واطلب الرعاية الطبية.'] },
    red: { title: 'لا تلمس. ابتعد.', steps: ['لا تلمس أي شيء ولا تفتحه ولا تحرّكه ولا تشمّه.', 'ابتعد 100 متر على الأقل، والريح خلف ظهرك، نحو مكان مرتفع.', 'أبعد الجميع، بما في ذلك الحيوانات. لا تستخدم الماء.', 'التقط الصور من مكانك فقط باستخدام التكبير.', 'اتصل بالطوارئ إذا شعر أحد بتوعك، وأبلغ هنا.'] }
  },
  bn: {
    name: 'বাংলা', dir: 'ltr',
    green: { title: 'আপনি কাজ করতে পারেন, সাবধানে', steps: ['গ্লাভস ও বন্ধ জুতা পরুন।', 'খালি হাতে নয়, রেক ও বেলচা ব্যবহার করুন।', 'কখনো আবর্জনা বা সামুদ্রিক শৈবাল পোড়াবেন না।', 'আবর্জনা ব্যাগে ভরে নির্ধারিত সংগ্রহস্থলে নিয়ে যান।', 'পানি পান করুন এবং ছায়ায় বিশ্রাম নিন।'] },
    yellow: { title: 'শুধু সুরক্ষা সরঞ্জাম নিয়ে কাজ করুন', steps: ['বাতাস পিঠের দিকে রেখে দাঁড়ান এবং অল্প সময় করে কাজ করুন (সর্বোচ্চ ৩০ মিনিট)।', 'গ্লাভস, বুট ও চোখের সুরক্ষা বাধ্যতামূলক।', 'শিশু, গর্ভবতী নারী ও হাঁপানির রোগীদের দূরে রাখুন।', 'পচা ডিমের মতো গন্ধ মানে হাইড্রোজেন সালফাইড গ্যাস। গন্ধ হঠাৎ চলে গেলে সরে যান: গ্যাস এত বেশি হতে পারে যে আর গন্ধ পাওয়া যায় না।', 'মাথাব্যথা, মাথা ঘোরা বা চোখ জ্বালা করলে থামুন, সরে যান এবং চিকিৎসা নিন।'] },
    red: { title: 'ছোঁবেন না। দূরে সরে যান।', steps: ['কিছু ছোঁবেন না, খুলবেন না, সরাবেন না বা শুঁকবেন না।', 'অন্তত ১০০ মিটার দূরে, বাতাস পিঠের দিকে রেখে উঁচু জায়গায় যান।', 'সবাইকে, পশুদেরও, দূরে রাখুন। এই পানি ব্যবহার করবেন না।', 'যেখানে আছেন সেখান থেকেই জুম করে ছবি তুলুন।', 'কেউ অসুস্থ বোধ করলে জরুরি সেবায় ফোন করুন। এখানে রিপোর্ট করুন।'] }
  },
  ru: {
    name: 'Русский', dir: 'ltr',
    green: { title: 'Можно действовать, осторожно', steps: ['Наденьте перчатки и закрытую обувь.', 'Работайте граблями и лопатами, а не руками.', 'Никогда не сжигайте мусор или водоросли.', 'Сложите отходы в мешки и отнесите в согласованный пункт сбора.', 'Пейте воду и отдыхайте в тени.'] },
    yellow: { title: 'Действуйте только в защите', steps: ['Встаньте спиной к ветру и работайте короткими сменами (не более 30 минут).', 'Перчатки, сапоги и защита глаз обязательны.', 'Не подпускайте детей, беременных и людей с астмой.', 'Запах тухлых яиц означает сероводород. Если запах внезапно исчез, уходите: газа может быть так много, что его уже не чувствуешь.', 'Головная боль, головокружение или жжение в глазах: остановитесь, отойдите и обратитесь к врачу.'] },
    red: { title: 'Не трогайте. Отойдите.', steps: ['Ничего не трогайте, не открывайте, не передвигайте и не нюхайте.', 'Отойдите минимум на 100 метров, спиной к ветру, на возвышенность.', 'Не подпускайте людей и животных. Не используйте эту воду.', 'Фотографируйте только с того места, где стоите, используя зум.', 'Если кому-то плохо, звоните в экстренные службы. Сообщите здесь.'] }
  },
  id: {
    name: 'Bahasa Indonesia', dir: 'ltr',
    green: { title: 'Anda boleh bertindak, dengan hati-hati', steps: ['Pakai sarung tangan dan sepatu tertutup.', 'Gunakan garu dan sekop, bukan tangan kosong.', 'Jangan pernah membakar sampah atau rumput laut.', 'Masukkan sampah ke kantong dan bawa ke titik pengumpulan yang disepakati.', 'Minum air dan istirahat di tempat teduh.'] },
    yellow: { title: 'Bertindak hanya dengan pelindung', steps: ['Berdirilah membelakangi angin dan bekerja dalam giliran singkat (maksimal 30 menit).', 'Sarung tangan, sepatu bot, dan pelindung mata wajib dipakai.', 'Jauhkan anak-anak, ibu hamil, dan penderita asma.', 'Bau telur busuk berarti gas hidrogen sulfida. Jika baunya tiba-tiba hilang, segera menjauh: gasnya mungkin terlalu pekat untuk tercium.', 'Sakit kepala, pusing, atau mata perih: berhenti, menjauh, dan cari pertolongan medis.'] },
    red: { title: 'Jangan sentuh. Menjauh.', steps: ['Jangan menyentuh, membuka, memindahkan, atau mencium apa pun.', 'Menjauhlah setidaknya 100 meter, membelakangi angin, ke tempat yang lebih tinggi.', 'Jauhkan semua orang, termasuk hewan. Jangan gunakan airnya.', 'Ambil foto hanya dari tempat Anda berdiri, dengan zoom.', 'Hubungi layanan darurat jika ada yang merasa sakit. Laporkan di sini.'] }
  }
};

// Review status is shown next to every protocol. Change "en" and "es" to
// "team_reviewed" only after the author's safety review signs them off.
const PROTOCOL_REVIEW = {
  en: 'pending_team_review', es: 'pending_team_review',
  fr: 'machine_translation', pt: 'machine_translation', zh: 'machine_translation', hi: 'machine_translation',
  ar: 'machine_translation', bn: 'machine_translation', ru: 'machine_translation', id: 'machine_translation'
};

// Local and Indigenous languages: never machine translated for safety content.
// Shown as pictograms plus recordings by paid community interpreters.
const LOCAL_LANGUAGES = [
  { code: 'yua', name: 'Maya yucateco (Yucatec Maya)', region: 'Yucatán Peninsula, Mexico' },
  { code: 'nah', name: 'Náhuatl (name the variant)', region: 'Central Mexico' }
];

// ---------------------------------------------------------------------------
// Remediation methods. tiers = incident tiers where the community may use it.
// evidence: field_tested | lab_studied | experimental
// ---------------------------------------------------------------------------
const REMEDIATION = [
  {
    id: 'sarg-48h', types: ['sargassum'], tiers: ['green', 'yellow'],
    title: { en: 'Collect sargassum within 48 hours of landing', es: 'Recoger el sargazo en las primeras 48 horas' },
    summary: { en: 'Hydrogen sulfide and ammonia typically form after mats sit on the beach for about 48 hours. Early removal prevents most gas exposure. In Mexico, the federal guidelines set 72 hours as the maximum.', es: 'El ácido sulfhídrico y el amoníaco suelen formarse cuando el sargazo pasa unas 48 horas en la playa. Retirarlo antes evita la mayor parte de la exposición a gases. En México, los lineamientos federales fijan 72 horas como máximo.' },
    cost: 'low', skill: 'basic', evidence: 'field_tested', time: { en: 'Same day', es: 'El mismo día' },
    materials: { en: 'Rakes, shovels, wheelbarrows, bags or tarps', es: 'Rastrillos, palas, carretillas, bolsas o lonas' },
    source: { title: 'US EPA: Sargassum Inundation Events, impacts on human health', url: 'https://epa.gov/habs/sargassum-inundation-events-sies-impacts-human-health', checked: CHECKED, how: 'page_read', official: true }
  },
  {
    id: 'sarg-ppe', types: ['sargassum'], tiers: ['green', 'yellow'],
    title: { en: 'Protect the brigade: gloves, boots, respiratory protection, short shifts', es: 'Proteger a la brigada: guantes, botas, protección respiratoria, turnos cortos' },
    summary: { en: 'The EPA advises workers to consider gloves, boots and respiratory protection, and people with asthma to limit time near decomposing mats. Ordinary dust masks do not filter hydrogen sulfide; a gas monitor is the reliable warning.', es: 'La EPA recomienda a los trabajadores considerar guantes, botas y protección respiratoria, y a las personas con asma limitar el tiempo cerca del sargazo en descomposición. Los cubrebocas comunes no filtran el ácido sulfhídrico; un monitor de gas es la alerta confiable.' },
    cost: 'low', skill: 'basic', evidence: 'field_tested', time: { en: '1 day to equip', es: '1 día para equipar' },
    materials: { en: 'Nitrile gloves, rubber boots, safety glasses, portable H2S monitor', es: 'Guantes de nitrilo, botas de hule, lentes de seguridad, monitor portátil de H2S' },
    source: { title: 'US EPA: Sargassum Inundation Events, impacts on human health', url: 'https://epa.gov/habs/sargassum-inundation-events-sies-impacts-human-health', checked: CHECKED, how: 'page_read', official: true }
  },
  {
    id: 'sarg-forecast', types: ['sargassum'], tiers: ['green', 'yellow', 'red'],
    title: { en: 'Watch satellite outlooks to prepare before arrival', es: 'Seguir los pronósticos satelitales para prepararse antes de la llegada' },
    summary: { en: 'The University of South Florida publishes a Satellite-based Sargassum Watch System (SaWS) with regional outlooks, so brigades can stage tools before landings.', es: 'La Universidad del Sur de Florida publica el Sistema Satelital de Vigilancia del Sargazo (SaWS) con pronósticos regionales, para que las brigadas preparen herramientas antes de los arribos.' },
    cost: 'low', skill: 'basic', evidence: 'field_tested', time: { en: 'Ongoing', es: 'Continuo' },
    materials: { en: 'Phone with internet', es: 'Teléfono con internet' },
    source: { title: 'USF Optical Oceanography Lab: Sargassum Watch System', url: 'https://optics.marine.usf.edu/projects/SaWS_0.09u1.html', checked: CHECKED, how: 'search_result', official: false }
  },
  {
    id: 'sarg-no-food', types: ['sargassum'], tiers: ['green', 'yellow', 'red'],
    title: { en: 'Do not use collected sargassum as food, feed or garden compost without testing', es: 'No usar el sargazo recolectado como alimento, forraje o composta sin análisis' },
    summary: { en: 'Sargassum accumulates arsenic and other contaminants; samples from Mexican beaches in 2018 measured above French seaweed consumption recommendations.', es: 'El sargazo acumula arsénico y otros contaminantes; muestras de playas mexicanas en 2018 superaron las recomendaciones francesas de consumo de algas.' },
    cost: 'low', skill: 'basic', evidence: 'lab_studied', time: { en: 'Immediate', es: 'Inmediato' },
    materials: { en: 'None', es: 'Ninguno' },
    source: { title: 'US EPA: Sargassum Inundation Events, impacts on human health', url: 'https://epa.gov/habs/sargassum-inundation-events-sies-impacts-human-health', checked: CHECKED, how: 'page_read', official: true }
  },
  {
    id: 'oil-sorbents', types: ['oil'], tiers: ['yellow'],
    title: { en: 'Sorbent pads and booms for small sheens', es: 'Paños y barreras absorbentes para manchas pequeñas' },
    summary: { en: 'Sorbents soak up oil from the water surface. Used sorbents become hazardous waste and must go to an authorized handler, never household trash.', es: 'Los absorbentes recogen el aceite de la superficie del agua. Los absorbentes usados son residuo peligroso y deben ir a un gestor autorizado, nunca a la basura doméstica.' },
    cost: 'medium', skill: 'basic', evidence: 'field_tested', time: { en: '1–3 days', es: '1 a 3 días' },
    materials: { en: 'Sorbent pads or booms, nitrile gloves, heavy bags', es: 'Paños o barreras absorbentes, guantes de nitrilo, bolsas gruesas' },
    source: { title: 'US EPA (archive): Sorbents for oil spills', url: 'https://archive.epa.gov/emergencies/content/learning/web/html/sorbents.html', checked: CHECKED, how: 'search_result', official: true }
  },
  {
    id: 'oil-noaa', types: ['oil'], tiers: ['yellow', 'red'],
    title: { en: 'Know how professionals clean spills before acting', es: 'Conocer cómo limpian los profesionales antes de actuar' },
    summary: { en: 'NOAA explains the main cleanup methods for oil spills; large or spreading spills need trained responders.', es: 'NOAA explica los principales métodos de limpieza de derrames; los derrames grandes o que se extienden requieren personal capacitado.' },
    cost: 'low', skill: 'basic', evidence: 'field_tested', time: { en: '15 minutes to read', es: '15 minutos de lectura' },
    materials: { en: 'None', es: 'Ninguno' },
    source: { title: 'NOAA Ocean Service: How do you clean up an oil spill?', url: 'https://oceanservice.noaa.gov/facts/spills-cleanup.html', checked: CHECKED, how: 'search_result', official: true }
  },
  {
    id: 'chem-isolate', types: ['chemical_unknown', 'water_discoloration', 'wildlife_mortality', 'smoke_burning'], tiers: ['red'],
    title: { en: 'Isolate, do not clean: call trained responders', es: 'Aislar, no limpiar: llamar a personal capacitado' },
    summary: { en: 'The US Emergency Response Guidebook (ERG 2024) is written for trained first responders and tells anyone who finds a hazardous-materials incident to contact emergency responders immediately. Its guide for unknown materials sets an initial isolation of at least 100 meters; confirm the figure in the printed guide.', es: 'La Guía de Respuesta en Caso de Emergencia de EE. UU. (ERG 2024) está escrita para personal de primera respuesta capacitado e indica a cualquier persona que encuentre un incidente con materiales peligrosos contactar de inmediato a los servicios de emergencia. Su guía para materiales desconocidos fija un aislamiento inicial de al menos 100 metros; confirma la cifra en la guía impresa.' },
    cost: 'low', skill: 'basic', evidence: 'field_tested', time: { en: 'Immediate', es: 'Inmediato' },
    materials: { en: 'Phone, rope or tape to mark distance', es: 'Teléfono, cuerda o cinta para marcar la distancia' },
    source: { title: 'US GPO: Emergency Response Guidebook 2024 (PHMSA)', url: 'https://govbooktalk.gpo.gov/2024/05/07/new-emergency-response-guidebook-2024/', checked: CHECKED, how: 'page_read', official: true }
  },
  {
    id: 'water-sodis', types: ['water_discoloration', 'wildlife_mortality', 'unknown'], tiers: ['green', 'yellow'],
    title: { en: 'Solar disinfection (SODIS) for drinking water, only when no chemical is suspected', es: 'Desinfección solar (SODIS) del agua de consumo, solo si no se sospecha de químicos' },
    summary: { en: 'Clear PET bottles exposed to full sun inactivate many pathogens. SODIS does not remove chemicals, metals or oil.', es: 'Botellas PET transparentes al sol pleno inactivan muchos patógenos. SODIS no elimina químicos, metales ni aceite.' },
    cost: 'low', skill: 'basic', evidence: 'field_tested', time: { en: '6 hours of full sun', es: '6 horas de sol pleno' },
    materials: { en: 'Clear PET bottles up to 2 liters', es: 'Botellas PET transparentes de hasta 2 litros' },
    source: { title: 'Eawag / Sandec: Solar water disinfection (SODIS)', url: 'https://eawag.ch/en/department/sandec/projects/swp/solar-water-disinfection-sodis', checked: CHECKED, how: 'search_result', official: true }
  },
  {
    id: 'water-biosand', types: ['water_discoloration', 'unknown'], tiers: ['green', 'yellow'],
    title: { en: 'Household biosand filter, only when no chemical is suspected', es: 'Filtro casero de bioarena, solo si no se sospecha de químicos' },
    summary: { en: 'A sand and gravel filter with a biological layer removes sediment and many pathogens. It is not designed for chemical contamination.', es: 'Un filtro de arena y grava con una capa biológica retira sedimentos y muchos patógenos. No está diseñado para contaminación química.' },
    cost: 'low', skill: 'trained', evidence: 'field_tested', time: { en: '2–3 weeks to mature', es: '2 a 3 semanas para madurar' },
    materials: { en: 'Container, washed sand, gravel, diffuser plate', es: 'Contenedor, arena lavada, grava, placa difusora' },
    source: { title: 'CAWST: Biosand Filter Manual', url: 'https://www.ctahr.hawaii.edu/hawaiirain/Library/Guides&Manuals/CAWST%20files/Biosand%20Filter%20Manual_Version%2010_Sep%2009[1].pdf', checked: CHECKED, how: 'search_result', official: false }
  },
  {
    id: 'wastewater-wetland', types: ['water_discoloration', 'unknown'], tiers: ['green', 'yellow'],
    title: { en: 'Constructed wetlands for community wastewater', es: 'Humedales artificiales para aguas residuales comunitarias' },
    summary: { en: 'Planted gravel beds treat domestic wastewater before it reaches rivers. A long-term fix that needs design support, not an emergency response.', es: 'Lechos de grava con plantas tratan las aguas residuales domésticas antes de llegar al río. Es una solución de largo plazo que requiere apoyo de diseño, no una respuesta de emergencia.' },
    cost: 'medium', skill: 'specialist', evidence: 'field_tested', time: { en: 'Months', es: 'Meses' },
    materials: { en: 'Land, gravel, native wetland plants, piping', es: 'Terreno, grava, plantas nativas de humedal, tubería' },
    source: { title: 'SSWM: Constructed Wetlands Treatment of Municipal Wastewater (manual)', url: 'https://sswm.info/node/2944', checked: CHECKED, how: 'search_result', official: false }
  },
  {
    id: 'soil-phyto', types: ['chemical_unknown'], tiers: ['red'],
    title: { en: 'Phytoremediation: plants that pull contaminants from soil (long term, with experts)', es: 'Fitorremediación: plantas que extraen contaminantes del suelo (largo plazo, con expertos)' },
    summary: { en: 'Certain plants take up or stabilize contaminants over seasons. It only starts after a lab identifies the contaminant, and the plants may need hazardous-waste disposal.', es: 'Ciertas plantas absorben o estabilizan contaminantes durante varias temporadas. Solo empieza después de que un laboratorio identifica el contaminante, y las plantas pueden requerir disposición como residuo peligroso.' },
    cost: 'medium', skill: 'specialist', evidence: 'field_tested', time: { en: 'Seasons to years', es: 'Temporadas a años' },
    materials: { en: 'Lab results first; then plants chosen by specialists', es: 'Primero resultados de laboratorio; luego plantas elegidas por especialistas' },
    source: { title: "US EPA (archive): A Citizen's Guide to Phytoremediation", url: 'https://19january2021snapshot.epa.gov/remedytech/citizens-guide-phytoremediation_.html', checked: CHECKED, how: 'search_result', official: true }
  }
];

// ---------------------------------------------------------------------------
// Help directory (seed list). confidence: official | located | not_confirmed
// countries: ISO codes where it applies; '*' = international
// ---------------------------------------------------------------------------
const ORGS = [
  {
    id: 'emergency-local', urgency: 'immediate', countries: ['*'],
    name: { en: 'Local emergency number', es: 'Número local de emergencias' },
    contact: { en: '911 in Mexico and the US; 112 across the EU and many other countries', es: '911 en México y EE. UU.; 112 en la UE y muchos otros países' },
    why: { en: 'Anyone sick, breathing difficulty, fire or a spreading release.', es: 'Personas enfermas, dificultad para respirar, fuego o una fuga que se extiende.' },
    source: null, confidence: 'not_confirmed'
  },
  {
    id: 'us-nrc', urgency: 'authority', countries: ['US'],
    name: { en: 'US National Response Center', es: 'Centro Nacional de Respuesta de EE. UU.' },
    contact: { en: '1-800-424-8802, 24 hours', es: '1-800-424-8802, 24 horas' },
    why: { en: 'Federal point of contact for reporting oil and chemical releases in the US.', es: 'Punto federal para reportar derrames de petróleo y químicos en EE. UU.' },
    source: { title: 'US EPA: National Response Center', url: 'https://epa.gov/emergency-response/national-response-center', checked: CHECKED, how: 'search_result' },
    confidence: 'official'
  },
  {
    id: 'mx-profepa', urgency: 'authority', countries: ['MX'],
    name: { en: 'PROFEPA (Mexico federal environmental enforcement)', es: 'PROFEPA (Procuraduría Federal de Protección al Ambiente)' },
    contact: { en: 'Accepts citizen complaints (denuncia popular)', es: 'Recibe la denuncia popular ambiental' },
    why: { en: 'Formal complaint against a polluting source in Mexico.', es: 'Denuncia formal contra una fuente contaminante en México.' },
    source: { title: 'Gobierno de México: PROFEPA', url: 'https://www.gob.mx/profepa', checked: CHECKED, how: 'not_opened' },
    confidence: 'not_confirmed'
  },
  {
    id: 'un-jeu', urgency: 'international', countries: ['*'],
    name: { en: 'Joint UNEP/OCHA Environment Unit', es: 'Unidad Conjunta de Medio Ambiente PNUMA/OCAH' },
    contact: { en: 'Requests usually come through national authorities; NGOs can help a community reach them.', es: 'Las solicitudes suelen llegar por las autoridades nacionales; las ONG pueden ayudar a una comunidad a contactarla.' },
    why: { en: 'UN unit that mobilizes support for environmental emergencies.', es: 'Unidad de la ONU que moviliza apoyo ante emergencias ambientales.' },
    source: { title: 'PreventionWeb: Joint UNEP/OCHA Environment Unit', url: 'https://www.preventionweb.net/organization/joint-unep/ocha-environment-unit', checked: CHECKED, how: 'search_result' },
    confidence: 'located'
  },
  {
    id: 'aida', urgency: 'legal', countries: ['*'],
    name: { en: 'AIDA, Interamerican Association for Environmental Defense', es: 'AIDA, Asociación Interamericana para la Defensa del Ambiente' },
    contact: { en: 'Regional environmental law organization in the Americas', es: 'Organización regional de derecho ambiental en las Américas' },
    why: { en: 'Legal strategy when authorities do not act.', es: 'Estrategia legal cuando las autoridades no actúan.' },
    source: { title: 'AIDA: About us', url: 'https://aida-americas.org/en/node/5', checked: CHECKED, how: 'search_result' },
    confidence: 'located'
  },
  {
    id: 'gef-sgp', urgency: 'funding', countries: ['*'],
    name: { en: 'GEF Small Grants Programme (UNDP)', es: 'Programa de Pequeñas Donaciones del FMAM (PNUD)' },
    contact: { en: 'Calls for proposals are published per country', es: 'Las convocatorias se publican por país' },
    why: { en: 'Grants for community environmental projects beyond the emergency.', es: 'Donaciones para proyectos ambientales comunitarios más allá de la emergencia.' },
    source: { title: 'UNDP: Call for applications, GEF Small Grants Programme (example country call)', url: 'https://www.undp.org/kenya/news/call-applications-gef-small-grants-programme', checked: CHECKED, how: 'search_result' },
    confidence: 'located'
  },
  {
    id: 'mx-inali', urgency: 'language', countries: ['MX'],
    name: { en: 'INALI, Mexico National Institute of Indigenous Languages', es: 'INALI, Instituto Nacional de Lenguas Indígenas' },
    contact: { en: 'Validation of safety terms in Indigenous languages', es: 'Validación de términos de seguridad en lenguas indígenas' },
    why: { en: 'Checks that interpreter recordings use correct terms.', es: 'Revisa que las grabaciones de intérpretes usen términos correctos.' },
    source: null, confidence: 'not_confirmed'
  },
  {
    id: 'epa-sargassum-health', urgency: 'health', countries: ['*'],
    name: { en: 'Health guidance on sargassum gases (US EPA)', es: 'Guía de salud sobre gases del sargazo (EPA de EE. UU.)' },
    contact: { en: 'Read before organizing a brigade', es: 'Leer antes de organizar una brigada' },
    why: { en: 'Symptoms, vulnerable groups and precautions.', es: 'Síntomas, grupos vulnerables y precauciones.' },
    source: { title: 'US EPA: Sargassum Inundation Events, impacts on human health', url: 'https://epa.gov/habs/sargassum-inundation-events-sies-impacts-human-health', checked: CHECKED, how: 'page_read' },
    confidence: 'official'
  }
];

// ---------------------------------------------------------------------------
// Milestone plan templates (USD estimates; adjust to local prices).
// ---------------------------------------------------------------------------
const PLAN_TEMPLATES = {
  'sargassum:yellow': [
    { category: 'ppe', amount: 240, title: { en: 'Protective equipment for 8 volunteers', es: 'Equipo de protección para 8 voluntarios' }, detail: { en: 'Nitrile gloves, rubber boots, safety glasses and one portable H2S monitor.', es: 'Guantes de nitrilo, botas de hule, lentes de seguridad y un monitor portátil de H2S.' }, criteria: { en: 'Photo of the equipment laid out, with receipt or packaging visible.', es: 'Foto del equipo extendido, con recibo o empaque visible.' } },
    { category: 'labor', amount: 640, title: { en: 'Clear 400 m of beach within 48 hours', es: 'Limpiar 400 m de playa en menos de 48 horas' }, detail: { en: 'Stipends for 8 people over 2 days, in 30-minute shifts.', es: 'Apoyo económico para 8 personas durante 2 días, en turnos de 30 minutos.' }, criteria: { en: 'Before and after photos from the same spot: sand visible, material bagged or piled away from the water.', es: 'Fotos de antes y después desde el mismo punto: arena visible y material embolsado o apilado lejos del agua.' } },
    { category: 'transport', amount: 320, title: { en: 'Haul to an authorized drying or disposal site', es: 'Trasladar a un sitio autorizado de secado o disposición' }, detail: { en: 'One truck trip per day for 2 days.', es: 'Un viaje de camión por día durante 2 días.' }, criteria: { en: 'Photo of the loaded truck and photo at the receiving site.', es: 'Foto del camión cargado y foto en el sitio receptor.' } }
  ],
  'sargassum:green': [
    { category: 'tools', amount: 150, title: { en: 'Rakes, gloves and bags', es: 'Rastrillos, guantes y bolsas' }, detail: { en: 'Basic tools for 8 volunteers.', es: 'Herramientas básicas para 8 voluntarios.' }, criteria: { en: 'Photo of the tools with receipt.', es: 'Foto de las herramientas con recibo.' } },
    { category: 'labor', amount: 480, title: { en: 'Remove fresh sargassum before it rots', es: 'Retirar el sargazo fresco antes de que se pudra' }, detail: { en: 'Stipends for 8 people over 1.5 days.', es: 'Apoyo para 8 personas durante día y medio.' }, criteria: { en: 'Before and after photos from the same spot.', es: 'Fotos de antes y después desde el mismo punto.' } }
  ],
  'red': [
    { category: 'testing', amount: 350, title: { en: 'Accredited laboratory water analysis', es: 'Análisis de agua en laboratorio acreditado' }, detail: { en: 'Samples are taken by laboratory staff, never by residents.', es: 'Las muestras las toma el personal del laboratorio, nunca los vecinos.' }, criteria: { en: 'Photo of the lab chain-of-custody form or receipt.', es: 'Foto del formato de cadena de custodia o recibo del laboratorio.' } },
    { category: 'advocacy', amount: 150, title: { en: 'File the evidence with authorities and NGOs', es: 'Presentar la evidencia ante autoridades y ONG' }, detail: { en: 'Printing, transport and filing of the evidence file.', es: 'Impresión, transporte y presentación del expediente de evidencia.' }, criteria: { en: 'Photo of the stamped complaint receipt (folio).', es: 'Foto del acuse sellado de la denuncia (folio).' } }
  ],
  'oil:yellow': [
    { category: 'ppe', amount: 180, title: { en: 'Nitrile gloves, boots and eye protection', es: 'Guantes de nitrilo, botas y protección ocular' }, detail: { en: 'For 6 volunteers.', es: 'Para 6 voluntarios.' }, criteria: { en: 'Photo of equipment with receipt.', es: 'Foto del equipo con recibo.' } },
    { category: 'tools', amount: 300, title: { en: 'Sorbent pads and booms', es: 'Paños y barreras absorbentes' }, detail: { en: 'Enough for about 200 m of shoreline.', es: 'Suficiente para unos 200 m de orilla.' }, criteria: { en: 'Photo of sorbents deployed.', es: 'Foto de los absorbentes colocados.' } },
    { category: 'disposal', amount: 200, title: { en: 'Hazardous-waste pickup of used sorbents', es: 'Recolección de absorbentes usados como residuo peligroso' }, detail: { en: 'Authorized handler only.', es: 'Solo gestor autorizado.' }, criteria: { en: 'Photo of the handler manifest.', es: 'Foto del manifiesto del gestor.' } }
  ],
  'default:green': [
    { category: 'tools', amount: 150, title: { en: 'Gloves, bags and tools', es: 'Guantes, bolsas y herramientas' }, detail: { en: 'For 8 volunteers.', es: 'Para 8 voluntarios.' }, criteria: { en: 'Photo of tools with receipt.', es: 'Foto de las herramientas con recibo.' } },
    { category: 'labor', amount: 400, title: { en: 'Community cleanup day', es: 'Jornada comunitaria de limpieza' }, detail: { en: 'Stipends and water for volunteers.', es: 'Apoyo y agua para voluntarios.' }, criteria: { en: 'Before and after photos from the same spot.', es: 'Fotos de antes y después desde el mismo punto.' } }
  ],
  'default:yellow': [
    { category: 'ppe', amount: 200, title: { en: 'Protective equipment', es: 'Equipo de protección' }, detail: { en: 'Gloves, boots, eye protection.', es: 'Guantes, botas, protección ocular.' }, criteria: { en: 'Photo of equipment with receipt.', es: 'Foto del equipo con recibo.' } },
    { category: 'testing', amount: 250, title: { en: 'Laboratory test to confirm what it is', es: 'Prueba de laboratorio para confirmar qué es' }, detail: { en: 'Sampling by lab staff.', es: 'Muestreo por personal del laboratorio.' }, criteria: { en: 'Photo of the lab receipt.', es: 'Foto del recibo del laboratorio.' } }
  ]
};

const INTERPRETER_FEE = 40; // USD per approved protocol recording set

// Building and infrastructure content is kept in its own file and merged here.
const infra = require('./content-infra');
REMEDIATION.push(...infra.ACTIONS_INFRA);
ORGS.forEach(o => { if (!o.domains) o.domains = o.id === 'emergency-local' ? ['environment', 'infrastructure', 'community'] : ['environment']; });
ORGS.push(...infra.ORGS_INFRA);
Object.assign(PLAN_TEMPLATES, infra.PLAN_TEMPLATES_INFRA);

// Sargassum: every solution found, by stage, plus Quintana Roo channels.
const sargassum = require('./content-sargassum');
REMEDIATION.forEach(m => { if (sargassum.EXISTING[m.id]) Object.assign(m, sargassum.EXISTING[m.id]); });
REMEDIATION.push(...sargassum.METHODS);
ORGS.push(...sargassum.ORGS_QROO.map(o => ({ ...o, domains: ['environment'] })));

// Other community problems.
const community = require('./content-community');
Object.assign(PLAN_TEMPLATES, community.PLAN_TEMPLATES_COMMUNITY);
Object.assign(TYPE_LABELS, community.TYPE_LABELS_COMMUNITY);

module.exports = {
  PROTOCOLS_COMMUNITY: community.PROTOCOLS_COMMUNITY, SPECIAL_STEPS: community.SPECIAL_STEPS, PROTOCOL_ICONS_COMMUNITY: community.PROTOCOL_ICONS_COMMUNITY,
  PROTOCOLS_INFRA: infra.PROTOCOLS_INFRA, PROTOCOL_ICONS_INFRA: infra.PROTOCOL_ICONS_INFRA,
  CHECKED, TYPE_LABELS, PROTOCOLS, PROTOCOL_ICONS, PROTOCOL_REVIEW, LOCAL_LANGUAGES,
  REMEDIATION, ORGS, PLAN_TEMPLATES, INTERPRETER_FEE
};
