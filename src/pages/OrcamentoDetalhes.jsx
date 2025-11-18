
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft, Save, Plus, Trash2, Loader2, Sparkles, FileText, ShoppingCart, DollarSign,
  User, Upload, Image as ImageIcon, CheckCircle, AlertTriangle
} from 'lucide-react';
import { toast } from "sonner";
import { createPageUrl } from '@/utils';
import StatusPipeline from '../components/orcamentos/StatusPipeline';
import PlanosPagamento from '../components/orcamentos/PlanosPagamento';
import ClienteCombobox from '../components/orcamentos/ClienteCombobox';

export default function OrcamentoDetalhes() {
  const [orcamento, setOrcamento] = useState(null);
  const [itens, setItens] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const [imagemAnexada, setImagemAnexada] = useState(null); // New state for attached image URL

  const location = useLocation();
  const navigate = useNavigate();
  
  const urlParams = new URLSearchParams(location.search);
  const orcamentoId = urlParams.get('id');
  const carrinhoData = urlParams.get('carrinho');
  const origemChat = urlParams.get('origem') === 'chat';
  const origemImportacao = urlParams.get('importacao') === 'true';
  const mediaUrlFromChat = urlParams.get('media_url'); // New URL parameter

  const modoOperacao = orcamentoId ? 'edicao' 
    : carrinhoData ? 'carrinho' 
    : origemChat ? 'chat'
    : origemImportacao ? 'importacao'
    : 'novo';

  const recalculateTotal = useCallback(() => {
    if (!orcamento || !Array.isArray(itens)) return 0;
    const total = itens
      .filter((item) => !item.is_opcional)
      .reduce((acc, item) => acc + (parseFloat(item.valor_total) || 0), 0);
    setOrcamento((prev) => ({ ...prev, valor_total: total }));
    return total;
  }, [itens, orcamento]);

  useEffect(() => {
    if (orcamento && Array.isArray(itens)) {
      recalculateTotal();
    }
  }, [itens, orcamento, recalculateTotal]);

  // NEW FUNCTION: Process image by URL (from chat)
  const processarImagemUrl = useCallback(async (imageUrl) => {
    setProcessing(true);
    try {
      toast.info('🔍 Carregando dados da base...');
      const [clientes, vendedoresBase] = await Promise.all([
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

      const vendedoresInfo = vendedoresBase.map(v => ({
        id: v.id,
        nome: v.nome,
        codigo: v.codigo,
        email: v.email
      }));

      const prompt = `Analise este orçamento/proposta e extraia TODOS os itens/produtos.

CLIENTES DISPONÍVEIS NA BASE:
${JSON.stringify(clientesInfo, null, 2)}

VENDEDORES DISPONÍVEIS NA BASE:
${JSON.stringify(vendedoresInfo, null, 2)}

INSTRUÇÕES:
1. EXTRAIA todos os itens/produtos com quantidade, descrição e valores
2. Se encontrar dados do cliente, extraia também (mas foco principal nos ITENS)
3. EXTRAIA número da proposta, datas, condições de pagamento se houver

RETORNE o JSON estruturado conforme o schema.`;

      const schema = {
        type: "object",
        properties: {
          cliente_encontrado: { type: "boolean" },
          cliente_id: { type: "string" },
          cliente_nome: { type: "string" },
          numero_orcamento: { type: "string" },
          data_orcamento: { type: "string" },
          condicao_pagamento: { type: "string" },
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
        required: ["itens"]
      };

      toast.info('🤖 IA extraindo itens da imagem...');
      const iaResult = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema,
        file_urls: [imageUrl],
      });

      if (!iaResult || !iaResult.itens || iaResult.itens.length === 0) {
        toast.warning('⚠️ Nenhum item foi encontrado na imagem.');
        return;
      }

      // ATUALIZAR CAMPOS SE ENCONTROU DADOS ADICIONAIS
      setOrcamento(prev => ({
        ...prev,
        numero_orcamento: iaResult.numero_orcamento || prev.numero_orcamento,
        observacoes: `${prev.observacoes}\n\n[Imagem processada via IA - ${new Date().toLocaleString()}]\nImagem: ${imageUrl}`.trim()
      }));

      const novosItens = iaResult.itens.map((item, idx) => ({
        _tempId: `chat-img-${Date.now()}-${idx}`,
        produto_id: null,
        nome_produto: item.nome || item.descricao || '',
        descricao: item.descricao || '',
        marca: item.marca || '',
        modelo: item.modelo || '',
        referencia: item.codigo || '',
        quantidade: parseFloat(item.quantidade || 0),
        valor_unitario: parseFloat(item.valor_unitario || 0),
        valor_total: parseFloat(item.quantidade || 0) * parseFloat(item.valor_unitario || 0),
        is_opcional: false
      }));

      setItens(prev => [...prev, ...novosItens]);

      toast.success(`✅ ${novosItens.length} itens extraídos da imagem do chat!`, { duration: 4000 });

    } catch (error) {
      console.error('Erro ao processar imagem do chat:', error);
      toast.error('❌ Erro ao processar imagem: ' + error.message);
    } finally {
      setProcessing(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const vendedoresData = await base44.entities.Vendedor.list();
      setVendedores(Array.isArray(vendedoresData) ? vendedoresData : []);

      if (modoOperacao === 'edicao') {
        const [orcData, itensData] = await Promise.all([
          base44.entities.Orcamento.get(orcamentoId),
          base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentoId })
        ]);
        setOrcamento(orcData);
        setItens(Array.isArray(itensData) ? itensData : []);
      } 
      else if (modoOperacao === 'carrinho') {
        try {
          const produtosCarrinho = JSON.parse(decodeURIComponent(carrinhoData));
          const itensIniciais = Array.isArray(produtosCarrinho) ? produtosCarrinho.map((produto, idx) => ({
            _tempId: `carrinho-${idx}-${Date.now()}`,
            produto_id: produto.id || null,
            nome_produto: produto.nome,
            descricao: produto.descricao || '',
            marca: produto.marca || '',
            modelo: produto.modelo || '',
            referencia: produto.referencia || '',
            quantidade: produto.quantidade || 1,
            valor_unitario: produto.preco_venda || 0,
            valor_total: (produto.quantidade || 1) * (produto.preco_venda || 0),
            is_opcional: produto.is_opcional || false
          })) : [];

          const initialTotal = itensIniciais
            .filter((item) => !item.is_opcional)
            .reduce((acc, item) => acc + (item.valor_total || 0), 0);

          setOrcamento({
            cliente_id: null,
            cliente_nome: "",
            cliente_telefone: "",
            cliente_celular: "",
            cliente_email: "",
            cliente_empresa: "",
            vendedor: "",
            data_orcamento: new Date().toISOString().slice(0, 10),
            data_vencimento: "",
            status: "rascunho",
            valor_total: initialTotal,
            observacoes: "Orçamento criado a partir do carrinho de produtos"
          });

          setItens(itensIniciais);
        } catch (error) {
          console.error("Erro ao processar carrinho:", error);
          toast.error("Erro ao carregar produtos do carrinho.");
        }
      } 
      else if (modoOperacao === 'chat') {
        const cliente_nome = urlParams.get('cliente_nome') || '';
        const cliente_telefone = urlParams.get('cliente_telefone') || '';
        const cliente_email = urlParams.get('cliente_email') || '';
        const vendedor = urlParams.get('vendedor') || '';
        const observacoes_chat = urlParams.get('observacoes') || '';
        const thread_id = urlParams.get('thread_id') || '';
        
        let observacoesFinal = '🗨️ OPORTUNIDADE CRIADA DA CENTRAL DE COMUNICAÇÃO\n\n';
        if (observacoes_chat) {
          observacoesFinal += `Contexto da conversa:\n${decodeURIComponent(observacoes_chat)}\n\n`;
        }
        if (thread_id) {
          observacoesFinal += `Thread ID: ${thread_id}\n`;
        }

        setOrcamento({
          cliente_id: null,
          cliente_nome: decodeURIComponent(cliente_nome),
          cliente_telefone: decodeURIComponent(cliente_telefone),
          cliente_celular: '',
          cliente_email: decodeURIComponent(cliente_email),
          cliente_empresa: '',
          vendedor: decodeURIComponent(vendedor),
          data_orcamento: new Date().toISOString().slice(0, 10),
          data_vencimento: '',
          status: "rascunho",
          valor_total: 0,
          observacoes: observacoesFinal
        });

        setItens([]);
        
        // ✅ SE VEM COM IMAGEM, PROCESSAR AUTOMATICAMENTE
        if (mediaUrlFromChat) {
          setImagemAnexada(mediaUrlFromChat);
          toast.info('🖼️ Imagem detectada do chat! Processando automaticamente...', { duration: 3000 });
          
          setTimeout(() => {
            processarImagemUrl(mediaUrlFromChat);
          }, 1000);
        } else {
          toast.success('🎯 Oportunidade criada! Adicione os itens do orçamento.', { duration: 5000 });
        }
      }
      else if (modoOperacao === 'importacao') {
        const dadosImportados = location.state?.dadosImportados;
        
        if (dadosImportados) {
          const { dadosCabecalho, itens: importedItens } = dadosImportados;
          
          const orcamentoInicial = {
            cliente_id: null,
            cliente_nome: dadosCabecalho?.cliente_nome || "",
            cliente_telefone: dadosCabecalho?.cliente_telefone || "",
            cliente_celular: "",
            cliente_email: dadosCabecalho?.cliente_email || "",
            cliente_empresa: "",
            vendedor: dadosCabecalho?.vendedor_nome || "",
            data_orcamento: dadosCabecalho?.data_orcamento || new Date().toISOString().slice(0, 10),
            data_vencimento: dadosCabecalho?.data_validade || "",
            status: "rascunho",
            valor_total: 0,
            observacoes: dadosCabecalho?.observacoes ? `[Importado via IA]\n\n${dadosCabecalho.observacoes}` : "[Importado via IA]"
          };
          
          const itensIniciais = Array.isArray(importedItens) ? importedItens.map((item, idx) => ({
            _tempId: `import-${Date.now()}-${idx}`,
            produto_id: null,
            nome_produto: item.nome || item.descricao || '',
            descricao: item.descricao || '',
            marca: item.marca || '',
            modelo: item.modelo || '',
            referencia: item.codigo || '',
            quantidade: parseFloat(item.quantidade || 0),
            valor_unitario: parseFloat(item.valor_unitario || 0),
            valor_total: (parseFloat(item.quantidade || 0) * parseFloat(item.valor_unitario || 0)),
            is_opcional: false
          })) : [];
          
          const totalCalculado = itensIniciais.reduce((acc, item) => acc + (item.valor_total || 0), 0);
          orcamentoInicial.valor_total = totalCalculado;
          
          setOrcamento(orcamentoInicial);
          setItens(itensIniciais);
          
          toast.success(`✅ Orçamento importado com ${itensIniciais.length} itens!`, { duration: 4000 });
        } else {
          setOrcamento({
            cliente_id: null,
            cliente_nome: "",
            cliente_telefone: "",
            cliente_celular: "",
            cliente_email: "",
            cliente_empresa: "",
            vendedor: "",
            data_orcamento: new Date().toISOString().slice(0, 10),
            data_vencimento: "",
            status: "rascunho",
            valor_total: 0,
            observacoes: ""
          });
          setItens([]);
        }
      }
      else {
        setOrcamento({
          cliente_id: null,
          cliente_nome: "",
          cliente_telefone: "",
          cliente_celular: "",
          cliente_email: "",
          cliente_empresa: "",
          vendedor: "",
          data_orcamento: new Date().toISOString().slice(0, 10),
          data_vencimento: "",
          status: "rascunho",
          valor_total: 0,
          observacoes: ""
        });

        setItens([]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Falha ao carregar dados do orçamento.");
    } finally {
      setLoading(false);
    }
  }, [orcamentoId, carrinhoData, modoOperacao, location.state, urlParams, mediaUrlFromChat, processarImagemUrl]); // Added processarImagemUrl to dependencies

  useEffect(() => {
    loadData();
  }, [loadData]);

  // PASTE LISTENER - Detecta quando o usuário cola uma imagem
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            toast.info('🖼️ Imagem detectada! Processando com IA...');
            await processarImagemCompleta(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const processarImagemCompleta = async (file) => {
    setProcessing(true);
    try {
      toast.info('📤 Salvando imagem...');
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;
      
      setImagemAnexada(fileUrl); // Update state with the uploaded image URL

      toast.info('🔍 Carregando dados da base...');
      const [clientes, vendedoresBase] = await Promise.all([
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

      const vendedoresInfo = vendedoresBase.map(v => ({
        id: v.id,
        nome: v.nome,
        codigo: v.codigo,
        email: v.email
      }));

      const prompt = `Analise este orçamento e extraia TODOS os dados estruturados.

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
          cliente_encontrado: { type: "boolean" },
          cliente_id: { type: "string" },
          cliente_nome: { type: "string" },
          cliente_cnpj: { type: "string" },
          cliente_telefone: { type: "string" },
          cliente_email: { type: "string" },
          vendedor_encontrado: { type: "boolean" },
          vendedor_id: { type: "string" },
          vendedor_nome: { type: "string" },
          numero_orcamento: { type: "string" },
          data_orcamento: { type: "string" },
          data_validade: { type: "string" },
          condicao_pagamento: { type: "string" },
          observacoes: { type: "string" },
          valor_total: { type: "number" },
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

      toast.info('🤖 IA analisando orçamento...');
      const iaResult = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema,
        file_urls: [fileUrl],
      });

      if (!iaResult || !iaResult.itens || iaResult.itens.length === 0) {
        toast.warning('⚠️ Nenhum item foi encontrado no orçamento.');
        return;
      }

      // PREENCHER CAMPOS DIRETAMENTE
      setOrcamento(prev => ({
        ...prev,
        cliente_id: iaResult.cliente_id || prev.cliente_id,
        cliente_nome: iaResult.cliente_nome || prev.cliente_nome,
        cliente_telefone: iaResult.cliente_telefone || prev.cliente_telefone,
        cliente_email: iaResult.cliente_email || prev.cliente_email,
        vendedor: iaResult.vendedor_nome || prev.vendedor,
        numero_orcamento: iaResult.numero_orcamento || prev.numero_orcamento,
        data_orcamento: iaResult.data_orcamento || prev.data_orcamento,
        data_vencimento: iaResult.data_validade || prev.data_vencimento,
        condicao_pagamento: iaResult.condicao_pagamento || prev.condicao_pagamento,
        observacoes: `${prev.observacoes ? prev.observacoes + '\n\n' : ''}[Importado via IA - ${new Date().toLocaleString()}]\n${iaResult.observacoes || ''}\n\nImagem: ${fileUrl}`.trim()
      }));

      const novosItens = iaResult.itens.map((item, idx) => ({
        _tempId: `ia-${Date.now()}-${idx}`,
        produto_id: null,
        nome_produto: item.nome || item.descricao || '',
        descricao: item.descricao || '',
        marca: item.marca || '',
        modelo: item.modelo || '',
        referencia: item.codigo || '',
        quantidade: parseFloat(item.quantidade || 0),
        valor_unitario: parseFloat(item.valor_unitario || 0),
        valor_total: parseFloat(item.quantidade || 0) * parseFloat(item.valor_unitario || 0),
        is_opcional: false
      }));

      setItens(prev => [...prev, ...novosItens]);

      toast.success(`✅ ${novosItens.length} itens extraídos e adicionados!`, { duration: 4000 });

      if (!iaResult.cliente_encontrado) {
        toast.info('ℹ️ Cliente não encontrado na base. Será criado ao salvar.', { duration: 3000 });
      }
      if (!iaResult.vendedor_encontrado) {
        toast.info('ℹ️ Vendedor não identificado. Verifique o campo.', { duration: 3000 });
      }

    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      toast.error('❌ Erro ao processar: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const processarApenasItens = async (file) => {
    setProcessing(true);
    try {
      toast.info('📤 Salvando imagem...');
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;

      const prompt = `Extraia TODOS os produtos/itens desta imagem. Para cada um: código, nome, descrição, quantidade, valor unitário, valor total.`;

      const schema = {
        type: "object",
        properties: {
          produtos: {
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
        }
      };

      toast.info('🤖 IA extraindo itens...');
      const iaResult = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema,
        file_urls: [fileUrl],
      });

      if (!iaResult || !iaResult.produtos || iaResult.produtos.length === 0) {
        toast.warning('⚠️ Nenhum item foi encontrado.');
        return;
      }

      const novosItens = iaResult.produtos.map(p => ({
        _tempId: `import-${Date.now()}-${Math.random()}`,
        produto_id: null,
        nome_produto: p.nome,
        descricao: p.descricao || '',
        referencia: p.codigo || '',
        quantidade: parseFloat(p.quantidade || 0),
        valor_unitario: parseFloat(p.valor_unitario || 0),
        valor_total: parseFloat(p.quantidade || 0) * parseFloat(p.valor_unitario || 0),
        is_opcional: false
      }));

      setItens(prev => [...prev, ...novosItens]);
      toast.success(`✅ ${novosItens.length} itens adicionados!`);

    } catch (error) {
      console.error('Erro ao processar itens:', error);
      toast.error('❌ Erro: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = (e, tipo) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      if (tipo === 'completo') {
        processarImagemCompleta(file);
      } else {
        processarApenasItens(file);
      }
    } else {
      toast.error('Por favor, envie uma imagem.');
    }
  };

  const handleDragOver = (e, tipo) => {
    e.preventDefault();
    setDragOver(tipo);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleOrcamentoChange = (e) => {
    const { name, value } = e.target;
    setOrcamento((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setOrcamento((prev) => ({ ...prev, [name]: value }));
  };

  const adicionarItemLivre = () => {
    const novoItem = {
      _tempId: Date.now().toString(),
      produto_id: null,
      nome_produto: '',
      descricao: '',
      marca: '',
      modelo: '',
      referencia: '',
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
      is_opcional: false
    };
    setItens(prev => Array.isArray(prev) ? [...prev, novoItem] : [novoItem]);
  };

  const atualizarItem = useCallback((itemId, campo, valor) => {
    setItens(prev => {
      if (!Array.isArray(prev)) return [];
      return prev.map(item => {
        const id = item.id || item._tempId;
        if (id !== itemId) return item;

        const itemAtualizado = { ...item, [campo]: valor };

        if (campo === 'quantidade' || campo === 'valor_unitario' || campo === 'is_opcional') {
          const qtd = parseFloat(itemAtualizado.quantidade) || 0;
          const vlrUnit = parseFloat(itemAtualizado.valor_unitario) || 0;
          itemAtualizado.valor_total = qtd * vlrUnit;
        }

        return itemAtualizado;
      });
    });
  }, []);

  const removerItem = async (itemId) => {
    if (!Array.isArray(itens)) return;
    
    const itemToRemove = itens.find(item => (item.id || item._tempId) === itemId);
    if (itemToRemove && itemToRemove.id) {
      try {
        await base44.entities.ItemOrcamento.delete(itemToRemove.id);
        toast.success("Item removido.");
      } catch (error) {
        console.error("Erro ao remover item:", error);
        toast.error("Erro ao remover item.");
        return;
      }
    }
    setItens(prev => Array.isArray(prev) ? prev.filter(item => {
      const id = item.id || item._tempId;
      return id !== itemId;
    }) : []);
  };

  const validarFormulario = useCallback(() => {
    if (!orcamento) return false;
    if (!orcamento.cliente_nome) {
      toast.error("O nome do cliente é obrigatório.");
      return false;
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      toast.error("O orçamento deve ter pelo menos um item.");
      return false;
    }
    const invalidItems = itens.filter(item =>
      !item.nome_produto ||
      parseFloat(item.quantidade) <= 0 ||
      parseFloat(item.valor_unitario) < 0 ||
      isNaN(parseFloat(item.quantidade)) ||
      isNaN(parseFloat(item.valor_unitario))
    );
    if (invalidItems.length > 0) {
      toast.error("Preencha todos os campos obrigatórios dos itens.");
      return false;
    }
    return true;
  }, [orcamento, itens]);

  const handleSalvar = async () => {
    if (!validarFormulario()) return;

    setSaving(true);
    try {
      let currentOrcamentoId = orcamentoId;
      const totalCalculado = recalculateTotal();

      const orcamentoDataToSave = {
        ...orcamento,
        valor_total: totalCalculado,
      };

      let clienteIdFinal = orcamento.cliente_id;
      if (!clienteIdFinal && orcamento.cliente_nome) {
        try {
          const clientesExistentes = await base44.entities.Cliente.filter({ 
            razao_social: orcamento.cliente_nome 
          });

          if (clientesExistentes && clientesExistentes.length > 0) {
            clienteIdFinal = clientesExistentes[0].id;
            toast.info(`Cliente "${orcamento.cliente_nome}" já existe no sistema.`);
          } else {
            const novoCliente = await base44.entities.Cliente.create({
              razao_social: orcamento.cliente_nome,
              telefone: orcamento.cliente_telefone,
              celular: orcamento.cliente_celular,
              email: orcamento.cliente_email,
              nome_fantasia: orcamento.cliente_empresa || orcamento.cliente_nome,
              origem: modoOperacao === 'chat' ? 'WhatsApp' : 'Orçamento',
            });
            clienteIdFinal = novoCliente.id;
            toast.success(`Novo cliente "${orcamento.cliente_nome}" criado!`);
          }
          
          orcamentoDataToSave.cliente_id = clienteIdFinal;
        } catch (clientError) {
          console.error('Erro ao buscar/criar cliente:', clientError);
          toast.error('Erro ao processar cliente.');
        }
      }

      if (currentOrcamentoId) {
        await base44.entities.Orcamento.update(currentOrcamentoId, orcamentoDataToSave);
      } else {
        const novoOrcamento = await base44.entities.Orcamento.create(orcamentoDataToSave);
        currentOrcamentoId = novoOrcamento.id;
      }

      if (Array.isArray(itens)) {
        for (const item of itens) {
          const itemData = {
            orcamento_id: currentOrcamentoId,
            produto_id: item.produto_id || null,
            nome_produto: item.nome_produto,
            descricao: item.descricao,
            marca: item.marca,
            modelo: item.modelo,
            referencia: item.referencia,
            quantidade: parseFloat(item.quantidade),
            valor_unitario: parseFloat(item.valor_unitario),
            valor_total: parseFloat(item.valor_total),
            is_opcional: item.is_opcional,
          };

          if (item.id) {
            await base44.entities.ItemOrcamento.update(item.id, itemData);
          } else {
            await base44.entities.ItemOrcamento.create(itemData);
          }
        }
      }

      toast.success(currentOrcamentoId && orcamentoId ? '✅ Orçamento atualizado!' : '✅ Orçamento criado!');
      navigate(createPageUrl(`OrcamentoDetalhes?id=${currentOrcamentoId}`), { replace: true });
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
      toast.error('Erro ao salvar orçamento: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="bg-slate-800 p-8 border-slate-700">
          <FileText className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Orçamento não encontrado</h2>
          <Button onClick={() => navigate(createPageUrl('Orcamentos'))} className="mt-4 bg-amber-500">
            Voltar aos Orçamentos
          </Button>
        </Card>
      </div>
    );
  }

  const getTitulo = () => {
    if (modoOperacao === 'edicao') return `#${orcamento.numero_orcamento || orcamento.id?.slice(-6)}`;
    if (modoOperacao === 'carrinho') return '🛒 Orçamento do Carrinho';
    if (modoOperacao === 'chat') return '🗨️ Oportunidade do Chat';
    if (modoOperacao === 'importacao') return '✨ Orçamento Importado';
    return '📄 Novo Orçamento';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 pb-16">
      {processing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-800 rounded-xl p-8 border border-amber-500 shadow-2xl">
            <Loader2 className="w-16 h-16 text-amber-400 animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">🤖 IA processando dados...</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Orcamentos'))} className="text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">{getTitulo()}</h1>
                <p className="text-xs text-slate-400">{Array.isArray(itens) ? itens.length : 0} {itens.length === 1 ? 'item' : 'itens'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right bg-slate-800 rounded-lg px-3 py-1.5 border border-slate-700">
              <p className="text-xs text-slate-400">Total</p>
              <p className="text-xl font-bold text-green-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orcamento.valor_total || 0)}
              </p>
            </div>
            <Button onClick={handleSalvar} disabled={saving} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
              {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="w-4 h-4 mr-2" />} 
              Salvar
            </Button>
          </div>
        </div>
      </div>

      {/* STATUS PIPELINE */}
      {modoOperacao === 'edicao' && (
        <div className="max-w-7xl mx-auto px-4 py-3">
          <StatusPipeline currentStatus={orcamento.status} onStatusChange={(status) => setOrcamento(prev => ({...prev, status}))} />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        
        {/* ✅ PREVIEW DA IMAGEM ANEXADA */}
        {imagemAnexada && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" /> 
                Imagem Anexada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <img 
                src={imagemAnexada} 
                alt="Imagem da proposta" 
                className="w-full max-h-96 object-contain rounded-lg border border-slate-600"
              />
            </CardContent>
          </Card>
        )}

        {/* ZONAS DE IMPORTAÇÃO COM IA */}
        {(modoOperacao === 'novo' || modoOperacao === 'chat') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* IMPORTAÇÃO COMPLETA */}
            <div
              onDrop={(e) => handleDrop(e, 'completo')}
              onDragOver={(e) => handleDragOver(e, 'completo')}
              onDragLeave={handleDragLeave}
              className={`relative border-2 border-dashed rounded-lg p-2 transition-all cursor-pointer ${
                dragOver === 'completo'
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-amber-500/50 bg-gradient-to-br from-amber-900/10 to-orange-900/10 hover:border-amber-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-4 h-4 text-white" />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-white">Importar Orçamento Completo</h3>
                  <p className="text-[10px] text-slate-400">IA extrai cliente, vendedor e itens</p>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && processarImagemCompleta(e.target.files[0])}
                  className="hidden"
                  id="upload-completo"
                />
                <label htmlFor="upload-completo">
                  <Button type="button" size="sm" className="bg-amber-500 hover:bg-amber-600 h-7 px-2">
                    <Sparkles className="w-3 h-3" />
                  </Button>
                </label>
              </div>
            </div>

            {/* IMPORTAÇÃO APENAS ITENS */}
            <div
              onDrop={(e) => handleDrop(e, 'itens')}
              onDragOver={(e) => handleDragOver(e, 'itens')}
              onDragLeave={handleDragLeave}
              className={`relative border-2 border-dashed rounded-lg p-2 transition-all cursor-pointer ${
                dragOver === 'itens'
                  ? 'border-purple-400 bg-purple-500/10'
                  : 'border-purple-500/50 bg-gradient-to-br from-purple-900/10 to-indigo-900/10 hover:border-purple-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-white">Importar Apenas Itens</h3>
                  <p className="text-[10px] text-slate-400">Adicione produtos com IA</p>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && processarApenasItens(e.target.files[0])}
                  className="hidden"
                  id="upload-itens"
                />
                <label htmlFor="upload-itens">
                  <Button type="button" size="sm" className="bg-purple-500 hover:bg-purple-600 h-7 px-2">
                    <Plus className="w-3 h-3" />
                  </Button>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ALERTA DE PASTE */}
        {(modoOperacao === 'novo' || modoOperacao === 'chat') && (
          <Card className="bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/50">
            <CardContent className="p-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <p className="text-xs text-slate-300">
                  <strong className="text-white">💡 Dica:</strong> Cole uma imagem (Ctrl+V) para extração automática!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* DADOS DO ORÇAMENTO */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <User className="w-4 h-4" /> Dados do Orçamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <div>
                <Label className="text-slate-300 text-xs mb-1">Código</Label>
                <Input 
                  name="numero_orcamento" 
                  value={orcamento.numero_orcamento || ''} 
                  onChange={handleOrcamentoChange} 
                  placeholder="Código do orçamento"
                  className="bg-slate-900 border-slate-600 text-white h-9 text-sm" 
                />
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1">Cliente *</Label>
                <ClienteCombobox value={orcamento.cliente_nome} onSelect={(value) => handleSelectChange('cliente_nome', value)} />
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1">Telefone</Label>
                <Input name="cliente_telefone" value={orcamento.cliente_telefone || ''} onChange={handleOrcamentoChange} className="bg-slate-900 border-slate-600 text-white h-9 text-sm" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1">Email</Label>
                <Input name="cliente_email" type="email" value={orcamento.cliente_email || ''} onChange={handleOrcamentoChange} className="bg-slate-900 border-slate-600 text-white h-9 text-sm" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1">Empresa</Label>
                <Input name="cliente_empresa" value={orcamento.cliente_empresa || ''} onChange={handleOrcamentoChange} className="bg-slate-900 border-slate-600 text-white h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div>
                <Label className="text-slate-300 text-xs mb-1">Vendedor</Label>
                <Select value={orcamento.vendedor} onValueChange={(value) => handleSelectChange('vendedor', value)}>
                  <SelectTrigger className="bg-slate-900 border-slate-600 text-white h-9 text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {Array.isArray(vendedores) && vendedores.map((v) => (
                      <SelectItem key={v.id} value={v.nome} className="text-white text-sm">{v.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1">Etapa do Kanban</Label>
                <Select value={orcamento.status} onValueChange={(value) => handleSelectChange('status', value)}>
                  <SelectTrigger className="bg-slate-900 border-slate-600 text-white h-9 text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="rascunho" className="text-white text-sm">Rascunho</SelectItem>
                    <SelectItem value="aguardando_cotacao" className="text-white text-sm">Aguardando Cotação</SelectItem>
                    <SelectItem value="cotando" className="text-white text-sm">Cotando</SelectItem>
                    <SelectItem value="aguardando_analise" className="text-white text-sm">Aguardando Análise</SelectItem>
                    <SelectItem value="analisando" className="text-white text-sm">Analisando</SelectItem>
                    <SelectItem value="aguardando_liberacao" className="text-white text-sm">Aguardando Liberação</SelectItem>
                    <SelectItem value="liberado" className="text-white text-sm">Liberado</SelectItem>
                    <SelectItem value="enviado" className="text-white text-sm">Enviado</SelectItem>
                    <SelectItem value="negociando" className="text-white text-sm">Negociando</SelectItem>
                    <SelectItem value="aprovado" className="text-white text-sm">Aprovado</SelectItem>
                    <SelectItem value="rejeitado" className="text-white text-sm">Rejeitado</SelectItem>
                    <SelectItem value="vencido" className="text-white text-sm">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1">Data Emissão *</Label>
                <Input name="data_orcamento" type="date" value={orcamento.data_orcamento} onChange={handleOrcamentoChange} className="bg-slate-900 border-slate-600 text-white h-9 text-sm" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1">Validade</Label>
                <Input name="data_vencimento" type="date" value={orcamento.data_vencimento || ''} onChange={handleOrcamentoChange} className="bg-slate-900 border-slate-600 text-white h-9 text-sm" />
              </div>
            </div>

            <div>
              <Label className="text-slate-300 text-xs mb-1">Observações</Label>
              <Textarea name="observacoes" value={orcamento.observacoes || ''} onChange={handleOrcamentoChange} className="bg-slate-900 border-slate-600 text-white text-sm h-16" />
            </div>
          </CardContent>
        </Card>

        {/* ITENS */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Itens ({Array.isArray(itens) ? itens.length : 0})
              </CardTitle>
              <Button size="sm" onClick={adicionarItemLivre} className="bg-green-500 hover:bg-green-600 h-8">
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.isArray(itens) && itens.map((item, index) => {
              const itemId = item.id || item._tempId;
              return (
                <div key={itemId} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">#{index + 1}</span>
                    <Button variant="ghost" size="icon" onClick={() => removerItem(itemId)} className="h-6 w-6 text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                    <div className="md:col-span-2">
                      <Input value={item.nome_produto || ''} onChange={(e) => atualizarItem(itemId, 'nome_produto', e.target.value)} placeholder="Nome *" className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
                    </div>
                    <div>
                      <Input type="number" value={item.quantidade || 0} onChange={(e) => atualizarItem(itemId, 'quantidade', e.target.value)} placeholder="Qtd *" className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
                    </div>
                    <div>
                      <Input type="number" step="0.01" value={item.valor_unitario || 0} onChange={(e) => atualizarItem(itemId, 'valor_unitario', e.target.value)} placeholder="Vlr Unit *" className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
                    </div>
                    <div>
                      <Input type="number" value={(item.valor_total || 0).toFixed(2)} readOnly className="bg-slate-900 border-slate-700 text-green-400 font-bold h-8 text-sm" />
                    </div>
                    <div className="flex items-center">
                      <input type="checkbox" checked={item.is_opcional || false} onChange={(e) => atualizarItem(itemId, 'is_opcional', e.target.checked)} className="mr-1" />
                      <span className="text-xs text-slate-400">Opcional</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* PLANOS DE PAGAMENTO */}
        {orcamento.valor_total > 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Planos de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlanosPagamento orcamentoId={orcamentoId || 'temp'} valorTotal={orcamento.valor_total} onPlanosChange={() => {}} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
