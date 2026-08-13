/* Camada de dados — substitui o dados.json do servidor.

   Tudo mora no próprio aparelho, no armazenamento do navegador. Nenhum dado
   sai do celular: os PDFs são lidos em memória e nem chegam a ser gravados.

   O iOS pode limpar o armazenamento de sites pouco usados. Um app adicionado à
   tela de início é bem mais protegido, mas a garantia de verdade é o backup em
   arquivo — por isso Exportar e Importar são parte da rotina, não um extra. */

var CHAVE = 'otv_gastos_v1';

var PADRAO = {
  pessoas: ['Eu', 'Parceiro(a)'],
  salarios: { 'Eu': 0, 'Parceiro(a)': 0 },
  meta_investimento: 4500,
  regras: [],
  senhas_pdf: [],
  lancamentos: []
};

var D = null;

function carregarDados(){
  if (D) return D;
  try {
    var s = localStorage.getItem(CHAVE);
    D = s ? JSON.parse(s) : JSON.parse(JSON.stringify(PADRAO));
  } catch (e){
    D = JSON.parse(JSON.stringify(PADRAO));
  }
  Object.keys(PADRAO).forEach(function(k){
    if (D[k] === undefined) D[k] = JSON.parse(JSON.stringify(PADRAO[k]));
  });
  migrar(D);
  return D;
}

/* Setores que deixaram de existir e para onde vai o que estava neles.
   Sem isto, lançamentos e regras apontariam para um setor que sumiu: eles
   somem da pizza sem aviso e a soma para de fechar. */
var RENOMEADOS = { 'Moradia': 'Outros' };

/* Regras antigas que apontam para um setor que na época era o único possível.
   Redemaga era Transporte porque Gasolina ainda não existia como setor. */
var CORRIGIR_REGRA = { 'redemaga': 'Gasolina', 'rede maga': 'Gasolina' };

function migrar(d){
  var mudou = false;
  (d.lancamentos || []).forEach(function(l){
    var novo = RENOMEADOS[l.setor];
    if (novo){ l.setor = novo; mudou = true; }
  });
  (d.regras || []).forEach(function(r){
    var novo = RENOMEADOS[r.setor];
    if (novo){ r.setor = novo; mudou = true; }
    var certo = CORRIGIR_REGRA[nrm(r.chave || '')];
    if (certo && r.setor !== certo){ r.setor = certo; mudou = true; }
  });
  return mudou;
}

function salvarDados(){
  try {
    localStorage.setItem(CHAVE, JSON.stringify(D));
    return true;
  } catch (e){
    alert('Não consegui salvar: o armazenamento do navegador encheu.\n\n' +
          'Exporte um backup agora, na aba Configurar, antes de continuar.');
    return false;
  }
}

/* identidade de um lançamento: data + descrição + valor.
   É o que impede a mesma fatura de entrar duas vezes. */
function idDe(l){
  var s = l.data + '|' + nrm(l.desc) + '|' + (+l.valor || 0).toFixed(2);
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36) + '-' + s.length.toString(36);
}

/* dono: a quem pertence a fatura que originou estes lançamentos.
   Sem isso tudo entrava como "Ambos" e era dividido meio a meio — o que está
   errado quando a fatura é do cartão de uma pessoa só. */
function adicionarLancamentos(novos, dono){
  var d = carregarDados();
  var existentes = {};
  d.lancamentos.forEach(function(l){ existentes[l.id] = 1; });
  var entraram = 0, repetidos = 0;
  novos.forEach(function(l){
    l.id = idDe(l);
    if (existentes[l.id]){ repetidos++; return; }
    existentes[l.id] = 1;
    if (!l.setor){
      var c = classificar(l.desc, d.regras);
      l.setor = c.setor; l.confianca = c.confianca;
    }
    if (!l.pessoa) l.pessoa = dono || 'Ambos';
    if (l.fixo === undefined) l.fixo = false;
    d.lancamentos.push(l);
    entraram++;
  });
  d.lancamentos.sort(function(a, b){
    return (a.data + a.desc) < (b.data + b.desc) ? -1 : 1;
  });
  salvarDados();
  return { novos: entraram, repetidos: repetidos };
}

/* ------------------------------------------------------------- resumo */

function resumoDoMes(mes){
  var d = carregarDados();
  mes = mes || new Date().toISOString().slice(0, 7);
  var ls = d.lancamentos.filter(function(l){
    return (l.data || '').indexOf(mes) === 0 && l.setor !== 'Não é despesa';
  });

  var total = ls.reduce(function(s, l){ return s + (+l.valor || 0); }, 0);
  var entrada = d.pessoas.reduce(function(s, p){ return s + (+d.salarios[p] || 0); }, 0);

  var setores = {};
  ls.forEach(function(l){
    var s = l.setor || 'A classificar';
    setores[s] = (setores[s] || 0) + (+l.valor || 0);
  });
  var porSetor = Object.keys(setores).map(function(k){
    return { setor: k, valor: setores[k], cor: corDoSetor(k),
             pct: total ? setores[k] / total * 100 : 0 };
  }).sort(function(a, b){ return b.valor - a.valor; });

  // gasto de "Ambos" divide meio a meio
  var porPessoa = {};
  d.pessoas.forEach(function(p){ porPessoa[p] = 0; });
  ls.forEach(function(l){
    var v = +l.valor || 0, p = l.pessoa || 'Ambos';
    if (p === 'Ambos' || porPessoa[p] === undefined)
      d.pessoas.forEach(function(q){ porPessoa[q] += v / d.pessoas.length; });
    else porPessoa[p] += v;
  });

  var sobra = entrada - total, meta = +d.meta_investimento || 0;
  return {
    mes: mes, entrada: entrada, saida: total, sobra: sobra, meta: meta,
    falta_meta: Math.max(0, meta - sobra),
    atingiu: sobra >= meta && meta > 0,
    por_setor: porSetor,
    por_pessoa: d.pessoas.map(function(p){ return { pessoa: p, valor: porPessoa[p] }; }),
    n: ls.length,
    fixos: ls.reduce(function(s, l){ return s + (l.fixo ? (+l.valor || 0) : 0); }, 0),
    a_classificar: ls.filter(function(l){ return l.setor === 'A classificar'; }).length,
    conferir: ls.filter(function(l){ return l.conferir; }).length
  };
}

function mesesDisponiveis(){
  var d = carregarDados(), s = {};
  d.lancamentos.forEach(function(l){ if (l.data) s[l.data.slice(0, 7)] = 1; });
  var hoje = new Date().toISOString().slice(0, 7);
  s[hoje] = 1;
  return Object.keys(s).sort();
}

function serieMensal(){
  var d = carregarDados(), pm = {};
  d.lancamentos.forEach(function(l){
    if (l.setor === 'Não é despesa') return;
    var m = (l.data || '').slice(0, 7);
    if (!m) return;
    if (!pm[m]) pm[m] = {};
    var s = l.setor || 'A classificar';
    pm[m][s] = (pm[m][s] || 0) + (+l.valor || 0);
  });
  return Object.keys(pm).sort().map(function(m){
    var tot = 0;
    Object.keys(pm[m]).forEach(function(k){ tot += pm[m][k]; });
    return { mes: m, total: tot, setores: pm[m] };
  });
}

/* --------------------------------------------------- edição e regras */

function reclassificarTodos(){
  var d = carregarDados(), n = 0;
  d.lancamentos.forEach(function(l){
    if (l.credito) return;
    var c = classificar(l.desc, d.regras);
    if (c.setor !== l.setor){ l.setor = c.setor; l.confianca = c.confianca; n++; }
  });
  salvarDados();
  return n;
}

function criarRegras(regras){
  var d = carregarDados();
  regras.forEach(function(r){
    var ch = nrm(r.chave);
    if (!ch || !r.setor) return;
    var achou = false;
    d.regras.forEach(function(x){ if (nrm(x.chave) === ch){ x.setor = r.setor; achou = true; } });
    if (!achou) d.regras.push({ chave: ch, setor: r.setor });
  });
  return reclassificarTodos();
}

/* ------------------------------------------------------------ backup */

function exportarBackup(){
  var d = carregarDados();
  var texto = JSON.stringify(d, null, 1);
  var nome = 'controle-gastos-' + new Date().toISOString().slice(0, 10) + '.json';
  var blob = new Blob([texto], { type: 'application/json' });

  // no iPhone o share sheet deixa salvar em Arquivos ou mandar por e-mail
  if (navigator.share && navigator.canShare &&
      navigator.canShare({ files: [new File([blob], nome, { type: 'application/json' })] })){
    navigator.share({ files: [new File([blob], nome, { type: 'application/json' })],
                      title: 'Backup do controle de gastos' })
      .catch(function(){ baixar(blob, nome); });
    return;
  }
  baixar(blob, nome);
}

function baixar(blob, nome){
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function importarBackup(texto){
  var novo = JSON.parse(texto);
  if (!novo || !Array.isArray(novo.lancamentos))
    throw new Error('esse arquivo não parece um backup do controle de gastos');
  D = novo;
  Object.keys(PADRAO).forEach(function(k){
    if (D[k] === undefined) D[k] = JSON.parse(JSON.stringify(PADRAO[k]));
  });
  migrar(D);                       // backup antigo pode trazer setores que sumiram
  salvarDados();
  return D.lancamentos.length;
}

/* Atribui uma pessoa a vários lançamentos de uma vez.
   Serve para corrigir em bloco o que já entrou dividido. */
function atribuirPessoa(ids, pessoa){
  var d = carregarDados(), n = 0, alvo = {};
  ids.forEach(function(i){ alvo[i] = 1; });
  d.lancamentos.forEach(function(l){
    if (alvo[l.id] && l.pessoa !== pessoa){ l.pessoa = pessoa; n++; }
  });
  salvarDados();
  return n;
}

/* Renomear preserva os valores: a chave de salário acompanha o nome,
   e cada lançamento marcado com a pessoa antiga passa a apontar para a nova. */
function renomearPessoa(i, nome){
  var d = carregarDados();
  nome = (nome || '').trim();
  if (!nome || nome === d.pessoas[i]) return false;
  var antigo = d.pessoas[i];
  d.salarios[nome] = d.salarios[antigo] || 0;
  delete d.salarios[antigo];
  d.pessoas[i] = nome;
  d.lancamentos.forEach(function(l){ if (l.pessoa === antigo) l.pessoa = nome; });
  salvarDados();
  return true;
}

function apagarTudo(){
  D = JSON.parse(JSON.stringify(PADRAO));
  salvarDados();
}
