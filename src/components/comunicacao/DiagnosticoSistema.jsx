import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Wrench
} from "lucide-react";
import { toast } from "sonner";

export default function DiagnosticoSistema() {
  const [diagnosticando, setDiagnosticando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const executarDiagnostico = async () => {
    setDiagnosticando(true);
    setResultado(null);

    try {
      toast.info("🔍 Executando diagnóstico completo...");

      const { data } = await base44.functions.invoke('diagnosticarConexoes', {});

      console.log('[DIAGNOSTICO UI] Resultado:', data);

      setResultado(data);

      if (data.success) {
        if (data.status === 'tudo_ok') {
          toast.success("✅ Sistema está perfeito!");
        } else {
          toast.success(`✅ Diagnóstico concluído! ${data.correcoes.length} correções aplicadas.`);
        }
      }

    } catch (error) {
      console.error('[DIAGNOSTICO UI] Erro:', error);
      toast.error("Erro ao executar diagnóstico: " + error.message);
    }

    setDiagnosticando(false);
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-600" />
          Diagnóstico do Sistema
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Analisa e corrige automaticamente problemas de integridade nos dados de conversas.
        </p>

        <Button
          onClick={executarDiagnostico}
          disabled={diagnosticando}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {diagnosticando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Diagnosticando...
            </>
          ) : (
            <>
              <Wrench className="w-4 h-4 mr-2" />
              Executar Diagnóstico Completo
            </>
          )}
        </Button>

        {resultado && (
          <div className="space-y-4 mt-4">
            {/* Estatísticas */}
            <Card className="bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  Estatísticas Gerais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-500">Contatos</div>
                    <div className="font-bold text-lg">{resultado.estatisticas.total_contatos}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Conversas</div>
                    <div className="font-bold text-lg">{resultado.estatisticas.total_threads}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Mensagens</div>
                    <div className="font-bold text-lg">{resultado.estatisticas.total_mensagens}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Média Msgs/Conv</div>
                    <div className="font-bold text-lg">{resultado.estatisticas.media_mensagens_por_thread}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status */}
            <Card className={`${
              resultado.status === 'tudo_ok' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {resultado.status === 'tudo_ok' ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <div className="font-bold text-green-900">Sistema OK</div>
                        <div className="text-sm text-green-700">Nenhum problema encontrado</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-6 h-6 text-yellow-600" />
                      <div>
                        <div className="font-bold text-yellow-900">Correções Aplicadas</div>
                        <div className="text-sm text-yellow-700">
                          {resultado.problemas.length} problema(s) encontrado(s) e corrigido(s)
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Problemas */}
            {resultado.problemas.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    Problemas Encontrados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {resultado.problemas.map((problema, index) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm text-yellow-900">
                            {problema.tipo.replace(/_/g, ' ').toUpperCase()}
                          </div>
                          <Badge className="bg-yellow-200 text-yellow-900">
                            {problema.quantidade} itens
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Correções */}
            {resultado.correcoes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Correções Aplicadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {resultado.correcoes.slice(0, 5).map((correcao, index) => (
                      <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs">
                        <div className="font-medium text-green-900">
                          {correcao.tipo.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div className="text-green-700 mt-1">
                          {JSON.stringify(correcao, null, 2).substring(0, 100)}...
                        </div>
                      </div>
                    ))}
                    {resultado.correcoes.length > 5 && (
                      <div className="text-xs text-center text-slate-500 pt-2">
                        +{resultado.correcoes.length - 5} correções adicionais
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recarregar Página
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}