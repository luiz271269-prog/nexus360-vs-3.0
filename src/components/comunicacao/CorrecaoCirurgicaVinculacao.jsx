import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 🔧 CORREÇÃO CIRÚRGICA DE VINCULAÇÃO
 * Análise e correção de duplicatas e threads órfãs
 * ✅ FIX: Re-roda análise após "Corrigir Tudo" para atualizar números
 */
export default function CorrecaoCirurgicaVinculacao({ telefoneContato, onAnaliseCompleta }) {
  const [analisando, setAnalisando] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [diagnostico, setDiagnostico] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ ANALISAR: Diagnosticar duplicatas e threads órfãs
  const handleAnalisar = async () => {
    if (!telefoneContato) {
      toast.error('Selecione um contato para analisar');
      return;
    }

    setAnalisando(true);
    setLoading(true);

    try {
      // Normalizar telefone
      const telLimpo = telefoneContato.replace(/\D/g, '');

      // Buscar contatos com este telefone
      const contatos = await base44.entities.Contact.filter({ telefone_canonico: telLimpo });
      const contatosAlt = await base44.entities.Contact.filter({ telefone: telefoneContato });
      const todosContatos = Array.from(
        new Map([...contatos, ...contatosAlt].map(c => [c.id, c])).values()
      );

      if (todosContatos.length === 0) {
        toast.warning('Nenhum contato encontrado');
        setAnalisando(false);
        setLoading(false);
        return;
      }

      // Buscar threads e mensagens para cada contato
      let totalDuplicatas = 0;
      let totalThreads = 0;
      let totalMensagens = 0;
      const detalhes = [];

      for (const contato of todosContatos) {
        const threads = await base44.entities.MessageThread.filter({ contact_id: contato.id });
        const mensagens = await base44.entities.Message.filter({ thread_id: { $in: threads.map(t => t.id) } });

        if (threads.length > 0 || mensagens.length > 0) {
          totalDuplicatas += 1;
          totalThreads += threads.length;
          totalMensagens += mensagens.length;

          detalhes.push({
            id: contato.id,
            nome: contato.nome,
            telefone: contato.telefone,
            threads: threads.length,
            mensagens: mensagens.length
          });
        }
      }

      setDiagnostico({
        duplicados: totalDuplicatas,
        threadsAMover: totalThreads,
        mensagensACorrigir: totalMensagens,
        detalhes
      });

      toast.success(`✅ Análise concluída: ${totalDuplicatas} duplicata(s) encontrada(s)`);
      if (onAnaliseCompleta) onAnaliseCompleta(diagnostico);
    } catch (error) {
      console.error('[CorrecaoCirurgica] Erro ao analisar:', error);
      toast.error(`❌ Erro: ${error.message}`);
    } finally {
      setAnalisando(false);
      setLoading(false);
    }
  };

  // ✅ CORRIGIR TUDO: Consolidar duplicatas e re-rodar análise
  const handleCorrigirTudo = async () => {
    if (!diagnostico || diagnostico.duplicados <= 1) {
      toast.warning('Nada para corrigir');
      return;
    }

    if (!window.confirm(
      `⚠️ CONFIRMAR CORREÇÃO?\n\n` +
      `• Duplicados: ${diagnostico.duplicados}\n` +
      `• Threads a mover: ${diagnostico.threadsAMover}\n` +
      `• Mensagens a corrigir: ${diagnostico.mensagensACorrigir}\n\n` +
      `Esta ação é IRREVERSÍVEL. Deseja continuar?`
    )) {
      return;
    }

    setCorrigindo(true);
    const loadingToast = toast.loading('🔄 Executando correção cirúrgica...');

    try {
      const telLimpo = telefoneContato.replace(/\D/g, '');
      const contatos = await base44.entities.Contact.filter({ telefone_canonico: telLimpo });
      const contatosAlt = await base44.entities.Contact.filter({ telefone: telefoneContato });
      const todosContatos = Array.from(
        new Map([...contatos, ...contatosAlt].map(c => [c.id, c])).values()
      );

      if (todosContatos.length < 2) {
        throw new Error('Não há duplicatas para corrigir');
      }

      // Selecionar contato mestre (mais antigo/com mais dados)
      const mestre = todosContatos.sort((a, b) => 
        new Date(a.created_date) - new Date(b.created_date)
      )[0];

      const duplicatas = todosContatos.filter(c => c.id !== mestre.id);

      // Mover threads para mestre
      let threadsMov = 0;
      let mensagensCorr = 0;

      for (const dup of duplicatas) {
        const threads = await base44.entities.MessageThread.filter({ contact_id: dup.id });

        for (const thread of threads) {
          // Atualizar thread para apontar ao mestre
          await base44.entities.MessageThread.update(thread.id, {
            contact_id: mestre.id
          });
          threadsMov++;

          // Buscar mensagens desta thread
          const mensagens = await base44.entities.Message.filter({ thread_id: thread.id });
          mensagensCorr += mensagens.length;
        }

        // ✅ OPCIONAL: Deletar contato duplicado (cuidado com permissões)
        // await base44.entities.Contact.delete(dup.id);
      }

      toast.dismiss(loadingToast);
      toast.success(
        `✅ CORREÇÃO CONCLUÍDA!\n\n` +
        `📊 Resultado:\n` +
        `→ ${duplicatas.length} duplicata(s) consolidada(s)\n` +
        `→ ${threadsMov} thread(s) movida(s)\n` +
        `→ ${mensagensCorr} mensagem(s) corrigida(s)\n` +
        `🎯 Mestre: ${mestre.nome}`,
        { duration: 6000 }
      );

      // ✅ CRITICAL FIX: Re-rodar análise automaticamente após correção
      setTimeout(() => {
        handleAnalisar();
      }, 1000);
    } catch (error) {
      console.error('[CorrecaoCirurgica] Erro ao corrigir:', error);
      toast.dismiss(loadingToast);
      toast.error(`❌ Erro: ${error.message}`);
    } finally {
      setCorrigindo(false);
    }
  };

  return (
    <Card className="bg-orange-50 border-orange-300 border-2">
      <CardHeader>
        <CardTitle className="text-orange-900 flex items-center gap-2">
          🔧 Correção Cirúrgica de Vinculação
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* PRÉ-DIAGNÓSTICO */}
        {diagnostico && (
          <div className="bg-white rounded-lg p-4 border border-orange-200 space-y-3">
            <p className="text-sm font-semibold text-slate-700">📋 Pré-diagnóstico:</p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">• Duplicados:</span>
                <Badge className="bg-red-100 text-red-800">{diagnostico.duplicados}</Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">• Threads a mover:</span>
                <Badge className="bg-orange-100 text-orange-800">{diagnostico.threadsAMover}</Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">• Mensagens a corrigir:</span>
                <Badge className="bg-yellow-100 text-yellow-800">{diagnostico.mensagensACorrigir}</Badge>
              </div>
            </div>

            {/* Detalhes dos contatos */}
            {diagnostico.detalhes.length > 0 && (
              <div className="bg-slate-50 rounded p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-slate-600 mb-2">Contatos encontrados:</p>
                {diagnostico.detalhes.map((d, i) => (
                  <div key={d.id} className="text-xs text-slate-700 pb-1 border-b last:border-0">
                    ↳ <strong>{d.nome}</strong> — {d.telefone}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BOTÕES DE AÇÃO */}
        <div className="flex gap-3">
          <Button
            onClick={handleAnalisar}
            disabled={analisando || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {analisando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Analisar
          </Button>

          <Button
            onClick={handleCorrigirTudo}
            disabled={corrigindo || !diagnostico || diagnostico.duplicados <= 1}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {corrigindo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
            Corrigir Tudo
          </Button>
        </div>

        {/* ALERTA IMPORTANTE */}
        <Alert className="bg-orange-100 border-orange-300">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 text-xs">
            ⚠️ A correção cirúrgica é <strong>IRREVERSÍVEL</strong>. Threads e mensagens serão consolidadas no contato mestre.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}