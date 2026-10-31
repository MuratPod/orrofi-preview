// Administración mínima. Todo el contenido que viene del servidor (conversaciones, conocimiento, diffs) se pinta con textContent.
// Textos en es y en: window.I18N (admin-i18n.js). El idioma se recuerda en localStorage si está disponible.
let tok = null, refreshTok = null, refreshing = null, lerrKey = null, tenant = 1, me = null, current = "agent", queueData = null, qSel = null, qCleanup = null; // queueData: último dato de la cola (para el estado sin conexión); qSel: conversación abierta
const $ = (id) => document.getElementById(id);
// Vista previa sin servidor: ?mock=1 carga mock-api.js (datos ficticios). F = fetch que espera a que el simulador esté listo.
// Web-2: solo con GHOFI_WEB.mock === true en config.js (por defecto false); un ?mock=1 suelto no activa nada.
const GW = (window.GHOFI_WEB && typeof window.GHOFI_WEB === "object") ? window.GHOFI_WEB : {};
const LEGACY = GW.legacyAdmin === true; // Web-2: false = solo acceso del personal y cola (pestañas /v1/admin/* ocultas, código intacto)
if (!LEGACY) current = "queue";
const MOCK = GW.mock === true && new URLSearchParams(location.search).get("mock") === "1";
const mockReady = MOCK ? new Promise((ok) => { const s = document.createElement("script"); s.src = "mock-api.js"; s.onload = s.onerror = ok; document.head.append(s); }) : Promise.resolve();
// <cfg> Config (config.js): origin del API y tenant fuera del API; sin config.js todo queda como antes (mismo origin, sin X-Tenant-Id).
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
// Política de privacidad: solo una URL https de config.js (si no, el enlace se oculta)
const PRIVACY = (() => { try { const u = new URL(GW.privacyUrl); return u.protocol === "https:" ? u.href : ""; } catch (e) { return ""; } })();
const F = async (path, opt = {}) => {
  await mockReady;
  const h = {...(opt.headers || {})};
  if (TEN && !Object.keys(h).some((k) => k.toLowerCase() === "x-tenant-id")) h["X-Tenant-Id"] = TEN;
  return fetch(typeof path === "string" && path[0] === "/" ? BASE + path : path, {...opt, headers: h, credentials: "omit", referrerPolicy: "no-referrer"});
}; // </cfg>
const LANGS = {es: "Español", en: "English"};
let lang = "es";
try { lang = localStorage.getItem("ghofi.admin.lang") || ""; } catch (e) { /* sin almacenamiento */ }
if (!LANGS[lang]) lang = LANGS[(navigator.language || "es").slice(0, 2)] ? (navigator.language || "es").slice(0, 2) : "es";
const t = (k, v = {}) => ((window.I18N[lang] && window.I18N[lang][k]) || window.I18N.es[k] || k).replace(/\{(\w+)\}/g, (_, n) => (n in v ? v[n] : ""));
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  for (const k of kids) n.append(k);
  return n;
}
// ---- iconos (SVG con createElementNS; solo DOM) ----
const ICONS = {
  bot: [["rect", {x: 5, y: 8, width: 14, height: 11, rx: 3}], ["path", "M12 4v4M9 13h.01M15 13h.01"]],
  clock: [["circle", {cx: 12, cy: 12, r: 9}], ["path", "M12 7v5l3 2"]],
  book: [["path", "M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"]],
  alert: [["path", "M12 4l9 16H3z"], ["path", "M12 10v4M12 17h.01"]],
  spark: [["path", "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"]],
  chat: [["path", "M4 5h16v11H9l-5 4z"]],
  inbox: [["path", "M3.5 13.5 6 5.5h12l2.5 8"], ["path", "M3.5 13.5v5a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-5h-5l-1.5 2.5h-4L8.5 13.5z"]],
  file: [["path", "M6 3h8l4 4v14H6z"], ["path", "M14 3v4h4"]],
  list: [["path", "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"]],
  card: [["rect", {x: 3, y: 6, width: 18, height: 12, rx: 2}], ["path", "M3 10h18"]],
  home: [["path", "M4 11l8-7 8 7v9H4z"]],
  eye: [["path", "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"], ["circle", {cx: 12, cy: 12, r: 3}]],
  dl: [["path", "M12 4v11M7 10l5 5 5-5M5 20h14"]],
  users: [["circle", {cx: 9, cy: 8, r: 3.5}], ["path", "M2.5 20c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5M16 4.5a3.5 3.5 0 0 1 0 7M18 15.5c2 .6 3 2 3.5 4.5"]],
  bld: [["path", "M4 21V5l8-2v18M12 8h8v13M8 8h.01M8 12h.01M8 16h.01M16 12h.01M16 16h.01"]],
  globe: [["circle", {cx: 12, cy: 12, r: 9}], ["path", "M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"]],
  lock: [["rect", {x: 5, y: 11, width: 14, height: 9, rx: 2}], ["path", "M8 11V8a4 4 0 0 1 8 0v3"]],
  wifioff: [["path", "M3 3l18 18M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-8-4M6 13a9 9 0 0 1 3-2M18 13a9 9 0 0 0-3-2M12 18h.01"]],
  retry: [["path", "M4 12a8 8 0 1 1 3 6.2M4 19v-5h5"]],
};
const TAB_ICON = {agent: "bot", versions: "clock", knowledge: "book", outages: "alert", test: "spark", conversations: "chat", queue: "inbox", settings: "file", summaries: "list", customers: "card", stats: "home", tools: "eye", usage: "dl", team: "users", companies: "bld", plans: "globe"};
function ic(name, cls = "") {
  const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", ("ic " + cls).trim()); svg.setAttribute("aria-hidden", "true");
  for (const [tag, a] of ICONS[name]) {
    const n = document.createElementNS(NS, tag);
    if (typeof a === "string") n.setAttribute("d", a); else for (const [k, v] of Object.entries(a)) n.setAttribute(k, String(v));
    svg.append(n);
  }
  return svg;
}
// Estado vacío / error / sin conexión (.state). title y text: texto o función. Misma función en chat.js.
function stateBlock({tone = "", icon, title, text, action}) {
  const val = (x) => (typeof x === "function" ? x() : x);
  const b = el("b", {textContent: val(title)}), p = el("p", {textContent: val(text) || "", hidden: !val(text)});
  const box = el("div", {className: "state", role: tone === "er" ? "alert" : "status"}, el("span", {className: "ib" + (tone ? " " + tone : "")}, ic(icon, "ic20")), b, p);
  if (action) box.append(el("button", {type: "button", className: "btn bg", onclick: action.onClick}, ic("retry", "ic16"), el("span", {textContent: val(action.label)})));
  return box;
}
// Horario "L–V 9:00–20:00" (hours = {timezone,days,from,to} de /v1/admin/settings); sin datos, el horario por defecto
const DAYS = {es: ["L", "M", "X", "J", "V", "S", "D"], ca: ["dl", "dm", "dc", "dj", "dv", "ds", "dg"], en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], fr: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"], ru: ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]};
const DEFAULT_HOURS = {timezone: "Europe/Madrid", days: [1, 2, 3, 4, 5], from: "09:00", to: "20:00"};
function formatHours(h, lg = lang) {
  const x = h && h.days && h.from && h.to ? h : DEFAULT_HOURS, names = DAYS[lg] || DAYS.es, d = x.days;
  const contiguous = d.length > 1 && d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  const hm = (v) => String(v).replace(/^0(\d:)/, "$1");
  return `${contiguous ? names[d[0] - 1] + "–" + names[d[d.length - 1] - 1] : d.map((n) => names[n - 1]).join(", ")} ${hm(x.from)}–${hm(x.to)}`;
}
// Sesión: access (15 min) y refresh (30 días, de un solo uso) solo en memoria; no van a Storage, URL ni consola. Recargar = nuevo acceso.
// refreshSession es single-flight: usar dos veces el mismo refresh revocaría toda la sesión en el servidor.
function refreshSession() {
  return refreshing || (refreshing = (async () => {
    const r = await F("/v1/auth/refresh", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({refreshToken: refreshTok})}); // un TypeError de red se propaga tal cual (estado sin conexión)
    if (r.ok) { const j = await r.json(); tok = j.token; refreshTok = j.refreshToken; return; }
    refreshTok = null;
    if (r.status === 401 || r.status === 403) toLogin("sessExp");
    throw new Error(t("sessExp"));
  })().finally(() => { refreshing = null; }));
}
// Petición autenticada: ante 401 token_expired/unauthorized, un refresh y un solo reintento (un 401 significa que el manejador no se ejecutó). Devuelve la Response.
async function authed(url, init = {}) {
  const go = () => F(url, {...init, headers: {...init.headers, "Authorization": "Bearer " + tok}}), used = tok;
  let r = await go();
  if (r.status !== 401 || tok === null) return r;
  const code = await r.clone().json().then((j) => (j && j.error && j.error.code) || "", () => "");
  if (code !== "token_expired" && code !== "unauthorized") return r;
  if (tok === used) { if (!refreshTok) { toLogin("sessExp"); return r; } await refreshSession(); } // si otro refresh ya cambió el token, solo se reintenta
  if (tok === null) return r;
  r = await go();
  if (r.status === 401) toLogin("sessExp");
  return r;
}
// Vuelta a la pantalla de acceso (sesión caducada o revocada): borra el estado y muestra el motivo, que se retraduce al cambiar de idioma.
function toLogin(key) {
  tok = refreshTok = me = null; qSel = null; queueData = null; if (qCleanup) qCleanup();
  $("view").replaceChildren(); $("app").hidden = true; $("loginwrap").hidden = false; $("pw").value = ""; $("lslot").append($("lang"));
  lerrKey = key; $("lerr").textContent = key ? t(key) : "";
}
// Salir (Web-2): POST /v1/auth/logout revoca la sesión del servidor (también la de personal). Con el access caducado, authed hace un refresh y repite una vez.
// Cualquier error (red, 401, 5xx) se ignora: la sesión en memoria se borra siempre.
let loggingOut = false;
async function logout() {
  if (loggingOut) return; // doble clic en «Salir»
  loggingOut = true; const b = $("logout"); if (b) b.disabled = true;
  if (qCleanup) qCleanup(); // la cola deja de sondear ANTES de revocar el token
  try { if (tok) await authed("/v1/auth/logout", {method: "POST", headers: {"Accept-Language": lang}}); } catch (e) { /* sesión local borrada igualmente */ }
  loggingOut = false; toLogin(null);
}
async function api(path, method = "GET", body) {
  const r = await authed((path.startsWith("/platform") ? "/v1" : "/v1/admin") + path, {method, headers: {"Content-Type": "application/json", "Accept-Language": lang}, body: body ? JSON.stringify(body) : undefined});
  if (r.status === 204) return null;
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || r.status);
  return j;
}
function paintStatic() {
  document.documentElement.lang = lang;
  document.title = t("title");
  $("lh").textContent = t("title");
  $("email").placeholder = t("email");
  $("pw").placeholder = t("password");
  $("enter").textContent = t("enter");
  $("lang").setAttribute("aria-label", t("language"));
  if (lerrKey) $("lerr").textContent = t(lerrKey);
  for (const a of document.querySelectorAll("a.privacy")) { a.textContent = t("privacy"); a.hidden = !PRIVACY; if (PRIVACY) a.href = PRIVACY; }
}
const sel = $("lang");
for (const [k, v] of Object.entries(LANGS)) sel.append(el("option", {value: k, textContent: v}));
sel.value = lang;
sel.addEventListener("change", () => {
  lang = sel.value;
  try { localStorage.setItem("ghofi.admin.lang", lang); } catch (e) { /* sin almacenamiento */ }
  paintStatic();
  if (me) { whoLine(); tabs(); }
});
paintStatic();
// Cabecera: rol (pill) + correo, nombre de la compañía en el bloque de tenant y banner de solo lectura (partner_readonly).
function whoLine() {
  $("tenname").textContent = `#${tenant} · ${me.name}`;
  $("who").replaceChildren(el("span", {className: "pill " + (me.canWrite ? "p-ok" : "p-w"), textContent: t("role." + me.me.role)}), el("span", {textContent: me.me.email}),
    el("button", {className: "btn bg sm", type: "button", id: "logout", textContent: t("logout"), onclick: logout}));
  $("ro").hidden = me.canWrite; $("roicon").replaceChildren(ic("lock", "ic16")); $("rotxt").textContent = t("ro.banner");
}
if (TEN) { $("tenant").value = TEN; $("tenant").disabled = true; }
$("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  tenant = Number($("tenant").value) || 1; lerrKey = null; $("lerr").textContent = "";
  try {
    const r = await F("/v1/staff/auth/login", {method: "POST", headers: {"Content-Type": "application/json", "X-Tenant-Id": String(tenant)},
      body: JSON.stringify({email: $("email").value, password: $("pw").value})});
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || t("error"));
    tok = j.token; refreshTok = j.refreshToken || null;
    me = await api("/tenant");
    $("loginwrap").hidden = true; $("app").hidden = false; $("tslot").append($("lang"));
    whoLine();
    tabs();
  } catch (x) { if (!lerrKey) $("lerr").textContent = x.message; }
});
const TABS = ["agent", "versions", "knowledge", "outages", "test", "conversations", "queue", "settings", "summaries", "customers", "stats", "tools", "usage", "team", "companies", "plans"];
const SHOWN = LEGACY ? TABS : ["queue"]; // Web-2: la sesión v1 solo muestra la cola
// Visibilidad solo de comodidad: el servidor decide siempre (403). team: administradores; companies y plans: administrador de la plataforma.
const visible = (k) => k === "team" ? ["company_admin", "platform_admin"].includes(me.me.role) : ["companies", "plans"].includes(k) ? me.me.role === "platform_admin" : true;
function tabs() {
  $("tabs").replaceChildren(...SHOWN.filter(visible).map((k) => el("button", {className: "navi", type: "button", onclick: () => show(k)}, ic(TAB_ICON[k]), el("span", {textContent: t("tab." + k)}))));
  for (const b of $("tabs").children) b.dataset.tab = SHOWN.filter(visible)[[...$("tabs").children].indexOf(b)];
  show(current);
}
async function show(k) {
  current = k; if (qCleanup) qCleanup();
  for (const b of $("tabs").children) b.setAttribute("aria-current", String(b.dataset.tab === k));
  $("h1").textContent = t("tab." + k);
  const v = $("view");
  v.replaceChildren(el("p", {className: "hint", textContent: "…"}));
  try { v.replaceChildren(await VIEWS[k]()); } catch (x) { v.replaceChildren(el("p", {className: "err", textContent: x.message})); }
}
const ro = () => !me.canWrite;
const num = (v) => (v === "" || v === null ? null : Number(v));
async function download(path, name) {
  const r = await authed((path.startsWith("/platform") ? "/v1" : "/v1/admin") + path, {headers: {"Accept-Language": lang}});
  if (!r.ok) throw new Error(((await r.json()).error || {}).message || r.status);
  const a = el("a", {href: URL.createObjectURL(await r.blob()), download: name});
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
}
function limitsBlock(sub) {
  return el("div", {className: "card"}, el("b", {textContent: `${t("us.plan")}: ${sub.plan ? sub.plan.name : t("us.noplan")}`}), el("div", {className: "hint", textContent: t("us.limits")}),
    ...Object.entries(sub.usage).map(([k, v]) => kv(t("lim." + k), `${v.used} / ${v.max === null || v.max === undefined ? t("us.unlimited") : v.max}`)));
}
function usageRows(u) {
  return [kv(t("us.conversations"), `${u.conversations.total} (${Object.entries(u.conversations.byChannel).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"})`),
    kv(t("us.messages"), `${u.messages.user} / ${u.messages.assistant}`), kv(t("us.llm"), `${u.llm.calls} (${u.llm.tokensIn}/${u.llm.tokensOut} tok.)`),
    kv(t("us.cost"), u.llm.estimatedCostUSD), kv(t("us.sms"), u.sms), kv(t("us.email"), u.email), kv(t("us.templates"), u.whatsappTemplates)];
}
// Invitación: el enlace del email trae #invite=TOKEN&tenant=ID (el fragmento no viaja al servidor). Se pide la contraseña y se crea la cuenta.
const hashp = new URLSearchParams((location.hash || "").slice(1));
if (hashp.get("invite")) {
  const pw = el("input", {type: "password", placeholder: t("inv.password"), autocomplete: "new-password"}), out = el("span", {className: "hint"});
  const tid = Number(hashp.get("tenant")) || 1, token = hashp.get("invite");
  $("login").before(el("div", {className: "card"}, el("b", {textContent: t("inv.title")}), el("div", {}, pw), el("button", {className: "btn bp", textContent: t("inv.accept"), onclick: async () => {
    try {
      const r = await F("/v1/invitations/accept", {method: "POST", headers: {"Content-Type": "application/json", "Accept-Language": lang}, body: JSON.stringify({tenantId: tid, token, password: pw.value})});
      const j = await r.json();
      if (!r.ok) throw new Error((j.error && j.error.message) || t("error"));
      $("tenant").value = String(tid); $("email").value = j.email; pw.value = "";
      history.replaceState(null, "", location.pathname);
      out.className = "hint"; out.textContent = t("inv.done");
    } catch (x) { out.className = "err"; out.textContent = x.message; }
  }}), out));
}
function field(label, node) { return el("label", {}, el("div", {className: "hint", textContent: label}), node); }
function kv(label, value) { return el("div", {className: "kv"}, el("span", {textContent: label}), el("b", {textContent: String(value)})); }
const fmt = (x) => (x === null || x === undefined ? "—" : String(x));
function diffBlock(lines) {
  const box = el("div", {className: "diff"});
  for (const l of lines) box.append(el("div", {className: l.startsWith("+") ? "add" : l.startsWith("-") ? "del" : "", textContent: l}));
  return box;
}
const VIEWS = {
  async agent() {
    const a = await api("/agent");
    const f = {};
    for (const k of ["name", "greeting"]) f[k] = el("input", {value: a[k], disabled: ro()});
    for (const k of ["tenantPrompt", "personality", "behavior"]) f[k] = el("textarea", {value: a[k], disabled: ro()});
    const msg = el("span", {className: "hint"});
    const save = el("button", {className: "btn bp", textContent: t("save"), disabled: ro(), onclick: async () => {
      try { const r = await api("/agent", "PUT", Object.fromEntries(Object.entries(f).map(([k, n]) => [k, n.value]))); msg.textContent = `${t("saved")} · v${r.version}`; } catch (x) { msg.textContent = x.message; }
    }});
    return el("div", {}, el("p", {className: "hint", textContent: t("agent.safety") + (a.version ? `  ${t("agent.version")}: v${a.version}` : "")}),
      field(t("agent.name"), f.name), field(t("agent.greeting"), f.greeting), field(t("agent.tenantPrompt"), f.tenantPrompt),
      field(t("agent.personality"), f.personality), field(t("agent.behavior"), f.behavior), save, msg);
  },
  async versions() {
    const {active, versions} = await api("/agent/versions");
    const root = el("div"), detail = el("div");
    if (!versions.length) root.append(el("p", {className: "hint", textContent: t("ver.none")}));
    for (const v of versions) {
      const who = v.createdBy ? `${t("ver.by")} #${v.createdBy}` : t("ver.system");
      const row = el("div", {className: "card"}, el("b", {textContent: `v${v.number} `}), el("span", {className: "pill " + (v.active ? "approved" : ""), textContent: v.active ? t("ver.active") : v.kind}),
        el("span", {className: "hint", textContent: ` ${v.createdAt} · ${who} · ${t("ver.changed")}: ${v.changed.join(", ") || "—"}${v.restoredFrom ? " · " + t("ver.restoredFrom") + v.restoredFrom : ""} `}));
      row.append(el("button", {className: "btn bg", textContent: t("ver.diff"), onclick: async () => {
        const d = await api(`/agent/versions/${v.number}/diff`);
        detail.replaceChildren(el("h2", {textContent: `v${d.from} → v${d.to}`}), ...(d.fields.length ? d.fields.flatMap((x) => [el("b", {textContent: x.field}), diffBlock(x.diff.length ? x.diff : [x.after])]) : [el("p", {className: "hint", textContent: t("ver.nochanges")})]));
      }}));
      if (!ro() && v.number !== active) row.append(el("button", {className: "btn bg", textContent: t("ver.rollback"), onclick: async () => {
        if (!confirm(t("ver.confirm"))) return;
        try { await api(`/agent/versions/${v.number}/rollback`, "POST"); show("versions"); } catch (x) { alert(x.message); }
      }}));
      root.append(row);
    }
    root.append(detail);
    return root;
  },
  async knowledge() {
    const {sources} = await api("/knowledge");
    const root = el("div");
    if (!ro()) {
      const ti = el("input", {placeholder: t("kn.title")}), c = el("textarea", {placeholder: t("kn.textOrUrl")});
      const kind = el("select", {}, ...["text", "url"].map((x) => el("option", {value: x, textContent: x})));
      root.append(el("div", {className: "card"}, ti, kind, c, el("button", {className: "btn bp", textContent: t("kn.add"), onclick: async () => {
        const body = kind.value === "url" ? {title: ti.value, kind: "url", url: c.value.trim()} : {title: ti.value, kind: "text", content: c.value};
        try { await api("/knowledge", "POST", body); show("knowledge"); } catch (x) { alert(x.message); }
      }}), el("button", {className: "btn bg", textContent: t("kn.seed"), onclick: async () => { await api("/knowledge/seed", "POST"); show("knowledge"); }})));
      const file = el("input", {type: "file", accept: ".pdf,.txt,.md,.csv,.html,.htm"});
      root.append(el("div", {className: "card"}, el("div", {className: "hint", textContent: t("kn.file")}), file, el("button", {className: "btn bp", textContent: t("kn.upload"), onclick: async () => {
        const f = file.files[0];
        if (!f) return;
        const buf = new Uint8Array(await f.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        try { await api("/knowledge", "POST", {title: f.name, kind: "file", filename: f.name, contentBase64: btoa(bin)}); show("knowledge"); } catch (x) { alert(x.message); }
      }}), el("div", {className: "hint", textContent: t("kn.nopdfocr")})));
    }
    for (const s of sources) {
      const row = el("div", {className: "card"}, el("b", {textContent: s.title + " "}), el("span", {className: "pill " + s.status, textContent: s.status}),
        el("span", {className: "hint", textContent: ` ${s.kind} ${s.origin} · ${s.length} ${t("kn.chars")}`}));
      if (!ro()) {
        for (const [lbl, act] of [[t("kn.approve"), "approve"], [t("kn.reject"), "reject"]]) row.append(el("button", {className: "btn bg", textContent: lbl, onclick: async () => { await api(`/knowledge/${s.id}/${act}`, "POST"); show("knowledge"); }}));
        row.append(el("button", {className: "btn bg", textContent: t("kn.delete"), onclick: async () => { await api(`/knowledge/${s.id}`, "DELETE"); show("knowledge"); }}));
      }
      root.append(row);
    }
    return root;
  },
  async outages() {
    const {outages} = await api("/outages");
    const root = el("div");
    if (!ro()) {
      const z = el("input", {placeholder: t("out.zone")}), d = el("input", {placeholder: t("out.desc")}), eta = el("input", {placeholder: "ETA HH:MM"});
      root.append(el("div", {className: "card"}, z, d, eta, el("button", {className: "btn bp", textContent: t("out.add"), onclick: async () => {
        try { await api("/outages", "POST", {zone: z.value, description: d.value, eta: eta.value}); show("outages"); } catch (x) { alert(x.message); }
      }})));
    }
    for (const o of outages) {
      const row = el("div", {className: "card"}, el("b", {textContent: o.zone}), el("span", {textContent: ` ${o.active ? t("out.active") : t("out.closed")} · ${o.status} · ${o.description}`}));
      if (!ro() && o.active) row.append(el("button", {className: "btn bg", textContent: t("out.close"), onclick: async () => { await api(`/outages/${o.id}`, "PUT", {zone: o.zone, status: "resolved", description: o.description, startedAt: o.startedAt, eta: o.eta, active: false}); show("outages"); }}));
      root.append(row);
    }
    return root;
  },
  async test() {
    let conv = null;
    const log = el("div"), box = el("textarea", {placeholder: t("test.msg"), disabled: ro()});
    const send = el("button", {className: "btn bp", textContent: t("test.send"), disabled: ro(), onclick: async () => {
      const m = box.value; if (!m.trim()) return;
      log.append(el("div", {className: "msg user", textContent: m})); box.value = "";
      try { const r = await api("/agent/test", "POST", {message: m, conversationId: conv}); conv = r.conversationId; log.append(el("div", {className: "msg assistant", textContent: r.text})); }
      catch (x) { log.append(el("div", {className: "err", textContent: x.message})); }
    }});
    return el("div", {}, el("p", {className: "hint", textContent: t("test.hint")}), log, box, send);
  },
  async conversations() {
    const {conversations} = await api("/conversations");
    const root = el("div"), detail = el("div");
    if (!ro()) root.append(el("button", {className: "btn bg", textContent: t("conv.export"), onclick: async () => {
      const j = await api("/conversations/export");
      const a = el("a", {href: URL.createObjectURL(new Blob([JSON.stringify(j, null, 1)], {type: "application/json"})), download: "conversations.json"});
      a.click();
    }}));
    for (const c of conversations) {
      root.append(el("div", {className: "card"}, el("b", {textContent: `#${c.id} `}), el("span", {className: "pill", textContent: c.channel}),
        el("span", {className: "hint", textContent: ` ${c.messageCount} ${t("conv.messages")} · ${c.createdAt}`}),
        el("button", {className: "btn bg", textContent: t("conv.view"), onclick: async () => {
          const d = await api("/conversations/" + c.id);
          detail.replaceChildren(el("h2", {textContent: `${t("conv.title")} #${d.id}`}),
            ...d.messages.flatMap((m) => [el("div", {className: "msg " + m.role, textContent: m.content}),
              ...(m.agentVersion ? [el("div", {className: "hint", textContent: `${t("conv.agentVersion")}: v${m.agentVersion}`})] : [])]),
            ...d.toolCalls.map((x) => el("div", {className: "hint", textContent: `${t("conv.op")} ${x.name} [${x.status}] ${JSON.stringify(x.result)}`})),
            ...d.handoffs.map((h) => el("div", {className: "card", textContent: `${t("conv.handoff")} ${h.externalId}: ${h.summary}`})));
        }})));
    }
    root.append(detail);
    return root;
  },
  async settings() {
    const s = await api("/settings");
    const email = el("input", {type: "email", placeholder: t("set.email"), disabled: ro()});
    const l = el("select", {disabled: ro()}, ...Object.entries(LANGS).map(([k, v]) => el("option", {value: k, textContent: v})));
    l.value = s.summaryLang;
    const msg = el("span", {className: "hint"});
    const send = async (body) => {
      try { const r = await api("/settings", "PATCH", body); email.value = ""; msg.textContent = `${t("saved")} · ${r.summaryEmail || t("set.none")}`; show("settings"); } catch (x) { msg.textContent = x.message; }
    };
    const save = el("button", {className: "btn bp", textContent: t("save"), disabled: ro(), onclick: () => send({summaryLang: l.value, ...(email.value.trim() ? {summaryEmail: email.value.trim()} : {})})});
    const off = el("button", {className: "btn bg", textContent: t("set.disable"), disabled: ro() || !s.summaryEmail, onclick: () => send({summaryEmail: ""})});
    return el("div", {}, el("p", {className: "hint", textContent: t("set.hint")}), kv(t("set.current"), s.summaryEmail || t("set.none")),
      field(t("set.email"), email), field(t("set.lang"), l), save, off, msg);
  },
  // Cola "Mi gestor" (Web-2): /v1/staff/handovers (lista y detalle) y acciones tomar / responder / pasar / cerrar. Los permisos los decide el servidor (403/409); aquí solo se muestran u ocultan botones.
  async queue() {
    if (qCleanup) qCleanup();
    const root = el("div"), box = el("div");
    root.append(box);
    const TZ = "Europe/Madrid", MAXREPLY = 2000, RANK = {open: 0, taken: 1, closed: 2}, PAGE = 200, MAXPAGES = Number(GW.maxPages) > 0 ? Number(GW.maxPages) : 100; // MAXPAGES: solo freno de seguridad (100 × 200 = 20 000 por estado)
    let offline = false, listEl = null, panelEl = null, colleagues = null;
    const detailCache = new Map();
    const ymd = (d) => new Intl.DateTimeFormat("en-CA", {timeZone: TZ}).format(d);
    const whenOf = (iso) => {
      if (!iso) return "";
      const d = new Date(iso), hm = new Intl.DateTimeFormat("es-ES", {hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ}).format(d);
      return ymd(d) === ymd(new Date()) ? hm : `${new Intl.DateTimeFormat("es-ES", {day: "2-digit", month: "2-digit", timeZone: TZ}).format(d)} ${hm}`;
    };
    // sin conexión: TypeError de fetch; el resto de errores traen el mensaje del servidor
    const isNet = (x) => x instanceof TypeError || !navigator.onLine;
    const statusOf = (h) => (h.status === "closed" ? ["c", "p-n"] : h.status === "taken" ? ["p", "p-ok"] : ["n", "p-w"]);
    const channelText = (ch) => (["web", "whatsapp", "app", "test"].includes(ch) ? t("q.ch." + ch) : ch == null ? "" : String(ch));
    const sortItems = (hs) => [...hs].sort((a, b) => (RANK[a.status] - RANK[b.status]) || (a.id - b.id)); // abiertos primero; dentro de cada estado, los que más esperan
    const hoursInfo = () => queueData && queueData.hours ? queueData.hours : null;
    const hoursLabel = () => { const h = hoursInfo(); return `${formatHours(h, lang)} (${(h && h.timezone) || TZ})`; };
    const openNow = () => {
      const h = hoursInfo() || DEFAULT_HOURS;
      try {
        const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone: h.timezone || TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false}).formatToParts(new Date()).map((x) => [x.type, x.value]));
        const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday) + 1, mins = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
        const m = (v) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
        return h.days.includes(wd) && mins >= m(h.from) && mins < m(h.to);
      } catch (e) { return null; }
    };
    // el servidor manda name=null: la etiqueta se localiza por id; si algún día viene nombre, se usa
    const colleagueName = (id) => { if (id === me.me.id) return t("q.you"); const c = colleagues && colleagues.find((x) => x.id === id); return c && c.name ? c.name : t("q.colleague", {id}); };
    const assignedLabel = (h) => (h.assignedTo == null ? t("q.unassigned") : t("q.assigned", {who: colleagueName(h.assignedTo)}));
    const mark = (id) => { for (const r of listEl.querySelectorAll(".qi")) r.setAttribute("aria-current", String(r.dataset.id === String(id))); };
    // etiqueta por mensaje: by = client | ai | staff (servidor), hora at (UTC → Europe/Madrid)
    const messagesOf = (d) => d.context.filter((m) => m.role === "user" || m.role === "assistant").map((m) => {
      const c = m.by === "client" ? "u" : m.by === "staff" ? "h" : "";
      return el("div", {className: "m " + c}, el("span", {className: "tg " + c, textContent: t(c === "u" ? "q.cu" : c === "h" ? "q.hu" : "q.ai") + (m.at ? " · " + whenOf(m.at) : "")}), el("div", {className: "b " + (c === "u" ? "u" : "a"), textContent: m.content}));
    });
    // POST /v1/staff/...; el error lleva status y código para mostrarlo junto al campo
    const sapi = async (path, method = "GET", body) => {
      const r = await authed("/v1/staff" + path, {method, headers: {"Content-Type": "application/json", "Accept-Language": lang}, body: body ? JSON.stringify(body) : undefined});
      const j = r.status === 204 ? null : await r.json().catch(() => null);
      if (!r.ok) { const e = new Error((j && j.error && j.error.message) || String(r.status)); e.status = r.status; throw e; }
      return j;
    };
    // la cola son los abiertos y los tomados (los cerrados no deben ocupar sitio). Cada página trae las más recientes que quedan; `next` apunta a las más antiguas: se siguen hasta el final, así que los más antiguos (los que más esperan) siempre se ven; MAXPAGES es solo un freno de seguridad y, si salta, se avisa con la fecha del más antiguo cargado
    const fetchAll = async (status) => {
      const byId = new Map(); let cursor = null, pages = 0;
      do {
        const r = await sapi(`/handovers?status=${status}&limit=${PAGE}` + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""));
        for (const h of r.handovers) byId.set(h.id, h);
        const nx = r.next || null; if (nx !== null && nx === cursor) { cursor = null; break; } // cursor que no avanza: no repetir
        cursor = nx; pages++;
      } while (cursor && pages < MAXPAGES);
      return {items: [...byId.values()], more: !!cursor};
    };
    const fetchQueue = async () => { const [o, k] = await Promise.all([fetchAll("open"), fetchAll("taken")]); const handovers = o.items.concat(k.items), truncated = o.more || k.more; return {handovers, truncated, oldest: truncated ? handovers.reduce((m, h) => (h.createdAt && (!m || h.createdAt < m) ? h.createdAt : m), null) : null}; };
    const getColleagues = async () => { if (!colleagues) colleagues = (await sapi("/colleagues")).colleagues; return colleagues; };
    const loadDetail = async (id) => { const d = await sapi("/handovers/" + id); detailCache.set(id, d); return d; };
    let keep = null;
    const paintPanel = (d) => {
      const [stKey, stCls] = statusOf(d), mineTaken = d.status === "taken" && (d.assignedTo === me.me.id || me.me.role === "company_admin" || me.me.role === "platform_admin");
      const who = el("div", {className: "who"}, el("b", {textContent: `#${d.id}`}), el("small", {textContent: [channelText(d.channel), t(d.visitor ? "q.noclient" : "q.client")].filter(Boolean).join(" · ")}));
      const parts = [el("div", {className: "hd"}, who, el("span", {className: "pill " + stCls, textContent: t("q.st." + stKey)}))];
      if (d.status !== "open") parts[0].append(el("span", {className: "hint", textContent: assignedLabel(d)}));
      if (d.note) parts.push(el("div", {className: "sm"}, el("div", {className: "hud"}, ic("spark", "ic13"), el("span", {textContent: t("q.sum")})), el("p", {textContent: d.note})));
      if (d.closeNote) parts.push(el("div", {className: "sm"}, el("div", {className: "hud"}, ic("spark", "ic13"), el("span", {textContent: t("q.closeNote")})), el("p", {textContent: d.closeNote})));
      parts.push(el("div", {className: "cv"}, ...messagesOf(d)));
      const rp = el("div", {className: "rp"});
      if (!me.canWrite) rp.append(el("div", {className: "hint", textContent: t("q.ro")}));
      else if (d.status === "closed") rp.append(el("div", {className: "hint", textContent: t("q.closed")}));
      else if (d.status === "open") { const eOpen = errLineEl(); rp.append(el("div", {className: "row2"}, actionBtn(t("q.take"), "bp", () => run(rp, () => sapi(`/handovers/${d.id}/take`, "POST"), eOpen)), closeBtn(d, rp, eOpen)), eOpen); }
      else if (mineTaken) rp.append(...takenControls(d, rp));
      else rp.append(el("div", {className: "hint", textContent: assignedLabel(d)}));
      parts.push(rp);
      if (keep && keep.id === d.id) { // tras un 409: se restituyen el mensaje y el texto del cuadro de respuesta
        const ta = rp.querySelector("textarea"), e = rp.querySelector(".err") || rp.appendChild(errLineEl());
        if (ta) { ta.value = keep.text; const c = rp.querySelector(".cnt"); if (c) c.textContent = t("q.cnt", {n: ta.value.length, max: MAXREPLY}); }
        setErr(e, new Error(keep.msg)); keep = null;
      }
      panelEl.replaceChildren(...parts);
    };
    const errLineEl = () => el("p", {className: "err", role: "alert", hidden: true});
    const setErr = (n, x) => { n.textContent = x ? x.message : ""; n.hidden = !x; };
    const actionBtn = (label, cls, onClick) => el("button", {type: "button", className: "btn " + cls, textContent: label, onclick: onClick});
    // ejecuta una acción; el resultado (detalle actualizado) sustituye al anterior; el error del servidor se muestra en la zona de acciones
    async function run(rp, fn, errNode) {
      const setDisabled = (v) => { for (const b of rp.querySelectorAll("button")) b.disabled = v; };
      setDisabled(true);
      try { const d = await fn(); if (d && d.id) { detailCache.set(d.id, d); try { await refreshList(d.id); } finally { setDisabled(false); } } return true; }
      catch (x) {
        setDisabled(false);
        const e = isNet(x) ? new Error(t("q.offT")) : x;
        setErr(errNode || rp.querySelector(".err") || rp.appendChild(errLineEl()), e);
        // el refresco repinta el panel: se conservan el mensaje del servidor y el texto escrito
        if (x.status === 409) { const ta = rp.querySelector("textarea"); keep = {id: qSel, msg: e.message, text: ta ? ta.value : ""}; refreshList(qSel, true); }
        return false;
      }
    }
    // «Cerrar» con confirmación: en «taken» (mía/supervisor) y en «open» (spam/duplicados); las «taken» ajenas no se cierran desde la UI en v1
    const closeBtn = (d, rp, errNode) => actionBtn(t("q.close"), "bg", () => { if (confirm(t("q.closeConfirm"))) run(rp, () => sapi(`/handovers/${d.id}/close`, "POST", {}), errNode); });
    function takenControls(d, rp) {
      const ta = el("textarea", {rows: 3, maxLength: MAXREPLY, placeholder: t("q.replyPh")}), cnt = el("span", {className: "cnt", textContent: t("q.cnt", {n: 0, max: MAXREPLY})});
      ta.setAttribute("aria-label", t("q.reply"));
      const eReply = errLineEl(), eOther = errLineEl();
      const send = actionBtn(t("q.send"), "bp", async () => {
        const text = ta.value.trim();
        if (!text) { setErr(eReply, new Error(t("q.replyEmpty"))); return; }
        setErr(eReply, null);
        if (await run(rp, () => sapi(`/handovers/${d.id}/reply`, "POST", {text}).then(() => loadDetail(d.id)), eReply)) ta.value = "";
      });
      ta.addEventListener("input", () => { cnt.textContent = t("q.cnt", {n: ta.value.length, max: MAXREPLY}); setErr(eReply, null); });
      const pick = el("select", {}, el("option", {value: "", textContent: t("q.pick")}));
      pick.setAttribute("aria-label", t("q.transferTo"));
      getColleagues().then((cs) => { for (const c of cs) if (c.id !== d.assignedTo) pick.append(el("option", {value: String(c.id), textContent: colleagueName(c.id)})); }).catch((x) => setErr(eOther, isNet(x) ? new Error(t("q.offT")) : x));
      const transfer = actionBtn(t("q.transfer"), "bg", () => { if (!pick.value) { setErr(eOther, new Error(t("q.pick"))); return; } setErr(eOther, null); run(rp, () => sapi(`/handovers/${d.id}/transfer`, "POST", {assignTo: Number(pick.value)}), eOther); });
      const close = closeBtn(d, rp, eOther);
      const actions = el("div", {className: "row2"}, pick, transfer, close);
      // visitante (web/WhatsApp sin cliente): la respuesta de la administración solo queda en la conversación y no llega a nadie
      if (d.visitor) return [el("p", {className: "hint", textContent: t("q.visitorNoReply")}), actions, eOther];
      return [field(t("q.reply"), ta), el("div", {className: "row2"}, cnt, send), eReply, actions, eOther];
    }
    const select = async (h) => {
      qSel = h.id; mark(h.id);
      panelEl.replaceChildren(el("p", {className: "hint", textContent: t("q.loading")}));
      if (window.matchMedia("(max-width:899.98px)").matches) panelEl.scrollIntoView({block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
      try { const d = await loadDetail(h.id); if (qSel === h.id) paintPanel(d); }
      catch (x) { if (qSel === h.id) panelEl.replaceChildren(stateBlock({tone: isNet(x) ? "w" : "er", icon: isNet(x) ? "wifioff" : "alert", title: t(isNet(x) ? "q.offT" : "q.erT"), text: t("q.erD"), action: {label: t("q.retry"), onClick: () => select(h)}})); }
    };
    const paint = () => {
      const items = sortItems(queueData ? queueData.handovers : []), nodes = [];
      if (offline) nodes.push(el("div", {className: "bar qb", role: "status"}, el("span", {className: "ib w"}, ic("wifioff", "ic16")),
        el("div", {}, el("b", {textContent: t("q.offT")}), el("small", {textContent: t("q.offD") + (queueData ? " " + t("q.offAt", {t: new Intl.DateTimeFormat(lang, {hour: "2-digit", minute: "2-digit"}).format(queueData.at)}) : "")})),
        el("button", {className: "btn bg sm", type: "button", onclick: () => load()}, ic("retry", "ic16"), el("span", {textContent: t("q.retry")}))));
      const head = el("div", {className: "qh"}, ic("clock", "ic16"), el("span", {textContent: t("q.hours", {hours: hoursLabel()})}), el("span", {className: "sp"}));
      const on = openNow();
      if (on === true) head.append(el("span", {className: "pill p-ok", textContent: t("q.open")}));
      else if (on === false) head.append(el("span", {className: "hint", textContent: t("q.off", {h: ((hoursInfo() || DEFAULT_HOURS).from).replace(/^0(\d:)/, "$1")})}));
      head.append(el("button", {className: "btn bg sm", type: "button", onclick: () => load()}, ic("retry", "ic16"), el("span", {textContent: t("q.refresh")})));
      listEl = el("section", {className: "ql"}, el("h3", {textContent: t("q.list")}));
      panelEl = el("section", {className: "qp"});
      if (!items.length) listEl.append(offline ? stateBlock({tone: "w", icon: "wifioff", title: t("q.offT"), text: t("q.offD")}) : stateBlock({icon: "inbox", title: t("q.eT"), text: t("q.eD")}));
      for (const h of items) {
        const [stKey, stCls] = statusOf(h);
        const row = el("button", {className: "qi", type: "button"}, el("div", {className: "r1"}, el("b", {className: "sid", textContent: `#${h.id}`}), el("span", {className: "t", textContent: whenOf(h.createdAt)})),
          el("div", {className: "r2"}, el("span", {className: "rs", textContent: h.status === "open" ? t("q.waiting") : assignedLabel(h)}), el("span", {className: "pill " + stCls, textContent: t("q.st." + stKey)})),
          el("div", {className: "hint"}, ...(h.channel == null ? [] : [el("span", {className: "pill p-n", textContent: channelText(h.channel)}), " "]), el("span", {textContent: t(h.visitor ? "q.noclient" : "q.client")}),
            ...(h.outsideHours && h.status !== "closed" ? [" ", el("span", {className: "pill p-w", textContent: t("q.outside")})] : [])));
        row.dataset.id = String(h.id); row.setAttribute("aria-current", "false");
        row.addEventListener("click", () => select(h));
        listEl.append(row);
      }
      const sel = items.find((x) => x.id === qSel);
      if (sel) { mark(sel.id); if (detailCache.has(sel.id)) paintPanel(detailCache.get(sel.id)); else select(sel); } else panelEl.append(stateBlock({icon: "chat", title: t("q.eP")}));
      if (queueData && queueData.truncated) listEl.append(el("p", {className: "hint", role: "status", textContent: t("q.truncated", {n: items.length, d: queueData.oldest ? whenOf(queueData.oldest) : "—"})}));
      nodes.push(head, el("div", {className: "q" + (offline ? " qd" : "")}, listEl, panelEl));
      box.replaceChildren(...nodes);
      if (sel) mark(sel.id);
    };
    // recarga la lista (y el detalle abierto) tras una acción; keepDetail=false descarta el detalle en caché del elemento abierto
    async function refreshList(id, drop) {
      try { const {handovers, truncated, oldest} = await fetchQueue(); queueData = {...queueData, handovers, truncated, oldest, at: new Date()}; offline = false; if (drop) detailCache.delete(id); paint(); } catch (x) { if (isNet(x)) { offline = true; paint(); } }
    }
    async function load() {
      box.replaceChildren(el("p", {className: "hint", textContent: t("q.loading")}));
      try {
        const [{handovers, truncated, oldest}, st] = await Promise.all([fetchQueue(), api("/settings").catch((x) => { if (x instanceof TypeError) throw x; return null; }), getColleagues().catch(() => null)]);
        detailCache.clear(); offline = false;
        queueData = {handovers, truncated, oldest, hours: st && st.hours, at: new Date()}; paint();
      } catch (x) {
        if (isNet(x)) { offline = true; paint(); return; }
        box.replaceChildren(el("div", {className: "q"}, el("section", {className: "ql"}, stateBlock({tone: "er", icon: "alert", title: t("q.erT"), text: t("q.erD"), action: {label: t("q.retry"), onClick: load}})),
          el("section", {className: "qp"}, stateBlock({icon: "chat", title: t("q.eP")}))));
      }
    }
    const goOff = () => { offline = true; if (queueData) paint(); }, goOn = () => load();
    window.addEventListener("offline", goOff); window.addEventListener("online", goOn);
    qCleanup = () => { window.removeEventListener("offline", goOff); window.removeEventListener("online", goOn); qCleanup = null; };
    await load();
    return root;
  },
  async summaries() {
    const status = el("select", {}, el("option", {value: "", textContent: t("sum.all")}), ...["pending", "sent", "skipped", "failed"].map((x) => el("option", {value: x, textContent: x})));
    const list = el("div");
    const load = async () => {
      const {summaries} = await api("/summaries" + (status.value ? "?status=" + status.value : ""));
      list.replaceChildren(...(summaries.length ? summaries.map((r) => el("div", {className: "card"}, el("b", {textContent: `#${r.conversationId} `}), el("span", {className: "pill", textContent: r.kind}),
        el("span", {className: "pill " + (r.status === "sent" ? "approved" : r.status === "failed" ? "rejected" : "pending"), textContent: r.status}),
        el("span", {className: "hint", textContent: ` ${r.channel} · ${t("sum.attempts")}: ${r.attempts} · ${r.createdAt}${r.sentAt ? " → " + r.sentAt : ""}`}))) : [el("p", {className: "hint", textContent: t("sum.empty")})]));
    };
    status.addEventListener("change", load);
    await load();
    return el("div", {}, field(t("sum.status"), status), list);
  },
  async customers() {
    const id = el("input", {type: "number", min: "1", placeholder: t("cus.id")}), out = el("div");
    const go = el("button", {className: "btn bp", textContent: t("cus.load"), onclick: async () => {
      try {
        const h = await api(`/customers/${Number(id.value)}/interactions`);
        out.replaceChildren(kv(h.phoneMasked, Object.entries(h.byChannel).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"),
          ...(h.interactions.length ? h.interactions.map((i) => el("div", {className: "card"}, el("b", {textContent: `${i.type} #${i.id} `}), el("span", {className: "pill", textContent: i.channel}),
            el("span", {className: "hint", textContent: ` ${i.at}${i.handedOver ? " · " + t("cus.handedOver") : ""}${i.status ? " · " + i.status : ""}`}), el("pre", {className: "out", textContent: i.summary}))) : [el("p", {className: "hint", textContent: t("cus.empty")})]));
      } catch (x) { out.replaceChildren(el("p", {className: "err", textContent: x.message})); }
    }});
    return el("div", {}, field(t("cus.id"), id), go, out);
  },
  async stats() {
    const days = el("select", {}, ...[7, 30, 90].map((d) => el("option", {value: d, textContent: String(d)})));
    days.value = "30";
    const out = el("div");
    const load = async () => {
      const m = await api("/metrics?days=" + days.value);
      let ready = null;
      try { ready = await (await F("/ready")).json(); } catch (x) { /* sin /ready */ }
      out.replaceChildren(
        kv(t("st.conversations"), `${m.conversations.total} (${Object.entries(m.conversations.byChannel).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"})`),
        kv(t("st.messages"), `${m.messages.user} / ${m.messages.assistant} / ${m.messages.staff}`),
        kv(t("st.handoff"), `${m.handoff.conversations} (${(m.handoff.rate * 100).toFixed(1)} %)`),
        kv(t("st.firstAssistant"), fmt(m.firstReply.assistant.medianSeconds)), kv(t("st.firstHuman"), fmt(m.firstReply.human.medianSeconds)),
        kv(t("st.summaries"), `${m.summaries.sent} / ${m.summaries.failed} / ${m.summaries.pending}`),
        kv(t("st.llm"), `${m.llm.calls} (${m.llm.tokensIn}/${m.llm.tokensOut} tok.)`), kv(t("st.cost"), m.llm.estimatedCostUSD),
        kv(t("st.versions"), Object.entries(m.agentVersions).map(([k, v]) => `v${k}: ${v}`).join(", ") || "—"),
        ...(ready ? [kv(t("st.health"), `${ready.status} · db ${ready.db}`), kv(t("st.jobs"), `${ready.jobs.status} · ${fmt(ready.jobs.lastSuccessAt)}`)] : []));
    };
    days.addEventListener("change", load);
    await load();
    return el("div", {}, field(t("st.period"), days), out);
  },
  async usage() {
    const days = el("select", {}, ...[7, 30, 90, 365].map((d) => el("option", {value: d, textContent: String(d)})));
    days.value = "30";
    const out = el("div");
    const load = async () => {
      const [u, sub] = await Promise.all([api("/usage?days=" + days.value), api("/subscription")]);
      out.replaceChildren(...usageRows(u), el("p", {className: "hint", textContent: t("us.estimate")}), limitsBlock(sub),
        ...(ro() ? [] : [el("button", {className: "btn bg", textContent: t("us.export"), onclick: async () => { try { await download("/usage.csv?days=" + days.value, "usage.csv"); } catch (x) { alert(x.message); } }})]));
    };
    days.addEventListener("change", load);
    await load();
    return el("div", {}, field(t("us.period"), days), out);
  },
  async team() {
    const [{users}, {invitations}] = await Promise.all([api("/users"), api("/invitations")]);
    const roles = ["company_admin", "company_user", "partner_readonly"];
    const email = el("input", {type: "email", placeholder: t("team.email")}), role = el("select", {}, ...roles.map((r) => el("option", {value: r, textContent: t("role." + r)})));
    const msg = el("span", {className: "hint"});
    const root = el("div", {}, el("div", {className: "card"}, email, role, el("button", {className: "btn bp", textContent: t("team.invite"), onclick: async () => {
      try { await api("/invitations", "POST", {email: email.value, role: role.value, lang}); show("team"); } catch (x) { msg.className = "err"; msg.textContent = x.message; }
    }}), msg), el("h2", {textContent: t("team.users")}));
    for (const u of users) {
      const row = el("div", {className: "card"}, el("b", {textContent: u.email + " "}), el("span", {className: "pill " + (u.active ? "approved" : "rejected"), textContent: u.active ? t("role." + u.role) : t("team.inactive")}),
        el("span", {className: "hint", textContent: u.me ? " " + t("team.you") : ""}));
      if (!u.me && u.role !== "platform_admin") {
        const r = el("select", {}, ...roles.map((x) => el("option", {value: x, textContent: t("role." + x)})));
        r.value = roles.includes(u.role) ? u.role : "company_user";
        r.addEventListener("change", async () => { try { await api("/users/" + u.id, "PATCH", {role: r.value}); } catch (x) { alert(x.message); } show("team"); });
        row.append(r, el("button", {className: "btn bg", textContent: u.active ? t("team.disable") : t("team.enable"), onclick: async () => {
          if (u.active && !confirm(t("team.confirmDisable"))) return;
          try { await api("/users/" + u.id, "PATCH", {active: !u.active}); } catch (x) { alert(x.message); }
          show("team");
        }}));
      }
      root.append(row);
    }
    root.append(el("h2", {textContent: t("team.pending")}));
    for (const i of invitations) {
      const row = el("div", {className: "card"}, el("b", {textContent: i.email + " "}), el("span", {className: "pill " + (i.status === "pending" ? "pending" : ""), textContent: i.status}),
        el("span", {className: "hint", textContent: ` ${t("role." + i.role)} · ${i.createdAt}`}));
      if (i.status === "pending") row.append(el("button", {className: "btn bg", textContent: t("team.revoke"), onclick: async () => { await api("/invitations/" + i.id, "DELETE"); show("team"); }}));
      root.append(row);
    }
    return root;
  },
  async companies() {
    const [{companies}, plans] = await Promise.all([api("/platform/companies"), api("/platform/plans")]);
    const days = el("select", {}, ...[7, 30, 90, 365].map((d) => el("option", {value: d, textContent: String(d)})));
    days.value = "30";
    const list = el("div");
    const name = el("input", {placeholder: t("co.name")}), admin = el("input", {type: "email", placeholder: t("co.adminEmail")}), msg = el("span", {className: "hint"});
    const paint = async () => {
      const usage = await api("/platform/usage?days=" + days.value);
      const by = Object.fromEntries(usage.companies.map((c) => [c.id, c]));
      list.replaceChildren(...companies.map((c) => {
        const plan = el("select", {}, el("option", {value: "", textContent: t("pl.none")}), ...plans.plans.filter((p) => p.active || (c.plan && c.plan.id === p.id)).map((p) => el("option", {value: p.id, textContent: p.name})));
        plan.value = c.plan ? String(c.plan.id) : "";
        plan.addEventListener("change", async () => { try { await api(`/platform/companies/${c.id}/subscription`, "PUT", {planId: num(plan.value)}); } catch (x) { alert(x.message); } show("companies"); });
        return el("div", {className: "card"}, el("b", {textContent: `#${c.id} ${c.name} `}), el("span", {className: "pill " + (c.status === "active" ? "approved" : "rejected"), textContent: t("co.status." + c.status)}),
          kv(t("co.users"), `${c.users.active} / ${c.users.total}`), ...usageRows(by[c.id]), field(t("co.plan"), plan),
          el("button", {className: "btn bg", textContent: c.status === "active" ? t("co.suspend") : t("co.activate"), onclick: async () => {
            if (c.status === "active" && !confirm(t("co.confirmSuspend"))) return;
            try { await api("/platform/companies/" + c.id, "PATCH", {status: c.status === "active" ? "suspended" : "active"}); } catch (x) { alert(x.message); }
            show("companies");
          }}));
      }));
    };
    days.addEventListener("change", paint);
    await paint();
    return el("div", {}, el("div", {className: "card"}, name, admin, el("button", {className: "btn bp", textContent: t("co.create"), onclick: async () => {
      try { await api("/platform/companies", "POST", {name: name.value, adminEmail: admin.value.trim() || null, lang}); show("companies"); } catch (x) { msg.className = "err"; msg.textContent = x.message; }
    }}), msg), field(t("us.period"), days), list,
      el("button", {className: "btn bg", textContent: t("us.export"), onclick: async () => { try { await download("/platform/usage.csv?days=" + days.value, "platform-usage.csv"); } catch (x) { alert(x.message); } }}));
  },
  async plans() {
    const {plans} = await api("/platform/plans");
    const f = {code: el("input", {placeholder: t("pl.code")}), name: el("input", {placeholder: t("pl.name")})};
    for (const [k, lbl] of [["maxConversations", "lim.conversations"], ["maxMessages", "lim.messages"], ["maxAgents", "lim.agents"], ["maxChannels", "lim.channels"]]) f[k] = el("input", {type: "number", min: "0", placeholder: t(lbl)});
    const msg = el("span", {className: "hint"});
    const root = el("div", {}, el("p", {className: "hint", textContent: t("pl.hint")}), el("div", {className: "card"}, ...Object.values(f), el("button", {className: "btn bp", textContent: t("pl.create"), onclick: async () => {
      try {
        await api("/platform/plans", "POST", {code: f.code.value, name: f.name.value, maxConversations: num(f.maxConversations.value), maxMessages: num(f.maxMessages.value), maxAgents: num(f.maxAgents.value), maxChannels: num(f.maxChannels.value)});
        show("plans");
      } catch (x) { msg.className = "err"; msg.textContent = x.message; }
    }}), msg));
    for (const p of plans) {
      const lim = (v) => (v === null ? t("us.unlimited") : v);
      root.append(el("div", {className: "card"}, el("b", {textContent: `${p.name} (${p.code}) `}), el("span", {className: "pill " + (p.active ? "approved" : "rejected"), textContent: p.active ? t("pl.active") : t("pl.inactive")}),
        kv(t("lim.conversations"), lim(p.maxConversations)), kv(t("lim.messages"), lim(p.maxMessages)), kv(t("lim.agents"), lim(p.maxAgents)), kv(t("lim.channels"), lim(p.maxChannels)),
        ...(p.active ? [el("button", {className: "btn bg", textContent: t("pl.retire"), onclick: async () => { await api("/platform/plans/" + p.id, "PATCH", {active: false}); show("plans"); }})] : [])));
    }
    return root;
  },
  async tools() {
    const {tools} = await api("/tools");
    const root = el("div", {}, el("p", {className: "hint", textContent: t("tool.hint")}));
    for (const x of tools) {
      const args = el("textarea", {value: JSON.stringify(Object.fromEntries(Object.entries(x.parameters.properties).filter(([k]) => x.parameters.required.includes(k)).map(([k, p]) => [k, p.type === "integer" ? 1 : ""])), null, 1), disabled: ro()});
      const out = el("pre", {className: "out", hidden: true});
      const card = el("div", {className: "card"}, el("b", {textContent: x.name + " "}), el("span", {className: "pill " + (x.readOnly ? "approved" : "pending"), textContent: x.readOnly ? t("tool.read") : t("tool.action")}),
        el("span", {className: "hint", textContent: ` ${t("tool.risk")} ${x.risk}`}), el("div", {className: "hint", textContent: x.description}));
      if (!ro()) card.append(field(t("tool.args"), args), el("button", {className: "btn bg", textContent: t("tool.run"), onclick: async () => {
        try { out.textContent = JSON.stringify(await api(`/tools/${x.name}/invoke`, "POST", {arguments: JSON.parse(args.value)}), null, 1); } catch (e) { out.textContent = e.message; }
        out.hidden = false;
      }}), out);
      root.append(card);
    }
    return root;
  },
};
