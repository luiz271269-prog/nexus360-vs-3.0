import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { canUserSeeThreadBase, canUserSeeThreadWithFilters, isNaoAtribuida } from '../lib/threadVisibility';
import { matchBuscaGoogle } from '../lib/searchUtils';

export default function DiagnosticoComparativoThreads({ 
  usuario, 
  filtros, 
  contatos, 
  duplicataEncontrada,
  threadsUnicas,
  threadsNaoAtribuidasVisiveis 
}) {
  const [threadId1, setThreadId1] = useState('');
  const [threadId2, setThreadId2] = useState('');
  const [comparacao, setComparacao] = useState(null);
  const [loading, setLoading] = useState(false);

  const analisarThread = async (threadId) => {
    try {
      // Buscar thread do banco
      const threadsDB = await base44.entities.MessageThread.filter({ id: threadId }, '-created_date', 1);
      if (!threadsDB || threadsDB.length === 0) {
        return { erro: 'Thread não encontrada no banco' };
      }

      const thread = threadsDB[0];
      const contato = contatos.find(c => c.id === thread.contact_id);
      const threadComContato = { ...thread, contato };

      // Testar cada etapa do filtro
      const etapas = {
        // 1. Dados básicos
        existeNoBanco: true,
        temContato: !!contato,
        
        // 2. Top 500?
        estaNoTop500: threadsUnicas?.some(t => t.id === threadId) || false,
        
        // 3. Deduplicação
        ignoradoPorDuplicata: false,
        motivoDuplicata: null,
        
        // 4. Visibilidade base
        passaVisibilidadeBase: canUserSeeThreadBase(usuario, threadComContato),
        
        // 5. Visibilidade com filtros
        passaVisibilidadeComFiltros: canUserSeeThreadWithFilters(usuario, threadComContato, filtros),
        
        // 6. Filtro "não atribuídas"
        passaFiltroNaoAtribuidas: true,
        
        // 7. Filtros adicionais
        passaFiltroIntegracao: true,
        passaFiltroTipoContato: true,
        passaFiltroTag: true,
        
        // Resultado final
        deveriaMostrar: false,
        motivoBloqueio: []
      };

      // Análise de deduplicação
      if (duplicataEncontrada && duplicataEncontrada.principal) {
        const contatoPrincipalId = duplicataEncontrada.principal.id;
        if (thread.contact_id && thread.contact_id !== contatoPrincipalId) {
          etapas.ignoradoPorDuplicata = true;
          etapas.motivoDuplicata = `Contato não é o principal (principal: ${contatoPrincipalId})`;
          etapas.motivoBloqueio.push('🔀 Filtrado por duplicataEncontrada');
        }
      }

      // Análise filtro "não atribuídas"
      if (filtros.scope === 'unassigned') {
        if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
          etapas.passaFiltroNaoAtribuidas = false;
          etapas.motivoBloqueio.push('❌ Thread interna não entra em "não atribuídas"');
        } else if (!threadsNaoAtribuidasVisiveis?.has(thread.id)) {
          etapas.passaFiltroNaoAtribuidas = false;
          etapas.motivoBloqueio.push('❌ Não está no Set de não atribuídas visíveis');
        }
      }

      // Análise filtro integração
      if (filtros.integracaoId && filtros.integracaoId !== 'all') {
        if (thread.whatsapp_integration_id !== filtros.integracaoId) {
          etapas.passaFiltroIntegracao = false;
          etapas.motivoBloqueio.push(`❌ Integração diferente (esperado: ${filtros.integracaoId})`);
        }
      }

      // Análise filtro tipo contato
      if (filtros.tipoContato && filtros.tipoContato !== 'all' && contato) {
        if (contato.tipo_contato !== filtros.tipoContato) {
          etapas.passaFiltroTipoContato = false;
          etapas.motivoBloqueio.push(`❌ Tipo contato diferente (esperado: ${filtros.tipoContato}, atual: ${contato.tipo_contato})`);
        }
      }

      // Análise filtro tag
      if (filtros.tagContato && filtros.tagContato !== 'all' && contato) {
        const tags = contato.tags || [];
        if (!tags.includes(filtros.tagContato)) {
          etapas.passaFiltroTag = false;
          etapas.motivoBloqueio.push(`❌ Tag não encontrada (esperado: ${filtros.tagContato})`);
        }
      }

      // Resultado final
      etapas.deveriaMostrar = 
        etapas.existeNoBanco &&
        etapas.temContato &&
        etapas.estaNoTop500 &&
        !etapas.ignoradoPorDuplicata &&
        etapas.passaVisibilidadeBase &&
        etapas.passaVisibilidadeComFiltros &&
        etapas.passaFiltroNaoAtribuidas &&
        etapas.passaFiltroIntegracao &&
        etapas.passaFiltroTipoContato &&
        etapas.passaFiltroTag;

      if (!etapas.deveriaMostrar && etapas.motivoBloqueio.length === 0) {
        etapas.motivoBloqueio.push('⚠️ Bloqueio desconhecido');
      }

      return {
        thread,
        contato,
        etapas
      };

    } catch (error) {
      return { erro: error.message };
    }
  };

  const executarComparacao = async () => {
    if (!threadId1 || !threadId2) {
      return;
    }

    setLoading(true);
    try {
      const [analise1, analise2] = await Promise.all([
        analisarThread(threadId1),
        analisarThread(threadId2)
      ]);

      setComparacao({ thread1: analise1, thread2: analise2 });
    } catch (error) {
      console.error('[COMPARATIVO] Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = ({ status }) => {
    if (status) return <CheckCircle className="w-4 h-4 text-green-600" />;
    return <XCircle className="w-4 h-4 text-red-600" />;
  };

  const ThreadCard = ({ analise, label }) => {
    if (!analise) return null;
    
    if (analise.erro) {
      return (
        <Card className="border-red-500">
          <CardContent className="p-4">
            <Badge variant="destructive">Erro</Badge>
            <div className="text-sm mt-2">{analise.erro}</div>
          </CardContent>
        </Card>
      );
    }

    const { thread, contato, etapas } = analise;

    return (
      <Card className={etapas.deveriaMostrar ? 'border-green-500' : 'border-red-500'}>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            {label}
            <Badge variant={etapas.deveriaMostrar ? 'default' : 'destructive'}>
              {etapas.deveriaMostrar ? '✅ VISÍVEL' : '❌ INVISÍVEL'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {/* Informações básicas */}
          <div className="bg-slate-50 p-2 rounded space-y-1">
            <div><span className="font-semibold">Thread ID:</span> {thread.id}</div>
            <div><span className="font-semibold">Contato:</span> {contato?.nome || 'Não encontrado'}</div>
            <div><span className="font-semibold">Telefone:</span> {contato?.telefone || 'N/A'}</div>
            <div><span className="font-semibold">Tipo:</span> {contato?.tipo_contato || 'N/A'}</div>
            <div><span className="font-semibold">Tags:</span> {contato?.tags?.join(', ') || 'Nenhuma'}</div>
            <div><span className="font-semibold">Integração:</span> {thread.whatsapp_integration_id?.substring(0, 12)}...</div>
            <div><span className="font-semibold">Não lidas:</span> {thread.unread_count || 0}</div>
            <div><span className="font-semibold">Status:</span> {thread.status}</div>
          </div>

          {/* Análise de etapas */}
          <div className="space-y-2">
            <div className="font-semibold text-slate-700">Análise de Filtros:</div>
            
            <div className="flex items-center gap-2">
              <StatusIcon status={etapas.existeNoBanco} />
              <span>Existe no Banco</span>
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon status={etapas.temContato} />
              <span>Tem Contato</span>
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon status={etapas.estaNoTop500} />
              <span>Está no Top 500 (threadsUnicas)</span>
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon status={!etapas.ignoradoPorDuplicata} />
              <span>Não ignorado por duplicata</span>
              {etapas.motivoDuplicata && (
                <div className="text-[10px] text-red-600 ml-2">{etapas.motivoDuplicata}</div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon status={etapas.passaVisibilidadeBase} />
              <span>Passa Visibilidade Base</span>
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon status={etapas.passaVisibilidadeComFiltros} />
              <span>Passa Visibilidade + Filtros</span>
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon status={etapas.passaFiltroNaoAtribuidas} />
              <span>Passa Filtro Não Atribuídas</span>
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon status={etapas.passaFiltroIntegracao} />
              <span>Passa Filtro Integração</span>
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon status={etapas.passaFiltroTipoContato} />
              <span>Passa Filtro Tipo Contato</span>
            </div>

            <div className="flex items-center gap-2">
              <StatusIcon status={etapas.passaFiltroTag} />
              <span>Passa Filtro Tag</span>
            </div>
          </div>

          {/* Motivos de bloqueio */}
          {etapas.motivoBloqueio.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-2 rounded space-y-1">
              <div className="font-semibold text-red-700">🚫 Motivos do Bloqueio:</div>
              {etapas.motivoBloqueio.map((motivo, idx) => (
                <div key={idx} className="text-red-600">{motivo}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Card className="border-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔬 Diagnóstico Comparativo de Threads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold block mb-1">Thread 1 (que aparece)</label>
            <Input
              placeholder="ID da thread visível"
              value={threadId1}
              onChange={(e) => setThreadId1(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">Thread 2 (que não aparece)</label>
            <Input
              placeholder="ID da thread invisível"
              value={threadId2}
              onChange={(e) => setThreadId2(e.target.value)}
            />
          </div>
        </div>

        {/* Contexto Atual */}
        <div className="bg-blue-50 border border-blue-200 p-3 rounded text-xs space-y-1">
          <div className="font-semibold text-blue-700">📊 Contexto Atual:</div>
          <div><span className="font-semibold">Usuário:</span> {usuario?.full_name} ({usuario?.role})</div>
          <div><span className="font-semibold">Scope:</span> {filtros.scope}</div>
          <div><span className="font-semibold">Integração filtro:</span> {filtros.integracaoId || 'all'}</div>
          <div><span className="font-semibold">Atendente filtro:</span> {filtros.atendenteId || 'nenhum'}</div>
          <div>
            <span className="font-semibold">Duplicata detectada:</span>{' '}
            {duplicataEncontrada ? (
              <span className="text-orange-600">
                SIM - Principal: {duplicataEncontrada.principal?.nome} ({duplicataEncontrada.quantidade} contatos)
              </span>
            ) : (
              'NÃO'
            )}
          </div>
          <div><span className="font-semibold">Threads únicas (top 500):</span> {threadsUnicas?.length || 0}</div>
          <div><span className="font-semibold">Não atribuídas visíveis:</span> {threadsNaoAtribuidasVisiveis?.size || 0}</div>
        </div>

        <Button onClick={executarComparacao} disabled={loading || !threadId1 || !threadId2}>
          {loading ? 'Analisando...' : 'Comparar Threads'}
        </Button>

        {/* Resultado da Comparação */}
        {comparacao && (
          <div className="grid grid-cols-2 gap-4">
            <ThreadCard analise={comparacao.thread1} label="Thread 1" />
            
            <ThreadCard analise={comparacao.thread2} label="Thread 2" />
          </div>
        )}

        {/* Diferenças Detectadas */}
        {comparacao && comparacao.thread1?.etapas && comparacao.thread2?.etapas && (
          <Card className="border-purple-500">
            <CardHeader>
              <CardTitle className="text-sm">🎯 Diferenças Detectadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {Object.keys(comparacao.thread1.etapas).map((chave) => {
                const val1 = comparacao.thread1.etapas[chave];
                const val2 = comparacao.thread2.etapas[chave];
                
                if (typeof val1 === 'boolean' && val1 !== val2) {
                  return (
                    <div key={chave} className="flex items-center gap-2 bg-purple-50 p-2 rounded">
                      <AlertCircle className="w-4 h-4 text-purple-600" />
                      <span className="font-semibold">{chave}:</span>
                      <Badge variant={val1 ? 'default' : 'destructive'}>{val1 ? '✓' : '✗'}</Badge>
                      <ArrowRight className="w-3 h-3" />
                      <Badge variant={val2 ? 'default' : 'destructive'}>{val2 ? '✓' : '✗'}</Badge>
                    </div>
                  );
                }
                return null;
              })}
              
              {/* Comparar dados das threads */}
              {comparacao.thread1.thread && comparacao.thread2.thread && (
                <>
                  {comparacao.thread1.thread.contact_id !== comparacao.thread2.thread.contact_id && (
                    <div className="bg-yellow-50 p-2 rounded">
                      <span className="font-semibold">📱 Contatos diferentes:</span>
                      <div>Thread 1: {comparacao.thread1.contato?.nome}</div>
                      <div>Thread 2: {comparacao.thread2.contato?.nome}</div>
                    </div>
                  )}
                  
                  {comparacao.thread1.thread.whatsapp_integration_id !== comparacao.thread2.thread.whatsapp_integration_id && (
                    <div className="bg-yellow-50 p-2 rounded">
                      <span className="font-semibold">📡 Integrações diferentes:</span>
                      <div>Thread 1: {comparacao.thread1.thread.whatsapp_integration_id?.substring(0, 12)}</div>
                      <div>Thread 2: {comparacao.thread2.thread.whatsapp_integration_id?.substring(0, 12)}</div>
                    </div>
                  )}

                  {comparacao.thread1.thread.assigned_user_id !== comparacao.thread2.thread.assigned_user_id && (
                    <div className="bg-yellow-50 p-2 rounded">
                      <span className="font-semibold">👤 Atribuições diferentes:</span>
                      <div>Thread 1: {comparacao.thread1.thread.assigned_user_id || 'não atribuída'}</div>
                      <div>Thread 2: {comparacao.thread2.thread.assigned_user_id || 'não atribuída'}</div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}