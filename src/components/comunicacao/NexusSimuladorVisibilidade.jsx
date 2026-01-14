import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  PlayCircle, AlertTriangle, CheckCircle2, Database, 
  RefreshCw, Zap, Eye, EyeOff, Info, TrendingUp, ArrowRightLeft, Users, User,
  CheckCheck, Image, Video, Mic, FileText, MapPin, Phone as PhoneIcon, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { executarAnaliseEmLote } from '@/components/lib/nexusComparator';
import { buildPolicyFromLegacyUser } from '@/components/lib/nexusLegacyConverter';
import { base44 } from '@/api/base44Client';
import { getUserDisplayName } from '../lib/userHelpers';

export default function NexusSimuladorVisibilidade({ usuario, integracoes = [], threads = [] }) {
  const [simulationResults, setSimulationResults] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [migrando, setMigrando] = useState(false);
  const [amostraSize, setAmostraSize] = useState(50);
  const [todosUsuarios, setTodosUsuarios] = useState([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [filtroSetor, setFiltroSetor] = useState('todos');
  const [filtroIntegracao, setFiltroIntegracao] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  // Carregar lista de usuários
  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    try {
      setLoadingUsuarios(true);
      const users = await base44.entities.User.list();
      setTodosUsuarios(users || []);
      
      // Selecionar usuário logado por padrão
      if (usuario && !usuarioSelecionado) {
        setUsuarioSelecionado(usuario.id);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const usuarioAtual = todosUsuarios.find(u => u.id === usuarioSelecionado) || usuario;

  const formatarHorario = (timestamp) => {
    if (!timestamp) return "";
    try {
      const agora = new Date();
      const dataMsg = new Date(timestamp);

      if (agora.toDateString() === dataMsg.toDateString()) {
        return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }

      const diffDias = Math.floor((agora - dataMsg) / (1000 * 60 * 60 * 24));
      if (diffDias < 7) {
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return diasSemana[dataMsg.getDay()];
      }

      return dataMsg.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return "";
    }
  };

  const handleAutoMigrate = async () => {
    if (!usuarioAtual) {
      toast.error('Nenhum usuário selecionado');
      return;
    }
    
    const confirmar = window.confirm(
      `⚠️ MIGRAÇÃO AUTOMÁTICA\n\n` +
      `Converter permissões de: ${usuarioAtual.full_name || usuarioAtual.email}\n\n` +
      `Isto irá converter as permissões LEGADAS para o formato Nexus360.\n\n` +
      `As permissões antigas serão preservadas, mas as novas configurações Nexus serão ativadas.\n\n` +
      `Deseja continuar?`
    );
    
    if (!confirmar) return;
    
    try {
      setMigrando(true);
      
      // Gerar configuração Nexus360 baseada no perfil legado
      const newPolicy = buildPolicyFromLegacyUser(usuarioAtual);
      
      // Salvar no banco
      await base44.entities.User.update(usuarioAtual.id, newPolicy);
      
      toast.success(`✅ Configuração Nexus360 gerada para ${usuarioAtual.full_name}!`);
      
      // Recarregar usuários
      await carregarUsuarios();
      
    } catch (error) {
      console.error('Erro ao migrar configuração:', error);
      toast.error('Erro ao migrar: ' + error.message);
    } finally {
      setMigrando(false);
    }
  };

  const runSimulation = async () => {
    if (!usuarioAtual) {
      toast.error('Nenhum usuário selecionado');
      return;
    }
    
    try {
      setLoading(true);
      
      // Usar threads já carregadas ou buscar novas
      let threadsParaAnalisar = threads;
      
      if (!threadsParaAnalisar || threadsParaAnalisar.length === 0) {
        threadsParaAnalisar = await base44.entities.MessageThread.list('-last_message_at', amostraSize);
      }
      
      // Aplicar filtros
      if (filtroSetor !== 'todos') {
        threadsParaAnalisar = threadsParaAnalisar.filter(t => t.sector_id === filtroSetor);
      }
      
      if (filtroIntegracao !== 'todas') {
        threadsParaAnalisar = threadsParaAnalisar.filter(t => t.whatsapp_integration_id === filtroIntegracao);
      }
      
      if (filtroTipo !== 'todos') {
        threadsParaAnalisar = threadsParaAnalisar.filter(t => t.thread_type === filtroTipo);
      }
      
      // Limitar ao tamanho da amostra
      threadsParaAnalisar = threadsParaAnalisar.slice(0, amostraSize);
      
      if (!threadsParaAnalisar || threadsParaAnalisar.length === 0) {
        toast.warning('Nenhuma thread encontrada com os filtros aplicados');
        return;
      }
      
      // Executar análise comparativa
      const resultado = executarAnaliseEmLote(usuarioAtual, threadsParaAnalisar, integracoes);
      
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

  const temConfigNexus = usuarioAtual?.configuracao_visibilidade_nexus || usuarioAtual?.permissoes_acoes_nexus;

  return (
    <div className="space-y-4">
      {/* Seletor de Usuário e Configurações */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Selecionar Usuário
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUsuarios ? (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Carregando usuários...
              </div>
            ) : (
              <Select value={usuarioSelecionado || ''} onValueChange={setUsuarioSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {todosUsuarios.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        {u.full_name || u.email}
                        <Badge variant="outline" className="text-xs">
                          {u.role === 'admin' ? 'Admin' : u.attendant_role || 'User'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {usuarioAtual && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg space-y-1 text-xs">
                <div><strong>Nome:</strong> {usuarioAtual.full_name || 'N/A'}</div>
                <div><strong>Email:</strong> {usuarioAtual.email}</div>
                <div><strong>Role:</strong> <Badge variant="outline">{usuarioAtual.role}</Badge></div>
                <div><strong>Setor:</strong> {usuarioAtual.attendant_sector || 'N/A'}</div>
                <div><strong>Função:</strong> {usuarioAtual.attendant_role || 'N/A'}</div>
                <div className="pt-2 border-t">
                  <strong>Config Nexus:</strong> {temConfigNexus ? (
                    <Badge className="bg-green-100 text-green-700 ml-1">Configurado</Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-1">Não configurado</Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600" />
              Conexões WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {integracoes.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma integração cadastrada</p>
              ) : (
                integracoes.map(int => (
                  <div key={int.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${int.status === 'conectado' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm font-medium">{int.nome_instancia}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{int.numero_telefone}</Badge>
                  </div>
                ))
              )}
              <div className="pt-2 border-t text-xs text-slate-600">
                <strong>Total:</strong> {integracoes.length} conexões
                <br />
                <strong>Conectadas:</strong> {integracoes.filter(i => i.status === 'conectado').length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header com ações */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Simulador Nexus360 - Shadow Engine</CardTitle>
                <CardDescription>
                  Compare decisões Sistema Atual (Legado) vs Nexus360 • {threads.length} threads disponíveis
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border">
                <span className="text-xs text-slate-600">Amostra:</span>
                <select 
                  value={amostraSize} 
                  onChange={(e) => setAmostraSize(Number(e.target.value))}
                  className="text-xs border-0 bg-transparent focus:outline-none"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>Todas ({threads.length})</option>
                </select>
              </div>
              {!temConfigNexus && (
                <Button 
                  variant="outline" 
                  onClick={handleAutoMigrate}
                  disabled={migrando || !usuarioAtual}
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
                      Migrar 1-Click
                    </>
                  )}
                </Button>
              )}
              <Button 
                onClick={runSimulation}
                disabled={loading || !threads.length || !usuarioAtual}
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
                    Rodar Validação
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filtros - Igual ChatSidebar */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros de Análise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-600 mb-1 block">Setor</label>
              <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Setores</SelectItem>
                  <SelectItem value="vendas">Vendas</SelectItem>
                  <SelectItem value="assistencia">Assistência</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="geral">Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-slate-600 mb-1 block">Conexão WhatsApp</label>
              <Select value={filtroIntegracao} onValueChange={setFiltroIntegracao}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas Conexões</SelectItem>
                  {integracoes.map(int => (
                    <SelectItem key={int.id} value={int.id}>
                      {int.nome_instancia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-slate-600 mb-1 block">Tipo Thread</label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Tipos</SelectItem>
                  <SelectItem value="contact_external">Externas (Clientes)</SelectItem>
                  <SelectItem value="team_internal">Internas (1:1)</SelectItem>
                  <SelectItem value="sector_group">Grupos Setor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
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
               {simulationResults.resultados.map((res) => {
                 const thread = threads.find(t => t.id === res.threadId);
                 const contato = thread?.contato;
                 const hasUnread = (thread?.unread_count || 0) > 0;

                 // Nome formatado igual ChatSidebar
                 let nomeExibicao = res.contactName;
                 if (contato?.empresa) nomeExibicao = contato.empresa;
                 if (contato?.cargo) nomeExibicao += (nomeExibicao && contato.cargo ? " - " : "") + (contato.cargo || "");
                 if (contato?.nome && contato.nome !== contato.telefone) nomeExibicao += (nomeExibicao ? " - " : "") + contato.nome;
                 if (!nomeExibicao || nomeExibicao.trim() === '') nomeExibicao = contato?.telefone || res.contactName;

                 return (
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
                       <div className="flex items-center gap-3">
                         {/* Avatar com foto - Estilo ChatSidebar */}
                         <div className="relative flex-shrink-0">
                           <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md overflow-hidden ${
                             hasUnread ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500' : 'bg-gradient-to-br from-slate-400 to-slate-500'
                           }`}>
                             {contato?.foto_perfil_url ? (
                               <img src={contato.foto_perfil_url} alt={nomeExibicao} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                             ) : (
                               nomeExibicao.charAt(0).toUpperCase()
                             )}
                           </div>
                         </div>

                         {/* Info completa */}
                         <div className="flex-1 min-w-0">
                           {/* Linha 1: Nome + Horário */}
                           <div className="flex items-center justify-between mb-0.5">
                             <h3 className="font-semibold text-sm text-slate-900 truncate">{nomeExibicao}</h3>
                             <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                               {formatarHorario(thread?.last_message_at)}
                             </span>
                           </div>

                           {/* Linha 2: Preview mensagem */}
                           <p className="text-xs text-slate-500 truncate flex items-center gap-1 mb-1">
                             {thread?.last_message_sender === 'user' && <CheckCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                             {thread?.last_media_type === 'image' && <Image className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                             {thread?.last_media_type === 'video' && <Video className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                             {thread?.last_media_type === 'audio' && <Mic className="w-3 h-3 text-green-500 flex-shrink-0" />}
                             {thread?.last_media_type === 'document' && <FileText className="w-3 h-3 text-orange-500 flex-shrink-0" />}
                             <span className="truncate">{thread?.last_message_content || "Sem mensagens"}</span>
                           </p>

                           {/* Linha 3: Badges */}
                           <div className="flex items-center gap-1 flex-wrap">
                             <Badge variant="outline" className="text-[10px] h-4">
                               {res.threadType === 'contact_external' ? '👤 Cliente' : res.threadType === 'team_internal' ? '💬 1:1' : '👥 Grupo'}
                             </Badge>
                             {thread?.assigned_user_id && (
                               <Badge className="bg-indigo-500 text-white text-[10px] h-4">
                                 <UserCheck className="w-2.5 h-2.5 mr-0.5" />
                                 {getUserDisplayName(thread.assigned_user_id, todosUsuarios).split(' ')[0]}
                               </Badge>
                             )}
                           </div>
                         </div>
                       </div>
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
                  );
                })}
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