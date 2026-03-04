import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, Phone, Search, Merge, CheckCircle2, 
  AlertTriangle, User, MessageSquare, Calendar, ArrowRight, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { normalizarTelefone } from '../lib/phoneUtils';

/**
 * COMPONENTE CENTRALIZADO DE UNIFICAÇÃO DE CONTATOS
 * ════════════════════════════════════════════════════
 * - Única fonte de verdade para unificação manual
 * - Usa função backend mergeContacts.js
 * - Interface simples: buscar telefone → escolher mestre → unificar
 * - Substitui: UnificadorContatosManual, GerenciadorDuplicatas, 
 *   GerenciadorDuplicatasUnificado, AnalisadorContatosDuplicados
 */
export default function UnificadorContatosCentralizado({ 
  telefoneInicial = null, 
  contatoOrigem = null,  // ORIGEM (será deletado)
  contatoDestino = null, // DESTINO (receberá tudo - MESTRE)
  onClose = null,
  isAdmin = false 
}) {
  const [telefone, setTelefone] = useState(telefoneInicial || '');
  const [buscando, setBuscando] = useState(false);
  const [unificando, setUnificando] = useState(false);
  const [duplicatas, setDuplicatas] = useState([]);
  const [mestreEscolhido, setMestreEscolhido] = useState(null);
  const [estatisticas, setEstatisticas] = useState(null);

  // ════════════════════════════════════════════════════════════════════════
  // BUSCAR DUPLICATAS POR TELEFONE
  // ════════════════════════════════════════════════════════════════════════
  const buscarDuplicatas = async (tel = telefone) => {
    setBuscando(true);
    setDuplicatas([]);
    setMestreEscolhido(null);
    setEstatisticas(null);

    try {
      const normalizado = normalizarTelefone(tel);
      if (!normalizado || normalizado.length < 10) {
        toast.error('Telefone inválido');
        return;
      }

      // Gerar variações do telefone para busca completa
      const variacoes = gerarVariacoes(normalizado);
      const contatosEncontrados = [];

      for (const variacao of variacoes) {
        const resultado = await base44.entities.Contact.filter({ telefone: variacao });
        contatosEncontrados.push(...resultado);
      }

      // Remover duplicatas por ID
      const unicos = Array.from(
        new Map(contatosEncontrados.map(c => [c.id, c])).values()
      );

      // Filtrar contatos já merged
      const validos = unicos.filter(c => 
        !c.tags?.includes('merged') && 
        !c.motivo_bloqueio?.includes('[AUTO-MERGE]') &&
        !c.observacoes?.includes('[MERGED')
      );

      if (validos.length === 0) {
        toast.info('Nenhum contato encontrado');
        return;
      }

      if (validos.length === 1) {
        toast.success('✅ Apenas 1 contato encontrado - não há duplicatas');
        return;
      }

      // Buscar estatísticas para cada contato
      const comStats = await Promise.all(
        validos.map(async (contato) => {
          const threads = await base44.entities.MessageThread.filter({ contact_id: contato.id });
          const mensagens = await base44.entities.Message.filter(
            { sender_id: contato.id, sender_type: 'contact' },
            '-sent_at',
            100
          );
          const interacoes = await base44.entities.Interacao.filter(
            { contact_id: contato.id },
            '-created_date',
            50
          );

          return {
            ...contato,
            stats: {
              threads: threads.length,
              mensagens: mensagens.length,
              interacoes: interacoes.length,
              ultimaAtualizacao: contato.updated_date || contato.created_date
            }
          };
        })
      );

      // Ordenar por relevância (mais threads/mensagens = mais relevante)
      comStats.sort((a, b) => {
        const scoreA = a.stats.threads * 10 + a.stats.mensagens + a.stats.interacoes * 5;
        const scoreB = b.stats.threads * 10 + b.stats.mensagens + b.stats.interacoes * 5;
        return scoreB - scoreA;
      });

      setDuplicatas(comStats);
      setMestreEscolhido(comStats[0].id); // Sugerir o mais relevante
      
      toast.success(`📋 ${comStats.length} contatos encontrados`);
    } catch (error) {
      console.error('[UnificadorCentralizado] Erro:', error);
      toast.error(`Erro ao buscar: ${error.message}`);
    } finally {
      setBuscando(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // UNIFICAR CONTATOS (CHAMA BACKEND)
  // ════════════════════════════════════════════════════════════════════════
  const unificarContatos = async () => {
    if (!mestreEscolhido || duplicatas.length < 2) {
      toast.error('Selecione o contato mestre');
      return;
    }

    const mestre = duplicatas.find(c => c.id === mestreEscolhido);
    const duplicatasIds = duplicatas.filter(c => c.id !== mestreEscolhido).map(c => c.id);

    const totalThreads = duplicatasIds.reduce((sum, id) => {
      const dup = duplicatas.find(c => c.id === id);
      return sum + (dup?.stats.threads || 0);
    }, 0);

    const totalMensagens = duplicatasIds.reduce((sum, id) => {
      const dup = duplicatas.find(c => c.id === id);
      return sum + (dup?.stats.mensagens || 0);
    }, 0);

    if (!confirm(
      `⚠️ CONFIRMAR UNIFICAÇÃO?\n\n` +
      `🎯 MESTRE: ${mestre.nome || mestre.telefone}\n` +
      `📋 DUPLICATAS: ${duplicatasIds.length}\n` +
      `🧵 Threads: ${totalThreads}\n` +
      `💬 Mensagens: ${totalMensagens}\n\n` +
      `Esta ação:\n` +
      `✓ Moverá todas threads/mensagens para o mestre\n` +
      `✓ Deletará as duplicatas\n` +
      `✓ É IRREVERSÍVEL\n\n` +
      `Continuar?`
    )) {
      return;
    }

    setUnificando(true);
    const loadingToast = toast.loading('🔄 Unificando contatos...');

    try {
      console.log('[UnificadorCentralizado] Iniciando unificação...', {
        masterContactId: mestreEscolhido,
        duplicateContactIds: duplicatasIds
      });

      // ✅ CHAMAR FUNÇÃO BACKEND CENTRALIZADA
      const response = await base44.functions.invoke('mergeContacts', {
        masterContactId: mestreEscolhido,
        duplicateContactIds: duplicatasIds
      });

      console.log('[UnificadorCentralizado] Resposta recebida:', response);

      // Verificar se há dados na resposta
      if (!response || !response.data) {
        throw new Error('Resposta vazia da função backend');
      }

      const { success, error, stats, masterContactName } = response.data;

      if (success) {
        toast.dismiss(loadingToast);
        toast.success(
          `✅ UNIFICAÇÃO CONCLUÍDA!\n\n` +
          `📊 Estatísticas:\n` +
          `→ ${stats.duplicatasProcessadas || 0} duplicatas removidas\n` +
          `→ ${stats.threadsMovidas || 0} threads movidas\n` +
          `→ ${stats.mensagensMovidas || 0} mensagens movidas\n` +
          `→ ${stats.interacoesMovidas || 0} interações movidas\n\n` +
          `🎯 Contato mestre: ${masterContactName || 'N/A'}`,
          { duration: 6000 }
        );

        setEstatisticas(stats);
        setDuplicatas([]);
        setMestreEscolhido(null);

        if (onClose) {
          setTimeout(onClose, 2000);
        }
      } else {
        throw new Error(error || 'Erro desconhecido na unificação');
      }
    } catch (error) {
      console.error('[UnificadorCentralizado] Erro na unificação:', error);
      toast.dismiss(loadingToast);
      
      // Mensagem de erro mais detalhada
      const errorMsg = error.message || 'Erro desconhecido';
      const isNetworkError = errorMsg.includes('fetch') || errorMsg.includes('network');
      
      toast.error(
        `❌ Falha na unificação\n\n` +
        `${isNetworkError ? '🌐 Erro de conexão' : '⚠️ Erro no processamento'}\n` +
        `Detalhes: ${errorMsg}\n\n` +
        `Verifique o console para mais informações.`,
        { duration: 8000 }
      );
    } finally {
      setUnificando(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // GERAR VARIAÇÕES DE TELEFONE PARA BUSCA
  // ════════════════════════════════════════════════════════════════════════
  const gerarVariacoes = (tel) => {
    const limpo = tel.replace(/\D/g, '');
    const variacoes = new Set([tel, limpo, '+' + limpo]);

    if (limpo.startsWith('55')) {
      if (limpo.length === 13) {
        // Com 9: gerar versão SEM o 9
        const sem9 = limpo.substring(0, 4) + limpo.substring(5);
        variacoes.add('+' + sem9);
        variacoes.add(sem9);
      }
      if (limpo.length === 12) {
        // Sem 9: gerar versão COM o 9
        const com9 = limpo.substring(0, 4) + '9' + limpo.substring(4);
        variacoes.add('+' + com9);
        variacoes.add(com9);
      }
      variacoes.add('+55' + limpo.substring(2));
    }

    return Array.from(variacoes);
  };

  // ════════════════════════════════════════════════════════════════════════
  // CARREGAR DADOS INICIAIS (DRAG-AND-DROP OU TELEFONE)
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (contatoOrigem && contatoDestino) {
      // Modo drag-and-drop: buscar estatísticas completas
      carregarStatsDragDrop();
    } else if (telefoneInicial) {
      buscarDuplicatas(telefoneInicial);
    }
  }, [telefoneInicial, contatoOrigem, contatoDestino]);

  const carregarStatsDragDrop = async () => {
    setBuscando(true);
    try {
      // ✅ ORDEM IMPORTANTE: [DESTINO (mestre), ORIGEM (será deletado)]
      // Destino recebe: threads, msgs, interações, dados do origem
      const contatosParaAnalisar = [contatoDestino, contatoOrigem];
      
      // Buscar estatísticas completas para cada contato
      const comStats = await Promise.all(
        contatosParaAnalisar.map(async (contato) => {
          const threads = await base44.entities.MessageThread.filter({ contact_id: contato.id });
          const mensagens = await base44.entities.Message.filter(
            { sender_id: contato.id, sender_type: 'contact' },
            '-sent_at',
            100
          );
          const interacoes = await base44.entities.Interacao.filter(
            { contact_id: contato.id },
            '-created_date',
            50
          );

          return {
            ...contato,
            stats: {
              threads: threads.length,
              mensagens: mensagens.length,
              interacoes: interacoes.length,
              ultimaAtualizacao: contato.updated_date || contato.created_date
            }
          };
        })
      );

      setDuplicatas(comStats);
      // ✅ FORÇAR: contatoDestino SEMPRE é o mestre
      setMestreEscolhido(contatoDestino.id);
      
      toast.success(
        `✅ Pronto para unificar!\n\n` +
        `🎯 MESTRE (mantém tudo): ${contatoDestino.nome || 'Sem nome'}\n` +
        `🗑️ ORIGEM (será deletado): ${contatoOrigem.nome || 'Sem nome'}\n\n` +
        `⚠️ Cuidado: Esta ação é IRREVERSÍVEL`,
        { duration: 5000 }
      );
    } catch (error) {
      console.error('[UnificadorCentralizado] Erro ao carregar stats drag-drop:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setBuscando(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDERIZAÇÃO
  // ════════════════════════════════════════════════════════════════════════
  if (!isAdmin) {
    return (
      <Alert className="bg-red-50 border-red-200">
        <AlertTriangle className="w-4 h-4 text-red-600" />
        <AlertDescription className="text-red-700 ml-2">
          Apenas administradores podem unificar contatos
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* HEADER COM BUSCA */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
            <Merge className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Unificador de Contatos Centralizado</h2>
            <p className="text-indigo-100 text-sm">Busque duplicatas por telefone e unifique em um único contato</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Digite o telefone (ex: +5548999322400 ou 48999322400)"
              className="pl-12 h-12 text-base bg-white"
              onKeyPress={(e) => e.key === 'Enter' && buscarDuplicatas()}
            />
          </div>
          <Button
            onClick={() => buscarDuplicatas()}
            disabled={buscando || !telefone.trim()}
            size="lg"
            className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-6"
          >
            {buscando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Buscar Duplicatas
              </>
            )}
          </Button>
        </div>
      </div>

      {/* RESULTADO DE SUCESSO */}
      {estatisticas && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <AlertDescription className="ml-3">
            <p className="font-bold text-green-900">✅ Unificação Concluída!</p>
            <div className="grid grid-cols-4 gap-2 mt-2 text-sm text-green-700">
              <div>📊 Duplicatas: {estatisticas.duplicatasProcessadas}</div>
              <div>🧵 Threads: {estatisticas.threadsMovidas}</div>
              <div>💬 Mensagens: {estatisticas.mensagensMovidas}</div>
              <div>📝 Interações: {estatisticas.interacoesMovidas}</div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* VISUALIZAÇÃO DE DUPLICATAS */}
      {duplicatas.length >= 2 && (
        <div className="space-y-4">
          {/* RESUMO DO QUE SERÁ FEITO */}
          <Alert className="bg-indigo-50 border-indigo-200">
            <Info className="w-4 h-4 text-indigo-600" />
            <AlertDescription className="ml-3 text-indigo-900">
              <p className="font-bold mb-1">📋 {duplicatas.length} contatos encontrados para unificação</p>
              <p className="text-sm text-indigo-700">
                Selecione qual será o <strong>contato mestre</strong> (mantido). Os demais serão mesclados nele.
              </p>
            </AlertDescription>
          </Alert>

          {/* CARDS DOS CONTATOS - LAYOUT MELHORADO */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {duplicatas.map((contato, index) => {
              const isMestre = mestreEscolhido === contato.id;
              const seraDeletado = mestreEscolhido && mestreEscolhido !== contato.id;
              
              return (
                <Card
                  key={contato.id}
                  onClick={() => setMestreEscolhido(contato.id)}
                  className={`relative cursor-pointer transition-all transform hover:scale-105 ${
                    isMestre
                      ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-4 border-green-500 shadow-2xl ring-4 ring-green-200'
                      : seraDeletado
                      ? 'bg-red-50 border-2 border-red-300 opacity-75 hover:opacity-100'
                      : 'bg-white border-2 border-slate-300 hover:border-indigo-400 shadow-md'
                  }`}
                >
                  {/* Badge de Status */}
                  <div className="absolute -top-2 -right-2 z-10">
                    {isMestre ? (
                      <Badge className="bg-green-600 text-white shadow-lg text-sm px-3 py-1 font-bold">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        🏆 MESTRE
                      </Badge>
                    ) : seraDeletado ? (
                      <Badge className="bg-red-600 text-white shadow-lg text-sm px-3 py-1 font-bold">
                        🗑️ DELETAR
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-400 text-white shadow-lg text-sm px-3 py-1">
                        #{index + 1}
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-5">
                    {/* Avatar + Nome */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg overflow-hidden ${
                        isMestre ? 'bg-gradient-to-br from-green-500 to-emerald-600 ring-4 ring-green-200' :
                        seraDeletado ? 'bg-gradient-to-br from-red-400 to-red-600' :
                        'bg-gradient-to-br from-indigo-500 to-purple-600'
                      }`}>
                        {contato.foto_perfil_url ? (
                          <img src={contato.foto_perfil_url} alt={contato.nome} className="w-full h-full object-cover" />
                        ) : (
                          (contato.nome || 'S').charAt(0).toUpperCase()
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-slate-900 truncate mb-1">
                          {contato.nome || 'Sem nome'}
                        </h3>
                        <p className="text-sm text-slate-600 font-mono">{contato.telefone}</p>
                        {contato.empresa && (
                          <p className="text-sm text-slate-700 mt-1 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {contato.empresa}
                          </p>
                        )}
                        {contato.cargo && (
                          <p className="text-xs text-slate-500">{contato.cargo}</p>
                        )}
                      </div>
                    </div>

                    {/* Estatísticas */}
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-purple-600" />
                          Threads
                        </span>
                        <span className="font-bold text-slate-900">{contato.stats.threads}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 flex items-center gap-2">
                          💬 Mensagens
                        </span>
                        <span className="font-bold text-slate-900">{contato.stats.mensagens}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 flex items-center gap-2">
                          📝 Interações
                        </span>
                        <span className="font-bold text-slate-900">{contato.stats.interacoes}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Atualizado
                          </span>
                          <span className="text-slate-700 font-medium">
                            {new Date(contato.stats.ultimaAtualizacao).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Indicador de Ação */}
                    {isMestre && (
                      <div className="mt-3 text-center">
                        <p className="text-xs text-green-700 font-semibold">
                          ✓ Este contato será mantido e receberá todos os dados
                        </p>
                      </div>
                    )}
                    {seraDeletado && (
                      <div className="mt-3 text-center">
                        <p className="text-xs text-red-700 font-semibold">
                          ⚠️ Será mesclado no contato mestre e deletado
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* PREVIEW DA OPERAÇÃO */}
          {mestreEscolhido && duplicatas.length >= 2 && (
            <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  <div className="flex-1">
                    <h3 className="font-bold text-orange-900 text-lg mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Preview da Unificação
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {/* Estatísticas ANTES */}
                      <div className="bg-white rounded-lg p-4 border border-orange-200">
                        <p className="text-xs text-orange-700 font-bold mb-2">ANTES (Fragmentado):</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Contatos:</span>
                            <span className="font-bold text-slate-900">{duplicatas.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Threads:</span>
                            <span className="font-bold text-slate-900">
                              {duplicatas.reduce((sum, c) => sum + c.stats.threads, 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Mensagens:</span>
                            <span className="font-bold text-slate-900">
                              {duplicatas.reduce((sum, c) => sum + c.stats.mensagens, 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Interações:</span>
                            <span className="font-bold text-slate-900">
                              {duplicatas.reduce((sum, c) => sum + c.stats.interacoes, 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Estatísticas DEPOIS */}
                      <div className="bg-green-50 rounded-lg p-4 border-2 border-green-400">
                        <p className="text-xs text-green-700 font-bold mb-2">DEPOIS (Unificado):</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Contatos:</span>
                            <span className="font-bold text-green-700">1 ✓</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Threads:</span>
                            <span className="font-bold text-green-700">
                              {duplicatas.reduce((sum, c) => sum + c.stats.threads, 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Mensagens:</span>
                            <span className="font-bold text-green-700">
                              {duplicatas.reduce((sum, c) => sum + c.stats.mensagens, 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Interações:</span>
                            <span className="font-bold text-green-700">
                              {duplicatas.reduce((sum, c) => sum + c.stats.interacoes, 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mestre Selecionado */}
                    <div className="bg-white rounded-lg p-4 border-2 border-green-500">
                      <p className="text-xs text-green-700 font-bold mb-2">🏆 CONTATO MESTRE SELECIONADO:</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-lg">
                          {(duplicatas.find(c => c.id === mestreEscolhido)?.nome || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">
                            {duplicatas.find(c => c.id === mestreEscolhido)?.nome || 'Sem nome'}
                          </p>
                          <p className="text-xs text-slate-600">
                            {duplicatas.find(c => c.id === mestreEscolhido)?.telefone}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-24 flex items-center justify-center">
                    <ArrowRight className="w-16 h-16 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* BOTÃO DE UNIFICAÇÃO - DESTAQUE */}
      {duplicatas.length >= 2 && mestreEscolhido && (
        <div className="sticky bottom-0 z-20">
          <Card className="border-4 border-orange-400 bg-gradient-to-r from-orange-500 to-red-500 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                    <Merge className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-xl">Pronto para unificar?</p>
                    <p className="text-orange-100 text-sm mt-1">
                      <strong className="text-white">{duplicatas.length - 1} contato(s)</strong> serão mesclados em{' '}
                      <strong className="text-white">"{duplicatas.find(c => c.id === mestreEscolhido)?.nome || 'contato selecionado'}"</strong>
                    </p>
                    <p className="text-xs text-orange-100 mt-1 flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3" />
                      Esta ação é IRREVERSÍVEL - todos os dados serão consolidados
                    </p>
                  </div>
                </div>
                <Button
                  onClick={unificarContatos}
                  disabled={unificando || !mestreEscolhido}
                  size="lg"
                  className="bg-white text-orange-600 hover:bg-orange-50 font-bold shadow-xl px-8 py-6 text-lg h-auto"
                >
                  {unificando ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin mr-3" />
                      Unificando...
                    </>
                  ) : (
                    <>
                      <Merge className="w-6 h-6 mr-3" />
                      CONFIRMAR UNIFICAÇÃO
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}