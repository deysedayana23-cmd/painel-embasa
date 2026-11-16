importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js"); // avisos no celular (OneSignal)
// Painel EMBASA – service worker do aplicativo instalável.
// Não guarda nada em cache: sempre busca a versão mais nova na internet (as atualizações chegam como hoje).
// Sem internet, mostra um aviso em vez da página de erro do navegador.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
// 16/11: Rotas de leitura funcionam sem internet: a tela das rotas, o Leaflet e a imagem de satélite ficam guardados no celular.
const CACHE_ROTAS = "rotas-v1";
self.addEventListener("fetch", e => {
  const u = e.request.url;
  if (/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery/.test(u) || /cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet\//.test(u)) {
    e.respondWith(caches.open(CACHE_ROTAS).then(c => c.match(u).then(r => r || fetch(e.request).then(resp => { c.put(u, resp.clone()).catch(() => {}); return resp; }))));
    return;
  }
  if (e.request.mode === "navigate" && /\/rotas\.html/.test(u)) {
    e.respondWith(fetch(e.request.url, { cache: "no-store" }).then(resp => { const cp = resp.clone(); caches.open(CACHE_ROTAS).then(c => c.put("rotas.html", cp)); return resp; })
      .catch(() => caches.open(CACHE_ROTAS).then(c => c.match("rotas.html")).then(r => r || new Response("Abra as rotas uma vez com internet.", { headers: { "Content-Type": "text/plain; charset=utf-8" } }))));
    return;
  }
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Painel EMBASA</title>' +
    '<body style="font-family:sans-serif;padding:24px;background:#f2f4f7"><h2 style="color:#0b5394">Painel EMBASA</h2>' +
    '<p>Sem internet no momento. Conecte-se e toque em <b>Tentar de novo</b>.</p>' +
    '<button onclick="location.reload()" style="padding:12px 16px;font-size:16px;border:none;border-radius:8px;background:#0b5394;color:#fff">Tentar de novo</button></body>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
