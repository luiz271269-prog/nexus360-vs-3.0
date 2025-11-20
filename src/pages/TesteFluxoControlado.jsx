import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play,
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Activity,
  Zap,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

export default function TesteFluxoControlado() {
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const executarTeste = async () => {
    setExecutando(true);
    setResultado(null);

    try {
      console.log('[TESTE-FLUXO] 🚀 Executando teste controlado...');
      
      const { data } = await base44.functions.invoke('testeFluxoWebhookControlado', {});
      
      console.log('[TESTE-FLUXO] ✅ Resultado:', data);
      setResultado(data);
      
      if (data.success) {
        toast.success('Fluxo executado com sucesso!');
      } else {
        toast.error(`Falhou em: ${data.etapa_falhou}`);
      }
      
    } catch (error) {
      console.error('[TESTE-FLUXO] ❌ Erro:', error);
      toast.error('Erro ao executar teste: ' + error.message);
      setResultado({
        success: false,
        error: error.message,
        logs: []
      });
    } finally {
      setExecutando(false);
    }
  };

  const getIconeLog = (tipo) => {
    switch (tipo) {
      case 'SUCCESS': return <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />;
      case 'ERROR': return <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />;
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />;
      default: return <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />;
    }
  };

  const getCorLinha = (tipo) => {
    switch (tipo) {
      case 'SUCCESS': return 'bg-green-50 border-l-4 border-green-500';
      case 'ERROR': return 'bg-red-50 border-l-4 border-red-500';
      case 'WARNING': return 'bg-yellow-50 border-l-4 border-yellow-500';
      default: return 'bg-blue-50 border-l-4 border-blue-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Zap className="w-8 h-8 text-orange-600" />
              Teste de Fluxo Controlado
            </h1>
            <p className="text-slate-600 mt-1">
              Replica EXATAMENTE o fluxo do webhook com logs detalhados de cada etapa
            </p>
          </div>
          
          <Button 
            onClick={executarTeste}
            disabled={executando}
            className="bg-orange-600 hover:bg-orange-700 gap-2"
            size="lg"
          >
            {executando ? (
              <>
                <Activity className="w-5 h-5 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Executar Teste
              </>
            )}
          </Button>
        </div>

        {/* Instruções */}
        <Alert className="bg-orange-50 border-orange-300">
          <Zap className="h-4 w-4 text-orange-700" />
          <AlertDescription className="text-orange-900">
            <strong>Como funciona:</strong>
            <ol className="list-decimal ml-6 mt-2 space-y-1">
              <li>Executa o MESMO fluxo do webhook de forma controlada</li>
              <li>Loga cada etapa: Base44 init → Auditoria → Normalização → Contact → Thread → Message</li>
              <li>Se falhar, mostra EXATAMENTE em qual etapa e porquê</li>
              <li>Identifica se o problema é permissão, schema, ou lógica</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Resultado Geral */}
        {resultado && (
          <Card className={`border-2 ${
            resultado.success 
              ? 'border-green-300 bg-green-50' 
              : 'border-red-300 bg-red-50'
          }`}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                {resultado.success ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-900">✅ Fluxo Executado com Sucesso</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-900">❌ Fluxo Falhou</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {resultado.success ? (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-green-900">
                    O fluxo completo funcionou! IDs criados:
                  </p>
                  <div className="bg-white rounded p-3 border border-green-300">
                    <pre className="text-xs">
                      {JSON.stringify(resultado.ids_criados, null, 2)}
                    </pre>
                  </div>
                  <Alert className="bg-green-100 border-green-400">
                    <CheckCircle className="h-4 w-4 text-green-700" />
                    <AlertDescription className="text-green-900 text-sm">
                      <strong>Conclusão:</strong> O sistema de persistência está funcionando corretamente.
                      Se o webhook real está falhando, o problema é na normalização do payload da Z-API
                      ou na correspondência do instance_id.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-red-900">
                    Falhou na etapa: <Badge className="bg-red-600 text-white">{resultado.etapa_falhou}</Badge>
                  </p>
                  {resultado.error && (
                    <Alert className="bg-red-100 border-red-400">
                      <XCircle className="h-4 w-4 text-red-700" />
                      <AlertDescription className="text-red-900 text-sm">
                        <strong>Erro:</strong> {resultado.error}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Logs Detalhados */}
        {resultado && resultado.logs && resultado.logs.length > 0 && (
          <Card>
            <CardHeader className="bg-slate-50">
              <CardTitle className="text-sm">
                📋 Logs de Execução ({resultado.logs.length} eventos)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                {resultado.logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`p-4 border-b last:border-b-0 ${getCorLinha(log.tipo)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getIconeLog(log.tipo)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {log.tipo}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-900">
                          {log.mensagem}
                        </p>
                        {log.dados && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                              Ver dados completos
                            </summary>
                            <pre className="mt-2 text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto">
                              {JSON.stringify(log.dados, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}