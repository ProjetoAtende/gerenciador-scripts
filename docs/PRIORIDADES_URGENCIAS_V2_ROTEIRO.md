# Prioridades e Urgências — versão nova (v2): roteiro de trabalho

Documento vivo para quem continuar o trabalho (pessoa ou sessão de IA). Atualizado em 22/11/2026
(etapa 2 implementada).

## Objetivo

Levar o app a todas as UPJs, em três etapas:

1. **Interface nova** a partir das maquetes do Celso (Penpot), para usuários com pouca
   familiaridade com aplicativos.
2. **Funcionalidades novas e correções**, com destaque para a localização de processos
   mais robusta (Datajud + DJEN, protótipo em `chatbot/prioridades/prototipo-validacao`).
3. **Publicação** da v2 como card próprio, mantendo a v1 como backup até a troca.

## Regras do projeto (não negociáveis)

- **Nunca trabalhar na `main`**: um push nela publica o site na hora (GitHub Actions → Pages).
  Tudo vai na branch `prioridades-v2` e só entra na `main` por Pull Request aprovado pelo
  Celso ou pelo David.
- **A v1 não é alterada.** A v2 mora em `src/components/prioridades-v2/` e reaproveita
  serviços, tipos e RPCs da v1.
- **Mesmo banco para v1 e v2**: migrations da v2 são **somente aditivas** e com `GRANT`
  explícito (projetos Supabase novos não dão mais permissões automáticas a
  anon/authenticated/service_role; a produção, antiga, ainda dá).
- **Banco de testes primeiro**: toda mudança de banco é aplicada antes no projeto de testes.
  A produção só é tocada na etapa 3, com autorização expressa e backup novo antes.
- **Pacotes npm com `npx npm@10 install ...`**: o npm 11 poda dependências opcionais do
  `package-lock.json` e o deploy usa npm 10.

## Estado atual (etapa 1)

Commits na branch `prioridades-v2`:

| Commit | Conteúdo |
|---|---|
| `6e316d4` | Moldura (barra superior, painel lateral, fundo), tela inicial, Nova Anotação, card na Home, migration da permissão do card, scripts de teste |
| `89a8377` | Listas (filtro, cartões) e detalhe da anotação com os painéis de cada perfil |

Terceiro commit: Histórico Geral (reaproveita a lista, em ordem cronológica, com "Só as que eu
anotei" para Gestor e Conferente), Log de Acessos, Configurações e Créditos (página do painel,
aberta pelo Painel de Controle; nomes definidos pelo Celso em 22/11/2026, com "Testado e
Aprimorado por" sempre em ordem alfabética). Entram também os ajustes pedidos por ele:
- barra de rolagem do menu à esquerda;
- n.º da anotação no canto inferior direito do cartão;
- "Processo localizado!" centralizado;
- logotipo do menu leva à tela inicial;
- na área Processo, UPJ, Vara e Plataforma numa linha;
- na área Prioridade, um item por linha;
- logotipos Eproc/SAJ em vetor (`assets/logo-*.svg`, cor = `currentColor`). O Eproc foi
  extraído da palavra do SVG do seeklogo, e o SAJ é a versão nova enviada pelo Celso.

Quarto commit: **Designações** no visual novo (`DesignacoesV2.tsx`). Tem interruptor de
vinculação automática, pílulas de categorias por Analista, busca de pessoas e o alternador
designação/perfil permanente, com as regras da v1. Com isso, **todas as telas estão no visual
novo**. O `PrioridadesContent` da v1 só é usado como reserva, para uma tela desconhecida.

### Arquivos da v2

| Arquivo | Papel |
|---|---|
| `PrioridadesV2Modal.tsx` | Moldura, roteamento das telas, carga das anotações, regra de abertura (modo do detalhe) |
| `usePrioridadesV2.ts` | Estado (perfil, contadores, tela); cópia da lógica da v1 com sessão própria |
| `prioridadesV2Sessao.ts` | Sessão `atende.prioridades.v2.sessao` (a v1 usa outra chave) |
| `PainelLateralV2.tsx` | Menu por perfil: faixas Atendentes / UPJs / Painel de Controle |
| `TelaInicialV2.tsx` | Saudação, botão grande e resumo clicável |
| `NovaAnotacaoV2.tsx` | Formulário (regras da v1 + correção da consulta automática aos 20 dígitos) |
| `ListaAnotacoesV2.tsx` | Filtro e cartões |
| `DetalheAnotacaoV2.tsx` | Caixas + painéis: análise UPJ, conferência, resposta, correção |
| `EtiquetasV2.tsx`, `Icone.tsx`, `icones.ts` (gerado) | Etiquetas e ícones embutidos |
| `prioridadesV2Rotulos.ts` | UPJ em romanos, faixas de Varas, siglas e ícones de categoria |
| `prioridadesV2.css` | Todo o visual, sob a classe `.pu2` |

### Decisões de design (aprovadas pelo Celso)

- Fonte Montserrat. Texto `#1E1E1E`, primária `#A11116`, cinza `#5B5A5A`, Nova `#B8620F`,
  Ag. Conferência `#2B7A8C`, texto de exemplo nos campos `#767676`.
- Painel lateral: malha radial + reflexo vinho ("opção D"). Urgentíssima: gradiente
  vermelho → carmim. Reiterada: gradiente framboesa.
  Prévia: `chatbot/prioridades-e-urgencias/prototipos/paleta-e-gradientes.html`.
- Ícones: conjuntos do Iconify do guia das maquetes; Resolvidas, Rejeitadas e Reiteradas
  vêm do Penpot. Ver `scripts/prioridades-v2/README.md`.
- Extrapolações feitas: a UPJ não vê o botão Nova Anotação (o servidor não deixa a UPJ
  criar); o perfil aparece em forma neutra ("Coordenador(a)"); as urgentíssimas aparecem
  primeiro nas listas; a UPJ não vê o histórico nem as observações internas do TJSP Atende.

## Ambiente de testes

- Projeto Supabase de testes: `utjkliwzwmifejqysmsy` (região São Paulo; a DJEN bloqueia
  IP estrangeiro). O repositório local está ligado a ele (`supabase link`).
- `.env` (ignorado pelo Git) aponta o app local para o projeto de testes.
- Dados fictícios: `node scripts/prioridades-v2/seed-testes.mjs`. Usuários
  `*.teste@example.com`; senhas em `.env.usuarios-teste` (ignorado pelo Git).
- App local: `npm run dev` → `http://localhost:5173/gerenciador-scripts/`.
- O login no app é feito pelo Celso (a IA não digita senhas).
- Backup da produção: script `Tribunal Atende/backups-supabase/backup-producao.ps1`,
  fora do repositório (os arquivos têm dados pessoais e de login).

### Demonstração em arquivo único (sem servidor)

Para mostrar v1 e v2 num computador sem permissão de administrador (ex.: do TJSP):
`npm run build:demo` gera `dist-demo/demonstracao-gerenciador.html` (~6 MB), com o app inteiro
(JavaScript, CSS, imagens e fontes) dentro do HTML. Basta copiar o arquivo e abri-lo com dois
cliques no Edge ou Chrome; o login é o dos usuários de teste.

- Configuração separada (`vite.demo.config.ts` + `vite-plugins/arquivoUnicoDemo.ts`); o build
  de produção e o deploy não mudam.
- Só gera se o `.env` apontar para o projeto de **testes**; leva apenas a chave pública (anon).
- Mostra a faixa "DEMONSTRAÇÃO · banco de testes · dados fictícios" no canto da tela.
- Funciona porque o app usa HashRouter e o banco de testes não restringe origens
  (sem `ALLOWED_ORIGINS`). Páginas abertas do disco enviam `Origin: null`: se um dia
  `ALLOWED_ORIGINS` for definido nos testes, a localização deixa de funcionar no arquivo.
- Testado em 23/11/2026, com o arquivo aberto do disco no Edge: tela de login, imagens e acesso
  ao Supabase e às Edge Functions OK. O Celso entrou com um usuário de teste e usou o app.

## Próximos passos

### Etapa 1 (restante)

Concluída, faltando só os testes:
1. O Celso testa os perfis Atendente e UPJ (e Configurações/Log com o Gestor).

### Etapa 2 — implementada e testada no banco de TESTES (aguarda o teste do Celso e o commit)

Lista do Celso (22/11/2026), por ordem de importância, com as decisões tomadas:

| Item | O que mudou | Decisão |
|---|---|---|
| **A** Localização | Edge Function `prioridades-localizar` (Datajud + DJEN, chave do Datajud no secret `DATAJUD_API_KEY`). DJEN na hora; Datajud em segundo plano só quando a Vara é desconhecida; a Vara e o Sistema se completam sozinhos. Enviada antes do Datajud, o servidor completa depois (`modo: 'completar'` + `prioridades_v2_completar_vara`, só Vara vazia, só quem criou). Fim do "fallback" para a 1.ª Vara da faixa. | Vara desconhecida: **opcional** para o Atendente (5 Varas da UPJ + "Não sei"); a UPJ vê "Vara a confirmar". |
| **A/C** Competência | Decidida pelo órgão onde o processo está **hoje** (publicação de 1.º grau mais recente da DJEN; sem ela, o Datajud). O final 0100 só decide quando nenhuma fonte sabe. `4189868-…0100` (Santo Amaro) → fora; `4000525-…0373` e `4023574-…0011` (UPJ IX) → dentro. | Aprovado. |
| **C** Exceção | Fora da competência, só o **Gestor** envia, com **justificativa obrigatória** (coluna `competencia_excecao` + histórico `excecao_competencia`) e UPJ escolhida à mão. | Justificativa obrigatória. |
| **D** Urgentíssima | Gestor marca ao criar. | — |
| **E** Anteriores | Aviso dos 120 dias mostra, por anotação, a resposta da UPJ (ou o motivo da reprovação do Gestor) em destaque, com botão **Copiar** (`prioridades_v2_anteriores`). | Inclui o motivo do Gestor (não vai para a UPJ). |
| **F** Regras especiais | Por UPJ + **Categoria** (uma ou "Todas") + Tipo, na tabela nova `prioridades_regras_especiais_v2` (as atuais copiadas como "Todas"). | A v1 continua com a tabela antiga até ser aposentada (as duas não se sincronizam). |
| **G** Descrição Resumida | Coluna `descricao_resumida` (até 100), **opcional**; aparece abaixo do tipo nos cartões e no detalhe; Gestor/Conferente preenchem na conferência. | Não obrigatória (o Atendente foca na detalhada). |
| **H** Conferido por | Gatilho grava `conferido_por_nome` (vale para v1 e v2) + nomes antigos preenchidos. | — |
| **I** Observação da UPJ | Visível a todos, como "Informação a ser repassada ao Solicitante". | — |
| **J/K/L** Tipos | "Possível erro material em peça processual"; "Consta "URGENTE" OU "IMEDIATO" na determinação" (avisos acompanham); novo "Tramitação prioritária – Perito" (sem aviso por ora). Valem também para a v1. | — |
| **M** Tela inicial | UPJ: Urgentíssimas, Reiteradas, Novas (ordem do painel). | — |
| **N** Conferência | Gestor/Conferente alteram todos os campos do Atendente (Solicitante, Tipo, Categoria, Sistema, Vara, Evento, Descrições, Observação), menos o número do processo; alterações em texto legível no histórico (`prioridades_v2_conferir`). | Número do processo errado: devolver ou reprovar. |
| **B** Designações | Coordenador vê o formulário e designa Analistas; `prioridades_v2_designar` trava a UPJ dele no servidor (a função da v1 aceitava qualquer UPJ vinda do navegador). | Aprovado. |

Arquivos novos: `supabase/functions/_shared/localizador.ts` (regras, testadas no Vitest),
`_shared/fontes.ts` (consultas), `functions/prioridades-localizar/`,
`src/services/prioridadesV2Service.ts`, migration `20261123100000_prioridades_v2_etapa2.sql`,
`scripts/prioridades-v2/teste-etapa2.sql` (13 grupos de teste no banco, com rollback) e
`scripts/prioridades-v2/localizar-ao-vivo.mjs` (localizador contra DJEN/Datajud reais).

Observações da etapa 2:
- **Datajud instável**: em 22/11/2026 respondeu HTTP 504 após 60 s em todos os testes (o
  problema é do servidor do CNJ; a chave funciona). O app segue só com a DJEN e deixa a
  Vara "a confirmar". Desde ago/2026 o Datajud também não tem os processos novos do Eproc do
  Foro Central (lacuna de remessa do TJSP).
- O `djen-proxy` pedia só 5 publicações; a função nova pede 100 (a mais recente podia ficar de fora).
- Etapa 3, produção: além das migrations, **publicar a Edge Function** `prioridades-localizar`
  e criar o secret `DATAJUD_API_KEY` (e `ALLOWED_ORIGINS`, como no `djen-proxy`).

### Etapa 3

Backup novo da produção → aplicar as migrations da branch na produção → publicar a Edge
Function `prioridades-localizar` com os secrets → push da branch →
Pull Request → aprovação → merge (publica) → dar a permissão do card v2 aos testadores
pelo Boss Only → período de teste → trocar os cards → aposentar a v1.
