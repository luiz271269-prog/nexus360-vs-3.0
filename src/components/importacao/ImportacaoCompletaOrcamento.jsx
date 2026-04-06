import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Loader2, FileText, Image as ImageIcon, CheckCircle, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportacaoCompletaOrcamento({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('input');
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [savedImageUrl, setSavedImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setStep('input');
    setInputText('');
    setSelectedFile(null);
    setExtractedData(null);
    setSavedImageUrl(null);
    setLoading(false);
    if (onClose) onClose();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Por favor, envie uma imagem (JPG, PNG ou WEBP)');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 10MB.');
        return;
      }
      
      setSelectedFile(file);
      setInputText('');
    }
  };

  const handleProcess = async () => {
    if (!inputText && !selectedFile) {
      toast.error('Por favor, cole um texto ou envie uma imagem do orçamento.');
      return;
    }

    setLoading(true);
    setStep('processing');

    try {
      let fileUrl = null;
      
      if (selectedFile) {
        toast.info('Salvando imagem original...');
        const uploadResult = await base44.integrations.Core.UploadFile({ file: selectedFile });
        fileUrl = uploadResult.file_url;
        setSavedImageUrl(fileUrl);
      }

      toast.info('Carregando dados da base...');
      const [clientes, vendedores] = await Promise.all([
        base44.entities.Cliente.list(),
        base44.entities.Vendedor.list()
      ]);

      const clientesInfo = clientes.map(c => ({
        id: c.id,
        razao_social: c.razao_social,
        nome_fantasia: c.nome_fantasia,
        cnpj: c.cnpj,
        telefone: c.telefone
      }));

      const vendedoresInfo = vendedores.map(v => ({
        id: v.id,
        nome: v.nome,
        codigo: v.codigo,
        email: v.email
      }));

      const prompt = `Analise este orçamento e extraia TODOS os dados estruturados.

${inputText || 'Veja a imagem anexada.'}

CLIENTES DISPONÍVEIS NA BASE:
${JSON.stringify(clientesInfo, null, 2)}

VENDEDORES DISPONÍVEIS NA BASE:
${JSON.stringify(vendedoresInfo, null, 2)}

INSTRUÇÕES:
1. IDENTIFIQUE o cliente pelo nome, CNPJ ou qualquer informação que apareça
2. Se encontrar o cliente na base, use o ID dele. Se não encontrar, extraia os dados para criar novo.
3. IDENTIFIQUE o vendedor/atendente responsável
4. Se não houver vendedor explícito, use "Atendente" ou o primeiro vendedor da lista
5. EXTRAIA todos os itens/produtos com quantidade, descrição e valores
6. EXTRAIA datas, condições de pagamento, observações

RETORNE o JSON estruturado conforme o schema.`;

      const schema = {
        type: "object",
        properties: {
          cliente_encontrado: {
            type: "boolean",
            description: "Se o cliente foi encontrado na base de dados"
          },
          cliente_id: {
            type: "string",
            description: "ID do cliente na base (se encontrado)"
          },
          cliente_nome: {
            type: "string",
            description: "Nome/Razão Social do cliente"
          },
          cliente_cnpj: {
            type: "string",
            description: "CNPJ do cliente (se houver)"
          },
          cliente_telefone: {
            type: "string",
            description: "Telefone do cliente (se houver)"
          },
          cliente_email: {
            type: "string",
            description: "Email do cliente (se houver)"
          },
          vendedor_encontrado: {
            type: "boolean",
            description: "Se o vendedor foi encontrado na base"
          },
          vendedor_id: {
            type: "string",
            description: "ID do vendedor na base (se encontrado)"
          },
          vendedor_nome: {
            type: "string",
            description: "Nome do vendedor/atendente"
          },
          numero_orcamento: {
            type: "string",
            description: "Número do orçamento (se houver)"
          },
          data_orcamento: {
            type: "string",
            description: "Data de emissão (formato YYYY-MM-DD)"
          },
          data_validade: {
            type: "string",
            description: "Data de validade (formato YYYY-MM-DD)"
          },
          condicao_pagamento: {
            type: "string",
            description: "Condições de pagamento"
          },
          observacoes: {
            type: "string",
            description: "Observações gerais do orçamento"
          },
          valor_total: {
            type: "number",
            description: "Valor total do orçamento"
          },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                codigo: { type: "string" },
                nome: { type: "string" },
                descricao: { type: "string" },
                quantidade: { type: "number" },
                valor_unitario: { type: "number" },
                valor_total: { type: "number" }
              }
            }
          }
        },
        required: ["cliente_nome", "itens"]
      };

      toast.info('IA analisando orçamento completo...');
      const iaResult = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema,
        file_urls: fileUrl ? [fileUrl] : undefined,
      });

      if (!iaResult || !iaResult.itens || iaResult.itens.length === 0) {
        toast.warning('Nenhum item foi encontrado no orçamento.');
        setStep('input');
        setLoading(false);
        return;
      }

      setExtractedData(iaResult);
      setStep('review');
      toast.success(`✅ Orçamento extraído com sucesso! ${iaResult.itens.length} itens encontrados.`);
      
    } catch (error) {
      console.error('Erro ao processar orçamento:', error);
      toast.error('Erro ao processar: ' + error.message);
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!extractedData) {
      toast.warning('Nenhum dado para confirmar.');
      return;
    }

    // Verificar duplicata por numero_orcamento antes de prosseguir
    if (extractedData.numero_orcamento) {
      try {
        const existentes = await base44.entities.Orcamento.filter({ numero_orcamento: extractedData.numero_orcamento });
        if (existentes && existentes.length > 0) {
          toast.error(
            `⚠️ Orçamento #${extractedData.numero_orcamento} já existe no sistema para "${existentes[0].cliente_nome}". Importação cancelada para evitar duplicata.`,
            { duration: 6000 }
          );
          return;
        }
      } catch (e) {
        // Se falhar a verificação, deixa prosseguir
        console.warn('Aviso: não foi possível verificar duplicata', e);
      }
    }

    onSuccess({
      dadosCabecalho: {
        cliente_id: extractedData.cliente_id,
        cliente_nome: extractedData.cliente_nome,
        cliente_cnpj: extractedData.cliente_cnpj,
        cliente_telefone: extractedData.cliente_telefone,
        cliente_email: extractedData.cliente_email,
        vendedor_id: extractedData.vendedor_id,
        vendedor_nome: extractedData.vendedor_nome,
        numero_orcamento: extractedData.numero_orcamento,
        data_orcamento: extractedData.data_orcamento,
        data_validade: extractedData.data_validade,
        condicao_pagamento: extractedData.condicao_pagamento,
        observacoes: extractedData.observacoes,
        valor_total: extractedData.valor_total
      },
      itens: extractedData.itens,
      imagemOriginal: savedImageUrl,
      cliente_encontrado: extractedData.cliente_encontrado,
      vendedor_encontrado: extractedData.vendedor_encontrado
    });

    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-amber-400" />
            Importação Completa de Orçamento
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Cole o texto ou envie uma imagem do orçamento. A IA extrairá TODOS os dados automaticamente.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-6 py-4">
            <div>
              <Label className="text-slate-300 mb-2 block">Cole o texto do orçamento aqui:</Label>
              <Textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setSelectedFile(null);
                }}
                placeholder="Cole todo o conteúdo do orçamento (cabeçalho + itens)..."
                className="h-40 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-700"></div>
              <span className="text-slate-500 text-sm font-semibold">OU</span>
              <div className="flex-1 h-px bg-slate-700"></div>
            </div>

            <div>
              <Label className="text-slate-300 mb-2 block">Envie uma imagem (screenshot) do orçamento:</Label>
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-amber-500 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload-completo"
                />
                <label htmlFor="file-upload-completo" className="cursor-pointer">
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
                      <p className="text-slate-300">Clique ou arraste uma imagem do orçamento</p>
                      <p className="text-slate-500 text-sm">JPG, PNG ou WEBP (máx 10MB)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <Button
              onClick={handleProcess}
              disabled={!inputText && !selectedFile}
              className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 text-white font-semibold py-3"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Importar Orçamento Completo com IA
            </Button>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-16 flex flex-col items-center justify-center">
            <Loader2 className="w-16 h-16 text-amber-400 animate-spin mb-4" />
            <p className="text-lg text-slate-300 font-semibold">IA analisando orçamento completo...</p>
            <p className="text-slate-500 text-sm mt-2">Extraindo cliente, vendedor e itens</p>
          </div>
        )}

        {step === 'review' && extractedData && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-semibold text-white">
                Orçamento Extraído com Sucesso!
              </h3>
            </div>

            {savedImageUrl && (
              <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <Label className="text-slate-300 mb-2 block flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Imagem Original Salva
                </Label>
                <img 
                  src={savedImageUrl} 
                  alt="Orçamento Original" 
                  className="w-full max-h-64 object-contain rounded border border-slate-600"
                />
              </div>
            )}

            <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 p-4 rounded-lg border border-blue-700">
              <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                📋 Dados do Cabeçalho
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-400">Cliente:</span>
                  <p className="text-white font-semibold">{extractedData.cliente_nome}</p>
                  {extractedData.cliente_encontrado && (
                    <span className="inline-block px-2 py-1 bg-green-500 text-white text-xs rounded mt-1">
                      ✓ Encontrado na Base
                    </span>
                  )}
                  {!extractedData.cliente_encontrado && (
                    <span className="inline-block px-2 py-1 bg-amber-500 text-white text-xs rounded mt-1">
                      ⚠ Cliente Novo
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400">Vendedor:</span>
                  <p className="text-white font-semibold">{extractedData.vendedor_nome || 'Atendente'}</p>
                  {extractedData.vendedor_encontrado && (
                    <span className="inline-block px-2 py-1 bg-green-500 text-white text-xs rounded mt-1">
                      ✓ Encontrado na Base
                    </span>
                  )}
                </div>
                {extractedData.numero_orcamento && (
                  <div>
                    <span className="text-slate-400">Nº Orçamento:</span>
                    <p className="text-white">{extractedData.numero_orcamento}</p>
                  </div>
                )}
                {extractedData.data_orcamento && (
                  <div>
                    <span className="text-slate-400">Data:</span>
                    <p className="text-white">{new Date(extractedData.data_orcamento).toLocaleDateString('pt-BR')}</p>
                  </div>
                )}
                {extractedData.condicao_pagamento && (
                  <div className="col-span-2">
                    <span className="text-slate-400">Pagamento:</span>
                    <p className="text-white">{extractedData.condicao_pagamento}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <h4 className="font-bold text-white mb-3">📦 Itens Extraídos ({extractedData.itens.length})</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {extractedData.itens.map((item, idx) => (
                  <div key={idx} className="bg-slate-700 p-3 rounded border border-slate-600">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-white font-semibold">{item.nome}</p>
                        {item.descricao && (
                          <p className="text-slate-400	text-sm">{item.descricao}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-white">Qtd: {item.quantidade}</p>
                        <p className="text-green-400 font-bold">
                          R$ {(item.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 p-4 rounded-lg border border-green-700">
              <div className="flex justify-between items-center">
                <span className="text-lg text-slate-300">Valor Total:</span>
                <span className="text-2xl font-bold text-green-400">
                  R$ {(extractedData.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {(!extractedData.cliente_encontrado || !extractedData.vendedor_encontrado) && (
              <div className="bg-amber-900/30 p-4 rounded-lg border border-amber-700 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-200">
                  <p className="font-semibold mb-1">Atenção:</p>
                  {!extractedData.cliente_encontrado && (
                    <p>• Cliente não encontrado na base. Será criado automaticamente.</p>
                  )}
                  {!extractedData.vendedor_encontrado && (
                    <p>• Vendedor não encontrado. Usando "Atendente" como padrão.</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('input')}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Voltar
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Confirmar e Preencher Orçamento
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}