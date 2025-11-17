import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { X, Save, Eye, AlertTriangle, CheckCircle, Brain, Edit } from "lucide-react";

export default function RevisaoDocumento({ documento, tiposDocumento, onConfirmar, onCancelar }) {
  const [tipoSelecionado, setTipoSelecionado] = useState(
    documento.tipos_detectados?.[0]?.tipo_codigo || ''
  );
  const [dadosCorrigidos, setDadosCorrigidos] = useState({});
  const [observacoes, setObservacoes] = useState('');

  React.useEffect(() => {
    // Inicializar dados com base no tipo detectado
    if (tipoSelecionado && documento.dados_extraidos?.[tipoSelecionado]) {
      setDadosCorrigidos(documento.dados_extraidos[tipoSelecionado].dados || {});
    }
  }, [tipoSelecionado, documento]);

  const tipoObj = tiposDocumento.find(t => t.codigo === tipoSelecionado);
  const tipoDetectado = documento.tipos_detectados?.find(t => t.tipo_codigo === tipoSelecionado);

  const handleConfirmar = () => {
    onConfirmar(tipoSelecionado, dadosCorrigidos);
  };

  const getConfiancaCor = (confianca) => {
    if (confianca >= 80) return "text-green-600 bg-green-100";
    if (confianca >= 60) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl border border-slate-200/50">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50 bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                <Brain className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Revisão e Confirmação</h2>
                <p className="text-slate-600 mt-1">{documento.nome_arquivo_original}</p>
              </div>
            </div>
            <Button onClick={onCancelar} size="icon" variant="ghost" className="text-slate-500">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Tipos Detectados */}
          <div className="mt-4 flex flex-wrap gap-2">
            {documento.tipos_detectados?.map((tipo, index) => (
              <Badge 
                key={index}
                className={`${getConfiancaCor(tipo.confianca)} border-0 font-medium`}
              >
                {tiposDocumento.find(t => t.codigo === tipo.tipo_codigo)?.nome || tipo.tipo_codigo}
                <span className="ml-2 text-xs">({tipo.confianca}%)</span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex flex-grow overflow-hidden">
          
          {/* Preview do Documento */}
          <div className="w-2/5 border-r border-slate-200/50 bg-slate-50/50">
            <div className="p-4 border-b border-slate-200/50">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Eye className="w-4 h-4" />
                Documento Original
              </div>
            </div>
            <div className="h-full overflow-auto p-4">
              {documento.url_arquivo ? (
                <iframe 
                  src={documento.url_arquivo} 
                  className="w-full h-96 bg-white rounded-lg border border-slate-200 shadow-sm"
                  title="Preview do documento"
                />
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
                  <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">Preview não disponível</p>
                </div>
              )}
              
              {/* Texto extraído */}
              {documento.texto_completo && (
                <div className="mt-4">
                  <h4 className="font-semibold text-slate-700 mb-2">Texto Extraído:</h4>
                  <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs text-slate-600 max-h-40 overflow-auto">
                    {documento.texto_completo.substring(0, 1000)}
                    {documento.texto_completo.length > 1000 && '...'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Formulário de Revisão */}
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              
              {/* Seleção de Tipo */}
              <div className="space-y-3">
                <Label className="text-lg font-semibold text-slate-800">Confirmar Tipo do Documento</Label>
                <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
                  <SelectTrigger className="bg-white border-slate-300">
                    <SelectValue placeholder="Selecione o tipo correto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposDocumento.map(tipo => (
                      <SelectItem key={tipo.codigo} value={tipo.codigo}>
                        <div className="flex items-center gap-2">
                          <span>{tipo.nome}</span>
                          <Badge variant="outline" className="text-xs">{tipo.codigo}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {tipoDetectado && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-slate-600">
                      IA detectou com <strong>{tipoDetectado.confianca}%</strong> de confiança
                    </span>
                  </div>
                )}
              </div>

              {/* Campos do Tipo Selecionado */}
              {tipoObj && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Edit className="w-5 h-5 text-slate-600" />
                    <Label className="text-lg font-semibold text-slate-800">
                      Dados Extraídos - {tipoObj.nome}
                    </Label>
                  </div>
                  
                  <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-200/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tipoObj.schema_campos?.properties && Object.entries(tipoObj.schema_campos.properties).map(([campo, schema]) => (
                        <div key={campo} className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700">
                            {schema.description || campo}
                            {tipoObj.campos_obrigatorios?.includes(campo) && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </Label>
                          
                          {schema.type === 'string' && schema.enum ? (
                            <Select 
                              value={dadosCorrigidos[campo] || ''} 
                              onValueChange={(value) => setDadosCorrigidos({...dadosCorrigidos, [campo]: value})}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder={`Selecionar ${campo}...`} />
                              </SelectTrigger>
                              <SelectContent>
                                {schema.enum.map(option => (
                                  <SelectItem key={option} value={option}>{option}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : schema.type === 'string' && schema.format === 'textarea' ? (
                            <Textarea
                              value={dadosCorrigidos[campo] || ''}
                              onChange={(e) => setDadosCorrigidos({...dadosCorrigidos, [campo]: e.target.value})}
                              placeholder={`Digite ${campo}...`}
                              className="bg-white"
                              rows={3}
                            />
                          ) : (
                            <Input
                              type={schema.format === 'date' ? 'date' : schema.type === 'number' ? 'number' : 'text'}
                              value={dadosCorrigidos[campo] || ''}
                              onChange={(e) => setDadosCorrigidos({...dadosCorrigidos, [campo]: e.target.value})}
                              placeholder={`Digite ${campo}...`}
                              className="bg-white"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Observações */}
              <div className="space-y-3">
                <Label className="text-lg font-semibold text-slate-800">Observações (Opcional)</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Adicione observações sobre correções ou melhorias para treinar a IA..."
                  className="bg-white"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200/50 bg-slate-50/50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600">
              <p>✨ Suas correções ajudam a IA a melhorar continuamente</p>
            </div>
            <div className="flex gap-4">
              <Button onClick={onCancelar} variant="ghost" className="text-slate-700">
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmar}
                disabled={!tipoSelecionado}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
              >
                <Save className="w-4 h-4 mr-2" />
                Confirmar e Salvar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}