import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Star, TrendingUp, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function PlaybookMarketplace() {
  const [playbooks, setPlaybooks] = useState([]);
  const [filteredPlaybooks, setFilteredPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    categoria: 'all',
    setor: 'all',
    nivel: 'all',
    busca: ''
  });

  useEffect(() => {
    carregarPlaybooks();
  }, []);

  useEffect(() => {
    aplicarFiltros();
  }, [filtros, playbooks]);

  const carregarPlaybooks = async () => {
    try {
      const data = await base44.entities.PlaybookMarketplace.filter(
        { ativo: true },
        '-total_instalacoes',
        100
      );
      setPlaybooks(data);
      setFilteredPlaybooks(data);
    } catch (error) {
      console.error('Erro ao carregar playbooks:', error);
      toast.error('Erro ao carregar marketplace');
    }
    setLoading(false);
  };

  const aplicarFiltros = () => {
    let resultado = [...playbooks];

    if (filtros.categoria !== 'all') {
      resultado = resultado.filter(p => p.categoria === filtros.categoria);
    }

    if (filtros.setor !== 'all') {
      resultado = resultado.filter(p => p.setor === filtros.setor);
    }

    if (filtros.nivel !== 'all') {
      resultado = resultado.filter(p => p.nivel_dificuldade === filtros.nivel);
    }

    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      resultado = resultado.filter(p => 
        p.nome.toLowerCase().includes(busca) ||
        p.descricao.toLowerCase().includes(busca)
      );
    }

    setFilteredPlaybooks(resultado);
  };

  const handleInstalar = async (playbook) => {
    try {
      const response = await base44.functions.invoke('playbookMarketplace', {
        action: 'install_playbook',
        playbook_id: playbook.id
      });

      if (response.data.success) {
        toast.success(`✅ Playbook "${playbook.nome}" instalado com sucesso!`);
        await carregarPlaybooks();
      }
    } catch (error) {
      console.error('Erro ao instalar playbook:', error);
      toast.error('Erro ao instalar playbook');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando marketplace...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Playbook Marketplace</h2>
        <p className="text-slate-600">Instale playbooks prontos e testados para acelerar sua automação</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={filtros.busca}
                  onChange={(e) => setFiltros({...filtros, busca: e.target.value})}
                  placeholder="Pesquisar playbooks..."
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <Select
                value={filtros.categoria}
                onValueChange={(value) => setFiltros({...filtros, categoria: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="vendas">Vendas</SelectItem>
                  <SelectItem value="suporte">Suporte</SelectItem>
                  <SelectItem value="pos_venda">Pós-venda</SelectItem>
                  <SelectItem value="cobranca">Cobrança</SelectItem>
                  <SelectItem value="qualificacao">Qualificação</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="reativacao">Reativação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Setor</label>
              <Select
                value={filtros.setor}
                onValueChange={(value) => setFiltros({...filtros, setor: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="todos">Genérico</SelectItem>
                  <SelectItem value="ecommerce">E-commerce</SelectItem>
                  <SelectItem value="saas">SaaS</SelectItem>
                  <SelectItem value="servicos">Serviços</SelectItem>
                  <SelectItem value="varejo">Varejo</SelectItem>
                  <SelectItem value="b2b">B2B</SelectItem>
                  <SelectItem value="b2c">B2C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nível</label>
              <Select
                value={filtros.nivel}
                onValueChange={(value) => setFiltros({...filtros, nivel: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Playbooks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlaybooks.map((playbook) => (
          <Card key={playbook.id} className={`hover:shadow-xl transition-shadow ${playbook.destaque ? 'border-2 border-amber-400' : ''}`}>
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-1">{playbook.nome}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-blue-500">{playbook.categoria}</Badge>
                    <Badge variant="outline">{playbook.setor}</Badge>
                    {playbook.destaque && (
                      <Badge className="bg-amber-500">⭐ Destaque</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                {playbook.descricao}
              </p>

              {/* Preview dos Steps */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Passos do Fluxo:</p>
                <div className="space-y-1">
                  {playbook.preview_steps?.slice(0, 3).map((step, idx) => (
                    <div key={idx} className="text-xs text-slate-600 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      {step}
                    </div>
                  ))}
                  {playbook.preview_steps?.length > 3 && (
                    <div className="text-xs text-slate-400">
                      +{playbook.preview_steps.length - 3} passos
                    </div>
                  )}
                </div>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-slate-50 rounded-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-amber-500">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="text-sm font-bold">
                      {playbook.avaliacao_media.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">Avaliação</p>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-500">
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-bold">{playbook.total_instalacoes}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Instalações</p>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-green-500">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-bold">
                      {playbook.metricas_benchmark?.taxa_conversao_media?.toFixed(0) || 0}%
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">Conversão</p>
                </div>
              </div>

              {/* Nível e Botão */}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={
                  playbook.nivel_dificuldade === 'iniciante' ? 'border-green-500 text-green-600' :
                  playbook.nivel_dificuldade === 'intermediario' ? 'border-yellow-500 text-yellow-600' :
                  'border-red-500 text-red-600'
                }>
                  {playbook.nivel_dificuldade}
                </Badge>
                
                <Button
                  onClick={() => handleInstalar(playbook)}
                  size="sm"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Instalar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPlaybooks.length === 0 && (
        <div className="text-center py-12">
          <Filter className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Nenhum playbook encontrado com os filtros selecionados</p>
        </div>
      )}
    </div>
  );
}