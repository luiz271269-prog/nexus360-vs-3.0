import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Search, Eye, EyeOff, Database } from 'lucide-react';
import { canUserSeeThreadBase, canUserSeeThreadWithFilters } from '../lib/threadVisibility';

export default function DiagnosticoThreadsInvisiveis({ usuario, filtros, threads, contatos }) {
  const [analise, setAnalise] = useState(null);
  const [loading, setLoading] = useState(false);

  const executarDiagnostico = async () => {
    if (!usuario) return;
    
    setLoading(true);
    try {
      // 1. Buscar TODAS as threads recentes (últimas 24h)
      const now = new Date();
      const ontem = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const todasThreads = await base44.entities.MessageThread.filter(
        {},
        '-last_message_at',
        200
      );

      // 2. Filtrar threads com mensagens nas últimas 24h
      const threadsRecentes = todasThreads.filter(t => {
        const lastMsg = new Date(t.last_message_at || 0);
        return lastMsg > ontem && t.thread_type === 'contact_external';
      });

      console.log('[DIAGNÓSTICO] Threads recentes:', threadsRecentes.length);

      // 3. Analisar cada thread
      const contatosMap = new Map(contatos.map(c => [c.id, c]));
      const analiseThreads = threadsRecentes.map(thread => {
        const contato = contatosMap.get(thread.contact_id);
        const threadComContato = { ...thread, contato };
        
        // Testar visibilidade base
        const visivelBase = canUserSeeThreadBase(usuario, threadComContato);
        
        // Testar visibilidade com filtros
        const visivelComFiltros = canUserSeeThreadWithFilters(usuario, threadComContato, filtros);
        
        // Verificar se está na lista atual
        const naListaAtual = threads.some(t => t.id === thread.id);
        
        // Diagnóstico detalhado
        const motivos = [];
        if (!contato) motivos.push('❌ Contato não encontrado');
        if (!visivelBase) motivos.push('❌ Bloqueado por visibilidade base');
        if (visivelBase && !visivelComFiltros) motivos.push('⚠️ Bloqueado por filtros ativos');
        if (!thread.last_message_at) motivos.push('⚠️ Sem last_message_at');
        if (thread.status === 'merged') motivos.push('🔀 Thread merged');
        
        return {
          thread,
          contato,
          visivelBase,
          visivelComFiltros,
          naListaAtual,
          motivos,
          shouldBeVisible: visivelBase && visivelComFiltros && contato && !thread.merged_into
        };
      });

      // 4. Separar threads
      const invisiveis = analiseThreads.filter(a => a.shouldBeVisible && !a.naListaAtual);
      const visiveis = analiseThreads.filter(a => a.naListaAtual);
      const bloqueadas = analiseThreads.filter(a => !a.shouldBeVisible);

      setAnalise({
        total: threadsRecentes.length,
        invisiveis,
        visiveis,
        bloqueadas,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[DIAGNÓSTICO] Erro:', error);
      setAnalise({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Diagnóstico de Threads Invisíveis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={executarDiagnostico} disabled={loading}>
            {loading ? 'Analisando...' : 'Executar Diagnóstico'}
          </Button>
        </div>

        {analise && (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-4 gap-2">
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold">{analise.total}</div>
                  <div className="text-xs text-slate-500">Total 24h</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-green-600">{analise.visiveis?.length || 0}</div>
                  <div className="text-xs text-slate-500">Visíveis ✓</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-red-600">{analise.invisiveis?.length || 0}</div>
                  <div className="text-xs text-slate-500">Invisíveis ❌</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="text-2xl font-bold text-slate-400">{analise.bloqueadas?.length || 0}</div>
                  <div className="text-xs text-slate-500">Bloqueadas</div>
                </CardContent>
              </Card>
            </div>

            {/* Threads Invisíveis (PROBLEMA) */}
            {analise.invisiveis && analise.invisiveis.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-red-600 flex items-center gap-2">
                  <EyeOff className="w-4 h-4" />
                  ❌ Threads Invisíveis (Deveriam Aparecer)
                </h3>
                {analise.invisiveis.map((item, idx) => (
                  <Card key={idx} className="border-red-500">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold">{item.contato?.nome || 'Sem nome'}</div>
                          <div className="text-xs text-slate-500">ID: {item.thread.id}</div>
                          <div className="text-xs">Telefone: {item.contato?.telefone}</div>
                        </div>
                        <Badge variant="destructive">INVISÍVEL</Badge>
                      </div>
                      
                      {/* Detalhes */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="font-semibold">Última msg:</span> {new Date(item.thread.last_message_at).toLocaleString('pt-BR')}
                        </div>
                        <div>
                          <span className="font-semibold">Não lidas:</span> {item.thread.unread_count || 0}
                        </div>
                        <div>
                          <span className="font-semibold">Integração:</span> {item.thread.whatsapp_integration_id?.substring(0, 8)}
                        </div>
                        <div>
                          <span className="font-semibold">Status:</span> {item.thread.status}
                        </div>
                        {item.thread.assigned_user_id && (
                          <div className="col-span-2">
                            <span className="font-semibold">Atribuído:</span> {item.thread.assigned_user_id.substring(0, 8)}
                          </div>
                        )}
                      </div>

                      {/* Diagnóstico */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          {item.visivelBase ? <CheckCircle className="w-3 h-3 text-green-600" /> : <AlertCircle className="w-3 h-3 text-red-600" />}
                          Visibilidade Base: {item.visivelBase ? 'OK' : 'BLOQUEADO'}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {item.visivelComFiltros ? <CheckCircle className="w-3 h-3 text-green-600" /> : <AlertCircle className="w-3 h-3 text-red-600" />}
                          Visibilidade + Filtros: {item.visivelComFiltros ? 'OK' : 'BLOQUEADO'}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {item.contato ? <CheckCircle className="w-3 h-3 text-green-600" /> : <AlertCircle className="w-3 h-3 text-red-600" />}
                          Contato Encontrado: {item.contato ? 'SIM' : 'NÃO'}
                        </div>
                      </div>

                      {/* Motivos */}
                      {item.motivos.length > 0 && (
                        <div className="bg-red-50 p-2 rounded text-xs space-y-1">
                          <div className="font-semibold">Possíveis causas:</div>
                          {item.motivos.map((m, i) => (
                            <div key={i}>{m}</div>
                          ))}
                        </div>
                      )}

                      {/* Preview da mensagem */}
                      <div className="bg-slate-50 p-2 rounded text-xs">
                        <div className="font-semibold">Última mensagem:</div>
                        <div className="truncate">{item.thread.last_message_content || '(vazio)'}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Threads Visíveis (OK) */}
            {analise.visiveis && analise.visiveis.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-bold text-green-600 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  ✅ Threads Visíveis (OK)
                </h3>
                <div className="text-xs text-slate-500">
                  {analise.visiveis.length} threads aparecendo corretamente
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}