import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Sparkles, 
  Loader2, 
  Users, 
  Clock, 
  MessageSquare, 
  Gift,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Eye,
  Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function ModalEnvioPromocoesAutomaticas({ 
  isOpen, 
  onClose, 
  contatosSelecionados, 
  onEnvioCompleto 
}) {
  const [enviando, setEnviando] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');
  
  // ✅ Configurações editáveis
  const [textoSaudacao, setTextoSaudacao] = useState('Olá {{nome}}! Tudo bem? 😊');
  const [delayMinutos, setDelayMinutos] = useState(5);
  const [promocaoAtiva, setPromocaoAtiva] = useState(null);
  const [carregandoPromocao, setCarregandoPromocao] = useState(false);
  
  // ✅ Seleção de instância
  const [instancias, setInstancias] = useState([]);
  const [carregandoInstancias, setCarregandoInstancias] = useState(false);
  const [instanciaSelected, setInstanciaSelected] = useState('');

  // ✅ Carregar promoção ativa e instâncias ao abrir
  useEffect(() => {
    if (isOpen) {
      carregarPromocaoAtiva();
      carregarInstancias();
    }
  }, [isOpen]);

  const carregarInstancias = async () => {
    setCarregandoInstancias(true);
    try {
      const insts = await base44.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      setInstancias(insts);
      if (insts.length > 0) {
        setInstanciaSelected(insts[0].id);
      }
    } catch (error) {
      console.error('[ModalPromoAuto] Erro ao carregar instâncias:', error);
      toast.error('Erro ao carregar instâncias WhatsApp');
    } finally {
      setCarregandoInstancias(false);
    }
  };

  const carregarPromocaoAtiva = async () => {
    setCarregandoPromocao(true);
    try {
      // ✅ Tentar com restrição de data/status primeiro
      let promocoes = await base44.entities.Promotion.filter({
        is_active: true
      }, '-priority', 50);

      // ✅ Filtrar apenas promoções que não expiraram (se tiverem expires_at)
      const agora = new Date();
      promocoes = promocoes.filter(p => 
        !p.expires_at || new Date(p.expires_at) > agora
      );

      // ✅ Se não encontrou com is_active, busca qualquer promoção válida
      if (promocoes.length === 0) {
        console.log('[ModalPromoAuto] Nenhuma com is_active, buscando todas...');
        const todasPromocoes = await base44.entities.Promotion.list('-priority', 50);
        promocoes = todasPromocoes.filter(p => 
          !p.expires_at || new Date(p.expires_at) > agora
        );
      }

      if (promocoes.length > 0) {
        setPromocaoAtiva(promocoes[0]);
        console.log(`[ModalPromoAuto] ✅ Promoção carregada: ${promocoes[0].titulo}`);
      } else {
        console.warn('[ModalPromoAuto] ⚠️ Nenhuma promoção encontrada no banco');
        toast.warning('⚠️ Nenhuma promoção ativa encontrada. Crie uma promoção antes de enviar.');
      }
    } catch (error) {
      console.error('[ModalPromoAuto] Erro ao carregar promoção:', error);
      toast.error(`Erro ao carregar: ${error.message}`);
    } finally {
      setCarregandoPromocao(false);
    }
  };

  const handleEnviar = async () => {
    if (!promocaoAtiva) {
      toast.error('Nenhuma promoção ativa disponível');
      return;
    }

    if (delayMinutos < 1 || delayMinutos > 60) {
      toast.error('Delay deve ser entre 1 e 60 minutos');
      return;
    }

    const confirmacao = window.confirm(
      `🚀 Confirmar envio para ${contatosSelecionados.length} contatos?\n\n` +
      `Não será possível cancelar após iniciar.`
    );

    if (!confirmacao) return;

    setEnviando(true);

    try {
      const contactIds = contatosSelecionados.map(c => c.contact_id || c.id);

      toast.loading(
        `📤 Enviando saudações para ${contactIds.length} contatos...`, 
        { id: 'envio-promo-auto' }
      );

      const resultado = await base44.functions.invoke('enviarCampanhaLote', {
        contact_ids: contactIds,
        modo: 'promocao',
        delay_minutos: delayMinutos,
        texto_saudacao_custom: textoSaudacao !== 'Olá {{nome}}! Tudo bem? 😊' ? textoSaudacao : null,
        integration_id: instanciaSelected
      });

      if (resultado.data?.success) {
        toast.success(
          `✅ ${resultado.data.enviados} saudações enviadas!\n` +
          `⏰ Promoções serão enviadas em ${delayMinutos} minuto(s)`,
          { id: 'envio-promo-auto', duration: 5000 }
        );

        if (resultado.data.erros > 0) {
          toast.warning(
            `⚠️ ${resultado.data.erros} contatos com erro ou bloqueados`,
            { duration: 4000 }
          );
        }

        onClose();
        if (onEnvioCompleto) onEnvioCompleto();
      } else {
        throw new Error(resultado.data?.error || 'Erro ao enviar');
      }

    } catch (error) {
      console.error('[ModalPromoAuto] Erro:', error);
      toast.error(`❌ ${error.message}`, { id: 'envio-promo-auto' });
    } finally {
      setEnviando(false);
    }
  };

  const previewSaudacao = (contato) => {
    return textoSaudacao
      .replace(/\{\{nome\}\}/gi, contato.nome || 'Cliente')
      .replace(/\{\{empresa\}\}/gi, contato.empresa || '');
  };

  const tempoEstimadoSaudacoes = Math.ceil(contatosSelecionados.length * 0.8);
  const tempoEstimadoTotal = tempoEstimadoSaudacoes + delayMinutos * 60;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Envio de Promoções Automáticas</h2>
              <p className="text-sm text-slate-500 font-normal">
                Saudação + Promoção inteligente para {contatosSelecionados.length} contatos
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="configuracao" className="gap-2">
              <Settings className="w-4 h-4" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="contatos" className="gap-2">
              <Users className="w-4 h-4" />
              Contatos ({contatosSelecionados.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB: PREVIEW DO PROCESSO */}
          <TabsContent value="preview" className="flex-1 overflow-y-auto space-y-4 mt-4">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Processo de Envio
              </h3>
              
              <div className="space-y-3">
                {/* Etapa 1 */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold shadow-md flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">Saudação Personalizada (Agora)</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Envio imediato para {contatosSelecionados.length} contatos
                    </p>
                    <div className="mt-2 p-2 bg-white border border-purple-200 rounded text-sm">
                      <span className="text-purple-700 font-medium">Preview: </span>
                      {contatosSelecionados.length > 0 && previewSaudacao(contatosSelecionados[0])}
                    </div>
                  </div>
                </div>

                {/* Etapa 2 */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold shadow-md flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">Aguardar Resposta</p>
                    <p className="text-sm text-slate-600 mt-1">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Delay de {delayMinutos} minuto(s)
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      💡 Se o cliente responder durante este período, a promoção será cancelada
                    </p>
                  </div>
                </div>

                {/* Etapa 3 */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold shadow-md flex-shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">Enviar Promoção Ativa</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Apenas para contatos que NÃO responderam
                    </p>
                    {promocaoAtiva && (
                      <div className="mt-2 p-3 bg-white border border-green-200 rounded">
                        <p className="font-bold text-green-800 mb-1">
                          🎁 {promocaoAtiva.titulo}
                        </p>
                        <p className="text-sm text-slate-700">
                          {promocaoAtiva.descricao}
                        </p>
                        {promocaoAtiva.preco_original && promocaoAtiva.preco_promocional && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs line-through text-slate-400">
                              R$ {promocaoAtiva.preco_original}
                            </span>
                            <span className="font-bold text-green-600">
                              R$ {promocaoAtiva.preco_promocional}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bloqueios e Estimativas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-bold text-orange-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Bloqueios Automáticos
                </h4>
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>• Fornecedores</li>
                  <li>• Tags bloqueadas</li>
                  <li>• Setor financeiro/cobrança</li>
                  <li>• Contatos sem opt-in</li>
                  <li>• Bloqueados manualmente</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Tempo Estimado
                </h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <p>
                    <span className="font-semibold">Saudações:</span> ~{tempoEstimadoSaudacoes}s
                  </p>
                  <p>
                    <span className="font-semibold">Delay:</span> {delayMinutos} min
                  </p>
                  <p>
                    <span className="font-semibold">Promoções:</span> ~{Math.ceil(contatosSelecionados.length * 0.8)}s
                  </p>
                  <div className="pt-2 border-t border-blue-200">
                    <span className="font-bold">Total:</span> ~{Math.floor(tempoEstimadoTotal / 60)} min
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB: CONFIGURAÇÃO */}
          <TabsContent value="configuracao" className="flex-1 overflow-y-auto space-y-4 mt-4">
            {/* Seleção de Instância */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Instância WhatsApp
              </Label>
              <Select value={instanciaSelected} onValueChange={setInstanciaSelected}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar instância..." />
                </SelectTrigger>
                <SelectContent>
                  {instancias.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>
                      <div className="flex items-center gap-2">
                        <Badge variant={inst.status === 'conectado' ? 'default' : 'outline'} className="text-xs">
                          {inst.status === 'conectado' ? '🟢' : '🔴'}
                        </Badge>
                        {inst.nome_instancia} ({inst.numero_telefone})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                📱 Escolha qual instância WhatsApp será usada para enviar as mensagens
              </p>
            </div>

            {/* Texto da Saudação */}
            <div className="space-y-2">
              <Label htmlFor="saudacao">Texto da Saudação Personalizada</Label>
              <Textarea
                id="saudacao"
                value={textoSaudacao}
                onChange={(e) => setTextoSaudacao(e.target.value)}
                placeholder="Olá {{nome}}! Tudo bem?"
                rows={3}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  💡 Use <code className="bg-slate-100 px-1 rounded">{'{{nome}}'}</code> e <code className="bg-slate-100 px-1 rounded">{'{{empresa}}'}</code>
                </p>
                <p className="text-xs text-slate-600">
                  {textoSaudacao.length} caracteres
                </p>
              </div>
            </div>

            {/* Preview da saudação */}
            {contatosSelecionados.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs font-semibold text-green-800 mb-1">
                  📝 Preview da saudação (primeiro contato):
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {previewSaudacao(contatosSelecionados[0])}
                </p>
              </div>
            )}

            {/* Delay entre saudação e promoção */}
            <div className="space-y-2">
              <Label htmlFor="delay">Tempo de Espera (minutos)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="delay"
                  type="number"
                  min="1"
                  max="60"
                  value={delayMinutos}
                  onChange={(e) => setDelayMinutos(parseInt(e.target.value) || 5)}
                  className="w-24"
                />
                <span className="text-sm text-slate-600">minutos entre saudação e promoção</span>
              </div>
              <p className="text-xs text-slate-500">
                ⏰ Aguarda resposta do cliente. Se responder, promoção é cancelada automaticamente.
              </p>
            </div>

            {/* Promoção que será enviada */}
            <div className="space-y-2">
              <Label>Promoção que Será Enviada</Label>
              {carregandoPromocao ? (
                <div className="p-4 bg-slate-50 border rounded-lg flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" />
                  <span className="text-sm text-slate-600">Carregando promoções...</span>
                </div>
              ) : promocaoAtiva ? (
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-green-800 text-lg">
                        🎁 {promocaoAtiva.titulo}
                      </p>
                      <Badge className="bg-green-600 text-white mt-1">
                        Ativa até {new Date(promocaoAtiva.expires_at).toLocaleDateString()}
                      </Badge>
                    </div>
                    {promocaoAtiva.image_url && (
                      <img 
                        src={promocaoAtiva.image_url} 
                        alt={promocaoAtiva.titulo}
                        className="w-16 h-16 object-cover rounded-lg border border-green-300"
                      />
                    )}
                  </div>
                  <p className="text-sm text-slate-700 mb-2">
                    {promocaoAtiva.descricao}
                  </p>
                  {promocaoAtiva.preco_original && promocaoAtiva.preco_promocional && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm line-through text-slate-400">
                        R$ {promocaoAtiva.preco_original}
                      </span>
                      <span className="text-xl font-bold text-green-600">
                        R$ {promocaoAtiva.preco_promocional}
                      </span>
                      <Badge variant="outline" className="border-green-600 text-green-700">
                        {Math.round((1 - promocaoAtiva.preco_promocional / promocaoAtiva.preco_original) * 100)}% OFF
                      </Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Nenhuma promoção ativa encontrada
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={carregarPromocaoAtiva}
                    className="mt-2 text-xs"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Recarregar
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB: LISTA DE CONTATOS */}
          <TabsContent value="contatos" className="flex-1 overflow-y-auto mt-4">
            <div className="space-y-2">
              {contatosSelecionados.map((contato, idx) => (
                <div 
                  key={contato.contact_id || contato.id || idx}
                  className="p-3 bg-white border border-slate-200 rounded-lg hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">
                        {contato.empresa || contato.nome}
                      </p>
                      <p className="text-sm text-slate-500">
                        {contato.nome} {contato.cargo && `• ${contato.cargo}`}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        📱 {contato.telefone}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{idx + 1}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-slate-600">
              <CheckCircle2 className="w-4 h-4 inline text-green-600 mr-1" />
              <span className="font-medium">{contatosSelecionados.length}</span> contatos selecionados
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={enviando}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEnviar}
                disabled={enviando || !promocaoAtiva || contatosSelecionados.length === 0}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Enviar para {contatosSelecionados.length}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}