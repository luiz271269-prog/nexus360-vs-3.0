
import React, { useState, useEffect } from 'react';
import { Brain, Calculator, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { Produto } from "@/entities/Produto";
import { ImportHistory } from "@/entities/ImportHistory";
import { InvokeLLM, UploadFile } from "@/integrations/Core";

import ConfiguracaoPrecificacaoHeader from '../components/precificacao/ConfiguracaoPrecificacaoHeader';
import GradePrecificacao from '../components/precificacao/GradePrecificacao';
import UploadPrecificacao from '../components/precificacao/UploadPrecificacao';

// Schema especializado para extração comercial avançada
const productSchema = {
  type: "object",
  properties: {
    produtos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          codigo: { type: "string", description: "Código do produto ou SKU" },
          nome: { type: "string", description: "Nome completo do produto" },
          tipo_produto: { type: "string", description: "Tipo/categoria do produto" },
          marca: { type: "string", description: "Marca do produto" },
          modelo: { type: "string", description: "Modelo específico" },
          configuracao: { type: "string", description: "Especificações principais resumidas" },
          descricao: { type: "string", description: "Descrição completa do produto" },
          categoria: { type: "string", description: "Categoria comercial do produto" },
          preco_original: { type: "number", description: "Preço original do produto" },
          moeda_original: { type: "string", enum: ["BRL", "USD", "EUR"], description: "Moeda do preço original" },
          fornecedor_original: { type: "string", description: "Nome do fornecedor" },
          especificacoes_tecnicas: { type: "string", description: "Especificações técnicas detalhadas" }
        },
        required: ["nome", "tipo_produto", "marca", "modelo", "preco_original", "moeda_original"]
      }
    }
  },
  required: ["produtos"]
};

const getAIPrompt = (source, config) => `
**ESPECIALISTA EM ANÁLISE COMERCIAL E IDENTIFICAÇÃO DE PRODUTOS**
Você é um especialista em análise de catálogos comerciais e identificação precisa de produtos para revenda.

**FONTE DOS DADOS:** ${source}
${config.fornecedor ? `**FORNECEDOR CONFIGURADO:** ${config.fornecedor}` : ''}
${config.linkPagina ? `**LINK DE ORIGEM:** ${config.linkPagina}` : ''}

**MISSÃO CRÍTICA:**
Para CADA produto encontrado, identifique com MÁXIMA PRECISÃO:

1. **TIPO DO PRODUTO**: Categoria específica (smartphone, notebook, tablet, monitor, headset, etc.)
2. **MARCA**: Marca exata (Apple, Samsung, Dell, HP, Sony, etc.)
3. **MODELO**: Modelo específico (iPhone 15 Pro, Galaxy S24 Ultra, XPS 13, etc.)
4. **CONFIGURAÇÃO**: Especificações principais resumidas (128GB Space Black, 16GB RAM 512GB SSD, etc.)
5. **PREÇO**: Valor exato com moeda identificada (R$=BRL, $=USD, €=EUR)

**EXEMPLOS DE ANÁLISE CORRETA:**
- Produto: "iPhone 15 Pro 128GB Titânio Natural"
  → tipo_produto: "smartphone", marca: "Apple", modelo: "iPhone 15 Pro", configuracao: "128GB Titânio Natural"

- Produto: "Dell XPS 13 Intel i7 16GB 512GB"
  → tipo_produto: "notebook", marca: "Dell", modelo: "XPS 13", configuracao: "Intel i7 16GB RAM 512GB SSD"

**REGRAS IMPORTANTES:**
- Sempre preencher tipo_produto, marca, modelo e configuracao
- Se informação não estiver clara, use "N/A" mas tente deduzir pelo contexto
- Preserve códigos originais e preços com precisão total
- Priorize informações de custo sobre preço final ao consumidor

**SAÍDA:** JSON estruturado com análise detalhada de cada produto para cálculo de precificação.
`;

export default function Precificacao() {
  const [configPrecificacao, setConfigPrecificacao] = useState(() => {
    const savedConfig = localStorage.getItem('configPrecificacao');
    return savedConfig ? JSON.parse(savedConfig) : {
      fornecedor: '',
      linkPagina: '',
      taxaCambio: 5.20,
      percentualFrete: 20,
      percentualImpostos: 35,
      margemLucro: 40,
      custoOperacional: 8,
      segmentoCliente: 'varejo'
    };
  });

  const [rawAIResult, setRawAIResult] = useState(null);
  const [processedProducts, setProcessedProducts] = useState([]);
  const [dadosOriginais, setDadosOriginais] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    localStorage.setItem('configPrecificacao', JSON.stringify(configPrecificacao));
  }, [configPrecificacao]);

  useEffect(() => {
    if (rawAIResult && rawAIResult.produtos) {
      const produtosAtualizados = rawAIResult.produtos.map(p => {
        const precos = calcularPrecificacao(p, configPrecificacao);
        return { ...p, ...precos };
      });
      setProcessedProducts(produtosAtualizados);
    }
  }, [rawAIResult, configPrecificacao]);

  const calcularPrecificacao = (produto, config) => {
    let custoBase = produto.preco_original || 0;

    if (produto.moeda_original === 'USD') {
      custoBase = custoBase * config.taxaCambio;
      custoBase = custoBase * (1 + config.percentualFrete / 100);
    }

    const custoComImpostos = custoBase * (1 + config.percentualImpostos / 100);
    const custoOperacionalValor = custoComImpostos * (config.custoOperacional / 100);
    const custoTotal = custoComImpostos + custoOperacionalValor;

    const margemFinal = config.margemLucro;
    const precoVendaSugerido = custoTotal * (1 + margemFinal / 100);

    return {
      fornecedor: produto.fornecedor_original || config.fornecedor,
      preco_custo: custoTotal,
      preco_venda: precoVendaSugerido,
    };
  };

  const handleProcessAI = React.useCallback(async (sourceContent, sourceOrigin, sourceType) => {
    setLoading(true);
    setRawAIResult(null);
    setProcessedProducts([]);
    try {
      const prompt = getAIPrompt(sourceOrigin, configPrecificacao);
      const aiParams = { prompt, response_json_schema: productSchema };

      if (sourceType === 'file') {
        aiParams.file_urls = [sourceContent];
      } else {
        aiParams.prompt += `\n\n**DADOS PARA ANÁLISE:**\n${sourceContent}`;
      }

      const result = await InvokeLLM(aiParams);

      if (!result || !result.produtos || result.produtos.length === 0) {
        throw new Error('Nenhum produto comercial foi identificado nos dados fornecidos.');
      }

      setRawAIResult(result);
      setDadosOriginais({ tipo: sourceType, origem: sourceOrigin });

    } catch (error) {
      toast.error(`Erro na análise da IA: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [configPrecificacao]);

  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items || loading) return;

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            toast.info('Imagem colada detectada. Processando...');
            setLoading(true);
            try {
              const fileName = `imagem-colada-${Date.now()}.png`;
              const renamedFile = new File([file], fileName, { type: file.type });
              const { file_url } = await UploadFile({ file: renamedFile });
              await handleProcessAI(file_url, renamedFile.name, 'file');
            } catch (error) {
              toast.error(`Erro ao processar imagem: ${error.message}`);
              setLoading(false);
            }
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [loading, handleProcessAI]);

  const handleConfirmImport = async () => {
    if (!processedProducts || processedProducts.length === 0) {
        toast.error("Nenhum dado para importar.");
        return;
    }
    setProcessing(true);
    try {
      const produtosParaCriar = processedProducts.map(p => ({
        codigo: p.codigo || `AUTO-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        nome: p.nome || `${p.marca || 'Produto'} ${p.modelo || ''}`.trim() || 'Produto Sem Nome', 
        descricao: p.descricao || `${p.tipo_produto || ''} ${p.configuracao || ''}`.trim() || '',
        categoria: p.categoria || p.tipo_produto || 'Outros', // Updated: Use p.tipo_produto if p.categoria is missing
        marca: p.marca || '',
        modelo: p.modelo || '',
        fornecedor: p.fornecedor_original || configPrecificacao.fornecedor || '', // Updated: Prioritize p.fornecedor_original
        preco_custo: p.preco_custo,
        preco_venda: p.preco_venda,
        preco_original: p.preco_original || 0,
        moeda_original: p.moeda_original || 'BRL',
        codigo_fornecedor: p.codigo || '',
        link_origem: configPrecificacao.linkPagina || dadosOriginais?.origem || '',
        data_ultima_cotacao: new Date().toISOString().slice(0, 10),
        configuracao_precificacao: {
          taxa_cambio: configPrecificacao.taxaCambio,
          percentual_frete: configPrecificacao.percentualFrete,
          percentual_impostos: configPrecificacao.percentualImpostos,
          margem_lucro: configPrecificacao.margemLucro,
          custo_operacional: configPrecificacao.custoOperacional
        },
        observacoes: `Importado via IA em ${new Date().toLocaleString('pt-BR')}. Preço original: ${p.moeda_original} ${p.preco_original || 0}. Fonte: ${dadosOriginais?.origem || 'Manual'}. Tipo: ${p.tipo_produto || 'N/A'}. Configuração: ${p.configuracao || 'N/A'}`, // Updated: Added Tipo and Configuração
        ativo: true,
      }));

      // NOTE: The outline specified `base44.entities.Produto.bulkCreate` and `base44.entities.ImportHistory.create`.
      // However, given the current imports (`import { Produto } from "@/entities/Produto";`),
      // directly using `base44.entities` would result in an undefined variable and a non-functional file.
      // To ensure the file remains functional and valid, as per instructions,
      // we continue to use the directly imported `Produto` and `ImportHistory` objects.
      // If `base44` is intended to be the new way to access entities, its import or declaration must be added.
      await Produto.bulkCreate(produtosParaCriar);

      await ImportHistory.create({
        tipo_importacao: 'produtos',
        total_registros: produtosParaCriar.length,
        sucessos: produtosParaCriar.length,
        erros: 0,
        detalhes: {
          fonte: dadosOriginais?.origem || 'Manual',
          link_origem: configPrecificacao.linkPagina,
          fornecedor: configPrecificacao.fornecedor,
          configuracao_precificacao: configPrecificacao,
        }
      });

      toast.success(`${produtosParaCriar.length} produtos importados com sucesso!`);
      setRawAIResult(null);
    } catch (error) {
      toast.error(`Erro ao salvar produtos: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-red-50/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header com Gradiente Laranja */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
                <Calculator className="w-9 h-9 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                  Precificação e Importação
                </h1>
                <p className="text-slate-300 mt-1">
                  Motor inteligente de precificação com IA
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 rounded-md border-2 border-white/50 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 rounded-full blur-2xl"></div>
            <ConfiguracaoPrecificacaoHeader
              config={configPrecificacao}
              onConfigChange={setConfigPrecificacao}
            />
          </div>
          <div className="bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/50 rounded-md border-2 border-white/50 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-400/20 to-purple-500/20 rounded-full blur-2xl"></div>
            <div className="p-1 relative z-10">
              <div className="flex items-center gap-1 mb-1">
                <div className="w-4 h-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
                  <Brain className="w-3 h-3 text-white" />
                </div>
                <h3 className="text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Importação & Análise
                </h3>
                <span className="text-xs text-slate-600">Cole dados ou Ctrl+V</span>
              </div>
              <UploadPrecificacao onProcess={handleProcessAI} loading={loading} />
            </div>
          </div>
        </div>

        <div className="text-center bg-blue-50 border border-blue-200 rounded px-2 py-1">
          <p className="text-xs text-blue-700">
            💡 <strong>Ctrl+V:</strong> Cole imagens diretamente na tela para análise automática
          </p>
        </div>

        {processedProducts.length > 0 && (
          <div className="bg-white/90 backdrop-blur rounded-md border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center p-1 border-b border-slate-200">
              <h2 className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                📊 Análise: {processedProducts.length} produtos
              </h2>
              <div className='flex gap-1'>
                <Button
                  variant="outline"
                  onClick={() => setRawAIResult(null)}
                  disabled={processing}
                  size="sm"
                  className="h-5 text-xs px-2 py-0"
                >
                  Nova
                </Button>
                <Button
                  onClick={handleConfirmImport}
                  disabled={processing}
                  size="sm"
                  className="h-5 text-xs px-2 py-0"
                >
                  {processing ? <Loader2 className="w-2 h-2 mr-1 animate-spin" /> : <Save className="w-2 h-2 mr-1" />}
                  Salvar {processedProducts.length}
                </Button>
              </div>
            </div>
            <div className="p-1">
              <GradePrecificacao produtos={processedProducts} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
