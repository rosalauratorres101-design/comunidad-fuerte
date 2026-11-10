# Guía rápida en español: Comunidad Fuerte

Comunidad Fuerte ayuda a las comunidades ante **contaminación**, **daños en espacios compartidos** (escaleras, barandales, andadores) y **otros problemas que afectan directamente a los vecinos** (olor a gas, cables caídos, inundaciones, fugas de agua, baches, alumbrado, reparaciones en vivienda rentada y basura tirada): evalúa el riesgo, indica a qué institución reportar, prepara el reporte y estima el costo de reparación según el lugar.

## 1. Ejecutar en tu computadora (sin claves)

1. Instala Node.js 20 o más reciente desde nodejs.org.
2. Descomprime la carpeta `comunidad-fuerte`.
3. Abre una terminal en esa carpeta y escribe:
   ```
   npm install
   npm start
   ```
4. Abre http://localhost:3000 en el navegador.

La app funciona en **modo demo**: la IA usa reglas transparentes y los pagos de PayPal son simulados (todo aparece marcado como "Simulado"). En la página de inicio, elige **Iniciar este escenario** para recorrer el sargazo (amarillo), el químico en el río (rojo) o la escalera de condominio agrietada (amarillo). El botón ES/EN cambia el idioma de la interfaz.

## 2. Activar el modo real (para el concurso)

1. **Copia el archivo de claves:** duplica `.env.example` y renómbralo `.env` (nunca lo subas a GitHub; el `.gitignore` ya lo excluye).
2. **Claude:** en console.anthropic.com → API Keys, crea una clave y pégala en `ANTHROPIC_API_KEY`. Carga un poco de saldo en Billing. La búsqueda web viene activada; si la desactivaron, se enciende en Settings → Capabilities.
3. **PayPal sandbox:** en developer.paypal.com → Apps & Credentials → pestaña **Sandbox**, crea una app y copia `Client ID` y `Secret` en `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`.
4. **Cuentas de prueba:** en Sandbox → Accounts hay una cuenta *business* (recibe donaciones) y una *personal* (dona y recibe pagos). Usa el correo de la personal en los pasos 5 y 7.
5. **Verifica todo de una vez:**
   ```
   npm run check-live -- --payout-to=<correo personal sandbox> --invoice-to=<correo personal sandbox>
   ```
   Debe salir OK en: Claude, búsqueda web, pedido de $1, pago de $1 y factura del Agent Toolkit. Se niega a correr contra PayPal real.
6. **Arranca:** `npm start`. La barra superior debe decir "En vivo (Claude)" y "Sandbox".
7. **Prueba en la app (10 minutos):** escenario A → sube una foto real → dona con la cuenta personal → sube evidencia de una etapa → aprueba el pago. En "Cómo aprende", pulsa **Revisar ahora con IA** en una ley (por ejemplo el cap. 27) y confirma que aparece la fecha de revisión.
8. **En Render:** ver la sección 4.B.

## 3. Lo que debe revisar la creadora antes de entregar

- [ ] Protocolos de seguridad en español e inglés (`lib/content.js`, sección `PROTOCOLS`). Al aprobarlos, cambia `en` y `es` a `'team_reviewed'` en `PROTOCOL_REVIEW`.
- [ ] Plantillas de etapas y costos (`PLAN_TEMPLATES`): ajustar a precios reales de la zona.
- [ ] Fuentes marcadas "no confirmada" (PROFEPA, INALI, números de emergencia): verificar y actualizar.
- [ ] Conseguir grabaciones reales en maya yucateco y náhuatl (con consentimiento escrito).

## 4. Entrega al concurso, paso a paso

**Fecha límite:** 12 de noviembre de 2026, 12:00 p. m. hora del Pacífico, que son las **2:00 p. m. en Austin**. Recomendación: entregar el 10 de noviembre.

**A. GitHub**
1. El proyecto ya trae un repositorio git con el primer commit. Crear en GitHub un repositorio **público** llamado `comunidad-fuerte`, **sin** README ni licencia (ya vienen en el proyecto).
2. Subirlo:
   ```
   git remote add origin https://github.com/<usuario>/comunidad-fuerte.git
   git push -u origin main
   ```
3. En GitHub → "About" (engrane): escribir la descripción, agregar la URL de Render y confirmar que aparece **MIT License**.

**B. Render**
1. render.com → New → **Blueprint** → elegir el repositorio. Usa `render.yaml`, que ya trae `MEDIA_LINK_SECRET` automático y `ALLOW_RESET=false` (nadie puede borrar los datos).
2. Escribir `ANTHROPIC_API_KEY`, `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET` cuando Render los pida.
3. Plan gratis: funciona, pero la app se duerme cuando nadie la usa y borra los reportes al reiniciar. Plan Starter (de pago): activar el disco que viene comentado en `render.yaml` y agregar `DATA_DIR=/var/data`.
4. **Mantener las claves con saldo y la app encendida hasta el 15 de diciembre de 2026** (fin de la evaluación).
5. Abrir la URL en un **iPhone con Safari** y en un Android, y hacer el recorrido de `docs/TESTING.md`.

**C. Video**
1. Seguir `docs/VIDEO-SCRIPT.md`: una sola historia, 2:45, en **modo real** (debe decir *Sandbox*, no *Simulado*).
2. No mostrar direcciones reales, casos reales, logotipos de otras marcas ni música con derechos.
3. Subir a YouTube como **Público**. Agregar los subtítulos `docs/captions-en.srt` (inglés) y `docs/subtitulos-es.srt` (español).

**D. Devpost (entrega individual)**
1. Entregar como participante individual (mayor de edad).
2. Copiar los textos de `docs/SUBMISSION.md` en cada campo. En "Testing instructions" pegar la URL de Render y el enlace a `docs/TESTING.md`.
3. Pegar el enlace del repositorio y el de YouTube.
4. Premio de patrocinador: elegir **AG Grid** (registro público, tabla de estadísticas y tabla de leyes).
5. Revisar la vista previa y pulsar **Submit** antes de la fecha límite.

## 5. Cómo sigue mejorando la app

- **Actualizaciones:** con clave de IA, cada 24 horas busca nuevos métodos y organizaciones. Lo que no tiene fuente verificable se descarta; lo demás espera aprobación en "Cómo aprende".
- **Aprendizaje:** cada etapa pagada guarda el costo real y la calificación de la comunidad. Con 3 o más casos, la estimación usa la mediana real.
- **Correcciones:** cualquier persona reporta un error; nada cambia sin un revisor con nombre.
- **Leyes, reglas y contactos:** en "Cómo aprende" está la lista de cada ley, plazo y teléfono que usa la app, con los datos exactos, la fecha de la última revisión y la próxima. Con clave de IA, la actualización periódica revisa los que tocan (leyes cada 6 meses, teléfonos cada 3) con búsqueda web; un posible cambio solo cuenta si cita una página que la búsqueda realmente abrió, y espera a una persona revisora. Si se confirma, aparece una advertencia en cada reporte que cita esa regla hasta que se actualice el texto y alguien marque "Lo revisé". Cualquier persona puede **Reportar un cambio**.
- Para correr una actualización manual: `npm run refresh-knowledge`.

## 6. Reportar a la institución adecuada y costo de reparación

- **Conclusión legal (Texas):** con el año de construcción, si la constructora ya parchó el daño y si otro edificio tiene el mismo daño, la app dice quién paga la reparación (la constructora, si es un defecto de construcción, lo que confirma el informe de un ingeniero), quién debe actuar ya (la asociación), por qué, y qué plazos podrían estar corriendo, con las leyes citadas.
- Pestaña **Reportar**: quién es responsable y por qué (con fuentes legales de Texas), a quién acudir en orden, el reporte o carta listo (copiar, abrir en el correo o imprimir), y registro del envío con fechas de seguimiento. Tus datos personales para las cartas se guardan solo en tu dispositivo.
- **Costo aproximado de reparación**: promedios de guías de costos de EE. UU., ajustados por el nivel de precios de la zona (BEA) o del país (Banco Mundial), en dólares y moneda local. Con 3 o más cotizaciones locales reales, la app usa su mediana.
- **Seguimiento de la grieta**: mediciones fechadas; si crece, sube el nivel de riesgo.
- Pestaña **Resumen**: el caso completo en una página (nivel de riesgo, qué hacer, responsables, reportes enviados, costo, fondo, evidencia y próximos pasos). Se elige el idioma entre los 10 de la app; se puede imprimir o guardar como PDF, copiar o compartir. Títulos y pasos de seguridad salen del texto propio de la app en cada idioma; en francés, portugués, chino, hindi, árabe, bengalí, ruso e indonesio, los detalles del caso se traducen con la IA cuando la clave está conectada (marcado como traducción automática); sin clave quedan en inglés con un aviso.

## 6b. Colores de peligro según el país

La lógica interna sigue con tres niveles, pero cada caso se muestra con los colores y la palabra de señal de la norma del país donde ocurre: EE. UU., ANSI Z535 y OSHA 1910.145 (PELIGRO rojo, ADVERTENCIA naranja, PRECAUCIÓN amarillo, instrucciones de seguridad verde); México, NOM-026-STPS-2008 (rojo prohibición, amarillo advertencia de peligro, verde condición segura); Unión Europea y Reino Unido, Directiva 92/58/CEE; los demás países, ISO 3864. Cuando la norma tiene nivel naranja, un caso amarillo con señales que podrían causar lesiones graves se muestra como ADVERTENCIA. Las normas están en la lista de leyes que la app revisa.

## 7. Sargazo: todas las soluciones por etapa

En la pestaña Soluciones de un reporte de sargazo hay 22 opciones con fuente, en seis etapas: verlo venir (pronóstico satelital del LANOT-UNAM, semáforo diario de la Red de Monitoreo del Sargazo, estaciones ciudadanas de foto), detenerlo en el mar (barreras y barcos de la Marina, barcos recolectores pequeños, hundimiento en mar profundo, que es experimental y está prohibido en México), retirarlo de la playa (lineamientos SEMARNAT 2021: a mano, en menos de 72 horas, nunca quemar, enterrar ni tirar al mar; los escurrimientos llevan arsénico al acuífero), proteger a las personas (monitor de ácido sulfhídrico, 5 ppm), aprovecharlo (Sargablock, bioestimulante y emulsificante industrial, co-composta de máximo 10%, productos pequeños y rutas de laboratorio) y la causa de fondo (nutrientes del Amazonas y afloramiento de África occidental). Cada una dice quién puede hacerla, qué tan probada está y sus precauciones. En Quintana Roo, "Pedir ayuda" agrega ZOFEMAT municipal, la Red de Monitoreo del Sargazo y el LANOT-UNAM.

## 7b. Otros problemas de la comunidad

En la portada, **Reportar otro problema de la comunidad**. La categoría fija el nivel inicial y la urgencia, las lesiones o los residuos peligrosos solo pueden subirlo.

| Problema | Nivel inicial | En Austin (verificado el 18-10-2026) |
|---|---|---|
| Olor o fuga de gas | Rojo, emergencia | Salir a pie; 911 y Texas Gas Service 1-800-959-5325 |
| Cable eléctrico caído | Rojo | Austin Energy 512-322-9100 |
| Inundación o drenaje tapado | Amarillo (Rojo si hay peligro ya) | 3-1-1; 911 en emergencia |
| Fuga de agua o tubería rota | Amarillo | Austin Water 512-972-1000 (24/7) |
| Bache, alumbrado, basura tirada | Amarillo / Verde / Verde | 3-1-1 (basura también 1-877-NO-DUMPS) |
| Reparaciones en vivienda rentada | Amarillo | Arrendador (§ 92.052) y 3-1-1 Cumplimiento de Código |

Fuera de lugares verificados, la app no muestra teléfonos que no haya confirmado; la búsqueda de "Pedir ayuda" encuentra los locales con fuente. Ojo: desde el 1 de noviembre de 2026 el teléfono del 3-1-1 atiende de 7 a. m. a 9 p. m.

## 8. Funciones nuevas para el concurso

- **Agente de recaudación:** en "Fondo y trabajo", "Pedir a un patrocinador". El agente usa el PayPal Agent Toolkit para enviar una factura a un negocio o cooperativa por una etapa y genera un **cartel QR imprimible** bilingüe. Puede pedir dinero, nunca enviarlo.
- **Modo sin señal:** los protocolos y los incidentes ya abiertos funcionan sin internet; los reportes se guardan en el teléfono y se envían al reconectar.
- **Impacto en la portada** y botón **Cargar un ejemplo completo** para que los jueces vean todo en un clic. Funciona también en el servidor real: sus pagos siempre son simulados y están marcados, no tocan el sandbox de PayPal, y crea 4 reportes para que las Estadísticas tengan datos.
- **Textos para Devpost y guion del video** en la carpeta `docs/`.

## 8b. Privacidad: cada consulta es privada

- Solo quien hace el reporte puede verlo. Al guardarlo, el servidor entrega una **clave de acceso** una sola vez y guarda solo su huella SHA-256. Sin la clave, la app responde "no encontrado"; no existe una lista pública de reportes.
- El teléfono o la computadora guarda las claves de sus propios reportes. En la pestaña **Evidencia** está el **código de acceso** para abrir el reporte en otro dispositivo (Inicio, "Abrir un reporte desde otro dispositivo") y un botón para quitarlo de este dispositivo.
- Las fotos y grabaciones se sirven solo con **enlaces firmados que vencen** en 12 horas. Las copias ya no tienen datos de ubicación.
- El **registro público** muestra solo montos, tipo de problema, propósito y huellas: sin lugares, descripciones, fotos ni número de reporte; quienes donan son anónimos y quienes reciben o aprueban pagos aparecen con iniciales.
- Las autoridades y organizaciones ven los datos solo en los mensajes que la persona decide enviar.

## 8b2. Leyes por nivel: internacional, nacional, estatal y local

- Cada reporte se ubica en sus jurisdicciones: internacional (y la Unión Europea si aplica), país, estado o provincia y ciudad, según el país y el lugar escrito (por ejemplo "Tulum, Quintana Roo").
- En la pestaña Reporte y en el resumen aparecen, por nivel, solo las reglas verificadas para ese lugar y ese tipo de problema, con fuente y fecha de revisión. Si un nivel no está verificado, la app lo dice en vez de adivinar.
- Verificadas hoy: Acuerdo de Escazú (México), LGEEPA art. 189 (denuncia popular), lineamientos del sargazo, NOM-026, Procuraduría de Protección al Ambiente de Quintana Roo, Zofemat Tulum; EPA, TCEQ, leyes de Texas y canales de Austin; y las leyes de privacidad que rigen la app (LFPDPPP 2025 de México, TDPSA de Texas, RGPD de la UE).
- Si las reglas difieren en seguridad, la app indica seguir la más estricta y confirmar con la autoridad local. Es información general, no asesoría legal.
- Para agregar un país, estado o ciudad: verificar sus reglas, agregarlas en `lib/laws.js` con su código y temas, y el nombre del lugar en `lib/jurisdiction.js`.

## 8b3. Trabajo con gobiernos y vecinos

Todo escrito desde cero para este proyecto: se tomaron ideas generales de otras apps cívicas, sin copiar código, textos ni diseño.

- **Enlace oficial para la autoridad:** la persona crea un enlace que se agrega a sus cartas. La oficina lo abre sin crear cuenta, ve lo que la persona decidió compartir (nunca el nombre si es anónimo ni los datos de contacto) y registra su respuesta: recibido con folio, en proceso con fecha estimada, resuelto, turnado a otra autoridad o no es de su competencia. Cada respuesta queda en el registro inalterable y aparece en la pestaña Reporte.
- **Escalar cuando nadie responde:** al pasar la fecha de seguimiento, o si la persona marca "sin respuesta", la app sugiere la siguiente autoridad verificada (local → estatal → nacional → internacional) y redacta el mensaje. Para el constructor en Texas indica esperar unos 60 días desde el aviso (capítulo 27) antes de una acción legal.
- **Qué significa una respuesta:** al registrar una respuesta, la persona elige el tipo ("la garantía venció / la constructora no pagará", "la asociación lo reparará", "lo van a inspeccionar"). La app explica en palabras sencillas qué significa y qué no, cita solo reglas verificadas del lugar y redacta una respuesta. Un correo a la constructora en Texas ya no cuenta como el aviso del capítulo 27: el resumen recuerda enviar el aviso por correo certificado.
- **Recordatorios en el calendario:** las fechas de seguimiento se descargan en un archivo .ics para Google, Apple u Outlook, con aviso un día antes.
- **Enlace de apoyo vecinal:** los vecinos ven una página limitada (sin dirección, descripción, fotos ni nombres), confirman de forma anónima o firman con el nombre que elijan. El número y las firmas se agregan a las cartas.
- **Fondos iguales del gobierno:** desde el enlace oficial, la oficina se compromete a igualar las donaciones de la comunidad 1 a 1 hasta un límite. La persona solicita el monto; el agente envía a la oficina una factura de PayPal que las reglas del código limitan a lo que corresponde. El dinero entra al mismo fondo, se paga solo por trabajo verificado y aparece en el registro público con el nombre de la oficina.
- **Siguiente etapa (diseñada, no construida):** bandeja para gobiernos donde una oficina verificada vea todos los reportes que recibe. Requiere registrar y verificar oficinas (correo con dominio oficial y una segunda comprobación) para que nadie se haga pasar por un gobierno.
- **Para gobiernos:** la página de Estadísticas y el CSV dan totales anónimos, zonas con más problemas y tiempos de respuesta para planear.

## 8b4. Funciona en cualquier dispositivo

Es una aplicación web: funciona en Chrome, Safari, Firefox o Edge en Android, iPhone, iPad, Windows, Mac, Chromebook y Linux, y se puede instalar en la pantalla de inicio. Requiere un navegador de 2019 o más nuevo; los muy antiguos ven un aviso en español e inglés. Probada con Chromium en tamaños de iPhone SE, iPhone 15 Pro Max, Pixel 7, Galaxy S9+, iPad Mini, 320 px y computadora; falta probarla en un iPhone real con Safari.

## 8c. Estadísticas anónimas

- Página **Estadísticas** (y descarga CSV): problemas por tipo, nivel de peligro, país, mes y categoría; zonas donde se concentran; reportes enviados a autoridades, respondidos, resueltos y días típicos de respuesta; trabajos pagados; calificaciones; y costo real contra el estimado. Filtros por país, tipo y meses.
- Reglas de privacidad en el código: solo cuentan los reportes cuyo dueño lo permite (casilla al reportar, se puede cambiar en Evidencia); sin texto libre, nombres, fotos, lugar exacto, número de reporte ni fecha exacta; meses y cuadros de unos 10 km; todo grupo con menos de 3 reportes se combina o aparece como "<3"; con menos de 3 reportes en total no se publica nada.
- **No se guardan correos ni teléfonos:** la app los borra automáticamente de todo texto que se guarda (descripciones, respuestas, notas, destinatarios, respuestas de autoridades). Los datos de contacto solo se usan dentro de las cartas que la persona prepara y nunca se guardan.
- Los reportes son anónimos por defecto: no se pide cuenta, correo ni teléfono, y el nombre solo se guarda si la persona desmarca "Reportar de forma anónima".
- Los trabajos terminados y las calificaciones siguen alimentando el aprendizaje de la app (costos y métodos que funcionan).

## 9. Pruebas

```
npm test       # 53 pruebas: reglas, evidencia, agente, responsabilidad, cartas, costos, resumen, problemas comunitarios, revisión de leyes privacidad y estadísticas anónimas y leyes por nivel, escalamiento, apoyo vecinal y enlace oficial y fondos iguales
npm run e2e    # prueba completa en navegador con Playwright (117 verificaciones)
```
