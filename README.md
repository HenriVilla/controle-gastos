# Controle de gastos

App de finanças pessoais que lê faturas de cartão, boletos e contas de serviço em PDF, separa os gastos por setor e mostra para onde o dinheiro está indo.

**Roda inteiro no navegador.** Não há servidor, não há nuvem, não há conta. Os PDFs são lidos na memória do próprio aparelho e os dados ficam no armazenamento local — nada sai do dispositivo.

## Instalar no iPhone

Abra o endereço no **Safari** → Compartilhar → **Adicionar à Tela de Início**. Vira um ícone que abre em tela cheia e funciona offline.

## O que lê

| Formato | Como |
|---|---|
| Fatura Nubank | layout reconhecido linha a linha, com conferência contra o total impresso na própria fatura |
| Extrato Caixa | só os débitos; crédito não é despesa |
| Contas de serviço | Vivo, Claro, TIM, Oi, Cemig, CPFL, Enel, Copasa, Sabesp, NIO |
| Boleto | valor e vencimento saem da linha digitável, padrão Febraban |
| PDF protegido | senha configurável (operadoras costumam usar o CPF) |

**Nada é inventado.** Linha que não bate com um padrão conhecido é descartada e listada como não lida. Faltar um lançamento é visível ao conferir com a fatura; um valor errado passa despercebido.

## Conferência

Faturas de cartão trazem o próprio total de compras. O leitor soma o que extraiu e compara. Se bater no centavo, a leitura está completa — e a diferença, quando existe, aparece no relatório.

## Arquivos

| | |
|---|---|
| `index.html` | telas e lógica de interface |
| `categorias.js` | dicionário de setores |
| `leitor.js` | leitores de fatura, conta e boleto |
| `pdf.js` | extração de texto via pdf.js |
| `dados.js` | armazenamento local, resumo e backup |
| `sw.js` | cache para funcionar offline |

## Privacidade

Este repositório contém **apenas código**. Nenhum dado financeiro, nome, documento ou senha está aqui — tudo isso vive no armazenamento local do dispositivo de quem usa.
