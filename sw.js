importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js"); // avisos no celular (OneSignal)
// Painel EMBASA – service worker do aplicativo instalável.
// Não guarda nada em cache: sempre busca a versão mais nova na internet (as atualizações chegam como hoje).
// Sem internet, mostra um aviso em vez da página de erro do navegador.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Painel EMBASA</title>' +
    '<body style="font-family:sans-serif;padding:24px;background:#f2f4f7"><h2 style="color:#0b5394">Painel EMBASA</h2>' +
    '<p>Sem internet no momento. Conecte-se e toque em <b>Tentar de novo</b>.</p>' +
    '<button onclick="location.reload()" style="padding:12px 16px;font-size:16px;border:none;border-radius:8px;background:#0b5394;color:#fff">Tentar de novo</button></body>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
