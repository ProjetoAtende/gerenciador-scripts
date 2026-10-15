# Prioridades e Urgências — o que ficou em aberto

Documento para a área, depois da leitura de
*Novas Especificações - Prioridades e Urgências - TJSP Atende* (out/2026).

O que já estava decidido foi implementado. Aqui ficam só os pontos em que a
redação não fecha, ou que foram adiados de propósito.

Migrations: `20261015112854_prioridades_reclassificacao.sql` e
`20261015121603_prioridades_fix_pr_g7_pr_h2.sql` (correções PR-G7/PR-H2).
Aplicadas no projeto remoto em 15/10/2026; detalhes em
[PRIORIDADES_URGENCIAS_RECLASSIFICACAO_ENTREGA.md](PRIORIDADES_URGENCIAS_RECLASSIFICACAO_ENTREGA.md).

## Adiado de propósito

**DataJud e a Vara correta (itens 3.1.1.2 e 3.1.1.3).** Não será feito agora.
A consulta do processo continua só pelo DJEN. A melhoria da pesquisa de
processos fica para uma etapa posterior. O próprio texto pedia para perguntar
antes de construir; a decisão desta etapa foi não construir.

**Simplificação visual da interface (item 3.2.3).** A especificação diz que
não deve ser feita agora. Nada foi alterado nesse sentido.

**Módulo de calendário no Gerenciador (item 2.1.3).** Continua como ideia
futura. O prazo deste aplicativo usa a seção Configurações do próprio
Prioridades e Urgências, não um módulo novo ao lado da Escala.

## Dúvidas que impedem de seguir

### 1. Qual faixa de Varas é qual UPJ (I a IX)

O item 3.1.1.4 pede o rótulo `Xª a Yª Varas Cíveis (UPJ Z)`, com Z em
algarismo romano de I a IX, e avisa que a numeração das UPJs não é sequencial.

No aplicativo as unidades estão gravadas pela faixa:

| Código interno | Nome atual |
|---|---|
| FCC-01-05 | UPJ da 1ª a 5ª Varas Cíveis |
| FCC-06-10 | UPJ da 6ª a 10ª Varas Cíveis |
| FCC-11-15 | UPJ da 11ª a 15ª Varas Cíveis |
| FCC-16-20 | UPJ da 16ª a 20ª Varas Cíveis |
| FCC-21-25 | UPJ da 21ª a 25ª Varas Cíveis |
| FCC-26-30 | UPJ da 26ª a 30ª Varas Cíveis |
| FCC-31-35 | UPJ da 31ª a 35ª Varas Cíveis |
| FCC-36-40 | UPJ da 36ª a 40ª Varas Cíveis |
| FCC-41-45 | UPJ da 41ª a 45ª Varas Cíveis |

Não há, no material recebido, a tabela que diz qual dessas faixas é a UPJ I,
qual é a II, e assim por diante. Um chamado antigo no Gerenciador cita
“UPJ IX — 11ª a 15ª Varas Cíveis”, o que confirma que a ordem não é a da
primeira Vara. Sem a tabela oficial, colocar I–IX inventados entregaria a
anotação com a UPJ errada na lista.

O que já mudou: a lista “UPJ de destino” mostra o nome da faixa
(“UPJ da 1ª a 5ª Varas Cíveis”) e deixou de exibir o código `FCC-XX-YY`.
O número romano entra assim que a área devolver a correspondência.

### 2. Itens 3.1.2.1 e 3.1.3.1 não descrevem campos

Os títulos falam em “Exibição dos campos da tela Nova Anotação”, para
Atendentes e para Gestores/Conferentes. O texto embaixo é o mesmo parágrafo
do painel lateral (item 3.1.1.1), sem dizer quais campos aparecem, em que
ordem, ou o que muda entre os perfis.

A exibição progressiva pedida no item 3.2.2 foi feita: primeiro o número do
processo; depois da consulta, o Solicitante; depois o tipo; em seguida o
restante. Se 3.1.2.1 e 3.1.3.1 queriam outra coisa, falta o texto.

### 3. Log de acesso privilegiado — quem lê e por quanto tempo

A opção A foi adotada: quando um administrador abre uma anotação que não é
dele, o sistema grava quem foi e quando. Ninguém grava nem apaga essa linha
pela tela.

A especificação de pendências ainda perguntava, e a resposta não fechou:

- quem pode consultar esse log;
- por quanto tempo ele é guardado;
- se percorrer a lista de anotações também conta como acesso, ou só abrir
  uma anotação.

Enquanto isso, o registro existe e não tem tela. Abrir uma anotação específica
é o que está sendo gravado.

## Leituras adotadas, para corrigir se a área quiser outra

Não bloqueiam o uso. Estão aqui para a área conferir.

1. **Prazo de 24 h.** O relógio corre em horas corridas e fica parado o dia
   inteiro no sábado, no domingo e em cada dia cadastrado em Configurações.
   Não é expediente de 8 às 18. Uma devolução na sexta às 17h, com o fim de
   semana no meio, vence na segunda às 17h. A carga inicial copia feriados,
   emendas e recesso que já existirem no calendário da Escala. O Gestor inclui
   e remove dias dali em diante. Prazo que o Atendente já viu na tela não é
   recalculado.

2. **Reiterada.** Toda anotação ainda em andamento do processo recebe a marca
   quando há duas ou mais. A marca sai quando uma resolução ou rejeição deixa
   menos de duas em andamento. Não sai ao passar para Em Análise, Devolvida
   ou Retornada.

3. **Urgentíssima automática.** Enquanto houver três ou mais anotações em
   andamento do mesmo processo, todas ganham a marca. Se a contagem cair
   abaixo de três, a marca automática sai. A marcação feita pelo Gestor ou
   pelo Conferente permanece.

4. **Em Análise.** Abrir uma anotação Nova, pelo Coordenador ou pelo Analista
   da UPJ, passa a anotação para Em Análise. Não foi criado um botão separado
   nem um parecer obrigatório: o texto da resposta define o status como
   “aberta/lida”. Resolver, Retornar e Rejeitar continuam sendo as decisões.

5. **Aprovadas.** Aprovar não deixa a anotação parada num status próprio. Ela
   segue para a UPJ como Nova. A lista Aprovadas, no painel do Atendente e na
   seção Atendentes do Gestor, reúne o que o Gestor já aprovou. O painel da
   UPJ não tem mais essa lista: o arquivo de lá é Resolvidas e Rejeitadas.

6. **Rejeição automática.** É uma caixa na ação Retornar, no mesmo espírito
   da correção automática. Se estiver marcada e o Gestor não corrigir no
   prazo, a UPJ rejeita. Se não estiver marcada, a anotação continua
   Retornada até alguém corrigir.

7. **Fila do Conferente.** Ele vê, em Ag. Conferência e Retornadas, só o que
   lhe foi vinculado. O Gestor, em Configurações, escolhe se essas duas listas
   mostram só as dele ou também as dos Conferentes. O padrão continua mostrando
   todas para o Gestor, para não esconder o que ele já acompanhava. As demais
   listas da seção UPJs não entram nessa preferência.

8. **Consulta sem comunicação no DJEN.** Os campos seguintes aparecem quando a
   consulta termina, inclusive quando o DJEN não acha comunicação. Se só
   “processo localizado” liberasse o restante, o caso sem publicação ficaria
   sem como ser anotado.
