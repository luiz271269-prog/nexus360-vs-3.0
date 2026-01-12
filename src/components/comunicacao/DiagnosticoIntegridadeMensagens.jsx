import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, CheckCircle2, AlertCircle, XCircle, TrendingUp, 
  BarChart3, Phone, MessageSquare, Zap
} from "lucide-react";
import { toast } from "sonner";

export default function DiagnosticoIntegridadeMensagens() {
  const [diagnosticando, setDiagnosticando] = useState(false);
  const [resultados, setResultados] = useState(null);

  const executarDiagnostico = async () => {
    setDiagnosticando(true);
    setResultados(null);

    try {
      const res = await base44.functions.invoke('diagnosticoIntegridadeMensagensHoje', {});
      
      if (res?.data) {
        setResultados(res.data);
        
        const taxa = parseFloat(res.data.resumo.taxa_conversao);
        if (taxa === 100) {
          toast.success('✅ 100% das mensagens foram salvas corretamente!');
        } else if (taxa >= 95) {
          toast.warning(`⚠️ Taxa de conversão: ${taxa}%`);
        } else {
          toast.error(`❌ Taxa de conversão baixa: ${taxa}%`);
        }
      }
    } catch (error) {
      console.error("[Diagnóstico]", error);
      toast.error('Erro ao executar diagnóstico');
      setResultados({ erro: error.message });
    } finally {
      setDiagnosticando(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          📊 Diagnóstico de Integridade - Mensagens de Hoje
        </h3>
        
        <p className="text-sm text-slate-600 mb-4">
          Compara payloads recebidos no webhook com Messages salvas no banco de dados.
          Identifica mensagens que chegaram mas não foram processadas.
        </p>

        <Button
          onClick={executarDiagnostico}
          disabled={diagnosticando}
          className="w-full bg-indigo-600 hover:bg-indigo-700"
        >
          {diagnosticando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Executar Diagnóstico
            </>
          )}
        </Button>
      </Card>

      {resultados && (
        <div className="space-y-3">
          {resultados.erro ? (
            <Alert className="bg-red-50 border-red-200">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                {resultados.erro}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* RESUMO */}
              <Card className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  📈 Resumo
                </h4>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-2 bg-white rounded border border-blue-100">
                    <p className="text-xs text-slate-500">Payloads Recebidos</p>
                    <p className="text-xl font-bold text-blue-600">
                      {resultados.resumo.total_payloads}
                    </p>
                  </div>
                  
                  <div className="p-2 bg-white rounded border border-green-100">
                    <p className="text-xs text-slate-500">Messages Salvas</p>
                    <p className="text-xl font-bold text-green-600">
                      {resultados.resumo.total_messages}
                    </p>
                  </div>
                  
                  <div className="p-2 bg-white rounded border border-emerald-100">
                    <p className="text-xs text-slate-500">Com Correspondência</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {resultados.resumo.payloads_com_message}
                    </p>
                  </div>
                  
                  <div className={`p-2 bg-white rounded border ${
                    resultados.resumo.payloads_sem_message === 0 
                      ? 'border-green-100' 
                      : 'border-red-100'
                  }`}>
                    <p className="text-xs text-slate-500">Faltando</p>
                    <p className={`text-xl font-bold ${
                      resultados.resumo.payloads_sem_message === 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {resultados.resumo.payloads_sem_message}
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-white rounded border-2 border-indigo-200">
                  <p className="text-xs text-slate-600 mb-1">Taxa de Conversão</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          parseFloat(resultados.resumo.taxa_conversao) === 100
                            ? 'bg-green-500'
                            : parseFloat(resultados.resumo.taxa_conversao) >= 95
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: resultados.resumo.taxa_conversao }}
                      />
                    </div>
                    <p className="font-bold text-sm text-slate-900 w-12">
                      {resultados.resumo.taxa_conversao}
                    </p>
                  </div>
                </div>
              </Card>

              {/* ANÁLISE POR PROVEDOR */}
              <Card className="p-4">
                <h4 className="font-bold text-slate-900 mb-3">🔌 Por Provedor</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(resultados.analise_por_provedor).map(([prov, dados]) => (
                    <div key={prov} className="p-3 bg-slate-50 rounded border border-slate-200">
                      <p className="text-sm font-semibold text-slate-700 capitalize">
                        {prov.replace('_', '-').toUpperCase()}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        <p>Total: <span className="font-bold">{dados.total}</span></p>
                        <p className={dados.sem_message === 0 ? 'text-green-600' : 'text-red-600'}>
                          Sem Message: <span className="font-bold">{dados.sem_message}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* ANÁLISE POR TIPO DE EVENTO */}
              <Card className="p-4">
                <h4 className="font-bold text-slate-900 mb-3">📋 Por Tipo de Evento</h4>
                <div className="space-y-2">
                  {Object.entries(resultados.analise_por_tipo).map(([tipo, dados]) => (
                    <div key={tipo} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                      <span className="text-sm font-medium text-slate-700">{tipo}</span>
                      <div className="flex gap-3 text-xs">
                        <span className="text-slate-600">Total: <strong>{dados.total}</strong></span>
                        <span className={dados.sem_message === 0 ? 'text-green-600' : 'text-red-600'}>
                          Faltando: <strong>{dados.sem_message}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* PAYLOADS SEM MESSAGE */}
              {resultados.payloads_sem_correspondencia.length > 0 && (
                <Card className="p-4 border-red-200 bg-red-50">
                  <h4 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    ❌ Payloads SEM Message Correspondente
                  </h4>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {resultados.payloads_sem_correspondencia.map((item, idx) => (
                      <div key={idx} className="p-2 bg-red-100 rounded border border-red-300 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono bg-red-200 px-2 py-0.5 rounded">
                            {item.messageId?.substring(0, 16)}...
                          </span>
                          <span className="text-red-700 font-semibold">{item.tipo}</span>
                        </div>
                        <p className="text-red-700">📱 {item.phone}</p>
                        <p className="text-red-600 text-[10px] mt-1">⏰ {new Date(item.created).toLocaleTimeString('pt-BR')}</p>
                        <p className="text-red-700 text-[10px] mt-0.5">Motivo: {item.razao}</p>
                      </div>
                    ))}
                  </div>

                  {resultados.payloads_sem_message > 50 && (
                    <p className="mt-2 text-xs text-red-600 text-center">
                      ... e {resultados.payloads_sem_message - 50} outros
                    </p>
                  )}
                </Card>
              )}

              {/* ANÁLISE POR TELEFONE */}
              {Object.keys(resultados.analise_por_telefone).length > 0 && (
                <Card className="p-4 border-orange-200 bg-orange-50">
                  <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    📞 Números com Problemas
                  </h4>
                  
                  <div className="space-y-3">
                    {Object.entries(resultados.analise_por_telefone).map(([telefone, eventos]) => (
                      <div key={telefone} className="p-3 bg-white rounded border border-orange-200">
                        <p className="font-mono font-bold text-orange-700">{telefone}</p>
                        <div className="mt-2 space-y-1 text-xs text-orange-600">
                          {eventos.map((evt, idx) => (
                            <p key={idx}>
                              • {evt.tipo} - {new Date(evt.timestamp).toLocaleTimeString('pt-BR')}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* STATUS GERAL */}
              <Card className={`p-4 ${
                resultados.resumo.payloads_sem_message === 0
                  ? 'border-green-200 bg-green-50'
                  : 'border-yellow-200 bg-yellow-50'
              }`}>
                <div className="flex items-start gap-3">
                  {resultados.resumo.payloads_sem_message === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`font-bold ${
                      resultados.resumo.payloads_sem_message === 0
                        ? 'text-green-900'
                        : 'text-yellow-900'
                    }`}>
                      {resultados.resumo.payloads_sem_message === 0
                        ? '✅ Integridade 100% - Todas as mensagens foram salvas'
                        : `⚠️ ${resultados.resumo.payloads_sem_message} mensagens não foram salvas`
                      }
                    </p>
                    <p className={`text-sm mt-1 ${
                      resultados.resumo.payloads_sem_message === 0
                        ? 'text-green-700'
                        : 'text-yellow-700'
                    }`}>
                      Taxa de conversão: {resultados.resumo.taxa_conversao}
                    </p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}