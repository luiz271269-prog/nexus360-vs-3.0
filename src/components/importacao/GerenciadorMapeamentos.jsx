import { useState, useEffect } from "react";
import { MapeamentoImportacao } from "@/entities/MapeamentoImportacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  X, Trash2, Settings, Eye, Search, Filter
} from "lucide-react";

export default function GerenciadorMapeamentos({ onClose }) {
  const [mapeamentos, setMapeamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busca, setBusca] = useState('');
  const [mapeamentoSelecionado, setMapeamentoSelecionado] = useState(null);

  useEffect(() => {
    carregarMapeamentos();
  }, []);

  const carregarMapeamentos = async () => {
    setLoading(true);
    try {
      const dados = await MapeamentoImportacao.list("-created_date");
      setMapeamentos(dados);
    } catch (error) {
      console.error("Erro ao carregar mapeamentos:", error);
    }
    setLoading(false);
  };

  const handleToggleAtivo = async (mapeamento) => {
    try {
      await MapeamentoImportacao.update(mapeamento.id, {
        ativo: !mapeamento.ativo
      });
      carregarMapeamentos();
    } catch (error) {
      console.error("Erro ao atualizar mapeamento:", error);
    }
  };

  const handleExcluir = async (mapeamento) => {
    if (!confirm(`Tem certeza que deseja excluir o mapeamento "${mapeamento.nome_mapeamento}"?`)) {
      return;
    }
    
    try {
      await MapeamentoImportacao.delete(mapeamento.id);
      carregarMapeamentos();
    } catch (error) {
      console.error("Erro ao excluir mapeamento:", error);
    }
  };

  const mapeamentosFiltrados = mapeamentos.filter(m => {
    const matchTipo = filtroTipo === 'todos' || m.tipo_documento === filtroTipo;
    const matchBusca = !busca || 
      m.nome_mapeamento.toLowerCase().includes(busca.toLowerCase()) ||
      m.tipo_documento.toLowerCase().includes(busca.toLowerCase());
    return matchTipo && matchBusca;
  });

  const tiposUnicos = [...new Set(mapeamentos.map(m => m.tipo_documento))];

  const getStatusBadge = (mapeamento) => {
    if (!mapeamento.ativo) {
      return <Badge variant="outline" className="bg-gray-100 text-gray-600">Inativo</Badge>;
    }
    
    const vezes = mapeamento.vezes_usado || 0;
    if (vezes > 10) {
      return <Badge className="bg-green-100 text-green-700">Muito Usado ({vezes}x)</Badge>;
    } else if (vezes > 5) {
      return <Badge className="bg-blue-100 text-blue-700">Popular ({vezes}x)</Badge>;
    } else {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-700">Novo ({vezes}x)</Badge>;
    }
  };

  const DetalhesMapeamento = ({ mapeamento, onFechar }) => (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-60">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">Detalhes do Mapeamento</h3>
          <Button onClick={onFechar} size="icon" variant="ghost">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-600">Nome:</label>
              <p>{mapeamento.nome_mapeamento}</p>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Tipo de Documento:</label>
              <p className="capitalize">{mapeamento.tipo_documento}</p>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Entidade Destino:</label>
              <p className="capitalize">{mapeamento.entidade_destino}</p>
            </div>
            <div>
              <label className="font-semibold text-slate-600">Campo Totalizador:</label>
              <p>{mapeamento.campo_totalizador || 'Não definido'}</p>
            </div>
          </div>
          
          <div>
            <label className="font-semibold text-slate-600">Mapeamento de Campos:</label>
            <div className="mt-2 bg-slate-50 rounded-lg p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Campo Original</th>
                    <th className="text-left py-2">Campo Mapeado</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(mapeamento.mapeamento_campos || {}).map(([original, mapeado]) => (
                    <tr key={original} className="border-b last:border-b-0">
                      <td className="py-2 font-mono text-xs bg-gray-100 px-2 rounded">{original}</td>
                      <td className="py-2">{mapeado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{mapeamento.vezes_usado || 0}</div>
              <div className="text-sm text-slate-600">Vezes Usado</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{Math.round(mapeamento.confianca_media || 0)}%</div>
              <div className="text-sm text-slate-600">Confiança Média</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Object.keys(mapeamento.mapeamento_campos || {}).length}
              </div>
              <div className="text-sm text-slate-600">Campos Mapeados</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-6 border-b border-slate-200/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
                  <Settings className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Gerenciador de Mapeamentos</h2>
                  <p className="text-slate-600">Gerencie os mapeamentos salvos para otimizar futuras importações</p>
                </div>
              </div>
              <Button onClick={onClose} size="icon" variant="ghost" className="text-slate-500">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <div className="p-6 border-b border-slate-200/50 bg-slate-50/50">
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar mapeamentos..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select 
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="todos">Todos os Tipos</option>
                  {tiposUnicos.map(tipo => (
                    <option key={tipo} value={tipo} className="capitalize">{tipo}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Lista de Mapeamentos */}
          <div className="flex-grow overflow-auto p-6">
            {loading ? (
              <div className="space-y-4">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="bg-slate-100 rounded-lg h-20 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {mapeamentosFiltrados.map((mapeamento) => (
                  <div key={mapeamento.id} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex-grow">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-bold text-slate-800">{mapeamento.nome_mapeamento}</h3>
                          {getStatusBadge(mapeamento)}
                          <Badge variant="outline" className="capitalize">
                            {mapeamento.tipo_documento}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-semibold text-slate-600">Destino:</span>
                            <p className="capitalize">{mapeamento.entidade_destino}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-600">Campos:</span>
                            <p>{Object.keys(mapeamento.mapeamento_campos || {}).length} mapeados</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-600">Totalizador:</span>
                            <p>{mapeamento.campo_totalizador || 'Não definido'}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-600">Criado em:</span>
                            <p>{new Date(mapeamento.created_date).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          onClick={() => setMapeamentoSelecionado(mapeamento)}
                          size="sm"
                          variant="outline"
                          className="bg-white"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver Detalhes
                        </Button>
                        <Button
                          onClick={() => handleToggleAtivo(mapeamento)}
                          size="sm"
                          variant={mapeamento.ativo ? "outline" : "default"}
                          className={mapeamento.ativo ? "bg-white" : "bg-green-600 text-white"}
                        >
                          {mapeamento.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button
                          onClick={() => handleExcluir(mapeamento)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {mapeamentosFiltrados.length === 0 && !loading && (
                  <div className="text-center py-12 text-slate-500">
                    <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Nenhum mapeamento encontrado</p>
                    <p className="text-sm">Crie mapeamentos importando e salvando dados estruturados.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer com Estatísticas */}
          <div className="p-6 border-t border-slate-200/50 bg-slate-50/50">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-indigo-600">{mapeamentos.length}</div>
                <div className="text-sm text-slate-600">Total de Mapeamentos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {mapeamentos.filter(m => m.ativo).length}
                </div>
                <div className="text-sm text-slate-600">Mapeamentos Ativos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{tiposUnicos.length}</div>
                <div className="text-sm text-slate-600">Tipos de Documentos</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes */}
      {mapeamentoSelecionado && (
        <DetalhesMapeamento
          mapeamento={mapeamentoSelecionado}
          onFechar={() => setMapeamentoSelecionado(null)}
        />
      )}
    </>
  );
}