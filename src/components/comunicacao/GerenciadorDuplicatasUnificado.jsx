import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users, AlertTriangle, CheckCircle2, Activity,
  Phone, Badge as BadgeIcon, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { normalizarTelefone } from '../lib/phoneUtils';

export default function GerenciadorDuplicatasUnificado({ usuarioAtual }) {
  const queryClient = useQueryClient();
  const [mesclandoId, setMesclandoId] = useState(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts-para-duplicatas'],
    queryFn: () => base44.entities.Contact.list('-created_date', 1000),
    staleTime: 5 * 60 * 1000
  });

  // ✅ AGRUPAMENTO INTELIGENTE: Detecta duplicatas por telefone
  const gruposDuplicados = useMemo(() => {
    const grupos = {};

    contacts.forEach(contact => {
      const normalized = normalizarTelefone(contact.telefone || contact.celular || '');
      if (!normalized || normalized.length < 10) return;

      if (!grupos[normalized]) {
        grupos[normalized] = [];
      }
      grupos[normalized].push(contact);
    });

    // Retorna apenas grupos com duplicatas (>1 contato)
    return Object.entries(grupos)
      .filter(([_, group]) => group.length > 1)
      .map(([phone, group]) => ({
        phone,
        contacts: group.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
      }))
      .sort((a, b) => b.contacts.length - a.contacts.length);
  }, [contacts]);

  // ✅ PROCESSA FUSÃO CIRÚRGICA
  const executarFusao = async (grupo) => {
    if (mesclandoId) return;

    const [mestre, ...duplicatas] = grupo.contacts;

    if (!window.confirm(
      `Confirma unificar ${duplicatas.length} contato(s) em "${mestre.nome || mestre.telefone}"?\n\nIsso mesclará conversas e apagará as duplicatas.`
    )) {
      return;
    }

    setMesclandoId(grupo.phone);
    let progressoMsg = '';

    try {
      let mensagensMovidas = 0;
      let conversasMovidas = 0;

      for (const duplicata of duplicatas) {
        // 1️⃣ FUSÃO DE DADOS
        const updateMestre = {};
        if (!mestre.email && duplicata.email) updateMestre.email = duplicata.email;
        if (!mestre.cargo && duplicata.cargo) updateMestre.cargo = duplicata.cargo;
        if (!mestre.empresa && duplicata.empresa) updateMestre.empresa = duplicata.empresa;

        const tagsSet = new Set(mestre.tags || []);
        (duplicata.tags || []).forEach(tag => tagsSet.add(tag));
        if ((duplicata.tags || []).length > 0) updateMestre.tags = Array.from(tagsSet);

        if (Object.keys(updateMestre).length > 0) {
          await base44.entities.Contact.update(mestre.id, updateMestre);
        }

        // 2️⃣ FUSÃO DE THREADS
        const threadsDup = await base44.entities.MessageThread.filter({ contact_id: duplicata.id });
        const threadsMestre = await base44.entities.MessageThread.filter({ contact_id: mestre.id });

        for (const threadDup of threadsDup) {
          const threadConflito = threadsMestre.find(
            tm => tm.whatsapp_integration_id === threadDup.whatsapp_integration_id
          );

          if (threadConflito) {
            // CONFLITO: Mesclar mensagens
            const mensagens = await base44.entities.Message.filter(
              { thread_id: threadDup.id },
              '-sent_at',
              500
            );

            for (const msg of mensagens) {
              await base44.entities.Message.update(msg.id, {
                thread_id: threadConflito.id,
                recipient_id: mestre.id
              });
              mensagensMovidas++;
            }

            if (mensagens.length > 0) {
              await base44.entities.MessageThread.update(threadConflito.id, {
                last_message_at: mensagens[0].sent_at || mensagens[0].created_date,
                total_mensagens: (threadConflito.total_mensagens || 0) + mensagens.length
              });
            }

            await base44.entities.MessageThread.delete(threadDup.id);
          } else {
            // SEM CONFLITO: Reatribuir
            await base44.entities.MessageThread.update(threadDup.id, { contact_id: mestre.id });
            conversasMovidas++;
          }
        }

        // 3️⃣ INTERAÇÕES
        const interacoes = await base44.entities.Interacao.filter({ contact_id: duplicata.id });
        for (const int of interacoes) {
          await base44.entities.Interacao.update(int.id, { contact_id: mestre.id });
        }

        // 4️⃣ DELETAR DUPLICATA
        await base44.entities.Contact.delete(duplicata.id);
      }

      toast.success('✅ Fusão Cirúrgica Concluída!', {
        description: `${conversasMovidas} conversas + ${mensagensMovidas} mensagens migradas`
      });

      queryClient.invalidateQueries({ queryKey: ['contacts-para-duplicatas'] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });

    } catch (error) {
      console.error('[FUSÃO]', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setMesclandoId(null);
    }
  };

  const isAdmin = usuarioAtual?.role === 'admin' || usuarioAtual?.role === 'supervisor';

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
        <p className="text-slate-400">Analisando base de contatos...</p>
      </Card>
    );
  }

  if (gruposDuplicados.length === 0) {
    return (
      <Card className="p-8 text-center border-green-500/30 bg-green-500/5">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-green-400">Base Higienizada ✓</h3>
        <p className="text-slate-400 mt-1">Nenhum contato duplicado detectado.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <div>
          <h3 className="font-semibold text-white">
            {gruposDuplicados.length} grupo(s) de duplicatas detectado(s)
          </h3>
          <p className="text-xs text-slate-400">
            {gruposDuplicados.reduce((sum, g) => sum + g.contacts.length, 0)} contatos no total
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {gruposDuplicados.map((grupo) => (
          <Card key={grupo.phone} className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Badge className="bg-orange-900/50 text-orange-300 text-sm">
                  <Phone className="w-3 h-3 mr-1" />
                  {grupo.phone}
                </Badge>
                <span className="text-xs text-slate-400">
                  {grupo.contacts.length} registros
                </span>
              </div>

              {isAdmin && (
                <Button
                  onClick={() => executarFusao(grupo)}
                  disabled={mesclandoId === grupo.phone}
                  size="sm"
                  className="bg-green-700 hover:bg-green-600"
                >
                  {mesclandoId === grupo.phone ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      Unificando...
                    </>
                  ) : (
                    <>
                      <Activity className="w-3 h-3 mr-1.5" />
                      Unificar
                    </>
                  )}
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              {grupo.contacts.map((contact, i) => (
                <div
                  key={contact.id}
                  className={`flex items-center justify-between px-3 py-2 rounded text-sm ${
                    i === 0
                      ? 'bg-green-900/20 border border-green-800/50'
                      : 'bg-slate-900/30'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200 truncate">
                      {contact.nome || 'Sem nome'}
                      {i === 0 && <Badge className="ml-2 text-xs bg-green-700">Mestre</Badge>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(contact.created_date).toLocaleDateString()}
                    </p>
                  </div>
                  {contact.email && (
                    <p className="text-xs text-slate-400 ml-2 truncate">{contact.email}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}