// src/services/emailService.ts
// Serviço para envio de emails via ZeptoMail através de função RPC do Supabase

import { supabase } from './supabaseClient';
import { APP_HOME_URL, APP_PUBLIC_SITE_LABEL, appHomeUrlWithQuery } from '../config/appUrls';

// Configurações do remetente (domínio: sgs-sistemas.com.br)
const REMETENTE_EMAIL = 'noreply@sgs-sistemas.com.br';
const REMETENTE_NOME = 'Sistema de Scripts - SGS';

// Limite máximo de tamanho do conteúdo do email (em caracteres)
// ZeptoMail tem limite de ~1MB para o corpo do email
const MAX_CONTEUDO_LENGTH = 500000; // 500KB de texto

/**
 * Remove ou substitui imagens base64 do conteúdo HTML para evitar
 * payloads muito grandes que falham silenciosamente na API ZeptoMail.
 * 
 * Imagens base64 podem ter centenas de KB ou MB, causando:
 * - Timeout na requisição
 * - Falha silenciosa na API
 * - Email marcado como "enviado" mas nunca entregue
 */
const processarConteudoParaEmail = (conteudo: string): string => {
  if (!conteudo) return conteudo;
  
  // Regex para encontrar imagens base64 (data:image/...)
  // Captura todo o atributo src com base64
  const regexBase64Img = /<img[^>]*src=["']data:image\/[^;]+;base64,[^"']+["'][^>]*>/gi;
  
  // Contador de imagens removidas
  let imagensRemovidas = 0;
  
  // Substituir imagens base64 por placeholder informativo
  let conteudoProcessado = conteudo.replace(regexBase64Img, () => {
    imagensRemovidas++;
    return `<div style="padding: 16px; background: #f0f9ff; border: 2px dashed #3b82f6; border-radius: 8px; text-align: center; margin: 12px 0;">
      <span style="font-size: 24px;">🖼️</span>
      <p style="margin: 8px 0 0 0; color: #1e40af; font-size: 13px;">
        <strong>Imagem ${imagensRemovidas}</strong><br>
        <em style="color: #6b7280; font-size: 12px;">Acesse o sistema para visualizar a imagem completa</em>
      </p>
    </div>`;
  });
  
  // Log se houver imagens removidas
  if (imagensRemovidas > 0) {
    console.log(`📧 Email: ${imagensRemovidas} imagem(ns) base64 substituída(s) por placeholder`);
  }
  
  // Verificar tamanho final e truncar se necessário
  if (conteudoProcessado.length > MAX_CONTEUDO_LENGTH) {
    console.warn(`📧 Email: Conteúdo muito grande (${conteudoProcessado.length} chars), truncando...`);
    conteudoProcessado = conteudoProcessado.substring(0, MAX_CONTEUDO_LENGTH) + 
      `<div style="padding: 16px; background: #fef3c7; border-radius: 8px; margin-top: 16px;">
        <p style="margin: 0; color: #92400e; font-size: 13px;">
          ⚠️ <strong>Conteúdo truncado</strong><br>
          <em>O script completo pode ser visualizado no sistema.</em>
        </p>
      </div>`;
  }
  
  return conteudoProcessado;
};

export interface ScriptEmailData {
  numero_chamado: string;
  numero_referencia?: number | null;
  pergunta: string;
  nome: string;
  conteudo: string;
  conteudo_atendente?: string | null; // Conteúdo para o atendente (opcional)
  // Novos campos para emails personalizados
  criado_por?: string;           // UUID do autor
  criado_por_nome?: string | null; // Nome do autor/criador do script
  equipe_autor_id?: string;      // UUID da equipe do autor
  equipe_autor_nome?: string;    // Nome da equipe do autor (ex: "3.2.1")
  modificado_curadoria?: boolean; // Se foi modificado pela curadoria
}

// Contexto do destinatário para personalização do email
export interface DestinatarioContexto {
  email: string;
  equipe_id?: string;       // Equipe do destinatário
  is_autor?: boolean;       // Se é o autor do script
  is_mesma_equipe?: boolean; // Se é da mesma equipe do autor
}

export interface UsuarioEmailData {
  nome: string;         // Nome completo
  email: string;        // Login (email)
  senha: string;        // Senha temporária
  setor_nome?: string;  // Nome do setor (opcional)
  equipe_nome?: string; // Nome da equipe (opcional)
  role: string;         // Papel: user, supervisor, coordenador, admin
}

export interface EmailResponse {
  sucesso: boolean;
  enviados?: number;
  total?: number;
  resultados?: Array<{ email: string; success: boolean; message_id?: string; error?: string }>;
  erro?: string;
}

/**
 * Gera a mensagem contextual para email de CRIAÇÃO baseada no destinatário
 */
const getMensagemCriacao = (contexto: DestinatarioContexto, equipeAutorNome?: string): string => {
  // Se é o autor do script
  if (contexto.is_autor) {
    return 'Você criou este script';
  }
  
  // Se é da mesma equipe do autor
  if (contexto.is_mesma_equipe) {
    return 'Foi criado um script por um membro da sua equipe';
  } 
  
  // Se é de outra equipe
  const equipe = equipeAutorNome || 'outra equipe';
  return `Foi criado um script por um membro da equipe ${equipe}`;
};

/**
 * Gera a mensagem contextual para email de CURADORIA baseada no destinatário
 */
const getMensagemCuradoria = (
  contexto: DestinatarioContexto, 
  modificado: boolean,
  equipeAutorNome?: string
): string => {
  // Se é o autor do script
  if (contexto.is_autor) {
    return modificado 
      ? 'Seu script foi revisado com melhorias'
      : 'Seu script foi revisado sem alterações';
  }
  
  // Se é da mesma equipe do autor
  if (contexto.is_mesma_equipe) {
    return modificado
      ? 'Um script feito por um membro da sua equipe foi revisado com melhorias'
      : 'Um script feito por um membro da sua equipe foi revisado pela curadoria sem alterações';
  }
  
  // Se é de outra equipe
  const equipe = equipeAutorNome || 'outra equipe';
  return modificado
    ? `Um script feito por um membro da equipe ${equipe} foi revisado com melhorias`
    : `Um script feito por um membro da equipe ${equipe} foi revisado pela curadoria sem alterações`;
};

/**
 * Gera o template HTML para email de novo script proposto
 * Baseado no design de docs/exemplo-email-zeptomail.html
 * @param script Dados do script
 * @param contexto Contexto do destinatário (opcional, para mensagem personalizada)
 */
const templateCriacao = (script: ScriptEmailData, contexto?: DestinatarioContexto): string => {
  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Mensagem contextualizada
  const mensagemContexto = contexto 
    ? getMensagemCriacao(contexto, script.equipe_autor_nome)
    : 'Um novo script foi cadastrado e aguarda revisão da curadoria';

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        }
        .email-header {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%);
          padding: 32px 28px;
          text-align: center;
        }
        .email-header-icon {
          width: 56px;
          height: 56px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 28px;
        }
        .email-header h1 {
          color: #ffffff;
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }
        .email-header p {
          color: rgba(255, 255, 255, 0.85);
          font-size: 14px;
          margin: 0;
        }
        .email-body {
          padding: 28px;
        }
        .info-section {
          margin-bottom: 24px;
        }
        .info-row {
          display: flex;
          align-items: flex-start;
          padding: 14px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-icon {
          width: 36px;
          height: 36px;
          background: #eff6ff;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-right: 14px;
          flex-shrink: 0;
          font-size: 16px;
        }
        .info-content {
          flex: 1;
        }
        .info-label {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 15px;
          color: #1f2937;
        }
        .info-value.highlight {
          display: inline-block;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          color: #1d4ed8;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
        }
        .script-title {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1px solid #bae6fd;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
        }
        .script-title-label {
          font-size: 11px;
          font-weight: 600;
          color: #0369a1;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .script-title-value {
          font-size: 18px;
          font-weight: 600;
          color: #0c4a6e;
        }
        .question-box {
          background: #fefce8;
          border: 1px solid #fde047;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
        }
        .question-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          color: #a16207;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .question-text {
          font-size: 15px;
          color: #713f12;
          font-style: italic;
        }
        .script-proposal {
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }
        .script-proposal-header {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          padding: 12px 20px;
          border-bottom: 1px solid #cbd5e1;
        }
        .script-proposal-header span {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .script-proposal-content {
          padding: 20px;
          font-size: 14px;
          color: #334155;
          line-height: 1.7;
        }
        .script-proposal-content p {
          margin-bottom: 12px;
        }
        .script-proposal-content p:last-child {
          margin-bottom: 0;
        }
        .script-proposal-content strong {
          color: #1e293b;
        }
        .script-proposal-content ol,
        .script-proposal-content ul {
          margin: 12px 0;
          padding-left: 24px;
        }
        .script-proposal-content li {
          margin-bottom: 8px;
        }
        .system-notice {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 8px;
          padding: 12px 16px;
          margin-top: 20px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .system-notice-icon {
          font-size: 16px;
          flex-shrink: 0;
        }
        .system-notice-text {
          font-size: 12px;
          color: #92400e;
        }
        .email-footer {
          background: #f9fafb;
          padding: 20px 28px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
        }
        .footer-logo {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }
        .footer-text {
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.5;
        }
        .footer-divider {
          width: 40px;
          height: 3px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          margin: 12px auto;
          border-radius: 2px;
        }
      </style>
    </head>
    <body style="margin: 0; padding: 40px 20px; background-color: #f3f4f6;">
      <div class="email-container">
        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#2563eb" style="background-color: #2563eb;">
          <tr>
            <td align="center" style="padding: 32px 28px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="56" height="56" bgcolor="#4f83ed" style="background-color: #4f83ed; border-radius: 50%; width: 56px; height: 56px;">
                      <tr>
                        <td align="center" valign="middle" style="font-size: 28px; color: #ffffff;">📝</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="color: #ffffff; font-size: 22px; font-weight: bold; padding-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Nova Proposta de Script</td>
                </tr>
                <tr>
                  <td align="center" style="color: #e0e7ff; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${mensagemContexto}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <div class="email-body">
          <!-- Informações do Chamado -->
          <div class="info-section">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #eff6ff; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">🔖</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Referência do Script</div>
                        <div><span style="display: inline-block; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 14px;">${script.numero_referencia ? `#${script.numero_referencia}` : 'N/A'}</span></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #eff6ff; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">🎫</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Número do Chamado</div>
                        <div><span style="display: inline-block; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 14px;">#${script.numero_chamado || 'N/A'}</span></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #eff6ff; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">👤</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Criador do Script</div>
                        <div><span style="display: inline-block; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 14px;">${script.criado_por_nome || 'Não identificado'}</span></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #eff6ff; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">📅</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Data de Criação</div>
                        <div style="font-size: 15px; color: #1f2937;">${dataAtual}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>

          <!-- Título do Script -->
          <div class="script-title">
            <div class="script-title-label">📄 Título do Script</div>
            <div class="script-title-value">${script.nome}</div>
          </div>

          <!-- Pergunta -->
          <div class="question-box">
            <div class="question-label">
              <span>❓</span>
              <span>Pergunta do Usuário</span>
            </div>
            <div class="question-text">
              "${script.pergunta || 'Não informada'}"
            </div>
          </div>

          <!-- Proposta de Script -->
          <div class="script-proposal">
            <div class="script-proposal-header">
              <span>📋 Proposta de Resposta</span>
            </div>
            <div class="script-proposal-content">
              ${processarConteudoParaEmail(script.conteudo) || '<em>Sem conteúdo</em>'}
            </div>
          </div>

          ${script.conteudo_atendente ? `
          <!-- Script para o Atendente -->
          <div class="script-proposal" style="margin-top: 16px;">
            <div class="script-proposal-header" style="background: linear-gradient(135deg, #ea580c, #c2410c); color: #ffffff;">
              <span>🛠️ Orientações para o Atendente</span>
            </div>
            <div class="script-proposal-content" style="border-color: #fed7aa; background-color: #fff7ed;">
              ${processarConteudoParaEmail(script.conteudo_atendente)}
            </div>
          </div>
          ` : ''}

          <!-- Call to Action -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 24px 0 8px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${APP_HOME_URL}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="21%" strokecolor="#2563eb" fillcolor="#2563eb">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">Acessar Sistema de Scripts</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${APP_HOME_URL}" 
                   style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: bold; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; mso-hide: all;">
                  Acessar Sistema de Scripts
                </a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>

          <!-- Aviso -->
          <div class="system-notice">
            <span class="system-notice-icon">ℹ️</span>
            <span class="system-notice-text">
              Este script aguarda revisão da curadoria. Após aprovação, uma nova notificação
              será enviada com a versão oficial.
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div class="email-footer">
          <div class="footer-logo">Sistema de Scripts - SGS</div>
          <div class="footer-divider"></div>
          <div class="footer-text">
            Este é um email automático enviado pelo Sistema de Gerenciamento de Scripts.<br>
            Setor de Suporte Técnico - TJSP<br>
            <a href="${APP_HOME_URL}" style="color: #9ca3af; text-decoration: underline;"><strong>${APP_PUBLIC_SITE_LABEL}</strong></a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Gera o template HTML para email de script revisado pela curadoria
 * Baseado no design de docs/exemplo-email-zeptomail.html (versão aprovação)
 */
const templateCuradoria = (script: ScriptEmailData, contexto?: DestinatarioContexto): string => {
  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Mensagem contextualizada baseada no destinatário
  const mensagemContexto = contexto 
    ? getMensagemCuradoria(contexto, script.modificado_curadoria || false, script.equipe_autor_nome)
    : 'Este script foi revisado para uso oficial';

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        }
        .email-header {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%);
          padding: 32px 28px;
          text-align: center;
        }
        .email-header-icon {
          width: 56px;
          height: 56px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 28px;
        }
        .email-header h1 {
          color: #ffffff;
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }
        .email-header p {
          color: rgba(255, 255, 255, 0.85);
          font-size: 14px;
          margin: 0;
        }
        .email-body {
          padding: 28px;
        }
        .aprovado-badge {
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          border: 2px solid #22c55e;
          color: #166534;
          padding: 16px 20px;
          border-radius: 12px;
          text-align: center;
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 24px;
        }
        .info-section {
          margin-bottom: 24px;
        }
        .info-row {
          display: flex;
          align-items: flex-start;
          padding: 14px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-icon {
          width: 36px;
          height: 36px;
          background: #f0fdf4;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-right: 14px;
          flex-shrink: 0;
          font-size: 16px;
        }
        .info-content {
          flex: 1;
        }
        .info-label {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 15px;
          color: #1f2937;
        }
        .info-value.highlight {
          display: inline-block;
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          color: #166534;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
        }
        .script-title {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid #86efac;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
        }
        .script-title-label {
          font-size: 11px;
          font-weight: 600;
          color: #166534;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .script-title-value {
          font-size: 18px;
          font-weight: 600;
          color: #14532d;
        }
        .question-box {
          background: #fefce8;
          border: 1px solid #fde047;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
        }
        .question-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          color: #a16207;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .question-text {
          font-size: 15px;
          color: #713f12;
          font-style: italic;
        }
        .script-proposal {
          background: #f0fdf4;
          border: 2px solid #86efac;
          border-radius: 12px;
          overflow: hidden;
        }
        .script-proposal-header {
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          padding: 12px 20px;
          border-bottom: 1px solid #86efac;
        }
        .script-proposal-header span {
          font-size: 12px;
          font-weight: 600;
          color: #166534;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .script-proposal-content {
          padding: 20px;
          font-size: 14px;
          color: #334155;
          line-height: 1.7;
        }
        .script-proposal-content p {
          margin-bottom: 12px;
        }
        .script-proposal-content p:last-child {
          margin-bottom: 0;
        }
        .script-proposal-content strong {
          color: #1e293b;
        }
        .script-proposal-content ol,
        .script-proposal-content ul {
          margin: 12px 0;
          padding-left: 24px;
        }
        .script-proposal-content li {
          margin-bottom: 8px;
        }
        .system-notice {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 12px 16px;
          margin-top: 20px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .system-notice-icon {
          font-size: 16px;
          flex-shrink: 0;
        }
        .system-notice-text {
          font-size: 12px;
          color: #166534;
        }
        .email-footer {
          background: #f9fafb;
          padding: 20px 28px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
        }
        .footer-logo {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }
        .footer-text {
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.5;
        }
        .footer-divider {
          width: 40px;
          height: 3px;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          margin: 12px auto;
          border-radius: 2px;
        }
      </style>
    </head>
    <body style="margin: 0; padding: 40px 20px; background-color: #f3f4f6;">
      <div class="email-container">
        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#22c55e" style="background-color: #22c55e;">
          <tr>
            <td align="center" style="padding: 32px 28px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="56" height="56" bgcolor="#4ade80" style="background-color: #4ade80; border-radius: 50%; width: 56px; height: 56px;">
                      <tr>
                        <td align="center" valign="middle" style="font-size: 28px; color: #ffffff;">✅</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="color: #ffffff; font-size: 22px; font-weight: bold; padding-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Script Revisado pela Curadoria</td>
                </tr>
                <tr>
                  <td align="center" style="color: #dcfce7; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${mensagemContexto}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <div class="email-body">
          <!-- Badge de Aprovado -->
          <div class="aprovado-badge">
            🏆 VERSÃO OFICIAL REVISADA
          </div>

          <!-- Informações do Chamado -->
          <div class="info-section">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #f0fdf4; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">🔖</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Referência do Script</div>
                        <div><span style="display: inline-block; background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); color: #166534; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 14px;">${script.numero_referencia ? `#${script.numero_referencia}` : 'N/A'}</span></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #f0fdf4; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">🎫</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Número do Chamado</div>
                        <div><span style="display: inline-block; background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); color: #166534; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 14px;">#${script.numero_chamado || 'N/A'}</span></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #f0fdf4; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">👤</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Criador do Script</div>
                        <div><span style="display: inline-block; background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); color: #166534; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 14px;">${script.criado_por_nome || 'Não identificado'}</span></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #f0fdf4; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">📅</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Data de Revisão</div>
                        <div style="font-size: 15px; color: #1f2937;">${dataAtual}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>

          <!-- Título do Script -->
          <div class="script-title">
            <div class="script-title-label">📄 Título do Script</div>
            <div class="script-title-value">${script.nome}</div>
          </div>

          <!-- Pergunta -->
          <div class="question-box">
            <div class="question-label">
              <span>❓</span>
              <span>Pergunta do Usuário</span>
            </div>
            <div class="question-text">
              "${script.pergunta || 'Não informada'}"
            </div>
          </div>

          <!-- Script Revisado -->
          <div class="script-proposal">
            <div class="script-proposal-header">
              <span>📋 Script Revisado</span>
            </div>
            <div class="script-proposal-content">
              ${processarConteudoParaEmail(script.conteudo) || '<em>Sem conteúdo</em>'}
            </div>
          </div>

          ${script.conteudo_atendente ? `
          <!-- Script para o Atendente -->
          <div class="script-proposal" style="margin-top: 16px;">
            <div class="script-proposal-header" style="background: linear-gradient(135deg, #ea580c, #c2410c); color: #ffffff;">
              <span>🛠️ Orientações para o Atendente</span>
            </div>
            <div class="script-proposal-content" style="border-color: #fed7aa; background-color: #fff7ed;">
              ${processarConteudoParaEmail(script.conteudo_atendente)}
            </div>
          </div>
          ` : ''}

          <!-- Call to Action -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 24px 0 8px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${APP_HOME_URL}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="21%" strokecolor="#22c55e" fillcolor="#22c55e">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">Acessar Sistema de Scripts</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${APP_HOME_URL}" 
                   style="display: inline-block; background-color: #22c55e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: bold; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; mso-hide: all;">
                  Acessar Sistema de Scripts
                </a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>

          <!-- Aviso -->
          <div class="system-notice">
            <span class="system-notice-icon">✅</span>
            <span class="system-notice-text">
              Esta é a versão oficial do script, revisada pela curadoria. 
              Pode ser utilizada como referência para atendimentos futuros.
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div class="email-footer">
          <div class="footer-logo">Sistema de Scripts - SGS</div>
          <div class="footer-divider"></div>
          <div class="footer-text">
            Este é um email automático enviado pelo Sistema de Gerenciamento de Scripts.<br>
            Setor de Suporte Técnico - TJSP<br>
            <a href="${APP_HOME_URL}" style="color: #9ca3af; text-decoration: underline;"><strong>${APP_PUBLIC_SITE_LABEL}</strong></a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Interface para destinatário com contexto
 */
export interface DestinatarioComContexto {
  email: string;
  contexto: DestinatarioContexto;
}

/**
 * Envia email de notificação de novo script com mensagens personalizadas por destinatário
 * Agrupa destinatários pelo tipo de mensagem para otimizar envios
 */
export const enviarEmailNovoScriptPersonalizado = async (
  destinatarios: DestinatarioComContexto[],
  script: ScriptEmailData
): Promise<EmailResponse> => {
  if (destinatarios.length === 0) {
    return {
      sucesso: false,
      erro: 'Nenhum destinatário fornecido'
    };
  }

  try {
    // Agrupa destinatários por tipo de contexto para enviar emails em lote
    const porContexto = new Map<string, { emails: string[]; contexto: DestinatarioContexto }>();
    
    for (const dest of destinatarios) {
      // Cria uma chave baseada no tipo de relacionamento
      const chave = dest.contexto.is_autor 
        ? 'autor' 
        : dest.contexto.is_mesma_equipe 
          ? 'mesmaEquipe' 
          : 'outraEquipe';
      
      if (!porContexto.has(chave)) {
        porContexto.set(chave, { emails: [], contexto: dest.contexto });
      }
      porContexto.get(chave)!.emails.push(dest.email);
    }

    let totalEnviados = 0;
    const todosResultados: any[] = [];

    // Envia emails para cada grupo de contexto
    for (const [, grupo] of porContexto) {
      const assunto = `📝 Novo Script Proposto - #${script.numero_chamado || 'N/A'}`;
      const corpoHtml = templateCriacao(script, grupo.contexto);

      const { data, error } = await supabase.rpc('enviar_emails_zeptomail_lote', {
        p_destinatarios: grupo.emails,
        p_assunto: assunto,
        p_corpo_html: corpoHtml,
        p_remetente_email: REMETENTE_EMAIL,
        p_remetente_nome: REMETENTE_NOME
      });

      if (error) {
        console.error('Erro RPC ZeptoMail (personalizado):', error);
      } else {
        totalEnviados += data?.enviados || 0;
        if (data?.resultados) {
          todosResultados.push(...data.resultados);
        }
      }
    }

    return {
      sucesso: totalEnviados > 0,
      enviados: totalEnviados,
      total: destinatarios.length,
      resultados: todosResultados
    };

  } catch (error) {
    console.error('Erro ao enviar email personalizado:', error);
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

/**
 * Envia email de curadoria com mensagens personalizadas por destinatário
 */
export const enviarEmailCuradoriaPersonalizado = async (
  destinatarios: DestinatarioComContexto[],
  script: ScriptEmailData
): Promise<EmailResponse> => {
  if (destinatarios.length === 0) {
    return {
      sucesso: false,
      erro: 'Nenhum destinatário fornecido'
    };
  }

  try {
    // Agrupa destinatários por tipo de contexto
    const porContexto = new Map<string, { emails: string[]; contexto: DestinatarioContexto }>();
    
    for (const dest of destinatarios) {
      // Cria uma chave baseada no tipo de relacionamento
      const chave = dest.contexto.is_autor 
        ? 'autor' 
        : dest.contexto.is_mesma_equipe 
          ? 'mesmaEquipe' 
          : 'outraEquipe';
      
      if (!porContexto.has(chave)) {
        porContexto.set(chave, { emails: [], contexto: dest.contexto });
      }
      porContexto.get(chave)!.emails.push(dest.email);
    }

    let totalEnviados = 0;
    const todosResultados: any[] = [];

    // Envia emails para cada grupo de contexto
    for (const [, grupo] of porContexto) {
      const assunto = `✅ Script Revisado pela Curadoria - #${script.numero_chamado || 'N/A'}`;
      const corpoHtml = templateCuradoria(script, grupo.contexto);

      const { data, error } = await supabase.rpc('enviar_emails_zeptomail_lote', {
        p_destinatarios: grupo.emails,
        p_assunto: assunto,
        p_corpo_html: corpoHtml,
        p_remetente_email: REMETENTE_EMAIL,
        p_remetente_nome: REMETENTE_NOME
      });

      if (error) {
        console.error('Erro RPC ZeptoMail (curadoria personalizado):', error);
      } else {
        totalEnviados += data?.enviados || 0;
        if (data?.resultados) {
          todosResultados.push(...data.resultados);
        }
      }
    }

    return {
      sucesso: totalEnviados > 0,
      enviados: totalEnviados,
      total: destinatarios.length,
      resultados: todosResultados
    };

  } catch (error) {
    console.error('Erro ao enviar email de curadoria personalizado:', error);
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

/**
 * Envia email de notificação de novo script proposto
 */
export const enviarEmailNovoScript = async (
  emails: string[],
  script: ScriptEmailData
): Promise<EmailResponse> => {
  if (emails.length === 0) {
    return {
      sucesso: false,
      erro: 'Nenhum destinatário fornecido'
    };
  }

  try {
    const assunto = `📝 Novo Script Proposto - #${script.numero_chamado || 'N/A'}`;
    const corpoHtml = templateCriacao(script);

    // Chamar função RPC do Supabase para envio em lote
    const { data, error } = await supabase.rpc('enviar_emails_zeptomail_lote', {
      p_destinatarios: emails,
      p_assunto: assunto,
      p_corpo_html: corpoHtml,
      p_remetente_email: REMETENTE_EMAIL,
      p_remetente_nome: REMETENTE_NOME
    });

    if (error) {
      console.error('Erro RPC ZeptoMail:', error);
      return {
        sucesso: false,
        erro: `Erro na função RPC: ${error.message}`
      };
    }

    // Log dos resultados
    console.log('Resultado envio ZeptoMail:', data);

    if (!data?.success && data?.enviados === 0) {
      return {
        sucesso: false,
        erro: data?.error || 'Nenhum email foi enviado',
        enviados: 0,
        total: emails.length
      };
    }

    return {
      sucesso: data?.success ?? (data?.enviados > 0),
      enviados: data?.enviados || 0,
      total: data?.total || emails.length,
      resultados: data?.resultados || []
    };

  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

/**
 * Envia email de notificação de script revisado pela curadoria
 */
export const enviarEmailCuradoria = async (
  emails: string[],
  script: ScriptEmailData
): Promise<EmailResponse> => {
  if (emails.length === 0) {
    return {
      sucesso: false,
      erro: 'Nenhum destinatário fornecido'
    };
  }

  try {
    const assunto = `✅ Script Revisado pela Curadoria - #${script.numero_chamado || 'N/A'}`;
    const corpoHtml = templateCuradoria(script);

    // Chamar função RPC do Supabase para envio em lote
    const { data, error } = await supabase.rpc('enviar_emails_zeptomail_lote', {
      p_destinatarios: emails,
      p_assunto: assunto,
      p_corpo_html: corpoHtml,
      p_remetente_email: REMETENTE_EMAIL,
      p_remetente_nome: REMETENTE_NOME
    });

    if (error) {
      console.error('Erro RPC ZeptoMail (curadoria):', error);
      return {
        sucesso: false,
        erro: `Erro na função RPC: ${error.message}`
      };
    }

    console.log('Resultado envio ZeptoMail (curadoria):', data);

    if (!data?.success && data?.enviados === 0) {
      return {
        sucesso: false,
        erro: data?.error || 'Nenhum email foi enviado',
        enviados: 0,
        total: emails.length
      };
    }

    return {
      sucesso: data?.success ?? (data?.enviados > 0),
      enviados: data?.enviados || 0,
      total: data?.total || emails.length,
      resultados: data?.resultados || []
    };

  } catch (error) {
    console.error('Erro ao enviar email de curadoria:', error);
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

/**
 * Verifica se o serviço de email está configurado
 * (Agora sempre retorna true pois usa Supabase RPC)
 */
export const isEmailServiceConfigured = (): boolean => {
  return true;
};

/**
 * Envia um único email de teste
 */
export const enviarEmailTeste = async (
  destinatario: string,
  assunto: string = 'Email de Teste',
  corpo: string = '<h1>Teste</h1><p>Este é um email de teste do sistema.</p>'
): Promise<EmailResponse> => {
  try {
    const { data, error } = await supabase.rpc('enviar_email_zeptomail', {
      p_destinatario: destinatario,
      p_assunto: assunto,
      p_corpo_html: corpo,
      p_remetente_email: REMETENTE_EMAIL,
      p_remetente_nome: REMETENTE_NOME
    });

    if (error) {
      console.error('Erro RPC ZeptoMail (teste):', error);
      return {
        sucesso: false,
        erro: `Erro na função RPC: ${error.message}`
      };
    }

    return {
      sucesso: data?.success ?? false,
      enviados: data?.success ? 1 : 0,
      total: 1
    };

  } catch (error) {
    console.error('Erro ao enviar email de teste:', error);
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

/**
 * Gera o template HTML para email de boas-vindas ao novo usuário
 * Baseado no design dos templates de Scripts
 */
const templateBoasVindas = (usuario: UsuarioEmailData): string => {
  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const rolePtBr: Record<string, string> = {
    'user': 'Usuário',
    'supervisor': 'Supervisor',
    'coordenador': 'Coordenador',
    'admin': 'Administrador'
  };

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        }
        .email-header {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%);
          padding: 32px 28px;
          text-align: center;
        }
        .email-header-icon {
          width: 56px;
          height: 56px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 28px;
        }
        .email-header h1 {
          color: #ffffff;
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }
        .email-header p {
          color: rgba(255, 255, 255, 0.85);
          font-size: 14px;
          margin: 0;
        }
        .email-body {
          padding: 28px;
        }
        .info-section {
          margin-bottom: 24px;
        }
        .info-row {
          display: flex;
          align-items: flex-start;
          padding: 14px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-icon {
          width: 36px;
          height: 36px;
          background: #eff6ff;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-right: 14px;
          flex-shrink: 0;
          font-size: 16px;
        }
        .info-content {
          flex: 1;
        }
        .info-label {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 15px;
          color: #1f2937;
        }
        .info-value.highlight {
          display: inline-block;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          color: #1d4ed8;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
        }
        .credential-box {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 2px solid #fbbf24;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
        }
        .credential-label {
          font-size: 11px;
          font-weight: 600;
          color: #92400e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .credential-value {
          font-size: 18px;
          font-weight: 700;
          color: #78350f;
          font-family: 'Courier New', monospace;
          background: #fffbeb;
          padding: 12px 20px;
          border-radius: 8px;
          border: 1px dashed #fbbf24;
          margin: 8px 0;
        }
        .warning-box {
          background: #fef2f2;
          border: 1px solid #fca5a5;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .warning-icon {
          font-size: 20px;
          flex-shrink: 0;
        }
        .warning-text {
          font-size: 13px;
          color: #991b1b;
          line-height: 1.6;
        }
        .script-proposal {
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }
        .script-proposal-header {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          padding: 12px 20px;
          border-bottom: 1px solid #cbd5e1;
        }
        .script-proposal-header span {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .script-proposal-content {
          padding: 20px;
          font-size: 14px;
          color: #334155;
          line-height: 1.7;
        }
        .script-proposal-content ol {
          margin: 12px 0;
          padding-left: 24px;
        }
        .script-proposal-content li {
          margin-bottom: 8px;
        }
        .system-notice {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 8px;
          padding: 12px 16px;
          margin-top: 20px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .system-notice-icon {
          font-size: 16px;
          flex-shrink: 0;
        }
        .system-notice-text {
          font-size: 12px;
          color: #92400e;
        }
        .email-footer {
          background: #f9fafb;
          padding: 20px 28px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
        }
        .footer-logo {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 4px;
        }
        .footer-text {
          font-size: 12px;
          color: #9ca3af;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        
        <div class="email-header">
          <div class="email-header-icon">👤</div>
          <h1>Bem-vindo ao Sistema!</h1>
          <p>Sua conta foi criada com sucesso</p>
        </div>

        <div class="email-body">
          
          <div class="info-section">
            <p style="font-size: 15px; color: #374151; margin-bottom: 16px;">
              Olá <strong>${usuario.nome}</strong>,
            </p>
            <p style="font-size: 15px; color: #374151; margin-bottom: 20px;">
              Sua conta foi criada no <strong>Gerenciador Atende</strong>. 
              Abaixo estão suas credenciais de acesso:
            </p>
          </div>

          <div class="credential-box">
            <div class="credential-label">📧 Email de Login</div>
            <div class="credential-value">${usuario.email}</div>
            
            <div class="credential-label" style="margin-top: 16px;">🔑 Senha</div>
            <div class="credential-value">${usuario.senha}</div>
          </div>

          <div class="info-section">
            <div class="info-row">
              <div class="info-icon">👥</div>
              <div class="info-content">
                <div class="info-label">Perfil de Acesso</div>
                <div class="info-value highlight">${rolePtBr[usuario.role] || 'Usuário'}</div>
              </div>
            </div>
            
            ${usuario.setor_nome ? `
            <div class="info-row">
              <div class="info-icon">🏢</div>
              <div class="info-content">
                <div class="info-label">Setor</div>
                <div class="info-value">${usuario.setor_nome}</div>
              </div>
            </div>
            ` : ''}
            
            ${usuario.equipe_nome ? `
            <div class="info-row">
              <div class="info-icon">🎯</div>
              <div class="info-content">
                <div class="info-label">Equipe</div>
                <div class="info-value">${usuario.equipe_nome}</div>
              </div>
            </div>
            ` : ''}

            <div class="info-row">
              <div class="info-icon">📅</div>
              <div class="info-content">
                <div class="info-label">Data de Criação</div>
                <div class="info-value">${dataAtual}</div>
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${APP_HOME_URL}" 
               style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
              🚀 Acessar o Sistema
            </a>
          </div>

          <div class="script-proposal">
            <div class="script-proposal-header">
              <span>📖 Primeiros Passos</span>
            </div>
            <div class="script-proposal-content">
              <ol>
                <li>Clique no botão acima ou acesse <strong>${APP_PUBLIC_SITE_LABEL}</strong></li>
                <li>Faça login com o email e senha informados acima</li>
                <li>Explore o Gerenciador Atende (Scripts, Escala e demais módulos da sua equipe)</li>
                <li>Em caso de dúvidas, entre em contato com seu supervisor</li>
              </ol>
            </div>
          </div>

          <div class="system-notice">
            <div class="system-notice-icon">ℹ️</div>
            <div class="system-notice-text">
              <strong>Email automático:</strong> Esta mensagem foi gerada automaticamente 
              pelo sistema. Não responda a este email. Em caso de problemas com acesso, 
              contate o administrador do sistema.
            </div>
          </div>

        </div>

        <div class="email-footer">
          <div class="footer-logo">Gerenciador Atende</div>
          <div class="footer-text">SGS Sistemas © ${new Date().getFullYear()}</div>
        </div>

      </div>
    </body>
    </html>
  `;
};

/**
 * Envia email de boas-vindas para novo usuário
 */
export const enviarEmailBoasVindas = async (
  usuario: UsuarioEmailData
): Promise<EmailResponse> => {
  if (!usuario.email) {
    return {
      sucesso: false,
      erro: 'Email do usuário não fornecido'
    };
  }

  try {
    const assunto = `🎉 Bem-vindo ao Sistema - Credenciais de Acesso`;
    const corpoHtml = templateBoasVindas(usuario);

    const { data, error } = await supabase.rpc('enviar_email_zeptomail', {
      p_destinatario: usuario.email,
      p_assunto: assunto,
      p_corpo_html: corpoHtml,
      p_remetente_email: REMETENTE_EMAIL,
      p_remetente_nome: 'Gerenciador Atende - SGS'
    });

    if (error) {
      console.error('Erro RPC ZeptoMail (boas-vindas):', error);
      return {
        sucesso: false,
        erro: `Erro na função RPC: ${error.message}`
      };
    }

    console.log('Resultado envio ZeptoMail (boas-vindas):', data);

    return {
      sucesso: data?.success ?? false,
      enviados: data?.success ? 1 : 0,
      total: 1
    };

  } catch (error) {
    console.error('Erro ao enviar email de boas-vindas:', error);
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

// ==========================================
// Template e envio de Proposta de Revisão
// ==========================================

export const templatePropostaRevisao = (dados: {
  nomeScript: string;
  numeroChamado: string;
  pergunta: string;
  conteudoAtual: string;
  conteudoProposto: string;
  motivacao: string;
  autorProposta: string;
  campoAlvo: 'usuario_final' | 'atendente';
  propostaId: string;
  scriptNaoRevisado?: boolean;
}): string => {
  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const campoLabel = dados.campoAlvo === 'usuario_final' ? 'Usuário Final' : 'Atendente';
  const linkProposta = appHomeUrlWithQuery({ proposta: dados.propostaId });

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
        }
        .email-body {
          padding: 28px;
        }
        .info-section {
          margin-bottom: 24px;
        }
        .script-title {
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border: 1px solid #fcd34d;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
        }
        .script-title-label {
          font-size: 11px;
          font-weight: 600;
          color: #92400e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }
        .script-title-value {
          font-size: 18px;
          font-weight: 600;
          color: #78350f;
        }
        .content-block {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .content-block-header {
          padding: 12px 20px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .content-block-body {
          padding: 20px;
          background: #f9fafb;
          font-size: 14px;
          color: #334155;
          line-height: 1.7;
        }
        .content-block-body p { margin-bottom: 12px; }
        .content-block-body p:last-child { margin-bottom: 0; }
        .content-block-body strong { color: #1e293b; }
        .content-block-body ol, .content-block-body ul { margin: 12px 0; padding-left: 24px; }
        .content-block-body li { margin-bottom: 8px; }
        .motivacao-box {
          border-left: 4px solid #f59e0b;
          background: #fffbeb;
          border-radius: 0 12px 12px 0;
          padding: 16px 20px;
          margin-bottom: 20px;
        }
        .motivacao-label {
          font-size: 11px;
          font-weight: 600;
          color: #92400e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .motivacao-text {
          font-size: 15px;
          color: #78350f;
          font-style: italic;
        }
        .warning-banner {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 20px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .warning-icon { font-size: 16px; flex-shrink: 0; }
        .warning-text { font-size: 13px; color: #92400e; }
        .email-footer {
          background: #f9fafb;
          padding: 20px 28px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
        }
        .footer-logo {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }
        .footer-text {
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.5;
        }
        .footer-divider {
          width: 40px;
          height: 3px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          margin: 12px auto;
          border-radius: 2px;
        }
      </style>
    </head>
    <body style="margin: 0; padding: 40px 20px; background-color: #f3f4f6;">
      <div class="email-container">
        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%);">
          <tr>
            <td align="center" style="padding: 32px 28px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="56" height="56" style="background-color: rgba(255,255,255,0.2); border-radius: 50%; width: 56px; height: 56px;">
                      <tr>
                        <td align="center" valign="middle" style="font-size: 28px; color: #ffffff;">📋</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="color: #ffffff; font-size: 22px; font-weight: bold; padding-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Proposta de Revisão de Script</td>
                </tr>
                <tr>
                  <td align="center" style="color: #fef3c7; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Uma proposta de alteração foi enviada para análise</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <div class="email-body">
          ${dados.scriptNaoRevisado ? `
          <!-- Banner script não revisado -->
          <div class="warning-banner">
            <span class="warning-icon">⚠️</span>
            <span class="warning-text"><strong>Atenção:</strong> Este script ainda não foi revisado pela Curadoria.</span>
          </div>
          ` : ''}

          <!-- Informações -->
          <div class="info-section">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #fffbeb; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">🎫</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Número do Chamado</div>
                        <div><span style="display: inline-block; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #92400e; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 14px;">#${dados.numeroChamado || 'N/A'}</span></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #fffbeb; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">👤</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Autor da Proposta</div>
                        <div style="font-size: 15px; color: #1f2937;">${dados.autorProposta}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 14px 0; border-bottom: 1px solid #e5e7eb;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #fffbeb; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">📝</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Campo Alterado</div>
                        <div style="font-size: 15px; color: #1f2937;">Script para ${campoLabel}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 14px 0;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 36px; height: 36px; background: #fffbeb; border-radius: 10px; text-align: center; vertical-align: middle; font-size: 16px;">📅</td>
                      <td style="padding-left: 14px;">
                        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Data da Proposta</div>
                        <div style="font-size: 15px; color: #1f2937;">${dataAtual}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>

          <!-- Título do Script -->
          <div class="script-title">
            <div class="script-title-label">📄 Título do Script</div>
            <div class="script-title-value">${dados.nomeScript}</div>
          </div>

          <!-- Pergunta -->
          ${dados.pergunta ? `
          <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 600; color: #a16207; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
              <span>❓</span><span>Pergunta do Usuário</span>
            </div>
            <div style="font-size: 15px; color: #713f12; font-style: italic;">"${dados.pergunta}"</div>
          </div>
          ` : ''}

          <!-- Conteúdo Atual -->
          <div class="content-block">
            <div class="content-block-header" style="background: #f0fdf4; color: #166534;">
              📗 Conteúdo Atual
            </div>
            <div class="content-block-body">
              ${processarConteudoParaEmail(dados.conteudoAtual) || '<em>Sem conteúdo</em>'}
            </div>
          </div>

          <!-- Conteúdo Proposto -->
          <div class="content-block">
            <div class="content-block-header" style="background: #fffbeb; color: #92400e;">
              📙 Conteúdo Proposto
            </div>
            <div class="content-block-body">
              ${processarConteudoParaEmail(dados.conteudoProposto) || '<em>Sem conteúdo</em>'}
            </div>
          </div>

          <!-- Motivação -->
          <div class="motivacao-box">
            <div class="motivacao-label">💬 Motivação</div>
            <div class="motivacao-text">"${dados.motivacao}"</div>
          </div>

          <!-- Call to Action -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding: 24px 0 8px;">
                <!--[if mso]>
                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${linkProposta}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="21%" strokecolor="#f59e0b" fillcolor="#f59e0b">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;">Analisar Proposta</center>
                </v:roundrect>
                <![endif]-->
                <!--[if !mso]><!-->
                <a href="${linkProposta}" 
                   style="display: inline-block; background-color: #f59e0b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: bold; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; mso-hide: all;">
                  Analisar Proposta
                </a>
                <!--<![endif]-->
              </td>
            </tr>
          </table>

          <!-- Aviso -->
          <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; margin-top: 20px; display: flex; align-items: flex-start; gap: 10px;">
            <span style="font-size: 16px; flex-shrink: 0;">📋</span>
            <span style="font-size: 12px; color: #92400e;">
              O script atual permanece inalterado até que esta proposta seja aprovada ou rejeitada pela curadoria.
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div class="email-footer">
          <div class="footer-logo">Sistema de Scripts - SGS</div>
          <div class="footer-divider"></div>
          <div class="footer-text">
            Este é um email automático enviado pelo Sistema de Gerenciamento de Scripts.<br>
            Setor de Suporte Técnico - TJSP<br>
            <a href="${APP_HOME_URL}" style="color: #9ca3af; text-decoration: underline;"><strong>${APP_PUBLIC_SITE_LABEL}</strong></a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const enviarEmailPropostaRevisao = async (
  emailCuradorAnterior: string | null,
  dados: Parameters<typeof templatePropostaRevisao>[0]
): Promise<EmailResponse> => {
  // Se não há curador anterior, não enviar (retorno silencioso sucesso)
  if (!emailCuradorAnterior) {
    return { sucesso: true, enviados: 0, total: 0, resultados: [] };
  }

  try {
    const assunto = `📋 Proposta de Revisão - Script #${dados.numeroChamado || 'N/A'}`;
    const corpoHtml = templatePropostaRevisao(dados);

    const { data, error } = await supabase.rpc('enviar_emails_zeptomail_lote', {
      p_destinatarios: [emailCuradorAnterior],
      p_assunto: assunto,
      p_corpo_html: corpoHtml,
      p_remetente_email: REMETENTE_EMAIL,
      p_remetente_nome: REMETENTE_NOME
    });

    if (error) {
      console.error('Erro RPC ZeptoMail (proposta revisão):', error);
      return {
        sucesso: false,
        erro: `Erro na função RPC: ${error.message}`
      };
    }

    console.log('Resultado envio ZeptoMail (proposta revisão):', data);

    if (!data?.success && data?.enviados === 0) {
      return {
        sucesso: false,
        erro: data?.error || 'Nenhum email foi enviado',
        enviados: 0,
        total: 1
      };
    }

    return {
      sucesso: data?.success ?? (data?.enviados > 0),
      enviados: data?.enviados || 0,
      total: data?.total || 1,
      resultados: data?.resultados || []
    };

  } catch (error) {
    console.error('Erro ao enviar email de proposta de revisão:', error);
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};
