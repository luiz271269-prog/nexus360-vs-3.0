import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Forward, Search, Loader2, Check, ArrowRight } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function ModalEncaminharMensagem({
  isOpen,
  onClose,
  message,
  thread,
  usuarioAtual,
  contatos = [],
  setoresList = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral']
}) {
  const [buscaContato, setBuscaContato] = useState("");
  const [tipoDestinatario, setTipoDestinatario] = useState('contatos');
  const [contatosSelecionados, setContatosSelecionados] = useState([]);
  const [usuariosInternosSelecionados, setUsuariosInternosSelecionados] = useState([]);
  const [setoresSelecionados, setSetoresSelecionados] = useState([]);
  const [gruposSelecionados, setGruposSelecionados] = useState([]);
  const [encaminhando, setEncaminhando] = useState(false);

  const queryClient = useQueryClient();

  // ✅ BUSCA DE CONTATOS
  const { data: contatosEncontrados = [], isLoading: carregandoContatos } = useQuery({
    queryKey: ['contatos-encaminhar', buscaContato],
    queryFn: async () => {
      if (!buscaContato || buscaContato.trim().length < 2) return [];

      const normalizarTexto = (t) => {
        if (!t) return '';
        return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      };

      const termoBusca = normalizarTexto(buscaContato);
      const termoNumeros = buscaContato.replace(/\D/g, '');

      const todosContatos = await base44.entities.Contact.list('-ultima_interacao', 1000);

      return todosContatos.filter((c) => {
        if (!c || c.bloqueado || !c.telefone) return false;

        const nome = normalizarTexto(c.nome || '');
        const empresa = normalizarTexto(c.empresa || '');
        const cargo = normalizarTexto(c.cargo || '');
        const telefone = (c.telefone || '').replace(/\D/g, '');

        return nome.includes(termoBusca) ||
          empresa.includes(termoBusca) ||
          cargo.includes(termoBusca) ||
          termoNumeros.length >= 3 && telefone.includes(termoNumeros);
      }).sort((a, b) => {
        const nomeA = normalizarTexto(a.nome || '');
        const nomeB = normalizarTexto(b.nome || '');
        const scoreA = nomeA === termoBusca ? 100 : nomeA.startsWith(termoBusca) ? 50 : 10;
        const scoreB = nomeB === termoBusca ? 100 : nomeB.startsWith(termoBusca) ? 50 : 10;
        return scoreB - scoreA;
      });
    },
    enabled: isOpen && tipoDestinatario === 'contatos' && buscaContato.trim().length >= 2,
    staleTime: 30000
  });

  // ✅ BUSCA DE USUÁRIOS INTERNOS
  const { data: usuariosInternos = [], isLoading: carregandoUsuarios } = useQuery({
    queryKey: ['usuarios-internos-encaminhar', buscaContato],
    queryFn: async () => {
      if (!buscaContato || buscaContato.trim().length < 2) return [];

      const normalizarTexto = (t) => {
        if (!t) return '';
        return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      };

      const termoBusca = normalizarTexto(buscaContato);
      const todosUsuarios = await base44.entities.User.list('-created_date', 100);

      return todosUsuarios.filter((u) => {
        if (!u || u.id === usuarioAtual?.id) return false;
        const nome = normalizarTexto(u.full_name || u.display_name || '');
        const email = normalizarTexto(u.email || '');
        const setor = normalizarTexto(u.attendant_sector || '');

        return nome.includes(termoBusca) || email.includes(termoBusca) || setor.includes(termoBusca);
      });
    },
    enabled: isOpen && tipoDestinatario === 'internos' && buscaContato.trim().length >= 2,
    staleTime: 30000
  });

  // ✅ BUSCA DE SETORES
  const { data: setoresEncontrados = [] } = useQuery({
    queryKey: ['setores-encaminhar', buscaContato],
    queryFn: async () => {
      if (!buscaContato || buscaContato.trim().length < 1) return [];
      const normalizarTexto = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const termoBusca = normalizarTexto(buscaContato);
      return setoresList.filter((setor) => normalizarTexto(setor).includes(termoBusca));
    },
    enabled: isOpen && tipoDestinatario === 'setores' && buscaContato.trim().length >= 1,
    staleTime: 30000
  });

  // ✅ BUSCA DE GRUPOS
  const { data: gruposEncontrados = [], isLoading: carregandoGrupos } = useQuery({
    queryKey: ['grupos-encaminhar', buscaContato],
    queryFn: async () => {
      if (!buscaContato || buscaContato.trim().length < 2) return [];
      const normalizarTexto = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const termoBusca = normalizarTexto(buscaContato);
      const todosGrupos = await base44.entities.MessageThread.filter({ thread_type: 'sector_group' }, '-created_date', 50);
      return todosGrupos.filter((grupo) => {
        const nome = normalizarTexto(grupo.group_name || '');
        return nome.includes(termoBusca);
      });
    },
    enabled: isOpen && tipoDestinatario === 'grupos' && buscaContato.trim().length >= 2,
    staleTime: 30000
  });

  const handleEncaminhar = async () => {
    setEncaminhando(true);
    try {
      let sucessos = 0;
      let erros = 0;

      // ✅ CONTATOS EXTERNOS
      if (tipoDestinatario === 'contatos') {
        if (contatosSelecionados.length === 0) {
          toast.error("Selecione pelo menos um contato");
          return;
        }

        const integrationId = thread?.whatsapp_integration_id;
        if (!integrationId) {
          toast.error("❌ Não foi possível determinar a integração do WhatsApp");
          return;
        }

        for (const contatoId of contatosSelecionados) {
          const contato = contatosEncontrados.find((c) => c.id === contatoId);
          if (!contato) {
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
            console.error(`Erro ao encaminhar:`, error);
            erros++;
          }
        }
      }

      // ✅ USUÁRIOS INTERNOS
      if (tipoDestinatario === 'internos') {
        if (usuariosInternosSelecionados.length === 0) {
          toast.error("Selecione pelo menos um usuário interno");
          return;
        }

        for (const userId of usuariosInternosSelecionados) {
          try {
            const resultado = await base44.functions.invoke('getOrCreateInternalThread', {
              user_ids: [usuarioAtual.id, userId]
            });

            if (!resultado?.data?.success || !resultado?.data?.thread) {
              erros++;
              continue;
            }

            const threadInterna = resultado.data.thread;

            await base44.functions.invoke('sendInternalMessage', {
              thread_id: threadInterna.id,
              content: `[Encaminhado]\n${message.content || '[Mídia]'}`,
              media_type: message.media_type || 'none',
              media_url: message.media_url || null,
              media_caption: message.media_caption || null
            });

            sucessos++;
          } catch (error) {
            console.error(`Erro ao encaminhar:`, error);
            erros++;
          }
        }
      }

      // ✅ SETORES
      if (tipoDestinatario === 'setores') {
        if (setoresSelecionados.length === 0) {
          toast.error("Selecione pelo menos um setor");
          return;
        }

        for (const setor of setoresSelecionados) {
          try {
            const resultado = await base44.functions.invoke('getOrCreateSectorThread', {
              sector_id: setor
            });

            if (!resultado?.data?.success || !resultado?.data?.thread) {
              erros++;
              continue;
            }

            const threadSetor = resultado.data.thread;

            await base44.functions.invoke('sendInternalMessage', {
              thread_id: threadSetor.id,
              content: `[Encaminhado]\n${message.content || '[Mídia]'}`,
              media_type: message.media_type || 'none',
              media_url: message.media_url || null,
              media_caption: message.media_caption || null
            });

            sucessos++;
          } catch (error) {
            console.error(`Erro ao encaminhar:`, error);
            erros++;
          }
        }
      }

      // ✅ GRUPOS
      if (tipoDestinatario === 'grupos') {
        if (gruposSelecionados.length === 0) {
          toast.error("Selecione pelo menos um grupo");
          return;
        }

        for (const grupoId of gruposSelecionados) {
          try {
            await base44.functions.invoke('sendInternalMessage', {
              thread_id: grupoId,
              content: `[Encaminhado]\n${message.content || '[Mídia]'}`,
              media_type: message.media_type || 'none',
              media_url: message.media_url || null,
              media_caption: message.media_caption || null
            });

            sucessos++;
          } catch (error) {
            console.error(`Erro ao encaminhar:`, error);
            erros++;
          }
        }
      }

      if (sucessos > 0) {
        toast.success(`✅ Mensagem encaminhada para ${sucessos} destino(s)!`);
        queryClient.invalidateQueries({ queryKey: ['threads'] });
        queryClient.invalidateQueries({ queryKey: ['threads-internas'] });
      }

      if (erros > 0) {
        toast.error(`❌ ${erros} encaminhamento(s) falharam`);
      }

      onClose();
    } catch (error) {
      console.error('Erro ao encaminhar:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setEncaminhando(false);
    }
  };

  const limparSelecoes = () => {
    setContatosSelecionados([]);
    setUsuariosInternosSelecionados([]);
    setSetoresSelecionados([]);
    setGruposSelecionados([]);
    setBuscaContato("");
  };

  const handleFechar = () => {
    limparSelecoes();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleFechar}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="w-5 h-5 text-blue-600" />
            Encaminhar Mensagem
          </DialogTitle>
          <DialogDescription>
            Escolha o destino e selecione os destinatários
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ABAS */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'contatos', label: '👤 Contatos', color: 'blue' },
              { id: 'internos', label: '👥 Usuários', color: 'purple' },
              { id: 'setores', label: '🏢 Setores', color: 'orange' },
              { id: 'grupos', label: '👨‍💼 Grupos', color: 'green' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setTipoDestinatario(tab.id);
                  limparSelecoes();
                }}
                className={cn(
                  "px-3 py-1.5 rounded-md font-medium text-xs transition-all whitespace-nowrap",
                  tipoDestinatario === tab.id
                    ? `bg-white text-${tab.color}-600 shadow-sm`
                    : "text-slate-600 hover:text-slate-900"
                )}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* BUSCA */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder={tipoDestinatario === 'contatos' ? "Buscar contato..." :
                tipoDestinatario === 'internos' ? "Buscar usuário..." :
                tipoDestinatario === 'setores' ? "Buscar setor..." :
                "Buscar grupo..."}
              value={buscaContato}
              onChange={(e) => setBuscaContato(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* SELECIONADOS - CONTATOS */}
          {tipoDestinatario === 'contatos' && contatosSelecionados.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              {contatosSelecionados.map((contatoId) => {
                const contato = contatosEncontrados.find((c) => c.id === contatoId);
                if (!contato) return null;
                return (
                  <Badge key={contato.id} variant="secondary" className="bg-blue-100 text-blue-800 gap-1">
                    {contato.nome || contato.telefone}
                    <button
                      onClick={() => setContatosSelecionados((prev) => prev.filter((id) => id !== contato.id))}
                      className="ml-1 hover:bg-blue-200 rounded-full p-0.5">
                      ×
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          {/* SELECIONADOS - INTERNOS */}
          {tipoDestinatario === 'internos' && usuariosInternosSelecionados.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
              {usuariosInternosSelecionados.map((userId) => {
                const user = usuariosInternos.find((u) => u.id === userId);
                if (!user) return null;
                return (
                  <Badge key={user.id} variant="secondary" className="bg-purple-100 text-purple-800 gap-1">
                    {user.display_name || user.full_name || user.email}
                    <button
                      onClick={() => setUsuariosInternosSelecionados((prev) => prev.filter((id) => id !== user.id))}
                      className="ml-1 hover:bg-purple-200 rounded-full p-0.5">
                      ×
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          {/* SELECIONADOS - SETORES */}
          {tipoDestinatario === 'setores' && setoresSelecionados.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
              {setoresSelecionados.map((setor) => (
                <Badge key={setor} variant="secondary" className="bg-orange-100 text-orange-800 gap-1">
                  {setor}
                  <button
                    onClick={() => setSetoresSelecionados((prev) => prev.filter((s) => s !== setor))}
                    className="ml-1 hover:bg-orange-200 rounded-full p-0.5">
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* SELECIONADOS - GRUPOS */}
          {tipoDestinatario === 'grupos' && gruposSelecionados.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              {gruposSelecionados.map((grupoId) => {
                const grupo = gruposEncontrados.find((g) => g.id === grupoId);
                if (!grupo) return null;
                return (
                  <Badge key={grupo.id} variant="secondary" className="bg-green-100 text-green-800 gap-1">
                    {grupo.group_name}
                    <button
                      onClick={() => setGruposSelecionados((prev) => prev.filter((id) => id !== grupo.id))}
                      className="ml-1 hover:bg-green-200 rounded-full p-0.5">
                      ×
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          {/* LISTA */}
          <ScrollArea className="h-64 border rounded-lg">
            {!buscaContato || (tipoDestinatario !== 'setores' && buscaContato.trim().length < 2) ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Search className="w-12 h-12 mb-3 text-slate-300" />
                <p className="text-sm font-medium">Digite para buscar</p>
                <p className="text-xs text-slate-400 mt-1">Mínimo {tipoDestinatario === 'setores' ? '1' : '2'} caracteres</p>
              </div>
            ) : tipoDestinatario === 'contatos' ? (
              carregandoContatos ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : contatosEncontrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <p className="text-sm">Nenhum contato encontrado</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {contatosEncontrados.map((contato) => {
                    const selecionado = contatosSelecionados.includes(contato.id);
                    const nome = contato.nome || contato.telefone;
                    return (
                      <button
                        key={contato.id}
                        onClick={() => setContatosSelecionados((prev) => 
                          prev.includes(contato.id) ? prev.filter((id) => id !== contato.id) : [...prev, contato.id]
                        )}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors",
                          selecionado && "bg-blue-50 hover:bg-blue-100"
                        )}>
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0",
                          selecionado ? "bg-blue-600" : "bg-slate-400"
                        )}>
                          {selecionado ? <Check className="w-5 h-5" /> : nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium text-slate-900 truncate">{nome}</p>
                          <p className="text-sm text-slate-500 truncate">{contato.telefone}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : tipoDestinatario === 'internos' ? (
              carregandoUsuarios ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                </div>
              ) : usuariosInternos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <p className="text-sm">Nenhum usuário encontrado</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {usuariosInternos.map((user) => {
                    const selecionado = usuariosInternosSelecionados.includes(user.id);
                    const nome = user.display_name || user.full_name || user.email;
                    return (
                      <button
                        key={user.id}
                        onClick={() => setUsuariosInternosSelecionados((prev) =>
                          prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                        )}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors",
                          selecionado && "bg-purple-50 hover:bg-purple-100"
                        )}>
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0",
                          selecionado ? "bg-purple-600" : "bg-slate-400"
                        )}>
                          {selecionado ? <Check className="w-5 h-5" /> : nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium text-slate-900 truncate">{nome}</p>
                          <p className="text-xs text-slate-500 truncate">{user.attendant_sector || 'geral'}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : tipoDestinatario === 'setores' ? (
              setoresEncontrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <p className="text-sm">Nenhum setor encontrado</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {setoresEncontrados.map((setor) => {
                    const selecionado = setoresSelecionados.includes(setor);
                    return (
                      <button
                        key={setor}
                        onClick={() => setSetoresSelecionados((prev) =>
                          prev.includes(setor) ? prev.filter((s) => s !== setor) : [...prev, setor]
                        )}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors",
                          selecionado && "bg-orange-50 hover:bg-orange-100"
                        )}>
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0",
                          selecionado ? "bg-orange-600" : "bg-slate-400"
                        )}>
                          {selecionado ? <Check className="w-5 h-5" /> : '🏢'}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-slate-900 capitalize">{setor}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : tipoDestinatario === 'grupos' ? (
              carregandoGrupos ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                </div>
              ) : gruposEncontrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <p className="text-sm">Nenhum grupo encontrado</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {gruposEncontrados.map((grupo) => {
                    const selecionado = gruposSelecionados.includes(grupo.id);
                    return (
                      <button
                        key={grupo.id}
                        onClick={() => setGruposSelecionados((prev) =>
                          prev.includes(grupo.id) ? prev.filter((id) => id !== grupo.id) : [...prev, grupo.id]
                        )}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors",
                          selecionado && "bg-green-50 hover:bg-green-100"
                        )}>
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0",
                          selecionado ? "bg-green-600" : "bg-slate-400"
                        )}>
                          {selecionado ? <Check className="w-5 h-5" /> : grupo.group_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium text-slate-900 truncate">{grupo.group_name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : null}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleFechar}>
            Cancelar
          </Button>
          <Button
            onClick={handleEncaminhar}
            disabled={
              (tipoDestinatario === 'contatos' && contatosSelecionados.length === 0) ||
              (tipoDestinatario === 'internos' && usuariosInternosSelecionados.length === 0) ||
              (tipoDestinatario === 'setores' && setoresSelecionados.length === 0) ||
              (tipoDestinatario === 'grupos' && gruposSelecionados.length === 0) ||
              encaminhando
            }
            className="bg-blue-600 hover:bg-blue-700">
            {encaminhando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Encaminhando...
              </>
            ) : (
              <>
                Encaminhar
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}