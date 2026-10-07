# Como usar o App Prioridades e Urgências

Guia de uso e **roteiro de testes** do módulo de Prioridades e Urgências do
Gerenciador Atende. Cada seção narrativa é também um caso de teste executável:
tem pré-condições, passo a passo e o resultado esperado.

Base: Especificação Técnica v1.0 (out/2026). Decisões de projeto e a integração
com o DJEN estão em [PRIORIDADES_URGENCIAS_DJEN.md](PRIORIDADES_URGENCIAS_DJEN.md).

> **Sobre este roteiro.** Ele foi escrito executando os casos, não apenas
> descrevendo a intenção. Três defeitos reais apareceram nesse processo e foram
> corrigidos antes da publicação: a máscara do processo se perdia quando a
> consulta ao DJEN respondia; a tela de busca de usuários sobrepunha o campo
> seguinte; e — o mais grave — **uma anotação aprovada sem UPJ desaparecia para
> todos os cartórios**, sem que ninguém percebesse. Os casos 2, 4 (variante C) e 7
> cobrem exatamente esses pontos.

---

## 1. Visão geral

O app gerencia o ciclo de vida das **anotações de prioridade/urgência**: um
atendente do TJSP Atende registra durante o atendimento, o Gestor confere e a UPJ
(unidade do cartório) resolve.

O que ele substitui: duas planilhas de Excel sincronizadas em lote, sem
validação, com filtros que se propagavam entre usuários e sem controle de
leitura. O sistema entregue mantém **visibilidade restrita** e
**rastreabilidade integral** de cada transição.

**Como se abre:** na Home do Gerenciador, clique no card
**⚖️ Prioridades e Urgências**.

> **Nota sobre abas:** por padrão o card abre em uma nova aba do navegador
> (`Configurações → abrir cards em nova aba`). Se preferir o modal na mesma
> página, desative essa opção nas configurações do usuário.

### Os três módulos

O módulo exibido é derivado do **seu perfil**, não escolhido livremente — cada
pessoa tem um perfil no app, e uma designação em vigor pode habilitar o módulo
correspondente.

| Módulo | Perfis | O que se faz |
|---|---|---|
| **Atendentes** | Atendente | Registra anotações e responde devoluções |
| **Gestores** | Gestor, Conferente Designado | Confere (aprovar / devolver / rejeitar), marca Urgentíssimo, designa Conferentes |
| **UPJs** | Coordenador, Analista Designado | Analisa (resolver / devolver / rejeitar) as anotações da própria UPJ, designa Analistas |

### Acesso e perfis

Para usar o app a pessoa precisa de:

1. **Conta no Gerenciador** (Supabase Auth) — é o login.
2. **Perfil no app de Prioridades** — criado pela tela *Designações*, no modo
   *Perfil base*.

Sem perfil, o app abre em **modo de visualização** com uma faixa de aviso no
topo. O servidor recusa o registro de anotações, então a faixa não é decorativa.

**Administrador:** quem tem papel global `admin` no Gerenciador enxerga todos os
módulos e é o único que provisiona perfis base. É por ele que o sistema sai do
zero.

> **O admin enxerga tudo, mas não decide por ninguém.** Para conferir, analisar,
> responder devolução, criar anotação ou alterar vinculação automática, o admin
> precisa ter o **perfil correspondente no app** — como qualquer outro usuário.
> Se precisar operar, ele mesmo se atribui o perfil base em
> *Designações → Perfil base* e age identificado, para que o histórico registre
> quem decidiu dentro do seu papel.

> **Sobre a privacidade:** a visibilidade é restrita ao criador, ao
> Gestor/Conferente responsável e à UPJ de destino. A exceção é o `admin`, que
> tem leitura total para suporte — decisão registrada no projeto. A **escrita**
> continua restrita: nem o admin altera anotação alheia fora do fluxo.

---

## 2. Prontidão: o que preparar antes de testar

| Recurso | Onde |
|---|---|
| Usuários | `Boss Only` no Gerenciador (cria/edita contas) |
| Perfis do app | Card Prioridades → **Designações** → *Perfil base* |
| UPJs | Tabela `prioridades_upjs` — 9 UPJs do Fórum Central já semeadas |
| Órgão do DJEN → UPJ | Tabela `prioridades_orgaos_upj` — preenchida incrementalmente |
| Processos reais para teste | API do DJEN (use números com publicação recente) |

**Perfis que você vai querer ter**, para percorrer todos os casos:

| Perfil | Quantidade sugerida | Para que |
|---|---|---|
| Gestor | 1 | Bootstrap, conferência e designação |
| Atendente | 2 | Registrar anotação e demonstrar o round-robin |
| Coordenador (UPJ) | 1 | Designar Analista e resolver na UPJ |
| Analista | 1 | Analisar anotação |

Os dois Atendentes são importantes: com um só, o rodízio de distribuição não fica
evidente.

---

## 3. Caso 1 — Administrador: dar a partida no sistema

**Objetivo:** entender por que o sistema não funciona sozinho no começo, e
destravá-lo.

**Pré-condição:** você tem papel `admin` e nenhum perfil no app. O banco tem as 9
UPJs semeadas e nenhuma anotação.

**Narrativa.** Você abre o card e vê a faixa amarela: *"Seu usuário não tem perfil
no app, mas você é administrador."* O painel lateral lista os módulos, mas nada
acontece de fato — e o motivo é o mais importante deste caso: **a especificação
diz quem designa quem, mas não diz como o primeiro Gestor passa a existir.**

Sem um Gestor, ninguém tem alçada para designar o primeiro Conferente. E sem
Conferente, a fila de conferência não tem para quem distribuir. O sistema precisa
que você crie essa camada inicial.

### Passo a passo

1. Abra o card **⚖️ Prioridades e Urgências**.
2. No painel lateral, clique em **Designações**.
3. No topo do formulário, alterne para **Perfil base (permanente)**.
4. Repare no aviso: *"É por aqui que o primeiro Gestor e o primeiro Coordenador da
   UPJ passam a existir."*
5. Em **Buscar usuário**, digite o nome de quem será Gestor. Selecione o
   resultado.
6. Em **Perfil**, escolha **Gestor**.
7. Clique em **Definir Perfil**. Aguarde a faixa verde de confirmação.
8. Repita para o **Coordenador da UPJ**: busque a pessoa, escolha
   **Coordenador (UPJ)** e selecione a UPJ de destino.
9. Role até **Perfis base no app** — as duas pessoas devem aparecer na tabela.

### Resultado esperado

- Faixa verde: *"<Nome> agora tem perfil de Gestor no app."*
- Tabela **Perfis base no app** com as duas linhas, cada uma com **Remover
  perfil**.
- Ninguém aparece ainda em "Conferentes Designados" nem "Analistas Designados" —
  perfil base **não** é designação.

### O que observar (e por que importa)

| Faixa | O que significa |
|---|---|
| Gestor, Coordenador | Perfil **base**: permanente, define o módulo |
| Conferente, Analista | **Designação**: com período (data ou "Indeterminado") |

São operações diferentes de propósito. Confundir as duas foi o que travou o
fluxo na primeira versão.

### Verificação negativa

Tente **Remover perfil** de alguém que tenha anotação em andamento. A remoção
deve ser **recusada** com a mensagem *"Este usuário tem N anotação(ões) em
andamento."* A integridade dos registros vem antes da conveniência
administrativa.

---

## 4. Caso 2 — Atendente: registrar a anotação (o caminho feliz)

**Objetivo:** percorrer o registro guiado, com validação real de processo.

**Pré-condição:** existe um perfil **Atendente** (o admin provisiona pelo mesmo
caminho do Caso 1, escolhendo *Atendente*). Você tem em mãos um número de
processo **do Fórum Central Cível** com publicação recente no DJEN.

> **Como conseguir um número.** Consulte
> `https://comunicaapi.pje.jus.br/api/v1/comunicacao?siglaTribunal=TJSP&itensPorPagina=5`
> ou use um processo que você já saiba ter andamento. Um exemplo que funciona:
> `1076547-84.2025.8.26.0100`.

**Narrativa.** Chega um advogado no Balcão Virtual relatando que há decisão com
menção expressa a "URGENTE". Você precisa registrar isso de forma que a UPJ
certa receba, sem digitar errado o número do processo nem escolher a Vara na mão.

### Passo a passo

1. Abra o card. O módulo abre em **Atendentes** (rótulo "Módulo Atendentes" no
   painel).
2. Clique em **+ Nova Anotação** (no painel principal) ou **Nova Anotação** (no
   rodapé do painel lateral).
3. Em **N.º do Processo**, digite apenas os números:
   `10765478420258260100`. A máscara CNJ é aplicada enquanto você digita.
4. Ao completar 20 dígitos, a verificação no DJEN dispara sozinha (ou clique em
   **Verificar**).
5. Observe o bloco **Indicador de Localização do Processo**.
6. Preencha **Solicitante** → `Autor/Exequente`.
7. Preencha **Tipo de Prioridade/Urgência** → `Consta "URGENTE" na
   decisão/sentença`.
8. Leia o **aviso contextual** que aparece abaixo do campo.
9. Em **Sistema**, escolha `Eproc` (opcional).
10. Confira **UPJ de destino** — deve estar preenchida automaticamente.
11. Preencha **Evento(s) ou Folha(s)**: `Evento 45`.
12. Preencha **Descrição da Prioridade/Urgência** com o relato do solicitante.
13. Em **Observações Adicionais**, escreva algo que **não** deve chegar à UPJ:
    `Solicitante relatou que tem audiência na semana que vem.`
14. Clique em **Enviar Anotação**.

### Resultado esperado

No indicador de localização:

```
Localizado no DJEN · N comunicação(ões) · última em AAAA-MM-DD
Vara: 26ª
Órgão: UPJ da 26ª a 30ª Varas Cíveis - Foro Central Cível (idOrgao 98517)
UPJ: FCC-26-30 — UPJ da 26ª a 30ª Varas Cíveis
Sistema: informe abaixo — o DJEN não informa se o processo tramita no Eproc ou no SAJ.
```

Após enviar: faixa verde *"Anotação N registrada e enviada para conferência do
Gestor."* A anotação aparece em **Ag. Conferência** com contador `1`.

### O que observar

- **A UPJ foi deduzida, não escolhida.** O DJEN devolve o órgão publicador, e o
  sistema traduz isso na UPJ. Ninguém digitou "26ª Vara".
- **"Sistema" não vem da API.** O DJEN não sabe se o processo é Eproc ou SAJ —
  por isso o campo é seu, e é opcional.
- **O aviso contextual ensina o enquadramento.** Ele diz que, sem menção expressa
  a "urgente", a anotação será rejeitada. É o RF-ATD-07 em ação.

### Variante — número truncado (RF-ATD-02)

Digite só `1076547-84.2025` (13 dígitos) e clique em **Verificar**. O sistema
completa com o sufixo `8.26.0100`, tenta a verificação e registra na validação
que o número foi complementado automaticamente.

### Variante — processo sem publicação no DJEN

Use um número que não tenha publicação recente. O retorno é:

> *"Nenhuma comunicação publicada no DJEN para este processo na janela
> consultada. Isso não confirma que o processo não existe — a anotação pode
> seguir normalmente."*

**Isso é comportamento correto, não falha.** O DJEN é um diário: só conhece
processo que teve publicação. A anotação segue, mas a UPJ precisará ser
selecionada à mão.

---

## 5. Caso 3 — Atendente: a validação impede o envio incompleto

**Objetivo:** verificar o RF-ATD-11 (validação no envio).

**Narrativa.** Você está com pressa e tenta enviar só com o número do processo.

### Passo a passo

1. **Nova Anotação** → informe o processo e clique em **Enviar Anotação**.

### Resultado esperado

Bloco vermelho com a lista exata do que falta:

```
Preencha os campos obrigatórios:
• Tipo de Solicitante
• Tipo de Prioridade/Urgência
• Evento ou Folhas
• Descrição da Prioridade/Urgência
```

Nada é gravado. O servidor repete a validação — a checagem da tela é conveniência,
não a única barreira.

### Variante — "Outros" exige descrição

Escolha `Outros` em **Solicitante** e em **Tipo de Prioridade/Urgência**. Dois
campos adicionais aparecem, ambos obrigatórios:

- **Descrição do(s) Solicitante**
- **Descrição do Tipo de Prioridade/Urgência (Outros)**

O segundo tem rótulo diferente do campo principal de propósito — a especificação
apontava essa ambiguidade como pendência, e ela foi resolvida assim.

---

## 6. Caso 4 — Gestor: conferir, corrigir e enviar à UPJ

**Objetivo:** percorrer a fila de conferência, usar a marcação Urgentíssimo e a
correção de texto.

**Pré-condição:** existe ao menos uma anotação em `Ag. Conferência`, registrada
pelo Caso 2. Você tem perfil **Gestor**.

**Narrativa.** Como Gestor, sua função é conferir antes de a UPJ receber. A
anotação do Caso 2 tem o pedido certo, mas o texto está confuso. Você corrige e
marca como Urgentíssimo, porque há prazo curto.

### Passo a passo

1. Entre com o usuário Gestor e abra o card. O módulo abre em **Gestores**.
2. Na tela inicial, localize a seção **Anotações Aguardando Conferência**.
3. Clique na anotação. Abre a tela **Conferência de Anotação**.
4. Confira os rótulos: **Data da Anotação**, **Nome do Atendente**,
   **Conferente vinculado**, **Conferido por**.
5. Em **Descrição da Prioridade/Urgência**, reescreva o texto de forma mais clara.
6. Observe o aviso amarelo que aparece: *"Texto original preservado em
   'Observação Adicional' (RF-GES-03)"*, com o texto antigo em itálico.
7. Em **Observação Adicional (registro da correção)**, escreva o motivo:
   `Texto reescrito para clareza; pedido mantido.`
8. Role até o bloco **Observações internas do TJSP Atende**. Confirme que a
   observação escrita pelo Atendente no Caso 2 está visível **aqui** — e observe
   a nota de que ela não é repassada à UPJ.
9. **Confira o campo UPJ de destino.** Se a detecção automática tiver funcionado,
   ele já vem preenchido. Se estiver vazio, o campo aparece realçado em amarelo
   com a explicação — **escolha a UPJ**, porque a aprovação exige destino.
10. Em **Decisão de conferência**, marque **Aprovar**.
11. Marque a caixa **Marcar como Urgentíssimo**.
12. Clique em **Enviar para UPJ**.

### Resultado esperado

- Faixa verde: *"Anotação N enviada para a UPJ."*
- A anotação sai de **Ag. Conferência** e aparece em **Pendentes** (status
  `upj-pendente`).
- Ao reabri-la, o texto corrigido é o principal e o original está preservado.
- **Urgentíssimo** aparece em destaque vermelho.

### O que observar

- **A observação interna não vai para a UPJ.** Entre com o usuário Coordenador e
  abra a mesma anotação: o bloco *Observações internas do TJSP Atende* **não**
  aparece na tela de análise. Esse é o RF-GER-02 funcionando.
- **A data de cada etapa fica registrada.** Abra **Histórico** na anotação: há
  um evento para a criação, um para a aprovação e um para a remessa à UPJ, com
  autor e horário.

### Variante A — Devolver com correção automática engatilhada

Repita o fluxo com outra anotação, mas:

1. Marque **Devolver**.
2. Escreva a **Justificativa**: `Falta indicar o evento da decisão.`
3. Marque **Incluir Correção Automática** e escreva o texto corrigido.
4. Clique em **Enviar Devolução**.

Resultado: a anotação vai para **Devolvidas** e o Atendente vê o prazo de 24 h
correndo. Se ele não responder, o sistema **aplica a correção e remete à UPJ em
vez de rejeitar** (ver Caso 8).

### Variante B — Rejeitar

Marque **Rejeitar**, escreva a justificativa e clique em **Arquivar**. A
anotação vai para **Rejeitadas** e não chega à UPJ.

### Variante C — Aprovar sem UPJ é bloqueado (verificação negativa)

Este é um comportamento **proposital** e vale testar, porque ele evita uma perda
silenciosa.

1. Registre uma anotação com um processo **sem publicação no DJEN**, de modo que
   a UPJ não seja detectada automaticamente.
2. Como Gestor, abra a conferência e marque **Aprovar** sem escolher a UPJ.
3. Clique em **Enviar para UPJ**.

**Resultado esperado:**

> *"Defina a UPJ de destino antes de enviar. Sem UPJ a anotação não é visível por
> nenhum cartório."*

A anotação **permanece** em Ag. Conferência, e o campo UPJ fica realçado em
amarelo com o nome do órgão devolvido pelo DJEN, para orientar a escolha.

**Por que isso existe:** sem essa barreira, a anotação era aprovada, ia para
`upj-pendente` e **desaparecia para todas as UPJs** — o isolamento por unidade
compara a UPJ da anotação com a do usuário, e com destino nulo ninguém a
enxergava. Nem o Atendente nem o Gestor percebiam. Foi um defeito encontrado
durante a preparação deste roteiro, e a correção está na migration
`20261010230000_prioridades_upj_obrigatoria_na_aprovacao.sql`.

**Note que devolver e rejeitar continuam funcionando sem UPJ** — só a aprovação
exige destino, porque só ela remete à UPJ.

---

## 7. Caso 5 — Atendente: responder uma devolução

**Objetivo:** percorrer o RF-ATD-14 e a contagem regressiva do RF-ATD-15.

**Pré-condição:** o Gestor devolveu uma anotação (Variante A do Caso 4), e ela é
do seu usuário.

**Narrativa.** O Gestor devolveu sua anotação pedindo o evento da decisão. Você
tem 24 horas para responder. O item **Devolvidas** no painel está realçado em
vermelho com contador.

### Passo a passo

1. Entre com o Atendente e abra o card.
2. Repare que **Devolvidas** aparece em **vermelho com contador** — é o realce do
   RF-ATD-13.
3. Clique na anotação devolvida.

### Resultado esperado na tela "Anotação Devolvida"

- **Prazo para Resposta** com contagem regressiva em `hh:mm` (ex.: `23:47`).
- **Justificativa do Gestor** — preenchida e **inativa** (não editável).
- **Resposta do Atendente** — campo livre e obrigatório.
- Abaixo, a linha divisória e os **campos da anotação original**, todos inativos.

### Passo a passo (continuação)

4. Escreva a resposta: `Evento 52 — decisão de fls. 210.`
5. Clique em **Enviar Resposta**.

### Resultado esperado

Faixa verde: *"Resposta enviada. A anotação N retornou para Ag. Conferência do
Gestor."*

**Ponto importante e contraintuitivo:** a resposta volta para o **Gestor**, não
direto para a UPJ — mesmo quando a devolução partiu da UPJ. É o que a
especificação determina, e o texto na tela avisa disso.

### O que observar

- O Gestor agora vê, na tela de conferência, um rótulo **Retorno de Devolução** e
  a sua resposta em bloco próprio.
- O **Histórico** registra o evento `resposta_devolucao` com o seu texto.

---

## 8. Caso 6 — UPJ: analisar e resolver

**Objetivo:** percorrer o módulo UPJ, com isolamento por unidade.

**Pré-condição:** existe uma anotação em `upj-pendente` destinada à UPJ do
usuário, e você tem perfil **Coordenador** ou **Analista** vinculado a essa UPJ.

**Narrativa.** A UPJ recebeu a anotação aprovada pelo Gestor. Como Coordenador,
você analisa e cumpre o ato cartorário. O sistema isola você da operação dos
outros cartórios: você só vê o que é da sua UPJ.

### Passo a passo

1. Entre com o Coordenador. O módulo abre em **UPJs** (rótulo "Módulo UPJs").
2. Observe o painel lateral: **Urgentíssimas**, Reiteradas, Pendentes,
   Analisadas, Resolvidas, Devolvidas, Aprovadas, Rejeitadas, Histórico,
   Designações.
3. A tela inicial mostra três listas: **Anotações Urgentíssimas**, **Reiteradas**
   e **Pendentes**.
4. Clique na anotação que o Gestor marcou como Urgentíssimo (Caso 4). Ela aparece
   com o selo **⚡ Urgentíssimo**.
5. Confira os rótulos do topo: Data, Atendente, **Gestor/Conferente**, Analista
   vinculado.
6. **Confirme que o bloco "Observações internas do TJSP Atende" NÃO aparece.**
   Ele é de uso interno do TJSP Atende e não é repassado às UPJs.
7. Em **Decisão da UPJ**, marque **Resolver**.
8. Em **Observações Adicionais (uso interno da UPJ)**, escreva:
   `Expedido ofício de fls. 214; cumprido em 06/10.`
9. Clique em **Arquivar**.

### Resultado esperado

- Faixa verde: *"Anotação N resolvida pela UPJ."*
- A anotação vai para **Resolvidas** e some de **Pendentes**.
- No **Histórico**, evento `resolucao_upj` com a sua observação e seu nome como
  analisador.

### O que observar — isolamento

Pergunte à UPJ vizinha: um usuário de **outra** UPJ não vê esta anotação em
nenhuma lista. Se tentar abrir pela URL, recebe "não encontrada ou sem permissão".
O isolamento é aplicado **no banco** (RLS), não só na tela.

### Variante — devolver ao TJSP Atende

Marque **Devolver**, escreva a justificativa e clique em **Enviar Devolução**. A
anotação vai para **Devolvidas (UPJ)**, o Atendente ganha 24 h para responder e,
ao responder, ela volta para **Ag. Conferência do Gestor** — preservando todo o
histórico.

### Variante — "Incluir Arquivamento Automático"

Marque **Rejeitar** e observe a caixa **Incluir Arquivamento Automático**. Ela
exibe o aviso de que **o comportamento não está definido na especificação**
(pendência 5): o valor é registrado, mas nenhuma ação automática é executada. É
uma pendência aberta exposta de forma honesta na interface.

---

## 9. Caso 7 — Gestor: designar Conferentes e ver o rodízio

**Objetivo:** percorrer o RF-GES-06 e o RF-GES-07 (distribuição round-robin).

**Pré-condição:** você tem perfil **Gestor**. Há **dois** usuários atendentes
disponíveis para designar.

**Narrativa.** A conferência não pode depender de uma pessoa. Você designa dois
Conferentes e o sistema passa a distribuir as anotações de forma cíclica entre
eles, para não sobrecarregar ninguém.

### Passo a passo

1. Entre como Gestor → **Designações**.
2. No formulário, mantenha **Designação (com período)**.
3. Busque o primeiro usuário. Selecione.
4. **Perfil**: `Conferente Designado`.
5. **Início**: hoje. Deixe **Indeterminado** marcado.
6. Clique em **Incluir Designação**.
7. Repita para o segundo usuário.
8. Confira a tabela **Conferentes Designados (2)**: nome, e-mail, período com o
   selo *Indeterminado*, coluna **Na fila** e o controle **Vinculação
   automática**.

### Resultado esperado — o rodízio

Peça a dois Atendentes que registrem **uma anotação cada**, em sequência. Volte a
esta tela e observe a coluna **Na fila**: as anotações se distribuem **uma para
cada** Conferente, e não todas para o primeiro.

Vá à tela **Ag. Conferência**, abra as anotações e confirme em
**Conferente vinculado** que os responsáveis são diferentes.

### O que observar

- **Vinculação automática desabilitada** tira a pessoa do rodízio. Desmarque um
  dos Conferentes, registre mais duas anotações e veja que **todas** vão para o
  que ficou habilitado.
- **Período com data final.** Desmarque *Indeterminado*, informe uma data e
  inclua. A designação passa a ter prazo, e o rodízio deixa de considerá-la
  depois do vencimento.
- **Encerrar.** Clique em **Encerrar** em uma designação. Ela sai da lista de
  ativas e vai para **Designações encerradas**. Se era a última da pessoa, o
  perfil base de designado também é removido — a pessoa volta a "sem perfil no
  app", em vez de ficar com um perfil que não corresponde a nada.

### Verificação negativa — alçadas

| Tentativa | Resultado esperado |
|---|---|
| Coordenador tentar designar **Conferente** | Recusado: *"A designação de Conferentes cabe ao Gestor do TJSP Atende."* |
| Usuário comum tentar definir **Coordenador** | Recusado: *"Definir o perfil de Gestor ou de Coordenador da UPJ cabe ao administrador do sistema."* |
| Coordenador buscar usuário de outra UPJ | Não aparece na busca — a busca é restrita à própria UPJ |

---

## 10. Caso 8 — O prazo de 24 h expira

**Objetivo:** verificar o RF-ATD-15 e o RF-GER-06 (temporizador), incluindo a
correção automática.

**Pré-condição:** existe uma anotação em `Devolvidas`. Idealmente duas: uma
**com** correção automática engatilhada e uma **sem**.

**Narrativa.** Ninguém respondeu à devolução dentro de 24 horas. O que acontece
depende de o Gestor ter ou não engatilhado uma correção automática:

- **Sem** correção: a anotação é **rejeitada automaticamente**.
- **Com** correção: o sistema **aplica o texto corrigido e remete à UPJ** em vez
  de rejeitar.

### Como acelerar o teste

O prazo é de 24 horas, então não convém esperar. Antecipe o vencimento pelo SQL
Editor do Supabase:

```sql
UPDATE public.prioridades_anotacoes
SET prazo_resposta_em = now() - interval '1 minute'
WHERE id = <ID_DA_ANOTACAO>;
```

Em produção quem executa a varredura é um job `pg_cron` a cada 10 minutos. Para
testar na hora, execute a rotina manualmente:

```sql
SELECT public.prioridades_processar_prazos_vencidos();
```

O retorno é um JSON com o que foi processado:

```json
{ "sucesso": true, "rejeitadas": 1, "correcoes_aplicadas": 1 }
```

### Resultado esperado

| Situação | Status final | Verificação |
|---|---|---|
| Devolvida pelo Gestor, sem correção | `gestor-rejeitada` | Aparece em **Rejeitadas** do Atendente |
| Devolvida pelo Gestor, **com** correção | `upj-pendente` | Aparece em **Pendentes** da UPJ, com o texto corrigido como descrição principal |
| Devolvida pela UPJ, sem correção | `upj-rejeitada` | Aparece em **Rejeitadas** |

Em todos os casos o **Histórico** registra o evento
`rejeicao_automatica_prazo` ou `correcao_automatica`, com a justificativa
padrão: *"Prazo de 24 h expirado sem resposta do Atendente."*

### O que observar

- Na tela de resposta, quando o prazo já venceu, o botão **Enviar Resposta**
  fica bloqueado e a contagem mostra **"Prazo encerrado"**.
- **A correção é silenciosa:** o Atendente não é notificado dela antes da remessa
  à UPJ. É o que a especificação pede.

---

## 11. Caso 9 — O indicador de anotações prévias (120 dias)

**Objetivo:** verificar o RF-ATD-12.

**Narrativa.** O mesmo processo volta a ser questionado semanas depois. O
sistema avisa que já houve anotação, para o atendente não repetir trabalho nem
contradizer o que já foi decidido.

### Passo a passo

1. Registre uma anotação para um processo (Caso 2). Anote o número.
2. Registre **outra** anotação para o **mesmo** processo.
3. Ao completar o número na segunda vez, observe o topo do formulário.

### Resultado esperado

Bloco em destaque amarelo, acima do campo de processo:

```
⚠️ Este processo já possui 1 anotação(ões) nos últimos 120 dias
#1  [Ag. Conferência]  dd/mm/aaaa · <descrição>
```

Cada linha traz o **status atual** da anotação anterior — é o que permite ao
atendente saber se o caso já foi resolvido ou ainda está parado.

### O que observar

O indicador depende do processo, não do DJEN: ele funciona mesmo quando a
consulta externa falha ou o processo não tem publicação. É uma consulta ao próprio
banco.

---

## 12. Caso 10 — Histórico e rastreabilidade

**Objetivo:** verificar o RF-GER-04 (histórico preservado).

**Narrativa.** Meses depois, alguém pergunta o que aconteceu com uma anotação:
quem registrou, quem devolveu, por quê, quem respondeu, quando a UPJ resolveu. A
resposta tem que estar inteira.

### Passo a passo

1. Percorra um ciclo completo com uma anotação: **registrar → devolver →
   responder → aprovar → resolver**. São 5 transições.
2. Abra o card e clique em **Histórico** no painel lateral.
3. Use o filtro **Somente as minhas** ou busque pelo número do processo.
4. Clique em **Trilha** na anotação.

### Resultado esperado

Trilha cronológica (mais recente primeiro) com **todas** as transições:

```
resolucao_upj       · <Coordenador>  · dd/mm/aaaa hh:mm · upj-pendente → upj-resolvida
remessa_upj         · <Gestor>       · dd/mm/aaaa hh:mm · gestor-aprovada → upj-pendente
aprovacao           · <Gestor>       · dd/mm/aaaa hh:mm · gestor-conferencia → gestor-aprovada
resposta_devolucao  · <Atendente>    · dd/mm/aaaa hh:mm · gestor-devolvida → gestor-conferencia
devolucao_gestor    · <Gestor>       · dd/mm/aaaa hh:mm · gestor-conferencia → gestor-devolvida
criacao             · <Atendente>    · dd/mm/aaaa hh:mm · gestor-conferencia
```

Cada linha mostra **evento, autor, data/hora e o conteúdo** (justificativa,
resposta ou texto da correção).

### O que observar

- **Nada é apagado.** Não existe ação de excluir anotação em nenhuma tela. A
  especificação proíbe, e o banco não tem política de exclusão — a remoção é
  impossível pela aplicação.
- **A trilha sobrevive à devolução.** Mesmo quando a anotação volta e é
  reenviada, os eventos anteriores permanecem.

---

## 13. Matriz de cobertura dos requisitos

Use esta tabela para conferir se todos os requisitos implementados foram
exercitados.

| Requisito | O que é | Caso |
|---|---|---|
| RF-ATD-01 | Máscara do número CNJ | 2 || RF-ATD-02 | Complementação de número truncado | 2 (variante) |
| RF-ATD-03 | Validação do processo via API + indicadores | 2 |
| RF-ATD-04 | Detecção automática da UPJ | 2 |
| RF-ATD-05 | Tipo de Solicitante (lista fechada + Outros) | 2, 3 |
| RF-ATD-06 | Tipo de Prioridade/Urgência (lista fechada + Outros) | 2, 3 |
| RF-ATD-07 | Avisos contextuais por tipo | 2 |
| RF-ATD-08 | Evento(s)/Folha(s) obrigatório | 2, 3 |
| RF-ATD-09 | Descrição obrigatória | 2, 3 |
| RF-ATD-10 | Observações internas (ocultas à UPJ) | 2, 4, 6 |
| RF-ATD-11 | Validação no envio + roteamento por perfil | 2, 3 |
| RF-ATD-12 | Indicador de anotações prévias (120 dias) | 9 |
| RF-ATD-13 | Realce de devoluções no painel | 5 |
| RF-ATD-14 | Resposta à devolução | 5 |
| RF-ATD-15 | Prazo de 24 h e rejeição automática | 5, 8 |
| RF-GES-01 | Fila de conferência imediata | 4 |
| RF-GES-02 | Decisão de conferência (aprovar/devolver/rejeitar) | 4 |
| RF-GES-03 | Edição/correção na conferência | 4 |
| RF-GES-04 | Marcação Urgentíssimo | 4, 6 |
| RF-GES-05 | Correção automática engatilhada | 4, 8 |
| RF-GES-06 | Designação de Conferentes | 7 |
| RF-GES-07 | Distribuição round-robin | 7 |
| RF-GES-08 | Painéis e listas com contadores | 4, 7 |
| RF-UPJ-01 | Recebimento automático e isolamento por UPJ | 6 |
| RF-UPJ-02 | Tela inicial e painel lateral da UPJ | 6 |
| RF-UPJ-03 | Análise (resolver/devolver/rejeitar) | 6 |
| RF-UPJ-04 | Devolução ao TJSP Atende em 24 h | 6, 8 |
| RF-UPJ-05 | Designação de Analistas | 7 |
| RF-UPJ-06 | Distribuição automática na UPJ | 7 |
| RF-GER-01 | Autenticação e perfis | 1 |
| RF-GER-02 | Visibilidade restrita | 4, 6 |
| RF-GER-03 | Integridade dos registros | 1, 10 |
| RF-GER-04 | Histórico e rastreabilidade | 10 |
| RF-GER-06 | Temporizadores | 8 |

---

## 14. O que ainda NÃO está implementado

Testar o que não existe gera chamado desnecessário. Estas são as lacunas
conhecidas.

> Os pontos abaixo estão detalhados, com opções e recomendação, em
> [PRIORIDADES_URGENCIAS_PENDENCIAS.md](PRIORIDADES_URGENCIAS_PENDENCIAS.md).

| Item | Situação |
|---|---|
| **RF-GER-05 — log de acessos** | Não implementado. O schema está a definir na própria especificação. |
| **Status Reiterada e Analisada** | Existem no banco e aparecem nos painéis, mas **nenhuma ação os produz** — a especificação não definiu as regras de transição (pendência 1). |
| **Critérios de Urgentíssimo** | A marcação existe; os **critérios de enquadramento** não foram definidos (pendência 3). |
| **Arquivamento Automático (UPJ)** | A caixa existe e o valor é gravado, mas nenhuma ação automática ocorre (pendência 5). |
| **Callback ao Solicitante** | Está no backlog da especificação (fora do escopo inicial). |
| **Integração com o Balcão Virtual** | Backlog. |
| **Notificação ao Atendente** | O RF-ATD-13 menciona como opcional; o realce existe, a notificação não. |

Também não existem telas de: edição de anotações já encerradas, cancelamento de
anotação, ou relatórios/exportação.

---

## 15. Problemas comuns ao testar

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Faixa amarela "não possui perfil cadastrado" | Usuário sem perfil no app | Admin provisiona em **Designações → Perfil base** |
| "Apenas Gestor ou Coordenador da UPJ pode buscar usuários" | Seu perfil não tem alçada de designação | Use a conta de Gestor, ou o admin |
| DJEN retorna "nenhuma comunicação publicada" | Processo sem publicação, ou janela de consulta sem resultado | Não é falha — o DJEN é um diário. Selecione a UPJ à mão |
| "Limite de requisições do DJEN atingido" | Rate limit da API pública | Aguarde 1 minuto; o sistema suspende novas consultas nesse intervalo |
| "Acesso recusado pela API do DJEN (HTTP 403)" | Geo-bloqueio de IP fora do Brasil | Ver a seção de integração; hoje o egress do projeto é brasileiro |
| UPJ não detectada, campo vazio | Órgão do DJEN ainda não mapeado | Selecione a UPJ manualmente na conferência; o mapeamento é incremental |
| "Defina a UPJ de destino antes de enviar" | Aprovação sem UPJ definida | Escolha a UPJ no campo realçado — sem ela a anotação não chega a nenhum cartório |
| "Perfil inválido para esta operação" | Tentativa de designar fora das alçadas | Verifique o perfil escolhido e quem está operando |
| Anotação não aparece para o outro usuário | Visibilidade restrita (por desenho) | Só o criador, o Gestor responsável e a UPJ de destino a veem |
| Erro de execução ao chamar RPC por script com `service_role` | `auth.uid()` é nulo nesse caminho | Use sessão de usuário autenticado (login), não a service role |

---

## 16. Checklist rápido de homologação

- [ ] Admin provisiona Gestor e Coordenador (Caso 1)
- [ ] Admin provisiona Atendente (Caso 1)
- [ ] Atendente registra anotação com processo válido, UPJ detectada (Caso 2)
- [ ] Envio incompleto é bloqueado com a lista de pendências (Caso 3)
- [ ] Gestor corrige texto, marca Urgentíssimo e envia à UPJ (Caso 4)
- [ ] Aprovar sem UPJ é recusado com orientação (Caso 4, variante C)
- [ ] UPs: anotação aprovada fica visível para a UPJ de destino (Caso 4 e 6)
- [ ] Observação interna não aparece no módulo UPJ (Casos 4 e 6)
- [ ] Atendente responde devolução; resposta volta ao Gestor (Caso 5)
- [ ] UPJ resolve; outra UPJ não vê a anotação (Caso 6)
- [ ] Rodízio distribui entre os Conferentes designados (Caso 7)
- [ ] Prazo expirado rejeita sem correção e remete com correção (Caso 8)
- [ ] Indicador de 120 dias aparece na segunda anotação do mesmo processo (Caso 9)
- [ ] Histórico preserva as 5 transições com autor e data (Caso 10)
- [ ] Alçadas recusam designação fora de perfil (Casos 1 e 7)
