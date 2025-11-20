import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  FileCode,
  GitBranch,
  Clock,
  Filter,
  Download,
  Eye,
  Code,
  Database,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";

export default function RepositorioTecnico() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedAnalise, setSelectedAnalise] = useState(null);
  const [selectedCodigo, setSelectedCodigo] = useState(null);
  const [selectedDecisao, setSelectedDecisao] = useState(null);

  const { data: analises = [], refetch: refetchAnalises } = useQuery({
    queryKey: ['analises-historico'],
    queryFn: () => base44.entities.AnaliseHistorico.list('-data_interacao', 100),
    staleTime: 30000
  });

  const { data: codigos = [], refetch: refetchCodigos } = useQuery({
    queryKey: ['codigo-gerado'],
    queryFn: () => base44.entities.CodigoGerado.list('-data_criacao', 100),
    staleTime: 30000
  });

  const { data: decisoes = [], refetch: refetchDecisoes } = useQuery({
    queryKey: ['decisoes-arquiteturais'],
    queryFn: () => base44.entities.DecisaoArquitetural.list('-data_decisao', 100),
    staleTime: 30000
  });

  const analisesFiltered = analises.filter(a => {
    const matchSearch = !searchTerm || 
      a.solicitacao_usuario?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.analise_tecnica?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchCategory = selectedCategory === 'all' || a.categoria === selectedCategory;
    
    return matchSearch && matchCategory;
  });

  const categorias = [
    { value: 'all', label: 'Todas' },
    { value: 'debugging', label: 'Debugging' },
    { value: 'feature_development', label: 'Desenvolvimento' },
    { value: 'architecture', label: 'Arquitetura' },
    { value: 'optimization', label: 'Otimização' },
    { value: 'bug_fix', label: 'Correção' },
    { value: 'integration', label: 'Integração' },
    { value: 'security', label: 'Segurança' }
  ];

  const getCategoryColor = (categoria) => {
    const colors = {
      debugging: 'bg-red-100 text-red-800',
      feature_development: 'bg-blue-100 text-blue-800',
      architecture: 'bg-purple-100 text-purple-800',
      optimization: 'bg-green-100 text-green-800',
      bug_fix: 'bg-orange-100 text-orange-800',
      integration: 'bg-cyan-100 text-cyan-800',
      security: 'bg-red-100 text-red-800'
    };
    return colors[categoria] || 'bg-gray-100 text-gray-800';
  };

  const handleRefreshAll = async () => {
    await Promise.all([refetchAnalises(), refetchCodigos(), refetchDecisoes()]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Repositório Técnico</h1>
            <p className="text-slate-600 mt-1">
              Histórico completo de análises, código gerado e decisões arquiteturais
            </p>
          </div>
          <Button onClick={handleRefreshAll} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Pesquisa e Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Buscar por palavra-chave, tag ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                {categorias.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="analises" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="analises">
              <Database className="w-4 h-4 mr-2" />
              Análises ({analises.length})
            </TabsTrigger>
            <TabsTrigger value="codigo">
              <Code className="w-4 h-4 mr-2" />
              Código ({codigos.length})
            </TabsTrigger>
            <TabsTrigger value="decisoes">
              <GitBranch className="w-4 h-4 mr-2" />
              Decisões ({decisoes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analises" className="space-y-4">
            {analisesFiltered.map(analise => (
              <Card key={analise.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getCategoryColor(analise.categoria)}>
                          {analise.categoria}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(analise.data_interacao), 'dd/MM/yyyy HH:mm')}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{analise.solicitacao_usuario}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedAnalise(analise)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-3">
                    {analise.contexto_problema?.substring(0, 200)}...
                  </p>
                  
                  {analise.tags && analise.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {analise.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {analise.arquivos_modificados && analise.arquivos_modificados.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <FileCode className="w-4 h-4" />
                      <span>{analise.arquivos_modificados.length} arquivo(s) modificado(s)</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="codigo" className="space-y-4">
            {codigos.map(codigo => (
              <Card key={codigo.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-indigo-100 text-indigo-800">
                          {codigo.tipo_arquivo}
                        </Badge>
                        <Badge variant="outline">v{codigo.versao}</Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(codigo.data_criacao), 'dd/MM/yyyy HH:mm')}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg font-mono">{codigo.caminho_completo}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCodigo(codigo)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-3">
                    {codigo.descricao_funcionalidade}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Tipo de Modificação:</span>
                      <span className="ml-2 font-medium">{codigo.tipo_modificacao}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Linguagem:</span>
                      <span className="ml-2 font-medium">{codigo.linguagem}</span>
                    </div>
                  </div>

                  {codigo.tags_tecnicas && codigo.tags_tecnicas.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {codigo.tags_tecnicas.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="decisoes" className="space-y-4">
            {decisoes.map(decisao => (
              <Card key={decisao.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-purple-100 text-purple-800">
                          {decisao.status_implementacao}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(decisao.data_decisao), 'dd/MM/yyyy')}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{decisao.titulo_decisao}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDecisao(decisao)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-3">
                    <strong>Contexto:</strong> {decisao.contexto?.substring(0, 200)}...
                  </p>
                  <p className="text-sm text-slate-600 mb-3">
                    <strong>Decisão:</strong> {decisao.decisao_tomada?.substring(0, 200)}...
                  </p>

                  {decisao.tecnologias_envolvidas && decisao.tecnologias_envolvidas.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {decisao.tecnologias_envolvidas.map((tech, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {selectedAnalise && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{selectedAnalise.solicitacao_usuario}</CardTitle>
                  <Button variant="ghost" onClick={() => setSelectedAnalise(null)}>
                    Fechar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Contexto do Problema</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                    {selectedAnalise.contexto_problema}
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Análise Técnica</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                    {selectedAnalise.analise_tecnica}
                  </p>
                </div>

                {selectedAnalise.diagnostico && (
                  <div>
                    <h3 className="font-semibold mb-2">Diagnóstico</h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">
                      {selectedAnalise.diagnostico}
                    </p>
                  </div>
                )}

                {selectedAnalise.solucao_implementada && (
                  <div>
                    <h3 className="font-semibold mb-2">Solução Implementada</h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">
                      {selectedAnalise.solucao_implementada}
                    </p>
                  </div>
                )}

                {selectedAnalise.ferramentas_utilizadas && (
                  <div>
                    <h3 className="font-semibold mb-2">Ferramentas Utilizadas</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedAnalise.ferramentas_utilizadas.map((tool, idx) => (
                        <Badge key={idx} variant="outline">{tool}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAnalise.arquivos_modificados && (
                  <div>
                    <h3 className="font-semibold mb-2">Arquivos Modificados</h3>
                    <ul className="list-disc list-inside text-sm text-slate-600">
                      {selectedAnalise.arquivos_modificados.map((arquivo, idx) => (
                        <li key={idx} className="font-mono">{arquivo}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {selectedCodigo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <Card className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="font-mono">{selectedCodigo.caminho_completo}</CardTitle>
                  <Button variant="ghost" onClick={() => setSelectedCodigo(null)}>
                    Fechar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Descrição</h3>
                  <p className="text-sm text-slate-600">{selectedCodigo.descricao_funcionalidade}</p>
                </div>

                {selectedCodigo.justificativa_mudanca && (
                  <div>
                    <h3 className="font-semibold mb-2">Justificativa</h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">
                      {selectedCodigo.justificativa_mudanca}
                    </p>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2">Código</h3>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs">
                    {selectedCodigo.conteudo_codigo}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedDecisao && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{selectedDecisao.titulo_decisao}</CardTitle>
                  <Button variant="ghost" onClick={() => setSelectedDecisao(null)}>
                    Fechar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Contexto</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                    {selectedDecisao.contexto}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Problema Identificado</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                    {selectedDecisao.problema_identificado}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Decisão Tomada</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                    {selectedDecisao.decisao_tomada}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Justificativa Técnica</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                    {selectedDecisao.justificativa_tecnica}
                  </p>
                </div>

                {selectedDecisao.implicacoes_longo_prazo && (
                  <div>
                    <h3 className="font-semibold mb-2">Implicações de Longo Prazo</h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">
                      {selectedDecisao.implicacoes_longo_prazo}
                    </p>
                  </div>
                )}

                {selectedDecisao.trade_offs && (
                  <div>
                    <h3 className="font-semibold mb-2">Trade-offs</h3>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">
                      {selectedDecisao.trade_offs}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}