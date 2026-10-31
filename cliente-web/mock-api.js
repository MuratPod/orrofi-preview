// Servidor simulado SOLO para la vista previa (?mock=1). Datos ficticios: ningún cliente real. Sustituye window.fetch para /v1/*.
// Opciones: &closed=1 (fuera de horario), &ro=1 (admin: rol partner_readonly), &fail=handover|handover429|load (chat)|queue|conversation (cola), &empty=1 (cola vacía),
// &offline=1 (todas las peticiones /v1/* fallan con TypeError), &lockmin=0.1 (bloqueo SMS en minutos, admite decimales solo aquí), &expired=1 (código caducado), &rate=1 (429 rate_limited en otp/request), &legacy=1 (cola sin handoverId/status/assignedTo).
// Código SMS válido: 123456; otro → invalid_code; 5 rechazos (invalid_code y code_expired cuentan igual) → 429 locked; pedir código nuevo NO reinicia el contador, solo el acceso correcto o el fin del bloqueo. Estado solo en memoria.
// Tokens: access "<rol>.<n>" (rw/ro/cl), refresh "r<n>.<rol>", de un solo uso; reusar uno ya canjeado revoca la sesión (401 unauthorized), como el servidor.
// Opciones de sesión: &tokexp=1 (el access n=1 responde 401 token_expired en /v1/admin/* y /v1/me/*), &tokexp=1&fail=refresh (refresh → 401 unauthorized), &fail=refreshnet (refresh lanza TypeError). window.__mockStats cuenta las llamadas.
// Validación como el servidor: teléfono +34[6-9]xxxxxxxx (normaliza [\s\-().] y 0034 → +34; si no, 422 invalid_phone), esquemas de coverage/applications, Idempotency-Key ^[A-Za-z0-9_-]{8,64}$.
// Web-2: lo carga la web solo si config.js trae mock:true Y la URL lleva ?mock=1. Cola de personal: /v1/staff/handovers (+take|reply|transfer|close) y /v1/staff/colleagues; /v1/auth/logout (204, revoca la sesión).
// Flags Web-2: &fail=relist (500 al releer la cola tras una acción), &fail=take (409 already_taken), &fail=reply (409 handover_not_taken), &fail=transfer, &fail=close, &fail=logout (500 en logout), &fail=colleagues; &fail=queue y &fail=conversation también afectan a /v1/staff/handovers y /{id}; &empty=1 → cola vacía; &role=user → rol company_user (sin permisos de supervisor: no actúa sobre solicitudes de otros).
(() => {
  const Q = new URLSearchParams(location.search), CLOSED = Q.get("closed") === "1", RO = Q.get("ro") === "1", FAIL = Q.get("fail") || "", EMPTY = Q.get("empty") === "1", OFFLINE = Q.get("offline") === "1", LEGACY = Q.get("legacy") === "1";
  const LOCKMIN = Number(Q.get("lockmin")) > 0 ? Number(Q.get("lockmin")) : 15, ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  let openHandover = {};
  const real = window.fetch.bind(window);
  const json = (status, body) => new Response(status === 204 ? null : JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}});
  const err = (status, code, message) => json(status, {error: {code, message}});
  const lang = (o) => ((o.headers && (o.headers["Accept-Language"] || o.headers["accept-language"])) || "es").slice(0, 2);
  const T = {
    ai: {es: "Te atiende un asistente de inteligencia artificial, no una persona. Puedo orientarte sobre tarifas, cobertura y averías.", ca: "Et ateny un assistent d'intel·ligència artificial, no una persona. Et puc orientar sobre tarifes, cobertura i avaries.", en: "You are talking to an artificial intelligence assistant, not a person. I can help with plans, coverage and outages.", fr: "Vous parlez à un assistant d'intelligence artificielle, pas à une personne. Je peux vous aider sur les offres, la couverture et les pannes.", ru: "С вами говорит ассистент на основе искусственного интеллекта, а не человек. Подскажу по тарифам, покрытию и авариям."},
    answer: {es: "La fibra de 600 Mb cuesta 39 € al mes (IVA incluido). [Respuesta de ejemplo del modo mock]", ca: "La fibra de 600 Mb costa 39 € al mes (IVA inclòs). [Resposta d'exemple del mode mock]", en: "600 Mb fibre costs €39 per month (VAT included). [Sample reply from mock mode]", fr: "La fibre 600 Mb coûte 39 € par mois (TVA incluse). [Réponse d'exemple du mode mock]", ru: "Оптика 600 Мб стоит 39 € в месяц (НДС включён). [Пример ответа мок-режима]"},
    human: {es: "He pasado tu consulta a una persona con un resumen. ", ca: "He passat la teva consulta a una persona amb un resum. ", en: "I have passed your request to a person with a summary. ", fr: "J'ai transmis votre demande à une personne avec un résumé. ", ru: "Я передал ваш запрос человеку с кратким резюме. "},
    staff: {es: "Hola, soy Marta, de soporte. ¿En qué puedo ayudarte?", ca: "Hola, sóc la Marta, de suport. En què et puc ajudar?", en: "Hi, this is Marta from support. How can I help?", fr: "Bonjour, ici Marta du support. Comment puis-je vous aider ?", ru: "Здравствуйте, это Марта из поддержки. Чем помочь?"},
    cov: {fiber: "Hay fibra en tu zona (dato orientativo).", radio: "Hay cobertura por radio en tu zona (dato orientativo).", none: "No tenemos cobertura confirmada, pero puedes dejar tu solicitud."},
  };
  const nextOpen = new Date(Date.now() + 36 * 3600e3).toISOString();
  const human = /(persona|humano|human|person|humain|человек|operador)/i;
  const nowIso = () => new Date().toISOString();
  const ctx = (rows) => rows.map(([role, by, text, h]) => ({role, by, content: text, at: ago(h)}));
  const sh = [
    {id: 21, customerId: null, channel: "web", visitor: true, conversationId: 31, status: "open", outsideHours: false, expectedReplyAt: null, language: "es", assignedTo: null, closedBy: null, createdAt: ago(0.3), updatedAt: ago(0.3), closedAt: null,
      note: "Visitante sin identificar. Pide hablar con una persona sobre una avería de fibra en Calonge.", closeNote: null, context: ctx([["user", "client", "Hola, no me funciona internet desde ayer", 0.4], ["assistant", "ai", "Siento oírlo. No hay ninguna avería conocida en tu zona.", 0.4], ["user", "client", "Quiero hablar con una persona.\nEs urgente.", 0.3]])},
    {id: 22, customerId: null, channel: "whatsapp", visitor: true, conversationId: 32, status: "open", outsideHours: true, expectedReplyAt: new Date(Date.now() + 36 * 3600e3).toISOString(), language: "ca", assignedTo: null, closedBy: null, createdAt: ago(2), updatedAt: ago(2), closedAt: null,
      note: "Pregunta por la portabilidad desde otro operador.", closeNote: null, context: ctx([["user", "client", "Voldria portar el meu número", 2.1], ["assistant", "ai", "T'he passat amb una persona.", 2]])},
    {id: 23, customerId: 7, channel: "app", visitor: false, conversationId: 33, status: "taken", outsideHours: false, expectedReplyAt: null, language: "es", assignedTo: 1, closedBy: null, createdAt: ago(5), updatedAt: ago(1), closedAt: null,
      note: "Cliente identificado (ficticio). Quiere cambiar de tarifa.", closeNote: null, context: ctx([["user", "client", "Quiero cambiar de tarifa", 5.1], ["assistant", "ai", "He pasado tu consulta a una persona.", 5], ["assistant", "staff", "Hola, soy Marta, de soporte. Ya lo estoy revisando.", 1]])},
    {id: 24, customerId: 8, channel: "app", visitor: false, conversationId: 34, status: "taken", outsideHours: false, expectedReplyAt: null, language: "en", assignedTo: 2, closedBy: null, createdAt: ago(7), updatedAt: ago(3), closedAt: null,
      note: "Cliente (ficticio): duda sobre la factura.", closeNote: null, context: ctx([["user", "client", "Why was I charged twice?", 7.1], ["assistant", "ai", "I passed this to a colleague.", 7]])},
    {id: 25, customerId: null, channel: "web", visitor: true, conversationId: 35, status: "closed", outsideHours: false, expectedReplyAt: null, language: "es", assignedTo: 1, closedBy: 1, createdAt: ago(30), updatedAt: ago(20), closedAt: ago(20),
      note: "Pregunta por una avería. Sin datos personales.", closeNote: "Resuelto por teléfono.", context: ctx([["user", "client", "¿Hay avería en Calonge?", 30], ["assistant", "staff", "Sí, técnico en camino.", 25]])},
  ];
  // &many=N: N solicitudes abiertas más (ids 100…) para probar la paginación por next
  for (let i = 0, n = Number(Q.get("many") || 0); i < n; i++) sh.push({id: 100 + i, customerId: null, channel: "web", visitor: true, conversationId: 200 + i, status: "open", outsideHours: false, expectedReplyAt: null, language: "es", assignedTo: null, closedBy: null, createdAt: ago(10 + i / 100), updatedAt: ago(10), closedAt: null, note: null, closeNote: null, context: []});
  const outSh = ({note, closeNote, context, ...rest}) => rest;
  let convs = {}, n = 0, otp = {tries: 0, until: 0}, sess = {n: 0, role: "", revoked: false}, usedRefresh = new Set(), idem = {};
  const TOKEXP = Q.get("tokexp") === "1", stats = window.__mockStats = {refresh: 0, logout: 0, replies: [], transfers: [], lists: []};
  const normPhone = (raw) => {
    let p = String(raw || "").replace(/[\s\-().]/g, "");
    if (p.startsWith("0034")) p = "+" + p.slice(2);
    else if (/^34\d{9}$/.test(p)) p = "+" + p;
    else if (/^[6-9]\d{8}$/.test(p)) p = "+34" + p;
    return /^\+34[6-9]\d{8}$/.test(p) ? p : null;
  };
  const pair = (role) => { sess = {n: sess.n + 1, role, revoked: false}; return {token: role + "." + sess.n, refreshToken: "r" + sess.n + "." + role, tokenType: "Bearer", expiresIn: 900, userID: "u1"}; };
  const unauth = () => err(401, "unauthorized", "No autorizado");
  // access token inválido o revocado: 401 unauthorized; con &tokexp=1 el n=1 ya caducó: 401 token_expired
  const checkAuth = (o) => {
    const m = String((o.headers || {}).Authorization || "").match(/^Bearer (\w+)\.(\d+)$/);
    if (!m) return null;
    if (sess.revoked) return unauth();
    if (TOKEXP && Number(m[2]) === 1) return err(401, "token_expired", "Token caducado");
    return null;
  };
  const lockedResp = () => json(429, {error: {code: "locked", message: "Demasiados intentos.", retryAfter: Math.ceil((otp.until - Date.now()) / 1000), retryAfterMinutes: LOCKMIN}});
  const db = {
    handoffs: [
      {id: 6, conversationId: 15, channel: "app", provider: "chatwoot", externalId: "CW-1045", reason: "el cliente de la app pide hablar con una persona", summary: "Cliente identificado (ficticio). Quiere cambiar de tarifa; el asistente no puede ejecutarlo.", customerId: 9, createdAt: ago(0.4), handoverId: 21, status: "open", assignedTo: null},
      {id: 5, conversationId: 14, channel: "web", provider: "chatwoot", externalId: "CW-1044", reason: "el cliente pide hablar con una persona", summary: "Visitante sin identificar. Pide hablar con una persona sobre una avería de fibra en Calonge. ONT sin comprobar.", customerId: null, createdAt: ago(1.5), handoverId: 20, status: "taken", assignedTo: 7},
      {id: 4, conversationId: 13, channel: "whatsapp", provider: "chatwoot", externalId: "CW-1043", reason: "action_request", summary: "Pregunta por la portabilidad desde otro operador. Sin datos personales.", customerId: null, createdAt: ago(9), handoverId: null, status: null, assignedTo: null},
      {id: 3, conversationId: 12, channel: "web", provider: "chatwoot", externalId: "CW-1042", reason: "el cliente pide hablar con una persona", summary: "Visitante: duda sobre la factura de octubre. Pide que le llame una persona.", customerId: null, createdAt: ago(30), handoverId: 19, status: "open", assignedTo: null},
      {id: 2, conversationId: 11, channel: "whatsapp", provider: "chatwoot", externalId: "CW-1041", reason: "motivo interno desconocido", summary: "Cliente identificado (ficticio). Pidió una baja temporal; ya atendida por el equipo.", customerId: 7, createdAt: ago(52), handoverId: null, status: null, assignedTo: null},
      {id: 1, conversationId: 10, channel: "web", provider: "chatwoot", externalId: "CW-1040", reason: "el cliente pide hablar con una persona", summary: "Pregunta por una avería. Sin datos personales.", customerId: null, createdAt: ago(75), handoverId: 18, status: "closed", assignedTo: null}],
    summaries: [
      {id: 9, conversationId: 15, kind: "handoff", channel: "app", status: "pending", attempts: 0, createdAt: ago(0.4), sentAt: null},
      {id: 8, conversationId: 14, kind: "handoff", channel: "web", status: "sent", attempts: 1, createdAt: ago(1.5), sentAt: ago(1.4)},
      {id: 7, conversationId: 13, kind: "handoff", channel: "whatsapp", status: "failed", attempts: 3, createdAt: ago(9), sentAt: null},
      {id: 6, conversationId: 12, kind: "handoff", channel: "web", status: "skipped", attempts: 0, createdAt: ago(30), sentAt: null},
      {id: 5, conversationId: 11, kind: "handoff", channel: "whatsapp", status: "sent", attempts: 1, createdAt: ago(52), sentAt: ago(51.9)},
      {id: 4, conversationId: 11, kind: "closed", channel: "whatsapp", status: "pending", attempts: 0, createdAt: ago(40), sentAt: null},
      {id: 3, conversationId: 10, kind: "handoff", channel: "web", status: "sent", attempts: 1, createdAt: ago(75), sentAt: ago(74.9)},
      {id: 2, conversationId: 10, kind: "closed", channel: "web", status: "sent", attempts: 1, createdAt: ago(70), sentAt: ago(69.9)}],
    conversations: [15, 14, 13, 12, 11, 10].map((id) => ({id, channel: id === 15 ? "app" : id === 13 || id === 11 ? "whatsapp" : "web", messageCount: 5, createdAt: ago(80 - id)})),
  };
  const detail = (id) => {
    const h = db.handoffs.filter((x) => x.conversationId === id);
    return {id, channel: (db.conversations.find((c) => c.id === id) || {}).channel || "web", handoffs: h, toolCalls: [{name: "check_outage", status: "ok", result: {known: false}}],
      messages: [{role: "user", content: "Hola, no me funciona internet desde ayer"}, {role: "assistant", content: "Siento oírlo. He comprobado: no hay ninguna avería conocida en tu zona.", agentVersion: 3},
        {role: "user", content: "Quiero hablar con una persona.\nEs urgente."}, {role: "assistant", content: "He pasado tu consulta a una persona con un resumen.", agentVersion: 3},
        {role: "assistant", by: "staff", content: "Hola, soy Marta, de soporte. Ya lo estoy revisando."}, {role: "system", content: "interno: no mostrar"}]};
  };
  const route = async (method, path, search, o) => {
    const L = lang(o), body = o.body ? JSON.parse(o.body) : {};
    if (path === "/v1/public/config" && FAIL === "load") return err(500, "internal_error", "Error simulado del servidor");
    if (path === "/v1/public/config") return json(200, {supportPhone: "+34 972 66 29 43", handover: {timezone: "Europe/Madrid", days: [1, 2, 3, 4, 5], from: "09:00", to: "20:00", availableNow: !CLOSED, nextAvailableAt: CLOSED ? nextOpen : null},
      languages: ["es", "ca", "en", "fr", "ru"], legal: {consentKinds: ["chat_storage"]}, aiDisclosure: T.ai[L] || T.ai.es});
    if (path.startsWith("/v1/me/")) { const a = checkAuth(o); if (a) return a; }
    if (path === "/v1/public/chat" || path === "/v1/me/chat") {
      const msg = String(body.message || "");
      if (msg.length < 1 || msg.length > 2000) return err(422, "invalid_request", "Message length 1..2000");
      const id = body.conversationId || "c" + ++n; convs[id] = convs[id] || {staffSent: false};
      const wants = human.test(msg);
      if (wants) setTimeout(() => { convs[id].staffReady = true; }, 6000);
      const out = {conversationId: id, text: wants ? T.human[L] + (CLOSED ? "" : "") : T.answer[L], key: wants ? "handover" : "answer", suggestsHuman: false, aiDisclosed: true, humanRequested: wants, createdAt: new Date().toISOString()};
      if (path === "/v1/public/chat" && !body.conversationToken) out.conversationToken = "mock-token-" + id;
      return json(200, out);
    }
    let m = path.match(/^\/v1\/public\/chat\/([^/]+)\/messages/);
    if (m) { const c = convs[m[1]]; const after = Number((search.match(/after=(\d+)/) || [])[1] || 0); const msgs = [];
      if (c && c.staffReady) msgs.push({index: 0, role: "assistant", by: "staff", text: T.staff[L] || T.staff.es, createdAt: new Date().toISOString()});
      return json(200, {messages: msgs.filter((x) => x.index >= after)}); }
    m = path.match(/^\/v1\/me\/chat\/([^/]+)$/);
    if (m) { const c = convs[m[1]]; return json(200, {messages: c && c.staffReady ? [{id: "s1", role: "assistant", by: "staff", text: T.staff[L] || T.staff.es}] : []}); }
    if (path === "/v1/public/coverage") {
      const pc = String(body.postcode || ""), sz = (v, a, b) => typeof v === "string" && v.length >= a && v.length <= b;
      if (Object.keys(body).some((k) => !["postcode", "street", "number"].includes(k)) || !/^\d{5}$/.test(pc) || !sz(body.street, 2, 200) || (body.number !== undefined && !sz(body.number, 0, 20))) return err(422, "invalid_request", "Solicitud no válida");
      const c = pc === "17251" || pc === "17250" ? "fiber" : pc.startsWith("17") ? "radio" : "none";
      return json(200, {coverage: c, municipality: c === "none" ? "" : "Calonge i Sant Antoni", message: T.cov[c], canApply: true, confirmedByTechnician: false});
    }
    if (path === "/v1/public/applications") {
      const sz = (v, a, b) => typeof v === "string" && v.length >= a && v.length <= b, OK = ["fullName", "phone", "email", "postcode", "street", "number", "interest", "language", "consentContact"];
      if (Object.keys(body).some((k) => !OK.includes(k)) || !sz(body.fullName, 2, 120) || typeof body.phone !== "string" || !/^\d{5}$/.test(String(body.postcode || "")) || !sz(body.street, 2, 200)
        || (body.email !== undefined && body.email !== null && !(sz(body.email, 0, 200) && /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/.test(body.email))) || (body.number !== undefined && !sz(body.number, 0, 20))
        || (body.interest !== undefined && !sz(body.interest, 0, 300)) || (body.language !== undefined && !["es", "ca", "en", "fr", "ru"].map((x) => x.toUpperCase()).includes(String(body.language).toUpperCase()))) return err(422, "invalid_request", "Solicitud no válida");
      if (body.consentContact !== true) return err(422, "consent_required", "consent_required");
      if (!normPhone(body.phone)) return err(422, "invalid_phone", "Teléfono no válido");
      const ik = (o.headers || {})["Idempotency-Key"];
      if (ik !== undefined) {
        if (!/^[A-Za-z0-9_-]{8,64}$/.test(ik)) return err(422, "invalid_request", "Idempotency-Key no válida");
        if (idem[ik] && idem[ik] !== o.body) return err(409, "idempotency_conflict", "Misma clave con otro cuerpo");
        idem[ik] = o.body;
      }
      return json(202, {reference: "SOL-MOCK0042", status: "received", coverage: "fiber", message: "", outsideHours: CLOSED, expectedContactAt: CLOSED ? nextOpen : null});
    }
    if (path === "/v1/me/handovers" && method === "POST") {
      const ik = (o.headers || {})["Idempotency-Key"];
      if (ik !== undefined && !/^[A-Za-z0-9_-]{8,64}$/.test(ik)) return err(422, "invalid_request", "Idempotency-Key no válida");
      if (FAIL === "handover") return err(500, "internal_error", "Error simulado del servidor");
      if (FAIL === "handover429") return json(429, {error: {code: "rate_limited", message: "Demasiadas solicitudes"}});
      const again = !!openHandover.id; openHandover = openHandover.id ? openHandover : {id: "h1", status: "open", outsideHours: CLOSED, expectedReplyAt: CLOSED ? nextOpen : null, supportPhone: "+34 972 66 29 43", message: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
      return new Response(JSON.stringify(openHandover), {status: again ? 200 : 202, headers: {"Content-Type": "application/json", ...(again ? {"Idempotent-Replay": "true"} : {})}});
    }
    if (path === "/v1/auth/otp/request") {
      if (!normPhone(body.phone)) return err(422, "invalid_phone", "Teléfono no válido");
      if (Q.get("rate") === "1") return new Response(JSON.stringify({error: {code: "rate_limited", message: "Demasiadas solicitudes", retryAfter: 20}}), {status: 429, headers: {"Content-Type": "application/json", "Retry-After": "20"}});
      if (otp.until > Date.now()) return lockedResp();
      return json(202, {status: "sent", message: "ok", expiresIn: 300, resendAfter: 60});
    }
    if (path === "/v1/auth/otp/verify") {
      if (!normPhone(body.phone)) return err(422, "invalid_phone", "Teléfono no válido");
      if (otp.until > Date.now()) return lockedResp();
      // como el servidor, cada rechazo (código incorrecto o caducado) cuenta; el 5.º devuelve ya 429 locked
      const miss = (status, code, msg) => { otp.tries++; if (otp.tries >= 5) { otp.tries = 0; otp.until = Date.now() + LOCKMIN * 60e3; return lockedResp(); } return err(status, code, msg); };
      if (Q.get("expired") === "1") return miss(400, "code_expired", "El código ha caducado");
      if (body.code === "123456") { otp.tries = 0; return json(200, pair("cl")); }
      return miss(400, "invalid_code", "Código incorrecto");
    }
    if (path === "/v1/auth/refresh") {
      stats.refresh++;
      if (FAIL === "refreshnet") throw new TypeError("Failed to fetch");
      const m = String(body.refreshToken || "").match(/^r(\d+)\.(\w+)$/);
      if (FAIL === "refresh" || !m || sess.revoked || Number(m[1]) !== sess.n) return unauth();
      if (usedRefresh.has(body.refreshToken)) { sess.revoked = true; return unauth(); }
      usedRefresh.add(body.refreshToken);
      return json(200, pair(m[2]));
    }
    if (path === "/v1/staff/auth/login") { usedRefresh = new Set(); return json(200, pair(RO || /^readonly/.test(body.email || "") ? "ro" : "rw")); }
    if (path === "/v1/auth/logout") {
      const a = checkAuth(o); if (a) return a;
      if (!/^Bearer \w+\.\d+$/.test(String((o.headers || {}).Authorization || "")) || sess.revoked) return unauth();
      stats.logout++;
      if (FAIL === "logout") return err(500, "internal_error", "Error simulado del servidor");
      sess.revoked = true; return json(204, null);
    }
    if (path.startsWith("/v1/staff/") && path !== "/v1/staff/auth/login") {
      const a = checkAuth(o); if (a) return a;
      const ro = RO || /^Bearer ro\./.test((o.headers || {}).Authorization || "");
      if (path === "/v1/staff/colleagues") {
        if (FAIL === "colleagues") return err(500, "internal_error", "Error simulado del servidor");
        // contrato real: name siempre null (el cliente localiza la etiqueta por id); &names=1 simula un servidor futuro que sí manda nombre
        return json(200, {colleagues: [1, 2, 3].map((id) => ({id, name: Q.get("names") === "1" ? "Nombre " + id : null}))});
      }
      if (path === "/v1/staff/handovers") {
        if (FAIL === "queue") return err(500, "internal_error", "Error simulado del servidor");
        const sq = new URLSearchParams(search), st = sq.get("status"), lim = sq.get("limit");
        stats.lists.push(search);
        // &fail=relist: el listado responde 500 una vez hecha cualquier acción (take/reply/transfer/close)
        if (FAIL === "relist" && stats.acted) return err(500, "internal_error", "Error simulado del servidor");
        if (st && !["open", "taken", "closed"].includes(st)) return err(422, "invalid_request", "status no válido");
        // paginación como el servidor: al cortar se quedan las MÁS RECIENTES (offset desde la más nueva), dentro de la página las antiguas primero; next = cursor (id) de la página más antigua
        const cur = sq.get("cursor"), off = Number(sq.get("offset") || 0), size = lim ? Number(lim) : 100;
        if (cur !== null && !/^\d+$/.test(cur)) return err(422, "invalid_request", "cursor no válido");
        if (!(size >= 1 && size <= 200)) return err(422, "invalid_request", "limit no válido");
        let rows = EMPTY ? [] : sh.filter((x) => (!st || x.status === st) && (cur === null || x.id < Number(cur))).sort((a, b) => b.id - a.id).slice(off, off + size + 1);
        const more = rows.length > size;
        rows = rows.slice(0, size).sort((a, b) => a.id - b.id);
        return json(200, {handovers: rows.map(outSh), next: more && rows.length ? String(rows[0].id) : null});
      }
      const hm = path.match(/^\/v1\/staff\/handovers\/(\d+)(?:\/(take|reply|transfer|close))?$/);
      if (hm) {
        const h = sh.find((x) => x.id === Number(hm[1])), act = hm[2];
        if (!h) return err(404, "not_found", "No encontrado");
        if (!act && method === "GET") return FAIL === "conversation" ? err(500, "internal_error", "Error simulado del servidor") : json(200, h);
        if (ro) return err(403, "forbidden", "Sin permiso");
        if (act) stats.acted = true;
        if (act === "take") {
          if (FAIL === "take" || (h.status === "taken" && h.assignedTo !== 1)) return err(409, "already_taken", "La solicitud ya la tiene otra persona");
          if (h.status === "closed") return err(409, "handover_not_open", "La solicitud está cerrada");
          h.status = "taken"; h.assignedTo = 1; h.updatedAt = nowIso(); return json(200, h);
        }
        if (act === "close" && h.status !== "closed") { if (FAIL === "close") return err(500, "internal_error", "Error simulado del servidor"); h.status = "closed"; h.closedBy = 1; h.closedAt = h.updatedAt = nowIso(); stats.closed = (stats.closed || 0) + 1; return json(200, h); }
        if (h.status !== "taken" || FAIL === "reply" && act === "reply") return err(409, "handover_not_taken", "La solicitud no está tomada");
        if (h.assignedTo !== 1 && Q.get("role") === "user") return err(403, "forbidden", "Sin permiso");
        if (act === "reply") {
          const text = String(body.text || "").trim();
          if (!text || text.length > 2000) return err(422, "invalid_request", "Texto de 1 a 2000 caracteres");
          h.context.push({role: "assistant", by: "staff", content: text, at: nowIso()}); stats.replies.push(text);
          return json(200, {delivered: true, conversationId: String(h.conversationId), index: h.context.length - 1});
        }
        if (act === "transfer") {
          if (FAIL === "transfer" || ![1, 2, 3].includes(body.assignTo)) return err(422, "invalid_request", "Compañero no válido");
          h.assignedTo = body.assignTo; h.updatedAt = nowIso(); stats.transfers.push(body.assignTo); return json(200, h);
        }
      }
      return err(404, "not_found", "mock: " + path);
    }
    if (path.startsWith("/v1/admin/")) {
      const a = checkAuth(o); if (a) return a;
      const ro = RO || /^Bearer ro\./.test((o.headers || {}).Authorization || ""), p = path.slice(9);
      if (p === "/tenant") return json(200, {id: 1, name: "OrroFi (demo)", canWrite: !ro, me: {id: 1, email: ro ? "partner@example.test" : "admin@example.test", role: ro ? "partner_readonly" : (Q.get("role") === "user" ? "company_user" : "company_admin")}});
      if (p === "/settings") return json(200, {hours: {timezone: "Europe/Madrid", days: [1, 2, 3, 4, 5], from: "09:00", to: "20:00"}, humanLed: false, summaryEmail: "e***@example.test", summaryLang: "es"});
      if (FAIL === "queue" && (p === "/handoffs" || p === "/summaries")) return err(500, "internal_error", "Error simulado del servidor");
      if (p === "/handoffs") return json(200, {handoffs: EMPTY ? [] : LEGACY ? db.handoffs.map(({handoverId, status, assignedTo, ...rest}) => rest) : db.handoffs});
      if (p === "/summaries") { const st = (search.match(/status=(\w+)/) || [])[1]; return json(200, {summaries: EMPTY ? [] : db.summaries.filter((x) => (!st || x.status === st) && !(LEGACY && x.kind === "closed"))}); }
      if (p.startsWith("/metrics")) return json(200, {conversations: {total: 6, byChannel: {web: 3, whatsapp: 2, app: 1}}, messages: {user: 18, assistant: 17, staff: 2}, handoff: {conversations: 6, rate: 1}, firstReply: {assistant: {medianSeconds: 4}, human: {medianSeconds: 420}},
        summaries: {sent: 4, failed: 1, pending: 2}, llm: {calls: 35, tokensIn: 41200, tokensOut: 6900, estimatedCostUSD: 0.21}, agentVersions: {"3": 6}});
      if (p === "/conversations") return json(200, {conversations: db.conversations});
      m = p.match(/^\/conversations\/(\d+)$/); if (m && FAIL === "conversation") return err(500, "internal_error", "Error simulado del servidor");
      if (m) return json(200, detail(Number(m[1])));
      if (p === "/agent") return json(200, {name: "Mi gestor", greeting: "Hola, soy el asistente de OrroFi.", tenantPrompt: "", personality: "Cercano y claro", behavior: "Responde solo con información aprobada.", version: 3});
      return err(404, "not_found", "mock: " + p);
    }
    return null;
  };
  window.fetch = async (input, init = {}) => {
    const u = new URL(typeof input === "string" ? input : input.url, location.href), k = u.pathname.indexOf("/v1/");
    if (/\/ready$/.test(u.pathname)) return OFFLINE ? Promise.reject(new TypeError("Failed to fetch")) : json(200, {status: "ok", db: "ok", jobs: {status: "ok", lastSuccessAt: ago(0.1)}});
    if (k < 0) return real(input, init);
    if ((OFFLINE && !/\/staff\/auth\/login$|\/admin\/tenant$/.test(u.pathname)) || !navigator.onLine) throw new TypeError("Failed to fetch");
    await new Promise((r) => setTimeout(r, 200));
    const r = await route((init.method || "GET").toUpperCase(), u.pathname.slice(k), u.search, init);
    return r || err(404, "not_found", "mock: " + u.pathname);
  };
})();
