/**
 * Hook useBrowserNotifications
 * 
 * Gerencia notificações do navegador e badge no título da aba:
 * - Atualiza título da aba com contador de notificações não lidas
 * - Mostra notificações push do navegador quando recebe menção
 * - Gerencia permissão de notificações
 */

import { useEffect, useCallback, useState, useRef } from 'react';

interface UseBrowserNotificationsProps {
  unreadCount: number;
  enabled?: boolean;
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export const useBrowserNotifications = ({ 
  unreadCount, 
  enabled = true 
}: UseBrowserNotificationsProps) => {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const originalTitleRef = useRef<string>(document.title.replace(/^\(\d+\)\s*/, ''));
  const notificationCallbackRef = useRef<(() => void) | null>(null);

  // Verificar permissão inicial
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Atualizar título da aba com contador
  useEffect(() => {
    if (!enabled) return;

    // Salvar título original sem contador (apenas uma vez)
    const cleanTitle = document.title.replace(/^\(\d+\)\s*/, '');
    if (cleanTitle !== originalTitleRef.current && !cleanTitle.startsWith('(')) {
      originalTitleRef.current = cleanTitle;
    }

    // Atualizar título
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${originalTitleRef.current}`;
    } else {
      document.title = originalTitleRef.current;
    }

    // Cleanup: restaurar título original ao desmontar
    return () => {
      document.title = originalTitleRef.current;
    };
  }, [unreadCount, enabled]);

  // Solicitar permissão de notificação
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('[useBrowserNotifications] Navegador não suporta notificações');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('[useBrowserNotifications] Erro ao solicitar permissão:', error);
      return false;
    }
  }, []);

  // Mostrar notificação do navegador
  const showNotification = useCallback(({ 
    title, 
    body, 
    icon,
    tag,
    onClick 
  }: NotificationPayload) => {
    console.log('[useBrowserNotifications] showNotification chamado:', { title, body, tag });
    
    if (!('Notification' in window)) {
      console.warn('[useBrowserNotifications] Navegador não suporta notificações');
      return null;
    }

    console.log('[useBrowserNotifications] Permissão atual:', Notification.permission);
    if (Notification.permission !== 'granted') {
      console.warn('[useBrowserNotifications] Permissão não concedida');
      return null;
    }

    // Log se página está focada (mas não bloqueia mais)
    const hasFocus = document.hasFocus();
    console.log('[useBrowserNotifications] Página focada?', hasFocus, '(notificação será exibida de qualquer forma)');

    try {
      // Criar notificação sem ícone para evitar erros 404
      const notificationOptions: NotificationOptions = {
        body,
        tag, // Previne notificações duplicadas com mesmo tag
        requireInteraction: false,
        silent: false
      };
      
      // Só adicionar ícone se foi explicitamente fornecido
      if (icon) {
        notificationOptions.icon = icon;
      }
      
      console.log('[useBrowserNotifications] Criando notificação com opções:', notificationOptions);
      const notification = new Notification(title, notificationOptions);
      console.log('[useBrowserNotifications] ✅ Notificação criada com sucesso!', notification);

      // Handler de clique
      notification.onclick = () => {
        console.log('[useBrowserNotifications] Notificação clicada');
        window.focus();
        notification.close();
        onClick?.();
      };
      
      // Handler de erro
      notification.onerror = (error) => {
        console.error('[useBrowserNotifications] ❌ Erro na notificação:', error);
      };
      
      // Handler de exibição
      notification.onshow = () => {
        console.log('[useBrowserNotifications] 🔔 Notificação exibida na tela!');
      };

      // Auto-fechar após 5 segundos
      setTimeout(() => notification.close(), 5000);

      return notification;
    } catch (error) {
      console.error('[useBrowserNotifications] Erro ao mostrar notificação:', error);
      return null;
    }
  }, []);

  // Notificar sobre nova menção
  const notifyMention = useCallback((
    mentionerName: string, 
    ticketNumero: string,
    isTeamMention: boolean = false,
    onClickCallback?: () => void
  ) => {
    console.log('[useBrowserNotifications] notifyMention chamado:', { mentionerName, ticketNumero, isTeamMention });
    
    const title = isTeamMention 
      ? '👥 Menção de Equipe' 
      : '🔔 Você foi mencionado';
    
    const body = `${mentionerName} mencionou você no chamado #${ticketNumero}`;

    // Guardar callback para uso posterior
    notificationCallbackRef.current = onClickCallback || null;

    showNotification({
      title,
      body,
      tag: `mention-${ticketNumero}`, // Previne duplicatas do mesmo ticket
      onClick: onClickCallback
    });
  }, [showNotification]);

  // Verificar se notificações são suportadas
  const isSupported = 'Notification' in window;
  const isGranted = permissionStatus === 'granted';
  const isDenied = permissionStatus === 'denied';

  return {
    // Estado
    permissionStatus,
    isSupported,
    isGranted,
    isDenied,
    
    // Ações
    requestPermission,
    showNotification,
    notifyMention
  };
};

export default useBrowserNotifications;
