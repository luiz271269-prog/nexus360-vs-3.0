import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Tag, 
  User, 
  Users, 
  Building2, 
  Handshake, 
  Target, 
  Truck,
  Star,
  Loader2,
  ChevronDown,
  Columns,
  UserCheck
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { ETIQUETAS_FIXAS_CONTATO } from "./EtiquetadorContato";

// Tipos de contato com ícones e cores
const TIPOS_CONTATO = [
  { value: 'lead', label: 'Lead', icon: Target, color: 'bg-amber-500', emoji: '🎯' },
  { value: 'cliente', label: 'Cliente', icon: Building2, color: 'bg-emerald-500', emoji: '💎' },
  { value: 'fornecedor', label: 'Fornecedor', icon: Truck, color: 'bg-blue-500', emoji: '🏭' },
  { value: 'parceiro', label: 'Parceiro', icon: Handshake, color: 'bg-purple-500', emoji: '🤝' },
];

// Estágios do Kanban
const ESTAGIOS_KANBAN = [
  { value: 'descoberta', label: 'Descoberta', color: 'bg-slate-400', emoji: '🔍' },
  { value: 'consideracao', label: 'Consideração', color: 'bg-blue-400', emoji: '🤔' },
  { value: 'decisao', label: 'Decisão', color: 'bg-amber-400', emoji: '⚖️' },
  { value: 'pos_venda', label: 'Pós-Venda', color: 'bg-green-400', emoji: '✅' },
  { value: 'fidelizacao', label: 'Fidelização', color: 'bg-purple-400', emoji: '💜' },
  { value: 'reativacao', label: 'Reativação', color: 'bg-red-400', emoji: '🔄' },
];

export default function ClassificadorContatoRapido({ contato, onUpdate, compact = false }) {
  const [salvando, setSalvando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const queryClient = useQueryClient();

  // Buscar atendentes
  const { data: atendentes = [] } = useQuery({
    queryKey: ['atendentes-whatsapp'],
    queryFn: () => base44.entities.User.filter({ is_whatsapp_attendant: true }, 'full_name'),
    staleTime: 5 * 60 * 1000
  });

  // Buscar etiquetas dinâmicas
  const { data: etiquetasDB = [] } = useQuery({
    queryKey: ['etiquetas-contato'],
    queryFn: () => base44.entities.EtiquetaContato.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  const todasEtiquetas = [...ETIQUETAS_FIXAS_CONTATO, ...etiquetasDB.map(etq => ({
    nome: etq.nome,
    label: etq.label,
    emoji: etq.emoji || '🏷️',
    cor: etq.cor || 'bg-slate-400',
    tipo: etq.tipo,
    destaque: etq.destaque || false
  }))];

  const etiquetasContato = contato?.tags || [];

  const atualizarContato = async (campo, valor) => {
    if (salvando || !contato) return;
    setSalvando(true);
    try {
      await base44.entities.Contact.update(contato.id, { [campo]: valor });
      toast.success('✅ Contato atualizado!');
      queryClient.invalidateQueries({ queryKey: ['contatos'] });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[ClassificadorContato] Erro:', error);
      toast.error('Erro ao atualizar');
    } finally {
      setSalvando(false);
    }
  };

  const toggleEtiqueta = async (valor) => {
    if (salvando || !contato) return;
    setSalvando(true);
    try {
      const novasEtiquetas = etiquetasContato.includes(valor)
        ? etiquetasContato.filter(e => e !== valor)
        : [...etiquetasContato, valor];

      await base44.entities.Contact.update(contato.id, { tags: novasEtiquetas });
      
      const config = todasEtiquetas.find(e => e.nome === valor);
      toast.success(`${config?.emoji || '🏷️'} ${novasEtiquetas.includes(valor) ? 'Adicionada' : 'Removida'}`);
      
      queryClient.invalidateQueries({ queryKey: ['contatos'] });
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[ClassificadorContato] Erro:', error);
      toast.error('Erro ao atualizar etiqueta');
    } finally {
      setSalvando(false);
    }
  };

  const handleMenuClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  // Obter configuração atual
  const tipoAtual = TIPOS_CONTATO.find(t => t.value === contato?.tipo_contato);
  const estagioAtual = ESTAGIOS_KANBAN.find(e => e.value === contato?.estagio_ciclo_vida);
  const atendenteAtual = contato?.atendente_fidelizado_vendas || contato?.atendente_fidelizado_assistencia;
  
  // Etiquetas em destaque
  const etiquetasDestaque = etiquetasContato.filter(etq => {
    const config = todasEtiquetas.find(e => e.nome === etq);
    return config?.destaque || ['vip', 'prioridade'].includes(etq);
  });

  return (
    <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
      <DropdownMenuTrigger asChild onClick={handleMenuClick}>
        {compact ? (
          <button
            className="flex items-center gap-1 p-1 rounded hover:bg-slate-100 transition-colors"
            disabled={salvando}
            onClick={handleMenuClick}
          >
            {salvando ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <>
                {/* Badge do Tipo */}
                {tipoAtual ? (
                  <div className={`w-5 h-5 rounded-full ${tipoAtual.color} flex items-center justify-center`}>
                    <span className="text-white text-[10px]">{tipoAtual.emoji}</span>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center">
                    <User className="w-3 h-3 text-white" />
                  </div>
                )}
                
                {/* Etiquetas em Destaque */}
                {etiquetasDestaque.slice(0, 2).map(etq => {
                  const config = todasEtiquetas.find(e => e.nome === etq);
                  return (
                    <span 
                      key={etq} 
                      className="text-xs animate-pulse"
                      title={config?.label}
                    >
                      {config?.emoji}
                    </span>
                  );
                })}
                
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </>
            )}
          </button>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 border-dashed hover:border-solid"
            disabled={salvando}
            onClick={handleMenuClick}
          >
            {tipoAtual?.emoji || '👤'} {tipoAtual?.label || 'Classificar'}
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        )}
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-72" onClick={handleMenuClick}>
        <DropdownMenuLabel className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>Classificação do Contato</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* TIPO DE CONTATO */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <div className="flex items-center gap-2">
              {tipoAtual ? (
                <div className={`w-4 h-4 rounded ${tipoAtual.color} flex items-center justify-center`}>
                  <tipoAtual.icon className="w-2.5 h-2.5 text-white" />
                </div>
              ) : (
                <User className="w-4 h-4 text-slate-400" />
              )}
              <span>Tipo: <strong>{tipoAtual?.label || 'Não definido'}</strong></span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {TIPOS_CONTATO.map(tipo => (
                <DropdownMenuItem
                  key={tipo.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    atualizarContato('tipo_contato', tipo.value);
                  }}
                  className="cursor-pointer"
                >
                  <div className={`w-5 h-5 rounded ${tipo.color} flex items-center justify-center mr-2`}>
                    <tipo.icon className="w-3 h-3 text-white" />
                  </div>
                  <span>{tipo.emoji} {tipo.label}</span>
                  {contato?.tipo_contato === tipo.value && (
                    <span className="ml-auto text-green-500">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* ESTÁGIO KANBAN */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <div className="flex items-center gap-2">
              <Columns className="w-4 h-4 text-slate-500" />
              <span>Kanban: <strong>{estagioAtual?.label || 'Não definido'}</strong></span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {ESTAGIOS_KANBAN.map(estagio => (
                <DropdownMenuItem
                  key={estagio.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    atualizarContato('estagio_ciclo_vida', estagio.value);
                  }}
                  className="cursor-pointer"
                >
                  <div className={`w-4 h-4 rounded ${estagio.color} mr-2`} />
                  <span>{estagio.emoji} {estagio.label}</span>
                  {contato?.estagio_ciclo_vida === estagio.value && (
                    <span className="ml-auto text-green-500">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* ATENDENTE FIXO */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-500" />
              <span>Atendente: <strong>{atendenteAtual || 'Não atribuído'}</strong></span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  atualizarContato('atendente_fidelizado_vendas', '');
                }}
                className="cursor-pointer"
              >
                <User className="w-4 h-4 mr-2 text-slate-400" />
                <span className="text-slate-500">Nenhum (remover)</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {atendentes.map(atendente => (
                <DropdownMenuItem
                  key={atendente.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    atualizarContato('atendente_fidelizado_vendas', atendente.full_name);
                  }}
                  className="cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mr-2">
                    <span className="text-white text-xs font-bold">
                      {atendente.full_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span>{atendente.full_name}</span>
                  {atendenteAtual === atendente.full_name && (
                    <span className="ml-auto text-green-500">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* ETIQUETAS EM DESTAQUE */}
        <DropdownMenuLabel className="text-xs text-slate-500 flex items-center gap-1">
          <Star className="w-3 h-3" />
          Etiquetas Destaque
        </DropdownMenuLabel>
        
        <div className="px-2 py-1 flex flex-wrap gap-1">
          {todasEtiquetas
            .filter(etq => etq.destaque || ['vip', 'prioridade', 'fidelizado', 'potencial'].includes(etq.nome))
            .map(etq => {
              const ativa = etiquetasContato.includes(etq.nome);
              return (
                <Badge
                  key={etq.nome}
                  className={`cursor-pointer transition-all ${
                    ativa 
                      ? `${etq.cor} text-white shadow-md scale-105` 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleEtiqueta(etq.nome);
                  }}
                >
                  {etq.emoji} {etq.label}
                </Badge>
              );
            })}
        </div>

        <DropdownMenuSeparator />

        {/* TODAS ETIQUETAS */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-slate-500" />
              <span>Todas Etiquetas</span>
              {etiquetasContato.length > 0 && (
                <Badge variant="secondary" className="text-xs ml-auto">
                  {etiquetasContato.length}
                </Badge>
              )}
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
              {todasEtiquetas.map(etq => (
                <DropdownMenuCheckboxItem
                  key={etq.nome}
                  checked={etiquetasContato.includes(etq.nome)}
                  onCheckedChange={() => toggleEtiqueta(etq.nome)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${etq.cor}`} />
                    <span>{etq.emoji} {etq.label}</span>
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* RESUMO ATUAL */}
        {(tipoAtual || estagioAtual || atendenteAtual || etiquetasContato.length > 0) && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 bg-slate-50 rounded-b-md">
              <p className="text-[10px] text-slate-500 font-medium mb-1">RESUMO:</p>
              <div className="flex flex-wrap gap-1">
                {tipoAtual && (
                  <Badge className={`${tipoAtual.color} text-white text-[10px]`}>
                    {tipoAtual.emoji} {tipoAtual.label}
                  </Badge>
                )}
                {estagioAtual && (
                  <Badge className={`${estagioAtual.color} text-white text-[10px]`}>
                    {estagioAtual.emoji} {estagioAtual.label}
                  </Badge>
                )}
                {atendenteAtual && (
                  <Badge variant="outline" className="text-[10px]">
                    👤 {atendenteAtual}
                  </Badge>
                )}
                {etiquetasContato.slice(0, 3).map(etq => {
                  const config = todasEtiquetas.find(e => e.nome === etq);
                  return (
                    <Badge 
                      key={etq} 
                      className={`${config?.cor || 'bg-slate-400'} text-white text-[10px]`}
                    >
                      {config?.emoji}
                    </Badge>
                  );
                })}
                {etiquetasContato.length > 3 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{etiquetasContato.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Exportar constantes para uso externo
export { TIPOS_CONTATO, ESTAGIOS_KANBAN };