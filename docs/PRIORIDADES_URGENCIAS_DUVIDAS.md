# Prioridades e Urgências — o que ficou em aberto

Documento para a área, depois da leitura de
*Novas Especificações - Prioridades e Urgências - TJSP Atende* (out/2026).

O que já estava decidido foi implementado. Aqui ficam só os pontos em que a
redação não fecha, ou que foram adiados de propósito.

Migrations: `20261015112854_prioridades_reclassificacao.sql`,
`20261015121603_prioridades_fix_pr_g7_pr_h2.sql` e
`20261016103000_prioridades_respostas_area_out2026.sql` (respostas da área
15/10/2026). Detalhes em
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

### 1. Qual faixa de Varas é qual UPJ (I a IX) — **respondido**

Correspondência oficial (resposta 15/10/2026):

| UPJ (romano) | Código interno | Nome |
|:---:|:---:|:---|
| VI | FCC-01-05 | UPJ da 1ª a 5ª Varas Cíveis |
| VIII | FCC-06-10 | UPJ da 6ª a 10ª Varas Cíveis |
| IX | FCC-11-15 | UPJ da 11ª a 15ª Varas Cíveis |
| V | FCC-16-20 | UPJ da 16ª a 20ª Varas Cíveis |
| III | FCC-21-25 | UPJ da 21ª a 25ª Varas Cíveis |
| II | FCC-26-30 | UPJ da 26ª a 30ª Varas Cíveis |
| IV | FCC-31-35 | UPJ da 31ª a 35ª Varas Cíveis |
| VII | FCC-36-40 | UPJ da 36ª a 40ª Varas Cíveis |
| I | FCC-41-45 | UPJ da 41ª a 45ª Varas Cíveis |

A UI continua exibindo o nome da faixa (sem `FCC-XX-YY`). Incluir o algarismo
romano no rótulo é melhoria cosmética opcional.

### 2. Itens 3.1.2.1 e 3.1.3.1 — **respondido**

Ordem única para Atendente, Gestor e Conferente Designado: processo →
Solicitante (+ nome opcional) → tipo → Sistema (+ UPJ só se a consulta não
trouxer UPJ) → Evento/Folha + Descrição + Observações. UPJ manual oculta
quando detectada pelo DJEN.

### 3. Log de acesso privilegiado — **respondido e implementado**

- **Quem consulta:** Gestor e Coordenador (menu *Log de acessos*).
- **Retenção:** 12 meses (expurgo mensal via job `prioridades_log_acessos_retencao`).
- **O que conta:** só abrir uma anotação específica (não listar).
- **Registro:** continua apenas leitura do admin em anotação alheia; sem edição pela UI.

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
   consulta termina, inclusive quando o DJEN não acha comunicação. Processos
   **fora da competência** (ex.: Câmaras/Gabinetes, CNJ fora de 8.26.0100,
   Vara fora de 1–45 quando identificada) são **bloqueados** na UI e no
   servidor (`prioridades_processo_competencia_atende`).

## Ponto adicional (15/10/2026) — **corrigido**

Coordenadores e Analistas passam a ver somente anotações da **própria UPJ**
(correção em `prioridades_pode_ver`: designação de Gestor não amplia visão
de quem tem perfil base de UPJ).
