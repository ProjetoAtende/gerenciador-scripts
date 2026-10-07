# Prioridades e Urgências — integração com o DJEN

Notas de integração do app "Prioridades e Urgências" (card da Home → modal
fullscreen). Origem: Especificação Técnica v1.0 (out/2026), seção 9.1.

## Resumo

A validação do número do processo (RF-ATD-03) e a detecção da UPJ (RF-ATD-04)
usam a API pública do **DJEN / Comunica PJe**
(`https://comunicaapi.pje.jus.br`, Resolução CNJ nº 455/2022) por meio da Edge
Function `djen-proxy`.

## Duas descobertas que mudaram o desenho

### 1. O DJEN não pode ser chamado direto do navegador

A API devolve, **na mesma resposta**:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

Essa combinação é rejeitada pelo Chromium. Verificado no app rodando: o servidor
responde **HTTP 200** com os headers acima e o navegador aborta com
`net::ERR_FAILED` de qualquer forma. Ou seja, chamar o DJEN direto do cliente
**não funciona**, por mais correto que o código esteja.

Por isso toda consulta passa pela Edge Function `supabase/functions/djen-proxy`.

### 2. O geo-bloqueio não se aplica a este projeto

O DJEN restringe IPs fora do Brasil (HTTP 403), e a região deste projeto Supabase
é `aws-0-ca-central-1` (Canadá) — o que sugeria bloqueio.

Medido, não suposto: o diagnóstico embutido no proxy (`?diagnostico=1`) mostrou
que o egress deste projeto sai por **IP brasileiro** (`15.228.149.169`) e o DJEN
respondeu **HTTP 200**.

```bash
curl -s "$VITE_SUPABASE_URL/functions/v1/djen-proxy?diagnostico=1" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq
```

**Consequência prática:** não é necessário migrar a região do Supabase para a
Edge Function funcionar. Como isso depende do roteamento de saída do provedor,
trate como dependência monitorável: se um dia voltar 403, a resposta é migrar o
projeto para região brasileira.

## A API é um diário, não uma consulta processual

O DJEN centraliza **publicações**. Ele só "conhece" processo que tenha
comunicação publicada. Portanto:

> `count = 0` **não** prova que o processo não existe — apenas que não houve
> publicação na janela consultada.

A UI nunca afirma "processo inexistente". O status `sem_comunicacao` permite
seguir com a anotação e apenas pede a escolha manual da UPJ.

## O campo `nomeOrgao` já é a UPJ (no Fórum Central Cível)

O schema da especificação previa `Vara integer (1 a 45)` e uma tabela
`Vara → UPJ`. Na prática o DJEN devolve:

| Campo | Exemplo | Natureza |
|---|---|---|
| `idOrgao` | `98517` | **chave estável** — use esta |
| `nomeOrgao` | `UPJ da 26ª a 30ª Varas Cíveis - Foro Central Cível` | texto livre |

Ou seja, no Fórum Central Cível o órgão publicador **é** a UPJ agrupada.

**Mas isso não generaliza.** Para outra comarca o mesmo campo traz
`Foro de Mogi das Cruzes - Vara da Fazenda Pública`, sem número de Vara
identificável. Por isso:

- a chave de detecção é `idOrgao` (nunca o texto);
- `vara` é dado auxiliar, extraído quando existir;
- a tabela `prioridades_orgaos_upj` é preenchida de forma **incremental**
  (ver comentário na migration de seed).

## Parâmetros e limites

Levantados do OpenAPI oficial (`https://comunicaapi.pje.jus.br/swagger/djen.yml`,
v1.0.4):

| Item | Valor |
|---|---|
| `itensPorPagina` | **apenas 5 ou 100** — outros valores geram erro negocial |
| Limite de resultados | 10.000 (`count` satura nesse valor) |
| Rate limit | headers `x-ratelimit-limit` / `x-ratelimit-remaining` |
| Em `429` | orientação oficial: aguardar **1 minuto** |
| Filtros | `numeroProcesso`, `numeroOab`, `nomeParte`, `nomeAdvogado`, `siglaTribunal`, datas, `orgaoId`, `meio` |
| Autenticação | endpoints de consulta **não exigem** auth (POST/DELETE são exclusivos dos Tribunais) |

O cliente cacheia o resultado por processo (TTL 5 min) e suspende novas consultas
por 1 minuto após um `429`, para não insistir contra o limite.

## Plataforma processual (Eproc/SAJ) — decidido

A especificação exigia exibir o sistema (Eproc ou SAJ) como retorno da consulta
(RF-ATD-03), mas o DJEN **não informa** em que sistema o processo tramita, e o
número CNJ não carrega essa informação.

**Decisão do projeto:** o campo é **seleção opcional no formulário**, preenchida
pelo atendente. O DJEN fornece apenas o que é capaz de fornecer — número, Vara
(quando houver) e órgão. Não bloqueia o envio (`RF-ATD-11` não o exige).

`DjenResultado.plataforma` permanece sempre `null`, e a UI usa o valor informado
no formulário. A coluna `prioridades_anotacoes.plataforma` mantém o
`CHECK ('eproc' | 'saj')` e aceita `NULL`.

## Bootstrap: como o primeiro Gestor e Coordenador existem

A especificação define **quem** designa quem (RF-GES-06: Gestor designa
Conferentes; RF-UPJ-05: Coordenador designa Analistas), mas **nunca diz como um
Gestor ou Coordenador passa a existir**. Sem isso o fluxo não fecha no primeiro
passo:

1. a distribuição round-robin do escopo `atende` (RF-GES-07) escolhe entre perfis
   `gestor` e `conferente` habilitados;
2. sem nenhum Gestor, ninguém tem alçada para designar o primeiro Conferente;
3. e a fila de conferência não teria gestor para assumir nem para haver
   sobreposição (regra dos slides 87–89).

**Solução:** o papel `admin` global provisiona o **perfil base** de Gestor e de
Coordenador da UPJ, na mesma tela de Designações (alternador
"Designação (com período)" × "Perfil base (permanente)"). O admin é a única
figura fora do fluxo operacional — o Boss Only já existe para administração —,
então a solução não conflita com as alçadas do documento.

Duas operações distintas, expostas como tal:

| Operação | Natureza | Quem faz |
|---|---|---|
| **Designação** | Com período (data ou "Indeterminado") | Gestor designa Conferente; Coordenador designa Analista |
| **Perfil base** | Permanente; define o módulo | Admin (bootstrap) |

Detalhe de implementação: a alçada é verificada por `auth.uid()`, ou seja, exige
**sessão de usuário autenticado**. Chamar a RPC com a chave `service_role` falha
com "cabe ao administrador do sistema" porque `auth.uid()` é nulo nesse caminho —
comportamento correto, e relevante para quem for testar por script.

A remoção de perfil base é recusada quando o usuário tem anotação em andamento
vinculada: a integridade dos registros (RF-GER-03) vem antes da conveniência
administrativa.

### Provimento do perfil base: escolher "Gestor" virava "Conferente"

Achado pelo uso, depois da bateria de correções.

O alternador da tela Designações tem dois modos — **Designação (com período)** e
**Perfil base (permanente)**. O efeito que mantinha `perfilNovo` dentro da lista
válida checava **sempre** a lista de designações (`['conferente','analista']`),
sem olhar o modo:

```tsx
useEffect(() => {
  if (!perfisDesignaveis.includes(perfilNovo)) {
    setPerfilNovo(perfisDesignaveis[0] ?? 'conferente');
  }
}, [perfisDesignaveis, perfilNovo]);
```

No modo Perfil base, escolher **Gestor** caía fora daquela lista e o estado era
silenciosamente forçado de volta para `'conferente'`. O `<select>` **continuava
exibindo "Gestor"** — porque na primeira renderização o valor vinha de outra
fonte —, mas o envio mandava `'conferente'`.

Resultado para o usuário: escolhia perfil base, a mensagem dizia "agora tem perfil
de Gestor no app"... e a pessoa recebia uma **designação de Conferente**. O
registro que contava era `prioridades_designacoes`, e o perfil base de Gestor
nunca existia.

Correção: a validação passou a usar a lista do **modo em uso**
(`perfisDoModoAtual`), e o próprio `<select>` passou a ler dela — antes o valor e
as opções vinham de fontes diferentes, que é o que mascarava a divergência.

Verificado no navegador: escolher "Perfil base" → **Gestor** cria o perfil
`gestor`, **não** cria designação, e a mensagem confere.

> **Lição:** a divergência entre o valor exibido e o valor enviado só aparece
> quando se confere o **banco** depois da ação. A tela parecia correta.

## Segurança: achados PU-01 a PU-14 do relatório de teste

O teste adversarial de 07/10/2026 (`reports/prioridades-urgencias-2026-10-07/`)
reprovou o módulo para produção com 14 achados. Todos foram corrigidos e há
regressão automatizada cobrindo cada um (44 verificações).

### A causa-raiz que se repetiu

**`GRANT ... TO authenticated` não restringe nada.** O Supabase concede
privilégios DEFAULT a `anon` e `authenticated` em objetos criados no schema
`public`, e concede EXECUTE em funções para `PUBLIC`. Sem `REVOKE` explícito, o
grant implícito de `anon` permanece.

Foi assim que, sem login, se conseguiu:

- **LER e ESCREVER** em três tabelas criadas sem `ENABLE ROW LEVEL SECURITY`
  (PU-01) — sem RLS, o grant de tabela vale para todas as linhas;
- **EXECUTAR** `prioridades_processar_prazos_vencidos()` (que rejeitou uma
  anotação real) e `prioridades_proximo_da_fila()` — ambas `SECURITY DEFINER`,
  portanto rodam com privilégio de owner e ignoram a RLS (PU-02);
- **FORJAR** evento no histórico de auditoria (PU-02).

**Regra adotada para este módulo:** toda tabela nova recebe `ENABLE ROW LEVEL
SECURITY` + `REVOKE ALL FROM anon`; toda função interna recebe `REVOKE ALL FROM
PUBLIC, anon` e grant só a quem realmente chama.

### Escrita só pelo fluxo (PU-03)

As policies de INSERT/UPDATE em `prioridades_anotacoes` e o INSERT em
`prioridades_anotacoes_historico` permitiam alterar **qualquer coluna** direto
pela API. Reproduzido: o Atendente marcou a própria anotação como Urgentíssimo
(atribuição exclusiva do Gestor) e mudou o próprio prazo; o Gestor apagou a UPJ
da anotação. Zero eventos no histórico.

Correção: **nenhuma** policy de escrita nessas tabelas. Toda mutação passa pelas
RPCs `SECURITY DEFINER`, o que garante que toda transição gere histórico
(RF-GER-04).

> **Detalhe de verificação importante:** quando a RLS bloqueia um PATCH, o
> PostgREST responde **2xx com `Content-Range: */0`** — zero linhas afetadas, sem
> erro. Medir o código HTTP dá falso positivo. A regressão compara o **estado**
> do registro antes e depois.

### Alçadas separadas (PU-05)

`prioridades_sou_gestor_ou_conferente()` era usada como se fosse "é gestor". Um
Conferente Designado podia designar outros Conferentes, e a policy
`prioridades_designacoes_gestor_write` (FOR ALL) deixava que ele criasse qualquer
designação — inclusive `gestor`/`coordenador` para si mesmo.

Correção: `prioridades_sou_gestor()` e `prioridades_sou_conferente()` são funções
distintas, e a policy FOR ALL foi removida. Quem designa é o Gestor (RF-GES-06) e
o Coordenador da UPJ (RF-UPJ-05).

### Visibilidade: três defeitos em sequência (PU-09)

Achado descrito como "código" no relatório; ao corrigir, apareceram três causas
empilhadas:

1. um `RETURN EXISTS` no fim de `pode_ver` aceitava qualquer designação ativa de
   escopo global;
2. perfil de conferente **sem UPJ** era tratado como escopo do TJSP Atende, o que
   abria a operação inteira;
3. `prioridades_designar` fazia `v_upj_alvo := NULL` para conferente, **descartando
   silenciosamente** a UPJ recebida — por isso todo conferente virava escopo
   global, mesmo quando designado para uma unidade.

O ponto 3 é o mais traiçoeiro: a tela Enviava a UPJ, a RPC aceitava sem erro e
gravava `NULL`.

**Regra final**, alinhada à matriz da seção 4 e à tabela de transições da seção
5.1 (Conferência → UPJ é atribuição do Gestor) e ao RF-GER-02 ("Gestor/Conferente
**responsável**"):

| Quem | O que enxerga |
|---|---|
| Admin | tudo (leitura; desvio registrado) |
| Criador, conferente vinculado, conferido por | a própria anotação |
| Coordenador / Analista | somente a própria UPJ |
| Designação ativa | o escopo dela (com UPJ = aquela UPJ; sem UPJ = TJSP Atende) |
| Gestor | a fila de conferência — é quem distribui (RF-GES-01/07) |
| **Conferente** | **apenas o que lhe foi atribuído e o que criou** |

### Conferência: validar antes de gravar e preservar o original (PU-06, PU-07)

- **PU-07:** o UPDATE de `p_alteracoes` rodava antes de checar a UPJ. Uma
  aprovação recusada devolvia erro, mas o texto e o `conferido_por` já estavam
  gravados — sem histórico. Agora toda validação precede qualquer escrita.
- **PU-06:** a tela prometia "Texto original preservado em Observação Adicional" e
  nada era gravado. Agora o original é anexado à observação **e** o evento
  `aprovacao` carrega um JSON de auditoria com texto anterior, novo e motivo.

### Validação de entrada (PU-13)

`criar_anotacao` passou a validar dígito verificador CNJ, domínios de tipo contra
o catálogo (com mensagem útil em vez do nome da constraint), UPJ existente e
**coerência entre a UPJ escolhida e o órgão publicado no DJEN** — recusando apenas
quando há mapeamento conhecido divergente, porque o mapeamento é incremental.

> **Erro meu, corrigido em duas etapas.** A primeira versão do validador usou
> `mod 97 = 1`, que é a regra do número BASE, e recusava **todo** processo
> legítimo. A segunda montou a base com 21 dígitos (`substring(v_d from 10 for
> 11)`), continuando a recusar tudo. O correto é
> `DV = 98 - (NNNNNNN+AAAA+J+TR+OOOO+"00" mod 97)`, conferido contra
> `1076547-84.2025.8.26.0100` (DV 84) e `1008223-35.2025.8.26.0361` (DV 35).
>
> Isso revelou também que o número `0000001-11.2026.8.26.0100` usado no relatório
> é **fabricado** — o DV correto seria 68.

### Proxy do DJEN (PU-11)

`verify_jwt = false` + CORS `*` + nenhuma checagem de usuário faziam da função um
proxy público do DJEN, consumível por qualquer site. Agora **toda** chamada exige
sessão de usuário (`auth.getUser`); a anon key é recusada. O diagnóstico
`?diagnostico=1` foi removido — cumpriu o papel de medir o egress e manter um
caminho privilegiado só aumentaria a superfície.

### Cliente (PU-04, PU-10, PU-12, PU-14)

| Achado | Correção |
|---|---|
| **PU-04** UPJ ficava presa ao trocar o número do processo | `handleProcessoChange` limpa UPJ, vara, órgão e validação a cada mudança; o ramo `sem_comunicacao` grava `upj_id = null` em vez de herdar |
| **PU-10** RF-ATD-02 inalcançável (Verificar exigia 20 dígitos) | Verificar habilita com 20 **ou** 13 dígitos, com aviso do sufixo que será aplicado |
| **PU-12** contador "Urgentíssimas" somava todas as `upj-pendente` | contagem própria por `urgentissimo = true`, marcada no grupo do painel |
| **PU-14** `?modal=prioridades` abria sem checar permissão; rótulo errado na conferência | a URL valida a permissão do card; o rótulo mostra a UPJ escolhida, não o órgão do DJEN |

### Onde a regressão vive

`scripts/` é temporário por natureza; a suíte foi executada contra o banco real
antes da limpeza e cobriu 44 verificações. Se quiser mantê-la no repositório,
mova-a para `src/__tests__/prioridades/` como teste de integração (depende de
sessão e rede, então não roda em CI sem credenciais).

### Resíduos de teste removidos

Anotações 10 e 11, histórico 17–26 (incluindo o evento forjado), designações e o
cursor do rodízio restaurado aos valores originais
(`atende` → `98554fce-…`, `upj` → `1bde8f47-…`). O módulo está sem anotações,
com 1 perfil (Atendente de teste), 9 UPJs e 1 mapeamento órgão→UPJ.

## Defeitos encontrados ao escrever o roteiro de testes

Três defeitos reais apareceram ao **executar** os casos de uso, não ao descrevê-los.
Ficam registrados porque os dois últimos revelam classes de erro que podem se
repetir.

### 1. A máscara CNJ se perdia quando o DJEN respondia

`handleProcessoChange` aplicava a máscara, mas a resposta da consulta gravava
`form.processo` em dígitos crus — e o input, que lia direto do estado, exibia
`10082233520258260100` sem separadores. O campo só aparecia mascarado **quando a
consulta falhava**, o que mascarou o problema no primeiro teste.

Correção: a exibição passou a ser derivada (`formatarProcessoCnj(form.processo)`)
em vez de ler o estado cru, de modo que qualquer origem — digitação ou resposta da
API — renderiza mascarada.

### 2. Aprovação sem UPJ fazia a anotação sumir

`upj_id` é opcional no formulário (correto: o DJEN pode não ter publicação e a
detecção falhar). Mas `prioridades_conferir` aprovava assim mesmo:

| Passo | Resultado |
|---|---|
| Atendente registra sem UPJ | `gestor-conferencia` |
| Gestor aprova | `upj-pendente`, `upj_id` NULL |
| Usuários da UPJ consultam | **0 linhas** |
| Gestor consulta | 1 linha |

A RLS compara `upj_id = prioridades_minha_upj()`; com destino nulo, ninguém
enxerga. A anotação saía da fila de conferência e **desaparecia do fluxo**, sem
erro visível para ninguém.

Correção (migration `20261010230000`): aprovar exige UPJ, e o formulário de
conferência ganhou o campo de destino, editável, para o Gestor resolver na hora.
Devolver e rejeitar continuam sem exigir UPJ — só a aprovação remete ao cartório.

Alternativa descartada: atribuir UPJ padrão. Entregaria a anotação ao cartório
errado, e erro de destino é pior do que erro visível.

### 3. A RPC recusava o perfil `atendente`

A interface oferecia três perfis base (Gestor, Coordenador, **Atendente**), mas
`prioridades_designar` só aceitava `gestor` e `coordenador` como perfil base.
Escolher "Atendente" devolvia `"Perfil inválido para esta operação."`.

Como o registro de anotação exige perfil e sem perfil o servidor recusa, o
caminho mais comum de entrada no app ficava bloqueado pelo próprio cadastro.

Correção (migration `20261010220000`): `atendente` passou a ser perfil base
válido, e virar Atendente remove designações de conferente/analista que perderam
sentido.

**Lição comum aos três:** os defeitos estavam em caminhos que só aparecem quando o
fluxo roda de ponta a ponta com dados reais. Nenhum apareceria em teste unitário
ou em inspeção de código.

## Designações e cadastro de perfis

A especificação trata "designação" como algo com **período** (data ou
"Indeterminado"), o que é diferente de um perfil base permanente. A
implementação separa os conceitos e resolve ambos no mesmo ato:

| Tabela | Papel |
|---|---|
| `prioridades_usuarios_perfil` | Perfil base do app: define o módulo e o vínculo à UPJ. É o que permite abrir o app e ver o módulo correto. |
| `prioridades_designacoes` | Delegação com período: quem designou, para qual perfil, de quando até quando. `fim_em` nulo = "Indeterminado". |

A RPC `prioridades_designar` cria/ajusta o perfil base **e** registra a
designação na mesma transação, para que o designado consiga efetivamente entrar
e trabalhar. Não há divergência possível porque a autorização considera
designação ativa em vigor (`prioridades_designacao_ativa`): um atendente
designado Conferente passa a ver o módulo Gestores, com o painel lateral
indicando "por designação (base: Atendente)".

**Alçadas** (espelhadas no servidor, não apenas na UI):

| Ação | Quem pode |
|---|---|
| Designar **Conferente** | Gestor do TJSP Atende, ou admin |
| Designar **Analista** | Coordenador da UPJ, ou admin |
| Buscar usuários | Gestor/admin buscam em toda a base; Coordenador apenas na própria UPJ |
| Encerrar designação | A alçada do perfil correspondente, ou admin |

Ao encerrar a última designação de alguém, o perfil base de designado é
removido — o usuário volta a "sem perfil no app", em vez de ficar com um perfil
órfão que não corresponde a designação alguma.

O admin é aceito nas alçadas acima porque é ele que administra o sistema. Isso só
é coerente por causa do desvio de leitura total registrado na seção seguinte —
as duas decisões andam juntas.

## O admin LÊ tudo, mas NÃO decide

O `RF-GER-02` define visibilidade restrita (criador, gestor/conferente
responsável e UPJ de destino), **sem exceção**. A implementação retorna `TRUE` de
imediato em `prioridades_pode_ver` para quem tem `role = 'admin'` no Gerenciador:
o admin enxerga anotações de qualquer atendente e de qualquer UPJ.

Esse desvio de **leitura** foi aceito explicitamente pela área, por consistência
com o restante do Gerenciador (`tem_permissao` também concede tudo ao admin) e
para permitir suporte a caso travado.

**A escrita não acompanha a leitura.** Para decidir — conferir, analisar,
responder devolução, criar anotação, alternar vinculação — o admin precisa do
**perfil correspondente no app**, como qualquer outro usuário. As quatro RPCs de
decisão verificam isso e recusam o admin sem perfil.

A razão é de auditoria: a trilha precisa registrar alguém agindo **dentro do seu
papel** no fluxo. Se o admin decidisse anonimamente, o histórico apontaria uma
decisão sem responsável funcional. Quando o admin precisa operar, ele se atribui
o perfil base (ação que só ele pode fazer) e age identificado.

Consequência assumida: a promessa central do sistema — "fim da exposição do nome
do Atendente às correções" (seção 2.2) — vale para todos os perfis **exceto
admin**. Como a anotação pode conter dado sensível de saúde, a leitura por admin
deve ser tratada como acesso privilegiado e excepcional.

> **Histórico desta regra.** A primeira versão tinha `conferir` aceitando admin e
> `analisar` recusando — divergência sem decisão consciente. Ao unificar, o
> `ALTER` foi feito no código (migration `20261010350000`), e a documentação
> passou a refletir essa escolha. Registrado em `COMMENT ON FUNCTION` na migration
> `20261010180000_prioridades_decisoes_registradas.sql`.

### O bug que escondia isso: `NOT (NULL)`

Vale registrar porque a expressão **parece** correta. O portão era escrito assim:

```sql
IF NOT (v_perfil IN ('gestor','conferente') OR designacao_ativa(...)) THEN
  RETURN 'sem permissão';
END IF;
```

Sem perfil, `v_perfil` é `NULL`, e em SQL:

```
NULL IN ('gestor','conferente')  ->  NULL     (não é FALSE)
NULL OR false                    ->  NULL
NOT NULL                         ->  NULL
IF NULL THEN                     ->  NÃO ENTRA no bloco
```

O portão **abria exatamente para quem não tem perfil** — o caso que deveria
barrar. Foi assim que o admin aprovou uma anotação de verdade durante a
verificação.

Achado por instrumentação dentro da própria função, que registrou
`portao_nega: null` onde deveria haver `true`. Nenhuma revisão de código pegaria,
e nenhum teste de "usuário sem permissão" com um usuário **com** perfil pegaria.

Correção: `COALESCE(..., false)` antes de negar, aplicado a **todas** as RPCs do
módulo (migration `20261010430000`). A migration inclui uma varredura que emite
`WARNING` para qualquer função `prioridades_*` que tenha `NOT (` sem `COALESCE` —
e ela encontrou um segundo caso, `prioridades_alternar_vinculacao`, que além do
`NULL` ainda tinha um `OR admin` reconcedendo a decisão (migration
`20261010440000`).

## Arquivos

| Peça | Caminho |
|---|---|
| Edge Function (proxy + diagnóstico) | `supabase/functions/djen-proxy/index.ts` |
| Cliente | `src/services/prioridadesDjenService.ts` |
| Tipos | `src/types/Prioridades.ts` |
| Testes de máscara/complementação/prazo | `src/__tests__/prioridades/cnjEPrazos.test.ts` |
| Tela de Designações (cadastro de perfis) | `src/components/prioridades/DesignacoesTela.tsx` |
| Decisões de projeto registradas | `supabase/migrations/20261010180000_prioridades_decisoes_registradas.sql` |
| RPCs de designação | `supabase/migrations/20261010190000_prioridades_designacoes_rpc.sql` |
| Provisão de perfil base (bootstrap) | `supabase/migrations/20261010210000_prioridades_provisao_perfil_base.sql` |

## Referência cruzada

## Referência cruzada

- **Pontos ainda em aberto para decisão** (13 pendências da especificação, log de
  acessos e o prazo de 24 h): [PRIORIDADES_URGENCIAS_PENDENCIAS.md](../PRIORIDADES_URGENCIAS_PENDENCIAS.md)
- **Uso do app e roteiro de testes**: [COMO_USAR_PRIORIDADES_URGENCIAS.md](../COMO_USAR_PRIORIDADES_URGENCIAS.md)
- Decisões e pendências da especificação: seção 11 do documento de origem.
- Schema e RLS: migrations `20261010130000_*` e `20261010140000_*`.
- Memória do projeto: [`MEMORIA_MIGRACAO_GERENCIADOR_ATENDE.md`](MEMORIA_MIGRACAO_GERENCIADOR_ATENDE.md).
