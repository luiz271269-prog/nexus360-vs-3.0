import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tag, Plus, Trash2, TrendingUp, Users, Target } from 'lucide-react';
import { toast } from 'sonner';

/**
 * ⚠️ DEPRECATED: Use GerenciadorEtiquetasUnificado em /components/comunicacao/
 * Este componente mantido para compatibilidade (migrado para EtiquetaContato)
 */
export default function TagManager() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState(null);

  useEffect(() => {
    carregarTags();
  }, []);

  const carregarTags = async () => {
    try {
      // Migrado para EtiquetaContato (unificação de etiquetas)
      const data = await base44.entities.EtiquetaContato.filter({ migrado_de_tag: true }, '-created_date', 100);
      setTags(data);
    } catch (error) {
      console.error('Erro ao carregar etiquetas:', error);
      toast.error('Erro ao carregar etiquetas');
    }
    setLoading(false);
  };

  const handleSalvar = async (tagData) => {
    try {
      if (editingTag) {
        await base44.entities.EtiquetaContato.update(editingTag.id, tagData);
        toast.success('Etiqueta atualizada!');
      } else {
        await base44.entities.EtiquetaContato.create({
          ...tagData,
          migrado_de_tag: false,
          tipo: 'personalizada'
        });
        toast.success('Etiqueta criada!');
      }
      setShowForm(false);
      setEditingTag(null);
      await carregarTags();
    } catch (error) {
      console.error('Erro ao salvar etiqueta:', error);
      toast.error('Erro ao salvar etiqueta');
    }
  };

  const handleExcluir = async (tagId) => {
    if (!confirm('Tem certeza que deseja excluir esta etiqueta?')) return;

    try {
      await base44.entities.EtiquetaContato.delete(tagId);
      toast.success('Etiqueta excluída!');
      await carregarTags();
    } catch (error) {
      console.error('Erro ao excluir etiqueta:', error);
      toast.error('Erro ao excluir etiqueta');
    }
  };

  const handleAnalisarPerformance = async (tagId) => {
    try {
      const tag = tags.find(t => t.id === tagId);
      if (tag && tag.metricas) {
        const { total_contatos, taxa_conversao, valor_medio_venda } = tag.metricas;
        toast.success(
          `📊 ${tag.label}\n` +
          `👥 ${total_contatos} contatos\n` +
          `📈 ${taxa_conversao.toFixed(1)}% conversão\n` +
          `💰 R$ ${valor_medio_venda.toFixed(2)} ticket médio`
        );
      }
    } catch (error) {
      console.error('Erro ao analisar performance:', error);
      toast.error('Erro ao analisar performance');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando tags...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gerenciamento de Tags</h2>
          <p className="text-slate-600">Organize e segmente seus contatos com tags inteligentes</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Tag
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         {tags.map((tag) => (
           <Card key={tag.id} className="hover:shadow-lg transition-shadow">
             <CardHeader>
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <span className="text-xl">{tag.emoji || '🏷️'}</span>
                   <div>
                     <CardTitle className="text-lg">{tag.label}</CardTitle>
                     <p className="text-xs text-slate-500">{tag.nome}</p>
                   </div>
                 </div>
                 <Badge className={tag.ativa ? 'bg-green-500' : 'bg-slate-400'}>
                   {tag.ativa ? 'Ativa' : 'Inativa'}
                 </Badge>
               </div>
             </CardHeader>
             <CardContent>
               <p className="text-sm text-slate-600 mb-4">{tag.descricao}</p>

               <div className="space-y-2 mb-4">
                 <div className="flex items-center justify-between text-sm">
                   <span className="flex items-center gap-1">
                     <Users className="w-4 h-4 text-blue-500" />
                     Contatos
                   </span>
                   <span className="font-semibold">{tag.metricas?.total_contatos || 0}</span>
                 </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    Conversão
                  </span>
                  <span className="font-semibold">{(tag.metricas?.taxa_conversao || 0).toFixed(1)}%</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4 text-purple-500" />
                    Ticket Médio
                  </span>
                  <span className="font-semibold">
                    R$ {(tag.metricas?.valor_medio_venda || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAnalisarPerformance(tag.id)}
                  className="flex-1"
                >
                  Analisar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTag(tag);
                    setShowForm(true);
                  }}
                  className="flex-1"
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExcluir(tag.id)}
                  className="text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm && (
        <TagFormModal
          tag={editingTag}
          onSave={handleSalvar}
          onCancel={() => {
            setShowForm(false);
            setEditingTag(null);
          }}
        />
      )}
    </div>
  );
}

function TagFormModal({ tag, onSave, onCancel }) {
  const [formData, setFormData] = useState(tag || {
    nome: '',
    label: '',
    categoria: 'outro',
    descricao: '',
    cor: 'bg-slate-400',
    emoji: '🏷️',
    ativa: true,
    tipo: 'personalizada',
    automacao_ativa: false,
    regras_automacao: {
      condicoes: []
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{tag ? 'Editar Etiqueta' : 'Nova Etiqueta'}</CardTitle>
          <p className="text-xs text-slate-500 mt-1">📌 Componente unificado (migrado de Tag)</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome de Exibição</label>
              <Input
                value={formData.label}
                onChange={(e) => setFormData({...formData, label: e.target.value})}
                placeholder="ex: Cliente VIP"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nome Normalizado (slug)</label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                placeholder="ex: cliente_vip"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({...formData, categoria: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="destaque">Destaque</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="comportamento">Comportamento</SelectItem>
                  <SelectItem value="prioridade">Prioridade</SelectItem>
                  <SelectItem value="segmentacao">Segmentação</SelectItem>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <Input
                value={formData.descricao}
                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                placeholder="Descreva o propósito desta tag"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Emoji</label>
              <Input
                value={formData.emoji}
                onChange={(e) => setFormData({...formData, emoji: e.target.value})}
                placeholder="🏷️"
                maxLength="2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cor (Tailwind ou Hex)</label>
              <Input
                value={formData.cor}
                onChange={(e) => setFormData({...formData, cor: e.target.value})}
                placeholder="bg-slate-400 ou #3b82f6"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.ativa}
                onChange={(e) => setFormData({...formData, ativa: e.target.checked})}
                id="ativa"
              />
              <label htmlFor="ativa" className="text-sm">Tag ativa</label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit">
                {tag ? 'Atualizar' : 'Criar'} Etiqueta
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}