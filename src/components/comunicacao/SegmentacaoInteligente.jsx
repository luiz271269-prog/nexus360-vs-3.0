import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  MessageCircle,
  Clock,
  Tag as TagIcon,
  Loader2,
  RefreshCw,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

export default function SegmentacaoInteligente({ contactId }) {
  const [analise, setAnalise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    carregarAnalise();
    carregarTags();
  }, [contactId]);

  const carregarAnalise = async () => {
    try {
      setLoading(true);
      const analises = await base44.entities.ContactBehaviorAnalysis.list('-ultima_analise', 1, { contact_id: contactId });
      
      if (analises.length > 0) {
        setAnalise(analises[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar análise:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarTags = async () => {
    try {
      const contactTags = await base44.entities.ContactTag.filter({ contact_id: contactId });
      const tagIds = contactTags.map(ct => ct.tag_id);
      
      if (tagIds.length > 0) {
        const todasTags = await base44.entities.Tag.list();
        const tagsDoContato = todasTags.filter(t => tagIds.includes(t.id));
        setTags(tagsDoContato.map(t => ({
          ...t,
          origem: contactTags.find(ct => ct.tag_id === t.id)?.origem
        })));
      } else {
        setTags([]);
      }
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  const analisarComportamento = async () => {
    setAnalisando(true);
    const toastId = toast.loading('🤖 IA analisando histórico de conversas...', { duration: Infinity });
    
    try {
      const resultado = await base44.functions.invoke('analisarComportamentoContato', {
        contact_id: contactId,
        periodo_dias: 30
      });

      if (resultado.data.success) {
        const resumo = resultado.data.resumo;
        
        // 📸 Buscar e atualizar foto de perfil após análise
        try {
          const contato = await base44.entities.Contact.get(contactId);
          const threads = await base44.entities.MessageThread.list('-created_date', 1, { contact_id: contactId });
          
          if (threads.length > 0 && threads[0].whatsapp_integration_id) {
            console.log('📸 Buscando foto de perfil...', { 
              integration_id: threads[0].whatsapp_integration_id,
              phone: contato.telefone 
            });
            
            const fotoResult = await base44.functions.invoke('buscarFotoPerfilWhatsApp', {
              integration_id: threads[0].whatsapp_integration_id,
              phone: contato.telefone
            });
            
            if (fotoResult?.data?.profilePictureUrl) {
              console.log('✅ Foto encontrada, atualizando contato...');
              await base44.entities.Contact.update(contactId, {
                foto_perfil_url: fotoResult.data.profilePictureUrl,
                foto_perfil_atualizada_em: new Date().toISOString()
              });
              
              // Forçar reload da página de comunicação
              window.location.reload();
            } else {
              console.warn('⚠️ Foto não encontrada na resposta');
            }
          }
        } catch (fotoError) {
          console.error('❌ Erro ao buscar foto:', fotoError);
        }
        
        // Mensagem de sucesso mais informativa
        toast.success(
          `✅ Análise concluída!\n` +
          `📊 Segmento: ${resumo.segmento?.replace(/_/g, ' ')}\n` +
          `⭐ Score: ${resumo.score}/100\n` +
          `${resumo.tags_atribuidas?.length > 0 ? `🏷️ ${resumo.tags_atribuidas.length} tag(s) aplicada(s)` : ''}`,
          { duration: 5000 }
        );

        // Atualizar MessageThreads com nova prioridade baseada na análise
        try {
          const threads = await base44.entities.MessageThread.list('-created_date', 10, { contact_id: contactId });
          
          if (threads.length > 0) {
            // Calcular prioridade baseada no segmento e score
            let novaPrioridade = 'normal';
            
            if (resumo.segmento === 'risco_churn' || resumo.score < 30) {
              novaPrioridade = 'urgente';
            } else if (resumo.segmento === 'lead_quente' || resumo.score > 80) {
              novaPrioridade = 'alta';
            } else if (resumo.segmento === 'lead_morno' || (resumo.score >= 50 && resumo.score <= 80)) {
              novaPrioridade = 'normal';
            } else {
              novaPrioridade = 'baixa';
            }

            // Atualizar prioridade das threads ativas
            for (const thread of threads) {
              if (thread.status === 'aberta' || thread.status === 'aguardando_cliente') {
                await base44.entities.MessageThread.update(thread.id, {
                  prioridade: novaPrioridade
                });
              }
            }

            console.log(`✅ Prioridade das conversas atualizada para: ${novaPrioridade}`);
          }
        } catch (threadError) {
          console.warn('Erro ao atualizar prioridade das threads:', threadError);
        }
        
        await carregarAnalise();
        await carregarTags();
        
        toast.dismiss(toastId);
      } else {
        throw new Error(resultado.data.error || 'Erro desconhecido na análise');
      }
    } catch (error) {
      console.error('❌ Erro ao analisar:', error);
      toast.dismiss(toastId);
      
      // Mensagens de erro mais amigáveis
      let mensagemErro = 'Erro ao analisar comportamento';
      
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        mensagemErro = '⏳ Muitas requisições. Aguarde alguns segundos e tente novamente.';
      } else if (error.message?.includes('timeout')) {
        mensagemErro = '⏱️ Análise demorou muito. Tente novamente ou reduza o período.';
      } else if (error.message?.includes('Não autorizado')) {
        mensagemErro = '🔒 Você não tem permissão para analisar contatos.';
      } else if (error.message) {
        mensagemErro = `❌ ${error.message}`;
      }
      
      toast.error(mensagemErro, { duration: 6000 });
    } finally {
      setAnalisando(false);
    }
  };

  const getSegmentoColor = (segmento) => {
    const colors = {
      lead_frio: 'bg-blue-100 text-blue-800 border-blue-200',
      lead_morno: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      lead_quente: 'bg-orange-100 text-orange-800 border-orange-200',
      cliente_ativo: 'bg-green-100 text-green-800 border-green-200',
      cliente_inativo: 'bg-gray-100 text-gray-800 border-gray-200',
      suporte: 'bg-purple-100 text-purple-800 border-purple-200',
      vip: 'bg-pink-100 text-pink-800 border-pink-200',
      risco_churn: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[segmento] || 'bg-gray-100 text-gray-800';
  };

  const getSentimentoIcon = (sentimento) => {
    if (sentimento?.includes('positivo')) return '😊';
    if (sentimento?.includes('negativo')) return '😟';
    return '😐';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com botão de análise */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg">Segmentação Inteligente</CardTitle>
            </div>
            <Button
              onClick={analisarComportamento}
              disabled={analisando}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              {analisando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Analisar Agora
                </>
              )}
            </Button>
          </div>
          {analise && (
            <CardDescription className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Última análise: {new Date(analise.ultima_analise).toLocaleString('pt-BR')}
              {(() => {
                const diasDesdeAnalise = Math.floor((Date.now() - new Date(analise.ultima_analise).getTime()) / (1000 * 60 * 60 * 24));
                if (diasDesdeAnalise > 7) {
                  return (
                    <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300">
                      ⚠️ Recomendado reanalisar
                    </Badge>
                  );
                }
                return null;
              })()}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {!analise ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles className="w-12 h-12 text-purple-300 mx-auto mb-3" />
            <p className="text-slate-600 mb-2 font-medium">Nenhuma análise disponível ainda</p>
            <p className="text-sm text-slate-500 mb-4">
              A IA analisará o histórico de mensagens para identificar padrões de comportamento,
              sentimento e recomendar ações.
            </p>
            <Button 
              onClick={analisarComportamento} 
              disabled={analisando}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {analisando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Realizar Primeira Análise
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Segmento e Score */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Segmento</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={`text-base px-3 py-1 ${getSegmentoColor(analise.segmento_sugerido)}`}>
                  <Target className="w-4 h-4 mr-2" />
                  {analise.segmento_sugerido?.replace(/_/g, ' ')}
                </Badge>
                <p className="text-xs text-slate-500 mt-2">
                  Confiança: {analise.confianca_segmentacao}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">Score Engajamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-purple-600">
                    {analise.score_engajamento}
                  </div>
                  <div className="flex-1">
                    <Progress value={analise.score_engajamento} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Métricas de Engajamento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Métricas de Engajamento
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Total de Mensagens</p>
                <p className="text-2xl font-bold">{analise.metricas_engajamento?.total_mensagens || 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Taxa de Resposta</p>
                <p className="text-2xl font-bold">{analise.metricas_engajamento?.taxa_resposta?.toFixed(1) || 0}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tempo Médio Resposta</p>
                <p className="text-xl font-bold flex items-center gap-1">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {analise.metricas_engajamento?.tempo_medio_resposta_minutos?.toFixed(0) || 0}min
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Frequência</p>
                <p className="text-xl font-bold">
                  A cada {analise.metricas_engajamento?.frequencia_media_dias?.toFixed(1) || 0} dias
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Sentimento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                {getSentimentoIcon(analise.analise_sentimento?.sentimento_predominante)}
                Análise de Sentimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600">Sentimento Predominante</span>
                    <Badge variant="outline">
                      {analise.analise_sentimento?.sentimento_predominante?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <Progress 
                    value={analise.analise_sentimento?.score_sentimento || 50} 
                    className="h-2"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {analise.analise_sentimento?.evolucao_sentimento === 'melhorando' && (
                    <><TrendingUp className="w-4 h-4 text-green-600" /> Melhorando</>
                  )}
                  {analise.analise_sentimento?.evolucao_sentimento === 'piorando' && (
                    <><TrendingDown className="w-4 h-4 text-red-600" /> Piorando</>
                  )}
                  {analise.analise_sentimento?.evolucao_sentimento === 'estavel' && (
                    <><span className="text-slate-400">—</span> Estável</>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Próxima Ação Sugerida */}
          {analise.proxima_acao_sugerida && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-600" />
                  Próxima Ação Sugerida
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-slate-700">
                  {analise.proxima_acao_sugerida}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Tags Automáticas */}
          {tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TagIcon className="w-4 h-4" />
                  Tags Aplicadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="gap-1"
                      style={{ borderColor: tag.cor, color: tag.cor }}
                    >
                      {tag.nome}
                      {tag.origem === 'ia' && (
                        <Brain className="w-3 h-3" />
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Palavras-Chave */}
          {analise.palavras_chave_frequentes?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Palavras-Chave Frequentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analise.palavras_chave_frequentes.slice(0, 10).map((palavra, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {palavra.palavra}
                      <span className="text-xs text-slate-500">({palavra.frequencia}x)</span>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}