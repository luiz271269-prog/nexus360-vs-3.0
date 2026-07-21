import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MessageSquarePlus, Phone, User } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Formulário exibido no ClienteChatDrawer quando não existe contato/conversa.
 * Permite corrigir nome + telefone, cria o contato (via função centralizada
 * anti-duplicação), vincula ao cliente do CRM e abre a conversa na hora.
 */
export default function IniciarConversaForm({ cliente, onConversaCriada }) {
  const [nome, setNome] = React.useState(
    cliente?.contato_principal_nome || cliente?.razao_social || cliente?.nome_fantasia || ''
  );
  const [telefone, setTelefone] = React.useState(cliente?.telefone || cliente?.celular || '');
  const [salvando, setSalvando] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const digitos = String(telefone).replace(/\D/g, '');
    if (digitos.length < 10) {
      toast.error('Informe um número válido com DDD (ex: 48 99999-9999)');
      return;
    }
    setSalvando(true);
    try {
      // 1. Criar/localizar contato pela função centralizada (anti-duplicação)
      const r = await base44.functions.invoke('getOrCreateContactCentralized', {
        telefone,
        pushName: nome || undefined,
      });
      const contato = r?.data?.contact;
      if (!contato) throw new Error(r?.data?.error || 'Falha ao criar contato');

      // 2. Vincular ao cliente do CRM e completar dados
      const upd = {};
      if (cliente?.id && !contato.cliente_id) upd.cliente_id = cliente.id;
      if (!contato.empresa && (cliente?.nome_fantasia || cliente?.razao_social)) {
        upd.empresa = cliente.nome_fantasia || cliente.razao_social;
      }
      if (nome && (!contato.nome || contato.nome.startsWith('Contato '))) upd.nome = nome;
      if (Object.keys(upd).length > 0) {
        await base44.entities.Contact.update(contato.id, upd).catch(() => {});
      }

      // 3. Corrigir o telefone no cadastro do cliente (número normalizado)
      if (cliente?.id && contato.telefone && cliente.telefone !== contato.telefone) {
        await base44.entities.Cliente.update(cliente.id, { telefone: contato.telefone }).catch(() => {});
      }

      // 4. Buscar ou criar a conversa
      const threads = await base44.entities.MessageThread.filter(
        { contact_id: contato.id, status: 'aberta' }, '-last_message_at', 1
      );
      let thread = threads?.[0];
      if (!thread) {
        thread = await base44.entities.MessageThread.create({
          contact_id: contato.id,
          cliente_id: cliente?.id || contato.cliente_id || null,
          thread_type: 'contact_external',
          channel: 'whatsapp',
          is_canonical: true,
          status: 'aberta',
        });
      }

      toast.success('Conversa pronta! Pode enviar a primeira mensagem.');
      onConversaCriada({ ...contato, ...upd }, thread);
    } catch (err) {
      console.error('[IniciarConversaForm] Erro:', err);
      toast.error('Erro ao iniciar conversa: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto space-y-3 text-left">
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" /> Nome do contato
        </Label>
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome de quem vai receber a mensagem"
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" /> WhatsApp (com DDD)
        </Label>
        <Input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="Ex: 48 99999-9999"
          className="h-9 text-sm"
        />
      </div>
      <Button
        type="submit"
        disabled={salvando}
        className="w-full h-9 bg-green-600 hover:bg-green-700 text-white gap-2"
      >
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquarePlus className="w-4 h-4" />}
        {salvando ? 'Preparando conversa…' : 'Salvar e iniciar conversa'}
      </Button>
      <p className="text-[11px] text-slate-400 text-center">
        O número será salvo no contato e no cadastro do cliente.
      </p>
    </form>
  );
}