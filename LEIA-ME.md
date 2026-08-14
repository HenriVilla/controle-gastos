# Controle de gastos — versão iPhone

A mesma ferramenta, rodando **inteira dentro do iPhone**. Sem Mac ligado, sem servidor, sem certificado, sem validade de 7 dias.

---

## Por que não é um IPA

O iOS não roda Python nem mantém servidor em segundo plano. Um IPA só conseguiria abrir uma janela apontando para o seu Mac — continuaria dependendo dele ligado e na mesma rede, **e ainda** exigiria reassinar o certificado toda semana com Apple ID grátis, ou US$ 99/ano com conta paga.

Então em vez de empacotar, foi reescrito: os leitores de PDF e o classificador viraram JavaScript, o `pypdf` virou `pdf.js`, e o `dados.json` virou armazenamento do próprio aparelho. O resultado é um ícone na tela de início que abre em tela cheia e funciona offline.

---

## Como instalar no iPhone

O app precisa de um endereço para o iOS conseguir guardá-lo. Duas opções:

### Publicar como site estático (recomendado)

Suba esta pasta em qualquer hospedagem estática gratuita — GitHub Pages, Netlify, Cloudflare Pages. Depois, no iPhone:

1. Abra o endereço no **Safari** (precisa ser Safari; o Chrome no iOS não instala na tela de início)
2. Toque em **Compartilhar** → **Adicionar à Tela de Início**
3. Abra pelo ícone

Funciona em qualquer lugar, com ou sem internet, com ou sem o Mac ligado.

> **O que fica público é só o programa, nunca os seus dados.** Estes arquivos são código puro. Os lançamentos, salários e senhas ficam no armazenamento do seu iPhone e não passam por servidor nenhum.

### Testar antes, pelo Mac

Com o Mac ligado e na mesma rede, sirva a pasta e abra pelo IP do Mac. Serve para experimentar antes de decidir publicar, mas não é o modo definitivo — depende do Mac.

---

## Como usar

1. No app do banco, baixe a fatura em PDF: **Compartilhar → Salvar em Arquivos**
2. No app, aba **Importar** → **Escolher PDFs** (pode mandar vários de uma vez)
3. Na aba **Lançamentos**, classifique o que ficou sem setor

**Reimportar não duplica — e não perde.** O controle compara *quantidade*, não presença: conta quantas cópias de cada lançamento o arquivo traz e quantas a base já tem, e insere só a diferença. Assim a mesma fatura pode ser lida quantas vezes for, e três compras legítimas iguais no mesmo dia entram as três.

---

## O que mudou em relação à versão do Mac

| | Mac | iPhone |
|---|---|---|
| Leitura de PDF | pypdf | pdf.js, no navegador |
| Onde ficam os dados | `dados.json` no disco | armazenamento do aparelho |
| PDF com senha | sim | sim |
| Ler foto/print | com OCR instalado | **não** — só PDF com texto |
| Pasta vigiada | sim, `faturas/` | não — você escolhe os arquivos |

**Sem OCR no iPhone.** Foto e print de comprovante não são lidos; use a entrada manual. Era o caminho menos confiável de qualquer forma — OCR troca dígito em valor sem avisar.

---

## Backup não é opcional aqui

O iOS pode limpar o armazenamento de apps pouco usados. Um app na tela de início é bem mais protegido que uma aba do Safari, mas a garantia de verdade é o arquivo.

Na aba **Configurar**, **Exportar backup** abre o menu de compartilhamento do iPhone — salve no Arquivos ou no iCloud. **Importar backup** restaura.

O formato é o mesmo `dados.json` da versão do Mac: dá para levar os dados de um lado para o outro sem conversão.

---

## Como sei que os números batem

Reescrever código é onde erro silencioso nasce. Então nada foi aceito por parecer certo:

| Verificação | Resultado |
|---|---|
| Classificador JS × Python, nos 738 lançamentos reais | **0 divergências** |
| Leitores JS × Python, nos 19 PDFs reais | **19 de 19 idênticos** |
| Conferência contra o total impresso na fatura | **15 de 15 fecham no centavo** |
| Resumo mensal JS × Python (mai a ago/2026) | **0 divergências** em valor, setor e pessoa |
| Série mensal dos 16 meses | **idêntica** |

O `categorias.js` é **gerado a partir do `categorias.py`**, não copiado à mão — as duas versões não têm como divergir no dicionário.

---

## Arquivos

| | |
|---|---|
| `index.html` | o app inteiro: telas e lógica de tela |
| `categorias.js` | dicionário de setores, gerado do Python |
| `leitor.js` | leitores de fatura, conta e boleto |
| `pdf.js` | extração de texto do PDF via pdf.js |
| `dados.js` | armazenamento local, resumo e backup |
| `sw.js` | guarda o app no aparelho para abrir offline |
| `manifest.webmanifest` | nome e ícone na tela de início |

A biblioteca pdf.js vem de CDN na primeira abertura e fica guardada no aparelho. Depois disso o app abre sem internet.

---

## O que ainda não faz

- **Não sincroniza com o Mac.** Os dois guardam dados separados. A ponte é exportar de um e importar no outro.
- **Não lê foto.** Sem OCR no iPhone.
- **Não puxa fatura sozinho.** Você baixa o PDF e escolhe no app.

---

> Ferramenta de apoio pessoal. Os números vêm dos seus próprios arquivos; confira contra a fatura antes de decidir com base neles.
