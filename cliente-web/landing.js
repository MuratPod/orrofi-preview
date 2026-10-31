(function () {
  var D = window.LANDING_I18N, lang = "es", KEY = "orrofi.landing.lang";
  try { var s = localStorage.getItem(KEY); if (D[s]) lang = s; else { var b = (navigator.language || "es").slice(0, 2); if (D[b]) lang = b; } } catch (e) {}
  function apply() {
    var t = D[lang]; document.documentElement.lang = lang;
    document.title = document.body.dataset.title ? t[document.body.dataset.title] : t.title;
    document.querySelectorAll("[data-i]").forEach(function (n) { n.textContent = t[n.dataset.i]; });
    document.querySelectorAll("[data-ph]").forEach(function (n) { n.placeholder = t[n.dataset.ph]; });
    document.querySelectorAll("[data-al]").forEach(function (n) { n.setAttribute("aria-label", t[n.dataset.al]); });
    document.querySelectorAll(".lang button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.l === lang)); });
    var m = document.getElementById("msg"); if (m && !m.hidden) m.textContent = t.loginMsg;
  }
  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { lang = b.dataset.l; try { localStorage.setItem(KEY, lang); } catch (e) {} apply(); });
  });
  var f = document.getElementById("login");
  if (f) f.addEventListener("submit", function (e) { e.preventDefault(); var m = document.getElementById("msg"); m.hidden = false; m.textContent = D[lang].loginMsg; });
  var w = document.getElementById("wl"); if (w) w.addEventListener("submit", function (e) { e.preventDefault(); });
  apply();
})();
