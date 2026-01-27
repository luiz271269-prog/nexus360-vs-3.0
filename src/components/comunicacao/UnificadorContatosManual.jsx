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
    console.log('[UNIFICADOR] Props recebidas:', { 
      telefoneInicial, 
      temOrigem: !!contatoOrigem, 
      temDestino: !!contatoDestino 
    });

    if (contatoOrigem && contatoDestino) {
      // Modo drag-and-drop - usar os contatos fornecidos
      console.log('[UNIFICADOR] Modo drag-and-drop ativado');
      setContatoPrincipal(contatoDestino);
      setContatosDuplicados([contatoOrigem]);
    } else if (telefoneInicial && !contatoOrigem && !contatoDestino) {
      // Modo busca por telefone
      console.log('[UNIFICADOR] Modo busca por telefone ativado');
      carregarDuplicatasPorTelefone(telefoneInicial);
    }
  }, [telefoneInicial, contatoOrigem, contatoDestino]);

  // Gerar variações do telefone para busca robusta
  const gerarVariacoesTelefone = (telefone) => {
    const limpo = telefone.replace(/\D/g, '');
    const variacoes = new Set([limpo]);

    // +55 vs sem 55
    if (limpo.startsWith('55')) {
      variacoes.add(limpo.substring(2));
    } else {
      variacoes.add('55' + limpo);
    }

    // 9 dígito móvel (adicionar/remover)
    if (limpo.length === 13 && limpo.startsWith('55')) {
      const semPais = limpo.substring(2);
      if (semPais[2] === '9') {
        variacoes.add('55' + semPais.substring(0, 2) + semPais.substring(3));
      }
    }

    if (limpo.length === 11) {
      if (limpo[2] !== '9') {
        variacoes.add(limpo.substring(0, 2) + '9' + limpo.substring(2));
      }
    }

    return Array.from(variacoes);
  };

  // Escolher contato principal por "força" (não por idade)
  const escolherContatoPrincipal = (contatos) => {
    return contatos.reduce((melhor, atual) => {
      let scoreMelhor = 0;
      let scoreAtual = 0;

      // Pontuação por atributos importantes
      if (melhor.assigned_user_id) scoreMelhor += 10;
      if (melhor.is_cliente_fidelizado) scoreMelhor += 8;
      if (melhor.cliente_id) scoreMelhor += 7;
      if (melhor.vendedor_responsavel) scoreMelhor += 5;
      if (melhor.foto_perfil_url) scoreMelhor += 3;
      if ((melhor.tags || []).length > 0) scoreMelhor += 2;
      if (melhor.email) scoreMelhor += 2;
      if (melhor.empresa) scoreMelhor += 2;

      if (atual.assigned_user_id) scoreAtual += 10;
      if (atual.is_cliente_fidelizado) scoreAtual += 8;
      if (atual.cliente_id) scoreAtual += 7;
      if (atual.vendedor_responsavel) scoreAtual += 5;
      if (atual.foto_perfil_url) scoreAtual += 3;
      if ((atual.tags || []).length > 0) scoreAtual += 2;
      if (atual.email) scoreAtual += 2;
      if (atual.empresa) scoreAtual += 2;

      return scoreAtual > scoreMelhor ? atual : melhor;
    });
  };

  const carregarDuplicatasPorTelefone = async (telefone) => {
    setLoading(true);
    try {
      console.log('[UNIFICADOR] 🔍 Buscando duplicatas para:', telefone);
      
      const variacoes = gerarVariacoesTelefone(telefone);
      console.log('[UNIFICADOR] 📱 Variações geradas:', variacoes);
      
      // Buscar TODOS os contatos (sem limite artificial)
      const todosContatos = await base44.entities.Contact.list('-created_date', 10000);
      console.log('[UNIFICADOR] 📊 Total de contatos carregados:', todosContatos.length);
      
      // Filtrar por TODAS as variações do telefone
      const duplicatas = todosContatos.filter(c => {
        if (!c.telefone) return false;
        const tel = c.telefone.replace(/\D/g, '');
        const match = variacoes.some(v => v === tel);
        
        if (match) {
          console.log('[UNIFICADOR] ✓ Match encontrado:', c.nome, '|', c.telefone, '| ID:', c.id.substring(0,8));
        }
        
        return match;
      });

      console.log('[UNIFICADOR] 🎯 Total de duplicatas encontradas:', duplicatas.length);
      
      if (duplicatas.length === 0) {
        console.error('[UNIFICADOR] ❌ PROBLEMA: Nenhum contato encontrado para as variações:', variacoes);
        toast.error('Nenhum contato encontrado para este telefone. Verifique o console (F12).');
        setContatosDuplicados([]);
        setContatoPrincipal(null);
        return;
      }

      if (duplicatas.length === 1) {
        console.warn('[UNIFICADOR] ⚠️ Apenas 1 contato encontrado - não há duplicatas');
        toast.warning('Apenas 1 contato encontrado para este telefone');
        setContatosDuplicados([]);
        setContatoPrincipal(null);
        return;
      }

      // Escolher principal por "força", não por idade
      const principal = escolherContatoPrincipal(duplicatas);
      const outrosDuplicados = duplicatas.filter(d => d.id !== principal.id);
      
      console.log('[UNIFICADOR] 👑 Principal escolhido:', principal.nome, '| ID:', principal.id.substring(0,8));
      console.log('[UNIFICADOR] 🗑️ Duplicatas a remover:', outrosDuplicados.map(d => d.nome).join(', '));
      
      setContatoPrincipal(principal);
      setContatosDuplicados(outrosDuplicados);
      
      toast.success(`✅ ${duplicatas.length} contatos encontrados (${outrosDuplicados.length} duplicatas)`, {
        description: `Principal: ${principal.nome}`
      });
    } catch (error) {
      console.error('[UNIFICADOR] ❌ ERRO CRÍTICO ao buscar duplicatas:', error);
      toast.error('Erro ao buscar duplicatas: ' + error.message);
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

      // Buscar threads do mestre UMA VEZ (fora do loop)
      const threadsMestre = await base44.entities.MessageThread.filter({ contact_id: contatoPrincipal.id });

      // Processar cada duplicata
      for (const duplicata of contatosDuplicados) {
        console.log(`[UNIFICAÇÃO] Processando duplicata ${duplicata.id} (${duplicata.nome})`);
        
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
          console.log('[UNIFICAÇÃO] Atualizando dados do mestre:', updateMestre);
          await base44.entities.Contact.update(mestre.id, updateMestre);
        }

        // 2️⃣ FUSÃO DE THREADS
        const threadsDup = await base44.entities.MessageThread.filter({ contact_id: duplicata.id });
        console.log(`[UNIFICAÇÃO] ${threadsDup.length} threads da duplicata`);
        
        let mensagensMovidas = 0;
        let conversasMovidas = 0;

      for (const threadDup of threadsDup) {
        // Criar chave de canal unificada
        const getChannelKey = (thread) => {
          const channel = thread.channel;
          let integrationId = null;
          
          if (channel === 'whatsapp') {
            integrationId = thread.whatsapp_integration_id || thread.conexao_id;
          } else if (channel === 'instagram') {
            integrationId = thread.instagram_integration_id;
          } else if (channel === 'facebook') {
            integrationId = thread.facebook_integration_id;
          } else if (channel === 'phone') {
            integrationId = thread.goto_integration_id;
          } else if (channel === 'interno') {
            integrationId = 'internal';
          }
          
          return `${channel}:${integrationId}`;
        };

        const keyDup = getChannelKey(threadDup);
        const threadConflito = threadsMestre.find(tm => getChannelKey(tm) === keyDup);

        if (threadConflito) {
          console.log(`[UNIFICAÇÃO] CONFLITO - Mesclando thread ${threadDup.id} → ${threadConflito.id}`);
          
          // CONFLITO: Mesclar TODAS as mensagens (paginado)
          let totalMovidas = 0;

          while (true) {
            const mensagens = await base44.entities.Message.filter(
              { thread_id: threadDup.id },
              '-sent_at',
              500
            );

            console.log(`[UNIFICAÇÃO] Movendo ${mensagens.length} mensagens...`);

            if (mensagens.length === 0) break;

            for (const msg of mensagens) {
              await base44.entities.Message.update(msg.id, {
                thread_id: threadConflito.id,
                recipient_id: mestre.id
              });
              totalMovidas++;
            }

            if (mensagens.length < 500) break;
          }

          console.log(`[UNIFICAÇÃO] Total movido: ${totalMovidas} mensagens`);
          mensagensMovidas += totalMovidas;

          // Atualizar thread mestre
          if (totalMovidas > 0) {
            const ultimaMsg = await base44.entities.Message.filter(
              { thread_id: threadConflito.id },
              '-sent_at',
              1
            );

            await base44.entities.MessageThread.update(threadConflito.id, {
              last_message_at: ultimaMsg[0]?.sent_at || ultimaMsg[0]?.created_date,
              total_mensagens: (threadConflito.total_mensagens || 0) + totalMovidas
            });
          }

          // Marcar como merged ao invés de deletar (mantém histórico)
          console.log('[UNIFICAÇÃO] Marcando thread como merged');
          await base44.entities.MessageThread.update(threadDup.id, {
            status: 'merged',
            is_canonical: false,
            merged_into: threadConflito.id
          });

        } else {
          console.log(`[UNIFICAÇÃO] SEM CONFLITO - Reatribuindo thread ${threadDup.id}`);
          
          // SEM CONFLITO: Reatribuir e garantir canonicidade
          await base44.entities.MessageThread.update(threadDup.id, { 
            contact_id: mestre.id,
            is_canonical: true
          });
          conversasMovidas++;
        }
      }
      
      console.log(`[UNIFICAÇÃO] Threads processadas: ${conversasMovidas} movidas, ${mensagensMovidas} mensagens`);
      totalConversasMovidas += conversasMovidas;
      totalMensagensMovidas += mensagensMovidas;

        // 3️⃣ INTERAÇÕES
        const interacoes = await base44.entities.Interacao.filter({ contact_id: duplicata.id });
        for (const int of interacoes) {
          await base44.entities.Interacao.update(int.id, { contact_id: mestre.id });
        }
        totalInteracoesMovidas += interacoes.length;

        // 4️⃣ VALIDAR e DELETAR DUPLICATA
        console.log(`[UNIFICAÇÃO] Validando antes de deletar ${duplicata.id}...`);
        
        // Verificar se ainda há threads apontando para esta duplicata
        const threadsRestantes = await base44.entities.MessageThread.filter({ 
          contact_id: duplicata.id,
          status: { $ne: 'merged' } // Ignorar threads já merged
        });
        
        if (threadsRestantes.length > 0) {
          console.error(`[UNIFICAÇÃO] ⚠️ AVISO: ${threadsRestantes.length} threads ainda apontam para ${duplicata.id}`);
          toast.warning(`${threadsRestantes.length} threads ainda vinculadas - corrigindo...`);
          
          // Corrigir: reatribuir essas threads ao mestre
          for (const t of threadsRestantes) {
            await base44.entities.MessageThread.update(t.id, { contact_id: mestre.id });
          }
        }
        
        console.log(`[UNIFICAÇÃO] Deletando contato duplicado ${duplicata.id}`);
        try {
          await base44.entities.Contact.delete(duplicata.id);
          console.log(`[UNIFICAÇÃO] ✅ Duplicata ${duplicata.id} deletada com sucesso`);
        } catch (deleteError) {
          console.error(`[UNIFICAÇÃO] ❌ FALHA ao deletar ${duplicata.id}:`, deleteError);
          toast.error(`Erro ao deletar ${duplicata.nome}: ${deleteError.message}`);
          throw deleteError; // Propagar erro para parar o processo
        }
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
             🏆 PRINCIPAL (Mais Forte)
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