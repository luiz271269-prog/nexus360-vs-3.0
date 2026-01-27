import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
// CORREÇÃO 1: Imports completos
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function UnificadorContatosManual({ telefoneInicial, contatoOrigem, contatoDestino, isAdmin = false, onClose }) {
  const [unificando, setUnificando] = useState(false);
  const [contatosDuplicados, setContatosDuplicados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contatoPrincipal, setContatoPrincipal] = useState(null);

  React.useEffect(() => {
    console.log('[UNIFICADOR] Props:', { telefoneInicial, temOrigem: !!contatoOrigem });

    if (contatoOrigem && contatoDestino) {
      setContatoPrincipal(contatoDestino);
      setContatosDuplicados([contatoOrigem]);
    } else if (telefoneInicial && !contatoOrigem && !contatoDestino) {
      carregarDuplicatasPorTelefone(telefoneInicial);
    }
  }, [telefoneInicial, contatoOrigem, contatoDestino]);

  const gerarVariacoesTelefone = (telefone) => {
    const limpo = telefone.replace(/\D/g, '');
    const variacoes = new Set([limpo]);
    if (limpo.startsWith('55')) variacoes.add(limpo.substring(2));
    else variacoes.add('55' + limpo);
    
    if (limpo.length === 13 && limpo.startsWith('55')) {
      const semPais = limpo.substring(2);
      if (semPais[2] === '9') variacoes.add('55' + semPais.substring(0, 2) + semPais.substring(3));
    }
    if (limpo.length === 11 && limpo[2] !== '9') {
      variacoes.add(limpo.substring(0, 2) + '9' + limpo.substring(2));
    }
    return Array.from(variacoes);
  };

  const escolherContatoPrincipal = (contatos) => {
    return contatos.reduce((melhor, atual) => {
      let scoreMelhor = 0;
      let scoreAtual = 0;
      
      const pontuar = (c) => {
        let s = 0;
        if (c.assigned_user_id) s += 10;
        if (c.is_cliente_fidelizado) s += 8;
        if (c.cliente_id) s += 7;
        if (c.vendedor_responsavel) s += 5;
        if (c.foto_perfil_url) s += 3;
        if ((c.tags || []).length > 0) s += 2;
        return s;
      };

      scoreMelhor = pontuar(melhor);
      scoreAtual = pontuar(atual);
      
      // Desempate por antiguidade (ID menor ou data)
      if (scoreAtual === scoreMelhor) {
         return new Date(atual.created_date) < new Date(melhor.created_date) ? atual : melhor;
      }

      return scoreAtual > scoreMelhor ? atual : melhor;
    });
  };

  const carregarDuplicatasPorTelefone = async (telefone) => {
    setLoading(true);
    try {
      const variacoes = gerarVariacoesTelefone(telefone);
      // Workaround: buscar lote grande
      const todosContatos = await base44.entities.Contact.list('-created_date', 5000);
      
      const duplicatas = todosContatos.filter(c => {
        const tel = (c.telefone || '').replace(/\D/g, '');
        return variacoes.some(v => v === tel);
      });

      if (duplicatas.length <= 1) {
        toast.warning('Apenas 1 contato encontrado.');
        setContatosDuplicados([]);
        setContatoPrincipal(null);
        return;
      }

      const principal = escolherContatoPrincipal(duplicatas);
      setContatoPrincipal(principal);
      setContatosDuplicados(duplicatas.filter(d => d.id !== principal.id));
      
      toast.success(`Encontradas ${duplicatas.length - 1} duplicatas.`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar duplicatas');
    } finally {
      setLoading(false);
    }
  };

  const unificarTodos = async () => {
    if (!isAdmin) {
      toast.error('Apenas admin pode unificar');
      return;
    }

    if (!window.confirm(`Confirmar unificação de ${contatosDuplicados.length} duplicatas em ${contatoPrincipal.nome}?`)) return;

    setUnificando(true);
    const loadingToast = toast.loading(`Iniciando unificação blindada...`);

    try {
      let totalMensagens = 0;
      let totalConversas = 0;

      // Carregar threads do mestre UMA VEZ
      const threadsMestre = await base44.entities.MessageThread.filter({ contact_id: contatoPrincipal.id });

      for (const duplicata of contatosDuplicados) {
        const mestre = contatoPrincipal;

        // 1. MERGE DE DADOS
        const updateMestre = {};
        if (!mestre.email && duplicata.email) updateMestre.email = duplicata.email;
        if (!mestre.cargo && duplicata.cargo) updateMestre.cargo = duplicata.cargo;
        if (!mestre.empresa && duplicata.empresa) updateMestre.empresa = duplicata.empresa;
        
        const tagsSet = new Set(mestre.tags || []);
        (duplicata.tags || []).forEach(t => tagsSet.add(t));
        if (tagsSet.size > (mestre.tags || []).length) updateMestre.tags = Array.from(tagsSet);

        if (Object.keys(updateMestre).length > 0) {
          await base44.entities.Contact.update(mestre.id, updateMestre);
        }

        // 2. MERGE DE THREADS
        const threadsDup = await base44.entities.MessageThread.filter({ contact_id: duplicata.id });

        for (const threadDup of threadsDup) {
          // CORREÇÃO 2: Chave de canal blindada
          const getChannelKey = (t) => {
            const ch = t.channel || 'desconhecido';
            let intId = 'nulo';
            if (ch === 'whatsapp') intId = t.whatsapp_integration_id || t.conexao_id || 'nulo';
            else if (ch === 'instagram') intId = t.instagram_integration_id;
            else if (ch === 'facebook') intId = t.facebook_integration_id;
            else if (ch === 'phone') intId = t.goto_integration_id;
            else if (ch === 'interno') intId = 'internal';
            return `${ch}:${intId}`;
          };

          const keyDup = getChannelKey(threadDup);
          const threadConflito = threadsMestre.find(tm => getChannelKey(tm) === keyDup);

          if (threadConflito) {
            // --- CONFLITO: MOVER MENSAGENS ---
            let movidasAqui = 0;
            
            while (true) {
              const msgs = await base44.entities.Message.filter({ thread_id: threadDup.id }, '-sent_at', 500);
              if (msgs.length === 0) break;

              // CORREÇÃO 5: Lotes de 50 para evitar Rate Limit
              const chunkSize = 50;
              for (let i = 0; i < msgs.length; i += chunkSize) {
                const batch = msgs.slice(i, i + chunkSize);
                await Promise.all(batch.map(m => 
                  base44.entities.Message.update(m.id, { thread_id: threadConflito.id, recipient_id: mestre.id })
                ));
              }

              movidasAqui += msgs.length;
              if (msgs.length < 500) break;
            }
            totalMensagens += movidasAqui;

            if (movidasAqui > 0) {
              // CORREÇÃO 4: Timestamp robusto
              const lastMsgs = await base44.entities.Message.filter({ thread_id: threadConflito.id }, '-sent_at', 1);
              const lastAt = lastMsgs[0]?.sent_at || lastMsgs[0]?.created_date || new Date().toISOString();
              
              const updateData = {
                last_message_at: lastAt,
                total_mensagens: (threadConflito.total_mensagens || 0) + movidasAqui
              };
              
              await base44.entities.MessageThread.update(threadConflito.id, updateData);
              
              // Atualizar memória
              const idx = threadsMestre.findIndex(tm => tm.id === threadConflito.id);
              if (idx !== -1) threadsMestre[idx] = { ...threadsMestre[idx], ...updateData };
            }

            // Marcar antiga como merged
            await base44.entities.MessageThread.update(threadDup.id, {
              status: 'merged',
              is_canonical: false,
              merged_into: threadConflito.id
            });

          } else {
            // --- SEM CONFLITO: REATRIBUIR ---
            await base44.entities.MessageThread.update(threadDup.id, { 
              contact_id: mestre.id,
              is_canonical: true 
            });
            
            // CORREÇÃO 3: Adicionar ao array em memória para capturar futuras duplicatas
            threadsMestre.push({
              ...threadDup,
              contact_id: mestre.id,
              is_canonical: true
            });
            
            totalConversas++;
          }
        }

        // 3. INTERAÇÕES
        const interacoes = await base44.entities.Interacao.filter({ contact_id: duplicata.id });
        for (const int of interacoes) {
          await base44.entities.Interacao.update(int.id, { contact_id: mestre.id });
        }

        // 4. LIMPEZA E DELETE
        // Validar threads restantes (sem usar $ne)
        const threadsFinais = await base44.entities.MessageThread.filter({ contact_id: duplicata.id });
        const ativas = threadsFinais.filter(t => t.status !== 'merged');
        
        if (ativas.length > 0) {
          // Fallback de segurança
          for (const t of ativas) await base44.entities.MessageThread.update(t.id, { contact_id: mestre.id });
        }

        await base44.entities.Contact.delete(duplicata.id);
      }

      toast.dismiss(loadingToast);
      toast.success('Unificação Completa!', {
        description: `${totalConversas} conversas e ${totalMensagens} mensagens movidas.`
      });
      if (onClose) onClose();

    } catch (error) {
      console.error(error);
      toast.dismiss(loadingToast);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setUnificando(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!contatoPrincipal) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-2 border-green-400 bg-green-50">
          <CardHeader className="pb-2">
            <h3 className="font-bold text-green-700 flex items-center gap-2"><CheckCircle className="w-5 h-5"/> PRINCIPAL</h3>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-3 rounded text-sm">
              <p className="font-bold text-lg">{contatoPrincipal.nome}</p>
              <p>📞 {contatoPrincipal.telefone}</p>
              <Badge className="bg-green-600 mt-2">ID: {contatoPrincipal.id.substring(0,8)}...</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-400 bg-red-50">
          <CardHeader className="pb-2">
            <h3 className="font-bold text-red-700 flex items-center gap-2"><Trash2 className="w-5 h-5"/> DUPLICATAS ({contatosDuplicados.length})</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {contatosDuplicados.map(dup => (
                <div key={dup.id} className="bg-white p-2 rounded border text-sm">
                  <p className="font-bold">{dup.nome}</p>
                  <p>📞 {dup.telefone}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert className="bg-amber-50">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          Ação irreversível. As mensagens serão movidas e as duplicatas excluídas permanentemente.
        </AlertDescription>
      </Alert>

      {isAdmin ? (
        <Button onClick={unificarTodos} disabled={unificando} className="w-full bg-green-600 h-12 text-lg">
          {unificando ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle className="mr-2" />}
          Confirmar Unificação
        </Button>
      ) : (
        <Alert variant="destructive"><AlertDescription>Apenas Admin pode unificar.</AlertDescription></Alert>
      )}
    </div>
  );
}