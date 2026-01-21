import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowRight, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function UnificadorContatosManual({ contatoOrigem, contatoDestino, isAdmin = false, onClose }) {
  const [unificando, setUnificando] = useState(false);

  if (!contatoOrigem || !contatoDestino) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-700 ml-2">
          Selecione 2 contatos para unificar
        </AlertDescription>
      </Alert>
    );
  }

  const unificar = async () => {
    if (!isAdmin) {
      toast.error('Apenas admin pode unificar');
      return;
    }

    setUnificando(true);
    const loadingToast = toast.loading('🔄 Unificando contatos...');

    try {
      const mestre = contatoDestino;
      const duplicata = contatoOrigem;

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
      
      let mensagensMovidas = 0;
      let conversasMovidas = 0;

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

      toast.dismiss(loadingToast);
      toast.success('✅ Unificação Concluída!', {
        description: `${conversasMovidas} conversas + ${mensagensMovidas} mensagens migradas`
      });

      if (onClose) onClose();

    } catch (error) {
      console.error('[UNIFICAÇÃO]', error);
      toast.dismiss(loadingToast);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setUnificando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* LAYOUT 3 COLUNAS */}
      <div className="grid grid-cols-3 gap-3">
        {/* COLUNA 1: ORIGEM (será deletado) */}
        <div className="bg-red-50 p-4 rounded-lg border-2 border-red-300">
          <h3 className="font-bold text-red-700 mb-3 text-sm">🗑️ SERÁ DELETADO</h3>
          <div className="bg-white p-3 rounded text-sm space-y-2">
            <p className="font-bold text-slate-900">{contatoOrigem.nome}</p>
            <p className="text-xs text-slate-600">{contatoOrigem.telefone}</p>
            {contatoOrigem.empresa && (
              <p className="text-xs text-slate-600">🏢 {contatoOrigem.empresa}</p>
            )}
            {contatoOrigem.email && (
              <p className="text-xs text-slate-600">📧 {contatoOrigem.email}</p>
            )}
          </div>
        </div>

        {/* COLUNA 2: SETA */}
        <div className="flex items-center justify-center">
          <div className="bg-gradient-to-r from-red-500 to-green-500 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl">
            →
          </div>
        </div>

        {/* COLUNA 3: DESTINO (será mantido) */}
        <div className="bg-green-50 p-4 rounded-lg border-2 border-green-400">
          <h3 className="font-bold text-green-700 mb-3 text-sm">🏆 SERÁ MANTIDO</h3>
          <div className="bg-white p-3 rounded text-sm space-y-2">
            <p className="font-bold text-slate-900">{contatoDestino.nome}</p>
            <p className="text-xs text-slate-600">{contatoDestino.telefone}</p>
            {contatoDestino.empresa && (
              <p className="text-xs text-slate-600">🏢 {contatoDestino.empresa}</p>
            )}
            {contatoDestino.email && (
              <p className="text-xs text-slate-600">📧 {contatoDestino.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* ALERTA EXPLICATIVO */}
      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-700 ml-2 text-xs">
          Todas as mensagens, conversas e dados do contato <strong>{contatoOrigem.nome}</strong> serão 
          transferidos para <strong>{contatoDestino.nome}</strong>, e o primeiro será deletado.
        </AlertDescription>
      </Alert>

      {/* BOTÃO DE CONFIRMAÇÃO */}
      {isAdmin && (
        <Button
          onClick={unificar}
          disabled={unificando}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-11"
        >
          {unificando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Unificando...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              ✅ Confirmar Unificação
            </>
          )}
        </Button>
      )}

      {!isAdmin && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-700 ml-2">
            Apenas administrador pode realizar esta ação.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}