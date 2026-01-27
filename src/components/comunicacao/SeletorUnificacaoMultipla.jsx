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

  const handleUnificar = async () => {
    if (!mestreSelecionado) {
      toast.error('Selecione um contato MESTRE');
      return;
    }

    setProcessando(true);
    try {
      const resultados = [];
      
      // Executar merge
      if (contatosParaMerge.length === 0) {
        // 🆕 Se só tem 1 contato (mestre), apenas consolida threads
        console.log(`[UnificacaoMultipla] ℹ️ Apenas 1 contato - consolidando threads`);
        const resultado = await base44.functions.invoke('mergeContacts', {
          master_id: mestreSelecionado.id,
          duplicate_ids: [] // Vazio = apenas consolida
        });

        if (resultado.data.success) {
          resultados.push({
            duplicata: mestreSelecionado.nome,
            status: 'sucesso',
            threads_movidas: 0,
            mensagens_movidas: 0,
            note: 'Consolidado'
          });
        } else {
          resultados.push({
            duplicata: mestreSelecionado.nome,
            status: 'erro',
            erro: resultado.data.error
          });
        }
      } else {
        // 🆕 FLUXO OTIMIZADO: Unificar TODOS DE UMA VEZ no backend
        console.log(`[UnificacaoMultipla] 🔄 Mergeando ${contatosParaMerge.length} contato(s) → ${mestreSelecionado.nome}`);
        
        const resultado = await base44.functions.invoke('mergeContacts', {
          masterContactId: mestreSelecionado.id,
          duplicateContactIds: contatosParaMerge.map(c => c.id) // TODOS de uma vez
        });

        if (resultado.data.success) {
          // Stats agregados
          const stats = resultado.data.stats;
          resultados.push({
            duplicata: `${contatosParaMerge.length} contato(s)`,
            status: 'sucesso',
            threads_movidas: stats.threadsMovidas || 0,
            mensagens_movidas: stats.mensagensMovidas || 0,
            interacoes_movidas: stats.interacoesMovidas || 0,
            duplicatas_processadas: stats.duplicatasProcessadas || 0
          });
        } else {
          resultados.push({
            duplicata: `${contatosParaMerge.length} contato(s)`,
            status: 'erro',
            erro: resultado.data.error
          });
        }
      }

      setResultado(resultados);
      
      const sucessos = resultados.filter(r => r.status === 'sucesso').length;
      const total = contatosParaMerge.length || 1;
      toast.success(`✅ ${sucessos}/${total} consolidado(s)!`, {
        duration: 5000
      });

    } catch (error) {
      console.error('[UnificacaoMultipla] Erro:', error);
      toast.error(`Erro ao consolidar: ${error.message}`);
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
            {/* Lista de contatos com seletor */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2 max-h-60 overflow-y-auto">
              {contatosComestados.map((contato) => (
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
                            • {r.threads_movidas} conversa(s) • {r.mensagens_movidas} mensagem(s)
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