/* Extração de texto de PDF dentro do navegador, via pdf.js.

   Substitui o pypdf da versão do Mac. Os arquivos são lidos em memória —
   nada é enviado para lugar nenhum e nada fica gravado no aparelho. */

var PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

var _pdfjsPronto = null;

function carregarPdfJs(){
  if (_pdfjsPronto) return _pdfjsPronto;
  _pdfjsPronto = new Promise(function(ok, falha){
    if (window.pdfjsLib){
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return ok(window.pdfjsLib);
    }
    var s = document.createElement('script');
    s.src = PDFJS_URL;
    s.onload = function(){
      if (!window.pdfjsLib) return falha(new Error('pdf.js carregou mas não apareceu'));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      ok(window.pdfjsLib);
    };
    s.onerror = function(){
      falha(new Error('não consegui carregar o leitor de PDF — precisa de internet na primeira vez'));
    };
    document.head.appendChild(s);
  });
  return _pdfjsPronto;
}

/* Reconstrói as linhas a partir das posições dos fragmentos de texto.

   O pypdf entrega o texto já quebrado em linhas; o pdf.js entrega pedaços
   soltos com coordenadas. Sem reagrupar por altura, os leitores — que
   dependem de "data numa linha, descrição na seguinte" — não funcionariam. */
function linhasDaPagina(conteudo){
  var itens = conteudo.items.filter(function(i){ return i.str !== undefined; });
  var linhas = [];
  itens.forEach(function(it){
    var y = Math.round(it.transform[5] * 2) / 2;   // meio ponto de tolerância
    var x = it.transform[4];
    var alvo = null;
    for (var i = linhas.length - 1; i >= 0 && i >= linhas.length - 6; i--){
      if (Math.abs(linhas[i].y - y) <= 2){ alvo = linhas[i]; break; }
    }
    if (!alvo){ alvo = { y: y, pedacos: [] }; linhas.push(alvo); }
    alvo.pedacos.push({ x: x, s: it.str });
  });
  linhas.sort(function(a, b){ return b.y - a.y; });     // de cima para baixo
  return linhas.map(function(l){
    l.pedacos.sort(function(a, b){ return a.x - b.x; });
    return l.pedacos.map(function(p){ return p.s; }).join('');
  });
}

/* Devolve {texto, motor} ou lança RuntimeError-equivalente com mensagem clara. */
function textoDoPdf(arquivo, senhas){
  return carregarPdfJs().then(function(pdfjsLib){
    return arquivo.arrayBuffer().then(function(buf){
      var tentativas = [''].concat((senhas || []).filter(Boolean));

      function tentar(i){
        if (i >= tentativas.length){
          return Promise.reject(new Error(
            'PDF protegido por senha — cadastre a senha na aba Configurar ' +
            '(contas de operadora costumam usar o CPF só com números)'));
        }
        var t = pdfjsLib.getDocument({
          data: buf.slice(0),
          password: tentativas[i],
          isEvalSupported: false,
          useSystemFonts: false
        });
        return t.promise.then(function(doc){
          var paginas = [];
          for (var p = 1; p <= doc.numPages; p++) paginas.push(p);
          return paginas.reduce(function(cadeia, n){
            return cadeia.then(function(acc){
              return doc.getPage(n)
                .then(function(pg){ return pg.getTextContent(); })
                .then(function(c){ return acc.concat(linhasDaPagina(c)); });
            });
          }, Promise.resolve([])).then(function(linhas){
            return { texto: linhas.join('\n'), motor: 'pdf.js' };
          });
        }).catch(function(e){
          var nome = e && (e.name || '');
          if (nome === 'PasswordException') return tentar(i + 1);
          throw new Error('PDF ilegível (' + (nome || 'erro') + ')');
        });
      }
      return tentar(0);
    });
  });
}

/* Lê um arquivo escolhido pelo usuário e devolve {lanc, info}. Nunca rejeita:
   o erro vem dentro de info.erro, igual à versão do Mac. */
function lerArquivo(arquivo, senhas){
  var nome = arquivo.name;
  var ext = (nome.split('.').pop() || '').toLowerCase();

  if (ext !== 'pdf'){
    return Promise.resolve({
      lanc: [],
      info: { arquivo: nome, leitor: null, motor: null, n: 0,
              erro: ext.match(/^(png|jpe?g|heic|webp|tiff)$/)
                ? 'imagem — no iPhone não há OCR; lance manualmente'
                : 'formato não suportado (só PDF)' }
    });
  }

  return textoDoPdf(arquivo, senhas)
    .then(function(r){ return lerTexto(r.texto, nome, r.motor); })
    .catch(function(e){
      return { lanc: [], info: { arquivo: nome, leitor: null, motor: null, n: 0,
                                 erro: e.message || String(e) } };
    });
}
