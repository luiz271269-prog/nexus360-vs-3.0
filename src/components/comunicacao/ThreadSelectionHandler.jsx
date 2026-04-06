import React from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { contatoFidelizadoAoUsuario } from '../lib/userMatcher';
import { verificarBloqueioThread } from '../lib/threadVisibility';

/**
 * Hook que encapsula toda a lógica de seleção de thread
 * Reduz ~300 linhas do Comunicacao.jsx
 */
export function useThreadSelection({
  integracoes,
  queryClient,
  clientes,
  contatos,
  usuario,
  threads,
  setThreadAtiva,
  setContatoPreCarregado,
  setShowContactInfo,
  setContactInitialData,
  setNovoContatoTelefone,
  setCriandoNovoContato,
  setModalSemPermissao
}) {
  return React.useCallback(async (threadData) => {
    const thread = threadData.id ? { id: threadData.id } : threadData;
    const contatoPre = threadData.contatoPreCarregado || threadData.contato || null;

    console.log('🖱️ [Comunicacao] Selecionando:', thread.id, contatoPre ? '(com contato pré-carregado)' : '');

    setCriandoNovoContato(false);
    setNovoContatoTelefone("");
    setShowContactInfo(false);
    setContactInitialData(null);
    setContatoPreCarregado(contatoPre);

    const isSyntheticId = thread.id && (
      thread.id.startsWith('contato-sem-thread-') ||
      thread.id.startsWith('cliente-sem-contato-')
    );

    let threadCompleta = thread;
    if (thread.id && !thread.contact_id && !thread.thread_type && !isSyntheticId) {
      threadCompleta = threads.find(t => t.id === thread.id) || thread;
    }

    // ✅ CASO 0: USUÁRIO INTERNO
    if (threadCompleta.thread_type === 'team_internal' || threadCompleta.thread_type === 'sector_group') {
      setThreadAtiva(threadCompleta);
      return;
    }

    // 🔧 AUTO-REDIRECIONAR: Se thread é merged
    if (thread.status === 'merged' && thread.merged_into) {
      console.log(`[Comunicacao] 🔀 Auto-redirecionar: ${thread.id} → ${thread.merged_into}`);
      const threadCanonica = threads.find((t) => t.id === thread.merged_into);
      if (threadCanonica) {
        setThreadAtiva(threadCanonica);
        return;
      }
    }

    // CASO 1: CLIENTE SEM CONTATO
    if (thread.is_cliente_only && thread.cliente_id) {
      const cliente = clientes.find((c) => c.id === thread.cliente_id);
      if (cliente) {
        setContactInitialData({
          cliente_id: cliente.id,
          empresa: cliente.nome_fantasia || cliente.razao_social,
          nome: cliente.contato_principal_nome || cliente.razao_social,
          telefone: cliente.telefone,
          vendedor_responsavel: cliente.vendedor_responsavel,
          ramo_atividade: cliente.ramo_atividade,
          tipo_contato: 'cliente',
          cargo: cliente.contato_principal_cargo || '',
          email: cliente.email || ''
        });
        setNovoContatoTelefone(cliente.telefone || '');
        setCriandoNovoContato(true);
        setShowContactInfo(true);
        setThreadAtiva(null);
        toast.info('💎 Cliente sem contato. Preencha para criar.');
        return;
      }
    }

    // CASO 2: CONTATO SEM THREAD
    if (thread.is_contact_only && thread.contact_id) {
      const integracaoAtiva = integracoes.find((i) => i.status === 'conectado');
      if (!integracaoAtiva) {
        toast.error('❌ Nenhuma integração WhatsApp ativa');
        return;
      }

      const threadsExistentes = await base44.entities.MessageThread.filter(
        {
          contact_id: thread.contact_id,
          whatsapp_integration_id: integracaoAtiva.id,
          is_canonical: true,
          status: 'aberta'
        },
        '-last_message_at',
        1
      );

      if (threadsExistentes && threadsExistentes.length > 0) {
        const contatoObj = contatos.find((c) => c.id === thread.contact_id);
        const isFidelizadoAoUsuario = contatoFidelizadoAoUsuario(contatoObj, usuario);

        if (isFidelizadoAoUsuario) {
          console.log('[Comunicacao] ✅ Contato fidelizado - abrindo thread canônica');
          setThreadAtiva(threadsExistentes[0]);
          return;
        }

        const bloqueio = verificarBloqueioThread(usuario, threadsExistentes[0], contatoObj);

        if (bloqueio.bloqueado) {
          setModalSemPermissao({
            isOpen: true,
            contato: contatoObj,
            atendenteResponsavel: bloqueio.atendenteResponsavel,
            motivoBloqueio: bloqueio.motivo,
            threadOriginal: threadsExistentes[0]
          });
          return;
        }

        setThreadAtiva(threadsExistentes[0]);
        return;
      }

      const novaThread = await base44.entities.MessageThread.create({
        contact_id: thread.contact_id,
        whatsapp_integration_id: integracaoAtiva.id,
        conexao_id: integracaoAtiva.id,
        is_canonical: true,
        status: 'aberta',
        unread_count: 0,
        janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        can_send_without_template: true,
        assigned_user_id: usuario.id,
        primeira_mensagem_at: new Date().toISOString()
      });

      await queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
      setThreadAtiva(novaThread);
      toast.info('📋 Conversa iniciada.');
      return;
    }

    // CASO 3: THREAD NORMAL
    const contatoObj = contatos.find((c) => c.id === thread.contact_id);
    const isFidelizadoAoUsuario = contatoFidelizadoAoUsuario(contatoObj, usuario);

    if (isFidelizadoAoUsuario) {
      console.log('[Comunicacao] ✅ Contato fidelizado - abrindo direto');
      setThreadAtiva(thread);
      return;
    }

    if (thread.status === 'merged' && thread.merged_into) {
      console.log(`[Comunicacao] 🔀 Auto-redirecionando thread merged ${thread.id} → ${thread.merged_into}`);
      const threadCanonica = threads.find((t) => t.id === thread.merged_into);
      if (threadCanonica) {
        setThreadAtiva(threadCanonica);
        return;
      }
    }

    const bloqueio = verificarBloqueioThread(usuario, thread, contatoObj);

    if (bloqueio.bloqueado) {
      console.log('[Comunicacao] 🔒 Thread bloqueada:', bloqueio);
      setModalSemPermissao({
        isOpen: true,
        contato: contatoObj,
        atendenteResponsavel: bloqueio.atendenteResponsavel,
        motivoBloqueio: bloqueio.motivo,
        threadOriginal: thread
      });
      return;
    }

    setThreadAtiva(threadCompleta);
  }, [integracoes, queryClient, clientes, contatos, usuario, threads]);
}