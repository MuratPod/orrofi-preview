// Configuración pública de la web (SIN secretos). Se sustituye al publicar fuera del API.
// apiBase: vacío = mismo origin que la página; si no, solo un origin "https://host[:puerto]" (sin ruta).
// tenantId: cadena de dígitos o vacío. allowApi: lista explícita de origins que puede usar ?api=<url> (por defecto vacía: ?api= no actúa).
// Web-2 (compilación v1): mock=false → mock-api.js nunca se carga (con true, además hace falta ?mock=1). legacyAdmin=false → la administración
// muestra solo el acceso del personal y la cola; guestChat=false → el chat exige acceso por SMS (sin chat de invitado). applications=false → sin formulario de solicitud (recoge nombre, teléfono y correo sin acceso previo; coverage se mantiene). privacyUrl: https o vacío.
window.GHOFI_WEB = {apiBase: "", tenantId: "", allowApi: [], mock: true, legacyAdmin: false, guestChat: false, applications: true, privacyUrl: ""};
