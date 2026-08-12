/* Service worker: guarda o app no aparelho para abrir sem internet.

   Só o programa é guardado. Os seus dados nunca passam por aqui — eles ficam
   no armazenamento local do navegador e não são tocados por este arquivo.

   ESTRATÉGIA: rede primeiro para os arquivos do app, cache primeiro para a
   biblioteca de PDF.

   O motivo importa. Com "cache primeiro" o iPhone continuaria abrindo a versão
   antiga para sempre depois de uma publicação — você mexeria no código, subiria,
   e nada mudaria na tela. Com "rede primeiro", estando online ele sempre pega a
   versão nova; estando offline, cai no cache e funciona igual. A biblioteca de
   PDF é a exceção porque nunca muda e pesa quase 1 MB. */

var CACHE = 'gastos-v2';

var PROPRIOS = ['./', './index.html', './categorias.js', './leitor.js',
                './pdf.js', './dados.js', './manifest.webmanifest', './icone.png'];

var EXTERNOS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    // um arquivo que falhe não pode derrubar a instalação inteira
    return Promise.all(PROPRIOS.concat(EXTERNOS).map(function(u){
      return c.add(new Request(u, { cache: 'reload' })).catch(function(){});
    }));
  }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function guardar(req, resp){
  if (resp && resp.status === 200){
    var copia = resp.clone();
    caches.open(CACHE).then(function(c){ c.put(req, copia).catch(function(){}); });
  }
  return resp;
}

self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;

  var url = e.request.url;
  var externo = EXTERNOS.some(function(u){ return url.indexOf(u) === 0; });

  if (externo){
    // nunca muda: cache primeiro, rede só na primeira vez
    e.respondWith(
      caches.match(e.request).then(function(r){
        return r || fetch(e.request).then(function(resp){ return guardar(e.request, resp); });
      })
    );
    return;
  }

  // arquivos do app: rede primeiro, cache como rede de segurança
  e.respondWith(
    fetch(e.request)
      .then(function(resp){ return guardar(e.request, resp); })
      .catch(function(){
        return caches.match(e.request).then(function(r){
          return r || caches.match('./index.html');
        });
      })
  );
});
