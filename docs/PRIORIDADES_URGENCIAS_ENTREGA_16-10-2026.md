# Prioridades e Urgências — entrega 16/10/2026

Documento de fechamento das correções alinhadas às respostas da área (15/10/2026),
ao reteste Grokbot PC-01–PC-06 e à confirmação sobre sequencial CNJ (aceitar qualquer
dígito inicial; inferir Eproc apenas em 4/5/6).

**Projeto Supabase:** `lhofkimrmzyjazfpqesd`  
**Branch:** `main`  
**Migrations aplicadas em produção:** `supabase db push --linked`

---

## 1. Resumo executivo

| Área | Resultado |
|------|-----------|
| Respostas da área (competência, UPJ, log, retenção) | Implementado (migration `103000`) |
| Mapeamento DJEN `idOrgao` 98526 | Seed UPJ VI / FCC-01-05 |
| Reteste Grok PC-01, PC-02, PC-03 (órgão), PC-04, PC-05, PC-06 | Corrigido |
| PC-03b (recusa indevida pelo 1º dígito do sequencial) | Corrigido (migration `113000` + espelho no cliente) |
| Purge de dados de teste (reteste ids 88–89) | Executado em 16/10/2026 — 0 registros restantes |
| Build de produção | `npm run build` |
| Testes unitários | Vitest (competência, UPJ faixa, sistema CNJ) |

Referência de reteste: `reports/prioridades-reteste-2026-10-16/RELATORIO_RETESTE_PC01_PC06.md`.

---

## 2. Migrations (banco)

### `20261016103000_prioridades_respostas_area_out2026.sql`

- **`prioridades_processo_competencia_atende`:** competência TJSP Atende — CNJ `8.26.0100`, Vara 1–45 quando informada, validação de nome de órgão DJEN (Varas/UPJ FCC; recusa Câmara/Gabinete etc.).
- **`prioridades_pode_ver`:** isolamento por UPJ para Coordenador e Analista; Gestor e perfis amplos conforme regras já documentadas.
- **Log de acessos:** RPCs de consulta, retenção (12 meses), permissão Gestor/Coordenador (incl. designação).
- **`prioridades_criar_anotacao`:** checagem de competência alinhada à área; demais ajustes da resposta 15/10.

### `20261016104500_prioridades_mapeamento_orgao_98526.sql`

- Insere/atualiza `prioridades_orgaos_upj` para **`idOrgao` 98526** → UPJ da 1ª a 5ª Varas (`FCC-01-05`).
- Corrige caso real `4193948-19.2026.8.26.0100` (antes aparecia como UPJ não mapeada).

### `20261016110000_prioridades_fix_grokbot_pc01_pc06.sql`

- **PC-01:** admin **não** bypassa isolamento quando opera como Coordenador/Analista com UPJ fixa.
- **PC-03:** órgão inválido (Câmara/Gab.) avaliado mesmo fora de `localizado` (introduziu temporariamente regra de 1º dígito `4` — ver PC-03b).
- **PC-04:** `prioridades_criar_anotacao` volta a chamar `prioridades_recalcular_especiais` (Reiterada na criação).
- **PC-06:** `prioridades_pode_consultar_log_acessos` considera designação ativa de gestor/coordenador.

### `20261016113000_prioridades_competencia_sem_digito4.sql` (PC-03b)

- Remove exigência de sequencial iniciado em `4`.
- Competência permanece: CNJ `8.26.0100`, Vara 1–45, órgão DJEN compatível.
- Processos como `1100221-28.2024.8.26.0100` voltam a ser anotáveis.

---

## 3. Frontend e serviços

| Arquivo | Função |
|---------|--------|
| `prioridadesCompetencia.ts` | Espelho da RPC de competência (sem filtro por 1º dígito). |
| `prioridadesUpjFaixa.ts` | Fallback UPJ por faixa de Varas (I–IX / FCC-XX-YY). |
| `prioridadesSistemaCnj.ts` | Inferência **Eproc** (4=Cível, 5=Fiscal, 6=Criminal); demais dígitos → campo Sistema manual (SAJ/Eproc). |
| `NovaAnotacaoForm.tsx` | Campos progressivos; mensagem DJEN indisponível (PC-02); competência e UPJ condicional; oculta Sistema quando inferido. |
| `prioridadesService.ts` | Resolução UPJ (tabela + fallback); listagem do log de acessos. |
| `LogAcessosTela.tsx` | Tela de log (Gestor/Coordenador). |
| `PrioridadesSidebar.tsx` / `PrioridadesModal.tsx` / `PrioridadesContent.tsx` / `usePrioridadesModal.ts` | Entrada para log e ajustes de navegação. |

Documentação de dúvidas fechadas: `docs/PRIORIDADES_URGENCIAS_DUVIDAS.md`.

---

## 4. Testes

- `src/__tests__/prioridades/competenciaAtende.test.ts`
- `src/__tests__/prioridades/upjFaixa.test.ts`
- `src/__tests__/prioridades/sistemaCnj.test.ts`

Executar: `npm test` (ou o comando Vitest do projeto). No reteste manual, **41 testes** passaram.

---

## 5. Purge de dados de teste

| Script | Escopo | Resultado 16/10/2026 |
|--------|--------|----------------------|
| `reports/prioridades-correcoes-2026-10-16/evid/purge_teste.sql` | Anotações 85–87, log 25 | Dados já ausentes (trava 0/3) |
| `reports/prioridades-reteste-2026-10-16/evid/purge_teste.sql` | Anotações 88–89 | **OK** — anotações, histórico e log = 0 restantes |

Comando usado (reteste):

```bash
supabase db query --linked -f reports/prioridades-reteste-2026-10-16/evid/purge_teste.sql
```

---

## 6. Itens ainda em aberto (não desta entrega)

- **DataJud / Vara automática** — adiado (só DJEN nesta fase).
- **Anotações legadas fora de competência** (ex. ids 83/84) — decisão da área; não purgadas automaticamente.
- **Caminho de log só por designação de gestor** — RPC atual não expõe cenário isolado; base gestor/coordenador/atendente validada no reteste.

---

## 7. Como publicar

1. `npm run build` no diretório `gerenciador`.
2. Deploy do front conforme pipeline habitual (GitHub Pages / ambiente interno).
3. Migrations já refletidas no projeto linkado; novos ambientes: `supabase db push --linked`.

---

*Gerado em 16/10/2026 como registro da entrega técnica pós-correções PC-01–PC-06 e respostas da área.*
