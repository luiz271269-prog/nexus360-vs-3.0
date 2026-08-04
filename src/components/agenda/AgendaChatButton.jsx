import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MessageSquare, Loader2 } from 'lucide-react';
import ClienteChatDrawer from '@/components/clientes/ClienteChatDrawer';
import { toast } from 'sonner';

/**
 * Abre a conversa em bolha (drawer) igual ao CRM de Clientes/Orçamentos,
 * reusando o mesmo ClienteChatDrawer. Resolve o contato pelo contact_id
 * ou thread_id do item da agenda quando necessário.
 */
export default function AgendaChatButton({ item }) {
  const [open, setOpen] = React.useState(false);
  const [carregando, setCarregando] = React.useState(false);
  const [cliente, setCliente] = React.useState(null);
  const raw = item.raw || {};

  const abrir = async e => {
    e.stopPropagation();
    setCarregando(true);
    try {
      let contato = null;
      if (raw.contact_id) contato = await base44.entities.Contact.get(raw.contact_id).catch(() => null);
      if (!contato && item.threadId) {
        const thread = await base44.entities.MessageThread.get(item.threadId).catch(() => null);
        if (thread?.contact_id) contato = await base44.entities.Contact.get(thread.contact_id).catch(() => null);
      }
      const alvo = contato
        ? { id: contato.cliente_id || raw.cliente_id, telefone: contato.telefone, razao_social: contato.empresa || contato.nome }
        : raw.cliente_id
          ? await base44.entities.Cliente.get(raw.cliente_id).catch(() => null)
          : null;
      if (!alvo) { toast.error('Sem contato vinculado a este item'); return; }
      setCliente(alvo);
      setOpen(true);
    } finally { setCarregando(false); }
  };

  return <>
    <Button size="icon" variant="ghost" className="h-8 w-8 text-sky-600 hover:bg-sky-50" title="Abrir conversa" onClick={abrir} disabled={carregando}>
      {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
    </Button>
    {open && cliente && <ClienteChatDrawer cliente={cliente} isOpen={open} onClose={() => setOpen(false)} />}
  </>;
}