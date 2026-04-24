import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Loader2, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ModalEnvioMassaPromocao({ open, onClose, promocao }) {
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [contatosDisponiveis, setContatosDisponiveis] = useState([]);
  const [integracoes, setIntegracoes] = useState([]);
  const [integracaoId, setIntegracaoId] = useState('');
  const [selecionados, setSelecionados] = useState(new Set());
  const [filtroTipo, setFiltroTipo] = useState('all');

  useEffect(() => {
    if (!open || !promocao) return;
    (async () => {
      setLoading(true);
      try {
        // Busca contatos que atendem aos filtros da promoção
        const resp = await base44.functions.invoke('buscarContatosLivre', {
          searchTerm: null,
          limit: 2000
        });
        let contatos = resp?.data?.contatos || [];

        // Aplica os filtros da própria promoção
        const targetTypes = (promocao.target_contact_types || []).map(t => String(t).toLowerCase());
        if (targetTypes.length > 0) {
          contatos = contatos.filter(c => targetTypes.includes(String(c.tipo_contato || '').toLowerCase()));
        }

        // Descarta contatos sem telefone, bloqueados ou opt-out
        contatos = contatos.filter(c =>
          c.telefone &&
          !c.bloqueado &&
          c.whatsapp_optin !== false &&
          !((c.tags || []).includes('opt_out'))
        );

        setContatosDisponiveis(contatos);

        const ints = await base44.entities.WhatsAppIntegration.filter({ status: 'conectado' });
        setIntegracoes(ints);
        if (ints.length > 0) setIntegracaoId(ints[0].id);
      } catch (e) {
        toast.error('Erro ao carregar contatos: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, promocao]);

  const contatosFiltrados = contatosDisponiveis.filter(c => {
    if (filtroTipo === 'all') return true;
    return String(c.tipo_contato || '').toLowerCase() === filtroTipo;
  });

  const toggleTodos = () => {
    if (selecionados.size === contatosFiltrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(contatosFiltrados.map(c => c.id)));
    }
  };

  const toggleContato = (id) => {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setSelecionados(novo);
  };

  const enviar = async () => {
    if (selecionados.size === 0) {
      toast.error('Selecione ao menos 1 contato');
      return;
    }
    if (!integracaoId) {
      toast.error('Selecione uma integração WhatsApp');
      return;
    }

    setEnviando(true);
    try {
      const resp = await base44.functions.invoke('enviarPromocaoEmMassa', {
        promotion_id: promocao.id,
        contact_ids: Array.from(selecionados),
        integration_id: integracaoId
      });

      if (resp?.data?.success) {
        toast.success(`✅ ${resp.data.enfileirados} envios agendados! Tier: ${resp.data.tier_aplicado} • ${resp.data.janela_minutos}min`);
        if (resp.data.excedentes > 0) {
          toast.warning(`⚠️ ${resp.data.excedentes} contatos excederam o limite diário e não foram enfileirados`);
        }
        onClose();
      } else {
        toast.error(`❌ ${resp?.data?.error || 'Erro ao enviar'}`);
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (!promocao) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-orange-600" />
            Envio em Massa: {promocao.titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 p-1">
          {/* Info da promoção */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3 flex gap-3">
            {promocao.imagem_url && (
              <img src={promocao.imagem_url} alt="" className="w-16 h-16 object-cover rounded-md" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900">{promocao.titulo}</p>
              <p className="text-xs text-slate-600 truncate">{promocao.descricao_curta || promocao.descricao}</p>
              {promocao.price_info && (
                <Badge className="mt-1 bg-green-100 text-green-800">{promocao.price_info}</Badge>
              )}
            </div>
          </div>

          {/* Aviso de proteções */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
              <div>
                <strong>Proteções ativas:</strong> horário comercial • limite diário por tier de integração •
                delays humanizados • pausa automática em 429/403 • opt-out automático.
                Contatos com tag <code className="bg-blue-100 px-1 rounded">opt_out</code> já foram filtrados.
              </div>
            </div>
          </div>

          {/* Filtros e integração */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Integração WhatsApp</Label>
              <Select value={integracaoId} onValueChange={setIntegracaoId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {integracoes.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nome_instancia} • {i.numero_telefone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Filtrar por tipo</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="lead">Leads</SelectItem>
                  <SelectItem value="cliente">Clientes</SelectItem>
                  <SelectItem value="eventual">Eventuais</SelectItem>
                  <SelectItem value="novo">Novos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lista de contatos */}
          <div className="border rounded-lg">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selecionados.size === contatosFiltrados.length && contatosFiltrados.length > 0}
                  onCheckedChange={toggleTodos}
                />
                <span className="text-xs font-semibold">
                  {selecionados.size} / {contatosFiltrados.length} selecionados
                </span>
              </div>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                </div>
              ) : contatosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-amber-500" />
                  Nenhum contato elegível encontrado
                </div>
              ) : (
                contatosFiltrados.map(c => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-0 hover:bg-slate-50">
                    <Checkbox
                      checked={selecionados.has(c.id)}
                      onCheckedChange={() => toggleContato(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.nome}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {c.telefone} {c.empresa && `• ${c.empresa}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {c.tipo_contato || 'novo'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button
            onClick={enviar}
            disabled={enviando || selecionados.size === 0}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
          >
            {enviando ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enfileirando...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Enviar para {selecionados.size} contato(s)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}