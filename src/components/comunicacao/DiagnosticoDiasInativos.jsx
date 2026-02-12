import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function DiagnosticoDiasInativos({ contactId, contatoNome }) {
  const [abrindo, setAbrindo] = useState(false);
  const [diagnostico, setDiagnostico] = useState(null);

  const analisar = async () => {
    setAbrindo(true);
    try {
      const agora = new Date();

      // 1. Buscar análise mais recente
      const analises = await base44.entities.ContactBehaviorAnalysis.filter(
        { contact_id: contactId },
        '-analyzed_at',
        1
      );
      const analise = analises[0];

      // 2. Buscar thread canônica
      const threads = await base44.entities.MessageThread.filter(
        { contact_id: contactId, is_canonical: true },
        '-last_inbound_at',
        1
      );
      const thread = threads[0];

      // 3. Buscar contact para última_interacao
      const contatos = await base44.entities.Contact.filter(
        { id: contactId },
        null,
        1
      );
      const contato = contatos[0];

      // Calcular dias
      const ultimaInbound = thread?.last_inbound_at 
        ? new Date(thread.last_inbound_at) 
        : null;
      
      const ultimaInteracaoContact = contato?.ultima_interacao
        ? new Date(contato.ultima_interacao)
        : null;

      const diasDesdeInbound = ultimaInbound
        ? Math.floor((agora - ultimaInbound) / (1000 * 60 * 60 * 24))
        : null;

      const diasDesdeContact = ultimaInteracaoContact
        ? Math.floor((agora - ultimaInteracaoContact) / (1000 * 60 * 60 * 24))
        : null;

      const diasAnalise = analise?.days_inactive_inbound || null;

      setDiagnostico({
        contato: contatoNome,
        analiseExiste: !!analise,
        analisedoEm: analise?.analyzed_at,
        threadExiste: !!thread,
        lastInboundAt: ultimaInbound?.toISOString(),
        diasDesdeInbound,
        diasDesdeContact,
        diasAnalise,
        prioridadeLabel: analise?.priority_label,
        prioridadeScore: analise?.priority_score,
        status: analise?.status,
        compativel: diasDesdeInbound === diasAnalise || diasDesdeContact === diasAnalise
      });
    } catch (error) {
      console.error('Erro ao diagnosticar:', error);
      setDiagnostico({ erro: error.message });
    } finally {
      setAbrindo(false);
    }
  };

  if (!diagnostico) {
    return (
      <Button 
        size="sm" 
        variant="outline"
        onClick={analisar}
        disabled={abrindo}
        className="h-7 text-xs px-1.5"
        title="Verificar se dias_inativos bate com análise"
      >
        {abrindo ? <Loader2 className="w-3 h-3 animate-spin" /> : '🔍'} Debug
      </Button>
    );
  }

  if (diagnostico.erro) {
    return (
      <Badge variant="outline" className="text-red-700 border-red-300 text-xs">
        ❌ {diagnostico.erro}
      </Badge>
    );
  }

  return (
    <div className="text-xs space-y-1 mt-2 p-2 bg-slate-50 rounded border border-slate-200">
      <div className="flex items-center gap-2">
        {diagnostico.compativel ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
        )}
        <span className="font-bold">
          {diagnostico.compativel ? '✅ CORRETO' : '❌ DISCREPÂNCIA'}
        </span>
      </div>

      <div className="space-y-0.5 ml-4">
        <div className="text-slate-600">
          <span className="font-semibold">Análise:</span> {diagnostico.diasAnalise}d ago • {diagnostico.prioridadeLabel}
        </div>
        <div className="text-slate-600">
          <span className="font-semibold">last_inbound_at:</span> {diagnostico.diasDesdeInbound ?? 'N/A'}d ago
        </div>
        <div className="text-slate-600">
          <span className="font-semibold">Contact.ultima_interacao:</span> {diagnostico.diasDesdeContact ?? 'N/A'}d ago
        </div>
        {diagnostico.lastInboundAt && (
          <div className="text-[10px] text-slate-400">
            {new Date(diagnostico.lastInboundAt).toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>
    </div>
  );
}