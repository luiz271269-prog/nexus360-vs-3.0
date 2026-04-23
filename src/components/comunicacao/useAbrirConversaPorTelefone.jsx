import React from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { normalizarTelefone } from "@/components/lib/phoneUtils";

/**
 * Hook: expõe window.handleAbrirConversaPorTelefone
 *
 * Usado pelo card de vCard no MessageBubble para abrir/criar
 * conversa direta a partir de um telefone + pushName.
 *
 * Isolado em hook separado para manter pages/Comunicacao.jsx
 * enxuto (abaixo do limite de 2000 linhas).
 */
export function useAbrirConversaPorTelefone({
  integracoes,
  usuario,
  queryClient,
  setThreadAtiva,
  setMobileView
}) {
  const handler = React.useCallback(async (telefone, pushName) => {
    try {
      const telNorm = normalizarTelefone(telefone);
      if (!telNorm) {
        toast.error('❌ Telefone inválido');
        return;
      }

      toast.info('🔄 Abrindo conversa...');

      // 1. Buscar ou criar contato
      const resultado = await base44.functions.invoke('getOrCreateContactCentralized', {
        telefone: telNorm,
        pushName: pushName || null,
        profilePicUrl: null
      });

      if (!resultado?.data?.success || !resultado?.data?.contact) {
        throw new Error(resultado?.data?.error || 'Falha ao localizar contato');
      }

      const contato = resultado.data.contact;

      // 2. Buscar thread canônica aberta existente
      const existentes = await base44.entities.MessageThread.filter(
        { contact_id: contato.id, is_canonical: true, status: 'aberta' },
        '-last_message_at',
        1
      );

      if (existentes && existentes.length > 0) {
        setThreadAtiva(existentes[0]);
        setMobileView('chat');
        toast.success('✅ Conversa aberta');
        return;
      }

      // 3. Criar nova thread se não existir
      const integ = integracoes.find((i) => i.status === 'conectado');
      if (!integ) {
        toast.error('❌ Nenhuma integração WhatsApp ativa');
        return;
      }

      const agora = new Date().toISOString();
      const nova = await base44.entities.MessageThread.create({
        contact_id: contato.id,
        whatsapp_integration_id: integ.id,
        conexao_id: integ.id,
        thread_type: 'contact_external',
        channel: 'whatsapp',
        is_canonical: true,
        status: 'aberta',
        unread_count: 0,
        total_mensagens: 0,
        assigned_user_id: usuario?.id,
        primeira_mensagem_at: agora,
        last_message_at: agora
      });

      await queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setThreadAtiva(nova);
      setMobileView('chat');
      toast.success('✅ Nova conversa iniciada');
    } catch (error) {
      console.error('[useAbrirConversaPorTelefone] Erro:', error);
      toast.error(`Erro: ${error.message}`);
    }
  }, [integracoes, usuario, queryClient, setThreadAtiva, setMobileView]);

  // Expõe globalmente (padrão já usado por handleCriarOportunidadeDeChat)
  React.useEffect(() => {
    window.handleAbrirConversaPorTelefone = handler;
    return () => { delete window.handleAbrirConversaPorTelefone; };
  }, [handler]);
}