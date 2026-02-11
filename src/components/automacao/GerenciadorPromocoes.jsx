import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Pencil, Trash2, Tag, Calendar, DollarSign, AlertCircle,
  Upload, X, TrendingUp, Send, Clock, CheckCircle2, Target, Zap
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIAS = {
  informatica: '💻 Informática',
  escritorio: '🏢 Escritório',
  servicos: '🛠️ Serviços',
  perifericos: '🖱️ Periféricos',
  geral: '📦 Geral'
};

const STAGES = {
  massblast: { label: '📣 Envio em Massa', color: 'bg-purple-100 text-purple-800', desc: 'Envio manual/campanha' },
  '6h': { label: '⏰ 6 Horas', color: 'bg-blue-100 text-blue-800', desc: 'Conversa parada há 6h' },
  '12h': { label: '⏰ 12 Horas', color: 'bg-orange-100 text-orange-800', desc: 'Conversa parada há 12h' },
  '24h': { label: '⏰ 24 Horas', color: 'bg-red-100 text-red-800', desc: 'Conversa parada há 24h (requer template)' }
};

export default function GerenciadorPromocoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    descricao_curta: '',
    price_info: '',
    ativo: true,
    validade: '',
    priority: 10,
    link_produto: '',
    campaign_id: '',
    categoria: 'geral',
    imagem_url: '',
    tipo_midia: 'none',
    stage: '6h',
    formato: 'teaser',
    cooldown_hours: 6,
    target_contact_types: ['lead', 'cliente'],
    target_sectors: ['vendas', 'geral'],
    whatsapp_template_name: '',
    whatsapp_template_vars: []
  });

  const queryClient = useQueryClient();

  const { data: promocoes = [], isLoading } = useQuery({
    queryKey: ['promocoes'],
    queryFn: () => base44.entities.Promotion.list('-priority')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Promotion.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promocoes'] });
      toast.success('✅ Promoção criada com sucesso!');
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao criar: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Promotion.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promocoes'] });
      toast.success('✅ Promoção atualizada!');
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Promotion.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promocoes'] });
      toast.success('✅ Promoção removida!');
    }
  });

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      descricao_curta: '',
      price_info: '',
      ativo: true,
      validade: '',
      priority: 10,
      link_produto: '',
      campaign_id: '',
      categoria: 'geral',
      imagem_url: '',
      tipo_midia: 'none',
      stage: '6h',
      formato: 'teaser',
      cooldown_hours: 6,
      target_contact_types: ['lead', 'cliente'],
      target_sectors: ['vendas', 'geral'],
      whatsapp_template_name: '',
      whatsapp_template_vars: []
    });
    setEditingPromo(null);
    setDialogOpen(false);
  };

  const handleEdit = (promo) => {
    setEditingPromo(promo);
    setFormData({
      titulo: promo.titulo || '',
      descricao: promo.descricao || '',
      descricao_curta: promo.descricao_curta || '',
      price_info: promo.price_info || '',
      ativo: promo.ativo !== false,
      validade: promo.validade || '',
      priority: promo.priority || 10,
      link_produto: promo.link_produto || '',
      campaign_id: promo.campaign_id || '',
      categoria: promo.categoria || 'geral',
      imagem_url: promo.imagem_url || '',
      tipo_midia: promo.tipo_midia || 'none',
      stage: promo.stage || '6h',
      formato: promo.formato || 'teaser',
      cooldown_hours: promo.cooldown_hours || 6,
      target_contact_types: promo.target_contact_types || ['lead', 'cliente'],
      target_sectors: promo.target_sectors || ['vendas', 'geral'],
      whatsapp_template_name: promo.whatsapp_template_name || '',
      whatsapp_template_vars: promo.whatsapp_template_vars || []
    });
    setDialogOpen(true);
  };

  const handleFileSelect = async (file) => {
    if (!file) return;

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({
        ...prev,
        imagem_url: result.file_url,
        tipo_midia: 'image'
      }));
      toast.success('✅ Imagem anexada!');
    } catch (error) {
      toast.error('Erro ao fazer upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await handleFileSelect(file);
        }
        break;
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.titulo || !formData.descricao) {
      toast.error('❌ Preencha título e descrição');
      return;
    }

    // Validação especial para 24h
    if (formData.stage === '24h' && !formData.whatsapp_template_name) {
      toast.error('❌ Promoções de 24h requerem um template aprovado do WhatsApp');
      return;
    }

    if (editingPromo) {
      updateMutation.mutate({ id: editingPromo.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleActive = async (promo) => {
    try {
      await base44.entities.Promotion.update(promo.id, {
        ativo: !promo.ativo
      });
      queryClient.invalidateQueries({ queryKey: ['promocoes'] });
      toast.success(promo.ativo ? '⏸️ Promoção desativada' : '▶️ Promoção ativada');
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const toggleContactType = (type) => {
    setFormData(prev => {
      const current = prev.target_contact_types || [];
      const updated = current.includes(type)
        ? current.filter(t => t !== type)
        : [...current, type];
      return { ...prev, target_contact_types: updated };
    });
  };

  const toggleSector = (sector) => {
    setFormData(prev => {
      const current = prev.target_sectors || [];
      const updated = current.includes(sector)
        ? current.filter(s => s !== sector)
        : [...current, sector];
      return { ...prev, target_sectors: updated };
    });
  };

  const promocoesAtivas = promocoes.filter(p => p.ativo);
  const promocoesInativas = promocoes.filter(p => !p.ativo);

  const totalEnvios = promocoes.reduce((sum, p) => sum + (p.contador_envios || 0), 0);
  const totalRespostas = promocoes.reduce((sum, p) => sum + (p.contador_respostas || 0), 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">🎁 Promoções & Ofertas</h2>
          <p className="text-sm text-slate-600 mt-1">
            Sistema inteligente de recuperação automática (6h / 12h / 24h)
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Promoção
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPromo ? '✏️ Editar Promoção' : '➕ Nova Promoção'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4" onPaste={handlePaste}>
              <div className="grid grid-cols-2 gap-4">
                {/* Upload de Imagem */}
                <div className="col-span-2">
                  <Label>Imagem da Promoção</Label>
                  <div className="mt-2">
                    {formData.imagem_url ? (
                      <div className="relative">
                        <img
                          src={formData.imagem_url}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-lg border-2 border-slate-200"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2"
                          onClick={() => setFormData({ ...formData, imagem_url: '', tipo_midia: 'none' })}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                        <p className="text-sm text-slate-600 mb-1">
                          {uploading ? '⏳ Enviando...' : 'Clique ou Cole (Ctrl+V) uma imagem'}
                        </p>
                        <p className="text-xs text-slate-400">PNG, JPG até 10MB</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                    />
                  </div>
                </div>

                {/* Título */}
                <div className="col-span-2">
                  <Label htmlFor="titulo">Título da Promoção *</Label>
                  <Input
                    id="titulo"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Ex: Notebook Dell i5 Gamer com 15% OFF"
                    required
                  />
                </div>

                {/* Descrição Curta (Teaser) */}
                <div className="col-span-2">
                  <Label htmlFor="descricao_curta">Descrição Curta (Teaser - máx 120 chars)</Label>
                  <Input
                    id="descricao_curta"
                    value={formData.descricao_curta}
                    onChange={(e) => setFormData({ ...formData, descricao_curta: e.target.value })}
                    placeholder="Ex: Notebook Dell i5, 8GB RAM, SSD 256GB - Apenas 5 unidades!"
                    maxLength={120}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {formData.descricao_curta.length}/120 caracteres
                  </p>
                </div>

                {/* Descrição Completa */}
                <div className="col-span-2">
                  <Label htmlFor="descricao">Descrição Completa *</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Use {{nome}} e {{empresa}} para personalizar. Ex: Olá {{nome}}! Temos uma oferta especial..."
                    rows={4}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    💡 Placeholders disponíveis: {`{{nome}}, {{empresa}}`}
                  </p>
                </div>

                {/* Preço/Condição */}
                <div className="col-span-2">
                  <Label htmlFor="price_info">Preço/Condição</Label>
                  <Input
                    id="price_info"
                    value={formData.price_info}
                    onChange={(e) => setFormData({ ...formData, price_info: e.target.value })}
                    placeholder="Ex: De R$ 4.000 por R$ 3.500 ou 15% OFF"
                  />
                </div>

                {/* Estágio (6h/12h/24h) */}
                <div>
                  <Label htmlFor="stage">Estágio de Envio *</Label>
                  <Select
                    value={formData.stage}
                    onValueChange={(value) => setFormData({ ...formData, stage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STAGES).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label} - {config.desc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.stage === '24h' && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      ⚠️ Requer template aprovado do WhatsApp
                    </p>
                  )}
                </div>

                {/* Formato */}
                <div>
                  <Label htmlFor="formato">Formato da Mensagem</Label>
                  <Select
                    value={formData.formato}
                    onValueChange={(value) => setFormData({ ...formData, formato: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teaser">📝 Teaser (curto com 1/2)</SelectItem>
                      <SelectItem value="direct">📄 Direto (mensagem completa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Template WhatsApp (somente para 24h) */}
                {formData.stage === '24h' && (
                  <>
                    <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-amber-900 mb-2">
                        📋 Configuração de Template (Obrigatório para 24h)
                      </h4>
                      <Label htmlFor="whatsapp_template_name">Nome do Template Aprovado *</Label>
                      <Input
                        id="whatsapp_template_name"
                        value={formData.whatsapp_template_name}
                        onChange={(e) => setFormData({ ...formData, whatsapp_template_name: e.target.value })}
                        placeholder="Ex: oferta_especial_v2"
                        required={formData.stage === '24h'}
                      />
                      <p className="text-xs text-amber-700 mt-2">
                        ⚠️ O template deve estar aprovado no Meta Business Manager
                      </p>
                    </div>
                  </>
                )}

                {/* Categoria e Prioridade */}
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIAS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Prioridade (ordem de envio)</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) || 10 })}
                    placeholder="10"
                  />
                  <p className="text-xs text-slate-500 mt-1">Menor número = maior prioridade</p>
                </div>

                {/* Cooldown */}
                <div>
                  <Label htmlFor="cooldown">Cooldown (horas)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    value={formData.cooldown_hours}
                    onChange={(e) => setFormData({ ...formData, cooldown_hours: Number(e.target.value) || 6 })}
                    placeholder="6"
                  />
                  <p className="text-xs text-slate-500 mt-1">Intervalo mínimo entre envios</p>
                </div>

                {/* Validade */}
                <div>
                  <Label htmlFor="validade">Válido até</Label>
                  <Input
                    id="validade"
                    type="date"
                    value={formData.validade}
                    onChange={(e) => setFormData({ ...formData, validade: e.target.value })}
                  />
                </div>

                {/* Link e Campaign ID */}
                <div className="col-span-2">
                  <Label htmlFor="link_produto">Link do Produto</Label>
                  <Input
                    id="link_produto"
                    value={formData.link_produto}
                    onChange={(e) => setFormData({ ...formData, link_produto: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label htmlFor="campaign_id">Código/Cupom</Label>
                  <Input
                    id="campaign_id"
                    value={formData.campaign_id}
                    onChange={(e) => setFormData({ ...formData, campaign_id: e.target.value })}
                    placeholder="Ex: NATAL2025"
                  />
                </div>

                {/* Tipos de Contato Elegíveis */}
                <div className="col-span-2">
                  <Label className="mb-3 block">Tipos de Contato Elegíveis</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['novo', 'lead', 'cliente', 'parceiro'].map(type => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${type}`}
                          checked={formData.target_contact_types.includes(type)}
                          onCheckedChange={() => toggleContactType(type)}
                        />
                        <label htmlFor={`type-${type}`} className="text-sm capitalize">
                          {type}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Setores Elegíveis */}
                <div className="col-span-2">
                  <Label className="mb-3 block">Setores Elegíveis</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {['vendas', 'assistencia', 'financeiro', 'geral'].map(sector => (
                      <div key={sector} className="flex items-center space-x-2">
                        <Checkbox
                          id={`sector-${sector}`}
                          checked={formData.target_sectors.includes(sector)}
                          onCheckedChange={() => toggleSector(sector)}
                        />
                        <label htmlFor={`sector-${sector}`} className="text-sm capitalize">
                          {sector}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Toggle Ativo */}
                <div className="col-span-2 flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                  <div>
                    <Label>Promoção Ativa</Label>
                    <p className="text-xs text-slate-500">Se desligada, não será enviada automaticamente</p>
                  </div>
                  <Switch
                    checked={formData.ativo}
                    onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-gradient-to-r from-orange-500 to-red-500"
                >
                  {editingPromo ? '💾 Salvar' : '➕ Criar'} Promoção
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas Globais */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total de Promoções</p>
                <p className="text-2xl font-bold text-slate-900">{promocoes.length}</p>
              </div>
              <Tag className="w-8 h-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Ativas</p>
                <p className="text-2xl font-bold text-green-600">{promocoesAtivas.length}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Envios Totais</p>
                <p className="text-2xl font-bold text-blue-600">{totalEnvios}</p>
              </div>
              <Send className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Taxa de Resposta</p>
                <p className="text-2xl font-bold text-purple-600">
                  {totalEnvios > 0 ? ((totalRespostas / totalEnvios) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Promoções Ativas */}
      {promocoesAtivas.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">✅ Promoções Ativas</h3>
          <div className="grid gap-4">
            {promocoesAtivas.map((promo) => (
              <Card key={promo.id} className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    {promo.imagem_url && (
                      <img
                        src={promo.imagem_url}
                        alt={promo.titulo}
                        className="w-32 h-32 object-cover rounded-lg border-2 border-slate-200 flex-shrink-0"
                      />
                    )}

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <CardTitle className="text-lg">{promo.titulo}</CardTitle>
                        <Badge className={STAGES[promo.stage]?.color || 'bg-slate-100'}>
                          {STAGES[promo.stage]?.label || promo.stage}
                        </Badge>
                      </div>

                      <CardDescription className="mb-3">
                        {promo.descricao_curta || promo.descricao}
                      </CardDescription>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">
                          {CATEGORIAS[promo.categoria] || promo.categoria}
                        </Badge>

                        {promo.price_info && (
                          <Badge className="bg-green-100 text-green-800">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {promo.price_info}
                          </Badge>
                        )}

                        {promo.campaign_id && (
                          <Badge className="bg-purple-100 text-purple-800">
                            🎟️ {promo.campaign_id}
                          </Badge>
                        )}

                        {promo.validade && (
                          <Badge variant="outline" className="text-slate-600">
                            <Calendar className="w-3 h-3 mr-1" />
                            Até {new Date(promo.validade).toLocaleDateString('pt-BR')}
                          </Badge>
                        )}

                        <Badge variant="outline" className="text-slate-600">
                          <Target className="w-3 h-3 mr-1" />
                          Prioridade: {promo.priority}
                        </Badge>

                        <Badge variant="outline" className="text-slate-600">
                          <Clock className="w-3 h-3 mr-1" />
                          Cooldown: {promo.cooldown_hours}h
                        </Badge>

                        {promo.whatsapp_template_name && (
                          <Badge className="bg-blue-100 text-blue-800">
                            📋 Template: {promo.whatsapp_template_name}
                          </Badge>
                        )}
                      </div>

                      {/* Métricas */}
                      {(promo.contador_envios > 0 || promo.contador_respostas > 0) && (
                        <div className="flex items-center gap-4 mt-3 text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <Send className="w-3 h-3" />
                            {promo.contador_envios || 0} envios
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {promo.contador_respostas || 0} respostas
                          </span>
                          {promo.contador_envios > 0 && (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <Zap className="w-3 h-3" />
                              {((promo.contador_respostas || 0) / promo.contador_envios * 100).toFixed(1)}% taxa
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleEdit(promo)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => toggleActive(promo)}
                        className="text-orange-600 hover:text-orange-700"
                      >
                        <AlertCircle className="w-4 h-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          if (confirm('❌ Remover esta promoção permanentemente?')) {
                            deleteMutation.mutate(promo.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Promoções Inativas */}
      {promocoesInativas.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-500 mb-4">💤 Promoções Inativas</h3>
          <div className="grid gap-4">
            {promocoesInativas.map((promo) => (
              <Card key={promo.id} className="border-l-4 border-l-slate-300 opacity-60">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    {promo.imagem_url && (
                      <img
                        src={promo.imagem_url}
                        alt={promo.titulo}
                        className="w-24 h-24 object-cover rounded-lg border-2 border-slate-200 flex-shrink-0 opacity-60"
                      />
                    )}

                    <div className="flex-1">
                      <CardTitle className="text-lg text-slate-600">{promo.titulo}</CardTitle>
                      <CardDescription className="mt-2">{promo.descricao_curta || promo.descricao}</CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleEdit(promo)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => toggleActive(promo)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          if (confirm('Remover esta promoção?')) {
                            deleteMutation.mutate(promo.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Estado Vazio */}
      {promocoes.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 text-center">
            <Tag className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Nenhuma promoção cadastrada
            </h3>
            <p className="text-slate-600 mb-6">
              Crie promoções automáticas para recuperar conversas paradas
            </p>
            <Button
              onClick={() => {
                resetForm();
                setDialogOpen(true);
              }}
              className="bg-gradient-to-r from-orange-500 to-red-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Promoção
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}