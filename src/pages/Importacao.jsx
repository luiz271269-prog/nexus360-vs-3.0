import React, { useState } from 'react';
import { Upload, FileText, Loader2, Save, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { fluxoImportacaoCompleto, salvarImportacao } from '../components/importacao/UnifiedImportEngine';
import TipoImportacaoSelector from '../components/importacao/TipoImportacaoSelector';

export default function Importacao() {
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState('upload'); // upload, selecao_tipo, preview, concluido
  const [fileUrl, setFileUrl] = useState(null);
  const [tipoSelecionado, setTipoSelecionado] = useState(null);
  const [tipoSugerido, setTipoSugerido] = useState(null);
  const [dadosExtraidos, setDadosExtraidos] = useState([]);
  const [metadata, setMetadata] = useState({});

  const handleFileSelect = async (file) => {
    if (!file) return;

    // Validar tamanho (máximo 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo: 10MB');
      return;
    }

    setLoading(true);
    setEtapaAtual('upload');

    try {
      // Executar fluxo completo
      const resultado = await fluxoImportacaoCompleto(file);

      if (resultado.etapa === 'deteccao') {
        // Não detectou automaticamente, pedir ao usuário
        setFileUrl(resultado.fileUrl);
        setEtapaAtual('selecao_tipo');
        toast.info(resultado.mensagem);
      } else if (resultado.etapa === 'processamento') {
        // Dados extraídos com sucesso
        setTipoSelecionado(resultado.tipo);
        setDadosExtraidos(resultado.itens);
        setFileUrl(resultado.fileUrl);
        setMetadata(resultado.metadata);
        setEtapaAtual('preview');
      }
    } catch (error) {
      toast.error(`Erro no processamento: ${error.message}`);
      setEtapaAtual('upload');
    } finally {
      setLoading(false);
    }
  };

  const handleTipoManualSelect = async (tipo) => {
    setTipoSelecionado(tipo);
    setLoading(true);

    try {
      // Reprocessar com tipo forçado
      const resultado = await fluxoImportacaoCompleto(
        { name: 'arquivo_enviado' },
        tipo,
        { fileUrl }
      );

      if (resultado.sucesso) {
        setDadosExtraidos(resultado.itens);
        setMetadata(resultado.metadata);
        setEtapaAtual('preview');
      }
    } catch (error) {
      toast.error(`Erro ao processar: ${error.message}`);
      setEtapaAtual('upload');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarImportacao = async () => {
    if (!tipoSelecionado || dadosExtraidos.length === 0) {
      toast.error('Nenhum dado para importar');
      return;
    }

    setProcessando(true);

    try {
      const resultado = await salvarImportacao(tipoSelecionado, dadosExtraidos, metadata);
      
      setEtapaAtual('concluido');
      
      // Resetar após 3s
      setTimeout(() => {
        resetarEstado();
      }, 3000);
    } catch (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const resetarEstado = () => {
    setEtapaAtual('upload');
    setTipoSelecionado(null);
    setTipoSugerido(null);
    setDadosExtraidos([]);
    setFileUrl(null);
    setMetadata({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
              <Upload className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                Sistema de Importação Inteligente
              </h1>
              <p className="text-slate-300 mt-1">
                Importação com IA e detecção automática de dados
              </p>
            </div>
          </div>
        </div>

        {/* ETAPA 1: Upload */}
        {etapaAtual === 'upload' && (
          <Card className="p-8">
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-500 rounded-full mx-auto flex items-center justify-center shadow-xl">
                <FileText className="w-12 h-12 text-white" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  Arraste arquivos ou clique para selecionar
                </h2>
                <p className="text-slate-600 mt-2">
                  Suporta: xlsx, csv, PDF, imagens • Cole pronto com Ctrl+V
                </p>
              </div>

              <div className="relative">
                <input
                  type="file"
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.txt"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={loading}
                />
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 hover:border-orange-500 hover:bg-orange-50/50 transition-all">
                  {loading ? (
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                      <span className="text-slate-700">Processando arquivo...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <Upload className="w-12 h-12 text-slate-400" />
                      <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-500">
                        Selecionar Arquivo
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-lg p-3">
                💡 <strong>Arquivos .xls antigos?</strong> Salve como .xlsx ou .csv para importar.
              </div>
            </div>
          </Card>
        )}

        {/* ETAPA 2: Seleção Manual de Tipo */}
        {etapaAtual === 'selecao_tipo' && (
          <Card className="p-6">
            <TipoImportacaoSelector
              onSelect={handleTipoManualSelect}
              tipoSugerido={tipoSugerido}
            />
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={resetarEstado}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </Card>
        )}

        {/* ETAPA 3: Preview dos Dados */}
        {etapaAtual === 'preview' && (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Dados Extraídos: {dadosExtraidos.length} itens
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Tipo: <span className="font-medium">{tipoSelecionado}</span> • 
                    Skill: <span className="font-mono text-xs">{metadata.skill}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={resetarEstado}
                    disabled={processando}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirmarImportacao}
                    disabled={processando}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {processando ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Confirmar Importação
                  </Button>
                </div>
              </div>

              {/* Preview dos primeiros 5 itens */}
              <div className="bg-slate-50 rounded-lg p-4 max-h-96 overflow-auto">
                <div className="space-y-2">
                  {dadosExtraidos.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-slate-200">
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap">
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    </div>
                  ))}
                  {dadosExtraidos.length > 5 && (
                    <div className="text-center text-sm text-slate-500 pt-2">
                      ... e mais {dadosExtraidos.length - 5} itens
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ETAPA 4: Concluído */}
        {etapaAtual === 'concluido' && (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full mx-auto flex items-center justify-center shadow-xl">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-green-700">
                Importação Concluída!
              </h2>
              <p className="text-slate-600">
                Redirecionando...
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}