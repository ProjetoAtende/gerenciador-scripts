# scripts/sb-reset.ps1 - Reset completo do banco local Supabase
# Uso: powershell -File scripts/sb-reset.ps1
# Equivale ao antigo `npm run sb:reset`, mas com tolerancia a erros do schema dump
# Atualizado: Fase 3 - Sincronizacao Local <-> Producao

param([switch]$NoSeed)

$ErrorActionPreference = "Continue"
$DB = "supabase_db_gerenciador-chamados"
$PSQL = "psql -U postgres -d postgres"

function Wait-LocalDatabase {
    $deadline = (Get-Date).AddSeconds(90)
    do {
        $health = docker inspect -f '{{.State.Health.Status}}' $DB 2>$null
        if ($health -eq 'healthy') { return }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)

    throw "O banco local do Supabase não ficou saudável após 90 segundos."
}

function Run-SQL($file, $label, [switch]$SuppressErrors) {
    Write-Host "`n=== $label ===" -ForegroundColor Cyan
    if ($SuppressErrors) {
        Get-Content $file | docker exec -i $DB $PSQL.Split() -v ON_ERROR_STOP=0 --set=client_min_messages=error 2>&1 |
            Select-String "ERROR" |
            Where-Object { $_.Line -notmatch "already exists|permission denied|http_response|http_header|http_request|syntax error at or near|does not exist, skipping|cannot drop" } |
            ForEach-Object { Write-Host $_.Line -ForegroundColor Yellow }
    } else {
        Get-Content $file | docker exec -i $DB $PSQL.Split() 2>&1 | ForEach-Object {
            if ($_ -match "ERROR") { Write-Host $_ -ForegroundColor Red } else { Write-Host $_ }
        }
    }
}

function Run-SQL-Large($file, $label) {
    Write-Host "`n=== $label ===" -ForegroundColor Cyan
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    # Use docker exec with file piped via stdin, suppress most output
    Get-Content -Raw $file | docker exec -i $DB $PSQL.Split() -v ON_ERROR_STOP=0 --set=client_min_messages=error 2>&1 |
        Select-String "ERROR" |
        Where-Object { $_.Line -notmatch "already exists|permission denied|duplicate key|violates|does not exist, skipping" } |
        Select-Object -First 20 |
        ForEach-Object { Write-Host $_.Line -ForegroundColor Yellow }
    $sw.Stop()
    Write-Host "   Tempo: $([math]::Round($sw.Elapsed.TotalSeconds, 1))s" -ForegroundColor Gray
}

$AuthContractMigrations = @(
    "supabase\migrations\20260502103000_tarefas_notificacao_supervisor_conclusao.sql",
    "supabase\migrations\20260615110000_auth_users_roles_admin_panel.sql",
    "supabase\migrations\20260615133000_catequetico_app_scope.sql",
    "supabase\migrations\20260615193000_fix_shared_auth_users_policy_and_is_admin.sql",
    "supabase\migrations\20260615200000_restore_gerenciador_auth_contract.sql",
    "supabase\migrations\20260621120000_harden_shared_auth_profile_scope.sql"
)

$CategoriaAnomaliaMigrations = @(
    "supabase\migrations\20260428120000_permissoes_objetos_grants.sql",
    "supabase\migrations\20260521180000_notificacoes_autorizacoes.sql",
    "supabase\migrations\20260521193000_notificacoes_preferencias_equipes.sql",
    "supabase\migrations\20260523120000_categoria_anomalias_horarias.sql",
    "supabase\migrations\20260523123000_categoria_anomalias_cron.sql",
    "supabase\migrations\20260524110000_categoria_anomalias_historico.sql",
    "supabase\migrations\20260524123000_categoria_anomalias_historico_breakdown.sql",
    "supabase\migrations\20260524143000_categoria_anomalias_notificacoes.sql",
    "supabase\migrations\20260526120000_categoria_anomalias_reduzir_ruido.sql",
    "supabase\migrations\20260623110000_categoria_anomalias_operacionais.sql"
)

$GseNormalizationMigrations = @(
    "supabase\migrations\20260520143000_normalize_gse_hml_priority.sql",
    "supabase\migrations\20260708123000_repair_corrupted_gse_labels.sql"
)

$SmaxRobotMigrations = @(
    "supabase\migrations\20260513120000_smax_global_robot_dev.sql",
    "supabase\migrations\20260513143000_smax_global_robot_fila_livres.sql",
    "supabase\migrations\20260513152000_smax_global_robot_anexar_timeout.sql",
    "supabase\migrations\20260514170000_smax_global_robot_anexar_livres_timeout.sql",
    "supabase\migrations\20260516100000_smax_rejeites_snapshot.sql",
    "supabase\migrations\20260516130000_smax_rejeites_externos_sem_usuario.sql",
    "supabase\migrations\20260516223000_smax_rejeites_realtime_sync.sql",
    "supabase\migrations\20260516234500_smax_rejeites_manter_snapshot.sql",
    "supabase\migrations\20260517123000_smax_rejeites_registrar_excluir_servico.sql",
    "supabase\migrations\20260517133000_smax_rejeites_lotes_excluir_registrar.sql",
    "supabase\migrations\20260518120000_smax_rejeites_respondendo_ticket.sql",
    "supabase\migrations\20260518133000_smax_rejeites_preservar_mantidos_snapshot.sql",
    "supabase\migrations\20260519120000_smax_tickets_antigos_snapshot.sql",
    "supabase\migrations\20260521120000_smax_status_snapshot.sql",
    "supabase\migrations\20260619153000_smax_tickets_antigos_global_info.sql",
    "supabase\migrations\20260630113000_smax_status_snapshot_distribuidor_info.sql",
    "supabase\migrations\20260702173000_oraculo_smax_sync_state.sql",
    "supabase\migrations\20260702183000_n3_gse_atual_robot.sql",
    "supabase\migrations\20260702200000_global_gse_atual_robot.sql",
    "supabase\migrations\20260702213000_fix_global_gse_scope_to_global_ticket.sql"
)

$PostResetMigrations = @(
    "supabase\migrations\20260707150000_remote_smax_execution_core.sql",
    "supabase\migrations\20260707153000_remote_smax_execution_rls.sql",
    "supabase\migrations\20260707160000_remote_smax_execution_realtime.sql",
    "supabase\migrations\20260708143000_remote_agent_machines.sql",
    "supabase\migrations\20260708133000_remote_smax_execution_token_ciphertext.sql",
    "supabase\migrations\20260718150000_homologacao_testes_vitais.sql",
    "supabase\migrations\20260718160000_homologacao_documentacao.sql",
    "supabase\migrations\20260718170000_homologacao_documentacao_ticket_smax.sql",
    "supabase\migrations\20260718180000_homologacao_perfis_jus_procurador.sql",
    "supabase\migrations\20260718190000_homologacao_documentacao_versoes.sql",
    "supabase\migrations\20260718200000_homologacao_documentacao_versao_v921.sql",
    "supabase\migrations\20260718220000_homologacao_documentacao_ambientes.sql",
    "supabase\migrations\20260718230000_homologacao_documentacao_layout_datas.sql",
    "supabase\migrations\20260718240000_homologacao_documentacao_multiplos_usuarios_links.sql",
    "supabase\migrations\20260719000000_homologacao_documentacao_edicao_equipe.sql",
    "supabase\migrations\20260719010000_homologacao_documentacao_exclusao_equipe.sql",
    "supabase\migrations\20260719020000_homologacao_etapas_graus.sql",
    "supabase\migrations\20260719120000_homologacao_relatorios_testes.sql",
      "supabase\migrations\20260719130000_homologacao_remover_persistencia_relatorios.sql",
      "supabase\migrations\20260721130000_homologacao_dados_por_equipe.sql",
      "supabase\migrations\20260721150000_homologacao_documentos_storage.sql"
  )

Write-Host "=== RESET COMPLETO DO BANCO LOCAL ===" -ForegroundColor Green

# 1. Reset base (sem seed, sem migration customizada)
Write-Host "`n=== Passo 1: Reset base (Supabase CLI) ===" -ForegroundColor Cyan
# O snapshot inicial de migrations não contém todo o esquema legado. Em vez de
# interromper o reset na primeira migration histórica, o ambiente local é
# reconstruído a partir dos dumps versionados nas etapas seguintes.
Wait-LocalDatabase
$resetSql = @'
DROP SCHEMA IF EXISTS task_manager CASCADE;
DROP SCHEMA IF EXISTS knowledge_base CASCADE;
DROP SCHEMA IF EXISTS oraculo CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
'@
$resetSql | docker exec -i $DB psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null

# 2. Aplicar fix_unaccent (wrappers p/ funcoes que usam unaccent)
Run-SQL "supabase\fix_unaccent.sql" "Passo 2: Fix unaccent wrappers"

# 3. Criar tabelas com column-reference defaults (tickets, insight)
Run-SQL "supabase\fix_column_ref_tables.sql" "Passo 3: Tabelas com column-ref defaults (tickets, insight)"

# 4. Fix missing tables e colunas (oraculo.chamados, kb.segmentos, MV stats)
# NOTA: Tambem cria schemas extras e tabelas com column-ref defaults
if (Test-Path "supabase\fix_missing_tables.sql") {
    Run-SQL "supabase\fix_missing_tables.sql" "Passo 4: Fix missing tables/columns" -SuppressErrors
}

# 4b. Stubs para extensoes indisponiveis (http, jaccard) - ANTES do schema dump
if (Test-Path "supabase\fix_http_stubs.sql") {
    Run-SQL "supabase\fix_http_stubs.sql" "Passo 4b: HTTP/extension stubs" -SuppressErrors
}

# 5. Schema principal (public) - primeira passada
Run-SQL "supabase\schema_dump.sql" "Passo 5: Schema principal (public) - 1a passada" -SuppressErrors

# 6. Schemas extras (oraculo, knowledge_base, task_manager)
Run-SQL "supabase\extra_schemas_dump.sql" "Passo 6: Extra schemas" -SuppressErrors

# 6b. Fix missing tables - segunda passada (knowledge_base triggers/colunas)
if (Test-Path "supabase\fix_missing_tables.sql") {
    Run-SQL "supabase\fix_missing_tables.sql" "Passo 6b: Fix KB columns/triggers" -SuppressErrors
}

# 7. Schema principal - segunda passada (funcoes que dependem de extra schemas + stubs)
Run-SQL "supabase\schema_dump.sql" "Passo 7: Schema principal (public) - 2a passada" -SuppressErrors

# 8. Sync de producao - funcoes/indices/policies adicionais (Fase 1)
if (Test-Path "supabase\sync_from_production.sql") {
    Run-SQL "supabase\sync_from_production.sql" "Passo 8: Sync from production (funcoes APP)" -SuppressErrors
}

# 9. Reaplicar o contrato de auth compartilhado que nao e recomposto integralmente
# apenas pelo schema dump tolerante. Isso garante:
# - usuario_funcoes_equipe
# - handle_auth_user_profile
# - resolve_auth_profile_role
# - politicas/funcoes auxiliares do auth compartilhado
Write-Host "`n=== Passo 9: Auth compartilhado (reconciliacao pos-schema) ===" -ForegroundColor Cyan
foreach ($migration in $AuthContractMigrations) {
    if (Test-Path $migration) {
        Run-SQL $migration "Auth: $(Split-Path $migration -Leaf)" -SuppressErrors
    }
}

# 10. Seed data (grande — usa Run-SQL-Large)
if (-not $NoSeed) {
    Run-SQL-Large "supabase\seed.sql" "Passo 10: Seed data (producao)"
}

# 10b. Trilhas que ficam faltando quando o db reset padrao interrompe cedo
Write-Host "`n=== Passo 10b: Reconciliacao de autorizacoes/notificacoes/anomalias ===" -ForegroundColor Cyan
foreach ($migration in $CategoriaAnomaliaMigrations) {
    if (Test-Path $migration) {
        Run-SQL $migration "Categoria/Notificacao: $(Split-Path $migration -Leaf)" -SuppressErrors
    }
}

# 10c. Reconciliar a normalizacao de GSEs usada pelos robos e dashboards
Write-Host "`n=== Passo 10c: Normalizacao de GSEs ===" -ForegroundColor Cyan
foreach ($migration in $GseNormalizationMigrations) {
    if (Test-Path $migration) {
        Run-SQL $migration "GSE: $(Split-Path $migration -Leaf)" -SuppressErrors
    }
}

# 10d. Reconciliar o bloco dos robos SMAX que nao esta totalmente coberto pelos dumps tolerantes
Write-Host "`n=== Passo 10d: Robos SMAX (reconciliacao local) ===" -ForegroundColor Cyan
foreach ($migration in $SmaxRobotMigrations) {
    if (Test-Path $migration) {
        Run-SQL $migration "SMAX: $(Split-Path $migration -Leaf)" -SuppressErrors
    }
}

# 10e. Migrations locais posteriores ao reset reconciliado
Write-Host "`n=== Passo 10e: Migrations complementares locais ===" -ForegroundColor Cyan
foreach ($migration in $PostResetMigrations) {
    if (Test-Path $migration) {
        Run-SQL $migration "Complementar: $(Split-Path $migration -Leaf)"
    }
}

# 11. Grants finais para schemas extras
# NOTA: knowledge_base migrado para public com prefixo kb_ — grants não mais necessários
Write-Host "`n=== Passo 11: Grants finais (task_manager) ===" -ForegroundColor Cyan
docker exec $DB psql -U postgres -d postgres -c "
GRANT USAGE ON SCHEMA task_manager TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA task_manager TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA task_manager TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA task_manager TO anon, authenticated, service_role;
" 2>&1 | Out-Null

# 12. Contagem final
Write-Host "`n=== Contagem final ===" -ForegroundColor Green
docker exec $DB psql -U postgres -d postgres -t -c "
SELECT count(*), type FROM (
  SELECT 'public.tables' as type FROM information_schema.tables WHERE table_schema='public'
  UNION ALL SELECT 'public.functions' FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.prokind IN ('f','p')
  UNION ALL SELECT 'auth.users' FROM auth.users
  UNION ALL SELECT 'chamados' FROM public.chamados
  UNION ALL SELECT 'tickets' FROM public.tickets
  UNION ALL SELECT 'ticket_analises' FROM public.ticket_analises
  UNION ALL SELECT 'scripts_customizados' FROM public.scripts_customizados
  UNION ALL SELECT 'users_seed' FROM public.users
  UNION ALL SELECT 'oraculo_chamados' FROM public.oraculo_chamados
) sub GROUP BY type ORDER BY type;
"

Write-Host "`n=== Reset completo! ===" -ForegroundColor Green
