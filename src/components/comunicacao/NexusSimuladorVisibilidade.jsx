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
import AnalisadorContatosDuplicados from './AnalisadorContatosDuplicados';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const [filtroRegra, setFiltroRegra] = useState('todas');
  const [filtroDivergencia, setFiltroDivergencia] = useState('todas');
  const [threadExpandida, setThreadExpandida] = useState(null);
  const [modalCorrecaoOpen, setModalCorrecaoOpen] = useState(false);
  const [telefoneParaCorrigir, setTelefoneParaCorrigir] = useState(null);

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
                
                // 🔍 Verificar inconsistências do contato com as regras Nexus360
                let erroNexus = null;
                if (simulationResults && contato) {
                  const resultado = simulationResults.resultados.find(r => r.threadId === thread.id);
                  if (resultado && !resultado.isMatch) {
                    erroNexus = {
                      severity: resultado.severity,
                      descricao: resultado.nexusMotivo || 'Inconsistência detectada',
                      regra: resultado.nexusDecisionPath?.[0]?.split(':')[1] || 'N/A'
                    };
                  }
                }
                
                // Nome formatado
                let nomeExibicao = "";
                if (contato) {
                  if (contato.empresa) nomeExibicao = contato.empresa;
                  if (contato.cargo) nomeExibicao = nomeExibicao ? nomeExibicao + " - " + contato.cargo : contato.cargo;
                  if (contato.nome && contato.nome !== contato.telefone) nomeExibicao = nomeExibicao ? nomeExibicao + " - " + contato.nome : contato.nome;
                  if (!nomeExibicao) nomeExibicao = contato.telefone || "Sem nome";
                } else {
                  nomeExibicao = thread.id?.substring(0, 20) || "Thread";
                }

                    return (
                      <div 
                        key={thread.id}
                        className={`px-2 py-2 flex items-center gap-2 border-b border-slate-100 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 cursor-pointer transition-all group relative ${
                          erroNexus ? (erroNexus.severity === 'error' ? 'bg-red-50/50' : 'bg-amber-50/50') : ''
                        }`}
                        title={erroNexus ? `❌ ${erroNexus.descricao}` : ''}
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
                          
                          {/* 🚨 Indicador de Erro Nexus360 */}
                          {erroNexus && (
                            <div 
                              className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-md ${
                                erroNexus.severity === 'error' ? 'bg-red-600' : 'bg-amber-500'
                              }`}
                              title={`Regra: ${erroNexus.regra}\n${erroNexus.descricao}`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
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
                            {erroNexus && (
                              <Badge className={`text-[9px] h-3 px-1 ${
                                erroNexus.severity === 'error' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                              }`}>
                                <AlertTriangle className="w-2 h-2 mr-0.5" />
                                {erroNexus.regra}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Descrição do Erro */}
                          {erroNexus && (
                           <div className={`mt-1 text-[9px] px-1.5 py-0.5 rounded ${
                             erroNexus.severity === 'error' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                           }`}>
                             {erroNexus.descricao}
                           </div>
                          )}
                          </div>

                          {/* 🎯 BOTÕES DE AÇÃO - Aparecem ao hover */}
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <Button
                           size="sm"
                           variant="ghost"
                           onClick={(e) => {
                             e.stopPropagation();
                             setThreadExpandida(threadExpandida === thread.id ? null : thread.id);
                           }}
                           className="h-6 w-6 p-0 bg-white shadow-md hover:bg-indigo-50 border border-slate-200"
                           title="Ver detalhes"
                          >
                           <Info className="w-3 h-3 text-indigo-600" />
                          </Button>

                          <Button
                           size="sm"
                           variant="ghost"
                           onClick={(e) => {
                             e.stopPropagation();
                             if (contato?.telefone) {
                               setTelefoneParaCorrigir(contato.telefone);
                               setModalCorrecaoOpen(true);
                             } else {
                               toast.error('Contato sem telefone');
                             }
                           }}
                           className="h-6 w-6 p-0 bg-white shadow-md hover:bg-purple-50 border border-slate-200"
                           title="Corrigir duplicatas"
                          >
                           <Users className="w-3 h-3 text-purple-600" />
                          </Button>
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

      {/* Estatísticas + Filtros - LAYOUT COMPACTO */}
      {simulationResults && (
        <div className="space-y-3">
          {/* Métricas em Cards Horizontais */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="border-2 border-slate-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total Analisado</p>
                    <p className="text-3xl font-bold text-slate-900">{simulationResults.stats.total}</p>
                  </div>
                  <Database className="w-10 h-10 text-slate-300" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-300 bg-green-50/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-green-600 uppercase tracking-wide font-medium">Matches</p>
                    <p className="text-3xl font-bold text-green-700">{simulationResults.stats.matches}</p>
                  </div>
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-300 bg-amber-50/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-amber-600 uppercase tracking-wide font-medium">Divergências</p>
                    <p className="text-3xl font-bold text-amber-700">{simulationResults.stats.divergencias}</p>
                  </div>
                  <AlertTriangle className="w-10 h-10 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-300 bg-purple-50/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-purple-600 uppercase tracking-wide font-medium">Aderência</p>
                    <p className="text-3xl font-bold text-purple-700">{simulationResults.stats.taxa_aderencia}%</p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros em Linha Única */}
          <Card className="border-slate-200">
            <CardContent className="p-3">
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Filtrar por:</span>
                  <select 
                    value={filtroRegra} 
                    onChange={(e) => setFiltroRegra(e.target.value)}
                    className="text-xs border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="todas">Todas as Regras</option>
                    <option value="admin_total">P2: Admin Total</option>
                    <option value="thread_atribuida">P3: Thread Atribuída</option>
                    <option value="contato_fidelizado">P4: Fidelizado</option>
                    <option value="janela_24h">P5: Janela 24h</option>
                    <option value="bloqueio_fidelizado_outro">P6: Bloq. Fidelizado Outro</option>
                    <option value="bloqueio_atribuido_outro">P7: Bloq. Atribuído Outro</option>
                    <option value="gerente_supervisao">P8: Gerente Supervisão</option>
                    <option value="bloqueio_integracao">P10: Bloqueio Integração</option>
                    <option value="bloqueio_setor">P11: Bloqueio Setor</option>
                    <option value="nexus360_default">P12: Default Liberado</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Status:</span>
                  <select 
                    value={filtroDivergencia} 
                    onChange={(e) => setFiltroDivergencia(e.target.value)}
                    className="text-xs border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="todas">Todas</option>
                    <option value="matches">✓ Matches ({simulationResults.stats.matches})</option>
                    <option value="divergencias">⚠️ Divergências ({simulationResults.stats.divergencias})</option>
                    <option value="criticos">🚨 Críticos ({simulationResults.stats.criticosFalsoNegativo})</option>
                  </select>
                </div>
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
                  <th className="px-2 py-1 text-center w-24">Atual</th>
                  <th className="px-2 py-1 text-center w-24">Nexus</th>
                  <th className="px-2 py-1 text-left w-32">Regra Nexus</th>
                  <th className="px-2 py-1 text-left w-40">Código Decisão</th>
                  <th className="px-2 py-1 text-left">Status</th>
                  <th className="px-2 py-1 text-center w-16">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
               {simulationResults.resultados
                 .filter(res => {
                   // Filtro por regra
                   if (filtroRegra !== 'todas') {
                     const regraNexus = res.nexusDecisionPath?.[0]?.split(':')[1];
                     if (regraNexus !== filtroRegra) return false;
                   }
                   
                   // Filtro por divergência
                   if (filtroDivergencia === 'matches' && !res.isMatch) return false;
                   if (filtroDivergencia === 'divergencias' && res.isMatch) return false;
                   if (filtroDivergencia === 'criticos' && res.severity !== 'error') return false;
                   
                   return true;
                 })
                 .map((res) => {
                 const thread = threads.find(t => t.id === res.threadId);
                 const contato = thread?.contact_id ? contatos.find(c => c.id === thread.contact_id) : null;
                 const hasUnread = (thread?.unread_count || 0) > 0;

                 // Nome formatado
                 let nomeExibicao = "";
                 if (contato) {
                   if (contato.empresa) nomeExibicao = contato.empresa;
                   if (contato.cargo) nomeExibicao = nomeExibicao ? nomeExibicao + " - " + contato.cargo : contato.cargo;
                   if (contato.nome && contato.nome !== contato.telefone) nomeExibicao = nomeExibicao ? nomeExibicao + " - " + contato.nome : contato.nome;
                   if (!nomeExibicao) nomeExibicao = contato.telefone || res.contactName || "Sem nome";
                 } else {
                   nomeExibicao = res.contactName || "Thread";
                 }

                 return (
                   <React.Fragment key={res.threadId}>
                   <tr className={res.isMatch ? "hover:bg-slate-50" : res.severity === 'error' ? "bg-red-50" : "bg-amber-50"}>
                     <td className="px-2 py-1">
                       <div className="flex items-center gap-2">
                         <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow-sm overflow-hidden ${
                           hasUnread ? 'bg-gradient-to-br from-orange-400 to-red-500' : 'bg-slate-400'
                         }`}>
                           {contato?.foto_perfil_url ? (
                             <img src={contato.foto_perfil_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                           ) : (
                             nomeExibicao.charAt(0).toUpperCase()
                           )}
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-1">
                             <h3 className="font-semibold text-[11px] text-slate-900 truncate">{nomeExibicao}</h3>
                             <span className="text-[9px] text-slate-400">{formatarHorario(thread?.last_message_at)}</span>
                           </div>
                           <div className="flex items-center gap-1">
                             <Badge variant="outline" className="text-[9px] h-3 px-1">
                               {res.threadType === 'contact_external' ? 'Ext' : res.threadType === 'team_internal' ? '1:1' : 'Grp'}
                             </Badge>
                             {thread?.assigned_user_id && (
                               <Badge className="bg-indigo-500 text-white text-[9px] h-3 px-1">
                                 <UserCheck className="w-2 h-2" />
                               </Badge>
                             )}
                           </div>
                         </div>
                       </div>
                     </td>

                    <td className="px-2 py-1 text-center">
                      {res.legacyDecision ? (
                        <Eye className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-400 mx-auto" />
                      )}
                    </td>

                    <td className="px-2 py-1 text-center">
                      {res.nexusDecision ? (
                        <Eye className="w-4 h-4 text-indigo-600 mx-auto" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-400 mx-auto" />
                      )}
                    </td>

                    <td className="px-2 py-1">
                      <Badge variant="outline" className="text-[9px] font-mono">
                        {res.nexusDecisionPath?.[0]?.split(':')[1] || 'N/A'}
                      </Badge>
                    </td>

                    <td className="px-2 py-1">
                      <code className="text-[9px] text-purple-700 font-mono bg-purple-50 px-1 py-0.5 rounded">
                        {res.nexusReasonCode || 'N/A'}
                      </code>
                    </td>

                    <td className="px-2 py-1">
                      {res.isMatch ? (
                        <div className="flex items-center gap-1 text-emerald-600 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          MATCH
                        </div>
                      ) : (
                        <div className={`flex items-center gap-1 text-[10px] font-bold ${res.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                          <AlertTriangle className="w-3 h-3" />
                          {res.severity === 'error' ? 'CRÍTICO' : 'ALERTA'}
                        </div>
                      )}
                    </td>

                    <td className="px-2 py-1 text-center">
                     <div className="flex gap-1 justify-center">
                       <Button
                         size="sm"
                         variant="ghost"
                         onClick={() => setThreadExpandida(threadExpandida === res.threadId ? null : res.threadId)}
                         className="h-6 w-6 p-0"
                         title="Ver detalhes"
                       >
                         <Info className="w-3 h-3 text-slate-400" />
                       </Button>
                       <Button
                         size="sm"
                         variant="ghost"
                         onClick={() => {
                           if (contato?.telefone) {
                             setTelefoneParaCorrigir(contato.telefone);
                             setModalCorrecaoOpen(true);
                           } else {
                             toast.error('Contato sem telefone');
                           }
                         }}
                         className="h-6 w-6 p-0"
                         title="Corrigir duplicatas"
                       >
                         <Users className="w-3 h-3 text-purple-600" />
                       </Button>
                     </div>
                    </td>
                    </tr>
                    {threadExpandida === res.threadId && (
                    <tr className="bg-slate-50">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {/* Coluna Esquerda: Sistema Atual */}
                          <div className="space-y-2">
                            <h4 className="font-bold text-slate-700 flex items-center gap-2">
                              <Eye className="w-4 h-4 text-emerald-600" />
                              Sistema Atual (Legado)
                            </h4>
                            <div className="bg-white rounded p-2 border">
                              <div className="text-[10px] space-y-1">
                                <div><span className="font-semibold">Decisão:</span> {res.legacyDecision ? '✅ VISÍVEL' : '🔒 BLOQUEADO'}</div>
                                <div><span className="font-semibold">Motivo:</span> {res.legacyMotivo}</div>
                              </div>
                            </div>
                          </div>

                          {/* Coluna Direita: Nexus360 */}
                          <div className="space-y-2">
                            <h4 className="font-bold text-slate-700 flex items-center gap-2">
                              <Zap className="w-4 h-4 text-indigo-600" />
                              Nexus360
                            </h4>
                            <div className="bg-white rounded p-2 border border-indigo-200">
                              <div className="text-[10px] space-y-1">
                                <div><span className="font-semibold">Decisão:</span> {res.nexusDecision ? '✅ VISÍVEL' : '🔒 BLOQUEADO'}</div>
                                <div><span className="font-semibold">Motivo:</span> {res.nexusMotivo}</div>
                                <div><span className="font-semibold">Caminho:</span> <Badge variant="outline" className="text-[9px] font-mono">{res.nexusDecisionPath?.[0]}</Badge></div>
                                <div><span className="font-semibold">Código:</span> <code className="text-purple-700 font-mono bg-purple-50 px-1 rounded">{res.nexusReasonCode}</code></div>
                              </div>
                            </div>
                          </div>

                          {/* Dados da Thread */}
                          <div className="col-span-2 mt-2">
                            <h4 className="font-bold text-slate-700 mb-1 flex items-center gap-2">
                              <Database className="w-4 h-4" />
                              Metadados da Thread
                            </h4>
                            <div className="bg-white rounded p-2 border">
                              <div className="grid grid-cols-3 gap-2 text-[10px]">
                                <div><span className="font-semibold">ID:</span> {thread?.id?.substring(0, 12)}...</div>
                                <div><span className="font-semibold">Tipo:</span> {res.threadType}</div>
                                <div><span className="font-semibold">Canal:</span> {thread?.channel || 'N/A'}</div>
                                <div><span className="font-semibold">Atribuído:</span> {thread?.assigned_user_id ? getUserDisplayName(thread.assigned_user_id, todosUsuarios) : 'Não'}</div>
                                <div><span className="font-semibold">Setor:</span> {thread?.sector_id || 'Sem setor'}</div>
                                <div><span className="font-semibold">Integração:</span> #{thread?.whatsapp_integration_id?.substring(0, 8) || 'N/A'}</div>
                                <div><span className="font-semibold">Fidelizado:</span> {contato?.is_cliente_fidelizado ? '✓ Sim' : 'Não'}</div>
                                <div><span className="font-semibold">Última msg:</span> {formatarHorario(thread?.last_message_at)}</div>
                                <div><span className="font-semibold">Não lidas:</span> {thread?.unread_count || 0}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      </tr>
                      )}
                      </React.Fragment>
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