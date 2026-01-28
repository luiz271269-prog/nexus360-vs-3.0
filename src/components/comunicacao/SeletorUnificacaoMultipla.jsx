import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function SeletorUnificacaoMultipla({ 
  isOpen, 
  onClose, 
  contatosSelecionados = [] 
}) {
  const [mestreSelecionado, setMestreSelecionado] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [filtroNome, setFiltroNome] = useState('');

  if (!Array.isArray(contatosSelecionados)) {
    return null;
  }

  // 🆕 DEDUPLICAR contatos por ID (pode aparecer múltiplas vezes se estiver em threads diferentes)
  const contatosUnicos = Array.from(
    new Map(contatosSelecionados.map(c => [c.id, c])).values()
  );

  const contatosComestados = contatosUnicos.map((contato, idx) => ({
    ...contato,
    isMestre: mestreSelecionado?.id === contato.id,
    ordem: idx + 1
  }));

  const contatosParaMerge = contatosComestados.filter(c => !c.isMestre);

  // 🔍 Filtrar por nome/telefone/empresa/cargo
  const contatosFiltrados = contatosComestados.filter(c => {
    if (!filtroNome.trim()) return true;
    const termo = filtroNome.toLowerCase();
    return (
      (c.nome?.toLowerCase() || '').includes(termo) ||
      (c.telefone?.toLowerCase() || '').includes(termo) ||
      (c.empresa?.toLowerCase() || '').includes(termo) ||
      (c.cargo?.toLowerCase() || '').includes(termo) ||
      (c.email?.toLowerCase() || '').includes(termo)
    );
  });

  const handleUnificar = async () => {
    if (!mestreSelecionado) {
      toast.error('Selecione um contato MESTRE');
      return;
    }

    setProcessando(true);
    try {
      const resultados = [];
      let toastId = null;

      // ═══════════════════════════════════════════════════════════════
      // 🔄 ETAPA 1: SINCRONIZAR MENSAGENS ÓRFÃS (OBRIGATÓRIO)
      // ═══════════════════════════════════════════════════════════════
      if (contatosParaMerge.length > 0) {
        toastId = toast.loading(`🔄 Sincronizando mensagens órfãs...`);
        
        let sincronizacoesOK = 0;
        let sincronizacoesErro = 0;

        for (const duplicata of contatosParaMerge) {
          try {
            console.log(`[SINCRONIZAÇÃO] Iniciando para ${duplicata.nome} (${duplicata.id})`);
            
            const syncResult = await base44.functions.invoke('sincronizarMensagensOrfas', {
              contact_id: duplicata.id,
              target_contact_id: mestreSelecionado.id
            });

            // ✅ VALIDAÇÃO OBRIGATÓRIA
            if (!syncResult.data || !syncResult.data.success) {
              throw new Error(syncResult.data?.error || 'Resposta inválida do servidor');
            }

            const stats = syncResult.data.stats || {};
            console.log(`[SINCRONIZAÇÃO] ✅ ${duplicata.nome}:`, {
              threads_movidas: stats.threads_movidas || 0,
              mensagens_atualizadas: stats.mensagens_atualizadas || 0,
              threads_merged: stats.threads_merged || 0
            });

            sincronizacoesOK++;

          } catch (syncError) {
            console.error(`[SINCRONIZAÇÃO] ❌ ${duplicata.nome}:`, syncError.message);
            sincronizacoesErro++;
            
            // ⚠️ NÃO CONTINUA SE HOUVER ERRO
            toast.dismiss(toastId);
            toast.error(`❌ Falha ao sincronizar ${duplicata.nome}: ${syncError.message}`);
            setProcessando(false);
            return;
          }

          // Pequeno delay entre sincronizações
          await new Promise(r => setTimeout(r, 300));
        }

        toast.dismiss(toastId);
        toast.success(`✅ ${sincronizacoesOK}/${contatosParaMerge.length} sincronização(ões) concluída(s)`);
      }

      // ═══════════════════════════════════════════════════════════════
      // 🔗 ETAPA 2: MERGE CONTATOS (APÓS SINCRONIZAÇÃO)
      // ═══════════════════════════════════════════════════════════════
      toastId = toast.loading(`🔗 Unificando contatos...`);

      if (contatosParaMerge.length === 0) {
        // Apenas consolidar threads do contato mestre
        console.log(`[MERGE] Consolidando threads do contato mestre`);
        
        const resultado = await base44.functions.invoke('mergeContacts', {
          masterContactId: mestreSelecionado.id,
          duplicateContactIds: []
        });

        if (!resultado.data.success) {
          throw new Error(resultado.data.error || 'Erro ao consolidar');
        }

        resultados.push({
          duplicata: mestreSelecionado.nome,
          status: 'sucesso',
          threads_movidas: 0,
          mensagens_movidas: 0,
          nota: 'Consolidado (sem duplicatas)'
        });

      } else {
        // Merge com duplicatas
        console.log(`[MERGE] Mergeando ${contatosParaMerge.length} contato(s) → ${mestreSelecionado.nome}`);
        
        const resultado = await base44.functions.invoke('mergeContacts', {
          masterContactId: mestreSelecionado.id,
          duplicateContactIds: contatosParaMerge.map(c => c.id)
        });

        if (!resultado.data.success) {
          throw new Error(resultado.data.error || 'Erro ao fazer merge');
        }

        const stats = resultado.data.stats || {};
        resultados.push({
          duplicata: `${contatosParaMerge.length} contato(s)`,
          status: 'sucesso',
          threads_movidas: stats.threadsMovidas || 0,
          mensagens_movidas: stats.mensagensMovidas || 0,
          interacoes_movidas: stats.interacoesMovidas || 0,
          duplicatas_processadas: stats.duplicatasProcessadas || 0
        });

        console.log(`[MERGE] ✅ Concluído:`, stats);
      }

      toast.dismiss(toastId);
      setResultado(resultados);
      
      const sucessos = resultados.filter(r => r.status === 'sucesso').length;
      toast.success(`🎉 Unificação COMPLETA! Sincronização + Merge concluídos com sucesso!`, {
        duration: 6000
      });

    } catch (error) {
      console.error('[UNIFICAÇÃO] ❌ Erro crítico:', error);
      toast.error(`❌ Erro na unificação: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const handleFechar = () => {
    setMestreSelecionado(null);
    setResultado(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleFechar}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-orange-500" />
            Unificação Múltipla de Contatos
          </DialogTitle>
          <DialogDescription>
            Selecione qual contato será o MESTRE (mantém tudo). Os outros serão deletados.
          </DialogDescription>
        </DialogHeader>

        {/* ANTES DA UNIFICAÇÃO */}
        {!resultado && (
          <div className="space-y-4">
            {/* Campo de busca */}
            <input
              type="text"
              placeholder="🔍 Buscar por nome, telefone, empresa, cargo..."
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />

            {/* Lista de contatos com seletor */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2 max-h-60 overflow-y-auto">
              {contatosFiltrados.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-4">
                  Nenhum contato encontrado
                </div>
              ) : (
                contatosFiltrados.map((contato) => (
                <button
                  key={contato.id}
                  onClick={() => setMestreSelecionado(contato)}
                  disabled={processando}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    contato.isMestre
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {contato.nome || 'Sem nome'}
                        {contato.isMestre && (
                          <Badge className="bg-green-600 text-white">MESTRE</Badge>
                        )}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        📱 {contato.telefone || 'Sem telefone'}
                        {contato.email && ` • 📧 ${contato.email}`}
                      </div>
                    </div>
                    {contato.isMestre && (
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Resumo */}
            {mestreSelecionado && contatosParaMerge.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <strong>Resumo:</strong> {contatosParaMerge.length} contato(s) será(ão) unificado(s) em <strong>{mestreSelecionado.nome}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleFechar}
                disabled={processando}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUnificar}
                disabled={!mestreSelecionado || processando}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {processando ? '🔄 Unificando...' : '✅ Unificar Agora'}
              </Button>
            </div>
          </div>
        )}

        {/* DEPOIS DA UNIFICAÇÃO - RESULTADO */}
        {resultado && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="font-semibold mb-3 text-slate-900">Resultado da Unificação:</div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {resultado.map((r, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border-l-4 ${
                      r.status === 'sucesso'
                        ? 'bg-green-50 border-green-500'
                        : 'bg-red-50 border-red-500'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {r.status === 'sucesso' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{r.duplicata}</div>
                        {r.status === 'sucesso' ? (
                           <div className="text-sm text-slate-600 mt-1">
                             ✅ Unificado com sucesso
                             <br />
                             • {r.duplicatas_processadas} contato(s) processado(s)
                             <br />
                             • {r.threads_movidas} conversa(s) • {r.mensagens_movidas} mensagem(s) • {r.interacoes_movidas} interação(ões)
                           </div>
                         ) : (
                          <div className="text-sm text-red-600 mt-1">
                            ❌ {r.erro}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleFechar}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              ✅ Concluído - Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}