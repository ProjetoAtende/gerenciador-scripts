/**
 * Gera um documento HTML standalone a partir do conteúdo de um script.
 * O documento inclui CSS inline para manter o layout fiel ao editor.
 * Imagens permanecem como URLs (Supabase Storage) para máxima qualidade.
 */
export async function exportarScriptComoHtml(script: {
  nome: string;
  conteudo_bruto: string;
  numero_referencia?: number;
  categoria_slug?: string | null;
  pergunta?: string | null;
  tipo_requisitante?: string | null;
}): Promise<void> {
  const dataFormatada = new Date().toLocaleDateString('pt-BR');
  
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Script #${script.numero_referencia || 'S/N'} — ${escapeHtml(script.nome)}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    
    * { box-sizing: border-box; }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px 30px;
      background: #fff;
    }
    
    /* Header */
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    
    .header h1 {
      font-size: 22px;
      color: #1e40af;
      margin: 0 0 8px 0;
    }
    
    .header .meta {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 12px;
      color: #6b7280;
    }
    
    .header .meta span {
      background: #f3f4f6;
      padding: 2px 8px;
      border-radius: 4px;
    }
    
    /* Pergunta destaque */
    .pergunta {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 12px 16px;
      margin-bottom: 24px;
      border-radius: 0 8px 8px 0;
    }
    
    .pergunta strong {
      color: #1e40af;
      display: block;
      margin-bottom: 4px;
      font-size: 13px;
    }
    
    /* Conteúdo do script */
    .content {
      line-height: 1.7;
    }
    
    .content img {
      max-width: 100%;
      height: auto;
      margin: 12px 0;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    
    .content table td, .content table th {
      border: 1px solid #d1d5db;
      padding: 8px 12px;
    }
    
    .content ul, .content ol {
      padding-left: 24px;
    }
    
    .content li {
      margin-bottom: 4px;
    }
    
    /* Footer */
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #9ca3af;
      text-align: center;
    }
    
    /* Print styles */
    @media print {
      body { 
        padding: 0; 
        max-width: none;
      }
      .header { break-after: avoid; }
      .content img { break-inside: avoid; }
      .footer { break-before: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 Script #${script.numero_referencia || 'S/N'} — ${escapeHtml(script.nome)}</h1>
    <div class="meta">
      ${script.tipo_requisitante ? `<span>🛡️ ${escapeHtml(script.tipo_requisitante)}</span>` : ''}
      ${script.categoria_slug ? `<span>🏷️ ${escapeHtml(script.categoria_slug)}</span>` : ''}
      <span>📅 Exportado em ${dataFormatada}</span>
    </div>
  </div>
  
  ${script.pergunta ? `
  <div class="pergunta">
    <strong>❓ Pergunta-chave:</strong>
    ${escapeHtml(script.pergunta)}
  </div>
  ` : ''}
  
  <div class="content">
    ${script.conteudo_bruto}
  </div>
  
  <div class="footer">
    Documento gerado automaticamente — Script #${script.numero_referencia || 'S/N'} — ${dataFormatada}
  </div>
</body>
</html>`;

  // Download do arquivo
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Script_${script.numero_referencia || 'SN'}_${script.nome.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
