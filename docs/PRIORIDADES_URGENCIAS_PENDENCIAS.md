# Prioridades e Urgências — pontos para decisão

Documento de decisão do app "Prioridades e Urgências". Cada ponto tem contexto,
opções com o que se ganha e o que se perde, recomendação da equipe técnica e o
que é necessário para fechar.

**Origem:** Especificação Técnica v1.0 (out/2026), seção 11, mais dois pontos
levantados na implementação. Nada aqui foi decidido — todos aguardam definição da
área de negócio ou da STI.

**Estado atual:** o fluxo funcional está implementado e testado de ponta a ponta
(registro, conferência, devolução, resposta, análise e histórico). O que segue em
aberto não impede o uso, mas **três itens** afetam regra de negócio em produção:
PD-01 (prazo de 24 h), PD-02 (status Reiterada) e PD-03 (status Analisada). Os
demais são de escopo, nomenclatura ou auditoria.

## Resumo

| ID | Ponto | Natureza | Decide quem | Bloqueia uso? |
|---|---|---|---|---|
| PD-01 | Prazo de 24 h: corridas ou úteis | Regra de negócio | TJSP Atende | Não, mas gera rejeição discutível |
| PD-02 | Status **Reiterada (UPJ)** | Regra de negócio | TJSP Atende + UPJs | Sim, é funcionalidade ausente |
| PD-03 | Status **Analisada (UPJ)** | Regra de negócio | TJSP Atende + UPJs | Sim, é funcionalidade ausente |
| PD-04 | Aprovada (Gestor) × Pendente (UPJ) | Modelagem | STI | Não — já resolvido tecnicamente, falta homologar |
| PD-05 | Critérios de "Urgentíssimo" | Regra de negócio | TJSP Atende | Não |
| PD-06 | Obrigatoriedade das Observações internas | Regra de negócio | TJSP Atende | Não |
| PD-07 | "Incluir Arquivamento Automático" (UPJ) | Regra de negócio | UPJs + STI | Não |
| PD-08 | Campo "Nome do Solicitante" | Escopo | TJSP Atende | Não |
| PD-09 | Rótulo do campo adicional de "Outros" | Nomenclatura | TJSP Atende | Não |
| PD-10 | Controle de vinculação automática na UPJ | Regra de negócio | TJSP Atende | Não |
| PD-11 | Composição do rótulo "Aprovadas" | Nomenclatura | TJSP Atende | Não |
| PD-12 | Nomenclatura do tipo PCD | Nomenclatura | TJSP Atende | Não |
| PD-13 | Log de acessos (RF-GER-05) | Segurança/auditoria | STI | Não |
| PD-14 | Bases de cálculo dos 24 h × mudança de calendário | Técnica | STI | Não |

> **Sobre a escolha da API (pendência 9 da especificação).** O documento previa
> decidir entre DataJud e MNI. A escolha foi feita na prática: a integração usa o
> **DJEN (Comunica PJe)**, que é a única das três que devolve o órgão publicador —
> é o que permite detectar a UPJ automaticamente. O detalhamento está em
> [PRIORIDADES_URGENCIAS_DJEN.md](implementation-guides/PRIORIDADES_URGENCIAS_DJEN.md).
> **Resta confirmar com a STI se essa escolha é aceita como definitiva.** Não tem
> ID próprio por já estar resolvido.

---

# Parte I — Pendências da especificação (seção 11)

## PD-01 — Prazo de 24 h: horas corridas ou úteis?

**Origem:** pendência 8 da especificação.

**Como está hoje:** **horas corridas**. O prazo é gravado no momento da devolução
como `prazo_resposta_em = now() + interval '24 hours'` e uma rotina agendada
(a cada 10 minutos) rejeita ou aplica a correção automática quando vence. Fins de
semana, feriados e recesso **contam** no prazo.

**Por que importa:** uma devolução feita na sexta às 17h vence no sábado às 17h.
O Atendente não está trabalhando, o prazo vence, e a anotação é rejeitada
automaticamente — possivelmente de forma considerada injusta pela equipe.

### Opções

| Opção | O que se ganha | O que se perde |
|---|---|---|
| **A. Manter horas corridas** | Contagem regressiva é simples e sempre verdadeira; nenhuma infraestrutura nova; nenhuma manutenção anual | Devolução perto de fim de semana/feriado dá menos tempo útil de resposta |
| **B. Horas úteis** | Prazo reflete o tempo real de trabalho | Exige calendário de dias úteis mantido e correto. Sem ele, o cálculo rejeita anotação indevidamente |
| **C. Horas corridas + trava de sexta** | Resolve o caso mais incômodo sem calendário: devolução após, por exemplo, 15h de sexta só vence na segunda | Regra um pouco arbitrária; não cobre véspera de feriado |

### Informação nova que reduz o custo da opção B

**Já existe** no projeto a tabela `escala_agenda_institucional` (módulo Escala),
com os tipos `feriado`, `emenda` e `recesso`, e conteúdo real cadastrado —
inclusive o Recesso Judiciário de 20/12 a 06/01. Ou seja, a opção B **não exige
criar** a estrutura de feriados, apenas consultá-la.

O custo restante da opção B é de **processo**, não de código: alguém precisa
manter o calendário atualizado todo ano (feriados móveis, portarias de suspensão
de expediente). Se ninguém mantiver, o cálculo erra e rejeita anotação.

### Recomendação técnica

**Opção A por agora**, migrando para B quando houver responsável definido pela
manutenção do calendário. A rejeição automática é um estado do fluxo, reversível,
e a contagem regressiva está visível ao Atendente desde a devolução — o prazo não
é surpresa.

**Para decidir, precisamos de:** (1) o prazo conta fins de semana e recesso? (2)
quem mantém o calendário de dias úteis, se a resposta for "não conta"?

---

## PD-02 — Status **Reiterada (UPJ)**: quando ocorre?

**Origem:** pendência 1 da especificação.

**Como está hoje:** o status existe no banco (`upj-reiterada`) e **aparece como
item no painel lateral** de Gestores e UPJs, com contador. Mas **nenhuma ação do
sistema o produz**. É um item de menu permanentemente vazio.

**O que a especificação diz:** apenas que o status consta do schema e dos menus,
"mas sem regras de entrada/saída".

**Interpretação provável** (a confirmar): "reiterar" seria a UPJ sinalizar que a
anotação já foi repassada antes e voltou, ou que precisa de reforço de urgência.
O glossário define *Anotação* como pedido de cumprimento prioritário, e o sistema
já tem "anotações prévias (120 dias)" — pode haver relação.

### Opções

| Opção | Descrição | Consequência |
|---|---|---|
| **A. Remover do escopo v1** | Tirar o item do painel até haver regra | Menu fica coerente com o que existe; perde-se o lugar reservado |
| **B. UPJ reitera uma anotação** | Ação da UPJ sobre anotação pendente: "reitero o pedido", gerando registro no histórico | Nova ação no fluxo; precisa definir se altera prioridade ou só registra |
| **C. Reiteração automática** | O sistema marca como Reiterada quando o mesmo processo recebe nova anotação em 120 dias | Não exige ação humana; mas muda o significado de "reiterada" para "reincidente" |
| **D. Reiteração pelo Gestor** | O Gestor reitera ao detectar que a UPJ não cumpriu no prazo | Introduz prazo de cumprimento na UPJ, que hoje não existe |

### Recomendação técnica

**Opção B**, com efeito mínimo: reiterar **registra no histórico** e move para
`upj-reiterada`, que volta a `upj-pendente` quando a UPJ age. Isso dá
rastreabilidade sem criar novo prazo nem nova obrigação.

**Para decidir, precisamos de:** quem reitera (UPJ, Gestor ou ambos), e o que a
reiteração **muda** além de marcar.

---

## PD-03 — Status **Analisada (UPJ)**: quando ocorre?

**Origem:** pendência 1 da especificação (mesmo item da PD-02).

**Como está hoje:** o status existe (`upj-analisada`) e aparece no painel de
Gestores e UPJs. Também **não é produzido por nenhuma ação**.

**Onde está a confusão:** o sistema já tem **Resolvida (UPJ)**, que é o desfecho
normal (anotação cumprida). "Analisada" ficaria como um estado intermediário:
a UPJ analisou mas ainda não cumpriu. Só que a tela de análise **não tem** a
opção "apenas analisar" — as decisões são Resolver, Devolver ou Rejeitar.

### Opções

| Opção | Descrição | Consequência |
|---|---|---|
| **A. Remover do escopo v1** | Tirar do painel; "Resolvida" cobre o desfecho | Menu coerente; perde-se o registro de "em cumprimento" |
| **B. Analisar ≠ Resolver** | Nova decisão "Analisar": registra o parecer da UPJ e mantém pendente | Dá visibilidade de andamento ao Gestor; exige campo de parecer |
| **C. Analisada automática** | Ao abrir a anotação, a UPJ marca leitura e ela passa a Analisada | Usa o status como "ciente"; automatiza sem decisão humana |
| **D. Fundir com Resolvida** | Manter o valor no banco por compatibilidade, mas não exibir | Baixo custo; o valor fica órfão no domínio |

### Recomendação técnica

**Opção B**, porque responde a uma dor real: hoje o Gestor não sabe se a UPJ
sequer olhou a anotação. "Analisar" com parecer dá esse sinal sem inventar prazo.

**Para decidir, precisamos de:** a UPJ precisa sinalizar "em análise" ao Gestor, ou
basta o desfecho final?

---

## PD-04 — Aprovação (Gestor) gera dois status?

**Origem:** pendência 2 da especificação.

**Como está hoje:** [DECISÃO TÉCNICA PROVISÓRIA] o diagrama da seção 5.1 foi
seguido como **sequencial**: ao aprovar, o sistema grava `gestor-aprovada` com
data/hora **e um evento no histórico**, e em seguida move para `upj-pendente`, que
é o status operacional visto pela UPJ. As duas transições ficam registradas.

**O que falta:** homologar. Se a área entender que são **equivalentes** (um status
só), o código simplifica e o painel deixa de ter um estado que nunca é exibido.

### Opções

| Opção | Descrição |
|---|---|
| **A. Manter sequencial** (como está) | A trilha mostra "aprovada" e "remetida à UPJ" como eventos distintos |
| **B. Tornar equivalentes** | `gestor-aprovada` deixa de existir no fluxo; aprovar move direto para `upj-pendente` |

### Recomendação técnica

**A**, que já está implementado: a distinção entre "o Gestor aprovou" e "a UPJ
recebeu" é útil em auditoria, e o custo é zero. Só precisa constar como decidido.

---

## PD-05 — Critérios de "Urgentíssimo"

**Origem:** pendência 3 da especificação ("mencionado como a ser melhor definido
adiante, sem definição posterior").

**Como está hoje:** a marcação existe e funciona — o Gestor a marca na aprovação
(RF-GES-04), a anotação aparece em lista própria "Urgentíssimas" no módulo UPJ e
recebe selo em destaque. **Mas não há critério**: depende do julgamento do Gestor.

**Por que importa:** se tudo virar Urgentíssimo, a marcação perde valor e a lista
deixa de orientar prioridade real.

**Para decidir, precisamos de:** os critérios objetivos de enquadramento.
Perguntas que ajudam a defini-los:

1. Prazo judicial vencendo em quantos dias?
2. Envolve risco à vida/saúde (diálise, medicamento de uso contínuo, cirurgia)?
3. É determinação expressa de Magistrado?
4. Há limite de quantas marcações por Gestor por dia?

---

## PD-06 — Obrigatoriedade das Observações internas

**Origem:** pendência 4 da especificação.

**Como está hoje:** **opcional**. O slide 85 indica campo opcional; o wireframe
(slide 129) o marca como obrigatório (`*`). O sistema seguiu o slide.

**Recomendação técnica:** manter **opcional**. Torná-lo obrigatório empurraria o
atendente a preencher texto genérico só para liberar o envio — o que produz ruído
no lugar de informação. Se a intenção era garantir contexto ao Gestor, o campo
"Descrição da Prioridade/Urgência" (já obrigatório) cumpre esse papel.

**Para decidir, precisamos de:** confirmar a intenção do wireframe. Se for
obrigatório de fato, é mudança de uma linha.

---

## PD-07 — "Incluir Arquivamento Automático" (UPJ)

**Origem:** pendência 5 da especificação.

**Como está hoje:** o elemento existe na tela de análise, **com aviso explícito
na própria interface** de que o comportamento não foi definido: o valor é
registrado, mas nenhuma ação automática ocorre.

**Semelhança com o que já existe:** o "correção automática engatilhada" do lado do
Gestor (RF-GES-05) é o caso análogo, e está implementado: se o Atendente não
responde em 24 h, o sistema aplica a correção em vez de rejeitar.

### Opções

| Opção | Descrição |
|---|---|
| **A. Espelhar o RF-GES-05** | Se o Atendente não responde em 24 h, o sistema arquiva em vez de rejeitar |
| **B. Remover o elemento** | Tirar da tela até haver regra |
| **C. Manter como está** | Registra a intenção; comportamento decidido depois |

### Recomendação técnica

**A**, por simetria com o RF-GES-05 — o mesmo problema (prazo vencido sem
resposta) tem hoje dois tratamentos diferentes conforme a origem. Se a opção A
for escolhida, a diferença entre "rejeitar" e "arquivar" precisa ser explicada:
hoje o sistema usa "Rejeitada" para os dois casos.

**Para decidir, precisamos de:** qual o efeito prático de arquivar em vez de
rejeitar, e se a distinção interessa à operação.

---

## PD-08 — Campo "Nome do Solicitante"

**Origem:** pendência 6 da especificação.

**Como está hoje:** o schema prevê o campo, a tela "Nova Anotação" **não** o
exibe. O sistema captura apenas "Tipo de Solicitante" (lista fechada) e, quando
"Outros", a "Descrição do(s) Solicitante".

**Para decidir, precisamos de:** o nome do solicitante é necessário à UPJ ou ao
Gestor? Se for, precisa de campo próprio (e de decisão sobre dado pessoal). Se
não, o campo deve ser **removido do schema** para não confundir quem ler o modelo.

---

## PD-09 — Rótulo do campo adicional de "Outros" (tipo de prioridade)

**Origem:** pendência 7 da especificação.

**Como está hoje:** **resolvido** — o campo adicional tem rótulo próprio,
"Descrição do Tipo de Prioridade/Urgência (Outros)", diferente do campo principal
"Descrição da Prioridade/Urgência". A sugestão da especificação foi acatada.

**Para decidir, precisamos de:** apenas validar o texto com a área.

---

## PD-10 — Controle de vinculação automática na UPJ

**Origem:** pendência 10 da especificação.

**Como está hoje:** o controle "Habilitar/Desabilitar vinculação automática"
aparece para Gestores e **também** na tela de Designações da UPJ, com uma nota de
que isso depende de homologação. O RF-UPJ-06 descreve a mesma lógica de rodízio
para a UPJ, então o controle faz sentido lá — mas o wireframe não o previa.

**Recomendação técnica:** manter, porque sem ele o Coordenador não consegue tirar
um Analista afastado do rodízio.

**Para decidir, precisamos de:** validar a inclusão.

---

## PD-11 — Composição do rótulo "Aprovadas"

**Origem:** pendência 11 da especificação ("Gestores: 'Analis. + Devolv.'; UPJs:
'Analis. + Resolv.' — confirmar composição").

**Como está hoje:** implementado conforme a especificação, com os grupos
documentados no código:

- **Gestores** → "Analisadas" = `upj-analisada` + `upj-devolvida`
- **UPJs** → "Aprovadas" = `gestor-aprovada`

**Para decidir, precisamos de:** confirmar a composição de cada contador, já que
o texto da especificação está abreviado e admite mais de uma leitura.

---

## PD-12 — Nomenclatura do tipo PCD

**Origem:** pendência 12 da especificação.

**Como está hoje:** a lista usa **"Tramitação prioritária – PCD"**. O aviso
contextual menciona "Tratamento médico – PCD" (divergência entre slide 79 e a
lista). O sistema usou o texto da lista e citou o outro tipo no aviso, para
orientar o atendente.

**Para decidir, precisamos de:** o rótulo oficial.

---

# Parte II — Pontos levantados na implementação

## PD-13 — Log de acessos (RF-GER-05)

**Origem:** RF-GER-05 e pendência 13 da especificação ("schema a definir
oportunamente").

**Como está hoje:** **não implementado**. O requisito pede "registro dos acessos
dos usuários". Não existe tabela nem rotina.

**Por que este ponto ficou mais relevante agora.** Ao decidir que o papel `admin`
tem **leitura total** das anotações — inclusive as que contêm dado de saúde —,
ficou em aberto como tornar esse acesso auditável. Hoje não há como responder
"quem consultou a anotação X, e quando?". A decisão de leitura total foi tomada
sem o instrumento que a tornaria verificável.

**O que já existe como referência:** o módulo Escala tem `escala_auditoria` com
`ator_user_id`, `entidade`, `entidade_id`, `acao`, `resumo`, `payload` e
`created_at`. Um padrão semelhante resolve este requisito.

### O que precisa ser decidido

| Pergunta | Por que importa |
|---|---|
| **O que registrar?** Consulta, ou só escrita? | Registrar toda leitura de anotação gera volume alto e pode ser excesso de vigilância sobre o trabalho cotidiano |
| **Quem é registrado?** Só o `admin`, ou todos? | Registrar apenas o acesso privilegiado responde ao risco real com custo baixo |
| **O log é visível a quem?** | Se o próprio admin puder ler e apagar o log dele, a auditoria não vale |
| **Por quanto tempo guardar?** | Impacta volume e obrigações de retenção |
| **Registrar o quê, exatamente?** | Ver a lista de anotações (que expõe nome do Atendente) ou abrir uma anotação específica? |

### Opções

| Opção | Descrição | Custo |
|---|---|---|
| **A. Log só de acesso privilegiado** | Registra quando `admin` lê anotação de outro usuário. Alta relação sinal/ruído | Baixo |
| **B. Log de leitura para todos** | Toda consulta registrada | Alto volume; ganho questionável |
| **C. Log só de escrita** | Registra transições (que já têm histórico) e login | Baixo, mas não cobre a leitura do admin — que é o ponto |
| **D. Sem log, com restrição** | Revogar a leitura total do admin e resolver por permissão | Simplifica; perde a capacidade de suporte que motivou a decisão |

### Recomendação técnica

**Opção A.** Responde diretamente ao risco (acesso privilegiado a dado sensível),
com volume baixo e sem transformar o trabalho cotidiano em objeto de vigilância. E
o log deve ter **escrita apenas pelo sistema** — nenhum usuário, nem admin, pode
inserir ou apagar linha.

**Para decidir, precisamos de:** as cinco perguntas acima, e a confirmação de que
o log de leitura do admin é desejado (ele também expõe **quando** alguém deu
suporte, o que pode ou não ser aceitável para a área).

---

## PD-14 — Bases de cálculo dos 24 h × alterações futuras de calendário

**Origem:** levantado na implementação.

**Situação:** como o prazo é **gravado** no momento da devolução
(`prazo_resposta_em`), mudar a regra de cálculo (PD-01) **não afeta** devoluções já
em curso. Isso é proposital: o prazo de uma anotação não deve mudar porque a regra
mudou depois.

**O que decidir:** se a área quiser que a mudança de regra valha **retroativamente**
para devoluções abertas, isso exige um recálculo explícito — e a decisão precisa
ser consciente, porque altera prazos que o Atendente já viu na tela.

**Recomendação técnica:** **não** aplicar retroativamente.

---

# Parte III — Como fechar cada ponto

## O que precisamos da área de negócio (TJSP Atende e UPJs)

1. **PD-01** — o prazo conta fins de semana e recesso? Quem mantém o calendário?
2. **PD-02 / PD-03** — quem reitera, quem analisa, e o que cada ação muda.
3. **PD-05** — critérios objetivos de Urgentíssimo.
4. **PD-06, PD-08, PD-10, PD-11 e PD-12** — validações pontuais de escopo e texto.
5. **PD-07** — o que "arquivar" faz de diferente de "rejeitar".
6. **PD-13** — as cinco perguntas do log de acessos.

## O que precisamos da STI

1. **PD-13** — schema e política de retenção do log.
2. **PD-04** — homologar a decisão técnica provisória (aprovação sequencial).
3. **PD-09, PD-11 e PD-12** — confirmar os textos exibidos.
4. **PD-14** — confirmar que mudanças de regra de prazo não valem retroativamente.
5. Confirmar o **DJEN** como fonte definitiva (ver nota no resumo).

## Impacto de não decidir

| Ponto | Se ficar indefinido |
|---|---|
| PD-01 | Rejeições automáticas em fim de semana podem gerar questionamento da equipe |
| PD-02 / PD-03 | Dois itens de menu permanecem vazios, sugerindo funcionalidade que não existe |
| PD-05 | A lista "Urgentíssimas" perde valor como instrumento de priorização |
| PD-13 | Não há como auditar o acesso privilegiado do admin — decisão tomada sem instrumento de verificação |
| PD-07 | A caixa existe e não faz nada, o que a interface já informa |
| PD-04, PD-06, PD-08 a PD-12 e PD-14 | Sem impacto operacional; são ajustes de texto, homologação ou escopo |

---

## Referências

| Assunto | Documento |
|---|---|
| Uso do app e roteiro de testes | [COMO_USAR_PRIORIDADES_URGENCIAS.md](COMO_USAR_PRIORIDADES_URGENCIAS.md) |
| Integração com o DJEN, decisões técnicas e correções de segurança | [PRIORIDADES_URGENCIAS_DJEN.md](implementation-guides/PRIORIDADES_URGENCIAS_DJEN.md) |
| Relatório de teste adversarial (07/10/2026) | `reports/prioridades-urgencias-2026-10-07/` |
| Especificação de origem | Especificação Técnica de Requisitos v1.0 — out/2026 (seção 11) |
