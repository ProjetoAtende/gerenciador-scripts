// __tests__/ai/validateAIResult.test.ts
// Testes unitários da proteção contra perda de conteúdo da IA
import { describe, it, expect } from 'vitest';
import { validateAIResult, type AIAction } from '../../components/AIAssistantMenu';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Gera um texto longo com n palavras */
const loremWords = (n: number) =>
  Array.from({ length: n }, (_, i) => `palavra${i + 1}`).join(' ');

/** Envolve texto em HTML simples */
const wrapHtml = (text: string) => `<p>${text}</p>`;

// Texto original típico de um script de atendimento (~400 chars visíveis)
const ORIGINAL_LONGO = `
  <p>Prezado usuário,</p>
  <p>Para resolver o problema de <strong>acesso ao sistema</strong>, siga os passos abaixo:</p>
  <ol>
    <li>Acesse o portal em <a href="https://eproc.tjsp.jus.br">eproc.tjsp.jus.br</a></li>
    <li>Clique em <strong>Recuperar Senha</strong></li>
    <li>Informe seu <em>CPF</em> e confirme o e-mail cadastrado</li>
    <li>Verifique sua caixa de entrada em até 10 minutos</li>
  </ol>
  <p>Qualquer dúvida, nossa equipe está à disposição pelo chat ou pelo telefone <strong>0800-123-4567</strong>.</p>
  <p>Atenciosamente,<br/>Equipe de Suporte</p>
`.trim();

const ORIGINAL_CURTO = 'Ok!'; // 3 chars — abaixo do limiar de 20

// ─── Grupo 1: Resultado vazio ─────────────────────────────────────────────────
describe('validateAIResult — resultado vazio', () => {
  const acoes: AIAction[] = ['melhorar', 'corrigir', 'formatar', 'continuar'];

  it.each(acoes)(
    'bloqueia resultado vazio ("") para ação "%s" quando original é longo',
    (acao) => {
      const result = validateAIResult(ORIGINAL_LONGO, '', acao);
      expect(result.ok).toBe(false);
      expect(result.reason).toBeDefined();
    }
  );

  it.each(acoes)(
    'bloqueia resultado com apenas espaços para ação "%s"',
    (acao) => {
      const result = validateAIResult(ORIGINAL_LONGO, '   ', acao);
      expect(result.ok).toBe(false);
    }
  );

  it.each(acoes)(
    'bloqueia resultado com apenas tags HTML vazias para ação "%s"',
    (acao) => {
      // Tags sem texto visível
      const result = validateAIResult(ORIGINAL_LONGO, '<p></p><br/><span></span>', acao);
      expect(result.ok).toBe(false);
    }
  );

  it('NÃO bloqueia resultado vazio quando original também é curto (< 20 chars)', () => {
    // Não faz sentido bloquear scripts de 3 caracteres
    const result = validateAIResult(ORIGINAL_CURTO, '', 'corrigir');
    expect(result.ok).toBe(true);
  });

  it('NÃO bloqueia resultado de 5 chars quando original tem 15 chars', () => {
    // Limiar: original precisa ter > 20 chars para acionar o bloqueio de vazio
    const result = validateAIResult('Texto curto ok!', 'Ok', 'melhorar');
    expect(result.ok).toBe(true);
  });
});

// ─── Grupo 2: Resultado < 30% do original ────────────────────────────────────
describe('validateAIResult — resultado drasticamente menor (< 30%)', () => {
  const acoesNaoContinuar: AIAction[] = ['melhorar', 'corrigir', 'formatar'];

  it.each(acoesNaoContinuar)(
    'bloqueia resultado com 5pct do tamanho original para a acao "%s"',
    (acao) => {
      // Original ~430 chars visíveis, resultado ~72 chars (16%) → > 10 chars, < 30%
      // Assim passa pelo guard "vazio" e cai no guard "drasticamente menor"
      const result = validateAIResult(ORIGINAL_LONGO, wrapHtml(loremWords(8)), acao);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/\d+%/); // mensagem deve citar o percentual
    }
  );

  it.each(acoesNaoContinuar)(
    'bloqueia resultado com apenas ícones e palavras soltas para ação "%s"',
    (acao) => {
      // Simula o bug reportado: IA apaga tudo e deixa só ícones
      const result = validateAIResult(ORIGINAL_LONGO, '✅ 📌 ⚠️ Ok', acao);
      expect(result.ok).toBe(false);
    }
  );

  it('NÃO bloqueia ação "continuar" mesmo com resultado pequeno', () => {
    // "continuar" pode retornar apenas a continuação, que pode ser curta
    const resultadoPequeno = wrapHtml('Esta é apenas a continuação do texto.');
    const result = validateAIResult(ORIGINAL_LONGO, resultadoPequeno, 'continuar');
    expect(result.ok).toBe(true);
  });

  it('NÃO bloqueia quando original é curto (< 30 chars)', () => {
    // Textos muito curtos não ativam a proteção de razão < 30%
    const original = 'Texto breve aqui.'; // 17 chars
    const resultado = 'Ok'; // bem menor
    const result = validateAIResult(original, resultado, 'melhorar');
    expect(result.ok).toBe(true);
  });
});

// ─── Grupo 3: Resultado aceitável (pass-through) ─────────────────────────────
describe('validateAIResult — resultado aceitável', () => {
  it('aprova resultado com tamanho similar ao original', () => {
    const resultado = ORIGINAL_LONGO.replace('problema', 'problema técnico de autenticação');
    const result = validateAIResult(ORIGINAL_LONGO, resultado, 'melhorar');
    expect(result.ok).toBe(true);
  });

  it('aprova resultado maior que o original (IA expandiu)', () => {
    const resultado = ORIGINAL_LONGO + wrapHtml(loremWords(50));
    const result = validateAIResult(ORIGINAL_LONGO, resultado, 'melhorar');
    expect(result.ok).toBe(true);
  });

  it('aprova resultado com 60% do original (dentro da zona de confirmação, não de bloqueio)', () => {
    // 60% não bloqueia — apenas entra no fluxo de "pendingResult" (confirmação manual)
    // validateAIResult em si retorna ok:true para 30-60%
    const original = loremWords(100); // ~700 chars
    const resultado = loremWords(62); // ~62% — acima de 30%, abaixo de 60%
    const result = validateAIResult(original, resultado, 'corrigir');
    expect(result.ok).toBe(true);
  });

  it('aprova mesmo com muitas tags HTML no resultado', () => {
    // HTML verboso mas com conteúdo rico
    const htmlRico =
      '<h3>📌 Instruções</h3>' +
      '<ol>' +
      Array.from({ length: 4 }, (_, i) => `<li>Passo ${i + 1}: ${loremWords(8)}</li>`).join('') +
      '</ol>' +
      '<p>Qualquer dúvida, entre em contato.</p>';
    const result = validateAIResult(ORIGINAL_LONGO, htmlRico, 'formatar');
    expect(result.ok).toBe(true);
  });
});

// ─── Grupo 4: Extração de texto (strip HTML) ─────────────────────────────────
describe('validateAIResult — strip HTML funciona corretamente', () => {
  it('ignora tags ao calcular tamanho do resultado', () => {
    // Resultado com muito HTML mas pouco texto visível → deve bloquear
    const htmlComPocoTexto = '<div><p><span><strong><em>Ok.</em></strong></span></p></div>';
    const result = validateAIResult(ORIGINAL_LONGO, htmlComPocoTexto, 'melhorar');
    expect(result.ok).toBe(false);
  });

  it('ignora &nbsp; ao calcular tamanho', () => {
    // &nbsp; não deve contar como conteúdo real
    const apenasNbsp = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
    const result = validateAIResult(ORIGINAL_LONGO, apenasNbsp, 'formatar');
    expect(result.ok).toBe(false);
  });

  it('mensagem de erro cita o percentual real (não HTML)', () => {
    // Para acionar o guard de percentual (não o guard de vazio),
    // o resultado precisa ter >10 chars visíveis mas <30% do original
    const original = wrapHtml(loremWords(80)); // ~720 chars visíveis
    const resultado = wrapHtml(loremWords(8));  // ~72 chars visíveis → ~10% → < 30%
    const result = validateAIResult(original, resultado, 'corrigir');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('%');
  });
});

// ─── Grupo 5: Casos extremos ─────────────────────────────────────────────────
describe('validateAIResult — casos extremos', () => {
  it('não crasheia com original vazio e resultado vazio', () => {
    expect(() => validateAIResult('', '', 'melhorar')).not.toThrow();
    const result = validateAIResult('', '', 'melhorar');
    expect(result.ok).toBe(true); // ambos vazios → sem original para proteger
  });

  it('não crasheia com original vazio e resultado longo', () => {
    const result = validateAIResult('', ORIGINAL_LONGO, 'continuar');
    expect(result.ok).toBe(true);
  });

  it('não crasheia com strings contendo caracteres especiais e emojis', () => {
    const originalComEmojis = '✅ Prezado usuário, ' + loremWords(50) + ' 📌🔗';
    const resultadoPequeno = '✅';
    expect(() => validateAIResult(originalComEmojis, resultadoPequeno, 'melhorar')).not.toThrow();
    const result = validateAIResult(originalComEmojis, resultadoPequeno, 'melhorar');
    expect(result.ok).toBe(false);
  });

  it('retorna reason undefined quando ok é true', () => {
    const result = validateAIResult(ORIGINAL_LONGO, ORIGINAL_LONGO, 'corrigir');
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
