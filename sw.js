/* Service worker: guarda o app no aparelho para abrir sem internet.

   Só o programa é guardado. Os seus dados nunca passam por aqui — eles ficam
   no armazenamento local do navegador e não são tocados por este arquivo. */
var CACHE = 'gastos-v1';
var ARQUIVOS = [
  './', './index.html', './categorias.js', './leitor.js', './pdf.js', './dados.js',
  './manifest.webmanifest', './icone.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    // um arquivo que falhe não pode derrubar a instalação inteira
    return Promise.all(ARQUIVOS.map(function(u){
      return c.add(new Request(u, { mode: u.indexOf('http') === 0 ? 'cors' : 'same-origin' }))
              .catch(function(){});
    }));
  }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function(r){
      if (r) return r;
      return fetch(e.request).then(function(resp){
        // guarda o que for buscado com sucesso, para funcionar offline depois
        if (resp && resp.status === 200){
          var copia = resp.clone();
          caches.open(CACHE).then(function(c){ c.put(e.request, copia).catch(function(){}); });
        }
        return resp;
      }).catch(function(){ return caches.match('./index.html'); });
    })
  );
});
