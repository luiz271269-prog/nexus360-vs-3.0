import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bug, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Database,
  GitMerge,
  Search,
  Zap,
  FileCode,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DiagnosticoCirurgico() {
  const [loading, setLoading] = useState(false);
  const [resultadoSchema, setResultadoSchema] = useState(null);
  const [resultadoAuditoria, setResultadoAuditoria] = useState(null);
  const [resultadoConsolidacao, setResultadoConsolidacao] = useState(null);
  const [dryRun, setDryRun] = useState(true);

  const validarSchema = async () => {
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('validarSchema', {});
      setResultadoSchema(data.resultado);
      
      if (data.resultado.schema_valido) {
        toast.success('✅ Schema válido!');
      } else {
        toast.error('❌ Schema com problemas');
      }
    } catch (error) {
      toast.error('Erro ao validar schema: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const executarAuditoria = async () => {
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('auditoriaDuplicatas', {});
      setResultadoAuditoria(data.resultado);
      
      const total = data.resultado.contatos_duplicados.length + data.resultado.threads_duplicadas.length;
      if (total === 0) {
        toast.success('✅ Nenhuma duplicata encontrada!');
      } else {
        toast.warning(`⚠️ ${total} problemas encontrados`);
      }
    } catch (error) {
      toast.error('Erro na auditoria: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const executarConsolidacao = async (isDryRun) => {
    setLoading(true);
    setDryRun(isDryRun);
    
    try {
      const { data } = await base44.functions.invoke('consolidarHistorico', { dry_run: isDryRun });
      setResultadoConsolidacao(data.resultado);
      
      if (isDryRun) {
        toast.info('📋 Simulação concluída');
      } else {
        toast.success(`✅ Consolidação executada! ${data.resultado.threads_marcadas_merged} threads unificadas`);
      }
    } catch (error) {
      toast.error('Erro na consolidação: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <Bug className="w-7 h-7 text-white" />
              </div>
              Diagnóstico Cirúrgico
            </h1>
            <p className="text-slate-600 mt-2">
              Validação de schema, auditoria de duplicatas e consolidação histórica
            </p>
          </div>
          
          <Button
            onClick={() => {
              setResultadoSchema(null);
              setResultadoAuditoria(null);
              setResultadoConsolidacao(null);
            }}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Limpar
          </Button>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-2 border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Validar Schema
              </CardTitle>
              <CardDescription>
                Testa se campos críticos persistem no banco
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={validarSchema} 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span className="ml-2">Validar Agora</span>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200 bg-orange-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-5 h-5 text-orange-600" />
                Auditar Duplicatas
              </CardTitle>
              <CardDescription>
                Varre o banco procurando contatos e threads duplicadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={executarAuditoria} 
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-2">Auditar Agora</span>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-green-600" />
                Consolidar Histórico
              </CardTitle>
              <CardDescription>
                Unifica threads duplicadas (marca como merged)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                onClick={() => executarConsolidacao(true)} 
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading && dryRun ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />}
                <span className="ml-2">Simular</span>
              </Button>
              <Button 
                onClick={() => executarConsolidacao(false)} 
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {loading && !dryRun ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                <span className="ml-2">Executar</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Resultados */}
        <Tabs defaultValue="schema" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schema">Validação Schema</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
            <TabsTrigger value="consolidacao">Consolidação</TabsTrigger>
          </TabsList>

          {/* TAB: Schema */}
          <TabsContent value="schema" className="space-y-4">
            {resultadoSchema ? (
              <>
                <Alert className={resultadoSchema.schema_valido ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
                  <AlertDescription className="flex items-center gap-2">
                    {resultadoSchema.schema_valido ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-900">{resultadoSchema.conclusao}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <span className="font-semibold text-red-900">{resultadoSchema.conclusao}</span>
                      </>
                    )}
                  </AlertDescription>
                </Alert>

                {resultadoSchema.campos_ok.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm text-green-700">✅ Campos OK</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {resultadoSchema.campos_ok.map((campo) => (
                          <Badge key={campo} className="bg-green-100 text-green-800">
                            {campo}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {resultadoSchema.campos_faltando.length > 0 && (
                  <Card className="border-red-200">
                    <CardHeader>
                      <CardTitle className="text-sm text-red-700">❌ Campos com Problema</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {resultadoSchema.campos_faltando.map((campo, idx) => (
                          <div key={idx} className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                            {campo}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Testes Executados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {resultadoSchema.testes.map((teste, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                          <span className="font-medium">{teste.etapa}</span>
                          <Badge className={teste.status === 'sucesso' ? 'bg-green-500' : 'bg-red-500'}>
                            {teste.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Execute a validação de schema para ver resultados
              </div>
            )}
          </TabsContent>

          {/* TAB: Auditoria */}
          <TabsContent value="auditoria" className="space-y-4">
            {resultadoAuditoria ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-slate-900">
                        {resultadoAuditoria.estatisticas.contatos_duplicados}
                      </div>
                      <div className="text-sm text-slate-600">Contatos Duplicados</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-slate-900">
                        {resultadoAuditoria.estatisticas.threads_duplicadas}
                      </div>
                      <div className="text-sm text-slate-600">Threads Duplicadas</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-orange-600">
                        {resultadoAuditoria.threads_sem_canonical.length}
                      </div>
                      <div className="text-sm text-slate-600">Sem is_canonical</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">
                        {resultadoAuditoria.threads_merged_sem_destino.length}
                      </div>
                      <div className="text-sm text-slate-600">Merged Inválidas</div>
                    </CardContent>
                  </Card>
                </div>

                {resultadoAuditoria.contatos_duplicados.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">📞 Contatos Duplicados por Telefone</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {resultadoAuditoria.contatos_duplicados.map((dup, idx) => (
                          <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="font-semibold text-red-900">
                              {dup.telefone} ({dup.quantidade}x)
                            </div>
                            <div className="mt-2 space-y-1">
                              {dup.contatos.map((c) => (
                                <div key={c.id} className="text-xs font-mono text-slate-600 flex items-center gap-2">
                                  <span className="text-slate-400">{c.id.substring(0, 8)}</span>
                                  <span>{c.nome}</span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {new Date(c.created_date).toLocaleDateString()}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {resultadoAuditoria.threads_duplicadas.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">💬 Threads Duplicadas por Contact</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {resultadoAuditoria.threads_duplicadas.slice(0, 20).map((dup, idx) => (
                          <div key={idx} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-orange-900">
                                Contact: {dup.contact_id.substring(0, 8)}
                              </span>
                              <div className="flex gap-2">
                                <Badge className="bg-blue-100 text-blue-800">{dup.quantidade} threads</Badge>
                                <Badge className="bg-green-100 text-green-800">{dup.canonicas} canônicas</Badge>
                                <Badge className="bg-purple-100 text-purple-800">{dup.merged} merged</Badge>
                              </div>
                            </div>
                            <div className="mt-2 space-y-1">
                              {dup.threads.map((t) => (
                                <div key={t.id} className="text-xs font-mono text-slate-600 flex items-center gap-2">
                                  <span className="text-slate-400">{t.id.substring(0, 8)}</span>
                                  {t.is_canonical && <Badge className="bg-green-500 text-white text-[10px]">CANONICAL</Badge>}
                                  {t.status === 'merged' && <Badge className="bg-purple-500 text-white text-[10px]">MERGED</Badge>}
                                  <span className="text-slate-500">→ {t.whatsapp_integration_id?.substring(0, 8) || 'sem int'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Execute a auditoria para identificar duplicatas
              </div>
            )}
          </TabsContent>

          {/* TAB: Consolidação */}
          <TabsContent value="consolidacao" className="space-y-4">
            {resultadoConsolidacao ? (
              <>
                <Alert className={resultadoConsolidacao.dry_run ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'}>
                  <AlertDescription className="flex items-center gap-2">
                    {resultadoConsolidacao.dry_run ? (
                      <>
                        <FileCode className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-blue-900">
                          Simulação - Nenhuma alteração foi feita no banco
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-900">
                          Consolidação Executada - Banco de dados atualizado
                        </span>
                      </>
                    )}
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-slate-900">
                        {resultadoConsolidacao.estatisticas.grupos_processados}
                      </div>
                      <div className="text-sm text-slate-600">Contatos Processados</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">
                        {resultadoConsolidacao.estatisticas.threads_marcadas_canonical}
                      </div>
                      <div className="text-sm text-slate-600">Marcadas Canônicas</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-purple-600">
                        {resultadoConsolidacao.estatisticas.threads_marcadas_merged}
                      </div>
                      <div className="text-sm text-slate-600">Marcadas Merged</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">
                        {resultadoConsolidacao.estatisticas.erros_total}
                      </div>
                      <div className="text-sm text-slate-600">Erros</div>
                    </CardContent>
                  </Card>
                </div>

                {resultadoConsolidacao.detalhes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Detalhes do Processamento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {resultadoConsolidacao.detalhes.slice(0, 50).map((det, idx) => (
                          <div key={idx} className="text-xs p-2 bg-slate-50 rounded border border-slate-200">
                            <div className="font-semibold text-slate-700">
                              Contact: {det.contact_id?.substring(0, 8)}
                            </div>
                            {det.acao === 'consolidacao' && (
                              <div className="mt-1 space-y-1">
                                <div className="text-green-600">
                                  ✅ Canônica: {det.canonical_id?.substring(0, 8)}
                                </div>
                                <div className="text-purple-600">
                                  🔀 Merged: {det.duplicadas_ids?.length || 0} threads
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!resultadoConsolidacao.dry_run && resultadoConsolidacao.threads_marcadas_merged > 0 && (
                  <Alert className="border-green-500 bg-green-50">
                    <AlertDescription className="text-green-900">
                      ✅ Consolidação concluída! As threads antigas foram marcadas como "merged" e não aparecerão mais na listagem.
                      Atualize a página de Comunicação para ver o resultado.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Execute a consolidação (simulação ou real) para ver resultados
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}