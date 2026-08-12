#!/bin/bash
# Prepara ESTA pasta para ir ao GitHub e virar app no iPhone.
#
# Trava de seguranca: so roda se estiver dentro de Financas-iPhone e se
# nenhum arquivo com dado pessoal estiver junto. A pasta de cima tem IRPF,
# CPF e saldos — subir a pasta errada seria irreversivel.

cd "$(dirname "$0")" || exit 1
P="$(pwd)"
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

REMOTO=$(git remote get-url origin 2>/dev/null)

echo ""
echo "  ============================================"
if [ -z "$REMOTO" ]; then
  echo "   FALTA SO O GITHUB — 3 passos"
  echo "  ============================================"
  echo ""
  echo "  1. Crie a conta e o repositorio"
  echo "     Abra  https://github.com/new"
  echo "     Nome:      controle-gastos"
  echo "     Visibilidade: Public"
  echo "     NAO marque nenhuma opcao de 'Add a README'"
  echo ""
  echo "  2. Volte aqui e rode, trocando SEU-USUARIO:"
  echo ""
  echo "     cd \"$P\""
  echo "     git remote add origin https://github.com/SEU-USUARIO/controle-gastos.git"
  echo "     git push -u origin main"
  echo ""
  echo "     Ele vai pedir usuario e senha. A senha NAO e a da conta:"
  echo "     e um token. Gere em  https://github.com/settings/tokens"
  echo "     -> Generate new token (classic) -> marque 'repo' -> copie."
  echo ""
  echo "  3. Ligue o GitHub Pages"
  echo "     No repositorio: Settings -> Pages"
  echo "     Source: Deploy from a branch"
  echo "     Branch: main   Pasta: / (root)   -> Save"
  echo ""
  echo "     Em ate 2 minutos o endereco fica de pe:"
  echo "     https://SEU-USUARIO.github.io/controle-gastos/"
  echo ""
  echo "  4. No IPHONE, abra esse endereco no SAFARI"
  echo "     Compartilhar -> Adicionar a Tela de Inicio"
else
  echo "   ENVIANDO PARA O GITHUB"
  echo "  ============================================"
  echo ""
  echo "  destino: $REMOTO"
  echo ""
  if git push -u origin main; then
    echo ""
    echo "  Enviado. O GitHub Pages atualiza em ate 2 minutos."
    U=$(echo "$REMOTO" | sed -E 's#.*github.com[:/]([^/]+)/([^/.]+)(\.git)?#https://\1.github.io/\2/#')
    echo "  Endereco: $U"
  else
    echo ""
    echo "  O envio falhou. Se pediu senha: use um TOKEN, nao a senha da conta."
    echo "  Gere em https://github.com/settings/tokens (classic, marque 'repo')."
  fi
fi
echo "  ============================================"
pausa
