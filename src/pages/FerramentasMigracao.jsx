import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Database, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  Play,
  Eye,
  Zap,
  Users,
  Activity,
  Link2
} from "lucide-react";
import { toast } from "sonner";

export default function FerramentasMigracao() {
  const [executando, setExecutando] = useState(null);
  const [resultados, setResultados] = useState({
    diagnostico: null,
    migracao_threads: null,
    auto_permissoes: null,
    sync_crm: null
  });

  const executarDiagnostico = async () => {
    setExecutando('diagnostico');
    try {
      toast.info('🔍 Executando diagnóstico...');
      const response = await base44.functions.invoke('diagnosticoSaudeThreads', {});
      
      if (response.data.success) {
        setResultados(prev => ({ ...prev, diagnostico: response.data.diagnostico }));
        toast.success('✅ Diagnóstico concluído!');
      } else {
        toast.error('Erro: ' + response.data.error);
      }
    } catch (error) {
      console.error('[FERRAMENTAS] Erro:', error);
      toast.error('Erro ao executar: ' + error.message);
    } finally {
      setExecutando(null);
    }
  };

  const executarMigracaoThreads = async (dryRun = true) => {
    setExecutando('migracao_threads');
    try {
      const modo = dryRun ? 'DRY-RUN (apenas análise)' : 'EXECUÇÃO REAL';
      toast.info(`🔄 Migrando threads (${modo})...`);
      
      const response = await base44.functions.invoke('migrarThreadsOrfas', {
        dryRun,
        limit: 500
      });
      
      if (response.data.success) {
        setResultados(prev => ({ ...prev, migracao_threads: response.data }));
        
        if (dryRun) {
          toast.success(`✅ ${response.data.mensagem}`);
        } else {
          toast.success(`✅ ${response.data.resultados.atualizadas} threads corrigidas!`);
        }
      } else {
        toast.error('Erro: ' + response.data.error);
      }
    } catch (error) {
      console.error('[FERRAMENTAS] Erro:', error);
      toast.error('Erro ao executar: ' + error.message);
    } finally {
      setExecutando(null);
    }
  };

  const executarAutoPermissoes = async (dryRun = true) => {
    setExecutando('auto_permissoes');
    try {
      const modo = dryRun ? 'DRY-RUN (apenas análise)' : 'EXECUÇÃO REAL';
      toast.info(`👥 Configurando permissões (${modo})...`);
      
      const response = await base44.functions.invoke('autopermissoesUsuarios', {
        dryRun,
        incluirAdmins: false
      });
      
      if (response.data.success) {
        setResultados(prev => ({ ...prev, auto_permissoes: response.data }));
        
        if (dryRun) {
          toast.success(`✅ ${response.data.mensagem}`);
        } else {
          toast.success(`✅ ${response.data.resultados.usuarios_atualizados} usuários configurados!`);
        }
      } else {
        toast.error('Erro: ' + response.data.error);
      }
    } catch (error) {
      console.error('[FERRAMENTAS] Erro:', error);
      toast.error('Erro ao executar: ' + error.message);
    } finally {
      setExecutando(null);
    }
  };

  const executarSyncCRM = async (dryRun = true) => {
    setExecutando('sync_crm');
    try {
      const modo = dryRun ? 'DRY-RUN (apenas análise)' : 'EXECUÇÃO REAL';
      toast.info(`🔗 Sincronizando CRM (${modo})...`);

      const response = await base44.functions.invoke('sincronizarCRMVendedores', { dryRun });

      if (response.data.success) {
        setResultados(prev => ({ ...prev, sync_crm: response.data }));
        if (dryRun) {
          toast.success(`✅ ${response.data.mensagem}`);
        } else {
          toast.success(`✅ ${response.data.resultados.corrigidos} orçamentos corrigidos!`);
        }
      } else {
        toast.error('Erro: ' + response.data.error);
      }
    } catch (error) {
      toast.error('Erro ao executar: ' + error.message);
    } finally {
      setExecutando(null);
    }
  };

  const diag = resultados.diagnostico;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Database className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Ferramentas de Migração</h1>
              <p className="text-sm text-slate-600">Correção de threads órfãs e permissões</p>
            </div>
          </div>
        </div>

        {/* Alerta Importante */}
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          <AlertTitle className="text-orange-900">⚠️ Ferramentas Administrativas</AlertTitle>
          <AlertDescription className="text-orange-800">
            Execute <strong>DRY-RUN</strong> primeiro para analisar o impacto. Apenas administradores podem executar estas funções.
          </AlertDescription>
        </Alert>

        {/* Card 1: Diagnóstico de Saúde */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Activity className="w-5 h-5" />
              1. Diagnóstico de Saúde do Sistema
            </CardTitle>
            <CardDescription>
              Verifica threads órfãs, integrações desconectadas, usuários sem permissões
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={executarDiagnostico}
              disabled={executando === 'diagnostico'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {executando === 'diagnostico' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Executar Diagnóstico
            </Button>

            {diag && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Badge className={`text-sm ${
                    diag.resumo.saude_geral === '✅ SAUDÁVEL' ? 'bg-green-600' :
                    diag.resumo.saude_geral === '⚠️ ATENÇÃO' ? 'bg-yellow-600' :
                    'bg-red-600'
                  } text-white`}>
                    {diag.resumo.saude_geral}
                  </Badge>
                  <span className="text-sm text-slate-600">
                    {diag.resumo.total_problemas} problema(s) detectado(s)
                  </span>
                </div>

                {/* Problemas Detectados */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-red-900">Threads Órfãs</span>
                      <Badge className="bg-red-600 text-white">{diag.queries.threads_orfas.total}</Badge>
                    </div>
                    <p className="text-xs text-red-700">Integração não existe mais</p>
                  </div>

                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-yellow-900">Integração Desconectada</span>
                      <Badge className="bg-yellow-600 text-white">{diag.queries.threads_integração_desconectada.total}</Badge>
                    </div>
                    <p className="text-xs text-yellow-700">Threads com unread em integração offline</p>
                  </div>

                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-purple-900">Usuários Sem Permissões</span>
                      <Badge className="bg-purple-600 text-white">{diag.queries.usuarios_sem_permissoes.total}</Badge>
                    </div>
                    <p className="text-xs text-purple-700">whatsapp_permissions vazio</p>
                  </div>

                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-orange-900">Sem Histórico</span>
                      <Badge className="bg-orange-600 text-white">{diag.queries.threads_sem_origin_ids.total}</Badge>
                    </div>
                    <p className="text-xs text-orange-700">origin_integration_ids ausente</p>
                  </div>
                </div>

                {/* Recomendações */}
                {diag.resumo.recomendacoes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-900">📋 Ações Recomendadas:</h4>
                    {diag.resumo.recomendacoes.map((rec, idx) => (
                      <div key={idx} className={`p-3 rounded-lg border ${
                        rec.prioridade === 'ALTA' ? 'bg-red-50 border-red-200' :
                        rec.prioridade === 'MÉDIA' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          <Badge className={`${
                            rec.prioridade === 'ALTA' ? 'bg-red-600' :
                            rec.prioridade === 'MÉDIA' ? 'bg-yellow-600' :
                            'bg-blue-600'
                          } text-white text-xs`}>
                            {rec.prioridade}
                          </Badge>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{rec.problema}</p>
                            <p className="text-xs text-slate-600 mt-1">➡️ {rec.acao}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Migração de Threads */}
        <Card className="border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-900">
              <RefreshCw className="w-5 h-5" />
              2. Migração de Threads Órfãs
            </CardTitle>
            <CardDescription>
              Corrige whatsapp_integration_id e origin_integration_ids[] usando última mensagem como fonte de verdade
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button
                onClick={() => executarMigracaoThreads(true)}
                disabled={executando === 'migracao_threads'}
                variant="outline"
                className="border-indigo-300"
              >
                {executando === 'migracao_threads' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4 mr-2" />
                )}
                DRY-RUN (Analisar)
              </Button>

              <Button
                onClick={() => {
                  if (!confirm('⚠️ Executar migração REAL? Isso atualizará threads no banco de dados.')) return;
                  executarMigracaoThreads(false);
                }}
                disabled={executando === 'migracao_threads'}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {executando === 'migracao_threads' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Executar Migração
              </Button>
            </div>

            {resultados.migracao_threads && (
              <div className="p-4 bg-slate-50 border rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  {resultados.migracao_threads.dry_run ? (
                    <Badge className="bg-blue-600 text-white">DRY-RUN</Badge>
                  ) : (
                    <Badge className="bg-green-600 text-white">EXECUTADO</Badge>
                  )}
                  <span className="text-sm font-medium">{resultados.migracao_threads.mensagem}</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2 bg-white rounded border text-center">
                    <div className="text-xs text-slate-500">Analisadas</div>
                    <div className="text-lg font-bold text-slate-900">
                      {resultados.migracao_threads.resultados.analisadas}
                    </div>
                  </div>
                  <div className="p-2 bg-red-50 rounded border border-red-200 text-center">
                    <div className="text-xs text-red-700">Órfãs</div>
                    <div className="text-lg font-bold text-red-600">
                      {resultados.migracao_threads.resultados.orfas_integração}
                    </div>
                  </div>
                  <div className="p-2 bg-orange-50 rounded border border-orange-200 text-center">
                    <div className="text-xs text-orange-700">Desatualizadas</div>
                    <div className="text-lg font-bold text-orange-600">
                      {resultados.migracao_threads.resultados.desatualizadas}
                    </div>
                  </div>
                </div>

                {resultados.migracao_threads.exemplos?.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                      Ver exemplos de threads problemáticas ({resultados.migracao_threads.exemplos.length})
                    </summary>
                    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                      {resultados.migracao_threads.exemplos.map((ex, idx) => (
                        <div key={idx} className="p-2 bg-white border rounded text-xs">
                          <div className="font-mono text-slate-600">Thread: {ex.thread_id}</div>
                          <div className="font-mono text-slate-600">Contact: {ex.contact_id}</div>
                          <div className="text-slate-500 mt-1">
                            {ex.problemas.orfa && <Badge className="bg-red-500 text-white text-[10px] mr-1">Órfã</Badge>}
                            {ex.problemas.desatualizada && <Badge className="bg-orange-500 text-white text-[10px] mr-1">Desatualizada</Badge>}
                            {ex.problemas.sem_historico && <Badge className="bg-yellow-500 text-white text-[10px]">Sem histórico</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Auto-Permissões */}
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-900">
              <Users className="w-5 h-5" />
              3. Auto-Configuração de Permissões
            </CardTitle>
            <CardDescription>
              Adiciona whatsapp_permissions[] para usuários sem configuração (libera todas integrações ativas)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button
                onClick={() => executarAutoPermissoes(true)}
                disabled={executando === 'auto_permissoes'}
                variant="outline"
                className="border-purple-300"
              >
                {executando === 'auto_permissoes' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4 mr-2" />
                )}
                DRY-RUN (Analisar)
              </Button>

              <Button
                onClick={() => {
                  if (!confirm('⚠️ Configurar permissões AUTOMATICAMENTE para todos usuários sem configuração?')) return;
                  executarAutoPermissoes(false);
                }}
                disabled={executando === 'auto_permissoes'}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {executando === 'auto_permissoes' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Configurar Permissões
              </Button>
            </div>

            {resultados.auto_permissoes && (
              <div className="p-4 bg-slate-50 border rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  {resultados.auto_permissoes.dry_run ? (
                    <Badge className="bg-blue-600 text-white">DRY-RUN</Badge>
                  ) : (
                    <Badge className="bg-green-600 text-white">EXECUTADO</Badge>
                  )}
                  <span className="text-sm font-medium">{resultados.auto_permissoes.mensagem}</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2 bg-white rounded border text-center">
                    <div className="text-xs text-slate-500">Usuários Analisados</div>
                    <div className="text-lg font-bold text-slate-900">
                      {resultados.auto_permissoes.resultados.usuarios_analisados}
                    </div>
                  </div>
                  <div className="p-2 bg-green-50 rounded border border-green-200 text-center">
                    <div className="text-xs text-green-700">Configurados</div>
                    <div className="text-lg font-bold text-green-600">
                      {resultados.auto_permissoes.resultados.usuarios_atualizados}
                    </div>
                  </div>
                  <div className="p-2 bg-purple-50 rounded border border-purple-200 text-center">
                    <div className="text-xs text-purple-700">Integrações/Usuário</div>
                    <div className="text-lg font-bold text-purple-600">
                      {resultados.auto_permissoes.permissoes_por_usuario}
                    </div>
                  </div>
                </div>

                {resultados.auto_permissoes.exemplos?.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-purple-600 cursor-pointer hover:underline">
                      Ver usuários que serão configurados ({resultados.auto_permissoes.exemplos.length})
                    </summary>
                    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                      {resultados.auto_permissoes.exemplos.map((ex, idx) => (
                        <div key={idx} className="p-2 bg-white border rounded text-xs">
                          <div className="font-semibold text-slate-900">{ex.email}</div>
                          <div className="text-slate-600">
                            {ex.role} • {ex.sector || 'sem setor'}
                          </div>
                          <div className="text-slate-500 mt-1">
                            {ex.permissoes_adicionadas} permissões: {ex.integracoes.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Sincronização CRM - Vínculos Vendedor */}
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <Link2 className="w-5 h-5" />
              4. Sincronização CRM — Vínculo Orçamentos x Vendedor
            </CardTitle>
            <CardDescription>
              Analisa todos os orçamentos e corrige o vendedor_id para o User correto, usando nome, email ou quem criou como fallback
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button
                onClick={() => executarSyncCRM(true)}
                disabled={executando === 'sync_crm'}
                variant="outline"
                className="border-green-300"
              >
                {executando === 'sync_crm' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4 mr-2" />
                )}
                DRY-RUN (Analisar)
              </Button>

              <Button
                onClick={() => {
                  if (!confirm('⚠️ Aplicar correção de vínculos CRM em todos os orçamentos?')) return;
                  executarSyncCRM(false);
                }}
                disabled={executando === 'sync_crm'}
                className="bg-green-600 hover:bg-green-700"
              >
                {executando === 'sync_crm' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Corrigir Vínculos
              </Button>
            </div>

            {resultados.sync_crm && (
              <div className="p-4 bg-slate-50 border rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  {resultados.sync_crm.dry_run ? (
                    <Badge className="bg-blue-600 text-white">DRY-RUN</Badge>
                  ) : (
                    <Badge className="bg-green-600 text-white">EXECUTADO</Badge>
                  )}
                  <span className="text-sm font-medium">{resultados.sync_crm.mensagem}</span>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="p-2 bg-white rounded border text-center">
                    <div className="text-xs text-slate-500">Total</div>
                    <div className="text-lg font-bold text-slate-900">{resultados.sync_crm.resultados.total}</div>
                  </div>
                  <div className="p-2 bg-green-50 rounded border border-green-200 text-center">
                    <div className="text-xs text-green-700">Já Corretos</div>
                    <div className="text-lg font-bold text-green-600">{resultados.sync_crm.resultados.ja_corretos}</div>
                  </div>
                  <div className="p-2 bg-blue-50 rounded border border-blue-200 text-center">
                    <div className="text-xs text-blue-700">{resultados.sync_crm.dry_run ? 'Seriam Corrigidos' : 'Corrigidos'}</div>
                    <div className="text-lg font-bold text-blue-600">{resultados.sync_crm.resultados.corrigidos}</div>
                  </div>
                  <div className="p-2 bg-red-50 rounded border border-red-200 text-center">
                    <div className="text-xs text-red-700">Sem Match</div>
                    <div className="text-lg font-bold text-red-600">{resultados.sync_crm.resultados.nao_resolvidos}</div>
                  </div>
                </div>

                {resultados.sync_crm.resultados.detalhes?.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-green-600 cursor-pointer hover:underline">
                      Ver detalhes ({resultados.sync_crm.resultados.detalhes.length})
                    </summary>
                    <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
                      {resultados.sync_crm.resultados.detalhes.map((d, idx) => (
                        <div key={idx} className={`p-2 border rounded text-xs ${
                          d.status === 'nao_resolvido' ? 'bg-red-50 border-red-200' : 'bg-white'
                        }`}>
                          <div className="font-semibold text-slate-900">
                            #{d.numero} — {d.status === 'nao_resolvido' ? '❌ Sem match' : '✅ ' + d.metodo}
                          </div>
                          {d.status !== 'nao_resolvido' ? (
                            <div className="text-slate-600">
                              <span className="line-through text-red-500">{d.vendedor_campo_antigo}</span>
                              {' → '}
                              <span className="text-green-700 font-medium">{d.vendedor_novo}</span>
                            </div>
                          ) : (
                            <div className="text-red-600">
                              Campo vendedor: &quot;{d.vendedor_campo}&quot; | Criado por: {d.created_by}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 5: Documentação Rápida */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <CheckCircle className="w-5 h-5" />
              Fluxo Recomendado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <Badge className="bg-blue-600 text-white flex-shrink-0">1</Badge>
                <div>
                  <strong>Diagnóstico</strong> - Identificar problemas
                  <p className="text-xs text-slate-600 mt-1">Executar para ver quantas threads/usuários precisam correção</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Badge className="bg-indigo-600 text-white flex-shrink-0">2</Badge>
                <div>
                  <strong>Migração de Threads (DRY-RUN)</strong> - Simular correção
                  <p className="text-xs text-slate-600 mt-1">Ver quais threads serão atualizadas SEM modificar banco</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Badge className="bg-purple-600 text-white flex-shrink-0">3</Badge>
                <div>
                  <strong>Auto-Permissões (DRY-RUN)</strong> - Simular configuração
                  <p className="text-xs text-slate-600 mt-1">Ver quais usuários receberão permissões SEM modificar banco</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Badge className="bg-green-600 text-white flex-shrink-0">4</Badge>
                <div>
                  <strong>Executar Migrações REAIS</strong> - Aplicar correções
                  <p className="text-xs text-slate-600 mt-1">Threads primeiro, depois permissões</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Badge className="bg-orange-600 text-white flex-shrink-0">5</Badge>
                <div>
                  <strong>Validar em Comunicação</strong> - Testar visibilidade
                  <p className="text-xs text-slate-600 mt-1">Verificar se threads aparecem corretamente na barra de contatos</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Rodapé */}
        <div className="text-center text-xs text-slate-500 pt-4 border-t">
          <p>📚 Documentação completa: <code className="bg-slate-200 px-1 rounded">ARQUITETURA_UNIVERSAL_VISIBILIDADE_THREADS.md</code></p>
          <p className="mt-1">⚠️ Sempre execute DRY-RUN antes de aplicar alterações reais</p>
        </div>
      </div>
    </div>
  );
}