'use strict';
// Building and infrastructure hazards (stairs, railings, walkways, balconies).
// Same rules as the environmental content: every action and organization has a
// source and a check date; protocols show their review status.

const CHECKED = '2026-10-18';

const PROTOCOL_ICONS_INFRA = {
  green: ['stairs', 'ruler', 'calendar', 'mail', 'folder'],
  yellow: ['stairs', 'nolean', 'cone', 'mail', 'ruler'],
  red: ['nostairs', 'cone', 'call', 'mail', 'photo']
};

const PROTOCOLS_INFRA = {
  en: {
    green: { title: 'Cosmetic damage: use with normal care', steps: ['Use the stairs normally and hold the railing.', 'Photograph the damage next to a coin or ruler for scale.', 'Repeat the photo every two weeks from the same spot.', 'Report it in writing to whoever maintains the property.', 'Keep a copy of every message and reply.'] },
    yellow: { title: 'Use with caution and report today', steps: ['Use the stairs with care and watch the edge and the gap.', 'Do not rely on the damaged section of the railing; use another railing if there is one.', 'Mark the area with a cone or tape and warn neighbors, especially older adults and children.', 'Report it in writing today and ask for an inspection by a licensed professional.', 'Photograph it every two weeks with a coin or ruler to show if it is getting worse.'] },
    red: { title: 'Do not use. Find another way.', steps: ['Do not use the stairs and do not lean on the railing.', 'Block the area or warn everyone, and use another entrance.', 'If someone is hurt, call emergency services.', 'Report it right away to the property manager and to the city (3-1-1 in Austin).', 'Take photos from a safe spot. Never push or pull the railing to test it.'] }
  },
  es: {
    green: { title: 'Daño superficial: úsala con cuidado normal', steps: ['Usa la escalera normalmente y sujétate del barandal.', 'Fotografía el daño junto a una moneda o una regla para medir.', 'Repite la foto cada dos semanas desde el mismo punto.', 'Repórtalo por escrito a quien da mantenimiento a la propiedad.', 'Guarda copia de cada mensaje y respuesta.'] },
    yellow: { title: 'Úsala con precaución y repórtalo hoy', steps: ['Usa la escalera con cuidado y fíjate en el borde y la separación.', 'No te apoyes en la parte dañada del barandal; usa otro barandal si existe.', 'Marca la zona con un cono o cinta y avisa a los vecinos, sobre todo a personas mayores y niños.', 'Repórtalo hoy por escrito y pide una inspección de un profesional con licencia.', 'Fotografíalo cada dos semanas con una moneda o regla para mostrar si empeora.'] },
    red: { title: 'No la uses. Busca otro camino.', steps: ['No uses la escalera y no te apoyes en el barandal.', 'Bloquea la zona o avisa a todos, y usa otra entrada.', 'Si alguien se lastimó, llama a emergencias.', 'Repórtalo de inmediato a la administración y a la ciudad (3-1-1 en Austin).', 'Toma fotos desde un lugar seguro. Nunca empujes ni jales el barandal para probarlo.'] }
  },
  fr: {
    green: { title: 'Dégât superficiel : utilisez-le normalement', steps: ["Utilisez l'escalier normalement et tenez la rampe.", "Photographiez le dégât à côté d'une pièce ou d'une règle pour l'échelle.", 'Refaites la photo toutes les deux semaines au même endroit.', "Signalez-le par écrit à la personne chargée de l'entretien.", 'Gardez une copie de chaque message et de chaque réponse.'] },
    yellow: { title: "Utilisez-le avec prudence et signalez-le aujourd'hui", steps: ["Utilisez l'escalier avec prudence et faites attention au bord et à l'espace.", "Ne vous appuyez pas sur la partie abîmée de la rampe ; utilisez une autre rampe s'il y en a une.", 'Balisez la zone avec un cône ou du ruban et prévenez les voisins, surtout les personnes âgées et les enfants.', "Signalez-le par écrit aujourd'hui et demandez une inspection par un professionnel agréé.", "Photographiez-le toutes les deux semaines avec une pièce ou une règle pour montrer s'il s'aggrave."] },
    red: { title: "Ne l'utilisez pas. Prenez un autre chemin.", steps: ["N'utilisez pas l'escalier et ne vous appuyez pas sur la rampe.", 'Bloquez la zone ou prévenez tout le monde, et utilisez une autre entrée.', "Si quelqu'un est blessé, appelez les secours.", 'Signalez-le immédiatement au gestionnaire et à la ville.', "Prenez des photos depuis un endroit sûr. Ne poussez ni ne tirez jamais la rampe pour la tester."] }
  },
  pt: {
    green: { title: 'Dano superficial: use com o cuidado normal', steps: ['Use a escada normalmente e segure o corrimão.', 'Fotografe o dano ao lado de uma moeda ou régua para dar escala.', 'Repita a foto a cada duas semanas do mesmo lugar.', 'Informe por escrito quem faz a manutenção do imóvel.', 'Guarde cópia de cada mensagem e resposta.'] },
    yellow: { title: 'Use com cuidado e informe hoje', steps: ['Use a escada com cuidado e preste atenção à borda e ao vão.', 'Não se apoie na parte danificada do corrimão; use outro corrimão, se houver.', 'Sinalize a área com um cone ou fita e avise os vizinhos, principalmente idosos e crianças.', 'Informe hoje por escrito e peça uma inspeção por um profissional habilitado.', 'Fotografe a cada duas semanas com uma moeda ou régua para mostrar se está piorando.'] },
    red: { title: 'Não use. Procure outro caminho.', steps: ['Não use a escada e não se apoie no corrimão.', 'Bloqueie a área ou avise a todos, e use outra entrada.', 'Se alguém se machucou, chame a emergência.', 'Informe imediatamente a administração e a prefeitura.', 'Tire fotos de um lugar seguro. Nunca empurre nem puxe o corrimão para testá-lo.'] }
  },
  zh: {
    green: { title: '表面损伤：可正常小心使用', steps: ['正常使用楼梯，并扶好扶手。', '在损伤旁放一枚硬币或尺子拍照，用作比例。', '每两周从同一位置重拍一次。', '书面通知负责维护该物业的一方。', '保存每条消息和回复的副本。'] },
    yellow: { title: '谨慎使用，今天就报告', steps: ['小心使用楼梯，注意边缘和缝隙。', '不要依靠扶手受损的部分；如有其他扶手请使用。', '用锥形桶或胶带标出该区域，并提醒邻居，尤其是老人和儿童。', '今天就书面报告，并要求持证专业人员检查。', '每两周用硬币或尺子拍照一次，记录是否恶化。'] },
    red: { title: '不要使用。请走其他路线。', steps: ['不要使用楼梯，也不要倚靠扶手。', '封锁该区域或提醒所有人，并使用其他入口。', '如有人受伤，请拨打急救电话。', '立即向物业管理方和市政部门报告。', '在安全位置拍照。切勿推拉扶手来测试。'] }
  },
  hi: {
    green: { title: 'सतही नुकसान: सामान्य सावधानी से उपयोग करें', steps: ['सीढ़ियों का सामान्य रूप से उपयोग करें और रेलिंग पकड़ें।', 'नाप के लिए नुकसान के पास सिक्का या स्केल रखकर फ़ोटो लें।', 'हर दो हफ़्ते उसी जगह से फ़ोटो दोबारा लें।', 'संपत्ति का रखरखाव करने वाले को लिखित में सूचित करें।', 'हर संदेश और जवाब की प्रति संभालकर रखें।'] },
    yellow: { title: 'सावधानी से उपयोग करें और आज ही रिपोर्ट करें', steps: ['सीढ़ियों का सावधानी से उपयोग करें और किनारे व दरार पर ध्यान दें।', 'रेलिंग के क्षतिग्रस्त हिस्से पर भरोसा न करें; दूसरी रेलिंग हो तो उसका उपयोग करें।', 'जगह को कोन या टेप से चिह्नित करें और पड़ोसियों, खासकर बुज़ुर्गों और बच्चों को सावधान करें।', 'आज ही लिखित में रिपोर्ट करें और लाइसेंसधारी विशेषज्ञ से जाँच की माँग करें।', 'हर दो हफ़्ते सिक्के या स्केल के साथ फ़ोटो लें ताकि पता चले कि नुकसान बढ़ रहा है या नहीं।'] },
    red: { title: 'उपयोग न करें। दूसरा रास्ता अपनाएँ।', steps: ['सीढ़ियों का उपयोग न करें और रेलिंग पर न झुकें।', 'जगह को बंद करें या सबको सावधान करें, और दूसरे प्रवेश द्वार का उपयोग करें।', 'अगर कोई घायल है तो आपातकालीन सेवा को फ़ोन करें।', 'तुरंत संपत्ति प्रबंधन और नगर निकाय को रिपोर्ट करें।', 'सुरक्षित जगह से फ़ोटो लें। रेलिंग को जाँचने के लिए कभी धक्का न दें या खींचें नहीं।'] }
  },
  ar: {
    green: { title: 'ضرر سطحي: استخدمه بحذر عادي', steps: ['استخدم الدرج بشكل عادي وأمسك الدرابزين.', 'صوّر الضرر بجانب عملة أو مسطرة لتوضيح الحجم.', 'أعد التصوير كل أسبوعين من المكان نفسه.', 'أبلغ كتابيًا الجهة المسؤولة عن صيانة العقار.', 'احتفظ بنسخة من كل رسالة ورد.'] },
    yellow: { title: 'استخدمه بحذر وأبلغ اليوم', steps: ['استخدم الدرج بحذر وانتبه إلى الحافة والفجوة.', 'لا تعتمد على الجزء التالف من الدرابزين؛ استخدم درابزينًا آخر إن وُجد.', 'حدّد المنطقة بمخروط أو شريط ونبّه الجيران، خاصة كبار السن والأطفال.', 'أبلغ كتابيًا اليوم واطلب فحصًا من مختص مرخّص.', 'صوّره كل أسبوعين مع عملة أو مسطرة لإظهار ما إذا كان يزداد سوءًا.'] },
    red: { title: 'لا تستخدمه. ابحث عن طريق آخر.', steps: ['لا تستخدم الدرج ولا تتكئ على الدرابزين.', 'أغلق المنطقة أو نبّه الجميع، واستخدم مدخلًا آخر.', 'إذا أُصيب أحد، فاتصل بالطوارئ.', 'أبلغ إدارة العقار والبلدية فورًا.', 'التقط الصور من مكان آمن. لا تدفع الدرابزين ولا تسحبه أبدًا لاختباره.'] }
  },
  bn: {
    green: { title: 'উপরিভাগের ক্ষতি: স্বাভাবিক সতর্কতায় ব্যবহার করুন', steps: ['সিঁড়ি স্বাভাবিকভাবে ব্যবহার করুন এবং রেলিং ধরুন।', 'মাপ বোঝাতে ক্ষতির পাশে একটি মুদ্রা বা স্কেল রেখে ছবি তুলুন।', 'প্রতি দুই সপ্তাহে একই জায়গা থেকে আবার ছবি তুলুন।', 'সম্পত্তির রক্ষণাবেক্ষণকারীকে লিখিতভাবে জানান।', 'প্রতিটি বার্তা ও উত্তরের কপি রাখুন।'] },
    yellow: { title: 'সাবধানে ব্যবহার করুন এবং আজই জানান', steps: ['সিঁড়ি সাবধানে ব্যবহার করুন এবং কিনারা ও ফাঁকের দিকে খেয়াল রাখুন।', 'রেলিংয়ের ক্ষতিগ্রস্ত অংশে ভরসা করবেন না; অন্য রেলিং থাকলে সেটি ব্যবহার করুন।', 'কোন বা টেপ দিয়ে জায়গাটি চিহ্নিত করুন এবং প্রতিবেশীদের, বিশেষ করে বয়স্ক ও শিশুদের সতর্ক করুন।', 'আজই লিখিতভাবে জানান এবং লাইসেন্সপ্রাপ্ত পেশাদারের পরিদর্শন চান।', 'খারাপ হচ্ছে কি না দেখাতে প্রতি দুই সপ্তাহে মুদ্রা বা স্কেলসহ ছবি তুলুন।'] },
    red: { title: 'ব্যবহার করবেন না। অন্য পথ নিন।', steps: ['সিঁড়ি ব্যবহার করবেন না এবং রেলিংয়ে হেলান দেবেন না।', 'জায়গাটি বন্ধ করুন বা সবাইকে সতর্ক করুন, এবং অন্য প্রবেশপথ ব্যবহার করুন।', 'কেউ আহত হলে জরুরি সেবায় ফোন করুন।', 'অবিলম্বে সম্পত্তি ব্যবস্থাপনা ও পৌর কর্তৃপক্ষকে জানান।', 'নিরাপদ জায়গা থেকে ছবি তুলুন। রেলিং পরীক্ষা করতে কখনো ঠেলবেন বা টানবেন না।'] }
  },
  ru: {
    green: { title: 'Поверхностное повреждение: пользуйтесь с обычной осторожностью', steps: ['Пользуйтесь лестницей как обычно и держитесь за перила.', 'Сфотографируйте повреждение рядом с монетой или линейкой для масштаба.', 'Повторяйте снимок каждые две недели с того же места.', 'Письменно сообщите тому, кто отвечает за обслуживание здания.', 'Сохраняйте копии всех сообщений и ответов.'] },
    yellow: { title: 'Пользуйтесь осторожно и сообщите сегодня', steps: ['Пользуйтесь лестницей осторожно, следите за краем и зазором.', 'Не опирайтесь на повреждённую часть перил; используйте другие перила, если они есть.', 'Обозначьте место конусом или лентой и предупредите соседей, особенно пожилых и детей.', 'Сегодня же сообщите письменно и попросите осмотр у лицензированного специалиста.', 'Фотографируйте каждые две недели с монетой или линейкой, чтобы видеть, становится ли хуже.'] },
    red: { title: 'Не пользуйтесь. Ищите другой путь.', steps: ['Не пользуйтесь лестницей и не опирайтесь на перила.', 'Перекройте место или предупредите всех и используйте другой вход.', 'Если кто-то пострадал, вызовите экстренные службы.', 'Немедленно сообщите управляющей компании и в городские службы.', 'Фотографируйте с безопасного места. Никогда не толкайте и не тяните перила, чтобы проверить их.'] }
  },
  id: {
    green: { title: 'Kerusakan permukaan: gunakan dengan hati-hati seperti biasa', steps: ['Gunakan tangga seperti biasa dan pegang pegangan tangga.', 'Foto kerusakan di samping koin atau penggaris sebagai skala.', 'Ulangi foto setiap dua minggu dari tempat yang sama.', 'Laporkan secara tertulis kepada pihak yang merawat properti.', 'Simpan salinan setiap pesan dan balasan.'] },
    yellow: { title: 'Gunakan dengan hati-hati dan laporkan hari ini', steps: ['Gunakan tangga dengan hati-hati dan perhatikan tepi serta celahnya.', 'Jangan bertumpu pada bagian pegangan yang rusak; gunakan pegangan lain jika ada.', 'Tandai area dengan kerucut atau pita dan peringatkan tetangga, terutama lansia dan anak-anak.', 'Laporkan secara tertulis hari ini dan minta pemeriksaan oleh tenaga profesional berlisensi.', 'Foto setiap dua minggu dengan koin atau penggaris untuk menunjukkan apakah memburuk.'] },
    red: { title: 'Jangan digunakan. Cari jalan lain.', steps: ['Jangan gunakan tangga dan jangan bersandar pada pegangan.', 'Tutup area atau peringatkan semua orang, dan gunakan pintu masuk lain.', 'Jika ada yang terluka, hubungi layanan darurat.', 'Segera laporkan ke pengelola properti dan pemerintah kota.', 'Ambil foto dari tempat aman. Jangan pernah mendorong atau menarik pegangan untuk mengujinya.'] }
  }
};

// Actions with sources (the "solutions" for a structural hazard are mostly
// evidence and formal steps; the repair belongs to the responsible party).
const ACTIONS_INFRA = [
  {
    id: 'infra-311', types: ['structural_damage'], tiers: ['green', 'yellow', 'red'],
    title: { en: 'Report unsafe stairs or railings to the city (Austin 3-1-1)', es: 'Reportar escaleras o barandales inseguros a la ciudad (3-1-1 en Austin)' },
    summary: { en: "Austin's code inspectors check that handrails are not cracked or loose and that stair treads are secure. If they confirm a violation, the property owner receives a Notice of Violation with a repair deadline.", es: 'Los inspectores de código de Austin revisan que los barandales no estén agrietados ni flojos y que los escalones estén firmes. Si confirman una infracción, el propietario recibe un aviso de infracción con plazo de reparación.' },
    cost: 'low', skill: 'basic', evidence: 'field_tested', time: { en: 'Days to weeks', es: 'Días a semanas' },
    materials: { en: 'Phone or the Austin 3-1-1 app, photos', es: 'Teléfono o la app Austin 3-1-1, fotos' },
    source: { title: 'City of Austin: Code Compliance resources', url: 'https://www.austintexas.gov/department/code-compliance-resources', checked: CHECKED, how: 'page_read', official: true }
  },
  {
    id: 'infra-rcla', types: ['structural_damage'], tiers: ['green', 'yellow', 'red'],
    title: { en: 'Formal notice to the builder (Texas RCLA)', es: 'Aviso formal al constructor (RCLA de Texas)' },
    summary: { en: 'Before suing a contractor over a construction defect, Texas law requires written notice by certified mail, return receipt requested, at least 60 days before, describing the defects in reasonable detail. The contractor may inspect within 35 days and may offer a settlement within 60 days. Condominium common elements are covered.', es: 'Antes de demandar a un constructor por un defecto de construcción, la ley de Texas exige aviso por escrito por correo certificado con acuse de recibo, al menos 60 días antes, describiendo los defectos con detalle razonable. El constructor puede inspeccionar en 35 días y ofrecer un arreglo en 60 días. Incluye las áreas comunes de condominios.' },
    cost: 'low', skill: 'basic', evidence: 'field_tested', time: { en: '60 days', es: '60 días' },
    materials: { en: 'Letter generated by the app, certified mail', es: 'Carta generada por la app, correo certificado' },
    source: { title: 'Texas Property Code, Chapter 27 (official text)', url: 'https://tcss.legis.texas.gov/Docs/PR/htm/PR.27.htm', checked: CHECKED, how: 'page_read', official: true }
  },
  {
    id: 'infra-engineer', types: ['structural_damage'], tiers: ['yellow', 'red'],
    title: { en: 'Independent report by a licensed professional engineer', es: 'Informe independiente de un ingeniero profesional con licencia' },
    summary: { en: 'Identifies the cause and the repair. In Texas condominiums with 8 or more units, the association must obtain this report, give the builder at least 90 days to correct, and get approval from owners with more than 50% of the votes before suing over construction defects. Verify the engineer\'s license with the state board.', es: 'Identifica la causa y la reparación. En condominios de Texas con 8 o más unidades, la asociación debe obtener este informe, dar al constructor al menos 90 días para corregir y lograr la aprobación de propietarios con más del 50% de los votos antes de demandar por defectos de construcción. Verifica la licencia del ingeniero ante la junta estatal.' },
    cost: 'medium', skill: 'specialist', evidence: 'field_tested', time: { en: '2–6 weeks', es: '2 a 6 semanas' },
    materials: { en: 'Licensed engineer (check at pels.texas.gov/search)', es: 'Ingeniero con licencia (verificar en pels.texas.gov/search)' },
    source: { title: 'Texas Property Code § 82.119', url: 'https://texas.public.law/statutes/tex._prop._code_section_82.119', checked: CHECKED, how: 'page_read', official: false }
  }
];

const ORGS_INFRA = [
  {
    id: 'austin-311', urgency: 'authority', countries: ['US'], domains: ['infrastructure'],
    name: { en: 'Austin 3-1-1 (Code Compliance)', es: 'Austin 3-1-1 (Cumplimiento de Código)' },
    contact: { en: 'Call 3-1-1, use the Austin 3-1-1 app or the online form', es: 'Llama al 3-1-1, usa la app Austin 3-1-1 o el formulario en línea' },
    why: { en: 'Inspectors check cracked or loose handrails and unsafe stairs, and can order repairs.', es: 'Los inspectores revisan barandales agrietados o flojos y escaleras inseguras, y pueden ordenar reparaciones.' },
    source: { title: 'City of Austin: Code Compliance resources', url: 'https://www.austintexas.gov/department/code-compliance-resources', checked: CHECKED, how: 'page_read' },
    confidence: 'official'
  },
  {
    id: 'tx-tbpels', urgency: 'science', countries: ['US'], domains: ['infrastructure'],
    name: { en: 'Texas Board of Professional Engineers and Land Surveyors (license lookup)', es: 'Junta de Ingenieros Profesionales de Texas (verificación de licencias)' },
    contact: { en: 'Search an engineer at pels.texas.gov/search', es: 'Busca a un ingeniero en pels.texas.gov/search' },
    why: { en: 'Confirm that the engineer who signs the report is licensed.', es: 'Confirma que el ingeniero que firma el informe tiene licencia.' },
    source: { title: 'TBPELS: General information', url: 'https://pels.texas.gov/overview.htm', checked: CHECKED, how: 'page_read' },
    confidence: 'official'
  }
];

const PLAN_TEMPLATES_INFRA = {
  'structural_damage:green': [
    { category: 'advocacy', amount: 25, title: { en: 'Send the written notice by certified mail', es: 'Enviar el aviso por escrito por correo certificado' }, detail: { en: 'Postage with return receipt and printed photos.', es: 'Envío con acuse de recibo y fotos impresas.' }, criteria: { en: 'Photo of the certified mail receipt.', es: 'Foto del comprobante de correo certificado.' } }
  ],
  'structural_damage:yellow': [
    { category: 'barriers', amount: 40, title: { en: 'Warning cones and tape at the damaged area', es: 'Conos y cinta de advertencia en la zona dañada' }, detail: { en: 'Until the responsible party repairs it.', es: 'Hasta que la parte responsable lo repare.' }, criteria: { en: 'Photo of the area marked.', es: 'Foto de la zona señalizada.' } },
    { category: 'advocacy', amount: 25, title: { en: 'Send formal notices by certified mail', es: 'Enviar avisos formales por correo certificado' }, detail: { en: 'To the association or manager and to the builder.', es: 'A la asociación o administración y al constructor.' }, criteria: { en: 'Photo of the certified mail receipts.', es: 'Foto de los comprobantes de correo certificado.' } },
    { category: 'engineering', amount: 800, title: { en: 'Independent engineer report', es: 'Informe de un ingeniero independiente' }, detail: { en: 'Licensed professional engineer; cause and repair recommendation. Estimate: ask for 2 quotes.', es: 'Ingeniero profesional con licencia; causa y recomendación de reparación. Estimado: pide 2 cotizaciones.' }, criteria: { en: 'Photo of the signed and sealed report cover page.', es: 'Foto de la portada del informe firmado y sellado.' } }
  ],
  'structural_damage:red': [
    { category: 'barriers', amount: 60, title: { en: 'Block access and post a warning', es: 'Bloquear el acceso y colocar un aviso' }, detail: { en: 'Barrier, cones and a sign pointing to another entrance.', es: 'Barrera, conos y un letrero hacia otra entrada.' }, criteria: { en: 'Photo of the blocked area.', es: 'Foto de la zona bloqueada.' } },
    { category: 'advocacy', amount: 25, title: { en: 'Send formal notices by certified mail', es: 'Enviar avisos formales por correo certificado' }, detail: { en: 'Manager, builder, and a 3-1-1 report.', es: 'Administración, constructor y reporte al 3-1-1.' }, criteria: { en: 'Photo of the certified mail receipts.', es: 'Foto de los comprobantes de correo certificado.' } },
    { category: 'engineering', amount: 800, title: { en: 'Urgent independent engineer report', es: 'Informe urgente de un ingeniero independiente' }, detail: { en: 'Licensed professional engineer. Estimate: ask for 2 quotes.', es: 'Ingeniero profesional con licencia. Estimado: pide 2 cotizaciones.' }, criteria: { en: 'Photo of the signed and sealed report cover page.', es: 'Foto de la portada del informe firmado y sellado.' } }
  ]
};

module.exports = { PROTOCOL_ICONS_INFRA, PROTOCOLS_INFRA, ACTIONS_INFRA, ORGS_INFRA, PLAN_TEMPLATES_INFRA };
