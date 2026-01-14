import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  PlayCircle, AlertTriangle, CheckCircle2, Database, 
  RefreshCw, Zap, Eye, EyeOff, Info, TrendingUp, ArrowRightLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { executarAnaliseEmLote } from '@/components/lib/nexusComparator';
import { buildPolicyFromLegacyUser } from '@/components/lib/nexusLegacyConverter';
import { base44 } from '@/api/base44Client';

export default function NexusSimuladorVisibilidade({ usuario, integracoes = [] }) {
  const [simulationResults, setSimulationResults] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [migrando, setMigrando] = useState(false);

  const handleAutoMigrate = async () => {
    if (!usuario) return;
    
    try {
      setMigrando(true);
      
      // Gerar configuração Nexus360 baseada no perfil legado
      const newPolicy = buildPolicyFromLegacyUser(usuario);
      
      // Salvar no banco
      await base44.entities.User.update(usuario.id, newPolicy);
      
      toast.success('✅ Configuração Nexus360 gerada e salva com sucesso!');
      
      // Recarregar página para ver mudanças
      setTimeout(() => window.location.reload(), 1500);
      
    } catch (error) {
      console.error('Erro ao migrar configuração:', error);
      toast.error('Erro ao migrar: ' + error.message);
    } finally {
      setMigrando(false);
    }
  };

  const runSimulation = async () => {
    if (!usuario) {
      toast.error('Nenhum usuário selecionado');
      return;
    }
    
    try {
      setLoading(true);
      
      // Buscar amostra de threads (últimas 50)
      const threads = await base44.entities.MessageThread.list('-last_message_at', 50);
      
      if (!threads || threads.length === 0) {
        toast.warning('Nenhuma thread encontrada para análise');
        return;
      }
      
      // Executar análise comparativa
      const resultado = executarAnaliseEmLote(usuario, threads, integracoes);
      
      setSimulationResults(resultado);
      setLastRun(new Date());
      
      const { stats } = resultado;
      
      if (stats.divergencias === 0) {
        toast.success(`🎉 Perfeito! ${stats.total} threads analisadas - 100% de aderência`);
      } else if (stats.criticosFalsoNegativo > 0) {
        toast.error(`🚨 ${stats.criticosFalsoNegativo} falsos negativos críticos encontrados!`);
      } else {
        toast.warning(`⚠️ ${stats.divergencias} divergências encontradas`);
      }
      
    } catch (error) {
      console.error('Erro ao executar simulação:', error);
      toast.error('Erro na simulação: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const temConfigNexus = usuario?.configuracao_visibilidade_nexus || usuario?.permissoes_acoes_nexus;

  return (
    <div className="space-y-4">
      {/* Header com ações */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Simulador Nexus360</CardTitle>
                <CardDescription>
                  Validação matemática: compare decisões legado vs Nexus360
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {!temConfigNexus && (
                <Button 
                  variant="outline" 
                  onClick={handleAutoMigrate}
                  disabled={migrando}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  {migrando ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Migrando...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Migrar do Legado
                    </>
                  )}
                </Button>
              )}
              <Button 
                onClick={runSimulation}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Testar Aderência
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Alertas */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Modo Shadow:</strong> Esta análise NÃO afeta o sistema em produção. 
          Compare as decisões para validar as regras Nexus360 antes da migração real.
        </AlertDescription>
      </Alert>

      {/* Estatísticas */}
      {simulationResults && (
        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Analisado</p>
                  <p className="text-2xl font-bold">{simulationResults.stats.total}</p>
                </div>
                <Database className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium">Matches</p>
                  <p className="text-2xl font-bold text-green-700">{simulationResults.stats.matches}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Divergências</p>
                  <p className="text-2xl font-bold text-amber-700">{simulationResults.stats.divergencias}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Aderência</p>
                  <p className="text-2xl font-bold text-purple-700">{simulationResults.stats.taxa_aderencia}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de resultados */}
      {simulationResults && simulationResults.resultados.length > 0 && (
        <Card className="overflow-hidden">
          <div className="bg-slate-50 p-3 border-b flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-700">
              Comparação Detalhada
            </span>
            <span className="text-xs text-slate-500">
              Última execução: {lastRun?.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600 font-semibold">
                <tr>
                  <th className="p-3 text-left">Conversa / Contato</th>
                  <th className="p-3 text-center">Sistema Atual</th>
                  <th className="p-3 text-center">Nexus360</th>
                  <th className="p-3 text-left">Diagnóstico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {simulationResults.resultados.map((res) => (
                  <tr 
                    key={res.threadId} 
                    className={
                      res.isMatch 
                        ? "hover:bg-slate-50" 
                        : res.severity === 'error'
                        ? "bg-red-50 hover:bg-red-100"
                        : "bg-amber-50 hover:bg-amber-100"
                    }
                  >
                    <td className="p-3">
                      <div className="font-medium text-slate-700">{res.contactName}</div>
                      <div className="text-xs text-slate-400 font-mono">{res.threadId.substring(0, 16)}...</div>
                      <Badge variant="outline" className="text-xs mt-1">{res.threadType}</Badge>
                    </td>
                    
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {res.legacyDecision ? (
                          <Eye className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <EyeOff className="w-5 h-5 text-slate-400" />
                        )}
                        <Badge 
                          variant={res.legacyDecision ? "default" : "secondary"}
                          className={res.legacyDecision ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}
                        >
                          {res.legacyDecision ? "Visível" : "Bloqueado"}
                        </Badge>
                        <span className="text-xs text-slate-500 mt-1 text-center max-w-[120px]">
                          {res.legacyMotivo}
                        </span>
                      </div>
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {res.nexusDecision ? (
                          <Eye className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <EyeOff className="w-5 h-5 text-slate-400" />
                        )}
                        <Badge 
                          variant={res.nexusDecision ? "default" : "secondary"}
                          className={res.nexusDecision ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"}
                        >
                          {res.nexusDecision ? "Visível" : "Bloqueado"}
                        </Badge>
                        <span className="text-xs text-slate-500 mt-1 text-center max-w-[120px]">
                          {res.nexusMotivo}
                        </span>
                        <code className="text-[10px] text-purple-600 font-mono mt-1">
                          {res.nexusReasonCode}
                        </code>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="space-y-2">
                        {res.isMatch ? (
                          <div className="flex items-center text-emerald-600 text-xs font-medium">
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Match perfeito
                          </div>
                        ) : (
                          <div className={`flex items-start gap-2 text-xs font-bold ${
                            res.severity === 'error' ? 'text-red-700' : 'text-amber-700'
                          }`}>
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{res.reason}</span>
                          </div>
                        )}
                        
                        {/* Decision Path (Nexus) */}
                        {res.nexusDecisionPath.length > 0 && (
                          <div className="text-xs text-slate-500 space-y-1">
                            <div className="font-semibold">Path:</div>
                            {res.nexusDecisionPath.map((step, idx) => (
                              <div key={idx} className="font-mono text-[10px] text-purple-600">
                                {step}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Ações rápidas */}
      {simulationResults && simulationResults.stats.divergencias > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> {simulationResults.stats.divergencias} divergências encontradas.
            {simulationResults.stats.criticosFalsoNegativo > 0 && (
              <> Existem {simulationResults.stats.criticosFalsoNegativo} falsos negativos críticos que podem bloquear conversas visíveis hoje.</>
            )}
            <br />
            Ajuste as regras de bloqueio/liberação antes de ativar o Nexus360 em produção.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}