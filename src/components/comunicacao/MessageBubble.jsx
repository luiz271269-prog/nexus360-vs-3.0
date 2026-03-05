import React from "react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CheckCheck, Check, Forward, Trash2, Loader2, Copy,
  Zap, CheckCircle2, AlertCircle, ChevronRight, Clock, Search, ArrowRight,
  Reply, Target, Play, FileIcon, Download, ImageIcon, User, Tag, Mic, UserCheck,
  Building, Users } from
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
import { base44 } from "@/api/base44Client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import UsuarioDisplay from './UsuarioDisplay';
import { sanitizeEmojis } from '../lib/emojiSanitizer';
import EtiquetaFaseDialog from './EtiquetaFaseDialog';

// Player de áudio: nativo + botão de velocidade
const AudioPlayer = ({ src }) => {
  const audioRef = React.useRef(null);
  const [speed, setSpeed] = React.useState(1);
  const speeds = [1, 1.5, 2];

  const cycleSpeed = () => {
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <audio
        ref={audioRef}
        src={src}
        controls
        className="flex-1 h-8 min-w-0"
        onPlay={() => {if (audioRef.current) audioRef.current.playbackRate = speed;}} />

      <button
        onClick={cycleSpeed}
        className="flex-shrink-0 text-[10px] font-bold w-7 h-6 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors text-center"
        title="Velocidade">

        {speed}x
      </button>
    </div>);

};

// Componente de imagem com fallback seguro
const ImageWithFallback = ({ src, alt, className, onClick, isPersisted }) => {
  const [hasError, setHasError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  const isUrlPermanente = src && (
  src.includes('base44.app') ||
  src.includes('supabase.co') ||
  src.includes('storage.googleapis.com'));


  if (hasError || !src) {
    return (
      <div className="flex items-center justify-center bg-slate-100 rounded-2xl p-8 min-h-[200px]">
        <div className="text-center">
          <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {isPersisted === false && !isUrlPermanente ? "Link temporário expirado" : "Imagem indisponível"}
          </p>
          {src && <p className="text-[10px] text-slate-400 mt-1 break-all max-w-[200px]">{src.substring(0, 50)}...</p>}
        </div>
      </div>);

  }

  return (
    <div className="relative">
      {isLoading &&
      <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-2xl">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        onClick={onClick}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          console.warn('[MSG] Erro ao carregar imagem:', src);
          setIsLoading(false);
          setHasError(true);
        }} />

    </div>);

};

const FunctionDisplay = ({ toolCall }) => {
  const [expanded, setExpanded] = React.useState(false);
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

export default React.memo(function MessageBubble({
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
  contato = null,
  atendentes = []
}) {
  // ✅ NEXUS360: Validar permissões de ações
  const podeEncaminhar = usuarioAtual?.permissoes_acoes_nexus?.podeEncaminharMensagens ?? true;
  const podeCategorizar = usuarioAtual?.permissoes_acoes_nexus?.podeCategorizarMensagensIndividuais ?? true;

  if (!message || typeof message !== 'object') {
    console.warn('[MessageBubble] Mensagem inválida:', message);
    return null;
  }

  // ✅ NÃO RENDERIZAR mensagens de prompt da micro-URA
  if (message.metadata?.is_system_message === true && message.metadata?.message_type === 'micro_ura_prompt') {
    return null;
  }

  // ✅ RENDERIZAÇÃO DE LOCALIZAÇÃO (padrão WhatsApp)
  if (message.media_type === 'location' && message.metadata?.location) {
    const loc = message.metadata.location;

    // Guard: se não houver coordenadas válidas, fallback para texto
    if (!loc.lat || !loc.lng || !loc.url) {
      return (
        <div className={cn("flex gap-3", isOwn ? "justify-end" : "justify-start")}>
          {!isOwn && <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center mt-0.5">
            <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          </div>}
          <div className={cn("max-w-[65%] rounded-2xl px-4 py-2.5",
          isOwn ? "bg-[#d9fdd3]" : "bg-white border border-slate-200")}>
            <p className="text-sm text-slate-800">{message.content || '📍 Localização'}</p>
          </div>
        </div>);

    }

    return (
      <div className={cn("flex gap-3 group", isOwn ? "justify-end" : "justify-start")}>
        {!isOwn && <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center mt-0.5">
          <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        </div>}
        <div className={cn("max-w-[65%]", isOwn && "flex flex-col items-end")}>
          <div className={cn(
            "rounded-lg overflow-hidden shadow-sm min-w-[240px]",
            isOwn ? "bg-[#d9fdd3]" : "bg-white"
          )}
          style={{
            borderRadius: isOwn ? '8px 0 8px 8px' : '0 8px 8px 8px'
          }}>
            {/* Card estilo WhatsApp */}
            <div className="bg-slate-100 p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-900 truncate">
                  {loc.name || 'Localização'}
                </div>
                {loc.address &&
                <div className="text-xs text-slate-600 truncate">
                    {loc.address}
                  </div>
                }
              </div>
            </div>
            
            {/* Link para abrir */}
            <a
              href={loc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 hover:bg-slate-50 transition-colors border-t border-slate-200">

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Ver localização</span>
                </div>
              </div>
            </a>
            
            {/* Timestamp e status */}
            <div className="px-3 pb-2 flex items-center justify-end gap-1">
              <span className="text-[11px] text-slate-500">
                {formatarHorario(message.sent_at || message.created_date)}
              </span>
              {isOwn && message.status === 'enviando' && <Clock className="w-3 h-3 text-slate-500" />}
              {isOwn && message.status === 'enviada' && <Check className="w-3.5 h-3.5 text-slate-400" />}
              {isOwn && message.status === 'entregue' && <CheckCheck className="w-3.5 h-3.5 text-slate-400" />}
              {isOwn && message.status === 'lida' && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
            </div>
          </div>
        </div>
      </div>);

  }

  const [mostrarDialogEncaminhar, setMostrarDialogEncaminhar] = React.useState(false);
  const [encaminhando, setEncaminhando] = React.useState(false);
  const [apagando, setApagando] = React.useState(false);
  const [categorizando, setCategorizando] = React.useState(false);
  const [etiquetaFaseDialog, setEtiquetaFaseDialog] = React.useState(null); // { nome, label, emoji, kanban_fase_padrao }

  const [contatosSelecionados, setContatosSelecionados] = React.useState([]);
  const [buscaContato, setBuscaContato] = React.useState("");

  const queryClient = useQueryClient();

  const { data: categoriasDB = [] } = useQuery({
    queryKey: ['categorias-mensagens'],
    queryFn: () => base44.entities.CategoriasMensagens.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  const todasCategorias = [...CATEGORIAS_FIXAS, ...categoriasDB];

  // Detectar se é thread interna
  const isThreadInterna = thread?.thread_type === 'team_internal' ||
  thread?.thread_type === 'sector_group' ||
  message.channel === 'interno';

  const isTransferMessage =
  message?.metadata?.is_system_message === true && message?.metadata?.message_type === 'transfer' ||
  message?.metadata?.action_type === 'assignment' ||
  message?.channel === 'interno' && (
  message?.content?.includes('transferida') ||
  message?.content?.includes('atribuída') ||
  message?.content?.includes('Conversa'));




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

  // ✅ BUSCA SOB DEMANDA - Query reativa baseada no termo de busca
  const { data: contatos = [], isLoading: carregandoContatos } = useQuery({
    queryKey: ['contatos-encaminhar', buscaContato],
    queryFn: async () => {
      // ✅ Só buscar se termo tiver pelo menos 2 caracteres
      if (!buscaContato || buscaContato.trim().length < 2) return [];

      const normalizarTexto = (t) => {
        if (!t) return '';
        return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      };

      const termoBusca = normalizarTexto(buscaContato);
      const termoNumeros = buscaContato.replace(/\D/g, '');

      // Buscar todos os contatos do banco
      const todosContatos = await base44.entities.Contact.list('-ultima_interacao', 1000);

      // Filtrar e ordenar por relevância
      const contatosValidos = todosContatos.
      filter((c) => {
        if (!c || c.bloqueado || !c.telefone) return false;

        const nome = normalizarTexto(c.nome || '');
        const empresa = normalizarTexto(c.empresa || '');
        const cargo = normalizarTexto(c.cargo || '');
        const telefone = (c.telefone || '').replace(/\D/g, '');

        return nome.includes(termoBusca) ||
        empresa.includes(termoBusca) ||
        cargo.includes(termoBusca) ||
        termoNumeros.length >= 3 && telefone.includes(termoNumeros);
      }).
      sort((a, b) => {
        // Ordenar por relevância
        const nomeA = normalizarTexto(a.nome || '');
        const nomeB = normalizarTexto(b.nome || '');

        const scoreA = nomeA === termoBusca ? 100 : nomeA.startsWith(termoBusca) ? 50 : 10;
        const scoreB = nomeB === termoBusca ? 100 : nomeB.startsWith(termoBusca) ? 50 : 10;

        return scoreB - scoreA;
      });

      return contatosValidos;
    },
    enabled: mostrarDialogEncaminhar && buscaContato.trim().length >= 2,
    staleTime: 30000
  });

  const toggleContatoSelecionado = (contato) => {
    setContatosSelecionados((prev) => {
      if (prev.includes(contato.id)) {
        return prev.filter((id) => id !== contato.id);
      } else {
        return [...prev, contato.id];
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

      for (const contatoId of contatosSelecionados) {
        const contato = contatos.find((c) => c.id === contatoId);
        if (!contato) {
          console.error(`[BUBBLE] Contato ${contatoId} não encontrado`);
          erros++;
          continue;
        }

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

  // ✅ BUSCAR MENSAGEM ORIGINAL para quote/resposta (IGUAL WhatsApp)
  // Prioridade: reply_to_message_id (mensagem interna) → metadata.quoted_message (W-API)
  const mensagemOriginal = React.useMemo(() => {
    // 1. Buscar no array local por ID (respostas internas)
    if (message?.reply_to_message_id && mensagens) {
      const found = mensagens.find((m) => m.id === message.reply_to_message_id);
      if (found) return found;
    }
    // 2. Fallback: quoted_message do metadata (W-API/WhatsApp nativo)
    const qm = message?.metadata?.quoted_message;
    if (qm) {
      // Normalizar para formato compatível com a UI
      const texto = qm.conversation ||
                    qm.extendedTextMessage?.text ||
                    qm.imageMessage?.caption ||
                    qm.videoMessage?.caption ||
                    qm.documentMessage?.caption ||
                    qm.audioMessage ? '🎤 Áudio' :
                    qm.imageMessage ? '📷 Imagem' :
                    qm.videoMessage ? '🎥 Vídeo' :
                    qm.documentMessage ? `📄 ${qm.documentMessage.fileName || 'Documento'}` :
                    qm.stickerMessage ? '🎨 Sticker' :
                    null;
      if (texto) {
        return {
          id: null,
          content: texto,
          media_type: qm.imageMessage ? 'image' :
                      qm.videoMessage ? 'video' :
                      qm.audioMessage ? 'audio' :
                      qm.documentMessage ? 'document' :
                      qm.stickerMessage ? 'sticker' : 'none',
          sender_type: qm.key?.fromMe ? 'user' : 'contact',
          sender_id: qm.key?.fromMe ? message.sender_id : null,
          _fromMetadata: true
        };
      }
    }
    return null;
  }, [message?.reply_to_message_id, message?.metadata?.quoted_message, mensagens]);

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

  const aplicarEtiqueta = async (valorCategoria) => {
    if (categorizando || !message) return;
    setCategorizando(true);
    try {
      const categoriasAtuais = normalizarCategorias(message?.categorias);
      const novasCategorias = categoriasAtuais.includes(valorCategoria) ?
      categoriasAtuais.filter((c) => c !== valorCategoria) :
      [...categoriasAtuais, valorCategoria];

      await base44.entities.Message.update(message?.id, { categorias: novasCategorias });
      const threadId = thread?.id;
      if (threadId) await queryClient.invalidateQueries({ queryKey: ['mensagens', threadId] });

      const catConfig = todasCategorias.find((c) => c.nome === valorCategoria);
      toast.success(`${catConfig?.emoji || '🏷️'} ${catConfig?.label || valorCategoria} ${novasCategorias.includes(valorCategoria) ? 'adicionada' : 'removida'}`);
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setCategorizando(false);
    }
  };

  const handleToggleCategoria = (valorCategoria) => {
    const categoriasAtuais = normalizarCategorias(message?.categorias);
    // Se está removendo, apenas remove — sem dialog
    if (categoriasAtuais.includes(valorCategoria)) {
      aplicarEtiqueta(valorCategoria);
      return;
    }
    // Está adicionando: abre dialog de fase
    const catConfig = todasCategorias.find((c) => c.nome === valorCategoria);
    setEtiquetaFaseDialog(catConfig || { nome: valorCategoria, label: valorCategoria, emoji: '🏷️' });
  };

  const handleConfirmarEtiquetaFase = async (fase, criarOportunidade, destino) => {
    const etiqueta = etiquetaFaseDialog;
    setEtiquetaFaseDialog(null);
    if (!etiqueta) return;

    // 1. Aplica a etiqueta na mensagem
    await aplicarEtiqueta(etiqueta.nome);

    // 2. Cria no Kanban conforme destino escolhido
    if (criarOportunidade) {
      if (destino === 'orcamentos' && fase && window.handleCriarOportunidadeDeChat) {
        window.handleCriarOportunidadeDeChat(message, thread || {}, fase, 'orcamentos');
      } else if (destino === 'leads' && window.handleCriarOportunidadeDeChat) {
        window.handleCriarOportunidadeDeChat(message, thread || {}, null, 'leads');
      } else if (destino === 'clientes' && window.handleCriarOportunidadeDeChat) {
        window.handleCriarOportunidadeDeChat(message, thread || {}, null, 'clientes');
      }
    }
  };

  const adicionarNovaCategoria = async (nomeCategoria) => {
    if (categorizando || !message) return;

    setCategorizando(true);
    try {
      const categoriaNormalizada = nomeCategoria.toLowerCase().replace(/\s+/g, '_');

      const existente = categoriasDB.find((c) => c.nome === categoriaNormalizada);

      if (!existente) {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔔 MENSAGEM DE TRANSFERÊNCIA
  // ═══════════════════════════════════════════════════════════════════════════
  if (isTransferMessage) {
    const setorTransferido = message.metadata?.sector_destino || message.metadata?.setor || thread?.sector_id || 'geral';
    const usuarioTransferiu = message.metadata?.transferred_by_name || message.metadata?.transferido_por || 'Sistema';
    const horarioTransferencia = message.sent_at || message.created_date;

    const coresSetor = {
      vendas: {
        bg: 'from-rose-100 to-pink-100',
        border: 'border-rose-400',
        text: 'text-rose-950',
        icon: 'from-rose-500 to-pink-500',
        timestamp: 'text-rose-700'
      },
      assistencia: {
        bg: 'from-teal-100 to-cyan-100',
        border: 'border-teal-400',
        text: 'text-teal-950',
        icon: 'from-teal-500 to-cyan-500',
        timestamp: 'text-teal-700'
      },
      financeiro: {
        bg: 'from-orange-100 to-amber-100',
        border: 'border-orange-400',
        text: 'text-orange-950',
        icon: 'from-orange-500 to-amber-500',
        timestamp: 'text-orange-700'
      },
      fornecedor: {
        bg: 'from-violet-100 to-purple-100',
        border: 'border-violet-400',
        text: 'text-violet-950',
        icon: 'from-violet-500 to-purple-500',
        timestamp: 'text-violet-700'
      },
      geral: {
        bg: 'from-gray-200 to-slate-200',
        border: 'border-gray-400',
        text: 'text-gray-950',
        icon: 'from-gray-500 to-slate-500',
        timestamp: 'text-gray-700'
      }
    };

    const cores = coresSetor[setorTransferido] || coresSetor.geral;

    return (
      <div className="w-full flex justify-center my-3">
        <div className={`bg-gradient-to-r ${cores.bg} border-2 ${cores.border} ${cores.text} text-sm px-5 py-2.5 rounded-2xl inline-flex flex-col items-center justify-center gap-1 shadow-lg max-w-[85%]`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 bg-gradient-to-br ${cores.icon} rounded-full flex items-center justify-center flex-shrink-0 shadow-md`}>
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold leading-tight">
              {sanitizeEmojis(String(message.content || ''))}
            </span>
          </div>
          <span className={`text-[10px] ${cores.timestamp} font-medium`}>
            por {sanitizeEmojis(usuarioTransferiu)} às {horarioTransferencia ? format(new Date(horarioTransferencia), 'HH:mm', { locale: ptBR }) : '--:--'}
          </span>
        </div>
      </div>);

  }

  return (
    <>
      <div className={cn(
        "flex w-full px-[5%]",
        isOwn ? "justify-end" : "justify-start"
      )}
      onClick={() => modoSelecao && onToggleSelecao?.(message.id)}>

        {modoSelecao &&
        <div className="flex items-center justify-center mr-2">
            <div className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            selecionada ? "bg-blue-500 border-blue-500" : "border-slate-300"
          )}>
              {selecionada && <Check className="w-3 h-3 text-white" />}
            </div>
          </div>
        }

        <div className={cn(
          "max-w-[65%]",
          "flex flex-col group relative"
        )}>
          {!isOwn && (thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group' || message.channel === 'interno') && (() => {
            const atendenteRemetente = atendentes.find((a) => a.id === message.sender_id);
            if (!atendenteRemetente) return null;
            return (
              <div className="mb-0.5">
                <UsuarioDisplay
                  usuario={atendenteRemetente}
                  className="text-[11px] font-semibold text-cyan-600"
                  variant="compact" />

              </div>);

          })()}
          {!isOwn && message.sender_type === 'contact' && contato?.nome &&
          <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-semibold text-[#00a884]">
                {contato.nome}
              </span>
              {(() => {
              const integracaoId = message?.metadata?.whatsapp_integration_id || thread?.whatsapp_integration_id;
              if (!integracaoId || integracoes.length <= 1) return null;

              const integracao = integracoes.find((i) => i.id === integracaoId);
              if (!integracao) return null;

              const displayNumero = integracao.numero_telefone || integracao.nome_instancia;
              return (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    📱 {displayNumero}
                  </span>);

            })()}
            </div>
          }

          {/* ✅ QUOTE/RESPOSTA - Estilo WhatsApp */}
          {mensagemOriginal &&
          <div className={cn(
            "mb-1.5 mx-2 mt-2 px-2 py-1.5 rounded-md border-l-[3px]",
            isThreadInterna ?
            isOwn ? "bg-blue-50/50 border-blue-400" : "bg-slate-50 border-slate-400" :
            isOwn ? "bg-emerald-50/50 border-emerald-500" : "bg-slate-50 border-slate-400"
          )}>
              {/* Nome do remetente original */}
              <p className={cn(
              "text-[11px] font-semibold mb-0.5",
              isThreadInterna ?
              isOwn ? "text-blue-600" : "text-slate-600" :
              isOwn ? "text-emerald-600" : "text-slate-600"
            )}>
                {(() => {
                if (mensagemOriginal.sender_type === 'user') {
                  // Mensagem de atendente
                  const atendenteOriginal = atendentes.find((a) => a.id === mensagemOriginal.sender_id);
                  if (mensagemOriginal.sender_id === usuarioAtual?.id) return 'Você';
                  return atendenteOriginal?.display_name || atendenteOriginal?.full_name || 'Atendente';
                } else {
                  // Mensagem do cliente/contato
                  return contato?.nome || 'Cliente';
                }
              })()}
              </p>
              
              {/* Preview do conteúdo */}
              <p className="text-[12px] text-slate-600 line-clamp-2 break-words">
                {(() => {
                // Mostrar mídia com ícone
                if (mensagemOriginal.media_type === 'image') return '📷 Imagem';
                if (mensagemOriginal.media_type === 'video') return '🎥 Vídeo';
                if (mensagemOriginal.media_type === 'audio') return '🎤 Áudio';
                if (mensagemOriginal.media_type === 'document') return '📄 Documento';
                if (mensagemOriginal.media_type === 'sticker') return '🎨 Sticker';
                if (mensagemOriginal.media_type === 'location') return '📍 Localização';

                // Sanitizar emojis do texto
                const texto = sanitizeEmojis(String(mensagemOriginal.content || ''));
                return texto || '[Conteúdo não disponível]';
              })()}
              </p>
            </div>
          }

          <div className={cn(
            "rounded-lg relative shadow-sm",
            // 🎨 CORES TIPO WHATSAPP: Internas (azul claro suave) vs Externas (verde claro)
            thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group' || message.channel === 'interno' ?
            isOwn ? "bg-[#cfe9ff] border border-blue-200" : "bg-white border border-slate-200" :
            isOwn ? "bg-[#d9fdd3] border border-green-200" : "bg-white border border-slate-200",
            selecionada ? 'ring-2 ring-blue-500' : '',
            message.media_url && message.media_type !== 'none' ? '' : 'px-3 py-1.5'
          )}
          style={{
            borderRadius: isOwn ? '8px 0 8px 8px' : '0 8px 8px 8px'
          }}>
            {!modoSelecao && !isTransferMessage &&
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

                  {/* ✅ NEXUS360: Encaminhar validado */}
                  {podeEncaminhar &&
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
                }

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

                  {/* ✅ NEXUS360: Categorizar validado */}
                  {podeCategorizar &&
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
                }
                </div>
              </TooltipProvider>
            }

            {/* IMAGEM - ✅ AGNÓSTICO: Funciona para WhatsApp E Interno */}
            {message.media_type === 'image' && (message.media_url || message.content?.includes('[Imagem]')) &&
            <div className="relative overflow-hidden rounded-lg">
                {message.media_url ?
              <ImageWithFallback
                src={message.media_url}
                alt="Imagem"
                className="max-w-[280px] max-h-[280px] object-cover rounded-lg cursor-pointer"
                onClick={() => window.open(message.media_url, '_blank')}
                isPersisted={message.metadata?.midia_persistida} /> :
              message.metadata?.requiresDownload ?
              <div className="flex flex-col items-center justify-center bg-slate-100 rounded-2xl p-8 min-h-[200px] max-w-[280px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                <span className="text-sm text-slate-600 font-medium">Processando imagem...</span>
              </div> :
              <div className="flex items-center justify-center bg-slate-100 rounded-2xl p-8 min-h-[200px] max-w-[280px]">
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Imagem indisponível</p>
                    </div>
                  </div>
              }
                {message.media_caption &&
              <div className="px-4 py-2 break-words whitespace-pre-wrap text-slate-800" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    <p className="text-sm leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Color Emoji", sans-serif' }}>
                      {message.media_caption}
                    </p>
                  </div>
              }
                <div className="bg-slate-200 px-2 py-0.5 rounded-[10px] absolute bottom-2 right-2 backdrop-blur-sm">
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

                      <span className="text-[10px] text-slate-500">
                        {format(new Date(message.sent_at || message.created_date), 'dd/MM HH:mm')}
                      </span>
                    {isOwn && message.status === 'enviando' && <Clock className="w-3 h-3 text-slate-400" />}
                    {isOwn && message.status === 'enviada' && <Check className="w-3.5 h-3.5 text-slate-500" />}
                    {isOwn && message.status === 'entregue' && <CheckCheck className="w-3.5 h-3.5 text-slate-600" />}
                    {isOwn && message.status === 'lida' && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
                    {isOwn && message.status === 'falhou' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                  </div>
                </div>
              </div>
            }

            {/* ÁUDIO - ✅ AGNÓSTICO: Funciona para WhatsApp E Interno */}
            {message?.media_type === 'audio' && (message?.media_url || message.content?.includes('[Áudio]')) &&
            <div className={cn(
              "px-2 py-2 min-w-[220px] max-w-[300px]",
              "text-slate-800"
            )}>
                <div className="flex items-center gap-2">
                  {/* Avatar do remetente */}
                  <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <Mic className="w-4 h-4 text-white" />
                  </div>
                  {!message?.media_url || message?.media_url === 'pending_download' ? (() => {
                  // Se passou mais de 3 minutos e ainda está pending → falhou
                  const msgAge = Date.now() - new Date(message.sent_at || message.created_date).getTime();
                  const expirou = msgAge > 3 * 60 * 1000;
                  return (
                    <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-slate-100 text-slate-600">
                      {expirou
                        ? <><AlertCircle className="w-4 h-4 flex-shrink-0 text-slate-400" /><span className="text-slate-400">Áudio indisponível</span></>
                        : <><Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" /><span>Processando áudio...</span></>
                      }
                    </div>
                  );
                })() :

                <AudioPlayer src={message.media_url} />
                }
                </div>
                {/* remove ícone duplicado de Mic no wrapper externo — o AudioPlayer já tem play/pause */}

                {/* Transcrição (quando disponível) */}
                {message?.metadata?.analise_multimodal?.transcricao &&
              <div className="mt-1.5 px-1 py-1 bg-black/5 rounded text-[11px] text-slate-600 italic leading-snug">
                    💬 {message.metadata.analise_multimodal.transcricao}
                  </div>
              }
                <div className="flex items-center justify-end gap-1 mt-1 flex-wrap">
                  {/* THREADS INTERNAS: Atendente + Destino */}
                  {isThreadInterna && (() => {
                  const atendenteMsg = atendentes.find((a) => a.id === message.sender_id);
                  if (!atendenteMsg) return null;

                  const nomeAtendente = (atendenteMsg.display_name || atendenteMsg.full_name || '').split(' ')[0];

                  let destinoLabel = null;
                  let DestinoIcon = null;
                  let destinoBg = 'bg-gray-100';
                  let destinoText = 'text-gray-700';

                  if (thread?.thread_type === 'sector_group') {
                    destinoLabel = `Setor: ${thread.group_name?.replace('Setor ', '') || thread.sector_key?.replace('sector:', '')}`;
                    DestinoIcon = Building;
                    destinoBg = 'bg-purple-100';
                    destinoText = 'text-purple-800';
                  } else if (thread?.thread_type === 'team_internal' && thread.is_group_chat) {
                    destinoLabel = `Grupo: ${thread.group_name}`;
                    DestinoIcon = Users;
                    destinoBg = 'bg-sky-100';
                    destinoText = 'text-sky-800';
                  }

                  return (
                    <>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 flex items-center gap-1 font-medium">
                          <UserCheck className="w-3 h-3" />
                          {nomeAtendente}
                        </span>
                        {destinoLabel && DestinoIcon &&
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${destinoBg} ${destinoText} flex items-center gap-1 font-medium`}>
                              <DestinoIcon className="w-3 h-3" />
                              {destinoLabel}
                          </span>
                      }
                      </>);

                })()}
                  
                  <span className="text-[10px] text-slate-500">
                    {format(new Date(message.sent_at || message.created_date), 'dd/MM HH:mm')}
                  </span>
                  {isOwn && message.status === 'enviando' && <Clock className="w-3 h-3 text-slate-400" />}
                  {isOwn && message.status === 'enviada' && <Check className="w-3.5 h-3.5 text-slate-500" />}
                  {isOwn && message.status === 'entregue' && <CheckCheck className="w-3.5 h-3.5 text-slate-600" />}
                  {isOwn && message.status === 'lida' && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
                  {isOwn && message.status === 'falhou' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                </div>
              </div>
            }

            {/* VÍDEO - ✅ AGNÓSTICO */}
            {message?.media_type === 'video' && message?.media_url &&
            <div className="px-3 py-2">
                <video
                src={message.media_url}
                controls
                className="max-w-[280px] max-h-[280px] rounded-lg" />

                {message.media_caption &&
              <div className="px-2 py-1 mt-1 text-slate-800">
                    <p className="text-sm">{message.media_caption}</p>
                  </div>
              }
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[11px] text-slate-500">
                    {format(new Date(message.sent_at || message.created_date), 'dd/MM HH:mm')}
                  </span>
                  {isOwn && message.status === 'enviando' && <Clock className="w-3 h-3 text-slate-400" />}
                  {isOwn && message.status === 'enviada' && <Check className="w-3.5 h-3.5 text-slate-500" />}
                  {isOwn && message.status === 'entregue' && <CheckCheck className="w-3.5 h-3.5 text-slate-600" />}
                  {isOwn && message.status === 'lida' && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
                </div>
              </div>
            }

            {/* DOCUMENTO/PDF - Abre direto sem forçar download */}
            {(
            message?.media_type === 'document' ||
            message?.content === 'pdf' ||
            message?.content?.toLowerCase() === '[documento]' ||
            (message?.media_url && (
            message?.media_url.toLowerCase().includes('.pdf') ||
            message?.media_url.toLowerCase().includes('.doc') ||
            message?.media_url.toLowerCase().includes('.xls')))) &&

            message?.media_url && message?.media_url !== 'pending_download' &&
            (() => {
              const docUrl = message.media_url;
              const ext = (docUrl?.split('.').pop()?.split('?')[0] || '').toLowerCase();
              const isPdf = ext === 'pdf' || docUrl?.toLowerCase().includes('.pdf');
              const nomeArquivo = message.media_caption || message.content?.replace(/[\[\]]/g, '').trim() || 'Documento';
              
              // Para PDFs: abrir inline via Google Docs Viewer (não força download)
              const abrirPdf = () => {
                if (isPdf) {
                  const cleanUrl = docUrl.split('?')[0];
                  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(cleanUrl)}&embedded=false`;
                  window.open(viewerUrl, '_blank', 'noopener,noreferrer');
                } else {
                  window.open(docUrl, '_blank', 'noopener,noreferrer');
                }
              };
              
              return (
                <div className="overflow-hidden">
                  <button
                    onClick={abrirPdf}
                    className="flex items-center gap-3 hover:bg-black/5 active:bg-black/10 transition-colors w-full text-left p-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-blue-500">
                      <FileIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate mb-0.5 text-slate-900">
                        📄 {nomeArquivo}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs uppercase font-semibold text-blue-600">
                          {ext || 'PDF'}
                        </p>
                        <span className="text-xs text-slate-500">
                          • Toque para abrir
                        </span>
                      </div>
                    </div>
                    <Download className="w-5 h-5 flex-shrink-0 text-blue-500" />
                  </button>
                  
                  <div className={cn("flex items-center justify-end gap-1 px-3 pb-2 pt-1 flex-wrap")}>
                    <span className="text-[10px] text-slate-500">
                      {format(new Date(message.sent_at || message.created_date), 'dd/MM HH:mm')}
                    </span>
                    {isOwn && message.status === 'enviando' && <Clock className="w-3 h-3 text-slate-400" />}
                    {isOwn && message.status === 'enviada' && <Check className="w-3.5 h-3.5 text-slate-500" />}
                    {isOwn && message.status === 'entregue' && <CheckCheck className="w-3.5 h-3.5 text-slate-600" />}
                    {isOwn && message.status === 'lida' && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
                    {isOwn && message.status === 'falhou' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                  </div>
                </div>
              );
            })()
            }
            
            {/* DOCUMENTO PENDENTE - Quando ainda está baixando */}
            {(
            message?.media_type === 'document' ||
            message?.content === 'pdf' ||
            message?.content?.toLowerCase() === '[documento]' ||
            (message?.media_url && (
            message?.media_url.toLowerCase().includes('.pdf') ||
            message?.media_url.toLowerCase().includes('.doc') ||
            message?.media_url.toLowerCase().includes('.xls')))) &&

            message?.media_url === 'pending_download' &&
            <div className="overflow-hidden px-3 py-3">
                <div className="flex items-center gap-3 opacity-70">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-200">
                    <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-500">
                      {message.media_caption || message.content?.replace(/[\[\]]/g, '').trim() || 'Documento'}
                    </p>
                    <p className="text-xs text-slate-400">
                      Processando arquivo...
                    </p>
                  </div>
                </div>
                <div className={cn("flex items-center justify-end gap-1 mt-2 flex-wrap")}>
                  <span className="text-[10px] text-slate-500">
                    {format(new Date(message.sent_at || message.created_date), 'dd/MM HH:mm')}
                  </span>
                  {isOwn && message.status === 'enviando' && <Clock className="w-3 h-3 text-slate-400" />}
                </div>
              </div>
            }

            {/* TEXTO - ✅ RENDERIZAÇÃO SEGURA DE EMOJIS */}
            {(!message?.media_url || message?.media_type === 'none') && message?.media_type !== 'document' && message?.content != null && String(message.content || '').trim() !== '' && String(message.content) !== '[No content]' &&
            <>
                <div className={cn(
                "break-words whitespace-pre-wrap",
                // 🎨 TEXTO ESCURO HARMONIOSO em fundos claros
                "text-[#111b21]"
              )} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  <p className="text-[14.2px] leading-[19px]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Color Emoji", sans-serif' }}>
                    {sanitizeEmojis(String(message.content || ''))}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-1 mt-0.5 flex-wrap">
                {/* THREADS INTERNAS: Atendente + Setor (apenas mensagens enviadas) */}
                {isOwn && isThreadInterna && (() => {
                  const atendenteMsg = atendentes.find((a) => a.id === message.sender_id);
                  if (!atendenteMsg) return null;

                  const nomeAtendente = (atendenteMsg.display_name || atendenteMsg.full_name || '').split(' ')[0];

                  let destinoLabel = null;
                  let DestinoIcon = null;
                  let destinoBg = 'bg-gray-100';
                  let destinoText = 'text-gray-700';

                  if (thread?.thread_type === 'sector_group') {
                    destinoLabel = `Setor: ${thread.group_name?.replace('Setor ', '') || thread.sector_key?.replace('sector:', '')}`;
                    DestinoIcon = Building;
                    destinoBg = 'bg-purple-100';
                    destinoText = 'text-purple-800';
                  } else if (thread?.thread_type === 'team_internal' && thread.is_group_chat) {
                    destinoLabel = `Grupo: ${thread.group_name}`;
                    DestinoIcon = Users;
                    destinoBg = 'bg-sky-100';
                    destinoText = 'text-sky-800';
                  }

                  return (
                    <>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 flex items-center gap-1 font-medium">
                                <UserCheck className="w-3 h-3" />
                                {nomeAtendente}
                            </span>
                            {destinoLabel && DestinoIcon &&
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${destinoBg} ${destinoText} flex items-center gap-1 font-medium`}>
                                    <DestinoIcon className="w-3 h-3" />
                                    {destinoLabel}
                                </span>
                      }
                        </>);

                })()}
                
                {/* THREADS EXTERNAS: Atendente + Setor + Conexão (apenas mensagens enviadas) */}
                {isOwn && !isThreadInterna && thread && integracoes.length > 0 && (() => {
                  const integracaoId = message?.metadata?.whatsapp_integration_id || thread?.whatsapp_integration_id;
                  if (!integracaoId) return null;

                  const integracao = integracoes.find((i) => i.id === integracaoId);
                  if (!integracao) return null;

                  const displayNumero = integracao.numero_telefone || integracao.nome_instancia;
                  const atendenteRemetente = atendentes.find((a) => a.id === message.sender_id);
                  const nomeCompletoAtendente = atendenteRemetente?.display_name || atendenteRemetente?.full_name;
                  const nomeAtendente = nomeCompletoAtendente?.split(' ')[0];
                  const setorAtendente = atendenteRemetente?.attendant_sector;

                  return (
                    <>
                      {nomeAtendente &&
                      <>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-0.5">
                            <UserCheck className="w-3 h-3" />
                            {nomeAtendente}
                          </span>
                          {setorAtendente &&
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                              {setorAtendente}
                            </span>
                        }
                        </>
                      }
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        📱 {displayNumero}
                      </span>
                    </>);

                })()}
                
                <span className="text-[11px] text-slate-500">
                  {format(new Date(message.sent_at || message.created_date), 'dd/MM HH:mm')}
                </span>
                {isOwn && (() => {
                  if (message.status === 'enviando') return <Clock className="w-[14px] h-[14px] text-slate-400" />;
                  if (message.status === 'enviada') return <Check className="w-[14px] h-[14px] text-slate-400" />;
                  if (message.status === 'entregue') return <CheckCheck className="w-[14px] h-[14px] text-slate-400" />;
                  if (message.status === 'lida') return <CheckCheck className="w-[14px] h-[14px] text-blue-500" />;
                  if (message.status === 'falhou') return <AlertCircle className="w-[14px] h-[14px] text-red-500" />;
                  // sem status definido: mostrar entregue (padrão WhatsApp)
                  return <CheckCheck className="w-[14px] h-[14px] text-slate-400" />;
                })()}
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

      {/* Dialog de fase do Kanban ao etiquetar */}
      <EtiquetaFaseDialog
        aberto={!!etiquetaFaseDialog}
        onFechar={() => setEtiquetaFaseDialog(null)}
        etiqueta={etiquetaFaseDialog}
        onConfirmar={handleConfirmarEtiquetaFase}
        mensagem={message}
        contato={contato} />


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
                {contatosSelecionados.map((contatoId) => {
                const contato = contatos.find((c) => c.id === contatoId);
                if (!contato) return null;

                return (
                  <Badge
                    key={contato.id}
                    variant="secondary"
                    className="bg-blue-100 text-blue-800 gap-1">

                      {contato.nome || contato.telefone}
                      <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleContatoSelecionado(contato);
                      }}
                      className="ml-1 hover:bg-blue-200 rounded-full p-0.5">

                        ×
                      </button>
                    </Badge>);

              })}
              </div>
            }

            <ScrollArea className="h-64 border rounded-lg">
              {!buscaContato || buscaContato.trim().length < 2 ?
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Search className="w-12 h-12 mb-3 text-slate-300" />
                  <p className="text-sm font-medium">Digite para buscar</p>
                  <p className="text-xs text-slate-400 mt-1">Mínimo 2 caracteres</p>
                </div> :
              carregandoContatos ?
              <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div> :
              contatos.length === 0 ?
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <p className="text-sm">Nenhum contato encontrado</p>
                </div> :

              <div className="p-2">
                  {contatos.map((contato) => {
                  const selecionado = contatosSelecionados.includes(contato.id);

                  // ✅ Nome formatado: Empresa + Cargo + Nome (igual sidebar)
                  let nomeExibicao = "";
                  if (contato.empresa) nomeExibicao += contato.empresa;
                  if (contato.cargo) nomeExibicao += (nomeExibicao ? " - " : "") + contato.cargo;
                  if (contato.nome && contato.nome !== contato.telefone && contato.nome !== '-') {
                    nomeExibicao += (nomeExibicao ? " - " : "") + contato.nome;
                  }
                  if (!nomeExibicao || nomeExibicao.trim() === '') {
                    nomeExibicao = contato.telefone || "Sem nome";
                  }

                  return (
                    <button
                      key={contato.id}
                      onClick={() => toggleContatoSelecionado(contato)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors",
                        selecionado && "bg-blue-50 hover:bg-blue-100"
                      )}>

                          <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden",
                        selecionado ? "bg-blue-600" : "bg-slate-400"
                      )}>
                            {selecionado ?
                        <Check className="w-5 h-5" /> :
                        contato.foto_perfil_url && contato.foto_perfil_url !== 'null' && contato.foto_perfil_url !== 'undefined' ?
                        <img
                          src={contato.foto_perfil_url}
                          alt={nomeExibicao}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.textContent = nomeExibicao.charAt(0).toUpperCase();
                          }} /> :


                        nomeExibicao.charAt(0)?.toUpperCase() || '?'
                        }
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-medium text-slate-900 truncate">
                              {nomeExibicao}
                            </p>
                            <p className="text-sm text-slate-500 truncate">{contato.telefone}</p>
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

});