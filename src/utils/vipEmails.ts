// Lista de emails VIP do sistema (mesmos da Lambda AWS)
const VIP_EMAILS: string[] = [
  'lamorim@sp.gov.br','ndeliberali@sp.gov.br','epreis@sp.gov.br','abocafoli@sp.gov.br','asocampos@sp.gov.br',
  'eliasilva@sp.gov.br','dmigoto@sp.gov.br','vcarbonieri@sp.gov.br','abraaog@tjsp.jus.br','ahoroiwa@tjsp.jus.br',
  'adrianams@tjsp.jus.br','afpaula@tjsp.jus.br','adrianazovedilopes@tjsp.jus.br','adominguito@tjsp.jus.br',
  'agnicolau@tjsp.jus.br','akvint@tjsp.jus.br','aleocidiomv@tjsp.jus.br','alessandrabraz@tjsp.jus.br',
];

// Domínios VIP (mesmos da Lambda AWS)
const DOMINIOS_VIP: string[] = ['mpsp', 'imesc', 'defensoria', 'agu'];

// Função para verificar se um email é VIP (por lista de emails ou domínio)
export const isEmailVip = (email: string): boolean => {
  if (!email) return false;
  
  const normalizedEmail = email.toLowerCase().trim();
  
  // Verifica lista de emails VIP específicos
  if (VIP_EMAILS.some(vipEmail => vipEmail.toLowerCase() === normalizedEmail)) {
    return true;
  }
  
  // Verifica domínios VIP
  for (const dominio of DOMINIOS_VIP) {
    if (normalizedEmail.includes(`@${dominio}`) || normalizedEmail.includes(`.${dominio}.`)) {
      return true;
    }
  }
  
  return false;
};

// Função para adicionar email à lista VIP (se necessário)
export const addVipEmail = (email: string): void => {
  const normalizedEmail = email.toLowerCase().trim();
  if (!VIP_EMAILS.includes(normalizedEmail)) {
    VIP_EMAILS.push(normalizedEmail);
  }
};

// Função para remover email da lista VIP
export const removeVipEmail = (email: string): void => {
  const normalizedEmail = email.toLowerCase().trim();
  const index = VIP_EMAILS.indexOf(normalizedEmail);
  if (index > -1) {
    VIP_EMAILS.splice(index, 1);
  }
};

// Função para obter lista completa de emails VIP
export const getVipEmails = (): string[] => {
  return [...VIP_EMAILS];
};