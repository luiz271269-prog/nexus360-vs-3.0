import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { base44 } from '@/api/base44Client';
import { canUserSeeThreadBase } from '@/components/lib/permissionsService';
import { 
  Eye, EyeOff, RefreshCw, CheckCircle2, AlertTriangle, 
  Zap, MessageSquare, Database, TrendingUp, User 
} from 'lucide-react';
import { toast } from 'sonner';

export default function CorretorVisibilidadeMensagens({ 
  threadId, 
  usuario, 
  integracoes = [],
  onClose 
}) {
  const [loading, setLoading] = useState(true);
  const [corrigindo, setCorrigindo] = useState(false);
  const [analise, setAnalise] = useState(null);

  useEffect(() => {
    if (threadId && usuario) {
      analisarVisibilidade();
    }
  }, [threadId, usuario]);

  const analisarVisibilidade = async () => {
    try {
      setLoading(true);

      // Carregar thread e mensagens
      const [thread, mensagens, contatos] = await Promise.all([
        base44.entities.MessageThread.filter({ id: threadId }),
        base44.entities.Message.filter({ thread_id: threadId }),
        base44.entities.Contact.list()
      ]);

      const threadData = thread[0];
      if (!threadData) {
        toast.error('Thread não encontrada');
        return;
      }

      const contato = threadData.contact_id 
        ? contatos.find(c => c.id === threadData.contact_id) 
        : null;

      // Verificar se a thread é visível
      const threadEhVisivel = canUserSeeThreadBase(usuario, threadData, contato, integracoes);

      // Analisar mensagens
      const mensagensComProblema = [];
      
      for (const msg of mensagens) {
        // Problema 1: Thread bloqueada mas mensagem pública
        if (!threadEhVisivel && msg.visibility !== 'internal_only') {
          mensagensComProblema.push({
            ...msg,
            problema: 'thread_bloqueada',
            descricao: 'Thread bloqueada - mensagem não visível ao usuário',
            correcaoSugerida: 'atribuir_thread'
          });
        }
        
        // Problema 2: Mensagem sem content mas com status enviada
        if (!msg.content && msg.status === 'enviada') {
          mensagensComProblema.push({
            ...msg,
            problema: 'sem_conteudo',
            descricao: 'Mensagem sem conteúdo',
            correcaoSugerida: 'marcar_como_falha'
          });
        }
      }

      setAnalise({
        thread: threadData,
        contato,
        totalMensagens: mensagens.length,
        mensagensComProblema,
        threadEhVisivel,
        estrategiasCorrecao: gerarEstrategiasCorrecao(threadData, contato, mensagensComProblema, threadEhVisivel)
      });

    } catch (error) {
      console.error('Erro ao analisar visibilidade:', error);
      toast.error('Erro na análise: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const gerarEstrategiasCorrecao = (thread, contato, mensagensProblema, threadVisivel) => {
    const estrategias = [];

    // Estratégia ÚNICA: Corrigir visibility das mensagens (sem atribuir ou fidelizar)
    const mensagensParaCorrigir = mensagensProblema.filter(m => 
      m.problema === 'thread_bloqueada' && m.visibility !== 'internal_only'
    );
    
    if (mensagensParaCorrigir.length > 0) {
      estrategias.push({
        tipo: 'corrigir_visibility',
        titulo: 'Marcar Mensagens como Internas',
        descricao: `Marcar ${mensagensParaCorrigir.length} mensagens como internal_only (não altera atribuição da thread)`,
        icone: MessageSquare,
        cor: 'orange',
        acao: async () => {
          // Atualizar em lote
          for (const msg of mensagensParaCorrigir) {
            await base44.entities.Message.update(msg.id, {
              visibility: 'internal_only'
            });
          }
          return `${mensagensParaCorrigir.length} mensagens marcadas como internas`;
        }
      });
    }

    return estrategias;
  };

  const aplicarCorrecao = async (estrategia) => {
    try {
      setCorrigindo(true);
      toast.info(`🔄 Aplicando: ${estrategia.titulo}...`);

      const resultado = await estrategia.acao();
      
      toast.success(`✅ ${resultado}`);
      
      // Re-analisar após correção
      await analisarVisibilidade();
      
    } catch (error) {
      console.error('Erro ao aplicar correção:', error);
      toast.error('Erro na correção: ' + error.message);
    } finally {
      setCorrigindo(false);
    }
  };

  const corrigirTudo = async () => {
    if (!analise?.estrategiasCorrecao?.length) {
      toast.warning('Nenhuma correção disponível');
      return;
    }

    const confirmar = window.confirm(
      `⚠️ CORREÇÃO AUTOMÁTICA\n\n` +
      `Aplicar ${analise.estrategiasCorrecao.length} correções?\n\n` +
      `Isto irá modificar threads, contatos e mensagens.\n\n` +
      `Deseja continuar?`
    );

    if (!confirmar) return;

    try {
      setCorrigindo(true);
      
      for (const estrategia of analise.estrategiasCorrecao) {
        await aplicarCorrecao(estrategia);
      }
      
      toast.success(`✅ Todas as ${analise.estrategiasCorrecao.length} correções aplicadas!`);
      
      if (onClose) {
        setTimeout(onClose, 1500);
      }
      
    } catch (error) {
      console.error('Erro ao corrigir tudo:', error);
      toast.error('Erro nas correções: ' + error.message);
    } finally {
      setCorrigindo(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Analisando visibilidade...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analise) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar análise de visibilidade
        </AlertDescription>
      </Alert>
    );
  }

  // Formatar nome do contato
  let nomeContato = "Thread sem contato";
  if (analise.contato) {
    if (analise.contato.empresa) nomeContato = analise.contato.empresa;
    else if (analise.contato.nome && analise.contato.nome !== analise.contato.telefone) nomeContato = analise.contato.nome;
    else if (analise.contato.telefone) nomeContato = analise.contato.telefone;
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho com Nome do Contato */}
      <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-lg p-4 border-2 border-purple-300">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
            {analise.contato?.foto_perfil_url ? (
              <img 
                src={analise.contato.foto_perfil_url} 
                alt={nomeContato} 
                className="w-full h-full object-cover rounded-full" 
                onError={(e) => { e.target.style.display = 'none'; }} 
              />
            ) : (
              nomeContato.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900">{nomeContato}</h3>
            {analise.contato && (
              <div className="flex items-center gap-2 mt-1">
                {analise.contato.telefone && (
                  <Badge variant="outline" className="text-xs">
                    📱 {analise.contato.telefone}
                  </Badge>
                )}
                {analise.contato.email && (
                  <Badge variant="outline" className="text-xs">
                    ✉️ {analise.contato.email}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resumo da Análise */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-600" />
            Análise de Visibilidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Total de Mensagens</div>
              <div className="text-2xl font-bold text-slate-900">{analise.totalMensagens}</div>
            </div>
            
            <div className={`rounded-lg p-3 border ${
              analise.threadEhVisivel 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="text-xs text-slate-500 mb-1">Thread Visível</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                {analise.threadEhVisivel ? (
                  <><Eye className="w-5 h-5 text-green-600" /> SIM</>
                ) : (
                  <><EyeOff className="w-5 h-5 text-red-600" /> NÃO</>
                )}
              </div>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
              <div className="text-xs text-slate-500 mb-1">Mensagens com Problema</div>
              <div className="text-2xl font-bold text-orange-700">{analise.mensagensComProblema.length}</div>
            </div>
          </div>

          {/* Dados da Thread */}
          {analise.contato && (
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-xs space-y-1">
                <div><span className="font-semibold">Contato:</span> {nomeContato}</div>
                <div><span className="font-semibold">Telefone:</span> {analise.contato.telefone}</div>
                {analise.contato.empresa && (
                  <div><span className="font-semibold">Empresa:</span> {analise.contato.empresa}</div>
                )}
                {analise.contato.cargo && (
                  <div><span className="font-semibold">Cargo:</span> {analise.contato.cargo}</div>
                )}
                <div><span className="font-semibold">Atribuído:</span> {analise.thread.assigned_user_id ? 'Sim' : 'Não'}</div>
                <div><span className="font-semibold">Setor:</span> {analise.thread.sector_id || 'N/A'}</div>
                <div><span className="font-semibold">Fidelizado:</span> {analise.contato.is_cliente_fidelizado ? 'Sim' : 'Não'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estratégias de Correção */}
      {analise.estrategiasCorrecao.length > 0 && (
        <Card className="border-indigo-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-600" />
                Estratégias de Correção ({analise.estrategiasCorrecao.length})
              </CardTitle>
              <Button
                onClick={corrigirTudo}
                disabled={corrigindo}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {corrigindo ? (
                  <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Corrigindo...</>
                ) : (
                  <>✨ Corrigir Tudo</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {analise.estrategiasCorrecao.map((estrategia, idx) => {
              const Icon = estrategia.icone;
              
              return (
                <div 
                  key={idx} 
                  className={`bg-${estrategia.cor}-50 border-${estrategia.cor}-200 border rounded-lg p-3 flex items-center justify-between`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 text-${estrategia.cor}-700`} />
                    <div>
                      <h4 className={`font-semibold text-sm text-${estrategia.cor}-700`}>
                        {estrategia.titulo}
                      </h4>
                      <p className="text-xs text-slate-600">{estrategia.descricao}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => aplicarCorrecao(estrategia)}
                    disabled={corrigindo}
                    className={`bg-${estrategia.cor}-600 hover:bg-${estrategia.cor}-700`}
                  >
                    {corrigindo ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Aplicar'}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Lista de Mensagens com Problema */}
      {analise.mensagensComProblema.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Mensagens com Problema ({analise.mensagensComProblema.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {analise.mensagensComProblema.map((msg, idx) => (
                <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="text-xs space-y-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-orange-700 text-sm">
                        {msg.problema === 'thread_bloqueada' ? '🚨 Thread Bloqueada' : '⚠️ Sem Conteúdo'}
                      </span>
                      <Badge className="bg-orange-600 text-white text-[9px]">
                        {msg.correcaoSugerida}
                      </Badge>
                    </div>
                    <div className="text-slate-700">
                      <span className="font-semibold">Remetente:</span> {msg.sender_type === 'user' ? 'Atendente' : nomeContato}
                    </div>
                    <div className="text-slate-600">{msg.descricao}</div>
                    <div className="bg-white rounded p-2 border border-orange-100 mt-2">
                      <span className="font-semibold">Conteúdo:</span> 
                      <p className="text-slate-500 mt-1">{msg.content?.substring(0, 120) || 'Sem conteúdo'}...</p>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2">
                      ID: {msg.id?.substring(0, 12)}... | {new Date(msg.created_date).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensagem de Sucesso */}
      {analise.mensagensComProblema.length === 0 && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            ✅ Todas as mensagens estão visíveis corretamente! Nenhuma correção necessária.
          </AlertDescription>
        </Alert>
      )}

      {/* Botão Fechar */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}