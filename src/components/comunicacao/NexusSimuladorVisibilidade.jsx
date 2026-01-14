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
  const [contatos, setContatos] = useState([]);

  // Carregar lista de usuários e contatos
  useEffect(() => {
    carregarUsuarios();
    carregarContatos();
  }, []);

  const carregarContatos = async () => {
    try {
      const contacts = await base44.entities.Contact.list();
      setContatos(contacts || []);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    }
  };

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
    <div className="space-y-3">
      {/* PAINEL SIMULADOR - COMPACTO */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-600" />
              <div>
                <CardTitle className="text-sm">Simulador Nexus360 - Shadow Engine</CardTitle>
                <CardDescription className="text-xs">Compare Legado vs Nexus360 • {threads.length} threads</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select 
                value={amostraSize} 
                onChange={(e) => setAmostraSize(Number(e.target.value))}
                className="text-xs border rounded px-2 py-1 bg-white"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>Todas</option>
              </select>
              {!temConfigNexus && (
                <Button 
                  size="sm"
                  variant="outline" 
                  onClick={handleAutoMigrate}
                  disabled={migrando || !usuarioAtual}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs h-7"
                >
                  {migrando ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                </Button>
              )}
              <Button 
                size="sm"
                onClick={runSimulation}
                disabled={loading || !threads.length || !usuarioAtual}
                className="bg-purple-600 hover:bg-purple-700 text-xs h-7"
              >
                {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* BARRAS LATERAIS - Integracoes lado a lado */}
      <div className="flex gap-2 overflow-x-auto h-[calc(100vh-12rem)]">
        {integracoes.map(integracao => {
          const threadsIntegracao = threads.filter(t => t.whatsapp_integration_id === integracao.id);
          
          return (
            <Card key={integracao.id} className="border-slate-200 flex flex-col flex-shrink-0 w-64">
              <CardHeader className="pb-2 flex-shrink-0 bg-gradient-to-r from-slate-50 to-slate-100">
                <CardTitle className="text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${integracao.status === 'conectado' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-semibold truncate">{integracao.nome_instancia}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{threadsIntegracao.length}</Badge>
                </CardTitle>
                <p className="text-[10px] text-slate-500 mt-1">#{integracao.numero_telefone?.slice(-4)}</p>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto">
                <div className="space-y-0">
                  {threadsIntegracao.map((thread, index) => {
                // Buscar contato pelo contact_id
                const contato = thread.contact_id ? contatos.find(c => c.id === thread.contact_id) : null;
                const hasUnread = (thread.unread_count || 0) > 0;
                
                // Nome formatado
                let nomeExibicao = "Desconhecido";
                if (contato) {
                  if (contato.empresa) nomeExibicao = contato.empresa;
                  if (contato.cargo) nomeExibicao += (nomeExibicao !== "Desconhecido" ? " - " : "") + contato.cargo;
                  if (contato.nome && contato.nome !== contato.telefone) nomeExibicao += (nomeExibicao !== "Desconhecido" ? " - " : "") + contato.nome;
                  if (nomeExibicao === "Desconhecido") nomeExibicao = contato.telefone || contato.nome || "Sem nome";
                } else {
                  nomeExibicao = thread.id?.substring(0, 20) || "Thread";
                }

                    return (
                      <div 
                        key={thread.id}
                        className="px-2 py-2 flex items-center gap-2 border-b border-slate-100 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 cursor-pointer transition-all"
                      >
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden ${
                            hasUnread ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500' : 'bg-gradient-to-br from-slate-400 to-slate-500'
                          }`}>
                            {contato?.foto_perfil_url ? (
                              <img src={contato.foto_perfil_url} alt={nomeExibicao} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : (
                              nomeExibicao.charAt(0).toUpperCase()
                            )}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          {/* Nome + Horário */}
                          <div className="flex items-center justify-between mb-0.5">
                            <h3 className={`font-semibold text-xs truncate ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                              {nomeExibicao}
                            </h3>
                            <span className={`text-[9px] flex-shrink-0 ml-1 ${hasUnread ? 'text-orange-600 font-medium' : 'text-slate-400'}`}>
                              {formatarHorario(thread.last_message_at)}
                            </span>
                          </div>

                          {/* Preview mensagem */}
                          <p className={`text-[10px] truncate flex items-center gap-1 ${hasUnread ? 'text-slate-800' : 'text-slate-500'}`}>
                            {thread.last_message_sender === 'user' && <CheckCheck className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />}
                            {thread.last_media_type === 'image' && <Image className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />}
                            {thread.last_media_type === 'video' && <Video className="w-2.5 h-2.5 text-purple-500 flex-shrink-0" />}
                            {thread.last_media_type === 'audio' && <Mic className="w-2.5 h-2.5 text-green-500 flex-shrink-0" />}
                            {thread.last_media_type === 'document' && <FileText className="w-2.5 h-2.5 text-orange-500 flex-shrink-0" />}
                            <span className="truncate">{thread.last_message_content || "Sem mensagens"}</span>
                          </p>

                          {/* Badges */}
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            <Badge variant="outline" className="text-[9px] h-3 px-1">
                              {thread.thread_type === 'contact_external' ? 'Cliente' : thread.thread_type === 'team_internal' ? '1:1' : 'Grupo'}
                            </Badge>
                            {thread.assigned_user_id && (
                              <Badge className="bg-indigo-500 text-white text-[9px] h-3 px-1">
                                <UserCheck className="w-2 h-2 mr-0.5" />
                                Atrib.
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* RESULTADOS DA SIMULAÇÃO */}
      <div className="space-y-3">

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

      {/* Tabela de resultados - COMPACTA */}
      {simulationResults && simulationResults.resultados.length > 0 && (
        <Card className="overflow-hidden">
          <div className="bg-slate-50 px-2 py-1 border-b flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-700">Comparação Detalhada</span>
            <span className="text-[10px] text-slate-500">{lastRun?.toLocaleTimeString()}</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold text-[10px]">
                <tr>
                  <th className="px-2 py-1 text-left">Contato</th>
                  <th className="px-2 py-1 text-center">Atual</th>
                  <th className="px-2 py-1 text-center">Nexus</th>
                  <th className="px-2 py-1 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
               {simulationResults.resultados.map((res) => {
                 const thread = threads.find(t => t.id === res.threadId);
                 const contato = thread?.contact_id ? contatos.find(c => c.id === thread.contact_id) : null;
                 const hasUnread = (thread?.unread_count || 0) > 0;

                 // Nome formatado igual ChatSidebar
                 let nomeExibicao = res.contactName;
                 if (contato) {
                   if (contato.empresa) nomeExibicao = contato.empresa;
                   if (contato.cargo) nomeExibicao += (nomeExibicao !== res.contactName ? " - " : "") + contato.cargo;
                   if (contato.nome && contato.nome !== contato.telefone) nomeExibicao += (nomeExibicao !== res.contactName ? " - " : "") + contato.nome;
                   if (!nomeExibicao || nomeExibicao === res.contactName) nomeExibicao = contato.telefone || contato.nome || res.contactName;
                 }

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
    </div>
  );
}