// Chat web GhoFi "Mi gestor" (diseño v5). Tokens y conversación solo en memoria de la pestaña. Todo texto del servidor se pinta con textContent.
// Modo de vista previa sin servidor: ?mock=1 carga mock-api.js (datos ficticios).
const MAX = 2000, WARN_AT = 1800, LANGS = {es: "Español", ca: "Català", en: "English", fr: "Français", ru: "Русский"};
const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
// Web-2: solo con GHOFI_WEB.mock === true en config.js (por defecto false); un ?mock=1 suelto no activa nada.
const MOCK = !!(window.GHOFI_WEB && window.GHOFI_WEB.mock === true) && Q.get("mock") === "1";
const mockReady = MOCK ? new Promise((ok) => { const s = document.createElement("script"); s.src = "mock-api.js"; s.onload = s.onerror = ok; document.head.append(s); }) : Promise.resolve();
// <cfg> Config (config.js): origin del API y tenant fuera del API; sin config.js todo queda como antes (mismo origin, sin X-Tenant-Id).
const GW = (window.GHOFI_WEB && typeof window.GHOFI_WEB === "object") ? window.GHOFI_WEB : {};
const apiOrigin = (v, local) => {
  if (typeof v !== "string" || !v) return "";
  try { const u = new URL(v); return (u.protocol === "https:" || (u.protocol === "http:" && local && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) && u.href === u.origin + "/" ? u.origin : null; } catch (e) { return null; }
};
const apiBase = () => {
  if (MOCK) return "";
  let base = apiOrigin(GW.apiBase, /^(localhost|127\.0\.0\.1)$/.test(location.hostname));
  if (base === null) { console.warn("GHOFI_WEB.apiBase no válido"); base = ""; }
  const q = new URLSearchParams(location.search).get("api"), o = q ? apiOrigin(q, false) : "";
  if (o && Array.isArray(GW.allowApi) && GW.allowApi.some((a) => apiOrigin(a, false) === o)) base = o;
  return base;
};
const tenantCfg = () => (/^\d{1,9}$/.test(String(GW.tenantId == null ? "" : GW.tenantId)) ? String(GW.tenantId) : "");
const BASE = apiBase(), TEN = tenantCfg();
// Web-2: sin chat de invitado (por defecto): el chat exige acceso por SMS; /v1/public/chat no se llama. Política de privacidad: solo https (si no, el enlace se oculta).
const GUEST = GW.guestChat === true;
// Web-2: la solicitud (/v1/public/applications) recoge nombre, teléfono y correo sin acceso previo → oculta por defecto (applications:false). La cobertura (código postal, calle, número) se mantiene.
const APPLY = GW.applications === true;
const PRIVACY = (() => { try { const u = new URL(GW.privacyUrl); return u.protocol === "https:" ? u.href : ""; } catch (e) { return ""; } })();
const privacyLink = () => sysText(el("a", {className: "link privacy", target: "_blank", rel: "noopener noreferrer", href: PRIVACY || "#", hidden: !PRIVACY}), () => t("v5_privacy"));
const F = async (path, opt = {}) => {
  await mockReady;
  const h = {...(opt.headers || {})};
  if (TEN && !Object.keys(h).some((k) => k.toLowerCase() === "x-tenant-id")) h["X-Tenant-Id"] = TEN;
  return fetch(typeof path === "string" && path[0] === "/" ? BASE + path : path, {...opt, headers: h, credentials: "omit", referrerPolicy: "no-referrer"});
}; // </cfg>

let lang = "";
try { lang = localStorage.getItem("ghofi.chat.lang") || ""; } catch (e) { /* sin almacenamiento */ }
if (!LANGS[lang]) lang = LANGS[(navigator.language || "es").slice(0, 2)] ? (navigator.language || "es").slice(0, 2) : "es";
const t = (k, v = {}) => (((window.CHAT_I18N[lang] || {})[k]) || window.CHAT_I18N.es[k] || k).replace(/\{(\w+)\}/g, (_, n) => (n in v ? v[n] : ""));
function el(tag, props = {}, ...kids) { const n = document.createElement(tag); Object.assign(n, props); for (const k of kids) n.append(k); return n; }
// Estado vacío / error / sin conexión (.state). title y text: texto o función (se vuelve a pintar al cambiar de idioma). Misma función en admin.js.
function stateBlock({tone = "", icon, title, text, action}) {
  const val = (x) => (typeof x === "function" ? x() : x);
  const b = el("b"), p = el("p"), box = el("div", {className: "state", role: tone === "er" ? "alert" : "status"}, el("span", {className: "ib" + (tone ? " " + tone : "")}, ic(icon, "ic20")), b);
  const paint = () => { b.textContent = val(title); p.textContent = val(text) || ""; p.hidden = !val(text); };
  box.append(p);
  if (action) { const l = el("span"); box.append(el("button", {type: "button", className: "btn bg", onclick: action.onClick}, ic("retry", "ic16"), l)); box.paintAction = () => { l.textContent = val(action.label); }; }
  box.paint = () => { paint(); if (box.paintAction) box.paintAction(); }; box.paint();
  return box;
}

// ---- iconos (SVG creados con createElementNS; solo DOM) ----
const ICONS = {
  human: [["path", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"]],
  send: [["path", "M4 12l16-8-6 16-2-7-8-1z"]],
  lock: [["rect", {x: 5, y: 11, width: 14, height: 9, rx: 2}], ["path", "M8 11V8a4 4 0 0 1 8 0v3"]],
  check: [["path", "M5 12l5 5 9-10"]],
  shield: [["path", "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"], ["path", "M9 12l2 2 4-4"]],
  bot: [["rect", {x: 5, y: 8, width: 14, height: 11, rx: 3}], ["path", "M12 4v4M9 13h.01M15 13h.01"]],
  alert: [["path", "M12 4l9 16H3z"], ["path", "M12 10v4M12 17h.01"]],
  wifioff: [["path", "M3 3l18 18M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-8-4M6 13a9 9 0 0 1 3-2M18 13a9 9 0 0 0-3-2M12 18h.01"]],
  retry: [["path", "M4 12a8 8 0 1 1 3 6.2M4 19v-5h5"]],
};
function ic(name, cls = "") {
  const NS = "http://www.w3.org/2000/svg", s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", ("ic " + cls).trim()); s.setAttribute("aria-hidden", "true");
  for (const [tag, a] of ICONS[name]) {
    const n = document.createElementNS(NS, tag);
    if (typeof a === "string") n.setAttribute("d", a); else for (const [k, v] of Object.entries(a)) n.setAttribute(k, String(v));
    s.append(n);
  }
  return s;
}

// ---- estado (solo memoria) ----
let conv = null, token = null, seen = 0, timer = null, config = null;
let session = null;           // {token, refreshToken} del cliente identificado
let busy = false, lastOk = null, off = !navigator.onLine, retryFn = null, flowBox = null, flowKeep = false, flowTimers = [], greetNodes = [];

const log = $("log");
const hhmm = (d) => new Intl.DateTimeFormat(lang, {hour: "2-digit", minute: "2-digit"}).format(d);
const whenFmt = (iso) => new Intl.DateTimeFormat(lang, {weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid"}).format(new Date(iso)) + " (Madrid)";
// Horario "L–V 9:00–20:00": días y horas de /v1/public/config (handover.{days,from,to}); sin datos, el horario por defecto (assistant/docs/web.md)
const DAYS = {es: ["L", "M", "X", "J", "V", "S", "D"], ca: ["dl", "dm", "dc", "dj", "dv", "ds", "dg"], en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], fr: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"], ru: ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]};
const DEFAULT_HOURS = {days: [1, 2, 3, 4, 5], from: "09:00", to: "20:00"};
function formatHours(h, lg = lang) {
  const x = h && h.days && h.from && h.to ? h : DEFAULT_HOURS, names = DAYS[lg] || DAYS.es, d = x.days;
  const contiguous = d.length > 1 && d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  const hm = (v) => String(v).replace(/^0(\d:)/, "$1");
  return `${contiguous ? names[d[0] - 1] + "–" + names[d[d.length - 1] - 1] : d.map((n) => names[n - 1]).join(", ")} ${hm(x.from)}–${hm(x.to)}`;
}
const hoursText = () => formatHours(config && config.handover);
const nextWhen = (iso) => (iso ? whenFmt(iso) : hoursText());
function scrollEnd() { log.scrollTop = log.scrollHeight; }
// Mensajes del sistema (aviso de IA, tarjetas, preguntas del flujo): se guardan como función que pinta el nodo, no como texto, para retraducirlos al cambiar de idioma.
const sysItems = [];
function bind(node, apply) { apply(); sysItems.push({node, apply}); return node; }
const sysText = (node, fn) => bind(node, () => { node.textContent = fn(); });
function setRich(node, s) { node.replaceChildren(...s.split("**").map((p, i) => (i % 2 ? el("b", {textContent: p}) : p))); } // **negrita** del diseño, solo con nodos DOM
const sysRich = (node, fn) => bind(node, () => setRich(node, fn()));
function retranslate() { for (let i = sysItems.length - 1; i >= 0; i--) { const x = sysItems[i]; if (!x.node.isConnected) sysItems.splice(i, 1); else x.apply(); } paintBanner(); paintHrs(); paintSession(); }
function clearGreet() { for (const n of greetNodes) n.remove(); greetNodes = []; }
function add(role, text, fn) {
  const d = el("div", {className: "b " + (role === "user" ? "u" : "a")});
  if (fn) sysText(d, fn); else d.textContent = text;
  log.append(d); scrollEnd();
  if (role === "user") clearGreet();
  return d;
}
const sysAdd = (fn) => add("assistant", "", fn);
const userSays = (key) => add("user", "", () => t(key));
function note(fn, cls = "") { const c = el("div", {className: "card " + cls}); c.append(sysText(el("span"), fn)); log.append(c); scrollEnd(); return c; }
const hud = (key) => sysText(el("div", {className: "hud"}), () => t(key));
const sysRow = (key) => { const r = el("div", {className: "sys"}, el("span", {className: "ver"}, ic("check", "ic13"), sysText(el("span"), () => t(key)))); log.append(r); scrollEnd(); return r; };

// ---- red con refresh del cliente ----
async function call(path, {method = "GET", body, auth = false, headers = {}} = {}) {
  if (!navigator.onLine) { setOffline(true); throw new TypeError("offline"); }
  const go = () => F(path, {method, headers: {"Content-Type": "application/json", "Accept-Language": lang, ...(auth && session ? {"Authorization": "Bearer " + session.token} : {}), ...headers}, body: body ? JSON.stringify(body) : undefined});
  let r;
  const used = session && session.token;
  try { r = await go(); } catch (e) { if (e instanceof TypeError) setOffline(true); throw e; }
  setOffline(false); // hubo respuesta del servidor (cualquier código HTTP): hay red
  if (r.status === 401 && auth && session && session.refreshToken) {
    try { if (session && session.token === used) await refreshClient(); } catch (e) { if (e instanceof TypeError) setOffline(true); throw e; }
    if (session) r = await go(); // un 401 significa que el manejador no se ejecutó: repetir es seguro
  }
  let j = null; try { j = await r.json(); } catch (e) { /* sin cuerpo */ }
  if (!r.ok) {
    const eb = (j && j.error) || {}, e = new Error(eb.message || t("error_generic")); e.status = r.status; e.body = j; e.code = eb.code || (j && j.code) || "";
    // esperas indicadas por el servidor: cabecera Retry-After / error.retryAfter (segundos) y retryAfterMinutes (429 locked); nunca inventadas
    e.retryAfter = Number(r.headers.get("Retry-After")) || Number(eb.retryAfter) || null;
    e.retryAfterMinutes = Number(eb.retryAfterMinutes !== undefined ? eb.retryAfterMinutes : j && j.retryAfterMinutes) || null;
    throw e;
  }
  lastOk = new Date();
  return j;
}
// El refresh token es de un solo uso: una sola petición en vuelo (sondeo y envío a la vez); un segundo uso revocaría la sesión.
// Solo un 401/403 del servidor cierra la sesión; un fallo de red (TypeError) se propaga y la sesión se conserva.
let refreshing = null;
function refreshClient() {
  return refreshing || (refreshing = (async () => {
    const rr = await F("/v1/auth/refresh", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({refreshToken: session.refreshToken})});
    if (rr.ok) { const j = await rr.json(); session = {token: j.token, refreshToken: j.refreshToken}; return; }
    if (rr.status === 401 || rr.status === 403) { session = null; paintSession(); sysAdd(() => t("v5_sessExp")); if (!GUEST) log.append(loginButton()); }
    const e = new Error(t("v5_sessExp")); e.status = rr.status; e.sessExp = true; throw e;
  })().finally(() => { refreshing = null; }));
}
let bannerFn = null, bannerKind = "off";
function paintBanner() {
  if (!bannerFn) return;
  $("bannerT").textContent = t(bannerKind === "off" ? "v5_offT" : "v5_errT"); $("bannertxt").textContent = bannerFn();
  $("bannericon").replaceChildren(ic(bannerKind === "off" ? "wifioff" : "alert", "ic16"));
}
function setBanner(on, fn, kind = "off") { $("banner").hidden = !on; bannerFn = on ? fn : null; bannerKind = kind; if (on) paintBanner(); }
const offlineMsg = () => (lastOk ? t("v5_offD", {time: hhmm(lastOk)}) : t("v5_offD0"));
// Sin conexión: evento offline, navigator.onLine o TypeError de fetch (los 4xx/5xx NO cuentan). Se desactiva solo al llegar una respuesta del servidor.
function setOffline(v) {
  if (off === v) return;
  off = v; syncOnline();
  if (v) setBanner(true, offlineMsg, "off"); else if (bannerKind === "off") setBanner(false);
}
function fail(x, again) {
  if (x && x.sessExp) return; // la línea del sistema "Sesión caducada" ya está en el chat
  if (x instanceof TypeError || !navigator.onLine) {
    off = true; syncOnline(); setBanner(true, offlineMsg, "off");
    retryFn = async () => { try { await call("/v1/public/config"); } catch (e) { if (e instanceof TypeError) return fail(e, again); } if (again) await again(); };
  } else { retryFn = again || null; setBanner(true, () => x.message || t("error_generic"), "err"); }
  $("retry").hidden = !retryFn;
}
function syncOnline() {
  $("f").classList.toggle("offc", off); $("m").disabled = off; $("m").placeholder = off ? t("v5_offPh") : t("v5_ph"); updateComposer();
}
window.addEventListener("online", () => { off = false; syncOnline(); if (retryFn) $("retry").click(); else setBanner(false); });
window.addEventListener("offline", () => { setOffline(true); if (!retryFn) { retryFn = async () => { await call("/v1/public/config").catch((e) => { if (e instanceof TypeError) fail(e); }); }; $("retry").hidden = false; } });
$("retry").addEventListener("click", async () => { const f = retryFn; setBanner(false); retryFn = null; if (f) await f(); });

// ---- mensajes ----
async function ask(message, {silent = false} = {}) {
  if (busy || loggingOut || (!session && !GUEST)) return; busy = true; $("send").disabled = true;
  if (!silent) add("user", message);
  try {
    const j = session
      ? await call("/v1/me/chat", {method: "POST", auth: true, body: {message, conversationId: conv}})
      : await call("/v1/public/chat", {method: "POST", body: {message, conversationId: conv, conversationToken: token}});
    conv = j.conversationId; token = j.conversationToken || token;
    setBanner(false); retryFn = null;
    add("assistant", j.text);
    if (!timer && !loggingOut) timer = setInterval(poll, 5000);
    return j;
  } catch (x) { fail(x, () => ask(message, {silent: true})); }
  finally { busy = false; updateComposer(); }
}
async function poll() {
  if (loggingOut || !conv || (!token && !session)) return;
  try {
    if (session) {
      const j = await call("/v1/me/chat/" + encodeURIComponent(conv), {auth: true});
      const msgs = j.messages || [];
      for (const m of msgs.slice(seen)) if (m.by === "staff") add("assistant", m.text);
      seen = msgs.length;
    } else {
      const j = await call("/v1/public/chat/" + encodeURIComponent(conv) + "/messages?after=" + (seen || 0), {headers: {"X-Conversation-Token": token}});
      for (const m of j.messages) { if (m.by === "staff") add("assistant", m.text); seen = m.index + 1; }
    }
  } catch (x) { /* sin red: se reintenta en el siguiente sondeo */ }
}
function updateComposer() {
  const v = $("m").value, n = v.length, nf = new Intl.NumberFormat(lang);
  $("counter").textContent = `${nf.format(n)} / ${nf.format(MAX)}`; $("counter").className = "cnt" + (n > MAX ? " over" : n >= WARN_AT ? " w" : "");
  $("limhint").textContent = n > MAX ? t("too_long", {max: MAX}) : t("v5_lim");
  $("f").classList.toggle("tall", n >= WARN_AT || v.includes("\n")); // modo alto con contador: >=2 líneas o >=1800 caracteres (decisión del ejecutor)
  $("send").disabled = busy || off || !v.trim() || n > MAX;
}
$("m").addEventListener("input", updateComposer);
$("m").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("f").requestSubmit(); } });
$("f").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("m").value.trim();
  if (!v || v.length > MAX || $("m").value.length > MAX) return; // el límite se aplica también aquí: no se envía nada
  $("m").value = ""; updateComposer(); ask(v);
});

// ---- horario y persona ----
function paintHrs() {
  const h = config && config.handover, box = $("hrs");
  if (!h) { box.textContent = ""; return; }
  const closed = h.availableNow === false;
  box.className = "hrs" + (closed ? " w" : "");
  box.textContent = closed ? t("v5_hrsC", {when: nextWhen(h.nextAvailableAt), hours: hoursText()}) : t("v5_hrs", {hours: hoursText()});
}
// Cliente identificado: POST /v1/me/handovers; la tarjeta de confirmación solo aparece tras un 2xx. Invitado: sin llamada, texto honesto + teléfono + solicitud.
let handoverKey = null;
// Idempotency-Key: el servidor exige ^[A-Za-z0-9_-]{8,64}$ (si no, 422). Sin crypto no hay clave: se omite la cabecera (el servidor deduplica igual).
const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
function newKey() {
  let k = null;
  if (typeof crypto !== "undefined" && crypto) {
    if (typeof crypto.randomUUID === "function") k = crypto.randomUUID();
    else if (typeof crypto.getRandomValues === "function") k = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return k && KEY_RE.test(k) ? k : null;
}
const keyHdr = (k) => (k && KEY_RE.test(k) ? {"Idempotency-Key": k} : {});
// Teléfono: misma regla que assistant/app/security.py::normalize_phone (solo +34[6-9] y 8 cifras; el servidor no añade +34 por su cuenta). Devuelve E.164 o null.
function normalizePhone(raw) {
  let s = String(raw || "").replace(/[\s\-().]/g, "");
  if (s.startsWith("0034")) s = "+" + s.slice(2);
  else if (/^34\d{9}$/.test(s)) s = "+" + s;
  else if (/^[6-9]\d{8}$/.test(s)) s = "+34" + s;
  return /^\+34[6-9]\d{8}$/.test(s) ? s : null;
}
const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;
function callBtn(cfg, card) {
  if (cfg && cfg.supportPhone) card.append(document.createElement("br"), sysText(el("a", {className: "btn bg mt", href: "tel:" + cfg.supportPhone.replace(/\s/g, "")}), () => `${t("call")} ${cfg.supportPhone}`));
}
async function talkToPerson() {
  if (busy) return;
  const cfg = await ensureConfig();
  if (!cfg) return fail(new TypeError("offline"), talkToPerson);
  const h = cfg.handover || {};
  if (!session) {
    const card = note(() => t("human_guest", {hours: hoursText(), phone: cfg.supportPhone || ""}));
    callBtn(cfg, card);
    if (APPLY) card.append(" ", sysText(el("button", {type: "button", className: "btn bg", onclick: startOnboarding}), () => t("leave_request")));
    return scrollEnd();
  }
  busy = true; $("send").disabled = true; $("human").disabled = true;
  handoverKey = handoverKey || newKey();
  try {
    const r = await call("/v1/me/handovers", {method: "POST", auth: true, headers: keyHdr(handoverKey), body: {...(conv ? {conversationId: conv} : {})}});
    handoverKey = null; setBanner(false); retryFn = null;
    const out = r && r.outsideHours !== undefined ? r.outsideHours : (h.availableNow === false);
    const when = (r && r.expectedReplyAt) || h.nextAvailableAt;
    const phone = (r && r.supportPhone) || cfg.supportPhone || "";
    sysRow("v5_hs");
    if (out) {
      sysAdd(() => t("v5_closedA"));
      const card = el("div", {className: "card"}, sysText(el("div", {className: "ttl"}), () => t("v5_closedT")), sysText(el("div"), () => t("v5_closedD", {hours: hoursText()})),
        el("div", {className: "chk"}, sysText(el("span", {className: "pill p-w"}), () => t("v5_closedP", {when: nextWhen(when)}))));
      log.append(card); callBtn({supportPhone: phone}, card);
    } else {
      const card = el("div", {className: "card"}, sysText(el("div"), () => t("v5_hw", {hours: hoursText()})), sysText(el("div", {className: "hint"}), () => t("v5_hwait")));
      log.append(card); callBtn({supportPhone: phone}, card);
    }
    if (!timer && conv && !loggingOut) timer = setInterval(poll, 5000);
    scrollEnd();
  } catch (x) {
    if (x.status === 429) { handoverKey = null; retryFn = null; $("retry").hidden = true; note(() => t("handover_limit", {phone: cfg.supportPhone || ""}), "err"); }
    else fail(x, talkToPerson);
  } finally { busy = false; $("human").disabled = false; updateComposer(); }
}
$("human").addEventListener("click", talkToPerson);

// ---- flujos en el chat: una tarjeta activa ----
function closeFlow() { for (const i of flowTimers) clearInterval(i); flowTimers = []; flowKeep = false; if (flowBox) { flowBox.remove(); flowBox = null; } }
function openFlow(...kids) { closeFlow(); flowBox = el("div", {className: "card flow"}, ...kids); log.append(flowBox); scrollEnd(); return flowBox; }
const everySec = (fn) => { const i = setInterval(fn, 1000); flowTimers.push(i); return i; };
// campo del diseño: etiqueta HUD + input .fm
function fm(labelKey, props) { const i = el("input", {className: "fm", ...props}); return [el("label", {className: "fld"}, hud(labelKey), i), i]; }
const cancelBtn = () => sysText(el("button", {type: "button", className: "btn bg block", onclick: closeFlow}), () => t("cancel"));
const ttl = (icon, key) => el("div", {className: "ttl"}, ic(icon, "ic16"), sysText(el("span"), () => t(key)));
const hintRow = (icon, fn, cls = "") => el("div", {className: "hint " + cls}, ic(icon, "ic12"), sysText(el("span"), fn));
function errLine() { const e = el("p", {className: "errl", role: "alert", hidden: true}, ic("alert", "ic14"), el("span")); e.fn = null; bind(e, () => { if (e.fn) e.lastChild.textContent = e.fn(); }); return e; }
// msg: texto o función que devuelve el texto (se vuelve a pintar al cambiar de idioma)
function setErr(e, msg) { e.fn = typeof msg === "function" ? msg : null; e.lastChild.textContent = e.fn ? e.fn() : msg || ""; e.hidden = !msg; return e.lastChild; }
// Error junto al campo: texto en su errLine + aria-invalid/aria-describedby; se quita al editar el campo.
let errSeq = 0;
function fieldErr(input, e, msg) {
  e.id = e.id || "fe" + ++errSeq;
  input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", e.id); setErr(e, msg);
  const clear = () => { input.removeAttribute("aria-invalid"); input.removeAttribute("aria-describedby"); setErr(e, ""); };
  input.addEventListener(input.type === "checkbox" ? "change" : "input", clear, {once: true});
}
async function guarded(btn, err, fn) {
  btn.disabled = true; setErr(err, "");
  try { await fn(); } catch (x) {
    if (x instanceof TypeError || !navigator.onLine) { setErr(err, offlineMsg).append(" ", el("button", {type: "button", className: "link", textContent: t("retry"), onclick: () => guarded(btn, err, fn)})); }
    else setErr(err, x.message);
  } finally { if (btn.refresh) btn.refresh(); else btn.disabled = false; }
}
const maskPhone = (p) => { const d = p.replace(/[^\d+]/g, ""); return `${d.startsWith("+") ? d.slice(0, 3) : "+34"} ${"•"}•• ••• ${d.slice(-3)}`; };
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// No cliente: dirección (código postal + calle + número) → cobertura → solicitud
function startOnboarding() {
  userSays("not_client"); sysAdd(() => t("v5_onbA"));
  addressStep();
}
function addressStep() {
  const [l1, pc] = fm("ob_postcode", {inputMode: "numeric", maxLength: 5, placeholder: t("ob_postcode_ph"), autocomplete: "postal-code"});
  const [l2, st] = fm("ob_street", {autocomplete: "address-line1", maxLength: 200});
  const [l3, no] = fm("ob_number", {maxLength: 20});
  const e1 = errLine(), e2 = errLine(), err = errLine(), go = sysText(el("button", {type: "button", className: "btn bp block"}), () => t("ob_check"));
  openFlow(hud("v5_addrK"), l1, e1, l2, e2, l3, err, go, cancelBtn());
  go.addEventListener("click", () => {
    setErr(err, "");
    const bad = [];
    if (!/^\d{5}$/.test(pc.value.trim())) { fieldErr(pc, e1, () => t("ob_postcode_bad")); bad.push(pc); }
    if (st.value.trim().length < 2) { fieldErr(st, e2, () => t("ob_street_bad")); bad.push(st); }
    if (bad.length) { bad[0].focus(); return; }
    guarded(go, err, async () => {
      const postcode = pc.value.trim(), street = st.value.trim(), number = no.value.trim();
      const j = await call("/v1/public/coverage", {method: "POST", body: {postcode, street, ...(number ? {number} : {})}});
     
      coverageResult(postcode, street, number, j);
    });
  });
  pc.focus();
}
function coverageResult(postcode, street, number, j) {
  const none = !(j.coverage === "fiber" || j.coverage === "radio"), parts = [];
  if (none) {
    parts.push(el("div", {className: "res w"}, ic("alert", "ic16"), sysText(el("b"), () => t("v5_nocP"))), sysText(el("div", {className: "hint"}), () => t("v5_nocD")));
  } else {
    parts.push(el("div", {className: "chk"}, j.coverage === "fiber" ? el("span", {className: "pill p-ok"}, ic("check", "ic12"), sysText(el("span"), () => t("v5_fib"))) : el("span", {className: "pill p-n"}, ic("check", "ic12"), sysText(el("span"), () => t("v5_rad")))));
    if (j.coverage === "fiber") parts.push(sysText(el("div", {className: "hint"}), () => t("v5_covD")));
  }
  if (j.message) parts.push(el("div", {className: "hint", textContent: j.message}));
  parts.push(sysText(el("div", {className: "hint"}), () => `${j.municipality ? j.municipality + " · " : ""}${t("ob_cov_note")}`));
  const apply = sysText(el("button", {type: "button", className: "btn bp block mt"}), () => t(none ? "v5_nocB" : "v5_req"));
  const other = sysText(el("button", {type: "button", className: "btn bg block mt", onclick: addressStep}), () => t("v5_other"));
  openFlow(...parts, ...(j.canApply === false || !APPLY ? [] : [apply]), other);
  apply.addEventListener("click", () => {
    userSays("v5_req");
    sysAdd(() => t("v5_covOk", {addr: [street, number].filter(Boolean).join(" ") + (j.municipality ? ", " + j.municipality : "")}));
    applicationForm(postcode, street, number, j);
  });
}
function applicationForm(postcode, street, number, cov) {
  const bubble = add("assistant", ""); bind(bubble, () => setRich(bubble, t("v5_onb2A")));
  const [l1, nm] = fm("v5_nameK", {autocomplete: "name", maxLength: 120});
  const [l2, ph] = fm("v5_telK", {type: "tel", autocomplete: "tel", placeholder: "+34 600 000 000", maxLength: 20});
  const [l3, em] = fm("ob_email", {type: "email", autocomplete: "email", maxLength: 200});
  const sel = el("select", {className: "fm"}, ...[["fiber", "ob_i_fiber"], ["mobile", "ob_i_mobile"], ["both", "ob_i_both"]].map(([v, k]) => el("option", {value: v, textContent: t(k)})));
  const cb = el("input", {type: "checkbox"});
  const cs = el("span"), consent = el("label", {className: "cons"}, cb, cs);
  bind(cs, () => { cs.textContent = t("v5_cons"); }); // TODO: enlace a la política de privacidad cuando se conozca su URL (assistant/docs/web.md)
  const eN = errLine(), eP = errLine(), eE = errLine(), eC = errLine(), err = errLine(), go = sysText(el("button", {type: "button", className: "btn bp block"}), () => t("v5_sendReq"));
  openFlow(hud("v5_reqK"), el("div", {className: "frow"}, l1, l2), eN, eP, l3, eE, el("label", {className: "fld"}, hud("ob_interest"), sel), consent, eC, err, go);
  let sent = null; // {sig, key}: mismo cuerpo → misma clave (reintento idempotente); cuerpo cambiado → clave nueva (si no, 409 idempotency_conflict)
  go.addEventListener("click", () => {
    setErr(err, "");
    const name = nm.value.trim(), phone = normalizePhone(ph.value), mail = em.value.trim(), bad = [];
    if (name.length < 2 || nm.value.length > 120) { fieldErr(nm, eN, () => t("ob_name_bad")); bad.push(nm); }
    if (!phone) { fieldErr(ph, eP, () => t("ob_phone_bad")); bad.push(ph); }
    if (mail && (mail.length > 200 || !EMAIL_RE.test(mail))) { fieldErr(em, eE, () => t("ob_email_bad")); bad.push(em); }
    if (!cb.checked) { fieldErr(cb, eC, () => t("ob_consent_req")); bad.push(cb); }
    if (bad.length) { bad[0].focus(); return; }
    guarded(go, err, async () => {
      const body = {fullName: name, phone, ...(mail ? {email: mail} : {}), postcode, street, ...(number ? {number} : {}), interest: sel.value, language: lang, consentContact: true};
      const sig = JSON.stringify(body);
      if (!sent || sent.sig !== sig) sent = {sig, key: newKey()};
      let j;
      try { j = await call("/v1/public/applications", {method: "POST", headers: keyHdr(sent.key), body}); } catch (x) {
        if (x.status === 422 && x.code === "invalid_phone") { fieldErr(ph, eP, () => t("ob_phone_bad")); ph.focus(); return; }
        if (x.status === 422 && x.code === "consent_required") { fieldErr(cb, eC, () => t("ob_consent_req")); cb.focus(); return; }
        throw x;
      }
      sent = null;
      closeFlow(); sysRow("v5_sentL");
      const city = cov && cov.municipality ? cov.municipality : "";
      const trk = el("div", {className: "trk"});
      bind(trk, () => trk.replaceChildren(...t("v5_steps").split(" | ").map((s, i) => el("div", {className: i === 0 ? "on" : ""}, el("i"), el("small", {textContent: s})))));
      const card = el("div", {className: "card"}, el("div", {className: "row spread"}, sysText(el("div", {className: "hud"}), () => t("v5_tkK", {ref: "#" + j.reference})), sysText(el("span", {className: "pill p-w"}), () => t("v5_pend"))),
        sysText(el("div", {className: "ttl mt"}), () => t("v5_tkT", {city}).replace(/\s*·\s*$/, "")), trk);
      log.append(card);
      if (j.outsideHours && j.expectedContactAt) { const b = add("assistant", ""); bind(b, () => setRich(b, t("v5_onb3A", {when: whenFmt(j.expectedContactAt), hours: hoursText()}))); }
      if (j.message) add("assistant", j.message);
      scrollEnd();
    });
  });
  nm.focus();
}

// Cliente: SMS en el chat. Errores: 400 invalid_code / code_expired, 429 locked (+ retryAfterMinutes), 429 rate_limited (+ Retry-After); el servidor no devuelve los intentos restantes (se cuentan aquí, assistant/docs/web.md)
// Errores: invalid_code y code_expired cuentan como intento; el 5.º ya devuelve 429 locked; pedir código nuevo no reinicia el contador
const lockSecs = (x) => (x.retryAfterMinutes ? Math.ceil(x.retryAfterMinutes * 60) : x.retryAfter || 900);
const requestCode = async (phone) => (await call("/v1/auth/otp/request", {method: "POST", body: {phone}})).resendAfter || 60;
function startLogin() {
  userSays("i_am_client"); sysAdd(() => t("v5_otp1"));
  const [l1, ph] = fm("v5_tel", {type: "tel", autocomplete: "tel", placeholder: t("li_phone_ph"), maxLength: 20});
  const err = errLine(), go = sysText(el("button", {type: "button", className: "btn bp block"}), () => t("v5_sendc"));
  let rate = 0;
  go.refresh = () => { go.disabled = rate > 0; ph.disabled = rate > 0; };
  openFlow(ttl("shield", "v5_otpT"), l1, err, go, hintRow("lock", () => t("v5_otpNo")), privacyLink(), cancelBtn());
  go.addEventListener("click", () => {
    setErr(err, "");
    const phone = normalizePhone(ph.value);
    if (!phone) { fieldErr(ph, err, () => t("ob_phone_bad")); ph.focus(); return; }
    guarded(go, err, async () => {
      try { const secs = await requestCode(phone); codeStep(phone, secs, {sent: true}); } catch (x) {
        if (x.status === 422 && x.code === "invalid_phone") { fieldErr(ph, err, () => t("ob_phone_bad")); return; }
        if (x.status === 429 && x.code === "locked") return codeStep(phone, 0, {sent: false}).lock(x);
        if (x.status === 429 && x.code === "rate_limited") {
          rate = x.retryAfter || 0; setErr(err, () => (rate > 0 ? t("v5_rate", {t: mmss(rate)}) : t("v5_rate0")));
          if (rate > 0) { const iv = everySec(() => { rate--; if (rate <= 0) { clearInterval(iv); rate = 0; setErr(err, ""); } go.refresh(); }); }
          return;
        }
        throw x;
      }
    });
  });
  ph.focus();
}
function codeStep(phone, wait, {sent = true} = {}) {
  const code = el("input", {className: "fm otpin", inputMode: "numeric", maxLength: 6, autocomplete: "one-time-code", placeholder: t("li_code_ph")});
  code.setAttribute("aria-label", t("v5_otpE"));
  const err = errLine(), go = sysText(el("button", {type: "button", className: "btn bp block dis", disabled: true}), () => t("v5_ver"));
  const again = el("button", {type: "button", className: "link"});
  let state = "ready", left = 5, resendLeft = wait, rate = 0, lockLeft = 0;   // ready | expired | locked
  const sync = () => {
    const blocked = rate > 0 || state === "locked";
    code.disabled = state !== "ready" || blocked;
    go.disabled = code.disabled || !/^\d{6}$/.test(code.value.trim()); go.classList.toggle("dis", go.disabled);
    again.disabled = resendLeft > 0 || blocked;
    again.textContent = resendLeft > 0 ? t("v5_resend", {t: mmss(resendLeft)}) : t(state === "ready" ? "li_resend" : "v5_newCode");
  };
  go.refresh = sync; again.refresh = sync; bind(again, sync);
  const mockHintEl = sysText(el("div", {className: "hint", hidden: true}), () => t("v5_mockHint"));
  const mockHint = () => { mockHintEl.hidden = !MOCK; };
  const hintSent = sysText(el("div", {className: "hint", hidden: !sent}), () => t("v5_otp2", {phone: maskPhone(phone)}));
  const form = el("div", {}, hintSent, sysText(el("div"), () => t("v5_otpE")), code, err, mockHintEl, go, el("div", {className: "hint c"}, again));
  const lockBox = el("div", {hidden: true});
  openFlow(form, lockBox); flowKeep = true;
  everySec(() => {
    if (resendLeft > 0) resendLeft--;
    if (rate > 0 && --rate === 0) setErr(err, "");
    sync();
  });
  sync();
  const expire = () => { state = "expired"; resendLeft = 0; code.value = ""; sync(); };
  // bloqueo: tarjeta en lugar del formulario (el formulario queda oculto y desactivado); al llegar a 0 vuelve con "Pedir un código nuevo"
  function lock(x) {
    state = "locked"; setErr(err, ""); sync(); form.hidden = true;
    const mins = Math.ceil(x.retryAfterMinutes || 15), timerNode = el("div", {className: "lockn"}), live = el("span", {className: "sr"});
    timerNode.setAttribute("aria-hidden", "true"); live.setAttribute("aria-live", "polite");
    lockLeft = lockSecs(x);
    const paintT = () => { timerNode.textContent = t("v5_lockIn", {t: mmss(lockLeft)}); };
    const paintLive = () => { live.textContent = t("v5_lockIn", {t: mmss(Math.ceil(lockLeft / 60) * 60)}); };
    bind(timerNode, paintT);
    lockBox.replaceChildren(el("div", {className: "row"}, el("span", {className: "ib er"}, ic("lock", "ic16")), sysText(el("b"), () => t("v5_lockT", {m: mins}))), sysText(el("div", {className: "hint"}), () => t("v5_lockD")),
      timerNode, live, sysText(el("button", {type: "button", className: "btn bg block mt", onclick: talkToPerson}), () => t("human")));
    lockBox.hidden = false; paintLive(); scrollEnd();
    const iv = everySec(() => {
      lockLeft--; paintT();
      if (lockLeft % 60 === 0 || lockLeft < 0) paintLive();   // el lector de pantalla solo oye el cambio de minuto
      if (lockLeft <= 0) { clearInterval(iv); lockBox.replaceChildren(); lockBox.hidden = true; form.hidden = false; left = 5; resendLeft = 0; hintSent.hidden = true; expire(); }
    });
  }
  code.addEventListener("input", sync);
  const reject = (x) => {
    if (x.status === 429 && x.code === "locked") { lock(x); return true; }
    if (x.status === 429 && x.code === "rate_limited") { rate = x.retryAfter || 0; setErr(err, () => (rate > 0 ? t("v5_rate", {t: mmss(rate)}) : t("v5_rate0"))); sync(); return true; }
    return false;
  };
  again.addEventListener("click", () => guarded(again, err, async () => {
    try { resendLeft = await requestCode(phone); state = "ready"; code.value = ""; hintSent.hidden = false; setErr(err, ""); sync(); if (!code.disabled) code.focus(); } catch (x) { if (!reject(x)) throw x; }
  }));
  go.addEventListener("click", () => guarded(go, err, async () => {
    try {
      const j = await call("/v1/auth/otp/verify", {method: "POST", body: {phone, code: code.value.trim()}});
      session = {token: j.token, refreshToken: j.refreshToken}; conv = null; token = null; seen = 0;
      closeFlow(); clearGreet(); sysRow("v5_verd"); paintSession();
    } catch (x) {
      if (reject(x)) return;
      if (x.status === 400 && x.code === "invalid_code") { left = Math.max(0, left - 1); setErr(err, () => t(left >= 2 ? "v5_wrong" : left === 1 ? "v5_wrong1" : "v5_wrong0", {n: left})); mockHint(); return; }
      if (x.status === 400 && x.code === "code_expired") { left = Math.max(0, left - 1); setErr(err, () => t("v5_expired")); expire(); return; }   // el servidor lo cuenta como intento fallido
      throw x;
    }
  }));
  if (state === "ready" && !code.disabled) code.focus();
  return {lock};
}
// Salir (Web-2): POST /v1/auth/logout (con el access caducado, `call` hace un refresh y repite una vez). Cualquier error se ignora: la sesión en memoria se borra siempre.
let loggingOut = false;
async function logout() {
  if (loggingOut) return; // doble clic en «Salir»
  loggingOut = true; $("logout").disabled = true;
  clearInterval(timer); timer = null; // el sondeo se detiene ANTES de revocar el token: ningún poll/ask sale con un token revocado
  const had = session;
  try { if (had) await call("/v1/auth/logout", {method: "POST", auth: true}); } catch (e) { /* sesión local borrada igualmente */ }
  session = null; conv = null; token = null; seen = 0; clearInterval(timer); timer = null; loggingOut = false; $("logout").disabled = false; paintSession();
  if (!GUEST) { log.replaceChildren(); closeFlow(); greetNodes = []; greet(); } // sin chat de invitado: vuelta a la pantalla de acceso
}
$("logout").addEventListener("click", logout);
function paintSession() {
  $("sess").hidden = !session; $("sessbadge").textContent = t("client_badge"); $("logout").textContent = t("li_logout");
  $("f").hidden = $("human").hidden = !GUEST && !session; // sin chat de invitado: el compositor y «hablar con una persona» solo tras el acceso por SMS
}

// ---- pintado estático e inicial ----
function paintStatic() {
  document.documentElement.lang = lang;
  document.title = `GhoFi — ${t("title")}`;
  $("h1").textContent = t("title"); $("sub").textContent = t("subtitle");
  $("humantxt").textContent = t("human"); $("send").setAttribute("aria-label", t("send")); $("lang").setAttribute("aria-label", t("language"));
  $("legal").textContent = t("v5_legal"); $("safe").textContent = t("hint");
  $("privacy").textContent = t("v5_privacy"); $("privacy").hidden = !PRIVACY; if (PRIVACY) $("privacy").href = PRIVACY;
  $("retry").textContent = t("retry");
  paintSession(); paintHrs(); syncOnline();
}
const loginButton = () => el("button", {type: "button", className: "btn bp", onclick: startLogin}, ic("shield", "ic16"), sysText(el("span"), () => t("i_am_client")));
function greet() {
  log.append(el("div", {className: "aitag"}, el("i"), sysText(el("span"), () => t("v5_ai"))));
  const b1 = add("assistant", ""); // AI Act art. 50: el primer mensaje dice que es una IA (texto del servidor con textContent; el de reserva con negrita DOM)
  bind(b1, () => { if (config && config.aiDisclosure) b1.textContent = config.aiDisclosure; else setRich(b1, t("ai_fallback")); });
  add("assistant", "", () => t("v5_g2"));
  const choice = el("div", {className: "choice"}, loginButton(),
    sysText(el("button", {type: "button", className: "btn bg", onclick: startOnboarding}), () => t("not_client")));
  const chips = el("div", {className: "chips"});
  bind(chips, () => chips.replaceChildren(...t("v5_c").split(" | ").slice(0, 3).map((q) => el("button", {type: "button", className: "chip", textContent: q, onclick: () => { clearGreet(); ask(q); }}))));
  if (!GUEST) chips.hidden = true; // los chips preguntan por el chat de invitado
  log.append(choice, chips); greetNodes = [choice, chips]; scrollEnd();
}
$("av").append(ic("bot", "ic20")); $("send").append(ic("send", "ic20")); $("human").prepend(ic("human", "ic16"));
const sel = $("lang");
for (const [k, v] of Object.entries(LANGS)) sel.append(el("option", {value: k, textContent: v}));
sel.value = lang;
sel.addEventListener("change", () => {
  lang = sel.value;
  try { localStorage.setItem("ghofi.chat.lang", lang); } catch (e) { /* sin almacenamiento */ }
  config = null; paintStatic(); if (!flowKeep) closeFlow(); retranslate();
  ensureConfig().then(() => { retranslate(); paintHrs(); }); // aviso de IA y horarios vienen del servidor en el idioma elegido
});
let cfgErr = null;
async function ensureConfig(quiet = false) {
  if (config) return config;
  try { config = await call("/v1/public/config"); cfgErr = null; setBanner(false); paintHrs(); } catch (x) { cfgErr = x; if (!quiet) fail(x, ensureConfig); }
  return config;
}
// error de carga de la configuración (no de red): estado .state con "Reintentar"
function showSv() {
  const sv = stateBlock({tone: "er", icon: "alert", title: () => t("v5_errT"), text: () => t("v5_errD"), action: {label: () => t("retry"), onClick: () => { sv.remove(); init(); }}});
  bind(sv, () => sv.paint());
  log.append(sv);
}
async function init() {
  paintStatic();
  await ensureConfig(true);
  if (!config) {
    if (cfgErr instanceof TypeError || off) fail(new TypeError("offline"), async () => { log.replaceChildren(); await init(); });
    else { showSv(); return; }
  }
  greet();
}
init();
