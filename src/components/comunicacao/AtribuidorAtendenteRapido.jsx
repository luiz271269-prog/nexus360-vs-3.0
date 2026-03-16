import React from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  User, 
  UserCheck, 
  Users, 
  Loader2, 
  ChevronDown,
  AlertCircle,
  Star
} from "lucide-react";
import { toast } from "sonner";
import { FILAS_ATENDIMENTO } from "./CentralInteligenciaContato";

/**
 * AtribuidorAtendenteRapido - Componente reutilizável para atribuir atendentes a contatos
 * 
 * ⚠️ IMPORTANTE: Este componente DEPENDE de receber a lista de atendentes via props.
 * NÃO busca atendentes diretamente porque User tem regras de segurança especiais (403).
 * O componente pai DEVE buscar atendentes via listarUsuariosParaAtribuicao e passar.
 * 
 * Props:
 * - contato: objeto Contact com campos de fidelização
 * - thread: objeto MessageThread (opcional) para atribuição de conversa
 * - tipoContato: 'lead' | 'cliente' | 'fornecedor' | 'parceiro' | 'novo'
 * - setorAtual: 'vendas' | 'assistencia' | 'financeiro' | 'fornecedor' | 'geral'
 * - onUpdate: callback após atualização
 * - variant: 'mini' | 'compact' | 'button' | 'badge'
 * - showLabel: boolean para mostrar label
 * - atendentes: lista de atendentes (OBRIGATÓRIO - vem do pai via listarUsuariosParaAtribuicao)
 */
export default function AtribuidorAtendenteRapido({
  contato,
  thread,
  tipoContato = 'novo',
  setorAtual = 'geral',
  onUpdate,
  variant = 'mini',
  showLabel = false,
  disabled = false,
  atendentes = [] // ✅ PROP: Recebe lista de atendentes do pai
}) {
  const [salvando, setSalvando] = React.useState(false);
  const [menuAberto, setMenuAberto] = React.useState(false);
  const queryClient = useQueryClient();

  // Determinar qual campo de fidelização usar baseado no tipo de contato e setor
  const getCampoFidelizacao = () => {
    const configSetor = FILAS_ATENDIMENTO.find(f => f.value === setorAtual);
    if (configSetor?.campo_fidelizacao) {
      return configSetor.campo_fidelizacao;
    }

    // Fallback baseado no tipo de contato
    switch (tipoContato) {
      case 'fornecedor':
        return 'atendente_fidelizado_fornecedor';
      case 'cliente':
        return 'atendente_fidelizado_vendas';
      case 'lead':
        return 'atendente_fidelizado_vendas';
      default:
        return 'vendedor_responsavel';
    }
  };

  // ✅ Obter atendente atual - Retorna ID do atendente
  const getAtendenteAtual = () => {
    // Para atribuição de conversa: buscar User pelo assigned_user_id
    if (thread?.id && thread.assigned_user_id) {
      return thread.assigned_user_id;
    }
    
    // Para fidelização de contato: usar campos do contato (ID do atendente)
    if (!contato) return null;
    const campo = getCampoFidelizacao();
    return contato[campo] || contato.vendedor_responsavel || null;
  };

  const atendenteAtual = getAtendenteAtual();

  // Handler para atribuir atendente
  // IMPORTANTE: Se thread for passada, atualiza APENAS a conversa (não fideliza contato)
  // Se thread NÃO for passada, atualiza o contato (fidelização)
  const handleAtribuir = async (atendenteId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (salvando || disabled) return;
    setSalvando(true);

    try {
      const atendente = atendenteId ? atendentes.find(a => a.id === atendenteId) : null;

      // ═══════════════════════════════════════════════════════════════════════
      // CASO 1: ATRIBUIÇÃO DE CONVERSA (thread passada)
      // ═══════════════════════════════════════════════════════════════════════
      if (thread?.id) {
        // ✅ FIDELIZADO: Apenas atendente fidelizado ou admin pode atribuir
        const usuarioAtual = await base44.auth.me();
        if (contato?.is_cliente_fidelizado && usuarioAtual?.role !== 'admin') {
          const camposFidelizacao = [
            'atendente_fidelizado_vendas',
            'atendente_fidelizado_assistencia',
            'atendente_fidelizado_financeiro',
            'atendente_fidelizado_fornecedor',
            'vendedor_responsavel'
          ];
          
          const atendentesFidelizados = camposFidelizacao
            .map(campo => contato[campo])
            .filter(Boolean);
          
          if (atendentesFidelizados.length > 0 && !atendentesFidelizados.includes(atendenteId)) {
            toast.error("❌ Contato fidelizado - só pode atribuir ao atendente responsável");
            setSalvando(false);
            return;
          }
        }

        // ✅ HISTÓRICO: Ao transferir, adicionar atendente anterior ao shared_with_users
        // Garante que quem já atendeu NUNCA perde visibilidade da conversa
        const updatePayload = {
          assigned_user_id: atendente ? atendente.id : null
        };

        if (thread.assigned_user_id && thread.assigned_user_id !== (atendente?.id || null)) {
          // Há troca real de atendente — preservar o anterior em ambos os campos
          const prevId = thread.assigned_user_id;
          const sharedAtual = Array.isArray(thread.shared_with_users) ? thread.shared_with_users : [];
          const historicoAtual = Array.isArray(thread.atendentes_historico) ? thread.atendentes_historico : [];
          updatePayload.shared_with_users = [...new Set([...sharedAtual, prevId])];
          updatePayload.atendentes_historico = [...new Set([...historicoAtual, prevId])];
        }

        await base44.entities.MessageThread.update(thread.id, updatePayload);
        toast.success(`✅ Conversa ${atendente ? `atribuída a ${atendente.full_name || atendente.email}` : 'liberada'}`);
      }
      // ═══════════════════════════════════════════════════════════════════════
      // CASO 2: FIDELIZAÇÃO DE CONTATO (sem thread, apenas contato)
      // ═══════════════════════════════════════════════════════════════════════
      else if (contato?.id) {
        const usuarioAtual = await base44.auth.me();
        
        // ✅ FIDELIZADO: Apenas atendente fidelizado ou admin pode alterar
        if (contato.is_cliente_fidelizado && atendenteId && usuarioAtual?.role !== 'admin') {
          const camposFidelizacao = [
            'atendente_fidelizado_vendas',
            'atendente_fidelizado_assistencia',
            'atendente_fidelizado_financeiro',
            'atendente_fidelizado_fornecedor',
            'vendedor_responsavel'
          ];
          
          const atendentesFidelizados = camposFidelizacao
            .map(campo => contato[campo])
            .filter(Boolean);
          
          if (atendentesFidelizados.length > 0 && !atendentesFidelizados.includes(atendenteId)) {
            toast.error("❌ Contato fidelizado - só o atendente responsável pode alterar");
            setSalvando(false);
            return;
          }
        }
        const campo = getCampoFidelizacao();
        const atualizacoes = {
          [campo]: atendente ? atendente.id : null
        };

        if (['lead', 'cliente', 'novo'].includes(tipoContato)) {
          atualizacoes.vendedor_responsavel = atendente ? atendente.id : null;
        }

        if (atendente && campo !== 'vendedor_responsavel') {
          atualizacoes.is_cliente_fidelizado = true;
        } else if (!atendente) {
          atualizacoes.is_cliente_fidelizado = false;
        }

        await base44.entities.Contact.update(contato.id, atualizacoes);
        toast.success(`✅ Contato ${atendente ? `fidelizado a ${atendente.full_name || atendente.email}` : 'desfidelizado'}`);
      }

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });

      if (onUpdate) onUpdate();
      setMenuAberto(false);

    } catch (error) {
      console.error('[AtribuidorRapido] Erro:', error);
      toast.error('Erro ao atribuir atendente');
    } finally {
      setSalvando(false);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  // ✅ TRANSFERÊNCIA: Se fidelizado, mostrar atendente responsável PRIMEIRO
  const pessoasDisponiveis = React.useMemo(() => {
    // Obter ID do atendente fidelizado
    const campoFidelizacao = getCampoFidelizacao();
    const atendenteFilizado = contato ? contato[campoFidelizacao] || contato.vendedor_responsavel : null;
    
    const pessoas = atendentes
      .filter(a => {
        if (!(a.full_name || a.email)) return false;
        return true;
      })
      .map(a => ({
        nome: a.full_name || a.email,
        id: a.id,
        setor: a.attendant_sector || 'geral',
        email: a.email,
        isFidelizado: atendenteFilizado && (a.id === atendenteFilizado || a.email === atendenteFilizado)
      }));

    // Separar fidelizado do restante e ordenar
    const fidelizado = pessoas.filter(p => p.isFidelizado);
    const restantes = pessoas.filter(p => !p.isFidelizado).sort((a, b) => a.nome.localeCompare(b.nome));
    
    return [...fidelizado, ...restantes];
  }, [atendentes, contato]);

  // ═══════════════════════════════════════════════════════════════════════════
  // VARIANT: MINI - Apenas ícone pequeno
  // ═══════════════════════════════════════════════════════════════════════════
  if (variant === 'mini') {
    const atendenteObj = atendentes.find(a => a.id === atendenteAtual);
    const nomeExibicao = atendenteObj?.full_name || atendenteObj?.email;
    
    return (
      <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
        <DropdownMenuTrigger asChild onClick={handleClick}>
          <button
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
              atendenteAtual 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-red-50 text-red-500 hover:bg-red-100 animate-pulse'
            }`}
            disabled={salvando || disabled}
            title={nomeExibicao ? `Atribuído: ${nomeExibicao}` : 'Clique para atribuir'}
          >
            {salvando ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : atendenteAtual ? (
              <>
                <UserCheck className="w-2.5 h-2.5" />
                <span className="truncate max-w-[50px]">{nomeExibicao?.split(' ')[0] || nomeExibicao?.split('@')[0]}</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-2.5 h-2.5" />
                <span>S/atend.</span>
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="start" className="w-56" onClick={handleClick}>
          <DropdownMenuLabel className="text-xs flex items-center gap-2">
            <Users className="w-3 h-3" />
            Atribuir Atendente
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {atendenteAtual && (
            <>
              <DropdownMenuItem
                onClick={(e) => handleAtribuir(null, e)}
                className="text-red-600 cursor-pointer"
              >
                <User className="w-4 h-4 mr-2 text-red-400" />
                Remover Atribuição
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          {pessoasDisponiveis.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-slate-500">
              Nenhum usuário disponível
            </div>
          ) : (
            pessoasDisponiveis.map(pessoa => (
              <DropdownMenuItem
                key={pessoa.id}
                onClick={(e) => handleAtribuir(pessoa.id, e)}
                className={`cursor-pointer ${pessoa.isFidelizado ? 'bg-amber-50' : ''}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${pessoa.isFidelizado ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'}`}>
                  <span className="text-white text-xs font-bold">{pessoa.nome?.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{pessoa.nome}</p>
                  {pessoa.setor && (
                    <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                      <span className="text-blue-500">♦</span> {pessoa.setor}
                    </p>
                  )}
                </div>
                {pessoa.isFidelizado && (
                  <Badge className="bg-amber-100 text-amber-700 text-[10px] mr-1">VIP</Badge>
                )}
                {atendenteAtual === pessoa.id && (
                  <Star className="w-3 h-3 text-amber-500 ml-1" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VARIANT: COMPACT - Badge compacto
  // ═══════════════════════════════════════════════════════════════════════════
  if (variant === 'compact') {
    const atendenteObj = atendentes.find(a => a.id === atendenteAtual);
    const nomeExibicao = atendenteObj?.full_name || atendenteObj?.email || 'Não atribuído';
    
    return (
      <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
        <DropdownMenuTrigger asChild onClick={handleClick}>
          <Badge
            className={`cursor-pointer transition-all ${
              atendenteAtual 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-red-100 text-red-600 hover:bg-red-200'
            }`}
          >
            {salvando ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : atendenteAtual ? (
              <UserCheck className="w-3 h-3 mr-1" />
            ) : (
              <AlertCircle className="w-3 h-3 mr-1" />
            )}
            {nomeExibicao}
            <ChevronDown className="w-3 h-3 ml-1" />
          </Badge>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56" onClick={handleClick}>
          <DropdownMenuLabel className="text-xs">Atribuir Atendente</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {atendenteAtual && (
            <DropdownMenuItem
              onClick={(e) => handleAtribuir(null, e)}
              className="text-red-600 cursor-pointer"
            >
              <User className="w-4 h-4 mr-2" />
              Remover Atribuição
            </DropdownMenuItem>
          )}
          
          {pessoasDisponiveis.map(pessoa => (
            <DropdownMenuItem
              key={pessoa.id}
              onClick={(e) => handleAtribuir(pessoa.id, e)}
              className="cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center mr-2">
                <span className="text-white text-xs font-bold">{pessoa.nome?.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{pessoa.nome}</p>
                {pessoa.setor && (
                  <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                    <span className="text-blue-500">♦</span> {pessoa.setor}
                  </p>
                )}
              </div>
              {atendenteAtual === pessoa.id && <Star className="w-3 h-3 text-amber-500 ml-1" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VARIANT: BUTTON - Botão completo
  // ═══════════════════════════════════════════════════════════════════════════
  if (variant === 'button') {
    const atendenteObj = atendentes.find(a => a.id === atendenteAtual);
    const nomeExibicao = atendenteObj?.full_name || atendenteObj?.email;
    
    return (
      <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
        <DropdownMenuTrigger asChild onClick={handleClick}>
          <Button
            variant={atendenteAtual ? "outline" : "destructive"}
            size="sm"
            className="gap-2"
            disabled={salvando || disabled}
          >
            {salvando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : atendenteAtual ? (
              <UserCheck className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {showLabel && (nomeExibicao || 'Atribuir')}
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-64" onClick={handleClick}>
          <DropdownMenuLabel>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Atribuir Atendente/Vendedor
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {atendenteAtual && (
            <>
              <DropdownMenuItem
                onClick={(e) => handleAtribuir(null, e)}
                className="text-red-600 cursor-pointer"
              >
                <User className="w-4 h-4 mr-2" />
                Remover Atribuição Atual
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          {pessoasDisponiveis.map(pessoa => (
            <DropdownMenuItem
              key={pessoa.id}
              onClick={(e) => handleAtribuir(pessoa.id, e)}
              className="cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mr-2">
                <span className="text-white text-sm font-bold">{pessoa.nome?.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">{pessoa.nome}</p>
                {pessoa.setor && (
                  <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                    <span className="text-blue-500">♦</span> {pessoa.setor}
                  </p>
                )}
              </div>
              {atendenteAtual === pessoa.id && (
                <Badge className="bg-amber-100 text-amber-700">Atual</Badge>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VARIANT: BADGE (default) - Badge padrão
  // ═══════════════════════════════════════════════════════════════════════════
  const atendenteObj = atendentes.find(a => a.id === atendenteAtual);
  const nomeExibicao = atendenteObj?.full_name || atendenteObj?.email || 'Não atribuído';
  
  return (
    <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
      <DropdownMenuTrigger asChild onClick={handleClick}>
        <Badge
          variant={atendenteAtual ? "secondary" : "destructive"}
          className="cursor-pointer gap-1 hover:opacity-80"
        >
          {salvando ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Users className="w-3 h-3" />
          )}
          {nomeExibicao}
        </Badge>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56" onClick={handleClick}>
        <DropdownMenuLabel>Atribuir Responsável</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {pessoasDisponiveis.map(pessoa => (
          <DropdownMenuItem
            key={pessoa.id}
            onClick={(e) => handleAtribuir(pessoa.id, e)}
            className="cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mr-2">
              <span className="text-white text-xs font-bold">{pessoa.nome?.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{pessoa.nome}</p>
              {pessoa.setor && (
                <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                  <span className="text-blue-500">♦</span> {pessoa.setor}
                </p>
              )}
            </div>
            {atendenteAtual === pessoa.id && <Star className="w-3 h-3 text-amber-500 ml-1" />}
          </DropdownMenuItem>
        ))}
        
        {atendenteAtual && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => handleAtribuir(null, e)}
              className="text-red-600 cursor-pointer"
            >
              Remover Atribuição
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}