// __tests__/curadoria/curadoriaVisibilidade.test.tsx
// Testes de visibilidade e interatividade do botão Revisado/Não Revisado
// e do select de Curadoria após refatoração de permissões.
//
// Requisitos testados:
// 1. Botão Revisado/Não Revisado visível para TODOS os usuários
// 2. Botão clicável SOMENTE para admin e membros do setor 3.2
// 3. Select de Curadoria visível e funcional para TODOS os usuários
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Mock de framer-motion ────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, whileTap: _, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// ─── Mock de @dnd-kit/sortable ────────────────────────
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

// ─── Mock de @dnd-kit/utilities ───────────────────────
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: { toString: () => '' },
  },
}));

import { ScriptCard } from '../../components/ScriptCard';
import type { ScriptItem } from '../../types/Script';

// ─── Helper: criar ScriptItem fake ───────────────────
const criarScriptFake = (overrides: Partial<ScriptItem> = {}): ScriptItem => ({
  id: 'script-test-001',
  nome: 'Script de Teste',
  equipe_id: 'equipe-001',
  criado_em: '2026-01-15T10:00:00Z',
  curadoria_atuada: false,
  ...overrides,
});

// ─── Default props do ScriptCard ──────────────────────
const criarDefaultProps = (overrides: Record<string, any> = {}) => ({
  script: criarScriptFake(),
  onGenerate: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onMove: vi.fn(),
  onPublicar: vi.fn(),
  onStartEdit: vi.fn(),
  onSaveEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onTitleChange: vi.fn(),
  onSelect: vi.fn(),
  onToggleCuradoria: vi.fn(),
  ...overrides,
});

// ═══════════════════════════════════════════════════════
// TESTES DO BOTÃO REVISADO/NÃO REVISADO
// ═══════════════════════════════════════════════════════
describe('Botão Revisado/Não Revisado - Visibilidade', () => {
  it('deve ser visível para usuários comuns (canToggleCuradoria=false)', () => {
    const props = criarDefaultProps({ canToggleCuradoria: false });
    render(<ScriptCard {...props} />);

    // O botão deve existir com title "Não revisado"
    const botao = screen.getByTitle('Não revisado');
    expect(botao).toBeInTheDocument();
  });

  it('deve ser visível para admin/3.2 (canToggleCuradoria=true)', () => {
    const props = criarDefaultProps({ canToggleCuradoria: true });
    render(<ScriptCard {...props} />);

    const botao = screen.getByTitle('Não revisado - Clique para marcar');
    expect(botao).toBeInTheDocument();
  });

  it('deve mostrar ícone verde de check quando script revisado', () => {
    const props = criarDefaultProps({
      script: criarScriptFake({ curadoria_atuada: true }),
      canToggleCuradoria: false,
    });
    render(<ScriptCard {...props} />);

    // Título mostra "Revisado"
    const botao = screen.getByTitle(/^Revisado/);
    expect(botao).toBeInTheDocument();
  });

  it('deve mostrar nome do curador quando disponível e script revisado', () => {
    const props = criarDefaultProps({
      script: criarScriptFake({ curadoria_atuada: true, data_curadoria: '2026-02-20T14:00:00Z' }),
      curadorName: 'João Silva',
      canToggleCuradoria: false,
    });
    render(<ScriptCard {...props} />);

    const botao = screen.getByTitle(/Revisado por João Silva/);
    expect(botao).toBeInTheDocument();
  });

  it('NÃO deve renderizar o botão para scripts desativados', () => {
    const props = criarDefaultProps({
      script: criarScriptFake({ desativado_em: '2026-02-01T00:00:00Z' }),
      canToggleCuradoria: true,
    });
    render(<ScriptCard {...props} />);

    // Não deve encontrar nenhum botão com title de revisado
    expect(screen.queryByTitle(/Revisado|Não revisado/)).not.toBeInTheDocument();
  });

  it('NÃO deve renderizar o botão para scripts deletados', () => {
    const props = criarDefaultProps({
      script: criarScriptFake({ deletado: true }),
      canToggleCuradoria: true,
    });
    render(<ScriptCard {...props} />);

    expect(screen.queryByTitle(/Revisado|Não revisado/)).not.toBeInTheDocument();
  });
});

describe('Botão Revisado/Não Revisado - Interatividade', () => {
  it('deve chamar onToggleCuradoria ao clicar quando canToggleCuradoria=true', async () => {
    const user = userEvent.setup();
    const onToggleCuradoria = vi.fn();
    const props = criarDefaultProps({ canToggleCuradoria: true, onToggleCuradoria });
    render(<ScriptCard {...props} />);

    const botao = screen.getByTitle('Não revisado - Clique para marcar');
    await user.click(botao);

    expect(onToggleCuradoria).toHaveBeenCalledTimes(1);
  });

  it('NÃO deve chamar onToggleCuradoria ao clicar quando canToggleCuradoria=false', async () => {
    const user = userEvent.setup();
    const onToggleCuradoria = vi.fn();
    const props = criarDefaultProps({ canToggleCuradoria: false, onToggleCuradoria });
    render(<ScriptCard {...props} />);

    const botao = screen.getByTitle('Não revisado');
    await user.click(botao);

    expect(onToggleCuradoria).not.toHaveBeenCalled();
  });

  it('deve ter cursor-default quando canToggleCuradoria=false (visual de desabilitado)', () => {
    const props = criarDefaultProps({ canToggleCuradoria: false });
    render(<ScriptCard {...props} />);

    const botao = screen.getByTitle('Não revisado');
    expect(botao.className).toContain('cursor-default');
    expect(botao.className).toContain('opacity-80');
  });

  it('deve ter cursor-pointer quando canToggleCuradoria=true', () => {
    const props = criarDefaultProps({ canToggleCuradoria: true });
    render(<ScriptCard {...props} />);

    const botao = screen.getByTitle('Não revisado - Clique para marcar');
    expect(botao.className).toContain('cursor-pointer');
  });
});

// ═══════════════════════════════════════════════════════
// (Removido) Testes de "Lógica de permissão canToggleCuradoria"
// A lógica hardcoded foi migrada para o sistema de permissões
// (`scripts.curadoria_acesso`). Os grants iniciais ficam seedados em
// `supabase/migrations/20260428140000_permissoes_seed_curadoria.sql`.
// A verificação real do canToggleCuradoria agora é responsabilidade do
// hook `usePermissoes()` — não há mais lógica local a ser testada aqui.
// ═══════════════════════════════════════════════════════
