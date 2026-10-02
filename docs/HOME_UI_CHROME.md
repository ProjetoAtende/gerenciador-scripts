# Home — chrome institucional (set/2026)

Identidade visual da Home do Gerenciador Atende: header TJSP, rodapé enxuto, flags de simulação/versão.

## Componentes

| Peça | Caminho | Flag / nota |
|------|---------|-------------|
| Header institucional | `src/components/HomeInstitutionalHeader.tsx` | Brasão, título, slogan, **eproc**, **TJSP Atende** |
| Simulação admin | `src/components/HomeVisualizacaoSimulada.tsx` | `HOME_VISUALIZACAO_SIMULACAO_ENABLED` em `SimulationContext.tsx` (padrão `false`) |
| Badge de versão | `src/components/VersionBadge.tsx` | `VERSION_BADGE_ENABLED` (padrão `false`) |
| Rodapé | `src/components/FooterShadowFlow.tsx` | Texto fixo ShadowFlow Technologies 2026 |

## Assets em `public/`

| Arquivo | Uso |
|---------|-----|
| `tjsp-logotipo-oficial.png` | Brasão TJSP |
| `eproc-logo.png` | Logo eproc — tema claro, fundo **transparente** |
| `eproc-logo-dark.png` | Logo eproc — tema escuro (`class="dark"` no `<html>`): mesmos azuis do ícone, texto “eproc” claro, fundo transparente |
| `tjsp-atende-logo.png` | Produto Atende (mesmo asset claro/escuro) |

## Logo eproc e dark mode

O app usa **`darkMode: 'class'`** (Tailwind), não `prefers-color-scheme`. Por isso o header alterna dois PNGs:

- Claro: `eproc-logo.png` com `dark:hidden`
- Escuro: `eproc-logo-dark.png` com `hidden dark:block`

**Não** usar caixa de fundo sólida nem `filter: invert` no `<img>` — isso desloca o tom do header e inverte as cores do ícone.

### Regenerar PNGs

Script: `scripts/make-eproc-logo-transparent.mjs`

```bash
npm install sharp --no-save   # primeira vez na máquina
npm run logo:eproc
```

O script:

1. Remove pixels brancos do `eproc-logo.png` (alpha 0).
2. Gera `eproc-logo-dark.png` clareando **apenas** o texto preto; pixels azuis/ciano do ícone são preservados.

Origem recomendada antes de rodar, se o PNG estiver corrompido: copiar `eproc-logo.png` do repositório NAPE (`public/eproc-logo.png`).

## Referência cruzada

Decisões e cronologia: [`MEMORIA_MIGRACAO_GERENCIADOR_ATENDE.md`](MEMORIA_MIGRACAO_GERENCIADOR_ATENDE.md) (seção 6 — Home).
