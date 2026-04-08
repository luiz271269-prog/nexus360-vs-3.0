import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { queryClientInstance } from '@/lib/query-client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Phone, MessageCircle, AlertCircle, CheckCircle, Users, Trash2, RefreshCw, Zap, Database, ShieldCheck, Wrench } from "lucide-react";
import { normalizarTelefone } from "@/components/lib/phoneUtils";
import DiagnosticoVisibilidadeRealtime from "../components/comunicacao/DiagnosticoVisibilidadeRealtime";
import { toast } from "sonner";

export default function DiagnosticoContato() {
  const urlParams = new URLSearchParams(window.location.search);
  const telefoneURL = urlParams.get('telefone') || '5547996744257';
  
  const [telefone, setTelefone] = useState(telefoneURL);
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [sincronizandoOrfas, setSincronizandoOrfas] = useState(false);
  const [resultadoOrfas, setResultadoOrfas] = useState(null);
  const [auditoriaContato, setAuditoriaContato] = useState(null);
  const [fluxoAutomatico, setFluxoAutomatico] = useState(false);
  const [progressoFluxo, setProgressoFluxo] = useState('');

  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const user = await base44.auth.me();
        setUsuario(user);
      } catch (error) {
        console.error('[DiagnosticoContato] Erro ao carregar usuário:', error);
      }
    };
    carregarUsuario();
  }, []);

  useEffect(() => {
    if (telefoneURL && telefoneURL !== '5547996744257' && usuario) {
      const timer = setTimeout(() => {
        analisar();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [telefoneURL, usuario]);

  const analisar = async () => {
    setCarregando(true);
    setResultado(null);
    setAuditoriaContato(null);

    // ✅ INVALIDAR CACHE — forçar queries diretas do banco
    queryClientInstance.invalidateQueries({ queryKey: ['Contact'] });
    queryClientInstance.invalidateQueries({ queryKey: ['MessageThread'] });
    queryClientInstance.invalidateQueries({ queryKey: ['Message'] });

    try {
      let contatosComTelefone = [];
      let telefoneNormalizado = null;

      const inputLimpo = telefone.trim();
      const ehUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputLimpo);

      if (ehUUID) {
        console.log(`[DiagnosticoContato] Buscando por ID: ${inputLimpo}`);
        try {
          const contato = await base44.entities.Contact.filter({ id: inputLimpo });
          contatosComTelefone = contato ? [contato].flat() : [];
          
          if (contatosComTelefone.length > 0 && contatosComTelefone[0].telefone) {
            const { buscarContatosPorTelefone } = await import('../components/lib/deduplicationEngine');
            const todosComMesmoTelefone = await buscarContatosPorTelefone(base44, contatosComTelefone[0].telefone);
            contatosComTelefone = todosComMesmoTelefone;
          }
        } catch (err) {
          console.error('[DiagnosticoContato] Erro ao buscar por ID:', err);
          setResultado({ erro: 'Contato não encontrado com este ID' });
          setCarregando(false);
          return;
        }
      } else {
        const { buscarContatosPorTelefone } = await import('../components/lib/deduplicationEngine');
        telefoneNormalizado = normalizarTelefone(inputLimpo);
        
        if (!telefoneNormalizado) {
          setResultado({ erro: 'Telefone inválido' });
          setCarregando(false);
          return;
        }

        const contatosPorTelefone = await buscarContatosPorTelefone(base44, telefoneNormalizado);
        const contatosPorCanonico = await base44.entities.Contact.filter({ 
          telefone_canonico: telefoneNormalizado 
        });
        
        const contatosMap = new Map();
        [...contatosPorTelefone, ...contatosPorCanonico].forEach(c => {
          contatosMap.set(c.id, c);
        });
        contatosComTelefone = Array.from(contatosMap.values());
      }

      if (contatosComTelefone.length === 0) {
        setResultado({ erro: 'Nenhum contato encontrado' });
        setCarregando(false);
        return;
      }

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      amanha.setHours(0, 0, 0, 0);

      const seteDiasAtras = new Date(hoje);
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

      const contatosAnalise = await Promise.all(
        contatosComTelefone.map(async (contato) => {
          const threads = await base44.entities.MessageThread.filter({ 
            contact_id: contato.id 
          }, '-last_message_at');

          const msgsRecebidas = await base44.entities.Message.filter(
            { sender_id: contato.id, sender_type: 'contact' },
            '-sent_at',
            500
          );
          const msgsRecebidashoje = msgsRecebidas.filter(msg => {
            const data = new Date(msg.sent_at || msg.created_date);
            return data >= hoje && data < amanha;
          });
          const msgsRecebidas7d = msgsRecebidas.filter(msg => {
            const data = new Date(msg.sent_at || msg.created_date);
            return data >= seteDiasAtras;
          });

          const msgsEnviadas = await base44.entities.Message.filter(
            { recipient_id: contato.id, sender_type: 'user' },
            '-sent_at',
            500
          );
          const msgsEnviadasHoje = msgsEnviadas.filter(msg => {
            const data = new Date(msg.sent_at || msg.created_date);
            return data >= hoje && data < amanha;
          });
          const msgsEnviadas7d = msgsEnviadas.filter(msg => {
            const data = new Date(msg.sent_at || msg.created_date);
            return data >= seteDiasAtras;
          });

          let problemaVisibilidade = null;
          if (threads.length > 0 && usuario) {
            const thread = threads[0];
            const { canUserSeeThreadBase, verificarBloqueioThread } = await import('../components/lib/threadVisibility');
            
            const threadComContato = { ...thread, contato };
            const podeVer = canUserSeeThreadBase(usuario, threadComContato);
            const bloqueio = verificarBloqueioThread(usuario, thread, contato);
            
            if (!podeVer) {
              problemaVisibilidade = 'Usuário não tem permissão base para ver esta thread';
            } else if (bloqueio.bloqueado) {
              problemaVisibilidade = bloqueio.motivo;
            }
          }

          return {
            contato,
            threads,
            msgsRecebidashoje,
            msgsEnviadasHoje,
            msgsRecebidas7d,
            msgsEnviadas7d,
            msgsRecebidasTotal: msgsRecebidas.length,
            msgsEnviadasTotal: msgsEnviadas.length,
            problemaVisibilidade
          };
        })
      );

      if (contatosComTelefone.length > 0 && contatosAnalise.length > 0) {
        // ✅ Auditoria usa o contato fresco da análise (não cache)
        const contatoFresco = contatosComTelefone[0];
        setAuditoriaContato(auditarContato(contatoFresco));
      }

      setResultado({
        telefone: telefoneNormalizado || inputLimpo,
        contatosDuplicados: {
          total: contatosComTelefone.length,
          contatos: contatosComTelefone.map(c => ({
            id: c.id,
            nome: c.nome,
            empresa: c.empresa,
            tipo: c.tipo_contato,
            bloqueado: c.bloqueado,
            telefone: c.telefone,
            created_date: c.created_date,
            updated_date: c.updated_date
          }))
        },
        analiseDetalhadaPorContato: contatosAnalise.map(analise => ({
          contato: {
            id: analise.contato.id,
            nome: analise.contato.nome,
            empresa: analise.contato.empresa,
            tipo: analise.contato.tipo_contato,
            telefone: analise.contato.telefone
          },
          problemaVisibilidade: analise.problemaVisibilidade,
          threads: analise.threads.map(t => ({
            id: t.id,
            integration_id: t.whatsapp_integration_id,
            ultima_mensagem: t.last_message_at ? new Date(t.last_message_at).toLocaleString('pt-BR') : 'N/A',
            nao_lidas: t.unread_count,
            atribuida: t.assigned_user_id ? 'Sim' : 'Não',
            assigned_user_id: t.assigned_user_id,
            status: t.status
          })),
          mensagensRecebidashoje: {
            total: analise.msgsRecebidashoje.length,
            lista: analise.msgsRecebidashoje.slice(0, 20).map(m => ({
              id: m.id,
              thread_id: m.thread_id,
              conteudo: m.content?.substring(0, 100) || '(sem texto)',
              tipo: m.media_type,
              horario: new Date(m.sent_at || m.created_date).toLocaleString('pt-BR'),
              status: m.status
            }))
          },
          mensagensEnviadasHoje: {
            total: analise.msgsEnviadasHoje.length,
            lista: analise.msgsEnviadasHoje.slice(0, 20).map(m => ({
              id: m.id,
              thread_id: m.thread_id,
              conteudo: m.content?.substring(0, 100) || '(sem texto)',
              tipo: m.media_type,
              horario: new Date(m.sent_at || m.created_date).toLocaleString('pt-BR'),
              status: m.status
            }))
          },
          mensagensRecebidas7d: {
            total: analise.msgsRecebidas7d.length
          },
          mensagensEnviadas7d: {
            total: analise.msgsEnviadas7d.length
          },
          mensagensRecebidasTotal: analise.msgsRecebidasTotal,
          mensagensEnviadasTotal: analise.msgsEnviadasTotal
        }))
      });

    } catch (error) {
      console.error('[DiagnosticoContato]', error);
      setResultado({ erro: error.message });
    } finally {
      setCarregando(false);
    }
  };

  const auditarContato = (contato) => {
    if (!contato) return null;
    const canonico = contato.telefone_canonico || '';
    const tags = contato.tags || [];

    const canonicoCorrompido = canonico.includes('MERGED_') || canonico.includes('merged_');
    const telefoneEsperado = (contato.telefone || '').replace(/\D/g, '');
    const canonicoErrado = !canonicoCorrompido && telefoneEsperado && canonico !== telefoneEsperado;

    const tagsUnicas = [...new Set(tags)];
    const temTagsAcumuladas = tags.length > 10 || (tags.length !== tagsUnicas.length && tags.length > 5);
    const tagsMergedCount = tags.filter(t => t === 'merged' || t === 'duplicata').length;

    const problemas = [];
    if (canonicoCorrompido) problemas.push(`telefone_canonico corrompido: "${canonico.substring(0, 30)}..."`); 
    if (canonicoErrado) problemas.push(`telefone_canonico incorreto: "${canonico}" (esperado: "${telefoneEsperado}")`);
    if (temTagsAcumuladas) problemas.push(`${tags.length} tags acumuladas (${tagsMergedCount} merged/duplicata)`);

    return {
      contato,
      canonicoCorrompido,
      canonicoErrado,
      telefoneEsperado,
      temTagsAcumuladas,
      tagsUnicas,
      tagsMergedCount,
      totalTags: tags.length,
      problemas,
      saudavel: problemas.length === 0
    };
  };

  // ✅ FLUXO AUTOMÁTICO UNIFICADO
  const executarFluxoCompleto = async () => {
    setFluxoAutomatico(true);
    setProgressoFluxo('🔍 Analisando contato...');
    setCarregando(true);

    try {
      // 1️⃣ ANALISAR
      queryClientInstance.invalidateQueries({ queryKey: ['Contact'] });
      queryClientInstance.invalidateQueries({ queryKey: ['MessageThread'] });
      queryClientInstance.invalidateQueries({ queryKey: ['Message'] });
      await analisar();
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Aguardar o estado ser atualizado com os resultados da análise
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 2️⃣ SINCRONIZAR ÓRFÃS
      setProgressoFluxo('🔗 Sincronizando mensagens órfãs...');
      const contactId = resultado?.analiseDetalhadaPorContato[0]?.contato?.id;
      if (contactId) {
        try {
          const res = await base44.asServiceRole.functions.invoke('sincronizarMensagensOrfas', {
            contact_id: contactId,
            periodo_horas: 72,
            modo: 'correcao'
          });
          if (res.data?.success && res.data.mensagens_revinculadas > 0) {
            toast.success(`✅ ${res.data.mensagens_revinculadas} mensagens órfãs revinculadas!`);
          }
        } catch (e) {
          console.warn('[DiagnosticoContato] Sync órfãs falhou:', e.message);
        }
      }
      
      // 2B️⃣ CONSOLIDAR E LIMPAR THREADS MERGED
      setProgressoFluxo('🔗 Consolidando threads duplicadas...');
      if (contactId && resultado.analiseDetalhadaPorContato[0]?.threads) {
        const threads = resultado.analiseDetalhadaPorContato[0].threads;
        const threadCanonica = threads.find(t => t.status === 'aberta');
        const threadsMerged = threads.filter(t => t.status === 'merged');
        
        if (threadCanonica && threadsMerged.length > 0) {
          // Mover todas as mensagens das merged para a canônica
          for (const threadMerged of threadsMerged) {
            try {
              const msgs = await base44.entities.Message.filter({ thread_id: threadMerged.id }, '-sent_at', 1000);
              if (msgs.length > 0) {
                // RevinÚculer as mensagens à thread canônica
                for (const msg of msgs) {
                  await base44.asServiceRole.entities.Message.update(msg.id, { thread_id: threadCanonica.id });
                }
                console.log(`[Fluxo] ${msgs.length} mensagens movidas de ${threadMerged.id} para ${threadCanonica.id}`);
              }
              // Deletar a thread merged
              await base44.asServiceRole.entities.MessageThread.delete(threadMerged.id);
              console.log(`[Fluxo] Thread merged deletada: ${threadMerged.id}`);
            } catch (e) {
              console.warn(`[Fluxo] Erro ao consolidar thread ${threadMerged.id}:`, e.message);
            }
          }
          toast.success(`✅ ${threadsMerged.length} threads consolidadas!`);
        }
      }
      
      // 3️⃣ CORRIGIR CONTATO SE NECESSÁRIO
      if (auditoriaContato && !auditoriaContato.saudavel) {
        setProgressoFluxo('🧹 Corrigindo dados do contato...');
        const update = {};
        if (auditoriaContato.canonicoCorrompido || auditoriaContato.canonicoErrado) {
          update.telefone_canonico = auditoriaContato.telefoneEsperado;
        }
        if (auditoriaContato.temTagsAcumuladas) {
          const tagsLimpas = [...new Set((auditoriaContato.contato.tags || []).filter(t => t !== 'merged' && t !== 'duplicata'))];
          update.tags = tagsLimpas;
        }
        if (Object.keys(update).length > 0) {
          try {
            await base44.entities.Contact.update(auditoriaContato.contato.id, update);
            toast.success(`✅ Contato corrigido! ${Object.keys(update).map(k => `${k}:✓`).join(' ')}`);
            console.log('[Fluxo] Correção aplicada:', update);
          } catch (e) {
            console.error('[Fluxo] Erro ao corrigir contato:', e);
            toast.error(`❌ Erro ao corrigir: ${e.message}`);
          }
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3B️⃣ EXCLUIR DUPLICADOS
      if (resultado.contatosDuplicados.total > 1) {
        setProgressoFluxo('🗑️ Removendo contatos duplicados...');
        const contatoPrincipal = resultado.contatosDuplicados.contatos[0];
        const duplicatas = resultado.contatosDuplicados.contatos.slice(1);
        
        for (const dup of duplicatas) {
          try {
            await base44.asServiceRole.entities.Contact.delete(dup.id);
            console.log(`[DiagnosticoContato] Deletado: ${dup.id}`);
          } catch (e) {
            console.warn(`[DiagnosticoContato] Erro ao deletar ${dup.id}:`, e.message);
          }
        }
        toast.success(`✅ ${duplicatas.length} duplicados removidos!`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 4️⃣ REANALIZAR FINAL
      setProgressoFluxo('📊 Validando resultado final...');
      queryClientInstance.clear(); // ✅ LIMPAR CACHE COMPLETAMENTE
      await new Promise(resolve => setTimeout(resolve, 500));
      await analisar();
      
      setProgressoFluxo('✅ Fluxo completo!');
      toast.success('✅ Contato verificado e sincronizado! Reanalise para confirmar.');
      
    } catch (error) {
      console.error('[DiagnosticoContato] Fluxo completo falhou:', error);
      toast.error(`❌ Erro no fluxo: ${error.message}`);
      setProgressoFluxo(`❌ Erro: ${error.message}`);
    } finally {
      setCarregando(false);
      setFluxoAutomatico(false);
      setTimeout(() => setProgressoFluxo(''), 3000);
    }
  };

  const sincronizarMensagensOrfas = async (modo = 'diagnostico') => {
    if (!resultado?.analiseDetalhadaPorContato[0]?.contato?.id) {
      toast.error('Selecione um contato para sincronizar');
      return;
    }

    setSincronizandoOrfas(true);
    setResultadoOrfas(null);

    try {
      const contact = resultado.analiseDetalhadaPorContato[0].contato;
      toast.info(`🔄 ${modo === 'diagnostico' ? 'Analisando' : 'Sincronizando'} mensagens órfãs...`);
      
      const res = await base44.asServiceRole.functions.invoke('sincronizarMensagensOrfas', {
        contact_id: contact.id,
        periodo_horas: 72,
        modo: modo
      });

      if (res.data?.success) {
        setResultadoOrfas(res.data);
        if (modo === 'diagnostico') {
          toast.success(`✅ Encontradas ${res.data.mensagens_orfas_encontradas} mensagens órfãs`);
        } else {
          toast.success(`✅ Revinculadas ${res.data.mensagens_revinculadas} mensagens!`);
          setTimeout(() => analisar(), 1000);
        }
      } else {
        toast.error(res.data?.error || 'Erro ao sincronizar');
      }
    } catch (error) {
      console.error('[DiagnosticoContato] Erro sync:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setSincronizandoOrfas(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <Card className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 border-0 shadow-xl">
        <h1 className="text-3xl font-bold text-white mb-2">🔍 Diagnóstico Completo de Contato</h1>
        <p className="text-blue-100 text-sm mb-4">Análise de duplicidade, mensagens e visibilidade</p>
        
        <div className="flex gap-2">
          <Input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="Telefone (ex: 5547999674427) ou ID do contato"
            className="flex-1 bg-white"
            onKeyPress={(e) => e.key === 'Enter' && analisar()}
          />
          <Button onClick={analisar} disabled={carregando} className="bg-white text-blue-600 hover:bg-blue-50">
            {carregando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
            Analisar
          </Button>
        </div>
      </Card>

      {resultado?.erro && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-700 ml-2">{resultado.erro}</AlertDescription>
        </Alert>
      )}

      {resultado && !resultado.erro && (
        <div className="space-y-4">
          {/* BOTÃO UNIFICADO — FLUXO AUTOMÁTICO */}
          <Card className="p-6 bg-gradient-to-r from-orange-500 to-red-500 border-0 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1">⚡ Verificar & Sincronizar Contato</h3>
                {progressoFluxo && (
                  <p className="text-orange-100 text-sm font-semibold animate-pulse">{progressoFluxo}</p>
                )}
              </div>
              <Button
                onClick={executarFluxoCompleto}
                disabled={carregando || fluxoAutomatico}
                className="bg-white text-orange-600 hover:bg-orange-50 font-bold text-lg px-8 py-6 flex-shrink-0 whitespace-nowrap"
              >
                {fluxoAutomatico ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Executar Tudo
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* DUPLICATAS COM AÇÃO */}
          <Card className={`p-6 ${resultado.contatosDuplicados.total > 1 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                {resultado.contatosDuplicados.total > 1 ? (
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                ) : (
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                )}
                <div className="flex-1">
                  <h2 className={`text-xl font-bold mb-3 ${resultado.contatosDuplicados.total > 1 ? 'text-red-900' : 'text-green-900'}`}>
                    {resultado.contatosDuplicados.total > 1 
                      ? `⚠️ ${resultado.contatosDuplicados.total} CONTATOS DUPLICADOS ENCONTRADOS` 
                      : `✅ Sem Duplicatas`}
                  </h2>
                  
                  <div className="grid gap-3">
                    {resultado.contatosDuplicados.contatos.map((c, i) => (
                      <div key={c.id} className="bg-white p-4 rounded-lg border-2 border-slate-200 shadow-sm">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-bold text-lg text-slate-900">
                              #{i + 1}: {c.nome} {c.bloqueado && '🔒 BLOQUEADO'}
                            </div>
                            {c.empresa && <div className="text-sm text-slate-600">🏢 {c.empresa}</div>}
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                            c.tipo === 'cliente' ? 'bg-emerald-100 text-emerald-700' :
                            c.tipo === 'lead' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {c.tipo}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                          <div>📱 {c.telefone}</div>
                          <div>🆔 <code className="bg-slate-100 px-1 rounded">{c.id.substring(0, 12)}...</code></div>
                          <div>📅 Criado: {new Date(c.created_date).toLocaleString('pt-BR')}</div>
                          <div>🔄 Atualizado: {new Date(c.updated_date).toLocaleString('pt-BR')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* AUDITORIA DE SAÚDE DO CONTATO PRINCIPAL */}
          {auditoriaContato && usuario?.role === 'admin' && (
            <Card className={`p-5 border-2 ${auditoriaContato.saudavel ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-400'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {auditoriaContato.saudavel
                    ? <ShieldCheck className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                    : <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <h3 className={`text-lg font-bold mb-2 ${auditoriaContato.saudavel ? 'text-green-900' : 'text-red-900'}`}>
                      🧹 Auditoria do Contato Principal: {auditoriaContato.saudavel ? '✅ Saudável' : `🚨 ${auditoriaContato.problemas.length} problema(s)`}
                    </h3>
                    {auditoriaContato.saudavel ? (
                      <p className="text-sm text-green-700">telefone_canonico correto • tags normais ({auditoriaContato.totalTags})</p>
                    ) : (
                      <div className="space-y-1">
                        {auditoriaContato.problemas.map((p, i) => (
                          <div key={i} className="text-sm text-red-800 bg-red-100 rounded px-3 py-1">🚨 {p}</div>
                        ))}
                        <div className="text-xs text-slate-600 mt-2">
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">telefone_canonico atual: "{(auditoriaContato.contato.telefone_canonico || '(vazio)').substring(0, 40)}"</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ANÁLISE DETALHADA POR CONTATO */}
          {resultado.analiseDetalhadaPorContato.map((analise, idx) => (
            <div key={analise.contato.id} className="space-y-3 border-l-4 border-indigo-400 pl-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-indigo-900">
                  📊 Contato #{idx + 1}: {analise.contato.nome}
                </h3>
                {analise.problemaVisibilidade && (
                  <Alert className="bg-red-100 border-red-300 text-red-900 text-sm p-2">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <AlertDescription>🚫 {analise.problemaVisibilidade}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* ESTATÍSTICAS GERAIS */}
              <div className="grid grid-cols-4 gap-3">
                <Card className="p-3 bg-blue-50 border-blue-200">
                  <div className="text-xs text-blue-600 font-semibold">📥 Hoje</div>
                  <div className="text-2xl font-bold text-blue-900">{analise.mensagensRecebidashoje.total}</div>
                </Card>
                <Card className="p-3 bg-green-50 border-green-200">
                  <div className="text-xs text-green-600 font-semibold">📤 Hoje</div>
                  <div className="text-2xl font-bold text-green-900">{analise.mensagensEnviadasHoje.total}</div>
                </Card>
                <Card className="p-3 bg-purple-50 border-purple-200">
                  <div className="text-xs text-purple-600 font-semibold">📊 7 Dias</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {analise.mensagensRecebidas7d.total + analise.mensagensEnviadas7d.total}
                  </div>
                </Card>
                <Card className="p-3 bg-orange-50 border-orange-200">
                  <div className="text-xs text-orange-600 font-semibold">💬 Total</div>
                  <div className="text-2xl font-bold text-orange-900">
                    {analise.mensagensRecebidasTotal + analise.mensagensEnviadasTotal}
                  </div>
                </Card>
              </div>

              {/* THREADS */}
              <Card className="p-4 bg-violet-50 border-violet-300">
                <p className="text-sm font-bold text-violet-900 mb-3">
                  🧵 {analise.threads.length} Thread(s) encontrada(s)
                </p>
                {analise.threads.length === 0 ? (
                  <p className="text-sm text-violet-700">⚠️ Nenhuma thread - mensagens podem estar órfãs!</p>
                ) : (
                  <div className="space-y-2">
                    {analise.threads.map(t => (
                      <div key={t.id} className="bg-white p-3 rounded-lg border-2 border-violet-200 text-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <code className="bg-slate-100 px-2 py-1 rounded text-xs">{t.id}</code>
                            <div className="text-xs text-slate-500 mt-1">
                              📱 Integração: <code>{t.integration_id?.substring(0, 8) || 'N/A'}</code>
                            </div>
                          </div>
                          {t.nao_lidas > 0 && (
                            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                              {t.nao_lidas} não lida(s)
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                          <div>⏰ Última: {t.ultima_mensagem}</div>
                          <div>👤 Atribuída: {t.atribuida}</div>
                          <div>📊 Status: <strong>{t.status}</strong></div>
                          {t.assigned_user_id && (
                            <div>🆔 User: <code className="bg-slate-100 px-1 rounded">{t.assigned_user_id.substring(0, 8)}</code></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* MENSAGENS RECEBIDAS */}
              <Card className="p-4 bg-green-50 border-green-300">
                <p className="text-sm font-bold text-green-900 mb-3">
                  📥 {analise.mensagensRecebidashoje.total} Mensagem(ns) RECEBIDA(S) Hoje
                  {analise.mensagensRecebidashoje.total === 0 && analise.mensagensRecebidas7d.total > 0 && (
                    <span className="text-xs text-orange-600 ml-2">
                      ({analise.mensagensRecebidas7d.total} nos últimos 7 dias)
                    </span>
                  )}
                </p>
                {analise.mensagensRecebidashoje.total === 0 ? (
                  <Alert className="bg-amber-100 border-amber-300">
                    <AlertDescription className="text-amber-900 text-sm">
                      ⚠️ Nenhuma mensagem recebida hoje
                      {analise.mensagensRecebidas7d.total > 0 && ` (mas ${analise.mensagensRecebidas7d.total} nos últimos 7 dias)`}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {analise.mensagensRecebidashoje.lista.map(m => (
                      <div key={m.id} className="bg-white p-3 rounded-lg border-2 border-green-200 text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-mono text-xs text-slate-500">
                            Thread: {m.thread_id.substring(0, 8)}...
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            m.status === 'recebida' ? 'bg-green-100 text-green-700' :
                            m.status === 'lida' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {m.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mb-2">⏰ {m.horario}</div>
                        <p className="text-slate-900 break-words">{m.conteudo}</p>
                        {m.tipo !== 'none' && (
                          <div className="mt-2 text-xs text-purple-600">📎 Mídia: {m.tipo}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* MENSAGENS ENVIADAS */}
              <Card className="p-4 bg-blue-50 border-blue-300">
                <p className="text-sm font-bold text-blue-900 mb-3">
                  📤 {analise.mensagensEnviadasHoje.total} Mensagem(ns) ENVIADA(S) Hoje
                  {analise.mensagensEnviadasHoje.total === 0 && analise.mensagensEnviadas7d.total > 0 && (
                    <span className="text-xs text-orange-600 ml-2">
                      ({analise.mensagensEnviadas7d.total} nos últimos 7 dias)
                    </span>
                  )}
                </p>
                {analise.mensagensEnviadasHoje.total === 0 ? (
                  <p className="text-sm text-blue-700">
                    ℹ️ Nenhuma mensagem enviada hoje
                    {analise.mensagensEnviadas7d.total > 0 && ` (${analise.mensagensEnviadas7d.total} nos últimos 7 dias)`}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {analise.mensagensEnviadasHoje.lista.map(m => (
                      <div key={m.id} className="bg-white p-3 rounded-lg border-2 border-blue-200 text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-mono text-xs text-slate-500">
                            Thread: {m.thread_id.substring(0, 8)}...
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            m.status === 'enviada' ? 'bg-blue-100 text-blue-700' :
                            m.status === 'entregue' ? 'bg-green-100 text-green-700' :
                            m.status === 'lida' ? 'bg-purple-100 text-purple-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {m.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mb-2">⏰ {m.horario}</div>
                        <p className="text-slate-900 break-words">{m.conteudo}</p>
                        {m.tipo !== 'none' && (
                          <div className="mt-2 text-xs text-purple-600">📎 Mídia: {m.tipo}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ))}

          {/* DIAGNÓSTICO REALTIME - APENAS ADMIN */}
          {usuario?.role === 'admin' && resultado.analiseDetalhadaPorContato.length > 0 && resultado.analiseDetalhadaPorContato[0].threads.length > 0 && (
            <Card className="p-4 bg-slate-50 border-slate-300">
              <h3 className="font-bold text-slate-900 mb-3">🔍 Diagnóstico Real-time</h3>
              <DiagnosticoVisibilidadeRealtime
                threadAtiva={resultado.analiseDetalhadaPorContato[0].threads[0].id ? {
                  id: resultado.analiseDetalhadaPorContato[0].threads[0].id
                } : null}
                filterScope="all"
                selectedIntegrationId="all"
                selectedAttendantId={null}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}