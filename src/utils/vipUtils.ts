import { isEmailVip } from './vipEmails';

// GSEs que tornam o ticket VIP independentemente do email
const GSE_VIP_SUBSTRINGS = ['DEFPUB', 'PGM', 'AGU', 'MINPUB'];

const isGseVip = (gse?: string): boolean => {
  if (!gse) return false;
  const upper = gse.toUpperCase();
  return GSE_VIP_SUBSTRINGS.some(sub => upper.includes(sub));
};

// Função para determinar se um ticket é VIP
export const isTicketVip = (ticket: { vip?: boolean; email?: string; gse?: string }): boolean => {
  // Se já tem o campo VIP definido, usa ele
  if (typeof ticket.vip === 'boolean') {
    return ticket.vip;
  }
  
  // Verifica por GSE
  if (isGseVip(ticket.gse)) {
    return true;
  }

  // Se tem email, verifica se é VIP por email
  if (ticket.email) {
    return isEmailVip(ticket.email);
  }
  
  // Se não tem informações suficientes, considera não VIP
  return false;
};

// Função para reavaliar status VIP de um ticket baseado no email e GSE
export const reevaluateTicketVipStatus = (ticket: { vip?: boolean; email?: string; gse?: string }): boolean => {
  // Se o ticket já está marcado como VIP no banco (pela Lambda), mantém
  if (ticket.vip === true) {
    return true;
  }
  
  // Verifica por GSE
  if (isGseVip(ticket.gse)) {
    return true;
  }

  // Se não está VIP no banco, verifica pelo email (fallback)
  if (ticket.email) {
    return isEmailVip(ticket.email);
  }
  
  // Se não tem informações suficientes, considera não VIP
  return false;
};