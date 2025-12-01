import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCheck, Check, Forward, Trash2, Loader2, Copy,
  Zap, CheckCircle2, AlertCircle, ChevronRight, Clock, Search, ArrowRight,
  Reply, Target, Play, FileIcon, Download, ImageIcon, User, Tag, Mic } from
'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter } from
"@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger } from
"@/components/ui/tooltip";

import ReactMarkdown from 'react-markdown';
import { CATEGORIAS_FIXAS, getCategoriaConfig } from './CategorizadorRapido';
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Componente de imagem com fallback seguro (sem manipulação de innerHTML)
const ImageWithFallback = ({ src, alt, className, onClick }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div className="flex items-center justify-center bg-slate-100 rounded-2xl p-8 min-h-[200px]">
        <div className="text-center">
          <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Imagem expirada ou indisponível</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onClick={onClick}
      onError={() => {
        console.warn('[MSG] Erro ao carregar imagem:', src);
        setHasError(true);
      }}
    />
  );
};
import { base44 } from "@/api/base44Client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";

const FunctionDisplay = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);
  const name = toolCall?.name || 'Function';
  const status = toolCall?.status || 'pending';
  const results = toolCall?.results;

  const parsedResults = (() => {
    if (!results) return null;
    try {
      return typeof results === 'string' ? JSON.parse(results) : results;
    } catch {
      return results;
    }
  })();

  const isError = results && (
  typeof results === 'string' && /error|failed/i.test(results) ||
  parsedResults?.success === false);


  const statusConfig = {
    pending: { icon: Clock, color: 'text-slate-400', text: 'Pending' },
    running: { icon: Loader2, color: 'text-slate-500', text: 'Running...', spin: true },
    in_progress: { icon: Loader2, color: 'text-slate-500', text: 'Running...', spin: true },
    completed: isError ?
    { icon: AlertCircle, color: 'text-red-500', text: 'Failed' } :
    { icon: CheckCircle2, color: 'text-green-600', text: 'Success' },
    success: { icon: CheckCircle2, color: 'text-green-600', text: 'Success' },
    failed: { icon: AlertCircle, color: 'text-red-500', text: 'Failed' },
    error: { icon: AlertCircle, color: 'text-red-500', text: 'Failed' }
  }[status] || { icon: Zap, color: 'text-slate-500', text: '' };

  const Icon = statusConfig.icon;
  const formattedName = name.split('.').reverse().join(' ').toLowerCase();

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
          "hover:bg-slate-50",
          expanded ? "bg-slate-50 border-slate-300" : "bg-white border-slate-200"
        )}>

        <Icon className={cn("h-3 w-3", statusConfig.color, statusConfig.spin && "animate-spin")} />
        <span className="text-slate-700">{formattedName}</span>
        {statusConfig.text &&
        <span className={cn("text-slate-500", isError && "text-red-600")}>
            • {statusConfig.text}
          </span>
        }
        {!statusConfig.spin && (toolCall.arguments_string || results) &&
        <ChevronRight className={cn("h-3 w-3 text-slate-400 transition-transform ml-auto",
        expanded && "rotate-90")} />
        }
      </button>
      
      {expanded && !statusConfig.spin &&
      <div className="mt-1.5 ml-3 pl-3 border-l-2 border-slate-200 space-y-2">
          {toolCall.arguments_string &&
        <div>
              <div className="text-xs text-slate-500 mb-1">Parameters:</div>
              <pre className="bg-slate-50 rounded-md p-2 text-xs text-slate-600 whitespace-pre-wrap">
                {(() => {
              try {
                return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2);
              } catch {
                return toolCall.arguments_string;
              }
            })()}
              </pre>
            </div>
        }
          {parsedResults &&
        <div>
              <div className="text-xs text-slate-500 mb-1">Result:</div>
              <pre className="bg-slate-50 rounded-md p-2 text-xs text-slate-600 whitespace-pre-wrap max-h-48 overflow-auto">
                {typeof parsedResults === 'object' ?
            JSON.stringify(parsedResults, null, 2) : parsedResults}
              </pre>
            </div>
        }
        </div>
      }
    </div>);

};

export default function MessageBubble({
  message,
  isOwn,
  thread = null,
  onResponder,
  modoSelecao,
  selecionada,
  onToggleSelecao,
  mensagens,
  integracoes = [],
  usuarioAtual = null,
  contato = null
}) {
  // ⚠️ SEGURANÇA: Não renderizar se mensagem for inválida
  if (!message || typeof message !== 'object') {
    console.warn('[MessageBubble] Mensagem inválida recebida:', message);
    return null;
  }

  const [mostrarDialogEncaminhar, setMostrarDialogEncaminhar] = useState(false);
  const [encaminhando, setEncaminhando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [categorizando, setCategorizando] = useState(false);

  const [contatos, setContatos] = useState([]);
  const [contatosSelecionados, setContatosSelecionados] = useState([]);
  const [buscaContato, setBuscaContato] = useState("");
  const [carregandoContatos, setCarregandoContatos] = useState(false);

  const queryClient = useQueryClient();

  // Buscar categorias dinâmicas
  const { data: categoriasDB = [] } = useQuery({
    queryKey: ['categorias-mensagens'],
    queryFn: () => base44.entities.CategoriasMensagens.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  const todasCategorias = [...CATEGORIAS_FIXAS, ...categoriasDB];

  const isSystemMessage = message?.sender_type === 'system';

  useEffect(() => {
    if (mostrarDialogEncaminhar && contatos.length === 0) {
      carregarContatos();
    }
  }, [mostrarDialogEncaminhar]);

  const formatarHorario = (timestamp) => {
    if (!timestamp) return '';
    try {
      const data = new Date(timestamp);
      const hoje = new Date();
      const ontem = new Date(hoje);
      ontem.setDate(ontem.getDate() - 1);

      if (data.toDateString() === hoje.toDateString()) {
        return format(data, 'HH:mm', { locale: ptBR });
      }

      if (data.toDateString() === ontem.toDateString()) {
        return `Ontem ${format(data, 'HH:mm', { locale: ptBR })}`;
      }

      if (data.getFullYear() === hoje.getFullYear()) {
        return format(data, 'dd/MM HH:mm', { locale: ptBR });
      }

      return format(data, 'dd/MM/yyyy HH:mm', { locale: ptBR });
    } catch {
      return '';
    }
  };

  const carregarContatos = async () => {
    setCarregandoContatos(true);
    try {
      const threadsRecentes = await base44.entities.MessageThread.list('-last_message_at', 50);
      const contatosIds = [...new Set(threadsRecentes.map((t) => t.contact_id))];
      const contatosCarregados = await Promise.all(
        contatosIds.map((id) => base44.entities.Contact.get(id).catch(() => null))
      );

      const contatosValidos = contatosCarregados.
      filter((c) => c && !c.bloqueado && c.telefone).
      sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

      setContatos(contatosValidos);
    } catch (error) {
      console.error('[BUBBLE] Erro ao carregar contatos:', error);
      toast.error("Erro ao carregar contatos");
    } finally {
      setCarregandoContatos(false);
    }
  };

  const toggleContatoSelecionado = (contato) => {
    setContatosSelecionados((prev) => {
      const jaEsta = prev.find((c) => c.id === contato.id);
      if (jaEsta) {
        return prev.filter((c) => c.id !== contato.id);
      } else {
        return [...prev, contato];
      }
    });
  };

  const handleEncaminhar = async () => {
    if (contatosSelecionados.length === 0) {
      toast.error("Selecione pelo menos um contato");
      return;
    }

    const integrationId = thread?.whatsapp_integration_id;
    if (!integrationId) {
      toast.error("❌ Não foi possível determinar a integração do WhatsApp");
      return;
    }

    setEncaminhando(true);
    try {
      let sucessos = 0;
      let erros = 0;

      for (const contato of contatosSelecionados) {
        try {
          const resultado = await base44.functions.invoke('encaminharMensagem', {
            message_id: message.id,
            target_phone: contato.telefone,
            integration_id: integrationId
          });

          if (resultado.data.success) {
            sucessos++;
          } else {
            erros++;
          }
        } catch (error) {
          console.error(`[BUBBLE] Erro ao encaminhar para ${contato.nome}:`, error);
          erros++;
        }
      }

      if (sucessos > 0) {
        toast.success(`✅ Mensagem encaminhada para ${sucessos} contato(s)!`);
      }

      if (erros > 0) {
        toast.error(`❌ ${erros} encaminhamento(s) falharam`);
      }

      setMostrarDialogEncaminhar(false);
      setContatosSelecionados([]);
      setBuscaContato("");
    } catch (error) {
      console.error('[BUBBLE] Erro ao encaminhar:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setEncaminhando(false);
    }
  };

  const handleApagar = async () => {
    if (!confirm("Tem certeza que deseja apagar esta mensagem?")) return;

    setApagando(true);
    try {
      const resultado = await base44.functions.invoke('apagarMensagem', {
        message_id: message.id,
        delete_for_everyone: true
      });

      if (resultado.data.success) {
        toast.success("✅ Mensagem apagada!");
      } else {
        throw new Error(resultado.data.error || "Erro ao apagar");
      }
    } catch (error) {
      console.error('[BUBBLE] Erro ao apagar:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setApagando(false);
    }
  };

  const mensagemOriginal = message?.reply_to_message_id ?
  mensagens?.find((m) => m.id === message.reply_to_message_id) :
  null;

  // Funcao auxiliar para normalizar tags (objeto -> string ID)
  const normalizarCategorias = (categorias) => {
    if (!Array.isArray(categorias)) return [];
    return categorias.map((cat) => {
      if (typeof cat === 'string') return cat;
      if (typeof cat === 'object' && cat !== null) {
        return cat.id || cat.nome || cat._id || String(cat);
      }
      return String(cat);
    }).filter(Boolean);
  };

  const handleToggleCategoria = async (valorCategoria) => {
    if (categorizando || !message) {
      console.log('[ETIQUETA] Ignorando - categorizando:', categorizando, 'message:', !!message);
      return;
    }

    setCategorizando(true);
    try {
      // Normalizar categorias existentes para garantir que sao strings
      const categoriasAtuais = normalizarCategorias(message?.categorias);
      const novasCategorias = categoriasAtuais.includes(valorCategoria) ?
      categoriasAtuais.filter((c) => c !== valorCategoria) :
      [...categoriasAtuais, valorCategoria];

      console.log('[ETIQUETA] 🏷️ SALVANDO etiqueta na MENSAGEM:', {
        message_id: message?.id,
        message_content_preview: String(message?.content || '').substring(0, 50),
        categorias_antes: categoriasAtuais,
        categorias_depois: novasCategorias,
        categoria_alterada: valorCategoria,
        thread_id: thread?.id || null
      });

      const resultado = await base44.entities.Message.update(message?.id, {
        categorias: novasCategorias
      });

      console.log('[ETIQUETA] ✅ SUCESSO - Resposta do banco:', resultado);

      // Forçar reload imediato (apenas se thread existir)
      const threadId = thread?.id;
      if (threadId) {
        await queryClient.invalidateQueries({ queryKey: ['mensagens', threadId] });
      }

      // Verificar se salvou
      setTimeout(async () => {
        try {
          const msgAtualizada = await base44.entities.Message.get(message?.id);
          console.log('[ETIQUETA] 🔍 VERIFICAÇÃO - Categorias salvas no banco:', msgAtualizada?.categorias);
        } catch (e) {
          console.error('[ETIQUETA] ❌ Erro ao verificar:', e);
        }
      }, 500);

      const catConfig = todasCategorias.find((c) => c.nome === valorCategoria);
      toast.success(`${catConfig?.emoji || '🏷️'} ${catConfig?.label || valorCategoria} ${novasCategorias.includes(valorCategoria) ? 'adicionada' : 'removida'}`);
    } catch (error) {
      console.error('[BUBBLE] ❌ ERRO GRAVE ao categorizar:', error);
      toast.error(`Erro ao atualizar categoria: ${error.message}`);
    } finally {
      setCategorizando(false);
    }
  };

  const adicionarNovaCategoria = async (nomeCategoria) => {
    if (categorizando || !message) return;

    setCategorizando(true);
    try {
      const categoriaNormalizada = nomeCategoria.toLowerCase().replace(/\s+/g, '_');

      // Verificar se categoria já existe no banco
      const existente = categoriasDB.find((c) => c.nome === categoriaNormalizada);

      if (!existente) {
        // Criar nova categoria no banco
        await base44.entities.CategoriasMensagens.create({
          nome: categoriaNormalizada,
          label: nomeCategoria,
          emoji: '🏷️',
          cor: 'bg-slate-400',
          tipo: 'personalizada',
          ativa: true,
          uso_count: 1
        });

        queryClient.invalidateQueries({ queryKey: ['categorias-mensagens'] });
      }

      // Adicionar a mensagem (normalizar antes)
      const categoriasAtuais = normalizarCategorias(message?.categorias);
      if (!categoriasAtuais.includes(categoriaNormalizada)) {
        await base44.entities.Message.update(message?.id, {
          categorias: [...categoriasAtuais, categoriaNormalizada]
        });
        const threadId = thread?.id;
        if (threadId) {
          queryClient.invalidateQueries({ queryKey: ['mensagens', threadId] });
        }
        toast.success(`✅ Categoria "${nomeCategoria}" criada e adicionada!`);
      } else {
        toast.warning('Categoria já existe nesta mensagem');
      }
    } catch (error) {
      console.error('[BUBBLE] Erro ao adicionar categoria:', error);
      toast.error('Erro ao criar categoria');
    } finally {
      setCategorizando(false);
    }
  };

  if (message?.metadata?.deleted) {
    return (
      <div className={cn("flex gap-3", isOwn ? "justify-end" : "justify-start")}>
        <div className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 bg-slate-100 text-slate-400 italic",
          isOwn && "bg-slate-200"
        )}>
          <p className="text-sm">🗑️ Mensagem apagada</p>
        </div>
      </div>);

  }

  return (
    <>
      <div className={cn("flex gap-3", isOwn ? "justify-end" : "justify-start")}
          onClick={() => modoSelecao && onToggleSelecao?.()}>

        {modoSelecao &&
        <div className="flex items-center justify-center">
            <div className={cn(
            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
            selecionada ? "bg-blue-500 border-blue-500" : "border-slate-300"
          )}>
              {selecionada && <Check className="w-4 h-4 text-white" />}
            </div>
          </div>
        }

        {!isOwn && !modoSelecao &&
        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center mt-0.5 flex-shrink-0 overflow-hidden">
            {contato?.foto_perfil_url ? (
              <img 
                src={contato.foto_perfil_url} 
                alt={contato?.nome || 'Contato'} 
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <span className="text-xs font-bold text-slate-500">
                {(contato?.nome || 'C').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        }

        <div className={cn(
          "max-w-[70%]",
          isOwn ? 'items-end' : 'items-start',
          "flex flex-col group relative"
        )}>
          {/* Nome do Remetente + Setor */}
          <span className={cn(
            "text-[10px] font-semibold mb-0.5 px-1 flex items-center gap-1",
            isOwn ? "text-slate-500 justify-end" : "text-slate-600 justify-start"
          )}>
            {isOwn 
              ? (usuarioAtual?.full_name || 'Você')
              : (contato?.nome || contato?.telefone || 'Cliente')}
            {isOwn && usuarioAtual?.attendant_sector && usuarioAtual.attendant_sector !== 'geral' && (
              <span className="px-1.5 py-0.5 text-[8px] bg-blue-500 text-white rounded-full font-bold uppercase">
                {usuarioAtual.attendant_sector}
              </span>
            )}
          </span>

          {mensagemOriginal &&
          <div className={cn(
            "mb-1 px-3 py-2 rounded-lg border-l-4 text-xs bg-slate-100",
            isOwn ? "border-blue-500" : "border-green-500"
          )}>
              <p className="font-semibold text-slate-600 mb-0.5">
                {mensagemOriginal?.sender_type === 'user' ? 'Você' : 'Cliente'}
              </p>
              <p className="text-slate-500 line-clamp-2">
                {String(mensagemOriginal?.content || "[Mídia/Conteúdo sem texto]")}
              </p>
            </div>
          }

          <div className={cn(
            "rounded-2xl relative shadow-sm",
            isOwn ? (() => {
              // Buscar cor da integração
              const integracaoId = message?.metadata?.whatsapp_integration_id || thread?.whatsapp_integration_id;
              const integracao = integracoes?.find(i => i.id === integracaoId);
              const cor = integracao?.cor_chat || 'blue';
              const coresMap = {
                blue: "bg-gradient-to-r from-blue-500 to-blue-600",
                green: "bg-gradient-to-r from-green-500 to-green-600",
                purple: "bg-gradient-to-r from-purple-500 to-purple-600",
                orange: "bg-gradient-to-r from-orange-500 to-orange-600",
                pink: "bg-gradient-to-r from-pink-500 to-pink-600",
                teal: "bg-gradient-to-r from-teal-500 to-teal-600",
                indigo: "bg-gradient-to-r from-indigo-500 to-indigo-600",
                rose: "bg-gradient-to-r from-rose-500 to-rose-600"
              };
              return coresMap[cor] || coresMap.blue;
            })() :
            "bg-white border border-slate-200",
            selecionada ? 'ring-2 ring-blue-500' : '',
            message.media_url && message.media_type !== 'none' ? '' : 'px-4 py-2'
          )}>
            {/* ✅ ÍCONES FLUTUANTES - APARECEM AO PASSAR O MOUSE */}
            {!modoSelecao && !isSystemMessage &&
            <TooltipProvider>
                <div className="absolute -top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                  {onResponder &&
                <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onResponder(message)}
                      className={cn(
                        "h-7 w-7 rounded-full shadow-lg backdrop-blur-sm",
                        "bg-white/90 hover:bg-white border border-slate-200"
                      )}>

                          <Reply className="w-3.5 h-3.5 text-slate-700" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Responder</TooltipContent>
                    </Tooltip>
                }

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setMostrarDialogEncaminhar(true);
                        setContatosSelecionados([]);
                        setBuscaContato("");
                      }}
                      disabled={encaminhando}
                      className={cn(
                        "h-7 w-7 rounded-full shadow-lg backdrop-blur-sm",
                        "bg-white/90 hover:bg-white border border-slate-200"
                      )}>

                        <Forward className="w-3.5 h-3.5 text-slate-700" />
                      </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Encaminhar</TooltipContent>
                      </Tooltip>

                      {isOwn &&
                <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleApagar}
                      disabled={apagando}
                      className={cn(
                        "h-7 w-7 rounded-full shadow-lg backdrop-blur-sm",
                        "bg-white/90 hover:bg-red-50 border border-slate-200"
                      )}>

                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Apagar</TooltipContent>
                      </Tooltip>
                }

                      <Tooltip>
                      <TooltipTrigger asChild>
                      <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (window.handleCriarOportunidadeDeChat && message) {
                          window.handleCriarOportunidadeDeChat(message, thread || {});
                        }
                      }}
                      className={cn(
                        "h-7 w-7 rounded-full shadow-lg backdrop-blur-sm",
                        "bg-white/90 hover:bg-green-50 border border-slate-200"
                      )}>

                        <Target className="w-3.5 h-3.5 text-green-600" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Criar Oportunidade de Negócio</TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                          variant="ghost"
                          size="icon"
                          disabled={categorizando}
                          className={cn(
                            "h-7 w-7 rounded-full shadow-lg backdrop-blur-sm",
                            "bg-white/90 hover:bg-purple-50 border border-slate-200"
                          )}>

                            <Tag className="w-3.5 h-3.5 text-purple-600" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top">Etiquetar Mensagem</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel className="flex items-center justify-between">
                        <span>Etiquetar mensagem</span>
                        <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const novaCategoria = prompt("Digite o nome da nova etiqueta:");
                          if (novaCategoria && novaCategoria.trim()) {
                            adicionarNovaCategoria(novaCategoria.trim());
                          }
                        }}
                        className="h-6 w-6 p-0 hover:bg-blue-50">

                          <span className="text-blue-600 font-bold text-lg">+</span>
                        </Button>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {todasCategorias.map((cat) =>
                    <DropdownMenuCheckboxItem
                      key={cat.nome}
                      checked={(message?.categorias || []).includes(cat.nome)}
                      onCheckedChange={() => handleToggleCategoria(cat.nome)}>

                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${cat.cor || 'bg-slate-400'}`} />
                            <span>{cat.emoji || '🏷️'} {cat.label}</span>
                          </div>
                        </DropdownMenuCheckboxItem>
                    )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TooltipProvider>
            }

            {/* ✅ IMAGEM - ESTILO WHATSAPP */}
            {message.media_type === 'image' && message.media_url &&
            <div className="relative overflow-hidden rounded-2xl">
                {message.media_url ?
              <ImageWithFallback
                src={message.media_url}
                alt="Imagem"
                className="max-w-full max-h-96 object-cover rounded-2xl cursor-pointer"
                onClick={() => window.open(message.media_url, '_blank')}
              /> :


              <div className="flex items-center justify-center bg-slate-100 rounded-2xl p-8 min-h-[200px]">
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Imagem não disponível</p>
                    </div>
                  </div>
              }
                {message.media_caption &&
              <div className={cn(
                "px-4 py-2",
                isOwn ? "text-white" : "text-slate-800"
              )}>
                    <p className="text-sm leading-relaxed">{message.media_caption}</p>
                  </div>
              }
                <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md">
                  <div className="flex items-center gap-1 flex-wrap">
                    {message?.categorias && message.categorias.length > 0 &&
                  <div className="flex gap-1 mr-1 flex-wrap">
                        {message.categorias.slice(0, 3).map((cat) => {
                      const config = getCategoriaConfig(cat, categoriasDB);
                      return (
                        <span key={cat} className="text-[9px] px-1.5 py-0.5 bg-white/20 rounded flex items-center gap-1">
                              {config.emoji} {config.label}
                            </span>);

                    })}
                      </div>
                  }
                    <span className="text-[10px] text-white">
                      {formatarHorario(message.sent_at || message.created_date)}
                    </span>
                    {isOwn && message.status === 'lida' &&
                  <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                  }
                    {isOwn && message.status === 'entregue' &&
                  <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                  }
                    {isOwn && message.status === 'enviada' &&
                  <Check className="w-3.5 h-3.5 text-white/70" />
                  }
                  </div>
                </div>
              </div>
            }

            {/* ✅ ÁUDIO - ESTILO WHATSAPP */}
            {message?.media_type === 'audio' && message?.media_url &&
            <div className={cn(
              "px-3 py-2 min-w-[200px]",
              isOwn ? "text-white" : "text-slate-800"
            )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                  isOwn ? "bg-white/20" : "bg-green-500"
                )}>
                    <Play className={cn("w-5 h-5", isOwn ? "text-white" : "text-white")} />
                  </div>
                  {message?.media_url?.includes('mmg.whatsapp.net') ? (
                    <div className={cn(
                      "flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs",
                      isOwn ? "bg-white/10 text-white/80" : "bg-slate-100 text-slate-600"
                    )}>
                      <Mic className="w-4 h-4 flex-shrink-0" />
                      <span>Áudio recebido (arquivo temporário do WhatsApp)</span>
                    </div>
                  ) : (
                    <audio
                      src={message?.media_url}
                      controls
                      className="flex-1 h-8"
                      style={{
                        filter: isOwn ? 'invert(1) hue-rotate(180deg)' : 'none'
                      }}
                      onError={(e) => {
                        console.warn('[AUDIO] Erro ao carregar:', message?.media_url);
                      }}
                    />
                  )}

                </div>
                <div className="flex items-center justify-end gap-1 mt-1 flex-wrap">
                  {message?.categorias && message.categorias.length > 0 &&
                <div className="flex gap-1 mr-1 flex-wrap">
                      {message.categorias.slice(0, 3).map((cat) => {
                    const config = getCategoriaConfig(cat, categoriasDB);
                    return (
                      <span
                        key={cat}
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1",
                          isOwn ? "bg-white/20 text-white" : `${config.color} text-white`
                        )}>

                            {config.emoji} {config.label}
                          </span>);

                  })}
                    </div>
                }
                  <span className={cn("text-[10px]", isOwn ? "text-white/70" : "text-slate-500")}>
                    {formatarHorario(message.sent_at || message.created_date)}
                  </span>
                  {isOwn && message.status === 'lida' &&
                <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                }
                  {isOwn && message.status === 'entregue' &&
                <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                }
                  {isOwn && message.status === 'enviada' &&
                <Check className="w-3.5 h-3.5 text-white/70" />
                }
                </div>
              </div>
            }

            {/* ✅ VÍDEO - ESTILO WHATSAPP */}
            {message?.media_type === 'video' && message?.media_url &&
            <div className="relative overflow-hidden rounded-2xl">
                <video
                src={message?.media_url}
                controls
                className="max-w-full max-h-96 rounded-2xl"
                preload="metadata" />

                {message.media_caption &&
              <div className={cn(
                "px-4 py-2",
                isOwn ? "text-white" : "text-slate-800"
              )}>
                    <p className="text-sm leading-relaxed">{message.media_caption}</p>
                  </div>
              }
                <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white">
                      {formatarHorario(message?.sent_at || message?.created_date)}
                    </span>
                    {isOwn && message?.status === 'lida' &&
                  <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                  }
                    {isOwn && message?.status === 'entregue' &&
                  <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                  }
                    {isOwn && message?.status === 'enviada' &&
                  <Check className="w-3.5 h-3.5 text-white/70" />
                  }
                  </div>
                </div>
              </div>
            }

            {/* ✅ CONTATO COMPARTILHADO - VCARD */}
            {message?.media_type === 'contact' &&
            <div className={cn(
              "px-4 py-3 min-w-[250px]",
              isOwn ? "text-white" : "text-slate-800"
            )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                  isOwn ? "bg-white/20" : "bg-blue-50"
                )}>
                    <User className={cn("w-6 h-6", isOwn ? "text-white" : "text-blue-600")} />
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-sm font-medium", isOwn ? "text-white" : "text-slate-900")}>
                      {String(message?.content || 'Contato').replace('📇 Contato compartilhado: ', '')}
                    </p>
                    <p className={cn("text-xs", isOwn ? "text-white/70" : "text-slate-500")}>
                      Contato compartilhado
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-2 flex-wrap">
                  {message?.categorias && message.categorias.length > 0 &&
                <div className="flex gap-1 mr-1 flex-wrap">
                      {message.categorias.slice(0, 3).map((cat) => {
                    const config = getCategoriaConfig(cat, categoriasDB);
                    return (
                      <span
                        key={cat}
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1",
                          isOwn ? "bg-white/20 text-white" : `${config.color} text-white`
                        )}>

                            {config.emoji} {config.label}
                          </span>);

                  })}
                    </div>
                }
                  <span className={cn("text-[10px]", isOwn ? "text-white/70" : "text-slate-500")}>
                    {formatarHorario(message.sent_at || message.created_date)}
                  </span>
                  {isOwn && message.status === 'lida' &&
                <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                }
                  {isOwn && message.status === 'entregue' &&
                <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                }
                  {isOwn && message.status === 'enviada' &&
                <Check className="w-3.5 h-3.5 text-white/70" />
                }
                </div>
              </div>
            }

            {/* ✅ DOCUMENTO - ESTILO WHATSAPP */}
            {message?.media_type === 'document' && message?.media_url &&
            <div className={cn(
              "px-4 py-3 min-w-[250px]",
              isOwn ? "text-white" : "text-slate-800"
            )}>
                {message?.media_url?.includes('mmg.whatsapp.net') ? (
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                      isOwn ? "bg-white/20" : "bg-orange-50"
                    )}>
                      <FileIcon className={cn("w-6 h-6", isOwn ? "text-white" : "text-orange-600")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", isOwn ? "text-white" : "text-slate-900")}>
                        {String(message?.content || 'Documento').replace('[Documento: ', '').replace(']', '')}
                      </p>
                      <p className={cn("text-xs", isOwn ? "text-white/70" : "text-orange-600")}>
                        ⚠️ Arquivo temporário (instância LITE)
                      </p>
                    </div>
                  </div>
                ) : (
                <a
                href={message?.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:opacity-80 transition-opacity">

                  <div className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                  isOwn ? "bg-white/20" : "bg-blue-50"
                )}>
                    <FileIcon className={cn("w-6 h-6", isOwn ? "text-white" : "text-blue-600")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", isOwn ? "text-white" : "text-slate-900")}>
                      {String(message?.content || 'Documento').replace('[Documento: ', '').replace(']', '')}
                    </p>
                    <p className={cn("text-xs", isOwn ? "text-white/70" : "text-slate-500")}>
                      Clique para baixar
                    </p>
                  </div>
                  <Download className={cn("w-5 h-5 flex-shrink-0", isOwn ? "text-white/70" : "text-slate-400")} />
                </a>
                )}
                <div className="flex items-center justify-end gap-1 mt-2">
                  <span className={cn("text-[10px]", isOwn ? "text-white/70" : "text-slate-500")}>
                    {formatarHorario(message?.sent_at || message?.created_date)}
                  </span>
                  {isOwn && message?.status === 'lida' &&
                <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                }
                  {isOwn && message?.status === 'entregue' &&
                <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                }
                  {isOwn && message?.status === 'enviada' &&
                <Check className="w-3.5 h-3.5 text-white/70" />
                }
                </div>
              </div>
            }

            {/* 📱 CANAL WHATSAPP - Badge mostrando de qual conexão veio */}
            {!isOwn && thread && (() => {
              // Tentar várias formas de obter info do canal
              const canalNumero = message?.metadata?.canal_numero || message?.metadata?.connected_phone;
              const canalNome = message?.metadata?.canal_nome;
              const integracaoId = message?.metadata?.whatsapp_integration_id || thread?.whatsapp_integration_id;

              // Se temos o número diretamente
              if (canalNumero) {
                return (
                  <div className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full mb-1 inline-flex items-center gap-1",
                    "bg-green-50 text-green-600 border border-green-200"
                  )}>
                    📱 Via: {canalNome || canalNumero}
                  </div>);

              }

              // Fallback: buscar na lista de integrações
              if (integracaoId && integracoes.length > 0) {
                const integracao = integracoes.find((i) => i.id === integracaoId);
                if (integracao) {
                  return (
                    <div className={cn(
                      "text-[9px] px-2 py-0.5 rounded-full mb-1 inline-flex items-center gap-1",
                      "bg-green-50 text-green-600 border border-green-200"
                    )}>
                      📱 Via: {integracao.numero_telefone || integracao.nome_instancia}
                    </div>);

                }
              }

              return null;
            })()}

            {/* ✅ TEXTO - SEM MÍDIA */}
            {(!message?.media_url || message?.media_type === 'none') && message?.content && String(message.content).trim() !== '' && message.content !== '[No content]' &&
            <>
                <div className={cn(
                "break-words whitespace-pre-wrap",
                isOwn ? "text-white" : "text-slate-800"
              )}>
                  {isOwn ?
                <p className="text-sm leading-relaxed">{String(message.content || '')}</p> :

                <ReactMarkdown
                  className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  components={{
                    code: ({ inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ?
                      <div className="relative group/code">
                             <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto my-2">
                               <code className={className} {...props}>{children}</code>
                             </pre>
                             <Button
                          size="icon"
                          variant="ghost"
                          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover/code:opacity-100 bg-slate-800 hover:bg-slate-700"
                          onClick={() => {
                            navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                            toast.success('Code copied');
                          }}>

                               <Copy className="h-3 w-3 text-slate-400" />
                             </Button>
                           </div> :

                      <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                             {children}
                           </code>;

                    },
                    a: ({ children, ...props }) =>
                    <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,

                    p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                    ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                    li: ({ children }) => <li className="my-0.5">{children}</li>,
                    h1: ({ children }) => <h1 className="text-lg font-semibold my-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-semibold my-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold my-2">{children}</h3>,
                    blockquote: ({ children }) =>
                    <blockquote className="border-l-2 border-slate-300 pl-3 my-2 text-slate-600">
                           {children}
                         </blockquote>

                  }}>

                     {String(message.content || '')}
                    </ReactMarkdown>
                }
                </div>

                <div className="flex items-center justify-end gap-1 mt-1 flex-wrap">
                  {message?.categorias && message.categorias.length > 0 &&
                <div className="flex gap-1 mr-1 flex-wrap">
                      {message.categorias.slice(0, 3).map((cat) => {
                    const config = getCategoriaConfig(cat, categoriasDB);
                    return (
                      <span
                        key={cat}
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1",
                          isOwn ? "bg-white/20 text-white" : `${config.color} text-white`
                        )}>

                            {config.emoji} {config.label}
                          </span>);

                  })}
                    </div>
                }
                  <span className={cn(
                  "text-[10px]",
                  isOwn ? "text-white/70" : "text-slate-500"
                )}>
                    {formatarHorario(message.sent_at || message.created_date)}
                  </span>

                  {isOwn &&
                <>
                      {message.status === 'enviando' &&
                  <Loader2 className="w-3 h-3 text-white/70 animate-spin" />
                  }

                      {message.status === 'enviada' &&
                  <Check className="w-3.5 h-3.5 text-white/70" />
                  }

                      {message.status === 'entregue' &&
                  <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                  }

                      {message.status === 'lida' &&
                  <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                  }

                      {message.status === 'falhou' &&
                  <AlertCircle className="w-3.5 h-3.5 text-red-300" />
                  }
                    </>
                }
                </div>
              </>
            }

            {message?.tool_calls?.length > 0 &&
            <div className="space-y-1 mt-2 px-4 py-2">
                {message.tool_calls.map((toolCall, idx) =>
              <FunctionDisplay key={idx} toolCall={toolCall} />
              )}
              </div>
            }
          </div>
        </div>
      </div>

      <Dialog open={mostrarDialogEncaminhar} onOpenChange={setMostrarDialogEncaminhar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Forward className="w-5 h-5 text-blue-600" />
              Encaminhar Mensagem
            </DialogTitle>
            <DialogDescription>
              Selecione os contatos que devem receber esta mensagem
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar contato..."
                value={buscaContato}
                onChange={(e) => setBuscaContato(e.target.value)}
                className="pl-10" />

            </div>

            {contatosSelecionados.length > 0 &&
            <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                {contatosSelecionados.map((contato) =>
              <Badge
                key={contato.id}
                variant="secondary"
                className="bg-blue-100 text-blue-800 gap-1">

                    {contato.nome || contato.telefone}
                    <button
                  onClick={() => toggleContatoSelecionado(contato)}
                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5">

                      ×
                    </button>
                  </Badge>
              )}
              </div>
            }

            <ScrollArea className="h-64 border rounded-lg">
              {carregandoContatos ?
              <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div> :
              contatos.filter((c) =>
              (c.nome || '').toLowerCase().includes(buscaContato.toLowerCase()) ||
              (c.telefone || '').includes(buscaContato)
              ).length === 0 && !carregandoContatos ?
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <p className="text-sm">Nenhum contato encontrado</p>
                </div> :

              <div className="p-2">
                  {contatos.
                filter((c) =>
                !buscaContato ||
                c.nome?.toLowerCase().includes(buscaContato.toLowerCase()) ||
                c.telefone?.includes(buscaContato)
                ).
                map((contato) => {
                  const selecionado = contatosSelecionados.find((c) => c.id === contato.id);

                  return (
                    <button
                      key={contato.id}
                      onClick={() => toggleContatoSelecionado(contato)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors",
                        selecionado && "bg-blue-50 hover:bg-blue-100"
                      )}>

                          <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0",
                        selecionado ? "bg-blue-600" : "bg-slate-400"
                      )}>
                            {selecionado ?
                        <Check className="w-5 h-5" /> :

                        (contato.nome || contato.telefone)?.charAt(0)?.toUpperCase() || '?'
                        }
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-slate-900">
                              {contato.nome || 'Sem nome'}
                            </p>
                            <p className="text-sm text-slate-500">{contato.telefone}</p>
                          </div>
                        </button>);

                })}
                </div>
              }
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMostrarDialogEncaminhar(false);
                setContatosSelecionados([]);
                setBuscaContato("");
              }}>

              Cancelar
            </Button>
            <Button
              onClick={handleEncaminhar}
              disabled={contatosSelecionados.length === 0 || encaminhando}
              className="bg-blue-600 hover:bg-blue-700">

              {encaminhando ?
              <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Encaminhando...
                </> :

              <>
                  Encaminhar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);

}