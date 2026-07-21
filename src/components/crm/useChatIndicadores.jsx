import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Últimos 8 dígitos — casa variações com/sem DDI 55 e com/sem o 9 do celular
const chaveTelefone = (tel) => {
  if (!tel) return null;
  const d = String(tel).replace(/\D/g, '');
  if (d.length < 8) return null;
  return d.slice(-8);
};

/**
 * Hook compartilhado do CRM: 1 única consulta (cacheada p/ tela toda)
 * busca conversas abertas com mensagens não lidas e mapeia de volta
 * para clientes (por cliente_id e por telefone) e contatos.
 */
export default function useChatIndicadores() {
  const { data } = useQuery({
    queryKey: ['crm-chat-indicadores'],
    queryFn: async () => {
      const threads = await base44.entities.MessageThread.filter(
        { thread_type: 'contact_external', status: 'aberta', unread_count: { $gt: 0 } },
        '-last_message_at',
        200
      );

      const porContatoId = {};
      for (const t of threads) {
        if (!t.contact_id) continue;
        const atual = porContatoId[t.contact_id];
        porContatoId[t.contact_id] = {
          naoLidas: (atual?.naoLidas || 0) + (t.unread_count || 0),
          ultimaMensagem: atual?.ultimaMensagem || t.last_message_content || '',
          ultimaEm: atual?.ultimaEm || t.last_message_at || null,
        };
      }

      const ids = Object.keys(porContatoId);
      let contatos = [];
      if (ids.length > 0) {
        contatos = await base44.entities.Contact.filter(
          { id: { $in: ids } }, '-updated_date', 200
        ).catch(() => []);
      }

      const porClienteId = {};
      const porTelefone = {};
      for (const c of contatos) {
        const info = porContatoId[c.id];
        if (!info) continue;
        if (c.cliente_id) porClienteId[c.cliente_id] = info;
        const k = chaveTelefone(c.telefone_canonico || c.telefone);
        if (k) porTelefone[k] = info;
      }

      return { porContatoId, porClienteId, porTelefone };
    },
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const mapas = data || { porContatoId: {}, porClienteId: {}, porTelefone: {} };

  const getIndicadorCliente = (cliente) => {
    if (!cliente) return null;
    return mapas.porClienteId[cliente.id]
      || mapas.porTelefone[chaveTelefone(cliente.telefone || cliente.celular) ?? '__x']
      || null;
  };

  const getIndicadorContato = (contato) => {
    if (!contato) return null;
    return mapas.porContatoId[contato.id]
      || (contato.cliente_id ? mapas.porClienteId[contato.cliente_id] : null)
      || mapas.porTelefone[chaveTelefone(contato.telefone_canonico || contato.telefone) ?? '__x']
      || null;
  };

  return { getIndicadorCliente, getIndicadorContato };
}