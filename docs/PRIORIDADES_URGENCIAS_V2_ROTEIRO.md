# Prioridades e Urgências — versão nova (v2): roteiro de trabalho

Documento vivo para quem continuar o trabalho (pessoa ou sessão de IA). Atualizado em 22/11/2026.

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

Tela **ainda com o visual da v1** (exibida dentro da moldura nova, via `PrioridadesContent`):
Designações.

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

## Próximos passos

### Etapa 1 (restante)

1. Redesenhar Designações (a maior tela da v1: 879 linhas).
2. O Celso testa os perfis Atendente e UPJ (e Configurações/Log com o Gestor).

### Etapa 2 (a discutir com o Celso; ele tem uma lista própria)

- Localização de processos com Datajud + DJEN (resolvedor do protótipo, numa Edge Function,
  com a chave do Datajud como secret). Caso real: `4189868-12.2026.8.26.0100` tem final
  `.0100`, mas hoje está na UPJ do Foro Regional de Santo Amaro, e a v1 aceita.
- Campo "Descrição Resumida" (coluna nova).
- `prioridades_conferir` grava `conferido_por_id` mas não `conferido_por_nome`.
- Observação da UPJ: a maquete a chama de "Informação a ser repassada ao Solicitante";
  na v1 era "uso interno da UPJ". Confirmar quem pode ver.

### Etapa 3

Backup novo da produção → aplicar as migrations da branch na produção → push da branch →
Pull Request → aprovação → merge (publica) → dar a permissão do card v2 aos testadores
pelo Boss Only → período de teste → trocar os cards → aposentar a v1.
