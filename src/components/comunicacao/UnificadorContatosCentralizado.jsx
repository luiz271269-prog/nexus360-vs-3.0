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

      // Buscar por telefone E telefone_canonico (contatos novos só têm canonico)
      const canonico = normalizado.replace(/\D/g, '');
      const [resultCanonicos] = await Promise.all([
        base44.entities.Contact.filter({ telefone_canonico: canonico })
      ]);
      contatosEncontrados.push(...resultCanonicos);

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

        // Re-buscar após 1.5s para confirmar que duplicatas foram removidas
        setTimeout(() => buscarDuplicatas(telefone), 1500);

        if (onClose) {
          setTimeout(onClose, 3500);
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
    <div className="space-y-3 max-w-4xl mx-auto">
      {/* HEADER COM BUSCA */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-4 shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center">
            <Merge className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-tight">Unificador de Contatos Centralizado</h2>
            <p className="text-indigo-200 text-xs">Busque duplicatas por telefone e unifique em um único contato</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Ex: +5548999322400"
              className="pl-9 h-9 text-sm bg-white"
              onKeyPress={(e) => e.key === 'Enter' && buscarDuplicatas()}
            />
          </div>
          <Button
            onClick={() => buscarDuplicatas()}
            disabled={buscando || !telefone.trim()}
            size="sm"
            className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-4"
          >
            {buscando ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1" />Buscando...</>
            ) : (
              <><Search className="w-4 h-4 mr-1" />Buscar Duplicatas</>
            )}
          </Button>
        </div>
      </div>

      {/* RESULTADO DE SUCESSO */}
      {estatisticas && (
        <Alert className="bg-green-50 border-green-200 py-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="ml-2">
            <p className="font-bold text-green-900 text-sm">✅ Unificação Concluída!</p>
            <div className="flex gap-4 mt-1 text-xs text-green-700">
              <span>📊 {estatisticas.duplicatasProcessadas} duplicatas</span>
              <span>🧵 {estatisticas.threadsMovidas} threads</span>
              <span>💬 {estatisticas.mensagensMovidas} msgs</span>
              <span>📝 {estatisticas.interacoesMovidas} interações</span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* VISUALIZAÇÃO DE DUPLICATAS */}
      {duplicatas.length >= 2 && (
        <div className="space-y-3">
          {/* RESUMO */}
          <Alert className="bg-indigo-50 border-indigo-200 py-2">
            <Info className="w-4 h-4 text-indigo-600" />
            <AlertDescription className="ml-2 text-sm text-indigo-900">
              <strong>{duplicatas.length} contatos encontrados.</strong>{' '}
              <span className="text-indigo-700">Clique para selecionar o <strong>contato mestre</strong> (mantido).</span>
            </AlertDescription>
          </Alert>

          {/* CARDS COMPACTOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {duplicatas.map((contato, index) => {
              const isMestre = mestreEscolhido === contato.id;
              const seraDeletado = mestreEscolhido && mestreEscolhido !== contato.id;
              
              return (
                <Card
                  key={contato.id}
                  onClick={() => setMestreEscolhido(contato.id)}
                  className={`relative cursor-pointer transition-all hover:shadow-md ${
                    isMestre
                      ? 'bg-green-50 border-2 border-green-500 shadow-md ring-2 ring-green-200'
                      : seraDeletado
                      ? 'bg-red-50 border border-red-300 opacity-80 hover:opacity-100'
                      : 'bg-white border border-slate-200 hover:border-indigo-400'
                  }`}
                >
                  {/* Badge de Status */}
                  <div className="absolute -top-2 -right-2 z-10">
                    {isMestre ? (
                      <Badge className="bg-green-600 text-white text-xs px-2 py-0.5 font-bold">
                        <CheckCircle2 className="w-3 h-3 mr-1" />MESTRE
                      </Badge>
                    ) : seraDeletado ? (
                      <Badge className="bg-red-600 text-white text-xs px-2 py-0.5 font-bold">
                        🗑️ DELETAR
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-400 text-white text-xs px-2 py-0.5">#{index + 1}</Badge>
                    )}
                  </div>

                  <CardContent className="p-3">
                    {/* Avatar + Nome */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow flex-shrink-0 overflow-hidden ${
                        isMestre ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
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
                        <h3 className="font-semibold text-sm text-slate-900 truncate">
                          {contato.nome || 'Sem nome'}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono truncate">{contato.telefone}</p>
                        {contato.empresa && (
                          <p className="text-xs text-slate-600 truncate">{contato.empresa}</p>
                        )}
                      </div>
                    </div>

                    {/* Stats compactas */}
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="bg-slate-50 rounded px-1 py-1.5">
                        <p className="text-xs font-bold text-slate-800">{contato.stats.threads}</p>
                        <p className="text-[10px] text-slate-500">Threads</p>
                      </div>
                      <div className="bg-slate-50 rounded px-1 py-1.5">
                        <p className="text-xs font-bold text-slate-800">{contato.stats.mensagens}</p>
                        <p className="text-[10px] text-slate-500">Msgs</p>
                      </div>
                      <div className="bg-slate-50 rounded px-1 py-1.5">
                        <p className="text-xs font-bold text-slate-800">{contato.stats.interacoes}</p>
                        <p className="text-[10px] text-slate-500">Interações</p>
                      </div>
                    </div>

                    {isMestre && (
                      <p className="text-[10px] text-green-700 font-semibold text-center mt-2">✓ Mantido — receberá todos os dados</p>
                    )}
                    {seraDeletado && (
                      <p className="text-[10px] text-red-700 font-semibold text-center mt-2">⚠️ Será mesclado e deletado</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* PREVIEW COMPACTO */}
          {mestreEscolhido && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="text-xs font-bold text-amber-900">
                      {duplicatas.length - 1} contato(s) serão mesclados em{' '}
                      <span className="text-green-800">"{duplicatas.find(c => c.id === mestreEscolhido)?.nome || 'mestre'}"</span>
                    </p>
                    <p className="text-[10px] text-amber-700">
                      Total: {duplicatas.reduce((s, c) => s + c.stats.threads, 0)} threads,{' '}
                      {duplicatas.reduce((s, c) => s + c.stats.mensagens, 0)} msgs consolidadas
                    </p>
                  </div>
                </div>
                <Button
                  onClick={unificarContatos}
                  disabled={unificando || !mestreEscolhido}
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4"
                >
                  {unificando ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1" />Unificando...</>
                  ) : (
                    <><Merge className="w-4 h-4 mr-1" />CONFIRMAR UNIFICAÇÃO</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}