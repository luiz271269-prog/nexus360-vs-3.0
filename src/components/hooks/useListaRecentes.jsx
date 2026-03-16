import React from 'react';

export function useListaRecentes({
  threadsFiltradas = [],
  contatos = [],
  atendentes = [],
  normalizarTelefone = (tel) => tel,
  getUserDisplayName = (id) => id
}) {
  return React.useMemo(() => {
    const contatosMap = new Map(contatos.map((c) => [c.id, c]));
    const usuariosMap = new Map(atendentes.map((a) => [a.id, a]));

    const enriched = threadsFiltradas.map((thread) => {
      const usuarioAtribuido = usuariosMap.get(thread.assigned_user_id);
      const contatoObj = thread.contato || contatosMap.get(thread.contact_id);
      const meta = contatoObj?._meta || {};

      return {
        ...thread,
        contato: contatoObj,
        atendente_atribuido: usuarioAtribuido,
        assigned_user_display_name: usuarioAtribuido ? getUserDisplayName(usuarioAtribuido.id, atendentes) : null,
        uiMeta: {
          temDadosBasicos: meta.tem_dados_basicos ?? false,
          scoreCompletude: meta.score_completude ?? 0
        }
      };
    });

    const gerarChaveUnica = (contato) => {
      if (!contato) return null;
      const tel = normalizarTelefone(contato.telefone || '') || '';
      const nome = (contato.nome || '').trim().toLowerCase();
      const empresa = (contato.empresa || '').trim().toLowerCase();
      const cargo = (contato.cargo || '').trim().toLowerCase();
      return `${tel}|${nome}|${empresa}|${cargo}`;
    };

    const threadsPorChaveUnica = new Map();
    enriched.forEach((thread) => {
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        threadsPorChaveUnica.set(`internal-${thread.id}`, thread);
        return;
      }

      const chave = gerarChaveUnica(thread.contato);
      if (!chave) {
        threadsPorChaveUnica.set(`orphan-${thread.id}`, thread);
        return;
      }

      const existente = threadsPorChaveUnica.get(chave);
      if (!existente) {
        threadsPorChaveUnica.set(chave, thread);
      } else {
        const tsExistente = new Date(existente.last_message_at || 0).getTime();
        const tsAtual = new Date(thread.last_message_at || 0).getTime();
        if (tsAtual > tsExistente) {
          threadsPorChaveUnica.set(chave, thread);
        }
      }
    });

    const deduplicated = Array.from(threadsPorChaveUnica.values());

    return deduplicated.sort((a, b) => {
      const getPrioridade = (item) => {
        if (item.is_cliente_only) return 3;
        if (item.is_contact_only) return 2;
        return 1;
      };

      const prioA = getPrioridade(a);
      const prioB = getPrioridade(b);
      if (prioA !== prioB) return prioA - prioB;

      const dateA = new Date(a.last_message_at || 0);
      const dateB = new Date(b.last_message_at || 0);
      return dateB - dateA;
    });
  }, [threadsFiltradas, contatos, atendentes, normalizarTelefone, getUserDisplayName]);
}