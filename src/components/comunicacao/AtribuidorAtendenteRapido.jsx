import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
 * Props:
 * - contato: objeto Contact com campos de fidelização
 * - thread: objeto MessageThread (opcional) para atribuição de conversa
 * - tipoContato: 'lead' | 'cliente' | 'fornecedor' | 'parceiro' | 'novo'
 * - setorAtual: 'vendas' | 'assistencia' | 'financeiro' | 'fornecedor' | 'geral'
 * - onUpdate: callback após atualização
 * - variant: 'mini' | 'compact' | 'button' | 'badge'
 * - showLabel: boolean para mostrar label
 */
export default function AtribuidorAtendenteRapido({
  contato,
  thread,
  tipoContato = 'novo',
  setorAtual = 'geral',
  onUpdate,
  variant = 'mini',
  showLabel = false,
  disabled = false
}) {
  const [salvando, setSalvando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const queryClient = useQueryClient();

  // Buscar TODOS os usuários do sistema sem nenhum filtro para atribuição/transferência
  const { data: atendentes = [] } = useQuery({
    queryKey: ['todos-usuarios-atribuidor'],
    queryFn: async () => {
      try {
        // Tentar list() primeiro
        const users = await base44.entities.User.list();
        console.log('[AtribuidorRapido] Usuários carregados:', users?.length || 0);
        // Retorna TODOS os usuários válidos (apenas verifica se tem id)
        return (users || []).filter(u => u && u.id);
      } catch (error) {
        console.warn('[AtribuidorRapido] Erro ao carregar usuários:', error.message);
        // Fallback: tentar filter
        try {
          const users = await base44.entities.User.filter({});
          return (users || []).filter(u => u && u.id);
        } catch (e) {
          console.error('[AtribuidorRapido] Falha total ao carregar usuários');
          return [];
        }
      }
    },
    staleTime: 5 * 60 * 1000
  });

  // Buscar vendedores
  const { data: vendedores = [] } = useQuery({
    queryKey: ['vendedores-atribuidor'],
    queryFn: () => base44.entities.Vendedor.filter({ status: 'ativo' }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

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

  // Obter atendente atual
  // Se thread foi passada, mostrar o atendente da conversa
  // Se não, mostrar o atendente fidelizado do contato
  const getAtendenteAtual = () => {
    // Para atribuição de conversa: usar assigned_user_name da thread
    if (thread?.id) {
      return thread.assigned_user_name || null;
    }
    
    // Para fidelização de contato: usar campos do contato
    if (!contato) return null;
    const campo = getCampoFidelizacao();
    return contato[campo] || contato.vendedor_responsavel || null;
  };

  const atendenteAtual = getAtendenteAtual();

  // Handler para atribuir atendente
  // IMPORTANTE: Se thread for passada, atualiza APENAS a conversa (não fideliza contato)
  // Se thread NÃO for passada, atualiza o contato (fidelização)
  const handleAtribuir = async (nomeAtendente, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (salvando || disabled) return;
    setSalvando(true);

    try {
      const atendente = nomeAtendente ? atendentes.find(a => a.full_name === nomeAtendente) : null;

      // ═══════════════════════════════════════════════════════════════════════
      // CASO 1: ATRIBUIÇÃO DE CONVERSA (thread passada)
      // Atualiza APENAS a MessageThread, NÃO mexe no contato
      // ═══════════════════════════════════════════════════════════════════════
      if (thread?.id) {
        await base44.entities.MessageThread.update(thread.id, {
          assigned_user_id: atendente ? atendente.id : null,
          assigned_user_name: atendente ? atendente.full_name : null
        });
        toast.success(`✅ Conversa ${nomeAtendente ? `atribuída a ${nomeAtendente}` : 'liberada'}`);
      }
      // ═══════════════════════════════════════════════════════════════════════
      // CASO 2: FIDELIZAÇÃO DE CONTATO (sem thread, apenas contato)
      // Atualiza o Contact com campos de fidelização
      // ═══════════════════════════════════════════════════════════════════════
      else if (contato?.id) {
        const campo = getCampoFidelizacao();
        const atualizacoes = {
          [campo]: nomeAtendente || null
        };

        if (['lead', 'cliente', 'novo'].includes(tipoContato)) {
          atualizacoes.vendedor_responsavel = nomeAtendente || null;
        }

        if (nomeAtendente && campo !== 'vendedor_responsavel') {
          atualizacoes.is_cliente_fidelizado = true;
        } else if (!nomeAtendente) {
          atualizacoes.is_cliente_fidelizado = false;
        }

        await base44.entities.Contact.update(contato.id, atualizacoes);
        toast.success(`✅ Contato ${nomeAtendente ? `fidelizado a ${nomeAtendente}` : 'desfidelizado'}`);
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

  // Combinar atendentes e vendedores sem duplicatas
  const pessoasDisponiveis = React.useMemo(() => {
    const mapa = new Map();
    
    atendentes.forEach(a => {
      mapa.set(a.full_name, { nome: a.full_name, tipo: 'atendente', id: a.id });
    });
    
    vendedores.forEach(v => {
      if (!mapa.has(v.nome)) {
        mapa.set(v.nome, { nome: v.nome, tipo: 'vendedor', id: v.id });
      }
    });
    
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [atendentes, vendedores]);

  // ═══════════════════════════════════════════════════════════════════════════
  // VARIANT: MINI - Apenas ícone pequeno
  // ═══════════════════════════════════════════════════════════════════════════
  if (variant === 'mini') {
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
            title={atendenteAtual ? `Atribuído: ${atendenteAtual}` : 'Clique para atribuir'}
          >
            {salvando ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : atendenteAtual ? (
              <>
                <UserCheck className="w-2.5 h-2.5" />
                <span className="truncate max-w-[50px]">{atendenteAtual.split(' ')[0]}</span>
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
              Nenhum atendente disponível
            </div>
          ) : (
            pessoasDisponiveis.map(pessoa => (
              <DropdownMenuItem
                key={pessoa.nome}
                onClick={(e) => handleAtribuir(pessoa.nome, e)}
                className="cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mr-2">
                  <span className="text-white text-xs font-bold">{pessoa.nome?.charAt(0)}</span>
                </div>
                <span className="flex-1">{pessoa.nome}</span>
                {pessoa.tipo === 'vendedor' && (
                  <Badge variant="outline" className="text-[9px] ml-1">Vendedor</Badge>
                )}
                {atendenteAtual === pessoa.nome && (
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
            {atendenteAtual || 'Não atribuído'}
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
              key={pessoa.nome}
              onClick={(e) => handleAtribuir(pessoa.nome, e)}
              className="cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center mr-2">
                <span className="text-white text-xs font-bold">{pessoa.nome?.charAt(0)}</span>
              </div>
              {pessoa.nome}
              {atendenteAtual === pessoa.nome && <Star className="w-3 h-3 text-amber-500 ml-auto" />}
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
            {showLabel && (atendenteAtual || 'Atribuir')}
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
              key={pessoa.nome}
              onClick={(e) => handleAtribuir(pessoa.nome, e)}
              className="cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mr-2">
                <span className="text-white text-sm font-bold">{pessoa.nome?.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">{pessoa.nome}</p>
                <p className="text-xs text-slate-500 capitalize">{pessoa.tipo}</p>
              </div>
              {atendenteAtual === pessoa.nome && (
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
          {atendenteAtual || 'Não atribuído'}
        </Badge>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56" onClick={handleClick}>
        <DropdownMenuLabel>Atribuir Responsável</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {pessoasDisponiveis.map(pessoa => (
          <DropdownMenuItem
            key={pessoa.nome}
            onClick={(e) => handleAtribuir(pessoa.nome, e)}
            className="cursor-pointer"
          >
            {pessoa.nome}
            {atendenteAtual === pessoa.nome && <Star className="w-3 h-3 text-amber-500 ml-auto" />}
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