var APP_STORE_URL = "https://apps.apple.com/fr/app/une-app-photo-unique/id6788447263";
var PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.une.app";

var DEEP_LINK = "une://offrir";
var QR_CODE = "photo_card_film_code_v1";
var SCAN_ID = fallbackUuid();

var openBtn = document.getElementById("openBtn");
var webBtn = document.getElementById("webBtn");
var storeBtn = document.getElementById("storeBtn");
var autoOpenTimer;

storeBtn.href = storeUrl();

function apiBase() {
  if (location.hostname === "staging-admin.une-app.fr") return location.origin;
  if (["localhost", "127.0.0.1"].includes(location.hostname)) return "http://localhost:3000";
  return "https://api.une-app.fr";
}

function anonymousId() {
  try {
    var key = "une.qr.anonymousId";
    var existing = window.localStorage && localStorage.getItem(key);
    if (existing) return existing;
    var id = window.crypto && crypto.randomUUID ? crypto.randomUUID() : fallbackUuid();
    if (window.localStorage) localStorage.setItem(key, id);
    return id;
  } catch (_) {
    return null;
  }
}

function fallbackUuid() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) {
    return (Number(c) ^ Math.random() * 16 >> Number(c) / 4).toString(16);
  });
}

function deviceType() {
  var ua = navigator.userAgent || "";
  if (/bot|crawl|spider/i.test(ua)) return "bot";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

function osName() {
  var ua = navigator.userAgent || "";
  if (/iphone|ipad|ios/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/mac os/i.test(ua)) return "macOS";
  if (/windows/i.test(ua)) return "Windows";
  return "inconnu";
}

function browserName() {
  var ua = navigator.userAgent || "";
  if (/CriOS|Chrome/i.test(ua) && !/Edg/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) return "Safari";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Edg/i.test(ua)) return "Edge";
  return "inconnu";
}

function storeUrl() {
  var ua = navigator.userAgent || "";
  if (/android/i.test(ua) && PLAY_STORE_URL) return PLAY_STORE_URL;
  if (APP_STORE_URL) return APP_STORE_URL;
  return "";
}

function sendQrWithFetch(body) {
  if (!window.fetch) return Promise.resolve(false);
  // sendBeacon impose credentials: include : le préflight JSON est rejeté
  // entre une-app.fr et api.une-app.fr, même s'il annonce une mise en file.
  // Le suivi anonyme utilise fetch sans cookies et survit au départ de la page.
  return fetch(apiBase() + "/api/v1/marketing/qr-scans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body,
    credentials: "omit",
    keepalive: true
  }).then(function (response) {
    return response.ok;
  }).catch(function () {
    return false;
  });
}

// Les statistiques ne doivent jamais retarder ou empêcher le lien vers l'app.
function trackQr(action, destination) {
  try {
    var payload = {
      qr_code: QR_CODE,
      action: action,
      scan_id: SCAN_ID,
      anonymous_id: anonymousId(),
      destination: destination || null,
      page_path: location.pathname,
      referrer: document.referrer || null,
      user_agent: (navigator.userAgent || "").slice(0, 512),
      device_type: deviceType(),
      os: osName(),
      browser: browserName(),
      language: navigator.language || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      screen_width: window.screen ? window.screen.width : null,
      screen_height: window.screen ? window.screen.height : null
    };
    var body = JSON.stringify(payload);
    sendQrWithFetch(body);
  } catch (_) {}
}

function cancelPendingNavigation() {
  clearTimeout(autoOpenTimer);
}

openBtn.addEventListener("click", function () {
  cancelPendingNavigation();
  trackQr("app_open_attempted", "app");
  // Laisser le navigateur suivre href="une://offrir" dans le geste utilisateur.
  // Aucun await, aucune page API intermédiaire, aucun preventDefault.
});

webBtn.addEventListener("click", function () {
  cancelPendingNavigation();
  trackQr("web_fallback_clicked", "web_gift");
});

// Le navigateur ne sait pas si la confirmation iOS est encore affichée,
// refusée, ou si l'app est absente. Seul un choix explicite ouvre le store.
storeBtn.addEventListener("click", function () {
  cancelPendingNavigation();
  trackQr("app_store_fallback", "app_store");
});

document.addEventListener("visibilitychange", function () {
  if (document.hidden) cancelPendingNavigation();
});
window.addEventListener("pagehide", cancelPendingNavigation);

window.addEventListener("load", function () {
  trackQr("page_loaded", "app");
  autoOpenTimer = setTimeout(function () {
    if (document.hidden) return;
    // La tentative automatique du QR n'est pas un clic sur « ouvrir ».
    location.href = DEEP_LINK;
  }, 120);
});
