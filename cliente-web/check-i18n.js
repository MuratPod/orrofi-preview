// Paridad de claves es/en en landing, chat y admin. Uso: node cliente-web/check-i18n.js
const vm = require("vm"), fs = require("fs"); let bad = 0;
for (const [f, g] of [["landing-i18n.js", "LANDING_I18N"], ["chat-i18n.js", "CHAT_I18N"], ["admin-i18n.js", "I18N"]]) {
  const w = {}; vm.runInNewContext(fs.readFileSync(__dirname + "/" + f, "utf8"), {window: w});
  const o = w[g], ks = Object.keys(o);
  if (ks.join() !== "es,en") { console.log(f, "idiomas:", ks.join()); bad++; }
  const a = Object.keys(o.es), b = Object.keys(o.en);
  for (const k of a) if (!b.includes(k)) { console.log(f, "falta en en:", k); bad++; }
  for (const k of b) if (!a.includes(k)) { console.log(f, "falta en es:", k); bad++; }
}
console.log(bad ? "FAIL" : "OK"); process.exit(bad ? 1 : 0);
