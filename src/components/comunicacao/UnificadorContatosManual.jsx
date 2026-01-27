import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowRight, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function UnificadorContatosManual({ telefoneInicial, contatoOrigem, contatoDestino, isAdmin = false, onClose }) {
  const [unificando, setUnificando] = useState(false);
  const [contatosDuplicados, setContatosDuplicados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contatoPrincipal, setContatoPrincipal] = useState(null);

  // Carregar duplicatas pelo telefone
  React.useEffect(() => {
    if (telefoneInicial && !contatoOrigem && !contatoDestino) {
      carregarDuplicatasPorTelefone(telefoneInicial);
    } else if (contatoOrigem && contatoDestino) {
      // Modo drag-and-drop - usar os contatos fornecidos
      setContatoPrincipal(contatoDestino);
      setContatosDuplicados([contatoOrigem]);
    }
  }, [telefoneInicial, contatoOrigem, contatoDestino]);

  const carregarDuplicatasPorTelefone = async (telefone) => {
    setLoading(true);
    try {
      console.log('[UNIFICADOR] Buscando duplicatas para:', telefone);
      const telLimpo = telefone.replace(/\D/g, '');
      console.log('[UNIFICADOR] Telefone limpo:', telLimpo);
      
      const todosContatos = await base44.entities.Contact.list('-created_date', 1000);
      console.log('[UNIFICADOR] Total de contatos carregados:', todosContatos.length);
      
      const duplicatas = todosContatos.filter(c => {
        const tel = (c.telefone || '').replace(/\D/g, '');
        return tel === telLimpo;
      });

      console.log('[UNIFICADOR] Duplicatas encontradas:', duplicatas.length);

      if (duplicatas.length <= 1) {
        toast.warning('Apenas 1 contato encontrado para este telefone');
        setContatosDuplicados([]);
        setContatoPrincipal(null);
        return;
      }

      // Ordenar por created_date (mais antigo primeiro = principal)
      duplicatas.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      
      setContatoPrincipal(duplicatas[0]);
      setContatosDuplicados(duplicatas.slice(1));
      
      toast.success(`✅ ${duplicatas.length} contatos encontrados (${duplicatas.length - 1} duplicatas)`);
    } catch (error) {
      console.error('Erro ao buscar duplicatas:', error);
      toast.error('Erro ao buscar duplicatas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!contatoPrincipal || contatosDuplicados.length === 0) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-700 ml-2">
          {telefoneInicial ? 'Nenhuma duplicata encontrada' : 'Selecione 2 contatos para unificar'}
        </AlertDescription>
      </Alert>
    );
  }

  const unificarTodos = async () => {
    if (!isAdmin) {
      toast.error('Apenas admin pode unificar');
      return;
    }

    const confirmar = window.confirm(
      `⚠️ UNIFICAÇÃO EM MASSA\n\n` +
      `Principal: ${contatoPrincipal.nome}\n` +
      `Duplicatas: ${contatosDuplicados.length}\n\n` +
      `Todas as conversas e mensagens serão movidas para o contato principal.\n\n` +
      `Deseja continuar?`
    );

    if (!confirmar) return;

    setUnificando(true);
    const loadingToast = toast.loading(`🔄 Unificando ${contatosDuplicados.length} duplicata(s)...`);

    try {
      let totalMensagensMovidas = 0;
      let totalConversasMovidas = 0;
      let totalInteracoesMovidas = 0;

      // Processar cada duplicata
      for (const duplicata of contatosDuplicados) {
        const mestre = contatoPrincipal;

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
        totalInteracoesMovidas += interacoes.length;

        // 4️⃣ DELETAR DUPLICATA
        await base44.entities.Contact.delete({ id: duplicata.id });
        
        console.log(`[UNIFICAÇÃO] ✅ Duplicata ${duplicata.id} unificada em ${mestre.id}`);
        
        totalConversasMovidas += conversasMovidas;
        totalMensagensMovidas += mensagensMovidas;
      }

      toast.dismiss(loadingToast);
      toast.success('✅ Unificação Concluída!', {
        description: `${contatosDuplicados.length} contatos • ${totalConversasMovidas} conversas • ${totalMensagensMovidas} mensagens`
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
      {/* LAYOUT: Principal + Duplicatas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CONTATO PRINCIPAL (será mantido) */}
        <Card className="border-2 border-green-400 bg-green-50">
          <CardHeader className="pb-3">
            <h3 className="font-bold text-green-700 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              🏆 PRINCIPAL (Mais Antigo)
            </h3>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-4 rounded-lg text-sm space-y-2">
              <p className="font-bold text-slate-900 text-lg">{contatoPrincipal.nome}</p>
              <p className="text-xs text-slate-600">📞 {contatoPrincipal.telefone}</p>
              {contatoPrincipal.empresa && (
                <p className="text-xs text-slate-600">🏢 {contatoPrincipal.empresa}</p>
              )}
              {contatoPrincipal.email && (
                <p className="text-xs text-slate-600">📧 {contatoPrincipal.email}</p>
              )}
              <Badge className="bg-green-600 text-white text-xs">
                Criado: {new Date(contatoPrincipal.created_date).toLocaleDateString('pt-BR')}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* DUPLICATAS (serão deletadas) */}
        <Card className="border-2 border-red-400 bg-red-50">
          <CardHeader className="pb-3">
            <h3 className="font-bold text-red-700 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              🗑️ DUPLICATAS ({contatosDuplicados.length})
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {contatosDuplicados.map((dup) => (
                <div key={dup.id} className="bg-white p-3 rounded-lg border border-red-200">
                  <p className="font-semibold text-slate-900 text-sm">{dup.nome}</p>
                  <p className="text-xs text-slate-600">📞 {dup.telefone}</p>
                  {dup.empresa && (
                    <p className="text-xs text-slate-600">🏢 {dup.empresa}</p>
                  )}
                  <Badge variant="outline" className="text-[10px] mt-1">
                    ID: {dup.id.substring(0, 8)}...
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ALERTA EXPLICATIVO */}
      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-700 ml-2 text-sm">
          <strong>O que será feito:</strong>
          <ul className="list-disc ml-4 mt-2 space-y-1">
            <li>Todas as <strong>mensagens</strong> das duplicatas serão movidas para o contato principal</li>
            <li>Todas as <strong>threads</strong> serão reagrupadas no contato principal</li>
            <li>Todas as <strong>interações</strong> serão transferidas</li>
            <li>Os {contatosDuplicados.length} contato(s) duplicado(s) será(ão) <strong>deletado(s)</strong></li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* BOTÃO DE CONFIRMAÇÃO */}
      {isAdmin && (
        <Button
          onClick={unificarTodos}
          disabled={unificando}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12"
        >
          {unificando ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Unificando {contatosDuplicados.length} contato(s)...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              ✅ Unificar {contatosDuplicados.length} Duplicata(s)
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