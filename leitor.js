/* Leitor de faturas, boletos e contas — porte fiel do leitor.py.
   Roda inteiro dentro do navegador: nenhum arquivo sai do aparelho.

   Princípio, igual ao original: NUNCA inventar valor. Linha que não bate com
   um padrão conhecido é descartada e entra no relatório de não lidos. */

var MESES = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6,
              jul:7, ago:8, set:9, out:10, nov:11, dez:12 };
var MESES_RE = Object.keys(MESES).join('|');

function nrm(s){
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/* '1.234,56' -> 1234.56 · '−45,90' -> -45.90 · null se não for número */
function valorBr(txt){
  if (txt == null) return null;
  var t = String(txt).trim();
  // o Nubank usa o menos tipográfico U+2212, não o hífen do teclado
  var SINAIS = ['-', '−', '–', '—'];
  var neg = SINAIS.some(function(s){ return t.indexOf(s) === 0 || t.lastIndexOf(s) === t.length-1; })
            || t.indexOf('(') >= 0;
  t = t.replace(/[^\d,.]/g, '');
  if (!t) return null;
  if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
  else if (!/\.\d{2}$/.test(t)) t = t.replace(/\./g, '');
  var v = parseFloat(t);
  if (isNaN(v)) return null;
  return neg ? -v : v;
}

function monta(a, mo, d){
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  var dt = new Date(Date.UTC(a, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function dataIso(txt, anoRef){
  if (!txt) return null;
  var t = nrm(txt);
  anoRef = anoRef || new Date().getFullYear();
  var m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = t.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/);
  if (m){ var a = +m[3]; if (a < 100) a += 2000; return monta(a, +m[2], +m[1]); }
  m = t.match(/\b(\d{1,2})[/.](\d{1,2})\b/);
  if (m) return monta(anoRef, +m[2], +m[1]);
  m = t.match(new RegExp('\\b(\\d{1,2})\\s+(' + MESES_RE + ')\\b'));
  if (m) return monta(anoRef, MESES[m[2]], +m[1]);
  return null;
}

/* --------------------------------------------- linha digitável do boleto */

/* O fator conta dias desde 07/10/1997, chegou a 9999 em 21/02/2025 e foi
   reiniciado em 1000 no dia seguinte. Calcula as duas leituras e fica com a
   que cai numa data plausível. */
function dataDoFator(f){
  f = parseInt(f, 10);
  if (isNaN(f) || f < 1000) return null;
  var hoje = new Date();
  var mais = function(base, dias){ var d = new Date(base.getTime()); d.setUTCDate(d.getUTCDate() + dias); return d; };
  var antiga = mais(new Date(Date.UTC(1997, 9, 7)), f);
  var nova   = mais(new Date(Date.UTC(2025, 1, 22)), f - 1000);
  var min = mais(hoje, -400), max = mais(hoje, 800);
  var cands = [nova, antiga].filter(function(d){ return d >= min && d <= max; });
  return cands.length ? cands[0].toISOString().slice(0, 10) : null;
}

/* Padrão Febraban: nos últimos 14 dos 47 dígitos estão o fator de vencimento
   (4) e o valor em centavos (10). Não depende de layout nem de rótulo. */
function linhaDigitavel(texto){
  var pad = /\d{5}[.\s]?\d{5}\s+\d{5}[.\s]?\d{6}\s+\d{5}[.\s]?\d{6}\s+\d\s+\d{14}/;
  var m = texto.match(pad), d = null;
  if (m) d = m[0].replace(/\D/g, '').slice(0, 47);
  else {
    var cand = texto.replace(/[.\s-]/g, '').match(/\d{47,}/);
    if (cand) d = cand[0].slice(0, 47);
  }
  if (!d || d.length < 47) return null;
  var c5 = d.slice(33, 47);
  var valor = parseInt(c5.slice(4), 10) / 100;
  if (!(valor > 0)) return null;
  return { valor: valor, vencimento: dataDoFator(c5.slice(0, 4)) };
}

/* --------------------------------------------------------------- leitores */

var RE_VALOR = '([-−–]?\\s?R?\\$?\\s?\\d{1,3}(?:\\.\\d{3})*,\\d{2}|[-−–]?\\s?R?\\$?\\s?\\d+,\\d{2})';

var LIXO = ['total','subtotal','saldo','limite','disponivel','fatura anterior',
  'pagamento em','pagamento de fatura','pagamento total','pagamento recebido',
  'pagamento efetuado','credito de atraso','valor total','vencimento',
  'encargos do mes','juros de','iof','resumo','linha digitavel','codigo de barras',
  'nosso numero','cnpj','cpf','agencia','conta corrente','beneficiario','pagador',
  'saldo anterior','pontos','limite total','pagamentos '];

function eLixo(desc){
  var d = nrm(desc);
  if (d.length < 3) return true;
  return LIXO.some(function(p){ return d.indexOf(p) >= 0; });
}

function anoDoTexto(t){
  var anos = (t.match(/\b20\d{2}\b/g) || []).map(Number);
  if (!anos.length) return new Date().getFullYear();
  var c = {}, melhor = anos[0], maxN = 0;
  anos.forEach(function(a){ c[a] = (c[a]||0) + 1; if (c[a] > maxN){ maxN = c[a]; melhor = a; } });
  return melhor;
}

/* Mês e ano da fatura ('FATURA 13 AGO 2026'): numa fatura de janeiro, as
   compras de dezembro são do ano anterior. */
function refFatura(texto){
  var t = nrm(texto);
  var m = t.match(new RegExp('fatura\\s+\\d{1,2}\\s+(' + MESES_RE + ')\\s+(20\\d{2})'));
  if (m) return { mes: MESES[m[1]], ano: +m[2] };
  m = t.match(new RegExp('vencimento:?\\s*\\d{1,2}\\s+(' + MESES_RE + ')\\s+(20\\d{2})'));
  if (m) return { mes: MESES[m[1]], ano: +m[2] };
  return { mes: null, ano: anoDoTexto(texto) };
}

function limpaDesc(s){
  return String(s).replace(/[•·∙]+/g, ' ')
    .replace(/^\s*\d{4}\s+/, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.\-–—:]+|[\s.\-–—:]+$/g, '');
}

var NU_LINHA = new RegExp('^(.*?)\\s+' + RE_VALOR + '\\s*$');
var NU_DATA  = new RegExp('^\\s*(\\d{1,2})\\s+(' + MESES_RE + ')\\s*$', 'i');
var NU_TUDO  = new RegExp('^\\s*(\\d{1,2})\\s+(' + MESES_RE + ')\\s+(.+?)\\s+' + RE_VALOR + '\\s*$', 'i');
var SO_VALOR = /^[-−–]?\s?R?\$?\s?[\d.]+,\d{2}$/;

function lerNubank(texto, arquivo){
  var ref = refFatura(texto);
  var linhas = texto.split('\n');
  var brutos = [];
  function anoDe(mes){ return (ref.mes && mes > ref.mes) ? ref.ano - 1 : ref.ano; }

  var i = 0;
  while (i < linhas.length){
    var ln = linhas[i], m = ln.match(NU_TUDO);
    if (m){                                    // data, descrição e valor numa linha só
      var mes = MESES[m[2].toLowerCase()];
      var d = monta(anoDe(mes), mes, +m[1]);
      var desc = limpaDesc(m[3]), v = valorBr(m[4]);
      if (d && v != null && !eLixo(desc)) brutos.push({ data: d, desc: desc, valor: v });
      i++; continue;
    }
    m = ln.match(NU_DATA);                     // data sozinha
    if (m && i + 1 < linhas.length){
      var mes2 = MESES[m[2].toLowerCase()];
      var d2 = monta(anoDe(mes2), mes2, +m[1]);
      var m2 = linhas[i+1].match(NU_LINHA);
      if (d2 && m2){                           // descrição e valor na linha seguinte
        var desc2 = limpaDesc(m2[1]), v2 = valorBr(m2[2]);
        if (v2 != null && desc2 && !eLixo(desc2)) brutos.push({ data: d2, desc: desc2, valor: v2 });
        i += 2; continue;
      }
      if (d2){        // bloco de várias linhas (estorno explicado): valor vem adiante
        var achou = false;
        for (var k = i + 2; k < Math.min(i + 7, linhas.length); k++){
          if (NU_DATA.test(linhas[k])) break;
          if (SO_VALOR.test(linhas[k].trim())){
            var v3 = valorBr(linhas[k].trim()), d3 = limpaDesc(linhas[i+1]);
            if (v3 != null && d3 && !eLixo(d3)) brutos.push({ data: d2, desc: d3, valor: v3 });
            i = k + 1; achou = true; break;
          }
        }
        if (achou) continue;
      }
    }
    i++;
  }
  return compensar(brutos, arquivo);
}

/* Estorno cancela a compra correspondente: a compra não aconteceu, então
   nenhuma das duas linhas entra no gasto. Crédito sem par vira valor
   negativo, para o total continuar fechando com o que a fatura declara. */
function compensar(brutos, arquivo){
  var despesas = brutos.filter(function(x){ return x.valor > 0; });
  var creditos = brutos.filter(function(x){ return x.valor < 0; });

  creditos.forEach(function(c){
    var alvo = Math.abs(c.valor);
    var chave = nrm(String(c.desc).replace(/^(estorno|credito|crédito)\s+de\s+/i, '')).replace(/"/g, '');
    var acha = function(exigirNome){
      for (var i = 0; i < despesas.length; i++){
        if (Math.abs(despesas[i].valor - alvo) >= 0.01) continue;
        if (exigirNome && !(chave && nrm(despesas[i].desc).indexOf(chave.slice(0, 12)) >= 0)) continue;
        return i;
      }
      return -1;
    };
    var i = acha(true); if (i < 0) i = acha(false);
    if (i >= 0){ despesas.splice(i, 1); c._casado = true; }
  });

  var saida = despesas.map(function(d){
    return { data: d.data, desc: d.desc, valor: d.valor, origem: arquivo, leitor: 'nubank' };
  });
  creditos.forEach(function(c){
    if (!c._casado) saida.push({ data: c.data, desc: c.desc, valor: c.valor,
      origem: arquivo, leitor: 'nubank', credito: true, setor: 'Não é despesa' });
  });
  saida.sort(function(a, b){ return a.data < b.data ? -1 : 1; });
  return saida;
}

function lerCaixa(texto, arquivo){
  var ano = anoDoTexto(texto), out = [];
  var pad = new RegExp('^\\s*(\\d{1,2}[/.]\\d{1,2}(?:[/.]\\d{2,4})?)\\s+(.+?)\\s+' + RE_VALOR + '\\s*([DC])?\\s*$', 'gim');
  var m;
  while ((m = pad.exec(texto)) !== null){
    var d = dataIso(m[1], ano), desc = limpaDesc(m[2]), v = valorBr(m[3]);
    var dc = (m[4] || '').toUpperCase();
    if (!d || v == null || eLixo(desc) || dc === 'C') continue;   // crédito não é despesa
    out.push({ data: d, desc: desc, valor: Math.abs(v), origem: arquivo, leitor: 'caixa' });
  }
  return out;
}

/* contas mensais de serviço: um lançamento por fatura */
var EMISSORES = [
  ['Conta de telefone — Vivo', ['telefonica brasil','vivo celular','vivo controle']],
  ['Conta de internet — Vivo Fibra', ['vivo fibra']],
  ['Conta de internet — NIO', ['nio - client','nio internet','niointernet']],
  ['Conta de telefone — Claro', ['claro s.a','claro nxt']],
  ['Conta de telefone — TIM', ['tim s.a','tim celular','tim brasil']],
  ['Conta de telefone — Oi', ['oi s.a','oi movel']],
  ['Conta de internet — Algar', ['algar telecom']],
  ['Conta de energia — Cemig', ['cemig distribuicao','cemig d']],
  ['Conta de energia — CPFL', ['cpfl ']],
  ['Conta de energia — Enel', ['enel distribuicao']],
  ['Conta de água — Copasa', ['copasa']],
  ['Conta de água — Sabesp', ['sabesp']],
  ['Conta de gás — Ultragaz', ['ultragaz']]
];

function emissor(texto){
  var t = nrm(texto);
  for (var i = 0; i < EMISSORES.length; i++)
    for (var j = 0; j < EMISSORES[i][1].length; j++)
      if (t.indexOf(EMISSORES[i][1][j]) >= 0) return EMISSORES[i][0];
  return null;
}

/* Numa conta o risco não é perder lançamento — é pegar o número errado, porque
   a página tem subtotal, simulação de parcelamento e consumo anterior. Por isso
   o valor vem de três caminhos independentes e só passa sem ressalva quando
   pelo menos dois concordam. */
function lerConta(texto, arquivo){
  var nome = emissor(texto) || 'Conta de serviço';
  var cands = [];

  var ld = linhaDigitavel(texto);
  if (ld) cands.push({ v: ld.valor, d: ld.vencimento, o: 'linha digitável' });

  var pad = /(\d{2}\/\d{2}\/\d{4})\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/g, m;
  while ((m = pad.exec(texto)) !== null){
    var d = dataIso(m[1]), v = valorBr(m[2]);
    if (d && v > 0) cands.push({ v: v, d: d, o: 'data+valor' });
  }

  var t = nrm(texto);
  ['valor a pagar','total a pagar','valor do documento','valor cobrado'].forEach(function(rot){
    var p = new RegExp(rot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\d]{0,40}(\\d{1,3}(?:\\.\\d{3})*,\\d{2})', 'g'), mm;
    while ((mm = p.exec(t)) !== null){
      var vv = valorBr(mm[1]);
      if (vv > 0) cands.push({ v: vv, d: null, o: 'rótulo' });
    }
  });

  if (!cands.length) return [];

  var cont = {};
  cands.forEach(function(c){ var k = c.v.toFixed(2); cont[k] = (cont[k]||0) + 1; });
  var valor = null, maxN = 0;
  Object.keys(cont).forEach(function(k){ if (cont[k] > maxN){ maxN = cont[k]; valor = parseFloat(k); } });

  var venc = null;
  cands.forEach(function(c){ if (!venc && c.v.toFixed(2) === valor.toFixed(2) && c.d) venc = c.d; });
  if (!venc){
    var mv = t.match(/vencimento[^\d]{0,40}(\d{2}\/\d{2}\/\d{4})/);
    venc = mv ? dataIso(mv[1]) : null;
  }
  if (!venc) return [];

  var fontes = [];
  cands.forEach(function(c){ if (c.v.toFixed(2) === valor.toFixed(2) && fontes.indexOf(c.o) < 0) fontes.push(c.o); });
  var seguro = fontes.length >= 2 || fontes.indexOf('linha digitável') >= 0;

  return [{ data: venc, desc: nome, valor: valor, origem: arquivo, leitor: 'conta',
            conferir: !seguro, fontes: fontes.sort().join(', ') }];
}

function lerBoleto(texto, arquivo){
  var t = nrm(texto);
  if (t.indexOf('linha digitavel') < 0 && t.indexOf('codigo de barras') < 0 &&
      t.indexOf('cedente') < 0 && t.indexOf('beneficiario') < 0 && t.indexOf('vencimento') < 0)
    return [];

  var venc = null, m = t.match(/vencimento[^\d]{0,40}(\d{1,2}[/.]\d{1,2}[/.]\d{2,4})/);
  if (m) venc = dataIso(m[1]);

  var valor = null, ld = linhaDigitavel(texto);
  if (ld){ valor = ld.valor; venc = ld.vencimento || venc; }
  if (valor == null){
    ['valor do documento','valor cobrado','valor a pagar'].forEach(function(ch){
      if (valor != null) return;
      var p = new RegExp(ch + '[^\\d]{0,40}(\\d{1,3}(?:\\.\\d{3})*,\\d{2})');
      var mm = t.match(p); if (mm) valor = valorBr(mm[1]);
    });
  }
  if (valor == null) return [];

  var ced = null;
  ['cedente','beneficiario'].forEach(function(ch){
    if (ced) return;
    var mm = t.match(new RegExp(ch + '\\s*:?\\s*(.{4,60})'));
    if (mm) ced = mm[1].split('cnpj')[0].split('cpf')[0].replace(/^[\s.:—-]+|[\s.:—-]+$/g, '');
  });

  return [{ data: venc || new Date().toISOString().slice(0,10),
            desc: (ced || ('Boleto — ' + arquivo.replace(/\.[^.]+$/, ''))).slice(0, 70),
            valor: Math.abs(valor), origem: arquivo, leitor: 'boleto',
            conferir: !venc || !ced }];
}

function lerGenerico(texto, arquivo){
  var ano = anoDoTexto(texto), out = [];
  var pad = new RegExp('(\\d{1,2}[/.]\\d{1,2}(?:[/.]\\d{2,4})?|\\d{1,2}\\s+(?:' + MESES_RE + '))\\s+(.{3,60}?)\\s+' + RE_VALOR, 'gi');
  var m;
  while ((m = pad.exec(texto)) !== null){
    var d = dataIso(m[1], ano), desc = limpaDesc(m[2]), v = valorBr(m[3]);
    if (!d || v == null || eLixo(desc)) continue;
    out.push({ data: d, desc: desc, valor: Math.abs(v), origem: arquivo,
               leitor: 'generico', conferir: true });
  }
  return out;
}

function detectar(texto){
  var t = nrm(texto);
  if (t.indexOf('nubank') >= 0 || t.indexOf('nu pagamentos') >= 0 || t.indexOf('nu financeira') >= 0) return 'nubank';
  if (emissor(texto)) return 'conta';
  if (t.indexOf('caixa economica federal') >= 0 || t.indexOf('caixa economica') >= 0) return 'caixa';
  if (t.indexOf('linha digitavel') >= 0 || t.indexOf('codigo de barras') >= 0 ||
      t.indexOf('ficha de compensacao') >= 0) return 'boleto';
  return 'generico';
}

var LEITORES = { nubank: lerNubank, caixa: lerCaixa, conta: lerConta,
                 boleto: lerBoleto, generico: lerGenerico };

/* O total que a própria fatura declara — serve para conferir a leitura */
function totalDeclarado(texto, tipo){
  if (tipo !== 'nubank') return null;
  var m = texto.match(new RegExp('total de compras[^\\n]*?' + RE_VALOR, 'i'));
  if (!m) return null;
  var tot = valorBr(m[1]) || 0;
  var o = texto.match(new RegExp('outros lan[cç]amentos[^\\n]*?' + RE_VALOR, 'i'));
  if (o) tot += valorBr(o[1]) || 0;      // IOF, juros e anuidade também saem do bolso
  return tot;
}

/* Recebe o texto já extraído. Devolve {lanc, info} — nunca lança exceção. */
function lerTexto(texto, arquivo, motor){
  var info = { arquivo: arquivo, leitor: null, motor: motor || null, erro: null, n: 0 };
  if (!texto || !texto.trim()){
    info.erro = (motor === 'ocr')
      ? 'imagem sem texto reconhecível — lance manualmente'
      : 'PDF sem texto extraível — provavelmente é um scan; lance manualmente';
    return { lanc: [], info: info };
  }
  var tipo = detectar(texto);
  info.leitor = tipo;
  var lanc = LEITORES[tipo](texto, arquivo);

  if (!lanc.length && tipo !== 'generico'){
    lanc = lerGenerico(texto, arquivo);
    if (lanc.length) info.leitor = tipo + ' → genérico';
  }
  if (!lanc.length) info.erro = 'nenhum lançamento reconhecido no texto';

  if (motor === 'ocr') lanc.forEach(function(x){ x.conferir = true; });

  var dec = totalDeclarado(texto, tipo);
  if (dec){
    var somado = lanc.reduce(function(s, x){ return s + x.valor; }, 0);
    info.declarado = dec;
    info.somado = somado;
    info.dif = somado - dec;
    info.confere = Math.abs(somado - dec) < 0.05;
  }
  info.n = lanc.length;
  return { lanc: lanc, info: info };
}
