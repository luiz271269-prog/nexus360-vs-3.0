import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  RefreshCw,
  Loader2,
  User,
  Clock,
  MessageSquare,
  X,
  ArrowLeft,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import ChatWindow from './ChatWindow';
import { isNaoAtribuida } from '../lib/threadVisibility';

export default function ContatosNaoAtribuidosKanban({ usuario, threads = [], onClose }) {
  const [contatosSelecionados, setContatosSelecionados] = useState([]);
  const [usuariosMap, setUsuariosMap] = useState({});
  const [chatAberto, setChatAberto] = useState(null);
  const [mensagensChat, setMensagensChat] = useState([]);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [etiquetasSelecionadas, setEtiquetasSelecionadas] = useState([]);

  // Filtrar APENAS threads externas não atribuídas (sem mensagens internas)
  const naoAtribuidasBase = useMemo(() => {
    return threads.filter(t => {
      // ✅ CRÍTICO: Excluir threads internas completamente
      if (t.thread_type === 'team_internal' || t.thread_type === 'sector_group' || !t.contact_id) {
        return false;
      }
      // ✅ Apenas threads externas com contato
      return !t.assigned_user_id && isNaoAtribuida(t);
    });
  }, [threads]);

  // Aplicar filtro de etiquetas
  const naoAtribuidas = etiquetasSelecionadas.length > 0
    ? naoAtribuidasBase.filter(item => 
        item.contato?.tags && item.contato.tags.some(tag => etiquetasSelecionadas.includes(tag))
      )
    : naoAtribuidasBase;

  // Obter todas as etiquetas únicas
  const todasEtiquetas = useMemo(() => {
    const tags = new Set();
    naoAtribuidasBase.forEach(t => {
      if (t.contato?.tags && Array.isArray(t.contato.tags)) {
        t.contato.tags.forEach(tag => tags.add(tag));
      }
    });
    return Array.from(tags).sort();
  }, [naoAtribuidasBase]);

  // Carregar atendentes
  useEffect(() => {
    const carregarAtendentes = async () => {
      try {
        const resultado = await base44.functions.invoke('listarUsuariosParaAtribuicao', {});
        if (resultado?.data?.success && resultado?.data?.usuarios) {
          const map = {};
          resultado.data.usuarios.forEach((u) => {
            map[u.id] = u.full_name || u.email;
          });
          setUsuariosMap(map);
        }
      } catch (error) {
        console.error('[ContatosNaoAtributados] Erro ao carregar atendentes:', error);
      }
    };

    if (naoAtribuidas.length > 0) {
      carregarAtendentes();
    }
  }, [naoAtribuidas]);

  const formatarDataUltimaMensagem = (data) => {
    if (!data) return 'Sem mensagens';
    try {
      const dataObj = new Date(data);
      const agora = new Date();
      const diffMs = agora - dataObj;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMin = Math.floor(diffMs / (1000 * 60));

      if (diffDias > 0) return `${diffDias}d atrás`;
      if (diffHoras > 0) return `${diffHoras}h atrás`;
      if (diffMin > 0) return `${diffMin}m atrás`;
      return 'Agora';
    } catch {
      return 'Sem data';
    }
  };

  const toggleSelecaoContato = (thread) => {
    setContatosSelecionados((prev) => {
      const id = thread.id;
      const jaEsta = prev.some((t) => t.id === id);
      if (jaEsta) {
        return prev.filter((t) => t.id !== id);
      } else {
        return [...prev, thread];
      }
    });
  };

  const renderContatoCard = (thread) => {
    const contato = thread.contato;
    if (!contato) return null;

    const estaSelecionado = contatosSelecionados.some((t) => t.id === thread.id);

    let nomeExibicao = "";
    if (contato.empresa) nomeExibicao += contato.empresa;
    if (contato.cargo) nomeExibicao += (nomeExibicao ? " - " : "") + contato.cargo;
    if (contato.nome && contato.nome !== contato.telefone) nomeExibicao += (nomeExibicao ? " - " : "") + contato.nome;
    if (!nomeExibicao || nomeExibicao.trim() === '') {
      nomeExibicao = contato.telefone || "Sem Nome";
    }

    return (
      <div
        key={thread.id}
        onClick={async (e) => {
          e.stopPropagation();
          try {
            setCarregandoMensagens(true);
            const mensagens = await base44.entities.Message.filter(
              { thread_id: thread.id },
              '-sent_at',
              200
            );
            
            setChatAberto({
              thread,
              contato: {
                id: contato.id,
                nome: contato.nome,
                empresa: contato.empresa,
                telefone: contato.telefone,
                tipo_contato: contato.tipo_contato
              }
            });
            setMensagensChat(mensagens.reverse());
          } catch (error) {
            toast.error(`❌ ${error.message}`);
          } finally {
            setCarregandoMensagens(false);
          }
        }}
        className={`px-2 py-2 flex items-center gap-3 cursor-pointer transition-all border-b border-slate-100 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 ${
          estaSelecionado ? 'bg-orange-100 border-l-4 border-l-orange-500' : ''
        }`}
      >
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={estaSelecionado}
            onCheckedChange={() => toggleSelecaoContato(thread)}
          />
        </div>

        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md bg-gradient-to-br from-amber-400 via-orange-500 to-red-500">
            {contato.nome?.charAt(0)?.toUpperCase() || '?'}
          </div>
        </div>

        <div className="flex-1 min-w-0">
           <div className="flex items-center justify-between gap-2 mb-0.5">
             <h3 className="font-semibold truncate text-sm text-slate-900">
               {nomeExibicao}
             </h3>
             {(thread.unread_count > 0 || thread.total_mensagens > 0) && (
               <div className="flex items-center gap-0.5 flex-shrink-0">
                 {thread.unread_count > 0 && (
                   <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-md">
                     💬 {thread.unread_count}
                   </span>
                 )}
                 {thread.total_mensagens > 0 && (
                   <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full shadow-md">
                     ✓ {thread.total_mensagens}
                   </span>
                 )}
               </div>
             )}
           </div>

           <p className="text-xs text-slate-500 truncate mb-0.5 flex items-center gap-1">
             <Clock className="w-3 h-3 flex-shrink-0" />
             {formatarDataUltimaMensagem(thread.last_inbound_at || thread.last_message_at)}
           </p>

          {contato.tags && contato.tags.length > 0 && (
            <div className="flex items-center gap-0.5 flex-wrap">
              {contato.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[8px] px-1.5 py-0 h-4">
                  {tag}
                </Badge>
              ))}
              {contato.tags.length > 3 && (
                <span className="text-[8px] text-slate-500 font-semibold">+{contato.tags.length - 3}</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-0.5 flex-wrap mt-0.5">
            {(() => {
              const tipoContato = contato.tipo_contato || 'novo';
              const tiposConfig = {
                'novo': { emoji: '?', label: 'Novo', bg: 'bg-slate-400' },
                'lead': { emoji: 'L', label: 'Lead', bg: 'bg-amber-500' },
                'cliente': { emoji: 'C', label: 'Cliente', bg: 'bg-emerald-500' },
                'fornecedor': { emoji: 'F', label: 'Fornec.', bg: 'bg-blue-500' },
                'parceiro': { emoji: 'P', label: 'Parceiro', bg: 'bg-purple-500' }
              };
              const cfg = tiposConfig[tipoContato] || tiposConfig['novo'];
              return (
                <span className={`inline-flex items-center gap-0.5 px-1 py-0 rounded-full text-[9px] font-semibold text-white ${cfg.bg} shadow-sm`}>
                  {cfg.emoji} {cfg.label}
                </span>
              );
            })()}

            <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded-full text-[9px] font-semibold text-white bg-red-500 shadow-sm">
              <AlertTriangle className="w-2 h-2" />
              Sem atrib.
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex h-full min-h-0 bg-slate-50">
        <div className={`flex flex-col h-full min-h-0 transition-all ${chatAberto ? 'w-96' : 'w-full'}`}>
          <div className="flex-shrink-0 bg-white border-b-2 border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {onClose && (
                  <Button
                    onClick={onClose}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-sm">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-slate-800">Contatos Não Atribuídos</h2>
                  <p className="text-xs text-slate-500">{naoAtribuidas.length} aguardando atribuição</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-slate-200">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>

            {todasEtiquetas.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />
                  Filtrar por etiquetas
                </label>
                <div className="flex flex-wrap gap-1">
                  {todasEtiquetas.map((tag) => (
                    <Button
                      key={tag}
                      size="sm"
                      variant={etiquetasSelecionadas.includes(tag) ? 'default' : 'outline'}
                      onClick={() => {
                        setEtiquetasSelecionadas(prev =>
                          prev.includes(tag)
                            ? prev.filter(t => t !== tag)
                            : [...prev, tag]
                        );
                      }}
                      className={`h-6 px-2 text-xs ${
                        etiquetasSelecionadas.includes(tag)
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                          : ''
                      }`}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {naoAtribuidas.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-800">Tudo atribuído!</p>
                <p className="text-xs text-slate-500 mt-1">Todos os contatos estão com atendentes</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-custom">
              {naoAtribuidas.map(renderContatoCard)}
            </div>
          )}
        </div>

        {chatAberto && (
          <div className="w-1/2 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
            <div className="flex-shrink-0 bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 flex items-center justify-between border-b border-slate-600">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  onClick={() => setChatAberto(null)}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-white/20 text-white flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex-shrink-0">
                  {chatAberto.contato.nome?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">
                    {chatAberto.contato.empresa || chatAberto.contato.nome}
                  </h3>
                  <p className="text-xs text-slate-300 truncate">
                    {chatAberto.contato.cargo ? `${chatAberto.contato.cargo} - ` : ''}{chatAberto.contato.nome}
                  </p>
                </div>
              </div>
            </div>

            {carregandoMensagens ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : (
              <ChatWindow
                thread={chatAberto.thread}
                mensagens={mensagensChat}
                usuario={usuario}
                contatoPreCarregado={chatAberto.contato}
                onEnviarMensagem={async () => {}}
                onSendMessageOptimistic={async () => {}}
                onSendInternalMessageOptimistic={async () => {}}
                onShowContactInfo={() => {}}
                onAtualizarMensagens={async () => {
                  const mensagens = await base44.entities.Message.filter(
                    { thread_id: chatAberto.thread.id },
                    '-sent_at',
                    200
                  );
                  setMensagensChat(mensagens.reverse());
                }}
                integracoes={[]}
                selectedCategoria="all"
                modoSelecaoMultipla={false}
                contatosSelecionados={[]}
                broadcastInterno={null}
                onCancelarSelecao={() => {}}
                atendentes={[]}
                filterScope="all"
                selectedIntegrationId="all"
                selectedAttendantId={null}
                contatoAtivo={chatAberto.contato}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}