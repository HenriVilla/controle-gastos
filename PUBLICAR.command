#!/bin/bash
# Prepara ESTA pasta para ir ao GitHub e virar app no iPhone.
#
# Trava de seguranca: so roda se estiver dentro de Financas-iPhone e se
# nenhum arquivo com dado pessoal estiver junto. A pasta de cima tem IRPF,
# CPF e saldos — subir a pasta errada seria irreversivel.

cd "$(dirname "$0")" || exit 1
P="$(pwd)"
USUARIO="HenriVilla"
REPO="controle-gastos"
clear
echo ""
echo "  ============================================"
echo "   PUBLICAR O APP NO GITHUB"
echo "  ============================================"
echo ""

pausa(){ echo ""; read -n 1 -s -r -p "  Pressione qualquer tecla para fechar."; echo ""; exit ${1:-0}; }

# --- 1. estou na pasta certa? ---
case "$P" in
  */Financas-iPhone) : ;;
  *) echo "  ERRO: este script so pode rodar dentro de Financas-iPhone."
     echo "  Pasta atual: $P"
     pausa 1 ;;
esac
echo "  pasta: $P"

# --- 2. tem git? ---
if ! command -v git >/dev/null 2>&1; then
  echo ""
  echo "  ERRO: git nao encontrado. Instale rodando no Terminal:"
  echo "     xcode-select --install"
  pausa 1
fi
echo "  git:   $(git --version)"

# --- 3. varredura de dado pessoal ---
echo ""
echo "  Conferindo se nao ha dado pessoal nesta pasta..."
RISCO=0

for f in dados.json *.pdf *.xlsx *.csv backup*.json controle-gastos-*.json; do
  [ -e "$f" ] || continue
  echo "     RISCO: $f nao pode ir para um repositorio publico"
  RISCO=1
done

# CPF (11 digitos soltos ou formatado) em qualquer arquivo de texto
# CPF formatado, ou 11 digitos seguidos que nao sejam todos iguais
# (00000000000 e 11111111111 sao placeholder, nao documento)
CPF_RE='[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|\b[0-9]{11}\b'
ACHADOS=$(grep -rhoE "$CPF_RE" --include=*.js --include=*.html --include=*.json --include=*.md . 2>/dev/null \
          | grep -vE '^([0-9])\1{10}$' | sort -u)
if [ -n "$ACHADOS" ]; then
  echo "     RISCO: encontrei algo com cara de CPF:"
  echo "$ACHADOS" | sed 's/^/        /'
  echo "     nos arquivos:"
  grep -rlE "$CPF_RE" --include=*.js --include=*.html --include=*.json --include=*.md . 2>/dev/null | sed 's/^/        /'
  RISCO=1
fi

if [ "$RISCO" = "1" ]; then
  echo ""
  echo "  PAREI AQUI. Tire esses arquivos da pasta antes de publicar."
  echo "  O que vai para o GitHub fica publico e nao da para desfazer direito:"
  echo "  mesmo apagando depois, o historico guarda."
  pausa 1
fi
echo "     nada de pessoal encontrado — so codigo."

# --- 4. git local ---
echo ""
if [ ! -d .git ]; then
  git init -q
  git branch -M main 2>/dev/null
  echo "  repositorio criado"
else
  echo "  repositorio ja existia"
fi

git add -A
if git diff --cached --quiet 2>/dev/null; then
  echo "  nada mudou desde o ultimo envio"
else
  git -c user.email="${GIT_EMAIL:-eu@exemplo.com}" \
      -c user.name="${GIT_NAME:-Controle de gastos}" \
      commit -q -m "Controle de gastos — app do iPhone ($(date +%d/%m/%Y))"
  echo "  alteracoes registradas"
fi

# --- 5. remoto e envio, sem voce colar nada ---
DESTINO="https://github.com/$USUARIO/$REPO.git"
ATUAL=$(git remote get-url origin 2>/dev/null)

if [ -z "$ATUAL" ]; then
  git remote add origin "$DESTINO"
  echo "  destino configurado: $USUARIO/$REPO"
elif [ "$ATUAL" != "$DESTINO" ]; then
  echo "  destino estava em: $ATUAL"
  git remote set-url origin "$DESTINO"
  echo "  corrigido para:    $USUARIO/$REPO"
else
  echo "  destino: $USUARIO/$REPO"
fi

# garante que existe o ramo main com pelo menos um commit
git branch -M main 2>/dev/null
if ! git rev-parse --verify main >/dev/null 2>&1; then
  echo ""
  echo "  ERRO: nenhum commit foi criado. Rode este script de novo."
  pausa 1
fi

echo ""
echo "  ============================================"
echo "   ENVIANDO PARA O GITHUB"
echo "  ============================================"
echo ""
echo "  Se pedir credenciais:"
echo "     Username: $USUARIO"
echo "     Password: o TOKEN (nao a senha da conta)"
echo "               https://github.com/settings/tokens"
echo "               Generate new token (classic) -> marque 'repo'"
echo ""

if git push -u origin main; then
  echo ""
  echo "  ============================================"
  echo "   PRONTO"
  echo "  ============================================"
  echo ""
  echo "  Agora ligue o GitHub Pages, uma vez so:"
  echo "     https://github.com/$USUARIO/$REPO/settings/pages"
  echo "     Source: Deploy from a branch"
  echo "     Branch: main    Pasta: / (root)    -> Save"
  echo ""
  echo "  Em ate 2 minutos o app fica de pe em:"
  echo ""
  echo "     https://$USUARIO.github.io/$REPO/"
  echo ""
  echo "  No IPHONE: abra esse endereco no SAFARI,"
  echo "  toque em Compartilhar -> Adicionar a Tela de Inicio."
  echo ""
  echo "  Da proxima vez, so clicar neste arquivo de novo."
else
  echo ""
  echo "  ============================================"
  echo "   O ENVIO FALHOU"
  echo "  ============================================"
  echo ""
  echo "  As duas causas comuns:"
  echo ""
  echo "  1) O repositorio ainda nao existe no GitHub."
  echo "     Crie em: https://github.com/new"
  echo "     Nome: $REPO   Visibilidade: Public"
  echo "     NAO marque 'Add a README' nem nenhuma outra opcao."
  echo ""
  echo "  2) Autenticacao. O GitHub nao aceita mais a senha da conta."
  echo "     Use um TOKEN em https://github.com/settings/tokens"
  echo "     (Generate new token classic, marque 'repo')"
  echo ""
  echo "  Resolva e clique neste arquivo de novo."
fi
echo "  ============================================"
pausa
