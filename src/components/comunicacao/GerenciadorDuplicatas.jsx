import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Loader2, Users, AlertTriangle, CheckCircle2, Merge, Trash2, Search, Phone, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { normalizarTelefone } from '../lib/phoneUtils';

export default function GerenciadorDuplicatas({ telefoneInicial = null }) {
  const [buscando, setBuscando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [duplicatas, setDuplicatas] = useState([]);
  const [stats, setStats] = useState(null);
  const [telefoneFilter, setTelefoneFilter] = useState(telefoneInicial || '');

  // ✅ Auto-buscar quando vem telefone inicial
  useEffect(() => {
    if (telefoneInicial) {
      buscarDuplicatas();
    }
  }, [telefoneInicial]);

  const buscarDuplicatas = async () => {
    setBuscando(true);
    try {
      const contatos = await base44.entities.Contact.list('-created_date', 2000);
      
      // Agrupar por telefone normalizado
      const grupos = new Map();
      let semTelefone = 0;
      let contatosMerged = 0;
      
      for (const contato of contatos) {
        if (!contato.telefone) {
          semTelefone++;
          continue;
        }
        
        // ⚠️ FILTRAR contatos já merged (TODAS as formas de identificar)
        if (contato.tags?.includes('merged') || 
            contato.observacoes?.includes('[AUTO-MERGE]') || 
            contato.observacoes?.includes('[MERGED') ||
            contato.motivo_bloqueio?.includes('[AUTO-MERGE]') ||
            contato.motivo_bloqueio?.includes('Consolidado em')) {
          contatosMerged++;
          continue;
        }
        
        const normalizado = normalizarTelefone(contato.telefone);
        if (!normalizado) continue;
        
        // ✅ CHAVE ÚNICA POR TELEFONE (sem separar por conexão_origem)
        const chave = normalizado;
        
        if (!grupos.has(chave)) {
          grupos.set(chave, []);
        }
        grupos.get(chave).push(contato);
      }
      
      console.log('[GerenciadorDuplicatas] 📊 Resumo busca:', {
        total: contatos.length,
        sem_telefone: semTelefone,
        merged_ignorados: contatosMerged,
        grupos_criados: grupos.size
      });
      
      // Filtrar apenas grupos com duplicatas (ou filtrar por telefone específico)
      let gruposDuplicados = Array.from(grupos.entries())
        .filter(([_, contatos]) => contatos.length > 1)
        .map(([telefone, contatos]) => ({
          telefone,
          contatos: contatos.sort((a, b) => {
            // Priorizar: cliente > lead > mais recente
            const tipoOrder = { cliente: 4, lead: 3, parceiro: 2, fornecedor: 1, novo: 0 };
            const tipoA = tipoOrder[a.tipo_contato] || 0;
            const tipoB = tipoOrder[b.tipo_contato] || 0;
            if (tipoB !== tipoA) return tipoB - tipoA;
            return new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date);
          })
        }));

      // 🔍 FILTRO POR TELEFONE ESPECÍFICO (quando vem de SearchAndFilter)
      if (telefoneFilter && telefoneFilter.trim()) {
        const filtroNorm = normalizarTelefone(telefoneFilter.trim());
        if (filtroNorm) {
          gruposDuplicados = gruposDuplicados.filter(g => g.telefone === filtroNorm);
        }
      }

      // 📊 Calcular estatísticas detalhadas por grupo
      const gruposComDetalhes = await Promise.all(
        gruposDuplicados.map(async (grupo) => {
          let threads_total = 0;
          let mensagens_total = 0;
          
          for (const contato of grupo.contatos) {
            const threads = await base44.entities.MessageThread.filter({ contact_id: contato.id });
            threads_total += threads.length;
            
            const msgs = await base44.entities.Message.filter({ 
              sender_id: contato.id, 
              sender_type: 'contact' 
            }, '-sent_at', 100);
            mensagens_total += msgs.length;
          }
          
          return {
            ...grupo,
            detalhes: { threads_total, mensagens_total }
          };
        })
      );
      
      setDuplicatas(gruposComDetalhes);
      setStats({
        total_contatos: contatos.length,
        sem_telefone: semTelefone,
        grupos_duplicados: gruposComDetalhes.length,
        total_duplicatas: gruposComDetalhes.reduce((sum, g) => sum + g.contatos.length - 1, 0)
      });
      
      if (gruposComDetalhes.length === 0 && telefoneFilter) {
        toast.info('✅ Nenhuma duplicata encontrada para este número');
      } else {
        toast.success(`✅ ${gruposComDetalhes.length} grupos duplicados encontrados`);
      }
    } catch (error) {
      console.error('[GerenciadorDuplicatas] Erro:', error);
      toast.error('Erro ao buscar duplicatas');
    } finally {
      setBuscando(false);
    }
  };

  const limparAutomaticamente = async () => {
    if (!confirm(`⚠️ Consolidar ${stats.grupos_duplicados} grupos de duplicatas?\n\nEsta ação vai:\n- Manter o contato mais completo\n- Redirecionar threads/mensagens\n- Marcar duplicatas como "merged"\n\nDeseja continuar?`)) {
      return;
    }

    setLimpando(true);
    try {
      // Usar função backend existente
      const response = await base44.functions.invoke('limparContatosDuplicados', {});
      
      if (response.success) {
        toast.success(`✅ ${response.stats.contacts_merged} duplicatas consolidadas!`);
        await buscarDuplicatas(); // Atualizar lista
      } else {
        toast.error(`❌ ${response.error}`);
      }
    } catch (error) {
      console.error('[GerenciadorDuplicatas] Erro na limpeza:', error);
      toast.error('Erro ao limpar duplicatas');
    } finally {
      setLimpando(false);
    }
  };

  const consolidarGrupo = async (grupo) => {
    console.log('[GerenciadorDuplicatas] 🔄 Iniciando consolidação:', grupo);
    
    const totalContatos = grupo.contatos.length;
    const totalThreads = grupo.detalhes?.threads_total || 0;
    const totalMensagens = grupo.detalhes?.mensagens_total || 0;
    
    // ✅ VALIDAÇÃO: Filtrar contatos já merged (verificar TODAS as formas de identificar merged)
    const contatosValidos = grupo.contatos.filter(c => {
      const isMerged = 
        c.tags?.includes('merged') || 
        c.observacoes?.includes('[AUTO-MERGE]') ||
        c.observacoes?.includes('[MERGED') ||
        c.motivo_bloqueio?.includes('[AUTO-MERGE]') ||
        c.motivo_bloqueio?.includes('Consolidado em');
      
      if (isMerged) {
        console.log('[GerenciadorDuplicatas] 🏷️ Ignorando contato merged:', c.id, c.nome, {
          tags: c.tags,
          motivo_bloqueio: c.motivo_bloqueio,
          observacoes: c.observacoes?.substring(0, 100)
        });
      }
      
      return !isMerged;
    });
    
    console.log('[GerenciadorDuplicatas] 📊 Contatos válidos (não merged):', contatosValidos.length, 'de', totalContatos);
    
    if (contatosValidos.length < 2) {
      toast.error('❌ Não há contatos válidos para consolidar (todos já foram merged)');
      return;
    }
    
    if (!confirm(
      `⚠️ CONSOLIDAR ${contatosValidos.length} CONTATOS DUPLICADOS?\n\n` +
      `📱 Telefone: ${grupo.telefone}\n` +
      `🧵 Threads afetadas: ${totalThreads}\n` +
      `💬 Mensagens afetadas: ${totalMensagens}\n\n` +
      `Contatos que serão consolidados:\n${contatosValidos.map((c, i) => `${i + 1}. ${c.nome} (${c.tipo_contato})`).join('\n')}\n\n` +
      `Esta ação irá:\n` +
      `✓ Unificar todos em 1 contato mestre\n` +
      `✓ Mover todas threads/mensagens para o mestre\n` +
      `✓ Desbloquear se necessário\n` +
      `✓ Marcar duplicatas como "merged"\n\n` +
      `Continuar?`
    )) return;

    const loadingToast = toast.loading('🔄 Consolidando contatos...');

    try {
      // Escolher principal (prioridade: tipo > não bloqueado > atualização > criação)
      const principal = contatosValidos.reduce((best, curr) => {
        const tipoOrder = { cliente: 4, lead: 3, parceiro: 2, fornecedor: 1, novo: 0 };
        const bestTipo = tipoOrder[best.tipo_contato] || 0;
        const currTipo = tipoOrder[curr.tipo_contato] || 0;
        
        // Priorizar não bloqueados
        if (best.bloqueado && !curr.bloqueado) return curr;
        if (!best.bloqueado && curr.bloqueado) return best;
        
        if (currTipo > bestTipo) return curr;
        if (currTipo < bestTipo) return best;
        
        // Mesmo tipo: mais recentemente atualizado
        const bestDate = new Date(best.updated_date || best.created_date);
        const currDate = new Date(curr.updated_date || curr.created_date);
        return currDate > bestDate ? curr : best;
      });

      console.log(`[GerenciadorDuplicatas] 🎯 Contato mestre escolhido:`, {
        id: principal.id,
        nome: principal.nome,
        tipo: principal.tipo_contato,
        bloqueado: principal.bloqueado
      });
      
      let threadsMovidas = 0;
      let mensagensMovidas = 0;

      // Processar duplicatas (apenas os válidos, excluindo o principal)
      const duplicatasParaProcessar = contatosValidos.filter(c => c.id !== principal.id);
      
      console.log(`[GerenciadorDuplicatas] 📋 Duplicatas a processar:`, duplicatasParaProcessar.length);
      
      for (const duplicata of duplicatasParaProcessar) {
        console.log(`[GerenciadorDuplicatas] 🔄 Processando duplicata:`, {
          id: duplicata.id,
          nome: duplicata.nome,
          tipo: duplicata.tipo_contato,
          bloqueado: duplicata.bloqueado
        });

        // 1. Redirecionar threads
        const threads = await base44.entities.MessageThread.filter({ contact_id: duplicata.id });
        console.log(`[GerenciadorDuplicatas] 📂 ${threads.length} threads encontradas para ${duplicata.nome}`);
        
        for (const thread of threads) {
          console.log(`[GerenciadorDuplicatas]   → Movendo thread ${thread.id} de ${duplicata.id} → ${principal.id}`);
          try {
            await base44.entities.MessageThread.update(thread.id, { 
              contact_id: principal.id,
              status: thread.status === 'merged' ? 'aberta' : thread.status
            });
            threadsMovidas++;
          } catch (err) {
            console.error(`[GerenciadorDuplicatas] ❌ Erro ao mover thread ${thread.id}:`, err);
          }
        }

        // 2. Redirecionar mensagens (sender)
        const mensagensSender = await base44.entities.Message.filter({
          sender_id: duplicata.id,
          sender_type: 'contact'
        }, '-sent_at', 1000);
        
        console.log(`[GerenciadorDuplicatas] 💬 ${mensagensSender.length} mensagens (sender) encontradas`);
        
        for (const msg of mensagensSender) {
          try {
            await base44.entities.Message.update(msg.id, { sender_id: principal.id });
            mensagensMovidas++;
          } catch (err) {
            console.error(`[GerenciadorDuplicatas] ❌ Erro ao mover mensagem ${msg.id}:`, err);
          }
        }

        // 3. Redirecionar mensagens (recipient)
        const mensagensRecipient = await base44.entities.Message.filter({
          recipient_id: duplicata.id,
          recipient_type: 'contact'
        }, '-sent_at', 1000);
        
        console.log(`[GerenciadorDuplicatas] 📨 ${mensagensRecipient.length} mensagens (recipient) encontradas`);
        
        for (const msg of mensagensRecipient) {
          try {
            await base44.entities.Message.update(msg.id, { recipient_id: principal.id });
          } catch (err) {
            console.error(`[GerenciadorDuplicatas] ❌ Erro ao mover mensagem recipient ${msg.id}:`, err);
          }
        }

        // 4. Marcar como merged
        console.log(`[GerenciadorDuplicatas] 🏷️ Marcando ${duplicata.id} como merged`);
        try {
          await base44.entities.Contact.update(duplicata.id, {
            bloqueado: true,
            motivo_bloqueio: `[AUTO-MERGE] Consolidado em ${principal.id}`,
            tags: [...(duplicata.tags || []).filter(t => t !== 'merged'), 'merged', 'duplicata'],
            observacoes: `[MERGED ${new Date().toISOString()}] Consolidado em ${principal.id} (${principal.nome})\n\n---\nObservações originais:\n${duplicata.observacoes || 'Nenhuma'}`
          });
        } catch (err) {
          console.error(`[GerenciadorDuplicatas] ❌ Erro ao marcar como merged:`, err);
        }
      }
      
      console.log(`[GerenciadorDuplicatas] ✅ Processamento concluído. Threads: ${threadsMovidas}, Mensagens: ${mensagensMovidas}`);

      // 5. Desbloquear e atualizar o principal se necessário
      console.log(`[GerenciadorDuplicatas] 🔓 Verificando se principal precisa ser desbloqueado...`);
      if (principal.bloqueado) {
        console.log(`[GerenciadorDuplicatas] 🔓 Desbloqueando principal ${principal.id}`);
        await base44.entities.Contact.update(principal.id, {
          bloqueado: false,
          motivo_bloqueio: null,
          observacoes: `[MESTRE DE CONSOLIDAÇÃO ${new Date().toISOString()}]\nEste contato é o resultado da consolidação de ${duplicatasParaProcessar.length} duplicatas.\n\n---\n${principal.observacoes || ''}`
        });
      }

      toast.dismiss(loadingToast);
      toast.success(
        `✅ CONSOLIDAÇÃO CONCLUÍDA!\n\n` +
        `📊 Estatísticas:\n` +
        `→ ${duplicatasParaProcessar.length} contatos unificados em "${principal.nome}"\n` +
        `→ ${threadsMovidas} threads movidas\n` +
        `→ ${mensagensMovidas} mensagens movidas\n\n` +
        `🎯 Contato mestre: ${principal.nome} (${principal.tipo_contato})`
      );
      
      console.log('[GerenciadorDuplicatas] ✅ Consolidação finalizada. Atualizando lista...');
      await buscarDuplicatas(); // Atualizar
    } catch (error) {
      console.error('[GerenciadorDuplicatas] ❌ Erro ao consolidar:', error);
      toast.dismiss(loadingToast);
      toast.error(`❌ Erro ao consolidar: ${error.message}\n\nVeja o console para detalhes.`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🔧 Gerenciador de Duplicatas</h2>
          <p className="text-sm text-slate-500 mt-1">Consolidar contatos duplicados por telefone (Fusão Cirúrgica)</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={telefoneFilter}
              onChange={(e) => setTelefoneFilter(e.target.value)}
              placeholder="Filtrar por telefone..."
              className="pl-10 w-64"
              onKeyPress={(e) => e.key === 'Enter' && buscarDuplicatas()}
            />
          </div>
          <Button
            onClick={buscarDuplicatas}
            disabled={buscando}
            variant="outline"
          >
            {buscando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            Buscar
          </Button>
          {duplicatas.length > 0 && !telefoneFilter && (
            <Button
              onClick={limparAutomaticamente}
              disabled={limpando}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {limpando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Merge className="w-4 h-4 mr-2" />}
              Consolidar Todas
            </Button>
          )}
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total de Contatos</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total_contatos}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Grupos Duplicados</p>
                <p className="text-2xl font-bold text-orange-600">{stats.grupos_duplicados}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Duplicatas</p>
                <p className="text-2xl font-bold text-red-600">{stats.total_duplicatas}</p>
              </div>
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Sem Telefone</p>
                <p className="text-2xl font-bold text-slate-400">{stats.sem_telefone}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-slate-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Lista de Duplicatas */}
      <div className="space-y-4">
        {duplicatas.length === 0 && stats && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <div className="ml-2">
              <p className="font-semibold text-green-900">Nenhuma duplicata encontrada</p>
              <p className="text-sm text-green-700">Todos os contatos estão únicos.</p>
            </div>
          </Alert>
        )}

        {duplicatas.map((grupo, idx) => (
          <Card key={idx} className="p-5 hover:shadow-xl transition-all border-2 border-orange-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-mono font-bold text-xl text-slate-900 flex items-center gap-2">
                  📱 {grupo.telefone}
                  {grupo.detalhes && (
                    <Badge className="bg-purple-600 text-white">
                      {grupo.detalhes.threads_total} threads • {grupo.detalhes.mensagens_total} msgs
                    </Badge>
                  )}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  <strong>{grupo.contatos.length} registros duplicados</strong>
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => consolidarGrupo(grupo)}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-lg"
              >
                <Merge className="w-5 h-5 mr-2" />
                Unificar Agora
              </Button>
            </div>

            <div className="space-y-3">
              {grupo.contatos.map((contato, cIdx) => {
                // ✅ Detectar se é merged
                const isMerged = 
                  contato.tags?.includes('merged') || 
                  contato.observacoes?.includes('[AUTO-MERGE]') ||
                  contato.observacoes?.includes('[MERGED') ||
                  contato.motivo_bloqueio?.includes('[AUTO-MERGE]') ||
                  contato.motivo_bloqueio?.includes('Consolidado em');
                
                return (
                <div
                  key={contato.id}
                  className={`flex items-start justify-between p-4 rounded-xl border-2 transition-all ${
                    isMerged
                      ? 'bg-slate-200 border-slate-400 opacity-60'
                      : cIdx === 0 
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-md' 
                        : contato.bloqueado
                          ? 'bg-red-50 border-red-200'
                          : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl font-bold text-slate-400">#{cIdx + 1}</span>
                      <p className={`font-bold text-lg ${isMerged ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {contato.nome || 'Sem nome'}
                        {contato.bloqueado && ' 🔒'}
                      </p>
                      {!isMerged && cIdx === 0 && <Badge className="bg-green-600 text-white shadow">🎯 MESTRE</Badge>}
                      {isMerged && <Badge className="bg-slate-500 text-white">❌ JÁ MERGED</Badge>}
                      <Badge className={
                        contato.tipo_contato === 'cliente' ? 'bg-emerald-500 text-white' :
                        contato.tipo_contato === 'lead' ? 'bg-amber-500 text-white' :
                        'bg-slate-400 text-white'
                      }>
                        {contato.tipo_contato}
                      </Badge>
                    </div>
                    
                    {contato.empresa && (
                      <p className="text-sm text-slate-700 mb-1">🏢 {contato.empresa}</p>
                    )}
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mt-2">
                      <div>📅 Criado: {new Date(contato.created_date).toLocaleString('pt-BR')}</div>
                      <div>🔄 Atualizado: {new Date(contato.updated_date).toLocaleString('pt-BR')}</div>
                      <div className="col-span-2">🆔 <code className="bg-slate-100 px-1 rounded">{contato.id}</code></div>
                      {contato.bloqueado && (
                        <div className="col-span-2 text-red-600 font-semibold text-xs">
                          🔒 {contato.motivo_bloqueio || 'Bloqueado'}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {!isMerged && cIdx > 0 && (
                    <Badge className="bg-red-600 text-white shadow animate-pulse">
                      ⚠️ DUPLICATA
                    </Badge>
                  )}
                </div>
              )})}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}