import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function DiagnosticoMensagensInternas() {
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const analisarMensagensInternas = async () => {
    setAnalisando(true);
    setResultado(null);

    try {
      // Buscar usuário atual
      const usuario = await base44.auth.me();
      
      // Buscar threads internas
      const threadsInternas = await base44.entities.MessageThread.filter(
        {
          thread_type: { $in: ['team_internal', 'sector_group'] }
        },
        '-last_message_at',
        50
      );

      console.log(`📊 [DIAGNÓSTICO] ${threadsInternas.length} threads internas encontradas`);

      // 🔍 BUSCAR MENSAGENS INTERNAS GLOBALMENTE (últimos 2 minutos)
      const doisMinutosAtras = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const mensagensRecentesInternas = await base44.entities.Message.filter(
        {
          channel: 'interno',
          sent_at: { $gte: doisMinutosAtras }
        },
        '-sent_at',
        100
      );

      console.log(`🔍 [DIAGNÓSTICO] ${mensagensRecentesInternas.length} mensagens internas nos últimos 2 minutos`);

      // Analisar cada thread
      const analise = [];

      for (const thread of threadsInternas.slice(0, 10)) {
        // Buscar TODAS as mensagens da thread (sem limite de tempo)
        const mensagens = await base44.entities.Message.filter(
          { thread_id: thread.id },
          '-sent_at',
          200
        );

        // 🔍 DIAGNÓSTICO CIRÚRGICO: Detectar mensagens órfãs (channel=interno mas thread_id não bate)
        const mensagensOrfas = mensagensRecentesInternas.filter(m => 
          m.thread_id !== thread.id && 
          thread.participants?.some(p => p === m.sender_id || p === m.recipient_id)
        );

        // Verificar permissão do usuário
        const isParticipant = thread.participants?.includes(usuario.id);
        const isAdmin = usuario.role === 'admin';
        const podeVer = isParticipant || isAdmin;

        // Contar mensagens por tipo
        const stats = {
          total: mensagens.length,
          porSenderType: mensagens.reduce((acc, m) => {
            acc[m.sender_type] = (acc[m.sender_type] || 0) + 1;
            return acc;
          }, {}),
          porChannel: mensagens.reduce((acc, m) => {
            acc[m.channel] = (acc[m.channel] || 0) + 1;
            return acc;
          }, {}),
          porVisibility: mensagens.reduce((acc, m) => {
            acc[m.visibility] = (acc[m.visibility] || 0) + 1;
            return acc;
          }, {}),
          comConteudo: mensagens.filter(m => m.content?.trim().length > 0).length,
          comMidia: mensagens.filter(m => m.media_url || m.media_type !== 'none').length,
          vazias: mensagens.filter(m => !m.content?.trim() && !m.media_url && m.media_type === 'none').length
        };

        analise.push({
          thread_id: thread.id,
          thread_type: thread.thread_type,
          sector_key: thread.sector_key,
          group_name: thread.group_name,
          participants: thread.participants,
          podeVer,
          isParticipant,
          isAdmin,
          stats,
          ultimas5: mensagens.slice(-5).map(m => ({
            id: m.id.substring(0, 8),
            sender_id: m.sender_id?.substring(0, 8),
            sender_type: m.sender_type,
            channel: m.channel,
            visibility: m.visibility,
            content: m.content?.substring(0, 50),
            media_type: m.media_type,
            sent_at: m.sent_at
          })),
          mensagensOrfas: mensagensOrfas.map(m => ({
            id: m.id.substring(0, 8),
            thread_id_salvo: m.thread_id?.substring(0, 8),
            sender_id: m.sender_id?.substring(0, 8),
            content: m.content?.substring(0, 50),
            sent_at: m.sent_at
          })),
          // 🔍 LOGS DETALHADOS das últimas 10 mensagens
          logsDetalhados: mensagens.slice(-10).map(m => ({
            id: m.id,
            thread_id: m.thread_id,
            sender_id: m.sender_id,
            sender_type: m.sender_type,
            recipient_id: m.recipient_id,
            recipient_type: m.recipient_type,
            channel: m.channel,
            visibility: m.visibility,
            content: m.content,
            media_type: m.media_type,
            media_url: m.media_url,
            status: m.status,
            sent_at: m.sent_at,
            created_date: m.created_date,
            metadata: m.metadata
          }))
        });
      }

      setResultado({
        usuario_atual: {
          id: usuario.id,
          email: usuario.email,
          role: usuario.role,
          sector: usuario.attendant_sector
        },
        total_threads: threadsInternas.length,
        mensagens_recentes_globais: mensagensRecentesInternas.length,
        analise
      });

      toast.success('✅ Análise concluída!');
    } catch (error) {
      console.error('[DIAGNÓSTICO] Erro:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <Card className="border-purple-200">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5 text-purple-600" />
          Diagnóstico de Mensagens Internas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <Button
          onClick={analisarMensagensInternas}
          disabled={analisando}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {analisando ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Analisar Mensagens Internas
            </>
          )}
        </Button>

        {resultado && (
          <div className="space-y-4">
            {/* Informações do Usuário */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">Usuário Atual:</h3>
              <div className="text-xs space-y-1">
                <p><strong>ID:</strong> {resultado.usuario_atual.id.substring(0, 12)}...</p>
                <p><strong>Email:</strong> {resultado.usuario_atual.email}</p>
                <p><strong>Role:</strong> <Badge>{resultado.usuario_atual.role}</Badge></p>
                <p><strong>Setor:</strong> {resultado.usuario_atual.sector || 'N/A'}</p>
              </div>
            </div>

            {/* Resumo Geral */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">Resumo:</h3>
              <p className="text-xs">
                <strong>{resultado.total_threads}</strong> threads internas encontradas no total
              </p>
              <p className="text-xs mt-1">
                Analisando <strong>{resultado.analise.length}</strong> threads mais recentes
              </p>
              <p className="text-xs mt-1">
                <strong>{resultado.mensagens_recentes_globais}</strong> mensagens internas enviadas nos últimos 2 minutos
              </p>
            </div>

            {/* Análise Detalhada */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Detalhes por Thread:</h3>
              {resultado.analise.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-mono text-slate-500">
                        Thread: {item.thread_id.substring(0, 12)}...
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.thread_type}
                        </Badge>
                        {item.sector_key && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">
                            {item.sector_key}
                          </Badge>
                        )}
                        {item.group_name && (
                          <span className="text-xs text-slate-600">"{item.group_name}"</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Status de Permissão */}
                    {item.podeVer ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">Visível</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">Invisível</span>
                      </div>
                    )}
                  </div>

                  {/* Permissões */}
                  <div className="text-xs space-y-1 bg-slate-50 rounded p-2">
                    <p>
                      <strong>É Participante:</strong>{' '}
                      {item.isParticipant ? (
                        <Badge className="bg-green-100 text-green-700">Sim</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700">Não</Badge>
                      )}
                    </p>
                    <p>
                      <strong>É Admin:</strong>{' '}
                      {item.isAdmin ? (
                        <Badge className="bg-blue-100 text-blue-700">Sim</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700">Não</Badge>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Participantes ({item.participants?.length || 0}):{' '}
                      {item.participants?.map(p => p.substring(0, 8)).join(', ') || 'N/A'}
                    </p>
                  </div>

                  {/* Estatísticas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 rounded p-2">
                      <p className="text-[10px] text-blue-600 font-semibold mb-1">Mensagens</p>
                      <p className="text-lg font-bold text-blue-700">{item.stats.total}</p>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <p className="text-[10px] text-green-600 font-semibold mb-1">Com Conteúdo</p>
                      <p className="text-lg font-bold text-green-700">{item.stats.comConteudo}</p>
                    </div>
                    <div className="bg-purple-50 rounded p-2">
                      <p className="text-[10px] text-purple-600 font-semibold mb-1">Com Mídia</p>
                      <p className="text-lg font-bold text-purple-700">{item.stats.comMidia}</p>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <p className="text-[10px] text-red-600 font-semibold mb-1">Vazias</p>
                      <p className="text-lg font-bold text-red-700">{item.stats.vazias}</p>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="text-xs space-y-2">
                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Por sender_type:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(item.stats.porSenderType).map(([tipo, count]) => (
                          <Badge key={tipo} variant="outline" className="text-xs">
                            {tipo}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Por channel:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(item.stats.porChannel).map(([canal, count]) => (
                          <Badge key={canal} variant="outline" className="text-xs">
                            {canal}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Por visibility:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(item.stats.porVisibility).map(([vis, count]) => (
                          <Badge key={vis} variant="outline" className="text-xs">
                            {vis}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Mensagens Órfãs (channel=interno mas thread_id diferente) */}
                  {item.mensagensOrfas?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="font-semibold text-xs text-red-700 mb-2">
                        ⚠️ Mensagens Órfãs Detectadas ({item.mensagensOrfas.length}):
                      </p>
                      <p className="text-[10px] text-red-600 mb-2">
                        Estas mensagens foram enviadas para participantes desta thread, mas estão salvas com thread_id diferente
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {item.mensagensOrfas.map((msg, i) => (
                          <div key={i} className="text-[10px] font-mono bg-white p-1 rounded border border-red-300">
                            <span className="text-red-600">Msg: {msg.id}</span> |{' '}
                            <span className="text-orange-600">Thread salvo: {msg.thread_id_salvo}</span>
                            <div className="text-slate-600 mt-0.5 truncate">
                              "{msg.content}"
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Últimas 5 mensagens */}
                  <div>
                    <p className="font-semibold text-xs text-slate-700 mb-2">Últimas 5 mensagens:</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {item.ultimas5.map((msg, i) => (
                        <div key={i} className="text-[10px] font-mono bg-slate-50 p-1 rounded">
                          <span className="text-blue-600">{msg.id}</span> |{' '}
                          <span className="text-green-600">{msg.sender_type}</span> |{' '}
                          <span className="text-purple-600">{msg.channel}</span> |{' '}
                          <span className="text-orange-600">{msg.visibility}</span>
                          {msg.content && (
                            <div className="text-slate-600 mt-0.5 truncate">
                              "{msg.content}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 🔍 LOGS COMPLETOS (expansível) */}
                  <details className="bg-slate-50 rounded p-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900">
                      🔍 Ver Logs Completos das Últimas 10 Mensagens
                    </summary>
                    <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
                      {item.logsDetalhados?.map((log, i) => (
                        <div key={i} className="text-[9px] font-mono bg-white p-2 rounded border border-slate-200">
                          <div className="grid grid-cols-2 gap-1">
                            <div><strong>ID:</strong> {log.id.substring(0, 12)}...</div>
                            <div><strong>Thread:</strong> {log.thread_id.substring(0, 12)}...</div>
                            <div><strong>Sender:</strong> {log.sender_id?.substring(0, 12) || 'N/A'}</div>
                            <div><strong>Type:</strong> <Badge variant="outline">{log.sender_type}</Badge></div>
                            <div><strong>Channel:</strong> <Badge>{log.channel}</Badge></div>
                            <div><strong>Visibility:</strong> <Badge>{log.visibility}</Badge></div>
                            <div><strong>Status:</strong> {log.status}</div>
                            <div><strong>Media:</strong> {log.media_type}</div>
                          </div>
                          {log.content && (
                            <div className="mt-1 p-1 bg-slate-100 rounded text-slate-700">
                              <strong>Conteúdo:</strong> "{log.content.substring(0, 100)}"
                            </div>
                          )}
                          {log.media_url && (
                            <div className="mt-1 text-blue-600 truncate">
                              <strong>URL:</strong> {log.media_url.substring(0, 60)}...
                            </div>
                          )}
                          <div className="mt-1 text-slate-500">
                            <strong>Enviado:</strong> {log.sent_at || log.created_date}
                          </div>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <details className="mt-1">
                              <summary className="text-purple-600 cursor-pointer">Ver Metadata</summary>
                              <pre className="text-[8px] bg-slate-100 p-1 rounded mt-1 overflow-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}