import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, Loader2, FileText, Image as ImageIcon, CheckCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 🧠 IntelligentImporter - Componente de Importação Inteligente
 * 
 * Permite importar dados colando TEXTO ou enviando IMAGEM.
 * A IA analisa e extrai dados estruturados para revisão antes da confirmação.
 * 
 * @param {boolean} isOpen - Controla visibilidade do modal
 * @param {function} onOpenChange - Callback para fechar o modal
 * @param {string} title - Título do modal
 * @param {string} description - Descrição do que importar
 * @param {string} aiPromptBase - Prompt para a IA com instruções de extração
 * @param {object} dataSchema - JSON Schema dos dados esperados
 * @param {string} entityKey - Chave no JSON retornado que contém o array de itens
 * @param {array} fieldDefinitions - Definições dos campos para a tabela de revisão
 * @param {function} onSuccess - Callback chamado com os dados quando confirmados
 */
export default function IntelligentImporter({
  isOpen,
  onOpenChange,
  title = "Importar Dados",
  description = "Cole texto ou envie uma imagem para importação.",
  aiPromptBase,
  dataSchema,
  entityKey = "items",
  fieldDefinitions = [],
  onSuccess
}) {
  // Estados do Fluxo
  const [step, setStep] = useState('input'); // 'input' | 'processing' | 'review'
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedData, setExtractedData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Reset ao fechar
  const handleClose = () => {
    setStep('input');
    setInputText('');
    setSelectedFile(null);
    setExtractedData([]);
    setLoading(false);
    onOpenChange(false);
  };

  // Upload de arquivo
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Por favor, envie uma imagem (JPG, PNG ou WEBP)');
        return;
      }
      
      // Validar tamanho (máx 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 10MB.');
        return;
      }
      
      setSelectedFile(file);
      setInputText(''); // Limpa texto se houver
    }
  };

  // Processar com IA
  const handleProcess = async () => {
    if (!inputText && !selectedFile) {
      toast.error('Por favor, cole um texto ou envie uma imagem.');
      return;
    }

    setLoading(true);
    setStep('processing');

    try {
      let fileUrl = null;
      
      // Se houver arquivo, fazer upload primeiro
      if (selectedFile) {
        toast.info('Fazendo upload da imagem...');
        const uploadResult = await base44.integrations.Core.UploadFile({ file: selectedFile });
        fileUrl = uploadResult.file_url;
      }

      // Chamar a IA para extrair dados
      toast.info('IA analisando os dados...');
      
      const promptFinal = aiPromptBase + '\n\nRetorne APENAS o JSON no formato especificado, sem texto adicional.';
      
      const iaResult = await base44.integrations.Core.InvokeLLM({
        prompt: inputText || `Analise esta imagem e extraia os dados conforme solicitado:\n${promptFinal}`,
        response_json_schema: dataSchema,
        file_urls: fileUrl ? [fileUrl] : undefined,
      });

      // Extrair array de itens usando entityKey
      const items = iaResult?.[entityKey] || [];

      if (!items || items.length === 0) {
        toast.warning('Nenhum item foi encontrado nos dados fornecidos.');
        setStep('input');
        setLoading(false);
        return;
      }

      setExtractedData(items);
      setStep('review');
      toast.success(`${items.length} ${items.length === 1 ? 'item encontrado' : 'itens encontrados'}!`);
      
    } catch (error) {
      console.error('Erro ao processar com IA:', error);
      toast.error('Erro ao processar os dados: ' + error.message);
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  // Editar item na tabela de revisão
  const handleEditItem = (index, field, value) => {
    setExtractedData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Remover item da revisão
  const handleRemoveItem = (index) => {
    setExtractedData(prev => prev.filter((_, i) => i !== index));
  };

  // Confirmar e enviar dados
  const handleConfirm = () => {
    if (extractedData.length === 0) {
      toast.warning('Nenhum item para confirmar.');
      return;
    }

    const dataToReturn = {
      [entityKey]: extractedData,
      originalData: inputText,
      savedImageUrl: selectedFile ? URL.createObjectURL(selectedFile) : null
    };

    onSuccess(dataToReturn);
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            {title}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* ETAPA 1: INPUT */}
        {step === 'input' && (
          <div className="space-y-6 py-4">
            {/* Área de Texto */}
            <div>
              <Label className="text-slate-300 mb-2 block">Cole o texto aqui:</Label>
              <Textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setSelectedFile(null); // Limpa arquivo se houver
                }}
                placeholder="Ex: Cole dados de uma planilha, lista de produtos, etc..."
                className="h-40 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            {/* OU */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-700"></div>
              <span className="text-slate-500 text-sm font-semibold">OU</span>
              <div className="flex-1 h-px bg-slate-700"></div>
            </div>

            {/* Upload de Imagem */}
            <div>
              <Label className="text-slate-300 mb-2 block">Envie uma imagem:</Label>
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-purple-500 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-3">
                      <ImageIcon className="w-12 h-12 text-green-400" />
                      <p className="text-green-400 font-semibold">{selectedFile.name}</p>
                      <p className="text-slate-500 text-sm">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Upload className="w-12 h-12 text-slate-400" />
                      <p className="text-slate-300">Clique para selecionar ou arraste uma imagem</p>
                      <p className="text-slate-500 text-sm">JPG, PNG ou WEBP (máx 10MB)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Botão Processar */}
            <Button
              onClick={handleProcess}
              disabled={!inputText && !selectedFile}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-3"
            >
              <FileText className="w-5 h-5 mr-2" />
              Processar com IA
            </Button>
          </div>
        )}

        {/* ETAPA 2: PROCESSANDO */}
        {step === 'processing' && (
          <div className="py-16 flex flex-col items-center justify-center">
            <Loader2 className="w-16 h-16 text-purple-400 animate-spin mb-4" />
            <p className="text-lg text-slate-300 font-semibold">Analisando dados com IA...</p>
            <p className="text-slate-500 text-sm mt-2">Isso pode levar alguns segundos</p>
          </div>
        )}

        {/* ETAPA 3: REVISÃO */}
        {step === 'review' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <h3 className="text-lg font-semibold text-white">
                  {extractedData.length} {extractedData.length === 1 ? 'item encontrado' : 'itens encontrados'}
                </h3>
              </div>
              <Button
                variant="outline"
                onClick={() => setStep('input')}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Voltar
              </Button>
            </div>

            {/* Tabela de Revisão */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800 border-b border-slate-700">
                    <tr>
                      {fieldDefinitions.map(field => (
                        <th key={field.key} className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-1">*</span>}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300 w-20">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.map((item, index) => (
                      <tr key={index} className="border-b border-slate-700 hover:bg-slate-800/50">
                        {fieldDefinitions.map(field => (
                          <td key={field.key} className="px-4 py-2">
                            <Input
                              type={field.type === 'number' || field.type === 'integer' ? 'number' : 'text'}
                              value={item[field.key] || ''}
                              onChange={(e) => handleEditItem(index, field.key, e.target.value)}
                              className="bg-slate-800 border-slate-600 text-white text-sm h-9"
                              step={field.type === 'number' ? '0.01' : undefined}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(index)}
                            className="hover:bg-red-500/10 hover:text-red-400 h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Botão Confirmar */}
            <Button
              onClick={handleConfirm}
              disabled={extractedData.length === 0}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Confirmar {extractedData.length} {extractedData.length === 1 ? 'Item' : 'Itens'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}