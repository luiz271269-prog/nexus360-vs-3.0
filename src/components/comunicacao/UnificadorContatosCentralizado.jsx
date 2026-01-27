import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, Phone, Search, Merge, CheckCircle2, 
  AlertTriangle, User, MessageSquare, Calendar, ArrowRight
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
  contatoOrigem = null, 
  contatoDestino = null,
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
      // ✅ CHAMAR FUNÇÃO BACKEND CENTRALIZADA
      const response = await base44.functions.invoke('mergeContacts', {
        masterContactId: mestreEscolhido,
        duplicateContactIds: duplicatasIds
      });

      if (response.data.success) {
        const stats = response.data.stats;
        
        toast.dismiss(loadingToast);
        toast.success(
          `✅ UNIFICAÇÃO CONCLUÍDA!\n\n` +
          `📊 Estatísticas:\n` +
          `→ ${stats.duplicatasProcessadas} duplicatas removidas\n` +
          `→ ${stats.threadsMovidas} threads movidas\n` +
          `→ ${stats.mensagensMovidas} mensagens movidas\n` +
          `→ ${stats.interacoesMovidas} interações movidas\n\n` +
          `🎯 Contato mestre: ${response.data.masterContactName}`
        );

        setEstatisticas(stats);
        setDuplicatas([]);
        setMestreEscolhido(null);

        if (onClose) {
          setTimeout(onClose, 2000);
        }
      } else {
        throw new Error(response.data.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('[UnificadorCentralizado] Erro na unificação:', error);
      toast.dismiss(loadingToast);
      toast.error(`❌ Erro: ${error.message}\n\nVeja o console para detalhes.`);
    } finally {
      setUnificando(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // GERAR VARIAÇÕES DE TELEFONE PARA BUSCA
  // ════════════════════════════════════════════════════════════════════════
  const gerarVariacoes = (tel) => {
    const limpo = tel.replace(/\D/g, '');
    const variacoes = new Set([tel]);

    if (limpo.length === 13 && limpo.startsWith('55')) {
      variacoes.add('+' + limpo);
      variacoes.add(limpo);
      variacoes.add('+55' + limpo.substring(2));
    }
    if (limpo.length === 12 && limpo.startsWith('55')) {
      variacoes.add('+' + limpo);
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
      setMestreEscolhido(contatoDestino.id);
      toast.success('✅ Contatos carregados via drag-and-drop');
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
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* HEADER */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-indigo-900">
            <Merge className="w-6 h-6" />
            Unificador de Contatos Centralizado
          </CardTitle>
          <p className="text-sm text-indigo-600 mt-1">
            Busque duplicatas por telefone e unifique em um único contato
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Digite o telefone (ex: +5548999322400)"
                className="pl-10"
                onKeyPress={(e) => e.key === 'Enter' && buscarDuplicatas()}
              />
            </div>
            <Button
              onClick={() => buscarDuplicatas()}
              disabled={buscando || !telefone.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {buscando ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

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
        <div className="grid grid-cols-3 gap-4">
          {/* COLUNA 1: DUPLICATAS (SERÃO DELETADAS) */}
          <div className="col-span-1 space-y-3">
            <div className="bg-red-50 p-3 rounded-lg border-2 border-red-300">
              <h3 className="font-bold text-red-700 text-sm mb-2 flex items-center gap-2">
                🗑️ SERÃO DELETADAS
                <Badge className="bg-red-600 text-white">{duplicatas.length - 1}</Badge>
              </h3>
              <p className="text-xs text-red-600 mb-3">Contatos que serão removidos após unificação</p>
            </div>

            <div className="space-y-2">
              {duplicatas
                .filter(c => c.id !== mestreEscolhido)
                .map((contato) => (
                  <Card key={contato.id} className="p-3 bg-white border-red-200 hover:border-red-400 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{contato.nome || 'Sem nome'}</p>
                        <p className="text-xs text-slate-600">{contato.telefone}</p>
                        {contato.empresa && (
                          <p className="text-xs text-slate-500 truncate">🏢 {contato.empresa}</p>
                        )}
                      </div>
                      <Badge className="bg-red-600 text-white text-xs shrink-0">DUP</Badge>
                    </div>
                    <div className="flex gap-3 text-xs text-slate-500">
                      <span title="Threads">🧵 {contato.stats.threads}</span>
                      <span title="Mensagens">💬 {contato.stats.mensagens}</span>
                      <span title="Interações">📝 {contato.stats.interacoes}</span>
                    </div>
                  </Card>
                ))}
            </div>
          </div>

          {/* COLUNA 2: SETA */}
          <div className="col-span-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-gradient-to-r from-red-500 to-green-500 w-16 h-16 rounded-full flex items-center justify-center shadow-lg">
                <ArrowRight className="w-8 h-8 text-white" />
              </div>
              <p className="text-sm text-slate-600 font-semibold text-center">
                Tudo será<br />unificado em →
              </p>
            </div>
          </div>

          {/* COLUNA 3: MESTRE (SERÁ MANTIDO) */}
          <div className="col-span-1 space-y-3">
            <div className="bg-green-50 p-3 rounded-lg border-2 border-green-400">
              <h3 className="font-bold text-green-700 text-sm mb-2 flex items-center gap-2">
                🏆 SERÁ MANTIDO
                <Badge className="bg-green-600 text-white">MESTRE</Badge>
              </h3>
              <p className="text-xs text-green-600 mb-3">
                Escolha qual contato será o principal
              </p>
            </div>

            <div className="space-y-2">
              {duplicatas.map((contato) => (
                <Card
                  key={contato.id}
                  onClick={() => setMestreEscolhido(contato.id)}
                  className={`p-3 cursor-pointer transition-all ${
                    mestreEscolhido === contato.id
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500 shadow-lg'
                      : 'bg-white border-slate-200 hover:border-green-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{contato.nome || 'Sem nome'}</p>
                      <p className="text-xs text-slate-600">{contato.telefone}</p>
                      {contato.empresa && (
                        <p className="text-xs text-slate-500 truncate">🏢 {contato.empresa}</p>
                      )}
                    </div>
                    {mestreEscolhido === contato.id && (
                      <Badge className="bg-green-600 text-white text-xs shrink-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        SELECIONADO
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-slate-500">
                    <span title="Threads">🧵 {contato.stats.threads}</span>
                    <span title="Mensagens">💬 {contato.stats.mensagens}</span>
                    <span title="Interações">📝 {contato.stats.interacoes}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(contato.stats.ultimaAtualizacao).toLocaleDateString('pt-BR')}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BOTÃO DE UNIFICAÇÃO */}
      {duplicatas.length >= 2 && (
        <Card className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-orange-900">Pronto para unificar?</p>
              <p className="text-sm text-orange-700">
                {duplicatas.length - 1} contato(s) serão mesclados em "{duplicatas.find(c => c.id === mestreEscolhido)?.nome || 'contato selecionado'}"
              </p>
            </div>
            <Button
              onClick={unificarContatos}
              disabled={unificando || !mestreEscolhido}
              size="lg"
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold shadow-lg"
            >
              {unificando ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Unificando...
                </>
              ) : (
                <>
                  <Merge className="w-5 h-5 mr-2" />
                  Confirmar Unificação
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}