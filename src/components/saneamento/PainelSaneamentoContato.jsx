import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Loader2, Zap, CheckCircle2, AlertCircle, Search, Wrench } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 🎯 PAINEL ÚNICO DE SANEAMENTO DE CONTATO
 * ════════════════════════════════════════
 * Substitui: DiagnosticoSincronizacaoUnificado, CorrecaoCirurgicaVinculacao,
 * SincronizadorMensagensOrfas e fragmentos espalhados no ContactInfoPanel.
 *
 * Chama 1 única skill backend (skillSanitizacaoContato) que executa as 7 fases:
 *   1. Diagnóstico inicial
 *   2. Deduplicar mensagens
 *   3. Sincronizar mensagens órfãs
 *   4. Threads órfãs (whatsapp_integration_id)
 *   5. Saneamento do contato (canonical + tags)
 *   6. Mesclar duplicatas via mergeContacts
 *   7. Validação final
 */
export default function PainelSaneamentoContato({ contact, usuario, onUpdate }) {
  const [executando, setExecutando] = React.useState(null); // 'diagnostico' | 'correcao' | null
  const [resultado, setResultado] = React.useState(null);

  if (!contact?.id) return null;

  const executar = async (modo) => {
    setExecutando(modo);
    setResultado(null);
    try {
      const res = await base44.functions.invoke('skillSanitizacaoContato', {
        contact_id: contact.id,
        modo
      });

      const data = res?.data || res;
      if (!data?.success) {
        throw new Error(data?.error || 'Falha desconhecida');
      }

      setResultado(data);

      const { resumo, fases } = data;
      const saudavel = fases?.fase7_validacao_final?.saudavel;
      const dups = fases?.fase1_diagnostico_inicial?.duplicatas_encontradas || 0;

      if (modo === 'diagnostico') {
        toast.info(
          dups > 0
            ? `⚠️ ${dups} duplicata(s) encontrada(s) — clique em "Corrigir Tudo" para aplicar`
            : '✅ Nenhum problema detectado'
        );
      } else {
        toast.success(
          `✅ Saneamento completo! ${resumo.duplicatas_removidas} merged, ${resumo.mensagens_revinculadas} msgs revinculadas, ${resumo.threads_corrigidas} threads corrigidas. ${saudavel ? '🎯 Contato saudável' : '⚠️ Verificar resíduos'}`,
          { duration: 7000 }
        );
        if (onUpdate) await onUpdate();
      }
    } catch (e) {
      console.error('[PainelSaneamentoContato]', e);
      toast.error(`❌ ${e.message}`);
    } finally {
      setExecutando(null);
    }
  };

  const fases = resultado?.fases;
  const resumo = resultado?.resumo;
  const saudavel = fases?.fase7_validacao_final?.saudavel;

  return (
    <div className="p-4 space-y-3">
      <Alert className="p-3 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2">
          <Wrench className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-900">
            <p className="font-semibold mb-1">Saneamento em 7 fases (skill única):</p>
            <p className="text-blue-700">
              Dedup msgs · Mensagens órfãs · Threads órfãs · Canonical · Tags · Merge duplicatas · Validação
            </p>
          </div>
        </div>
      </Alert>

      {/* RESULTADO */}
      {resultado && (
        <div className="space-y-2">
          <div className={`p-3 rounded border ${saudavel ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {saudavel ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              )}
              <p className={`text-sm font-semibold ${saudavel ? 'text-green-700' : 'text-amber-700'}`}>
                {resultado.modo === 'diagnostico' ? 'Diagnóstico concluído' : 'Correção concluída'}
                <span className="text-xs ml-2 text-slate-500">({resultado.duracao_ms}ms)</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between bg-white rounded px-2 py-1">
                <span className="text-slate-600">Duplicatas mescladas</span>
                <Badge variant="outline">{resumo?.duplicatas_removidas || 0}</Badge>
              </div>
              <div className="flex items-center justify-between bg-white rounded px-2 py-1">
                <span className="text-slate-600">Mensagens dedup</span>
                <Badge variant="outline">{resumo?.mensagens_dedup || 0}</Badge>
              </div>
              <div className="flex items-center justify-between bg-white rounded px-2 py-1">
                <span className="text-slate-600">Msgs revinculadas</span>
                <Badge variant="outline">{resumo?.mensagens_revinculadas || 0}</Badge>
              </div>
              <div className="flex items-center justify-between bg-white rounded px-2 py-1">
                <span className="text-slate-600">Threads corrigidas</span>
                <Badge variant="outline">{resumo?.threads_corrigidas || 0}</Badge>
              </div>
              <div className="flex items-center justify-between bg-white rounded px-2 py-1">
                <span className="text-slate-600">Canonical</span>
                <Badge variant={resumo?.canonical_corrigido ? 'default' : 'outline'}>
                  {resumo?.canonical_corrigido ? '✓ corrigido' : 'ok'}
                </Badge>
              </div>
              <div className="flex items-center justify-between bg-white rounded px-2 py-1">
                <span className="text-slate-600">Tags limpas</span>
                <Badge variant="outline">{resumo?.tags_limpas || 0}</Badge>
              </div>
            </div>

            {fases?.fase1_diagnostico_inicial?.duplicatas_ids?.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-blue-700 cursor-pointer hover:underline">
                  Ver {fases.fase1_diagnostico_inicial.duplicatas_ids.length} duplicata(s)
                </summary>
                <div className="mt-1 text-xs text-slate-600 space-y-0.5">
                  {fases.fase1_diagnostico_inicial.duplicatas_ids.map(d => (
                    <div key={d.id} className="font-mono">↳ {d.nome || '(sem nome)'} — {d.id.substring(0, 12)}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* BOTÕES */}
      <div className="flex gap-2">
        <Button
          onClick={() => executar('diagnostico')}
          disabled={!!executando}
          variant="outline"
          className="flex-1 text-blue-600 border-blue-300 hover:bg-blue-50"
        >
          {executando === 'diagnostico' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Analisar
        </Button>
        <Button
          onClick={() => {
            if (!confirm('⚠️ Executar saneamento completo?\n\nIsto irá:\n• Mesclar duplicatas\n• Revincular mensagens órfãs\n• Corrigir threads e canonical\n\nAção IRREVERSÍVEL. Continuar?')) return;
            executar('correcao');
          }}
          disabled={!!executando}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
        >
          {executando === 'correcao' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
          Corrigir Tudo
        </Button>
      </div>

      {usuario?.role === 'admin' && (
        <p className="text-xs text-slate-500 text-center mt-3">
          Para auditoria em lote (sistema todo), use a <strong>Central de Saneamento</strong> no menu admin.
        </p>
      )}
    </div>
  );
}