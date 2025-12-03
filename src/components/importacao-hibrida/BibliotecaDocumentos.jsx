import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, Image, Table, Mail, Archive, 
  Clock, CheckCircle, XCircle, AlertTriangle,
  Eye, Edit, Search, Filter, Download
} from "lucide-react";

import RevisaoDocumento from "./RevisaoDocumento";

export default function BibliotecaDocumentos({ 
  documentos, 
  tiposDocumento, 
  onDocumentoSelect, 
  onConfirmarTipo,
  filtros,
  onFiltrosChange 
}) {
  const [busca, setBusca] = useState('');
  const [documentoRevisao, setDocumentoRevisao] = useState(null);

  const getTipoIcon = (tipo) => {
    const map = {
      pdf: FileText, image: Image, xlsx: Table, 
      csv: Table, docx: FileText, email: Mail, zip: Archive
    };
    return map[tipo] || FileText;
  };

  const getStatusInfo = (status) => {
    const map = {
      pendente: { icon: Clock, color: "text-slate-500", bg: "bg-slate-100", label: "Pendente" },
      processando: { icon: Clock, color: "text-blue-600", bg: "bg-blue-100", label: "Processando" },
      extraido: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100", label: "Extraído" },
      revisao_necessaria: { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-100", label: "Revisão Necessária" },
      validado: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100", label: "Validado" },
      rejeitado: { icon: XCircle, color: "text-red-600", bg: "bg-red-100", label: "Rejeitado" },
      erro: { icon: XCircle, color: "text-red-700", bg: "bg-red-100", label: "Erro" }
    };
    return map[status] || map.pendente;
  };

  const documentosFiltrados = documentos.filter(doc => {
    const matchBusca = !busca || 
      doc.nome_arquivo_original.toLowerCase().includes(busca.toLowerCase()) ||
      doc.tipos_detectados?.some(t => t.tipo_codigo?.toLowerCase().includes(busca.toLowerCase()));
    
    const matchStatus = filtros.status === 'todos' || doc.status_processamento === filtros.status;
    
    const matchTipo = filtros.tipo === 'todos' || 
      doc.tipos_detectados?.some(t => t.tipo_codigo === filtros.tipo) ||
      doc.tipos_confirmados?.includes(filtros.tipo);

    return matchBusca && matchStatus && matchTipo;
  });

  const handleExportarCSV = () => {
    const dadosExport = documentosFiltrados.map(doc => ({
      arquivo: doc.nome_arquivo_original,
      status: doc.status_processamento,
      tipo_detectado: doc.tipos_detectados?.[0]?.tipo_codigo || 'N/A',
      confianca: doc.tipos_detectados?.[0]?.confianca || 0,
      data_upload: new Date(doc.created_date).toLocaleDateString('pt-BR'),
      tamanho_kb: Math.round(doc.tamanho_arquivo / 1024)
    }));

    const csv = [
      Object.keys(dadosExport[0]).join(','),
      ...dadosExport.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'biblioteca_documentos.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filtros e Busca */}
      <div className="bg-slate-800/30 backdrop-blur-lg rounded-xl p-4 border border-slate-700/50">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nome do arquivo ou tipo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
            />
          </div>
          
          <div className="flex gap-2 items-center">
            <Filter className="w-4 h-4 text-slate-400" />
            
            <Select value={filtros.status} onValueChange={(v) => onFiltrosChange({...filtros, status: v})}>
              <SelectTrigger className="w-40 bg-slate-700/50 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="processando">Processando</SelectItem>
                <SelectItem value="extraido">Extraído</SelectItem>
                <SelectItem value="revisao_necessaria">Revisão</SelectItem>
                <SelectItem value="validado">Validado</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtros.tipo} onValueChange={(v) => onFiltrosChange({...filtros, tipo: v})}>
              <SelectTrigger className="w-40 bg-slate-700/50 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Tipos</SelectItem>
                {tiposDocumento.map(tipo => (
                  <SelectItem key={tipo.codigo} value={tipo.codigo}>
                    {tipo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              onClick={handleExportarCSV}
              variant="outline"
              size="sm"
              className="bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Grid de Documentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documentosFiltrados.map(documento => {
          const TipoIcon = getTipoIcon(documento.tipo_arquivo);
          const statusInfo = getStatusInfo(documento.status_processamento);
          const tipoDetectado = documento.tipos_detectados?.[0];
          const tipoObj = tiposDocumento.find(t => t.codigo === tipoDetectado?.tipo_codigo);

          return (
            <div 
              key={documento.id}
              className="bg-white/90 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
            >
              {/* Header do Card */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <TipoIcon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 truncate text-sm">
                      {documento.nome_arquivo_original}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {Math.round(documento.tamanho_arquivo / 1024)} KB
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                  <statusInfo.icon className="w-3 h-3" />
                  <span>{statusInfo.label}</span>
                </div>
              </div>

              {/* Tipo Detectado */}
              {tipoDetectado && (
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {tipoObj?.nome || tipoDetectado.tipo_codigo}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {tipoDetectado.confianca}% confiança
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                    <div 
                      className="bg-indigo-600 h-1.5 rounded-full" 
                      style={{ width: `${tipoDetectado.confianca}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Metadados */}
              <div className="text-xs text-slate-500 space-y-1 mb-4">
                <p>Upload: {new Date(documento.created_date).toLocaleDateString('pt-BR')}</p>
                {documento.metadados_processamento && (
                  <p>Processamento: {documento.metadados_processamento.tempo_processamento_ms}ms</p>
                )}
              </div>

              {/* Ações */}
              <div className="flex gap-2">
                <Button
                  onClick={() => window.open(documento.url_arquivo, '_blank')}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Ver
                </Button>
                
                {['extraido', 'revisao_necessaria'].includes(documento.status_processamento) && (
                  <Button
                    onClick={() => setDocumentoRevisao(documento)}
                    size="sm"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Revisar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {documentosFiltrados.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhum documento encontrado</p>
          <p className="text-sm">Ajuste os filtros ou faça upload de novos documentos.</p>
        </div>
      )}

      {/* Modal de Revisão */}
      {documentoRevisao && (
        <RevisaoDocumento
          documento={documentoRevisao}
          tiposDocumento={tiposDocumento}
          onConfirmar={(tipoConfirmado, dadosCorrigidos) => {
            onConfirmarTipo(documentoRevisao.id, tipoConfirmado, dadosCorrigidos);
            setDocumentoRevisao(null);
          }}
          onCancelar={() => setDocumentoRevisao(null)}
        />
      )}
    </div>
  );
}