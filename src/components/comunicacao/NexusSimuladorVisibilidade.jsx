import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  PlayCircle, AlertTriangle, CheckCircle2, Database, 
  RefreshCw, Zap, Eye, EyeOff, Info, TrendingUp, ArrowRightLeft, Users, User,
  CheckCheck, Image, Video, Mic, FileText, MapPin, Phone as PhoneIcon, UserCheck, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { executarAnaliseEmLote } from '@/components/lib/nexusComparator';
import { buildPolicyFromLegacyUser } from '@/components/lib/nexusLegacyConverter';
import { canUserSeeThreadBase } from '@/components/lib/permissionsService';
import { base44 } from '@/api/base44Client';
import { getUserDisplayName } from '../lib/userHelpers';
import UnificadorContatosCentralizado from './UnificadorContatosCentralizado';
import SeletorUnificacaoMultipla from './SeletorUnificacaoMultipla';

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
  const [mensagens, setMensagens] = useState([]);
  const [filtroRegra, setFiltroRegra] = useState('todas');
  const [filtroDivergencia, setFiltroDivergencia] = useState('todas');
  const [threadExpandida, setThreadExpandida] = useState(null);
  const [modalCorrecaoOpen, setModalCorrecaoOpen] = useState(false);
  const [contatoDragOrigem, setContatoDragOrigem] = useState(null);
  const [contatoDropDestino, setContatoDropDestino] = useState(null);
  const [filtroNomeContato, setFiltroNomeContato] = useState('');
  const [filtroUsuarioAtribuido, setFiltroUsuarioAtribuido] = useState('todos');
  const [filtroInstanciaWhatsApp, setFiltroInstanciaWhatsApp] = useState('todas');
  const [draggedThread, setDraggedThread] = useState(null);
  const [telefoneParaCorrigir, setTelefoneParaCorrigir] = useState(null);
  const [contatosSelecionadosMultiplos, setContatosSelecionadosMultiplos] = useState([]);
  const [modalUnificacaoAbertoMultipla, setModalUnificacaoAbertoMultipla] = useState(false);

  // Carregar lista de usuários e dados iniciais
  useEffect(() => {
    carregarUsuarios();
    recarregarDadosCompletos();
  }, []);

  const recarregarDadosCompletos = async () => {
    try {
      toast.info('🔄 Recarregando contatos e mensagens...');
      
      const [contacts, messages, threadsData] = await Promise.all([
        base44.entities.Contact.list(),
        base44.entities.Message.list(),
        base44.entities.MessageThread.list()
      ]);
      
      setContatos(contacts || []);
      setMensagens(messages || []);
      console.log('[SIMULADOR] ✅ Dados recarregados:', {
        contatos: contacts.length,
        mensagens: messages.length,
        threads: threadsData.length
      });
      
      toast.success(`✅ ${contacts.length} contatos e ${messages.length} mensagens carregadas`);
    } catch (error) {
      console.error('Erro ao recarregar dados:', error);
      toast.error('Erro ao recarregar dados');
    }
  };

  const handleCorrecaoConcluida = async () => {
    toast.info('🔄 Recarregando dados...');
    setModalCorrecaoOpen(false);
    setTelefoneParaCorrigir(null);
    setContatoDragOrigem(null);
    setContatoDropDestino(null);
    await recarregarDadosCompletos();
    setSimulationResults(null);
    toast.success('✅ Dados atualizados! Execute a simulação novamente.');
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
      
      // 🔍 DETECTAR PROBLEMAS CRÍTICOS DE INTEGRIDADE
      const mapaTelefones = new Map();
      const threadsSemContato = [];
      const threadsMensagensSuspeitas = [];
      const threadsContatoInvalido = [];
      const mensagensComProblemaVisibilidade = [];

      for (const thread of threadsParaAnalisar) {
        // Ignorar threads internas - elas não precisam de contact_id
        if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
          continue;
        }

        const contato = thread.contact_id ? contatos.find(c => c.id === thread.contact_id) : null;

        // ERRO CRÍTICO 1: Thread sem contact_id ou contato não encontrado
        if (!thread.contact_id || !contato) {
          threadsSemContato.push({
            threadId: thread.id,
            motivo: !thread.contact_id ? 'contact_id ausente' : 'Contato não encontrado no banco',
            thread
          });
          continue;
        }

        // ERRO CRÍTICO 2: Contato sem telefone ou telefone inválido
        if (!contato.telefone || contato.telefone.length < 10) {
          threadsContatoInvalido.push({
            threadId: thread.id,
            contactId: contato.id,
            telefone: contato.telefone || 'VAZIO',
            motivo: 'Telefone inválido/ausente',
            thread,
            contato
          });
          continue;
        }

        // ERRO CRÍTICO 3: Mensagens suspeitas
        const ultimaMsgRecente = thread.last_message_at && 
          (new Date() - new Date(thread.last_message_at)) < 24 * 60 * 60 * 1000;

        if ((thread.unread_count || 0) > 0 && !thread.last_message_content && !ultimaMsgRecente) {
          threadsMensagensSuspeitas.push({
            threadId: thread.id,
            contactId: contato.id,
            unread: thread.unread_count,
            motivo: 'Mensagens não lidas sem conteúdo',
            thread,
            contato
          });
        }

        // 🆕 ERRO CRÍTICO 4: Problemas de visibilidade nas mensagens (INTEGRIDADE DO BANCO)
        const mensagensDaThread = mensagens.filter(m => m.thread_id === thread.id);

        for (const mensagem of mensagensDaThread) {
          const problemas = [];

          // Problema 1: Campo visibility ausente ou undefined
          if (mensagem.visibility === undefined || mensagem.visibility === null) {
            problemas.push({
              tipo: 'visibility_undefined',
              descricao: 'Campo visibility ausente no banco de dados',
              severidade: 'error'
            });
          }

          // Problema 2: Valor de visibility inválido
          const valoresValidos = ['public_to_customer', 'internal_only'];
          if (mensagem.visibility && !valoresValidos.includes(mensagem.visibility)) {
            problemas.push({
              tipo: 'visibility_invalid',
              descricao: `Valor inválido: "${mensagem.visibility}" (esperado: public_to_customer ou internal_only)`,
              severidade: 'error'
            });
          }

          // Problema 3: Thread bloqueada mas mensagem está como public
          if (thread.bloqueado && mensagem.visibility === 'public_to_customer') {
            problemas.push({
              tipo: 'thread_blocked_public_message',
              descricao: 'Thread bloqueada mas mensagem marcada como pública (pode causar vazamento)',
              severidade: 'warning'
            });
          }

          // Se encontrou problemas, adicionar à lista
          if (problemas.length > 0) {
            mensagensComProblemaVisibilidade.push({
              messageId: mensagem.id,
              threadId: thread.id,
              contactId: contato.id,
              content: mensagem.content?.substring(0, 100) || '(sem conteúdo)',
              visibility: mensagem.visibility,
              problemas,
              mensagem,
              thread,
              contato
            });
          }
        }

        // Detecção de duplicatas
        if (contato.telefone) {
          if (!mapaTelefones.has(contato.telefone)) {
            mapaTelefones.set(contato.telefone, []);
          }
          mapaTelefones.get(contato.telefone).push({ thread, contato });
        }
      }
      
      // Identificar telefones com duplicatas
      const duplicatasDetectadas = Array.from(mapaTelefones.entries())
        .filter(([_, items]) => items.length > 1)
        .map(([telefone, items]) => ({
          telefone,
          count: items.length,
          threadIds: items.map(i => i.thread.id),
          contactIds: items.map(i => i.contato.id)
        }));
      
      // Executar análise comparativa
      const resultado = executarAnaliseEmLote(usuarioAtual, threadsParaAnalisar, integracoes);
      
      // Adicionar informação de problemas detectados ao resultado
      resultado.duplicatas = duplicatasDetectadas;
      resultado.threadsSemContato = threadsSemContato;
      resultado.threadsMensagensSuspeitas = threadsMensagensSuspeitas;
      resultado.threadsContatoInvalido = threadsContatoInvalido;
      resultado.mensagensComProblemaVisibilidade = mensagensComProblemaVisibilidade;

      resultado.stats.totalDuplicatas = duplicatasDetectadas.reduce((sum, d) => sum + d.count - 1, 0);
      resultado.stats.threadsSemContatoValido = threadsSemContato.length;
      resultado.stats.mensagensSuspeitas = threadsMensagensSuspeitas.length;
      resultado.stats.contatosInvalidos = threadsContatoInvalido.length;
      resultado.stats.mensagensComProblemaVisibilidade = mensagensComProblemaVisibilidade.length;
      resultado.stats.totalProblemas = threadsSemContato.length + threadsMensagensSuspeitas.length + threadsContatoInvalido.length + mensagensComProblemaVisibilidade.length;
      
      setSimulationResults(resultado);
      setLastRun(new Date());
      
      const { stats } = resultado;
      
      // Priorizar alertas críticos de perda de dados
      if (stats.totalProblemas > 0) {
        toast.error(`🚨 CRÍTICO: ${stats.totalProblemas} problemas graves detectados!`, {
          description: `${stats.threadsSemContatoValido} sem contato | ${stats.contatosInvalidos} contatos inválidos | ${stats.mensagensSuspeitas} msgs suspeitas | ${stats.mensagensComProblemaVisibilidade} msgs com problema de visibilidade`
        });
      } else if (stats.criticosFalsoNegativo > 0) {
        toast.error(`🚨 ${stats.criticosFalsoNegativo} falsos negativos críticos encontrados!`);
      } else if (stats.totalDuplicatas > 0) {
        toast.warning(`⚠️ ${stats.divergencias} divergências + ${stats.totalDuplicatas} contatos duplicados`);
      } else if (stats.divergencias === 0) {
        toast.success(`🎉 Perfeito! ${stats.total} threads analisadas - 100% de aderência`);
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
                <CardDescription className="text-xs">Compare Legado vs Nexus360 • {threads.length} threads • {mensagens.length} mensagens</CardDescription>
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
                variant="outline"
                onClick={recarregarDadosCompletos}
                className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs h-7 gap-1"
                title="Comparação Detalhada - Recarrega contatos e mensagens"
              >
                <MessageSquare className="w-3 h-3" />
                <span className="hidden sm:inline">Comparação Detalhada</span>
              </Button>
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
                let temDuplicata = false;
                let temMsgNaoVisivel = false;

                if (simulationResults && contato) {
                 const resultado = simulationResults.resultados.find(r => r.threadId === thread.id);
                 if (resultado && !resultado.isMatch) {
                   erroNexus = {
                     severity: resultado.severity,
                     descricao: resultado.nexusMotivo || 'Inconsistência detectada',
                     regra: resultado.nexusDecisionPath?.[0]?.split(':')[1] || 'N/A'
                   };
                 }

                 // Verificar se este contato tem duplicatas
                 if (contato?.telefone && simulationResults.duplicatas) {
                   const duplicata = simulationResults.duplicatas.find(d => d.telefone === contato.telefone);
                   temDuplicata = duplicata && duplicata.count > 1;
                 }

                 // Verificar se tem mensagens com problema de visibilidade
                 if (simulationResults.mensagensComProblemaVisibilidade) {
                   temMsgNaoVisivel = simulationResults.mensagensComProblemaVisibilidade.some(m => m.threadId === thread.id);
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
                        draggable
                        onDragStart={(e) => {
                          setDraggedThread({ thread, contato, integracao });
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (draggedThread && draggedThread.contato?.id !== contato?.id) {
                            console.log('[DRAG] Unificando:', draggedThread.contato?.nome, '→', contato?.nome);
                            setTelefoneParaCorrigir(null);
                            setContatoDragOrigem(draggedThread.contato);
                            setContatoDropDestino(contato);
                            setModalCorrecaoOpen(true);
                            setDraggedThread(null);
                          }
                        }}
                        className={`px-2 py-2 flex items-center gap-2 border-b border-slate-100 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 cursor-move transition-all group relative ${
                          draggedThread?.thread.id === thread.id ? 'opacity-50 bg-blue-100' : ''
                        } ${erroNexus ? (erroNexus.severity === 'error' ? 'bg-red-50/50' : 'bg-amber-50/50') : ''} ${temMsgNaoVisivel ? 'border-l-4 border-l-orange-500' : ''}`}
                        title={draggedThread?.thread.id === thread.id ? '🔄 Arraste para outro contato para unificar' : erroNexus ? `❌ ${erroNexus.descricao}` : ''}
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

                          {/* 🆕 Indicador de mensagens não visíveis */}
                          {temMsgNaoVisivel && (
                            <div 
                              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-md bg-orange-600 animate-pulse"
                              title="Mensagens não visíveis detectadas"
                            >
                              <EyeOff className="w-2.5 h-2.5 text-white" />
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
                            {temMsgNaoVisivel && (
                              <Badge className="bg-orange-600 text-white text-[9px] h-3 px-1">
                                <EyeOff className="w-2 h-2 mr-0.5" />
                                Msgs
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
                            {temMsgNaoVisivel && (
                              <Badge className="bg-orange-600 text-white text-[9px] h-3 px-1">
                                <EyeOff className="w-2 h-2 mr-0.5" />
                                Vis
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
                          {temMsgNaoVisivel && (
                           <div className="mt-1 text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">
                             Problemas de visibilidade detectados
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

                          {temMsgNaoVisivel && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                const msgsThread = simulationResults.mensagensComProblemaVisibilidade?.filter(m => m.threadId === thread.id);
                                toast.info(`${msgsThread?.length || 0} mensagens com problema detectadas`);
                              }}
                              className="h-6 w-6 p-0 shadow-md bg-orange-600 hover:bg-orange-700 border-2 border-orange-700 animate-pulse"
                              title="🚨 MENSAGENS COM PROBLEMA - Clique para detalhes"
                            >
                              <EyeOff className="w-3 h-3 text-white font-bold" />
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (contato?.telefone) {
                                console.log('[DUPLICATAS] Abrindo correção para telefone:', contato.telefone);
                                setContatoDragOrigem(null);
                                setContatoDropDestino(null);
                                setTelefoneParaCorrigir(contato.telefone);
                                setModalCorrecaoOpen(true);
                              } else {
                                toast.error('Contato sem telefone');
                              }
                            }}
                            className={`h-6 w-6 p-0 shadow-md border ${
                              temDuplicata 
                                ? 'bg-red-600 hover:bg-red-700 border-red-700 animate-pulse' 
                                : 'bg-white hover:bg-purple-50 border-slate-200'
                            }`}
                            title={temDuplicata ? '🚨 DUPLICATAS DETECTADAS - Clique para corrigir' : 'Corrigir duplicatas'}
                          >
                            <Users className={`w-3 h-3 ${temDuplicata ? 'text-white' : 'text-purple-600'}`} />
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-700">Regra:</span>
                  <select 
                    value={filtroRegra} 
                    onChange={(e) => setFiltroRegra(e.target.value)}
                    className="text-xs border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="todas">Todas as Regras</option>
                    <option value="admin_total">P2: Admin Total</option>
                    <option value="assigned_to_me">P3: Atribuída a Mim</option>
                    <option value="loyalty_contact">P4: Fidelizado</option>
                    <option value="janela_24h">P5: Janela 24h</option>
                    <option value="blocked_loyalty">P6: Bloq. Fidelizado Outro</option>
                    <option value="blocked_assigned">P7: Bloq. Atribuído Outro</option>
                    <option value="gerente_supervisao">P8: Gerente Supervisão</option>
                    <option value="blocked_integration">P9: Bloqueio Integração</option>
                    <option value="blocked_sector">P10: Bloqueio Setor</option>
                    <option value="blocked_connection">P11: Bloqueio Conexão</option>
                    <option value="nexus360_default">P12: Default Liberado</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
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
                     <option value="sem_contato">🚨 Sem contato válido ({simulationResults.stats.threadsSemContatoValido || 0})</option>
                     <option value="contato_invalido">🚨 Contato inválido ({simulationResults.stats.contatosInvalidos || 0})</option>
                     <option value="msg_suspeita">🚨 Mensagens suspeitas ({simulationResults.stats.mensagensSuspeitas || 0})</option>
                     <option value="problema_visibilidade">🔶 Problemas de visibilidade ({simulationResults.stats.mensagensComProblemaVisibilidade || 0})</option>
                     <option value="todos_problemas">🚨 TODOS OS PROBLEMAS ({simulationResults.stats.totalProblemas || 0})</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-700">Nome Contato:</span>
                  <input
                    type="text"
                    value={filtroNomeContato}
                    onChange={(e) => setFiltroNomeContato(e.target.value)}
                    placeholder="Buscar por nome..."
                    className="text-xs border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-700">Usuário:</span>
                  <select 
                    value={filtroUsuarioAtribuido} 
                    onChange={(e) => setFiltroUsuarioAtribuido(e.target.value)}
                    className="text-xs border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="todos">Todos os usuários</option>
                    <option value="nao_atribuido">Não atribuídas</option>
                    {todosUsuarios.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-700">Instância:</span>
                  <select 
                    value={filtroInstanciaWhatsApp} 
                    onChange={(e) => setFiltroInstanciaWhatsApp(e.target.value)}
                    className="text-xs border border-slate-300 rounded px-3 py-1.5 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="todas">Todas as instâncias</option>
                    {integracoes.map(integ => (
                      <option key={integ.id} value={integ.id}>
                        {integ.nome_instancia} ({integ.numero_telefone?.slice(-4) || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Indicador de filtros ativos */}
              {(filtroNomeContato || filtroUsuarioAtribuido !== 'todos' || filtroInstanciaWhatsApp !== 'todas') && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <Badge variant="outline" className="bg-purple-50">
                    Filtros ativos: {[
                      filtroNomeContato && 'Nome',
                      filtroUsuarioAtribuido !== 'todos' && 'Usuário',
                      filtroInstanciaWhatsApp !== 'todas' && 'Instância'
                    ].filter(Boolean).join(' • ')}
                  </Badge>
                  <button
                    onClick={() => {
                      setFiltroNomeContato('');
                      setFiltroUsuarioAtribuido('todos');
                      setFiltroInstanciaWhatsApp('todas');
                      toast.info('Filtros resetados');
                    }}
                    className="text-purple-600 hover:text-purple-700 underline"
                  >
                    Limpar
                  </button>
                </div>
              )}
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
            {/* Barra de ações para múltipla seleção */}
            {contatosSelecionadosMultiplos.length > 0 && (
              <div className="bg-indigo-50 border-b border-indigo-200 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-700">
                  {contatosSelecionadosMultiplos.length} contato(s) selecionado(s)
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setContatosSelecionadosMultiplos([])}
                    className="text-xs h-7"
                  >
                    Limpar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      // Deduplicar antes de abrir
                      const unicos = Array.from(
                        new Map(contatosSelecionadosMultiplos.map(c => [c.id, c])).values()
                      );
                      setContatosSelecionadosMultiplos(unicos);
                      setModalUnificacaoAbertoMultipla(true);
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-xs h-7"
                  >
                    🔗 Unificar Múltiplos
                  </Button>
                </div>
              </div>
            )}

            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold text-[10px]">
                <tr>
                  <th className="px-2 py-1 text-center w-6">
                    <input
                      type="checkbox"
                      checked={contatosSelecionadosMultiplos.length === simulationResults.resultados.length && simulationResults.resultados.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const contatos = simulationResults.resultados
                            .map(res => {
                              const thread = threads.find(t => t.id === res.threadId);
                              return thread?.contact_id ? contatos.find(c => c.id === thread.contact_id) : null;
                            })
                            .filter((c, idx, arr) => c && arr.findIndex(x => x?.id === c.id) === idx);
                          setContatosSelecionadosMultiplos(contatos);
                        } else {
                          setContatosSelecionadosMultiplos([]);
                        }
                      }}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </th>
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
                   const thread = threads.find(t => t.id === res.threadId);
                   const contato = thread?.contact_id ? contatos.find(c => c.id === thread.contact_id) : null;

                   // Filtros de problemas graves
                   if (filtroDivergencia === 'sem_contato') {
                     return simulationResults.threadsSemContato?.some(t => t.threadId === res.threadId);
                   }
                   if (filtroDivergencia === 'contato_invalido') {
                     return simulationResults.threadsContatoInvalido?.some(t => t.threadId === res.threadId);
                   }
                   if (filtroDivergencia === 'msg_suspeita') {
                     return simulationResults.threadsMensagensSuspeitas?.some(t => t.threadId === res.threadId);
                   }
                   if (filtroDivergencia === 'problema_visibilidade') {
                     return simulationResults.mensagensComProblemaVisibilidade?.some(m => m.threadId === res.threadId);
                   }
                   if (filtroDivergencia === 'todos_problemas') {
                     return simulationResults.threadsSemContato?.some(t => t.threadId === res.threadId) ||
                            simulationResults.threadsContatoInvalido?.some(t => t.threadId === res.threadId) ||
                            simulationResults.threadsMensagensSuspeitas?.some(t => t.threadId === res.threadId) ||
                            simulationResults.mensagensComProblemaVisibilidade?.some(m => m.threadId === res.threadId);
                   }

                   // Filtro por regra
                   if (filtroRegra !== 'todas') {
                     const regraNexus = res.nexusDecisionPath?.[0]?.split(':')[1];
                     if (regraNexus !== filtroRegra) return false;
                   }

                   // Filtro por divergência
                   if (filtroDivergencia === 'matches' && !res.isMatch) return false;
                   if (filtroDivergencia === 'divergencias' && res.isMatch) return false;
                   if (filtroDivergencia === 'criticos' && res.severity !== 'error') return false;

                   // Filtro por nome do contato
                   if (filtroNomeContato.trim()) {
                     const nomeContato = contato?.nome?.toLowerCase() || res.contactName?.toLowerCase() || '';
                     if (!nomeContato.includes(filtroNomeContato.toLowerCase())) return false;
                   }

                   // Filtro por usuário atribuído
                   if (filtroUsuarioAtribuido !== 'todos') {
                     if (filtroUsuarioAtribuido === 'nao_atribuido') {
                       if (thread?.assigned_user_id) return false;
                     } else {
                       if (thread?.assigned_user_id !== filtroUsuarioAtribuido) return false;
                     }
                   }

                   // Filtro por instância WhatsApp
                   if (filtroInstanciaWhatsApp !== 'todas') {
                     if (thread?.whatsapp_integration_id !== filtroInstanciaWhatsApp) return false;
                   }

                   return true;
                 })
                 .map((res) => {
                 const thread = threads.find(t => t.id === res.threadId);
                 const contato = thread?.contact_id ? contatos.find(c => c.id === thread.contact_id) : null;
                 const hasUnread = (thread?.unread_count || 0) > 0;

                 // Verificar se há duplicatas para este contato
                 const temDuplicataTabela = contato?.telefone && simulationResults.duplicatas?.find(d => d.telefone === contato.telefone && d.count > 1);

                 // Detectar problemas graves
                 const semContato = simulationResults.threadsSemContato?.find(t => t.threadId === res.threadId);
                 const contatoInvalido = simulationResults.threadsContatoInvalido?.find(t => t.threadId === res.threadId);
                 const msgSuspeita = simulationResults.threadsMensagensSuspeitas?.find(t => t.threadId === res.threadId);
                 const msgsVisibilidade = simulationResults.mensagensComProblemaVisibilidade?.filter(m => m.threadId === res.threadId);
                 const temProblemaGrave = semContato || contatoInvalido || msgSuspeita || (msgsVisibilidade && msgsVisibilidade.length > 0);

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
                   <tr className={`${
                     temProblemaGrave ? 'bg-red-100 border-red-300 border-2' :
                     res.isMatch ? "hover:bg-slate-50" : 
                     res.severity === 'error' ? "bg-red-50" : "bg-amber-50"
                   }`}>
                     <td className="px-2 py-1 text-center">
                       <input
                         type="checkbox"
                         checked={contatosSelecionadosMultiplos.some(c => c?.id === contato?.id)}
                         onChange={(e) => {
                           if (e.target.checked && contato) {
                             setContatosSelecionadosMultiplos(prev => 
                               prev.find(c => c.id === contato.id) ? prev : [...prev, contato]
                             );
                           } else {
                             setContatosSelecionadosMultiplos(prev =>
                               prev.filter(c => c.id !== contato?.id)
                             );
                           }
                         }}
                         className="w-4 h-4 rounded cursor-pointer"
                       />
                     </td>
                     <td className="px-2 py-1">
                       <div className="flex items-center gap-2">
                         {temProblemaGrave && (
                           <Badge className="bg-red-600 text-white text-[10px] px-1 py-0 font-bold animate-pulse">
                             🚨
                           </Badge>
                         )}
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
                             <h3 className={`font-semibold text-[11px] truncate ${temProblemaGrave ? 'text-red-700 font-bold' : 'text-slate-900'}`}>
                               {nomeExibicao}
                             </h3>
                             <span className="text-[9px] text-slate-400">{formatarHorario(thread?.last_message_at)}</span>
                           </div>
                           {/* Mostrar motivo do problema logo abaixo do nome */}
                           {temProblemaGrave && (
                             <p className="text-[10px] text-red-600 font-semibold">
                               ⚠️ {semContato?.motivo || contatoInvalido?.motivo || msgSuspeita?.motivo || (msgsVisibilidade && `${msgsVisibilidade.length} msgs com problema de visibilidade`)}
                             </p>
                           )}
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
                             console.log('[DUPLICATAS] Abrindo correção para telefone:', contato.telefone);
                             setContatoDragOrigem(null);
                             setContatoDropDestino(null);
                             setTelefoneParaCorrigir(contato.telefone);
                             setModalCorrecaoOpen(true);
                           } else {
                             toast.error('Contato sem telefone');
                           }
                         }}
                         className={`h-6 w-6 p-0 shadow-md ${
                           temDuplicataTabela 
                             ? 'bg-red-600 hover:bg-red-700 border-2 border-red-700 animate-pulse' 
                             : 'bg-white hover:bg-purple-50 border border-slate-200'
                         }`}
                         title={temDuplicataTabela ? `🚨 ${temDuplicataTabela.count} DUPLICATAS - Clique para corrigir` : 'Corrigir duplicatas'}
                       >
                         <Users className={`w-3 h-3 font-bold ${temDuplicataTabela ? 'text-white' : 'text-purple-600'}`} />
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

                          {/* 🆕 Problemas de Visibilidade */}
                          {msgsVisibilidade && msgsVisibilidade.length > 0 && (
                            <div className="col-span-2 mt-2">
                              <h4 className="font-bold text-orange-700 mb-1 flex items-center gap-2">
                                <EyeOff className="w-4 h-4" />
                                Mensagens com Problema de Visibilidade ({msgsVisibilidade.length})
                              </h4>
                              <div className="bg-orange-50 rounded p-2 border border-orange-200 max-h-40 overflow-y-auto space-y-2">
                                {msgsVisibilidade.map((msgProblema, idx) => (
                                  <div key={idx} className="bg-white rounded p-2 border border-orange-300">
                                    <div className="text-[10px] space-y-1">
                                      <div className="font-semibold text-orange-800">Msg #{msgProblema.messageId.substring(0, 12)}...</div>
                                      <div className="text-slate-600">{msgProblema.content}</div>
                                      <div className="flex items-center gap-1 text-[9px]">
                                        <Badge variant="outline" className="text-[8px]">
                                          visibility: {msgProblema.visibility || 'undefined'}
                                        </Badge>
                                      </div>
                                      {msgProblema.problemas.map((prob, pIdx) => (
                                        <div key={pIdx} className={`text-[9px] px-2 py-1 rounded ${
                                          prob.severidade === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                          <span className="font-semibold">{prob.tipo}:</span> {prob.descricao}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

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

      {/* MODAL: Correção de Duplicatas */}
      <Dialog open={modalCorrecaoOpen} onOpenChange={setModalCorrecaoOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Unificação de Contatos - Correção de Duplicatas
            </DialogTitle>
          </DialogHeader>
          <UnificadorContatosCentralizado 
            telefoneInicial={telefoneParaCorrigir}
            contatoOrigem={contatoDragOrigem} 
            contatoDestino={contatoDropDestino}
            isAdmin={usuario?.role === 'admin'}
            onClose={handleCorrecaoConcluida}
          />
        </DialogContent>
      </Dialog>

      {/* MODAL: Unificação Múltipla */}
      <SeletorUnificacaoMultipla
        isOpen={modalUnificacaoAbertoMultipla}
        onClose={() => {
          setModalUnificacaoAbertoMultipla(false);
          setContatosSelecionadosMultiplos([]);
          setSimulationResults(null); // 🆕 Limpar resultados antigos
          recarregarDadosCompletos(); // Recarrega contatos/threads
        }}
        contatosSelecionados={contatosSelecionadosMultiplos}
      />


    </div>
  );
}