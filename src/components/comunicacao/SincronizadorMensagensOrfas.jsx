import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';

export default function SincronizadorMensagensOrfas({ threadId = null, contactId = null }) {
  const [loading, setLoading] = React.useState(false);
  const [resultadoDiagnostico, setResultadoDiagnostico] = React.useState(null);
  const [confirmacao, setConfirmacao] = React.useState(false);

  const handleDiagnostico = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('sincronizarMensagensOrfas', {
        thread_id: threadId,
        contact_id: contactId,
        periodo_horas: 72,
        modo: 'diagnostico'
      });

      console.log('[SincronizadorMensagensOrfas] Diagnóstico:', res);

      setResultadoDiagnostico(res?.data);
      setConfirmacao(false);

      if (res?.data?.mensagens_orfas_encontradas > 0) {
        toast.info(`📭 ${res.data.mensagens_orfas_encontradas} mensagens órfãs encontradas`);
      } else {
        toast.success('✅ Nenhuma mensagem órfã encontrada');
      }
    } catch (error) {
      console.error('[SincronizadorMensagensOrfas]', error);
      toast.error(`❌ Erro: ${error?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCorrecao = async () => {
    if (!confirmacao) {
      toast.warning('⚠️ Confirme a ação');
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('sincronizarMensagensOrfas', {
        thread_id: threadId,
        contact_id: contactId,
        periodo_horas: 72,
        modo: 'correcao'
      });

      console.log('[SincronizadorMensagensOrfas] Correção:', res);

      if (res?.data?.mensagens_revinculadas > 0) {
        toast.success(`✅ ${res.data.mensagens_revinculadas} mensagem(ns) revinculada(s)!`);
      } else {
        toast.info('ℹ️ Nenhuma mensagem precisava revinculação');
      }

      setConfirmacao(false);
      setResultadoDiagnostico(null);
      
      // ✅ RE-RODAR DIAGNÓSTICO AUTOMATICAMENTE após correção
      setTimeout(() => {
        handleDiagnostico();
      }, 1000);
    } catch (error) {
      console.error('[SincronizadorMensagensOrfas] Erro na correção:', error);
      toast.error(`❌ Erro: ${error?.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Resultado diagnóstico */}
      {resultadoDiagnostico && (
        <Alert className={`p-3 ${
          resultadoDiagnostico.mensagens_orfas_encontradas > 0
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              {resultadoDiagnostico.mensagens_orfas_encontradas > 0 ? (
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="text-sm">
                <p className={resultadoDiagnostico.mensagens_orfas_encontradas > 0 ? 'text-yellow-700 font-semibold' : 'text-green-700 font-semibold'}>
                  📋 Relatório de Diagnóstico
                </p>
                <ul className={`mt-1 ml-4 list-disc text-xs ${resultadoDiagnostico.mensagens_orfas_encontradas > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                  <li>Threads analisadas: {resultadoDiagnostico.threads_analisadas}</li>
                  <li>Threads suspeitas: {resultadoDiagnostico.threads_suspeitas}</li>
                  <li>Mensagens órfãs: {resultadoDiagnostico.mensagens_orfas_encontradas}</li>
                </ul>

                {resultadoDiagnostico.detalhes?.length > 0 && (
                  <div className="mt-2 ml-4 text-xs space-y-1">
                    {resultadoDiagnostico.detalhes.map((d, i) => (
                      <div key={i} className="font-mono">
                        <p>• {d.contato_nome} ({d.telefone_contato})</p>
                        <p className="ml-4">→ {d.mensagens_encontradas} órfã(s)</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Alert>
      )}

      {/* Botões */}
      <div className="space-y-2">
        {!resultadoDiagnostico ? (
          <Button
            onClick={handleDiagnostico}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            🔍 Diagnosticar Mensagens Órfãs
          </Button>
        ) : (
          <>
            <Button
              onClick={() => setResultadoDiagnostico(null)}
              variant="outline"
              className="w-full"
            >
              ← Voltar
            </Button>

            {resultadoDiagnostico.mensagens_orfas_encontradas > 0 && (
              <>
                <label className="flex items-center gap-2 p-2 bg-slate-100 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-xs text-slate-700">
                    Confirmo revinculação de {resultadoDiagnostico.mensagens_orfas_encontradas} mensagem(ns)
                  </span>
                </label>

                <Button
                  onClick={handleCorrecao}
                  disabled={!confirmacao || loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  ✅ Revinicular Agora
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}