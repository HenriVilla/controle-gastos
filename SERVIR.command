#!/bin/bash
# Serve esta pasta para voce testar o app no iPhone antes de publicar.
# O iPhone precisa estar na MESMA rede Wi-Fi do Mac.

cd "$(dirname "$0")" || exit 1
PORTA=5063
clear
echo ""
echo "  ============================================"
echo "   CONTROLE DE GASTOS — TESTE NO IPHONE"
echo "  ============================================"
echo ""

PY="$(command -v python3)"
[ -z "$PY" ] && { echo "  ERRO: python3 nao encontrado (xcode-select --install)"; read -n1; exit 1; }

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
[ -z "$IP" ] && IP="<ip-do-seu-mac>"

ANTIGO=$(lsof -ti tcp:$PORTA 2>/dev/null)
[ -n "$ANTIGO" ] && { kill $ANTIGO 2>/dev/null; sleep 1; }

echo "  No Mac:     http://127.0.0.1:$PORTA"
echo ""
echo "  NO IPHONE, abra no SAFARI:"
echo ""
echo "      http://$IP:$PORTA"
echo ""
echo "  Depois: Compartilhar -> Adicionar a Tela de Inicio"
echo ""
echo "  ATENCAO: assim o app so funciona com este Terminal aberto"
echo "  e o iPhone na mesma rede. Para usar em qualquer lugar,"
echo "  publique a pasta (ver LEIA-ME.md)."
echo "  ============================================"
echo ""

"$PY" -m http.server $PORTA --bind 0.0.0.0
