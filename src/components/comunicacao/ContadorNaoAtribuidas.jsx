import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MessageSquare, AlertCircle, RefreshCw } from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔔 CONTADOR DE MENSAGENS NÃO ATRIBUÍDAS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Exibe contador visual de threads não atribuídas visíveis ao usuário.
 * - Atualiza a cada 15 segundos
 * - Mostra breakdown por setor no tooltip
 * - Cores de alerta baseadas na quantidade
 */
export default function ContadorNaoAtribuidas({ onClickVerFila, className = "" }) {
  const [dados, setDados] = useState({ total: 0, por_setor: [], por_integracao: [] });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const carregarContador = async () => {
    try {
      setErro(null);
      const resultado = await base44.functions.invoke('contarNaoAtribuidasVisiveis', {});
      setDados(resultado.data || { total: 0, por_setor: [], por_integracao: [] });
    } catch (error) {
      console.error('[CONTADOR] Erro ao buscar:', error);
      setErro(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarContador();

    // Atualizar a cada 15 segundos
    const interval = setInterval(carregarContador, 15000);

    return () => clearInterval(interval);
  }, []);

  // Determinar cor baseado na quantidade
  const getColorClass = () => {
    if (dados.total === 0) return 'bg-slate-100 text-slate-600 border-slate-200';
    if (dados.total < 5) return 'bg-blue-100 text-blue-700 border-blue-300';
    if (dados.total < 10) return 'bg-amber-100 text-amber-700 border-amber-300 animate-pulse';
    return 'bg-red-100 text-red-700 border-red-300 animate-pulse';
  };

  const getIconClass = () => {
    if (dados.total === 0) return 'text-slate-400';
    if (dados.total < 5) return 'text-blue-600';
    if (dados.total < 10) return 'text-amber-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 ${className}`}>
        <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
        <span className="text-sm text-slate-600">Carregando...</span>
      </div>
    );
  }

  if (erro) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 ${className}`}>
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700 font-medium">Erro</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs">{erro}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const content = (
    <Button
      variant="ghost"
      className={`flex items-center gap-2 px-3 py-2 h-auto rounded-lg border transition-all hover:shadow-md ${getColorClass()} ${className}`}
      onClick={onClickVerFila}
    >
      <MessageSquare className={`w-5 h-5 ${getIconClass()}`} />
      <div className="flex flex-col items-start">
        <span className="text-xs font-medium opacity-70">Não Atribuídas</span>
        <span className="text-lg font-bold leading-none">{dados.total}</span>
      </div>
    </Button>
  );

  // Se não tiver breakdown, exibir simples
  if (dados.por_setor.length === 0) {
    return content;
  }

  // Com tooltip de breakdown
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">Breakdown por Setor:</p>
            <div className="space-y-1">
              {dados.por_setor
                .sort((a, b) => b.total - a.total)
                .map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-slate-600 capitalize">
                      {item.sector_id === 'sem_setor' ? '(Sem setor)' : item.sector_id}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {item.total}
                    </Badge>
                  </div>
                ))}
            </div>
            {dados.por_integracao.length > 1 && (
              <>
                <div className="border-t border-slate-200 my-2" />
                <p className="text-xs font-semibold text-slate-700">Por Conexão:</p>
                <div className="space-y-1">
                  {dados.por_integracao
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 3)
                    .map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                        <span className="text-slate-600 truncate max-w-[150px]">
                          {item.integration_id}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {item.total}
                        </Badge>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}