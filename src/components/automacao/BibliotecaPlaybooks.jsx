import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Download, 
  Star, 
  Search,
  Zap,
  MessageSquare,
  DollarSign,
  Users,
  BarChart3,
  Target
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Biblioteca de Playbooks Prontos para Uso
 * Templates pré-configurados que podem ser instalados com 1 clique
 */
export default function BibliotecaPlaybooks({ onInstalar }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('all');
  const queryClient = useQueryClient();

  const { data: biblioteca = [], isLoading } = useQuery({
    queryKey: ['playbook-marketplace'],
    queryFn: () => base44.entities.PlaybookMarketplace.list('-total_instalacoes'),
    initialData: []
  });

  const instalarMutation = useMutation({
    mutationFn: async (playbookMarketplace) => {
      const response = await base44.functions.invoke('playbookMarketplace', {
        action: 'install_playbook',
        playbook_id: playbookMarketplace.id
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['playbooks']);
      queryClient.invalidateQueries(['playbook-marketplace']);
      toast.success(`✅ Playbook "${data.nome}" instalado com sucesso!`);
      if (onInstalar) onInstalar(data.flow_template_id);
    },
    onError: (error) => {
      toast.error(`Erro ao instalar: ${error.message}`);
    }
  });

  const bibliotecaFiltrada = biblioteca.filter(pb => {
    const matchSearch = !searchTerm || 
      pb.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pb.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchCategoria = categoriaFiltro === 'all' || pb.categoria === categoriaFiltro;
    
    return matchSearch && matchCategoria && pb.ativo;
  });

  const categorias = [
    { value: 'all', label: 'Todos', icon: BarChart3, color: 'slate' },
    { value: 'vendas', label: 'Vendas', icon: DollarSign, color: 'green' },
    { value: 'suporte', label: 'Suporte', icon: MessageSquare, color: 'blue' },
    { value: 'pos_venda', label: 'Pós-venda', icon: Star, color: 'amber' },
    { value: 'cobranca', label: 'Cobrança', icon: Target, color: 'red' },
    { value: 'qualificacao', label: 'Qualificação', icon: Users, color: 'purple' },
    { value: 'onboarding', label: 'Onboarding', icon: Zap, color: 'indigo' }
  ];

  const getIconForCategoria = (categoria) => {
    const cat = categorias.find(c => c.value === categoria);
    return cat ? cat.icon : MessageSquare;
  };

  const getColorForCategoria = (categoria) => {
    const cat = categorias.find(c => c.value === categoria);
    return cat ? cat.color : 'slate';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header e Busca */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">📚 Biblioteca de Playbooks</h2>
          <p className="text-slate-600 mt-1">Templates prontos para instalar e usar</p>
        </div>
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar playbooks..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Filtros por Categoria */}
      <div className="flex gap-2 flex-wrap">
        {categorias.map(cat => {
          const Icon = cat.icon;
          const isActive = categoriaFiltro === cat.value;
          return (
            <Button
              key={cat.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoriaFiltro(cat.value)}
              className={isActive ? `bg-${cat.color}-600 hover:bg-${cat.color}-700` : ''}
            >
              <Icon className="w-4 h-4 mr-1" />
              {cat.label}
              {cat.value !== 'all' && (
                <Badge variant="secondary" className="ml-2">
                  {biblioteca.filter(p => p.categoria === cat.value && p.ativo).length}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Grid de Playbooks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bibliotecaFiltrada.map(playbook => {
          const Icon = getIconForCategoria(playbook.categoria);
          const color = getColorForCategoria(playbook.categoria);
          
          return (
            <Card 
              key={playbook.id} 
              className={`hover:shadow-xl transition-all border-2 ${
                playbook.destaque ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50' : 'border-slate-200'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 bg-${color}-100 rounded-xl flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 text-${color}-600`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{playbook.nome}</CardTitle>
                      <Badge className={`bg-${color}-100 text-${color}-700 mt-1`}>
                        {playbook.categoria}
                      </Badge>
                    </div>
                  </div>
                  {playbook.destaque && (
                    <Badge className="bg-amber-500 text-white">
                      <Star className="w-3 h-3 mr-1" />
                      Destaque
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600 line-clamp-3">
                  {playbook.descricao}
                </p>

                {/* Preview dos Steps */}
                {playbook.preview_steps && playbook.preview_steps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Fluxo:</p>
                    <div className="space-y-1">
                      {playbook.preview_steps.slice(0, 4).map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                          <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold">
                            {idx + 1}
                          </div>
                          <span>{step}</span>
                        </div>
                      ))}
                      {playbook.preview_steps.length > 4 && (
                        <p className="text-xs text-slate-400 pl-7">
                          + {playbook.preview_steps.length - 4} passos
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Download className="w-3 h-3 text-slate-500" />
                      <span className="text-xs text-slate-500">Instalações</span>
                    </div>
                    <p className="text-lg font-bold text-slate-800">
                      {playbook.total_instalacoes || 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Star className="w-3 h-3 text-amber-500" />
                      <span className="text-xs text-slate-500">Avaliação</span>
                    </div>
                    <p className="text-lg font-bold text-amber-600">
                      {playbook.avaliacao_media ? playbook.avaliacao_media.toFixed(1) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Benchmark (se disponível) */}
                {playbook.metricas_benchmark && (
                  <div className="bg-blue-50 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-semibold text-blue-900">📊 Benchmark:</p>
                    {playbook.metricas_benchmark.taxa_conversao_media && (
                      <p className="text-blue-700">
                        Taxa de Conversão: <strong>{playbook.metricas_benchmark.taxa_conversao_media}%</strong>
                      </p>
                    )}
                    {playbook.metricas_benchmark.tempo_medio_conclusao && (
                      <p className="text-blue-700">
                        Tempo Médio: <strong>{Math.round(playbook.metricas_benchmark.tempo_medio_conclusao)} min</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Botão de Instalação */}
                <Button
                  onClick={() => instalarMutation.mutate(playbook)}
                  disabled={instalarMutation.isLoading}
                  className={`w-full bg-${color}-600 hover:bg-${color}-700`}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {instalarMutation.isLoading ? 'Instalando...' : 'Instalar Playbook'}
                </Button>

                {/* Tags Recomendadas */}
                {playbook.tags_recomendadas && playbook.tags_recomendadas.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Tags recomendadas:</p>
                    <div className="flex flex-wrap gap-1">
                      {playbook.tags_recomendadas.slice(0, 3).map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {bibliotecaFiltrada.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-lg font-semibold text-slate-700">
              Nenhum playbook encontrado
            </p>
            <p className="text-slate-500 mt-2">
              Tente ajustar os filtros ou o termo de busca
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}