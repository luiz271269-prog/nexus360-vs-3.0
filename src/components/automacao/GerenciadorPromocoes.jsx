import React, { useState, useRef } from 'react';
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
import { Plus, Pencil, Trash2, Tag, Calendar, DollarSign, AlertCircle, Image, X, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function GerenciadorPromocoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    short_description: '',
    price_info: '',
    active: true,
    valid_until: '',
    priority: 10,
    link_produto: '',
    codigo_campanha: '',
    categoria: 'geral',
    imagem_url: '',
    tipo_midia: 'imagem'
  });

  const queryClient = useQueryClient();

  const { data: promocoes = [], isLoading } = useQuery({
    queryKey: ['promocoes'],
    queryFn: () => base44.entities.Promotion.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Promotion.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promocoes'] });
      toast.success('Promoção criada com sucesso!');
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao criar promoção: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Promotion.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promocoes'] });
      toast.success('Promoção atualizada!');
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
      toast.success('Promoção removida!');
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      short_description: '',
      price_info: '',
      active: true,
      valid_until: '',
      priority: 10,
      link_produto: '',
      codigo_campanha: '',
      categoria: 'geral',
      imagem_url: '',
      tipo_midia: 'imagem'
    });
    setEditingPromo(null);
    setDialogOpen(false);
  };

  const handleEdit = (promo) => {
    setEditingPromo(promo);
    setFormData({
      title: promo.title || '',
      short_description: promo.short_description || '',
      price_info: promo.price_info || '',
      active: promo.active !== false,
      valid_until: promo.valid_until || '',
      priority: promo.priority || 10,
      link_produto: promo.link_produto || '',
      codigo_campanha: promo.codigo_campanha || '',
      categoria: promo.categoria || 'geral',
      imagem_url: promo.imagem_url || '',
      tipo_midia: promo.tipo_midia || 'imagem'
    });
    setDialogOpen(true);
  };

  const handleFileSelect = async (file) => {
    if (!file) return;
    
    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, imagem_url: result.file_url, tipo_midia: 'imagem' });
      toast.success('Imagem anexada com sucesso!');
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
    
    if (!formData.title || !formData.short_description) {
      toast.error('Preencha os campos obrigatórios');
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
        active: !promo.active
      });
      queryClient.invalidateQueries({ queryKey: ['promocoes'] });
      toast.success(promo.active ? 'Promoção desativada' : 'Promoção ativada');
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const categoriaLabels = {
    informatica: '💻 Informática',
    escritorio: '🏢 Escritório',
    servicos: '🛠️ Serviços',
    perifericos: '🖱️ Periféricos',
    geral: '📦 Geral'
  };

  const promocoesAtivas = promocoes.filter(p => p.active);
  const promocoesInativas = promocoes.filter(p => !p.active);

  return (
    <div className="space-y-6">
      {/* Header com Estatísticas */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Promoções & Ofertas</h2>
          <p className="text-sm text-slate-600 mt-1">
            Gerencie as promoções que aparecem no pré-atendimento automático
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => { resetForm(); setDialogOpen(true); }}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Promoção
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPromo ? 'Editar Promoção' : 'Nova Promoção'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4" onPaste={handlePaste}>
              <div className="grid grid-cols-2 gap-4">
                {/* Upload de Imagem */}
                <div className="col-span-2">
                  <Label>Imagem do Produto</Label>
                  <div className="mt-2 space-y-3">
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
                          onClick={() => setFormData({ ...formData, imagem_url: '' })}
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
                          {uploading ? 'Enviando...' : 'Clique para escolher ou Cole (Ctrl+V) uma imagem'}
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

                <div className="col-span-2">
                  <Label htmlFor="title">Título da Promoção *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Notebook Dell i5 Gamer"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="short_description">Descrição Curta (para WhatsApp) *</Label>
                  <Textarea
                    id="short_description"
                    value={formData.short_description}
                    onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                    placeholder="Ex: 8GB RAM, SSD 256GB, RTX 3050 - Apenas 5 unidades!"
                    rows={3}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="price_info">Preço/Condição</Label>
                  <Input
                    id="price_info"
                    value={formData.price_info}
                    onChange={(e) => setFormData({ ...formData, price_info: e.target.value })}
                    placeholder="Ex: De R$ 4.000 por R$ 3.500 ou 15% OFF"
                  />
                </div>

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
                      {Object.entries(categoriaLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Prioridade (ordem)</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 10 })}
                    placeholder="10"
                  />
                  <p className="text-xs text-slate-500 mt-1">Menor número = aparece primeiro</p>
                </div>

                <div>
                  <Label htmlFor="valid_until">Válido até</Label>
                  <Input
                    id="valid_until"
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="codigo_campanha">Código/Cupom</Label>
                  <Input
                    id="codigo_campanha"
                    value={formData.codigo_campanha}
                    onChange={(e) => setFormData({ ...formData, codigo_campanha: e.target.value })}
                    placeholder="Ex: NATAL2025"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="link_produto">Link do Produto (opcional)</Label>
                  <Input
                    id="link_produto"
                    value={formData.link_produto}
                    onChange={(e) => setFormData({ ...formData, link_produto: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="col-span-2 flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <Label>Promoção Ativa</Label>
                    <p className="text-xs text-slate-500">Se desligada, não aparece no robô</p>
                  </div>
                  <Switch
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingPromo ? 'Atualizar' : 'Criar'} Promoção
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-4">
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
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Inativas</p>
                <p className="text-2xl font-bold text-slate-400">{promocoesInativas.length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Promoções Ativas */}
      {promocoesAtivas.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">✅ Promoções Ativas</h3>
          <div className="grid gap-4">
            {promocoesAtivas.map((promo) => (
              <Card key={promo.id} className="border-l-4 border-l-green-500">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    {promo.imagem_url && (
                      <img 
                        src={promo.imagem_url} 
                        alt={promo.title}
                        className="w-32 h-32 object-cover rounded-lg border-2 border-slate-200 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-lg">{promo.title}</CardTitle>
                      <CardDescription className="mt-2">
                        {promo.short_description}
                      </CardDescription>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Badge variant="outline">{categoriaLabels[promo.categoria] || promo.categoria}</Badge>
                        {promo.price_info && (
                          <Badge className="bg-green-100 text-green-800">{promo.price_info}</Badge>
                        )}
                        {promo.codigo_campanha && (
                          <Badge className="bg-purple-100 text-purple-800">🎟️ {promo.codigo_campanha}</Badge>
                        )}
                        {promo.valid_until && (
                          <Badge variant="outline" className="text-slate-600">
                            <Calendar className="w-3 h-3 mr-1" />
                            Até {new Date(promo.valid_until).toLocaleDateString('pt-BR')}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-slate-600">
                          Prioridade: {promo.priority}
                        </Badge>
                      </div>
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
                        className="text-orange-600 hover:text-orange-700"
                      >
                        <AlertCircle className="w-4 h-4" />
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

      {/* Lista de Promoções Inativas */}
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
                        alt={promo.title}
                        className="w-32 h-32 object-cover rounded-lg border-2 border-slate-200 flex-shrink-0 opacity-60"
                      />
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-lg text-slate-600">{promo.title}</CardTitle>
                      <CardDescription className="mt-2">
                        {promo.short_description}
                      </CardDescription>
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
                        <Plus className="w-4 h-4" />
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
              Comece criando sua primeira promoção para o pré-atendimento
            </p>
            <Button
              onClick={() => { resetForm(); setDialogOpen(true); }}
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