import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger } from
"@/components/ui/tooltip";
import { MessageSquare, AlertCircle, TrendingUp, Phone, RefreshCw } from "lucide-react";
import { isNaoAtribuida } from "../lib/threadVisibility";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔔 CONTADOR INTELIGENTE - NÃO ATRIBUÍDAS (CALCULADO LOCALMENTE)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ✅ AGORA: Calcula localmente a partir de threads do pai
 * ❌ ANTES: Chamava backend a cada 15s (causava rate limit)
 * 
 * Recebe threads do pai (Comunicacao.jsx) já filtradas e calcula:
 * 1️⃣ Threads não atribuídas
 * 2️⃣ Breakdown por setor
 * 3️⃣ Breakdown por integração
 */
export default function ContadorNaoAtribuidas({ threads = [], integracoes = [], usuario = null, onClickVerFila, onClickConexao, className = "", variant = "header" }) {
  // ✅ CIRÚRGICA: CALCULAR LOCALMENTE - APENAS threads EXTERNAS não atribuídas
  const dados = useMemo(() => {
    if (!threads.length || !usuario) {
      return { 
        total: 0, 
        nao_atribuidas: 0, 
        travadas: 0, 
        por_setor: [], 
        por_integracao: [] 
      };
    }

    // ✅ SAGRADO: Filtrar threads não atribuídas EXTERNAS (EXCLUIR internas)
    const naoAtribuidas = threads.filter(t => {
      // ✅ CRÍTICO: Threads internas NÃO participam de "não atribuídas"
      if (t.thread_type === 'team_internal' || t.thread_type === 'sector_group') {
        return false;
      }
      return isNaoAtribuida(t);
    });

    // Breakdown por setor
    const porSetorMap = {};
    naoAtribuidas.forEach(t => {
      const setor = t.sector_id || 'sem_setor';
      if (!porSetorMap[setor]) {
        porSetorMap[setor] = { sector_id: setor, total: 0, nao_atribuidas: 0, travadas: 0 };
      }
      porSetorMap[setor].total++;
      porSetorMap[setor].nao_atribuidas++;
    });

    // Breakdown por integração
    const porIntegracaoMap = {};
    naoAtribuidas.forEach(t => {
      const intId = t.whatsapp_integration_id || 'sem_integracao';
      if (!porIntegracaoMap[intId]) {
        porIntegracaoMap[intId] = { integration_id: intId, total: 0 };
      }
      porIntegracaoMap[intId].total++;
    });

    return {
      total: naoAtribuidas.length,
      nao_atribuidas: naoAtribuidas.length,
      travadas: 0,
      por_setor: Object.values(porSetorMap),
      por_integracao: Object.values(porIntegracaoMap)
    };
  }, [threads, usuario]);

  // Obter nome amigável da integração
  const getNomeIntegracao = (integrationId) => {
    const integracao = integracoes.find((i) => i.id === integrationId);
    return integracao?.nome_instancia || integracao?.numero_telefone || integrationId;
  };

  // Determinar estilo baseado na quantidade
  const getEstilo = () => {
    if (dados.total === 0) {
      return {
        bg: 'bg-gradient-to-r from-slate-50 to-slate-100',
        border: 'border-slate-200',
        text: 'text-slate-600',
        icon: 'text-slate-400',
        badge: 'bg-slate-200 text-slate-700',
        glow: ''
      };
    }
    if (dados.total < 5) {
      return {
        bg: 'bg-gradient-to-r from-blue-50 to-blue-100',
        border: 'border-blue-300',
        text: 'text-blue-700',
        icon: 'text-blue-600',
        badge: 'bg-blue-500 text-white',
        glow: 'shadow-blue-200/50'
      };
    }
    if (dados.total < 10) {
      return {
        bg: 'bg-gradient-to-r from-amber-50 to-amber-100',
        border: 'border-amber-300',
        text: 'text-amber-700',
        icon: 'text-amber-600',
        badge: 'bg-amber-500 text-white animate-pulse',
        glow: 'shadow-amber-200/50 animate-pulse'
      };
    }
    return {
      bg: 'bg-gradient-to-r from-red-50 to-red-100',
      border: 'border-red-400',
      text: 'text-red-700',
      icon: 'text-red-600',
      badge: 'bg-red-600 text-white animate-pulse',
      glow: 'shadow-red-300/60 animate-pulse'
    };
  };

  const estilo = getEstilo();

  // ✅ VERSÃO SIDEBAR - Botão compacto igual aos internos
  if (variant === "sidebar") {
    return (
      <Button
        onClick={onClickVerFila}
        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0 h-7 text-[10px] px-2 flex items-center gap-1.5 font-semibold shadow-md"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span>Não Atrib.</span>
        {dados.total > 0 && (
          <Badge className="ml-0.5 h-4 min-w-4 px-1 rounded-full text-[8px] font-bold bg-white/30">
            {dados.total}
          </Badge>
        )}
      </Button>
    );
  }

  const content =
  <Button
    variant="ghost" className="bg-orange-500 px-2.5 py-1.5 text-sm font-medium opacity-60 rounded-lg justify-center whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground group relative flex items-center gap-1.5 h-auto border transition-all hover:shadow-md from-blue-50 to-blue-100 border-blue-300 shadow-blue-200/50 shadow-lg"

    onClick={onClickVerFila}>

      {/* Ícone */}
      <MessageSquare className={`w-4 h-4 ${estilo.icon}`} />

      {/* Contador */}
      <span className={`text-base font-bold ${estilo.text} leading-none`}>
        {dados.total}
      </span>

      {/* Badge de alerta */}
      {dados.total > 0 &&
    <div className={`absolute -top-1 -right-1 ${estilo.badge} px-1 rounded-full text-[9px] font-bold`}>
          {dados.total}
        </div>
    }
    </Button>;


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
        <TooltipContent side="bottom" className="max-w-md p-4 bg-white border-2 shadow-xl">
          <div className="space-y-3">
            {/* Header */}
            <div className="pb-2 border-b space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <p className="text-sm font-bold text-slate-800">
                  Conversas Requerendo Atenção
                </p>
              </div>
              
              {/* Breakdown de tipos */}
              {(dados.nao_atribuidas > 0 || dados.travadas > 0) && (
                <div className="flex gap-2 text-xs">
                  {dados.nao_atribuidas > 0 && (
                    <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      <span className="text-slate-600">Não atribuídas:</span>
                      <span className="font-bold text-blue-700">{dados.nao_atribuidas}</span>
                    </div>
                  )}
                  {dados.travadas > 0 && (
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                      <span className="text-slate-600">Travadas:</span>
                      <span className="font-bold text-amber-700">{dados.travadas}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Breakdown por Setor */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                Por Setor
              </p>
              <div className="space-y-2">
                {dados.por_setor.
                sort((a, b) => b.total - a.total).
                map((item, idx) =>
                <div
                  key={idx}
                  className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-slate-50 transition-colors">

                      <div className="flex flex-col gap-1 flex-1">
                        <span className="text-xs text-slate-700 font-medium capitalize flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                      idx === 0 ? 'bg-blue-500' :
                      idx === 1 ? 'bg-purple-500' :
                      'bg-slate-400'}`
                      } />
                          {item.sector_id === 'sem_setor' ? '(Sem setor definido)' : item.sector_id}
                        </span>
                        
                        {/* Detalhamento tipo */}
                        {(item.nao_atribuidas > 0 || item.travadas > 0) && (
                          <span className="text-[10px] text-slate-500 ml-4">
                            {item.nao_atribuidas > 0 && `${item.nao_atribuidas} nova${item.nao_atribuidas > 1 ? 's' : ''}`}
                            {item.nao_atribuidas > 0 && item.travadas > 0 && ' • '}
                            {item.travadas > 0 && `${item.travadas} travada${item.travadas > 1 ? 's' : ''}`}
                          </span>
                        )}
                      </div>
                      
                      <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-xs font-bold px-2">
                        {item.total}
                      </Badge>
                    </div>
                )}
              </div>
            </div>

            {/* Breakdown por Conexão */}
            {dados.por_integracao.length > 0 &&
            <>
                <div className="border-t border-slate-200" />
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    Por Conexão WhatsApp
                  </p>
                  <div className="space-y-2">
                    {dados.por_integracao.
                  sort((a, b) => b.total - a.total).
                  slice(0, 5).
                  map((item, idx) =>
                  <button
                    key={idx}
                    onClick={() => onClickConexao?.(item.integration_id)}
                    className="w-full flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition-all cursor-pointer">

                          <span className="text-xs text-slate-700 font-medium truncate max-w-[200px]">
                            📱 {getNomeIntegracao(item.integration_id)}
                          </span>
                          <Badge variant="outline" className="text-xs font-bold border-slate-300 px-2 group-hover:border-indigo-400">
                            {item.total}
                          </Badge>
                        </button>
                  )}
                  </div>
                  {dados.por_integracao.length > 5 &&
                <p className="text-[10px] text-slate-500 mt-2 text-center">
                      +{dados.por_integracao.length - 5} outras conexões
                    </p>
                }
                </div>
              </>
            }

            {/* Footer com timestamp */}
            <div className="border-t border-slate-200 pt-2">
              <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Atualizado automaticamente a cada 15s
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>);

}