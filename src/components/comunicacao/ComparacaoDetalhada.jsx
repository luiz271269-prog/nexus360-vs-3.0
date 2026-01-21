import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle, CheckCircle2, Database, Eye, EyeOff, Users,
  MessageSquare, Info, Phone, Zap, TrendingDown, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Comparação Detalhada REORGANIZADA
 * - Foco em PROBLEMAS CRÍTICOS apenas
 * - Agrupa por tipo de issue
 * - Exclui registros sem valor (Desconhecido)
 */
export default function ComparacaoDetalhada({ simulationResults, contatos, threads, integracoes = [] }) {
  const [expandedIssue, setExpandedIssue] = useState(null);

  if (!simulationResults) {
    return (
      <Card className="border-slate-300">
        <CardContent className="pt-6 text-center text-slate-500">
          Nenhuma análise executada. Execute a simulação primeiro.
        </CardContent>
      </Card>
    );
  }

  const { stats } = simulationResults;

  // ════════════════════════════════════════════════════════════
  // 📊 CATEGORIAS DE PROBLEMAS DETECTADOS
  // ════════════════════════════════════════════════════════════

  const issues = [
    {
      id: 'duplicatas',
      titulo: '👥 Contatos Duplicados',
      icon: Users,
      color: 'red',
      count: simulationResults.duplicatas?.length || 0,
      descricao: 'Contatos com mesmo telefone fragmentados em threads diferentes',
      items: simulationResults.duplicatas?.map(dup => ({
        telefone: dup.telefone,
        contatos: dup.contactIds.length,
        threads: dup.threadIds.length,
        contactIds: dup.contactIds,
        threadIds: dup.threadIds
      })) || []
    },
    {
      id: 'sem_contato',
      titulo: '❌ Sem Contato Válido',
      icon: AlertTriangle,
      color: 'red',
      count: simulationResults.threadsSemContato?.length || 0,
      descricao: 'Threads sem contact_id ou contato não encontrado no banco',
      items: simulationResults.threadsSemContato?.map(item => ({
        threadId: item.threadId,
        motivo: item.motivo,
        tipo: item.thread?.thread_type
      })) || []
    },
    {
      id: 'contato_invalido',
      titulo: '⚠️ Contato com Telefone Inválido',
      icon: Phone,
      color: 'orange',
      count: simulationResults.threadsContatoInvalido?.length || 0,
      descricao: 'Contatos com telefone ausente ou inválido',
      items: simulationResults.threadsContatoInvalido?.map(item => ({
        contactId: item.contactId,
        contactNome: item.contato?.nome,
        telefone: item.telefone,
        motivo: item.motivo,
        threadId: item.threadId
      })) || []
    },
    {
      id: 'msg_suspeita',
      titulo: '🚨 Mensagens Suspeitas',
      icon: MessageSquare,
      color: 'orange',
      count: simulationResults.threadsMensagensSuspeitas?.length || 0,
      descricao: 'Threads com mensagens não lidas mas sem conteúdo recente',
      items: simulationResults.threadsMensagensSuspeitas?.map(item => ({
        threadId: item.threadId,
        contactId: item.contactId,
        contactNome: item.contato?.nome,
        unread: item.unread,
        motivo: item.motivo
      })) || []
    },
    {
      id: 'visibilidade',
      titulo: '👁️ Problemas de Visibilidade',
      icon: EyeOff,
      color: 'orange',
      count: simulationResults.mensagensComProblemaVisibilidade?.length || 0,
      descricao: 'Mensagens com campo visibility ausente ou inválido',
      items: simulationResults.mensagensComProblemaVisibilidade?.map(item => ({
        messageId: item.messageId,
        threadId: item.threadId,
        contactNome: item.contato?.nome,
        visibility: item.visibility,
        problemas: item.problemas
      })) || []
    },
    {
      id: 'divergencias',
      titulo: '⚖️ Divergências Legado vs Nexus360',
      icon: ArrowUpRight,
      color: 'amber',
      count: stats.divergencias,
      descricao: 'Threads com decisões diferentes entre os dois sistemas',
      items: simulationResults.resultados
        ?.filter(r => !r.isMatch && r.severity !== 'error')
        .slice(0, 10) || []
    }
  ];

  // Filtrar apenas issues com problemas
  const issuesAtivos = issues.filter(i => i.count > 0);

  return (
    <div className="space-y-4">
      {/* 🎯 RESUMO EXECUTIVO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-700 font-semibold">CRÍTICOS</p>
                <p className="text-2xl font-bold text-red-900">{stats.totalProblemas || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-700 font-semibold">DIVERGÊNCIAS</p>
                <p className="text-2xl font-bold text-amber-900">{stats.divergencias || 0}</p>
              </div>
              <Zap className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 font-semibold">MATCHES</p>
                <p className="text-2xl font-bold text-green-900">{stats.matches || 0}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 📋 ABAS DE PROBLEMAS */}
      {issuesAtivos.length > 0 ? (
        <Card>
          <Tabs defaultValue="duplicatas" className="w-full">
            <div className="border-b bg-slate-50 px-4 pt-4">
              <TabsList className="grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${issuesAtivos.length}, 1fr)` }}>
                {issuesAtivos.map(issue => (
                  <TabsTrigger key={issue.id} value={issue.id} className="text-xs gap-1">
                    <issue.icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{issue.count}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {issuesAtivos.map(issue => (
              <TabsContent key={issue.id} value={issue.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{issue.titulo}</h3>
                    <p className="text-sm text-slate-600">{issue.descricao}</p>
                  </div>
                  <Badge className={`bg-${issue.color}-600 text-white px-3 py-1`}>
                    {issue.count} {issue.count === 1 ? 'item' : 'itens'}
                  </Badge>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {issue.items.map((item, idx) => (
                    <IssueItem key={idx} issue={issue} item={item} contatos={contatos} threads={threads} />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      ) : (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">
            ✅ Nenhum problema crítico detectado!
          </AlertDescription>
        </Alert>
      )}

      {/* 💡 INSIGHTS */}
      <Card className="border-indigo-200 bg-indigo-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4" />
            Insights & Recomendações
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {stats.totalProblemas > 0 && (
            <p>🚨 <strong>{stats.totalProblemas} problemas críticos</strong> impedem ativação do Nexus360</p>
          )}
          {stats.divergencias > 0 && (
            <p>⚖️ <strong>{stats.divergencias} divergências</strong> entre legado e Nexus360 requerem revisão</p>
          )}
          {(simulationResults.duplicatas?.length || 0) > 0 && (
            <p>👥 Use o <strong>Consolidador de Threads</strong> para mesclar duplicatas</p>
          )}
          {stats.taxa_aderencia === 100 && (
            <p>✅ Aderência perfeita (100%) - Sistema pronto para migração</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Componente para renderizar cada item de problema
function IssueItem({ issue, item, contatos, threads }) {
  const thread = threads?.find(t => t.id === item.threadId);
  const contato = contatos?.find(c => c.id === item.contactId || c.id === item.contactIds?.[0]);

  return (
    <div className="border rounded-lg p-3 bg-slate-50 hover:bg-slate-100 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {/* Duplicatas */}
          {issue.id === 'duplicatas' && (
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                <Phone className="w-4 h-4" />
                {item.telefone}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {item.contatos} contatos em {item.threads} threads
              </p>
            </div>
          )}

          {/* Sem contato */}
          {issue.id === 'sem_contato' && (
            <div>
              <div className="font-semibold text-sm">Thread: {item.threadId?.substring(0, 12)}...</div>
              <p className="text-xs text-red-600 font-medium mt-1">⚠️ {item.motivo}</p>
            </div>
          )}

          {/* Contato inválido */}
          {issue.id === 'contato_invalido' && (
            <div>
              <div className="font-semibold text-sm">{item.contactNome || 'Sem nome'}</div>
              <p className="text-xs text-slate-600 mt-1">📱 Telefone: {item.telefone || '(vazio)'}</p>
              <p className="text-xs text-orange-600 font-medium">{item.motivo}</p>
            </div>
          )}

          {/* Mensagens suspeitas */}
          {issue.id === 'msg_suspeita' && (
            <div>
              <div className="font-semibold text-sm">{item.contactNome || 'Sem nome'}</div>
              <p className="text-xs text-slate-600 mt-1">{item.unread} não lidas • {item.motivo}</p>
            </div>
          )}

          {/* Visibilidade */}
          {issue.id === 'visibilidade' && (
            <div>
              <div className="font-semibold text-sm">{item.contactNome || 'Msg sem conteúdo'}</div>
              <p className="text-xs text-slate-600 mt-1">
                Visibility: <code className="bg-white px-1 rounded">{item.visibility || 'undefined'}</code>
              </p>
              {item.problemas?.map((p, idx) => (
                <p key={idx} className="text-xs text-orange-600 mt-0.5">• {p.descricao}</p>
              ))}
            </div>
          )}

          {/* Divergências */}
          {issue.id === 'divergencias' && (
            <div>
              <div className="font-semibold text-sm">Thread: {item.threadId?.substring(0, 12)}...</div>
              <p className="text-xs text-slate-600 mt-1">
                Legado: {item.legacyDecision ? '✅ Visível' : '🔒 Bloqueado'} →
                Nexus360: {item.nexusDecision ? '✅ Visível' : '🔒 Bloqueado'}
              </p>
            </div>
          )}
        </div>

        <Badge variant="outline" className="text-xs">
          {issue.id === 'sem_contato' ? 'CRÍTICO' : 'ALERTA'}
        </Badge>
      </div>
    </div>
  );
}