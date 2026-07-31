import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Forward, Search, Loader2, ArrowRight, Check, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import InternalMessageComposer from './InternalMessageComposer';
import { encaminharParaContatos, encaminharParaThreadsInternas } from './encaminharMensagemService';

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Dialog único de encaminhamento de mensagem.
 * - Aba "Contatos": busca de contatos externos (WhatsApp).
 * - Aba "Internos": abre o InternalMessageComposer (TELA PADRÃO ÚNICA de
 *   destinatários internos — usuários / setores / grupos).
 */
export default function EncaminharMensagemDialog({
  open,
  onClose,
  message,
  thread = null,
  integracoes = [],
  usuarioAtual = null,
  atendentes = [],
  onSucesso
}) {
  const [busca, setBusca] = React.useState('');
  const [selecionados, setSelecionados] = React.useState([]);
  const [enviando, setEnviando] = React.useState(false);
  const [composerAberto, setComposerAberto] = React.useState(false);

  React.useEffect(() => {
    if (!open) { setBusca(''); setSelecionados([]); }
  }, [open]);

  const { data: contatos = [], isLoading: carregandoContatos } = useQuery({
    queryKey: ['contatos-encaminhar', busca],
    queryFn: async () => {
      const termo = normalizar(busca);
      const termoNumeros = busca.replace(/\D/g, '');
      const todos = await base44.entities.Contact.list('-ultima_interacao', 1000);
      return todos.filter((c) => {
        if (!c || c.bloqueado || !c.telefone) return false;
        const telefone = (c.telefone || '').replace(/\D/g, '');
        return normalizar(c.nome).includes(termo) ||
          normalizar(c.empresa).includes(termo) ||
          normalizar(c.cargo).includes(termo) ||
          (termoNumeros.length >= 3 && telefone.includes(termoNumeros));
      }).sort((a, b) => {
        const na = normalizar(a.nome), nb = normalizar(b.nome);
        const sa = na === termo ? 100 : na.startsWith(termo) ? 50 : 10;
        const sb = nb === termo ? 100 : nb.startsWith(termo) ? 50 : 10;
        return sb - sa;
      });
    },
    enabled: open && busca.trim().length >= 2,
    staleTime: 30000
  });

  const toggle = (id) => {
    setSelecionados((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleEnviarContatos = async () => {
    if (selecionados.length === 0) { toast.error('Selecione pelo menos um contato'); return; }
    setEnviando(true);
    try {
      const resultado = await encaminharParaContatos({
        message,
        thread,
        integracoes,
        usuarioAtual,
        contatos: selecionados.map((id) => contatos.find((c) => c.id === id)).filter(Boolean)
      });
      onClose();
      setSelecionados([]);
      setBusca('');
      setTimeout(() => {
        if (resultado.enfileirados > 0) {
          toast.success(`📥 ${resultado.enfileirados} encaminhamento(s) enfileirado(s) — serão enviados respeitando horário comercial e delay anti-spam.`, { duration: 6000 });
        }
        if (resultado.sucessos > 0) toast.success(`✅ Mensagem encaminhada para ${resultado.sucessos} contato(s)!`);
        if (resultado.erros > 0) toast.error(`❌ ${resultado.erros} encaminhamento(s) falharam`);
      }, 0);
      onSucesso?.();
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setEnviando(false);
    }
  };

  const handleDestinosInternos = async (payload) => {
    const threadIds = payload?.mode === 'single'
      ? [payload.thread?.id].filter(Boolean)
      : (payload?.destinations || []).map((d) => d.thread_id).filter(Boolean);

    setComposerAberto(false);
    if (threadIds.length === 0) { toast.error('Nenhum destinatário interno resolvido'); return; }

    setEnviando(true);
    try {
      const { sucessos, erros, falhas = [] } = await encaminharParaThreadsInternas({ message, threadIds });
      onClose();
      setTimeout(() => {
        if (sucessos > 0) toast.success(`✅ Encaminhada para ${sucessos} de ${threadIds.length} destino(s) interno(s)`);
        if (erros > 0) toast.error(`❌ ${erros} falharam: ${falhas.map((f) => f.motivo).join(' | ')}`, { duration: 8000 });
      }, 0);
      onSucesso?.();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v && enviando) return; if (!v) onClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Forward className="w-5 h-5 text-blue-600" />
              Encaminhar Mensagem
            </DialogTitle>
            <DialogDescription>
              Escolha o tipo de destinatário e selecione quem deve receber
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
              <div className="flex-1 px-4 py-2 rounded-md font-medium text-sm bg-white text-blue-600 shadow-sm">
                <div className="flex items-center justify-center gap-2"><User className="w-4 h-4" />Contatos</div>
              </div>
              <button
                onClick={() => setComposerAberto(true)}
                className="flex-1 px-4 py-2 rounded-md font-medium text-sm text-slate-600 hover:text-purple-700 hover:bg-white/60 transition-all">
                <div className="flex items-center justify-center gap-2"><Users className="w-4 h-4" />Internos</div>
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar contato..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10" />
            </div>

            {selecionados.length > 0 &&
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-blue-50 border-blue-200">
                {selecionados.map((id) => {
                  const c = contatos.find((x) => x.id === id);
                  if (!c) return null;
                  return (
                    <Badge key={id} variant="secondary" className="bg-blue-100 text-blue-800 gap-1">
                      {c.nome || c.telefone}
                      <button onClick={(e) => { e.stopPropagation(); toggle(id); }} className="ml-1 hover:bg-white/50 rounded-full p-0.5">×</button>
                    </Badge>);
                })}
              </div>
            }

            <ScrollArea className="h-64 border rounded-lg">
              {busca.trim().length < 2 ?
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Search className="w-12 h-12 mb-3 text-slate-300" />
                  <p className="text-sm font-medium">Digite para buscar</p>
                  <p className="text-xs text-slate-400 mt-1">Mínimo 2 caracteres</p>
                </div> :
                carregandoContatos ?
                <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> :
                contatos.length === 0 ?
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <p className="text-sm">Nenhum contato encontrado</p>
                </div> :
                <div className="p-2">
                  {contatos.map((contato) => {
                    const sel = selecionados.includes(contato.id);
                    let nome = '';
                    if (contato.empresa) nome += contato.empresa;
                    if (contato.cargo) nome += (nome ? ' - ' : '') + contato.cargo;
                    if (contato.nome && contato.nome !== contato.telefone && contato.nome !== '-') {
                      nome += (nome ? ' - ' : '') + contato.nome;
                    }
                    if (!nome.trim()) nome = contato.telefone || 'Sem nome';
                    return (
                      <button key={contato.id} onClick={() => toggle(contato.id)}
                        className={cn('w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors', sel && 'bg-blue-50 hover:bg-blue-100')}>
                        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden', sel ? 'bg-blue-600' : 'bg-slate-400')}>
                          {sel ? <Check className="w-5 h-5" /> :
                            contato.foto_perfil_url && contato.foto_perfil_url !== 'null' ?
                              <img src={contato.foto_perfil_url} alt={nome} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} /> :
                              nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium text-slate-900 truncate">{nome}</p>
                          <p className="text-sm text-slate-500 truncate">{contato.telefone}</p>
                        </div>
                      </button>);
                  })}
                </div>
              }
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleEnviarContatos} disabled={selecionados.length === 0 || enviando} className="bg-blue-600 hover:bg-blue-700">
              {enviando ?
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Encaminhando...</> :
                <>Encaminhar<ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TELA PADRÃO ÚNICA de destinatários internos */}
      <InternalMessageComposer
        open={composerAberto}
        onClose={() => setComposerAberto(false)}
        currentUser={usuarioAtual}
        atendentes={atendentes}
        onSelectDestinations={handleDestinosInternos} />
    </>);
}