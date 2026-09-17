# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS puro, sem framework e sem build step — constraint rígido, não uma escolha aberta: a página precisa continuar integrando diretamente com Supabase Edge Functions (cadastro-advogado, criar-cobranca), o widget Cloudflare Turnstile, e é hospedada no GitHub Pages (repo `astrajus-cadastro`, domínio www.astrajus.com.br).

## Users

Advogados brasileiros, sem perfil de porte específico (autônomo/solo ou escritório pequeno/médio) — o produto serve qualquer advogado que queira gravar vídeos de captação de cliente sem precisar pesquisar/escrever o roteiro sozinho.

## Product Purpose

Astra Just gera roteiros de vídeo de marketing jurídico automaticamente, personalizados por área de atuação, a partir de notícias e julgados reais (STJ, LawLetter/Migalhas). O advogado assina, escolhe as áreas, e recebe roteiros prontos pra gravar — sem precisar pesquisar ou escrever o conteúdo.

## Positioning

O sistema nasceu da própria experiência do fundador (advogado) usando IA manualmente pra roteirizar notícias jurídicas — Astra Just automatiza esse processo pra outros advogados. Diferencial: conteúdo gerado a partir de fontes jurídicas reais e personalizado por área de atuação, não conteúdo genérico de agência de social media.

## Operating Context

Fluxo: cadastro (dados pessoais + CPF + OAB) → seleção de área(s) de atuação → escolha de forma de pagamento (Pix Automático recorrente ou cartão de crédito via Asaas Checkout) → assinatura ativa após confirmação de pagamento → revisão de OAB pelo fundador em até 24h após o pagamento (aprovação automática no cadastro, revisão manual pós-pagamento pra não perder vendas).

## Capabilities and Constraints

- LGPD: checkbox de consentimento obrigatório (Lei 13.709/2018).
- Cloudflare Turnstile obrigatório no formulário (anti-bot).
- Validação de CPF (dígito verificador) e formato de OAB no cliente e servidor.
- Preço: R$147 (1 área), R$47/área adicional, R$397 pacote completo (10 áreas) — nunca cobra mais que o pacote fechado.
- Direito de arrependimento de 7 dias (CDC art. 49) — estorno automático via API em caso de reprovação de OAB ou pedido voluntário.
- Sem tokenização de cartão própria — cartão de crédito sempre via página hospedada do Asaas (Asaas Checkout), nunca coleta dado de cartão no nosso HTML.

## Brand Commitments

Nome: Astra Just. Domínio: astrajus.com.br.

## Evidence on Hand

Sem prova social externa ainda (pré-lançamento, sem clientes pagantes até o momento). O próprio fundador (Samuel, advogado) já usa o processo manualmente (IA pra roteirizar notícias jurídicas) — é a origem do produto, mas não é um caso de cliente terceiro comprovado. Não inventar depoimentos, números de clientes, ou resultados de terceiros.

## Product Principles

1. Confiança apesar de zero prova social — a página precisa se apoiar em transparência sobre como funciona, garantia legal (CDC 7 dias), e credibilidade profissional do fundador como advogado, não em depoimentos que ainda não existem.
2. Público é advogado — profissional, criterioso, sensível a linguagem que pareça "vendedor genérico" ou juridicamente incorreta.
3. Custo zero/quase zero em toda decisão técnica (sem servidor pago, sem serviço de assinatura novo além do estritamente necessário).
4. Funcionalidade já validada não pode regredir — formulário, validações de CPF/OAB, LGPD, Turnstile e a integração com as Edge Functions continuam funcionando exatamente como hoje.
