import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, Search, Filter, Download, Eye, Grid, List } from "lucide-react";

export default function TabelaDinamica({ documentos, tiposDocumento }) {
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [viewMode, setViewMode] = useState('tabela'); // tabela, cards
  const [camposSelecionados, setCamposSelecionados] = useState([]);

  // Extrair todos os dados estruturados dos documentos validados
  const dadosEstruturados = documentos.flatMap(doc => {
    if (!doc.dados_extraidos) return [];
    
    return Object.entries(doc.dados_extraidos).flatMap(([tipoCode, dadosTipo]) => {
      const tipo = tiposDocumento.find(t => t.codigo === tipoCode);
      if (!dadosTipo.dados) return [];
      
      return Array.isArray(dadosTipo.dados) ? 
        dadosTipo.dados.map(item => ({
          ...item,
          _documento: doc.nome_arquivo_original,
          _tipo: tipo?.nome || tipoCode,
          _tipo_codigo: tipoCode,
          _confianca: dadosTipo.confianca || 0,
          _data_processamento: doc.created_date
        })) :
        [{
          ...dadosTipo.dados,
          _documento: doc.nome_arquivo_original,
          _tipo: tipo?.nome || tipoCode,
          _tipo_codigo: tipoCode,
          _confianca: dadosTipo.confianca || 0,
          _data_processamento: doc.created_date
        }];
    });
  });

  // Filtrar dados
  const dadosFiltrados = dadosEstruturados.filter(item => {
    const matchBusca = !busca || Object.values(item).some(valor => 
      String(valor).toLowerCase().includes(busca.toLowerCase())
    );
    const matchTipo = tipoFiltro === 'todos' || item._tipo_codigo === tipoFiltro;
    return matchBusca && matchTipo;
  });

  // Extrair todos os campos únicos
  const todosCampos = [...new Set(dadosFiltrados.flatMap(item => Object.keys(item)))];
  const camposEstaticos = ['_documento', '_tipo', '_confianca', '_data_processamento'];
  const camposDinamicos = todosCampos.filter(campo => !campo.startsWith('_'));

  const handleExportarCSV = () => {
    if (dadosFiltrados.length === 0) {
      alert('Nenhum dado para exportar');
      return;
    }

    const headers = camposSelecionados.length > 0 ? camposSelecionados : todosCampos;
    const csv = [
      headers.join(','),
      ...dadosFiltrados.map(item => 
        headers.map(campo => {
          const valor = item[campo] || '';
          return typeof valor === 'string' ? `"${valor.replace(/"/g, '""')}"` : valor;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tabela_dinamica_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Table className="w-6 h-6 text-indigo-600" />
            Tabela Dinâmica
          </h2>
          <p className="text-slate-600 mt-1">
            {dadosFiltrados.length} registros extraídos de {documentos.length} documentos
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setViewMode(viewMode === 'tabela' ? 'cards' : 'tabela')}
            variant="outline"
            size="sm"
          >
            {viewMode === 'tabela' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
          </Button>
          <Button onClick={handleExportarCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/50">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar em todos os campos..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-48 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                {tiposDocumento.map(tipo => (
                  <SelectItem key={tipo.codigo} value={tipo.codigo}>
                    {tipo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Seletor de Campos */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/50">
        <h3 className="font-semibold text-slate-800 mb-3">Campos para Exibição:</h3>
        <div className="flex flex-wrap gap-2">
          {[...camposEstaticos, ...camposDinamicos].map(campo => (
            <button
              key={campo}
              onClick={() => {
                setCamposSelecionados(prev => 
                  prev.includes(campo) 
                    ? prev.filter(c => c !== campo)
                    : [...prev, campo]
                );
              }}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                camposSelecionados.length === 0 || camposSelecionados.includes(campo)
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
              }`}
            >
              {campo.startsWith('_') ? campo.replace('_', '') : campo}
            </button>
          ))}
        </div>
      </div>

      {/* Dados */}
      {viewMode === 'tabela' ? (
        <div className="bg-white rounded-xl border border-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  {(camposSelecionados.length > 0 ? camposSelecionados : todosCampos).map(campo => (
                    <th key={campo} className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-r border-slate-200 last:border-r-0">
                      {campo.startsWith('_') ? campo.replace('_', '').replace(/([A-Z])/g, ' $1') : campo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dadosFiltrados.map((item, index) => (
                  <tr key={index} className="border-b border-slate-200/50 hover:bg-slate-50/50">
                    {(camposSelecionados.length > 0 ? camposSelecionados : todosCampos).map(campo => (
                      <td key={campo} className="px-4 py-3 text-sm text-slate-600 border-r border-slate-200 last:border-r-0">
                        {campo === '_tipo' && (
                          <Badge variant="outline" className="text-xs">
                            {item[campo]}
                          </Badge>
                        )}
                        {campo === '_confianca' && (
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            item[campo] >= 80 ? 'bg-green-100 text-green-700' :
                            item[campo] >= 60 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {item[campo]}%
                          </span>
                        )}
                        {!['_tipo', '_confianca'].includes(campo) && (
                          <span className={campo.startsWith('_') ? 'text-slate-500 text-xs' : ''}>
                            {String(item[campo] || '').substring(0, 100)}
                            {String(item[campo] || '').length > 100 && '...'}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {dadosFiltrados.map((item, index) => (
            <div key={index} className="bg-white rounded-xl p-4 border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className="text-xs">
                  {item._tipo}
                </Badge>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  item._confianca >= 80 ? 'bg-green-100 text-green-700' :
                  item._confianca >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {item._confianca}%
                </span>
              </div>
              
              <div className="space-y-2">
                {Object.entries(item)
                  .filter(([campo]) => !campo.startsWith('_'))
                  .slice(0, 5)
                  .map(([campo, valor]) => (
                    <div key={campo} className="text-sm">
                      <span className="font-medium text-slate-700">{campo}:</span>
                      <span className="text-slate-600 ml-2">
                        {String(valor || '').substring(0, 50)}
                        {String(valor || '').length > 50 && '...'}
                      </span>
                    </div>
                  ))}
              </div>
              
              <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                Documento: {item._documento}
              </div>
            </div>
          ))}
        </div>
      )}

      {dadosFiltrados.length === 0 && (
        <div className="text-center py-12 bg-slate-50/80 rounded-xl">
          <Table className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-800">Nenhum dado encontrado</p>
          <p className="text-slate-600 mt-2">Ajuste os filtros ou processe mais documentos.</p>
        </div>
      )}
    </div>
  );
}