import fs from 'fs';

const dump = fs.readFileSync('supabase/schema_dump.sql', 'utf8');
const names = [
  'fn_atribuir_numero_referencia',
  'resetar_curadoria_ao_editar',
  'salvar_conteudo_original_script',
  'marcar_script_para_classificacao',
  'sync_tem_conteudo_atendente',
  'get_pasta_desativados_id',
  'criar_notificacao_script',
  'criar_proposta_script',
  'aprovar_proposta_script',
  'rejeitar_proposta_script',
  'reenviar_proposta_script',
  'revisar_script_inicial',
  'aceitar_contestacao_script',
  'criar_versao_curadoria',
  'criar_versao_v1_publicacao',
  'determinar_dominio_script',
  'marcar_curadoria_script',
  'registrar_revisor_v1',
  'aprovar_exclusao_script',
  'reativar_script',
  'buscar_versoes_resumo',
];

let out =
  '-- DB-5 (parte 2): Scripts — triggers, helpers e RPCs de curadoria\n\nSET search_path TO public;\n\n';

for (const name of names) {
  const re = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}[\\s\\S]*?\\n\\$function\\$\\s*;`,
    'm',
  );
  const m = dump.match(re);
  if (!m) {
    console.error('MISSING', name);
    process.exit(1);
  }
  out += `${m[0]}\n\n`;
}

fs.writeFileSync('supabase/migrations/_scripts_db5_extracted.sql', out);
console.log('written', out.length, 'bytes');
