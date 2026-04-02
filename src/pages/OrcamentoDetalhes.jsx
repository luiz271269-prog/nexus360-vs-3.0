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
  User, Image as ImageIcon } from
'lucide-react';
import { toast } from "sonner";
import { createPageUrl } from '@/utils';
import StatusPipeline from '../components/orcamentos/StatusPipeline';
import { resolverNomeVendedor } from '../components/lib/vendedorSync';
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
  const [estudosAnexos, setEstudosAnexos] = useState([]);

  const location = useLocation();
  const navigate = useNavigate();

  const calcularTotal = useCallback((items) => {
    if (!Array.isArray(items)) return 0;
    return items.
    filter((item) => !item.is_opcional).
    reduce((acc, item) => acc + (parseFloat(item.valor_total) || 0), 0);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(location.search);
      const orcamentoId = params.get('id');
      const carrinhoData = params.get('carrinho');
      const origemChat = params.get('origem') === 'chat';
      const origemImportacao = params.get('importacao') === 'true';
      const mediaUrlFromChat = params.get('media_url');

      const modoOperacao = orcamentoId ? 'edicao' :
      carrinhoData ? 'carrinho' :
      origemChat ? 'chat' :
      origemImportacao ? 'importacao' :
      'novo';

      // Load current user first (always works)
      let currentUser = null;
      try {
        currentUser = await base44.auth.me();
      } catch (e) {/* ignore */}

      // Load vendors safely (User.list() only works for admins)
      let vendedoresData = [];
      try {
        const usersData = await base44.entities.User.list();
        vendedoresData = (usersData || []).
        filter((u) => u.codigo || u.attendant_sector === 'vendas').
        map((u) => ({ id: u.id, nome: u.full_name || u.email, codigo: u.codigo, email: u.email }));
      } catch (userErr) {





        // Non-admin users can't list users — use only current user
      } // Always ensure current user is in the list
      if (currentUser && !vendedoresData.find((v) => v.id === currentUser.id)) {vendedoresData = [{ id: currentUser.id, nome: currentUser.full_name || currentUser.email, email: currentUser.email }, ...vendedoresData];}setVendedores(vendedoresData);

      if (modoOperacao === 'edicao') {
        const [orcData, itensData] = await Promise.all([
        base44.entities.Orcamento.get(orcamentoId),
        base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentoId })]
        );
        // Fase 1: garantir que nome do vendedor reflete User.full_name atual
        if (orcData.vendedor_id) {
          const nomeAtual = await resolverNomeVendedor(orcData.vendedor_id);
          if (nomeAtual && nomeAtual !== orcData.vendedor) {
            orcData.vendedor = nomeAtual;
          }
        }
        setOrcamento(orcData);
        setItens(Array.isArray(itensData) ? itensData : []);

        // Extrai URLs de imagem das observações (criadas via chat) se não estiverem em estudos_anexos
        const anexosExistentes = Array.isArray(orcData.estudos_anexos) ? orcData.estudos_anexos : [];
        const urlsExistentes = new Set(anexosExistentes.map((a) => a.url));
        const urlsExtraidas = [];
        if (orcData.observacoes) {
          const regex = /(?:📎\s*)?[Ii]magem:\s*(https?:\/\/\S+)/g;
          let match;
          while ((match = regex.exec(orcData.observacoes)) !== null) {
            const url = match[1].trim();
            if (!urlsExistentes.has(url)) {
              urlsExtraidas.push({ url, descricao: 'Imagem do chat', data_anexo: orcData.created_date || new Date().toISOString(), tipo_estudo: 'manual', is_opcional: true });
              urlsExistentes.add(url);
            }
          }
        }
        setEstudosAnexos([...anexosExistentes, ...urlsExtraidas]);
      } else if (modoOperacao === 'carrinho') {
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
          setOrcamento({
            cliente_id: null, cliente_nome: "", cliente_telefone: "", cliente_celular: "",
            cliente_email: "", cliente_empresa: "", vendedor: "",
            data_orcamento: new Date().toISOString().slice(0, 10), data_vencimento: "",
            status: "rascunho", valor_total: calcularTotal(itensIniciais),
            observacoes: "Orçamento criado a partir do carrinho de produtos"
          });
          setItens(itensIniciais);
        } catch (error) {
          console.error("Erro ao processar carrinho:", error);
          toast.error("Erro ao carregar produtos do carrinho.");
        }
      } else if (modoOperacao === 'chat') {
        const cliente_nome = params.get('cliente_nome') || '';
        const cliente_telefone = params.get('cliente_telefone') || '';
        const cliente_email = params.get('cliente_email') || '';
        const cliente_empresa = params.get('cliente_empresa') || '';
        const vendedor = params.get('vendedor') || '';
        const observacoes_chat = params.get('observacoes') || '';
        const numero_orcamento = params.get('numero_orcamento') || '';
        const condicao_pagamento = params.get('condicao_pagamento') || '';
        const data_vencimento = params.get('data_vencimento') || '';
        const status_kanban = params.get('status') || 'rascunho';

        let observacoesFinal = '🗨️ OPORTUNIDADE CRIADA DA CENTRAL DE COMUNICAÇÃO\n\n';
        if (observacoes_chat) observacoesFinal += `${decodeURIComponent(observacoes_chat)}\n`;

        let itensExtraidos = [];
        const itensParam = params.get('itens_extraidos');
        if (itensParam) {
          try {
            const itensDecoded = JSON.parse(decodeURIComponent(itensParam));
            itensExtraidos = itensDecoded.map((item, idx) => ({
              _tempId: `chat-ia-${Date.now()}-${idx}`,
              produto_id: null,
              nome_produto: item.nome_produto || '',
              descricao: item.descricao || '',
              marca: item.marca || '',
              modelo: item.modelo || '',
              referencia: item.referencia || item.codigo || '',
              quantidade: parseFloat(item.quantidade || 1),
              valor_unitario: parseFloat(item.valor_unitario || 0),
              valor_total: parseFloat(item.quantidade || 1) * parseFloat(item.valor_unitario || 0),
              is_opcional: false
            }));
            if (itensExtraidos.length > 0) toast.success(`✅ ${itensExtraidos.length} item(ns) extraído(s) da conversa!`, { duration: 3000 });
          } catch (error) {
            console.error('[ORCAMENTO] Erro ao processar itens extraídos:', error);
          }
        }

        if (mediaUrlFromChat) {
          setEstudosAnexos([{ url: mediaUrlFromChat, descricao: 'Imagem do chat', data_anexo: new Date().toISOString(), tipo_estudo: 'manual', is_opcional: false }]);
          observacoesFinal += `\n[Imagem anexada aguardando processamento]\nImagem: ${mediaUrlFromChat}`;
        }

        setOrcamento({
          cliente_id: null,
          cliente_nome: decodeURIComponent(cliente_nome),
          cliente_telefone: decodeURIComponent(cliente_telefone),
          cliente_celular: '',
          cliente_email: decodeURIComponent(cliente_email),
          cliente_empresa: decodeURIComponent(cliente_empresa),
          vendedor: decodeURIComponent(vendedor),
          numero_orcamento: numero_orcamento ? decodeURIComponent(numero_orcamento) : '',
          data_orcamento: new Date().toISOString().slice(0, 10),
          data_vencimento: data_vencimento ? decodeURIComponent(data_vencimento) : '',
          condicao_pagamento: condicao_pagamento ? decodeURIComponent(condicao_pagamento) : '',
          status: status_kanban,
          valor_total: calcularTotal(itensExtraidos),
          observacoes: observacoesFinal
        });
        setItens(itensExtraidos);
      } else if (modoOperacao === 'importacao') {
        const dadosImportados = location.state?.dadosImportados;
        if (dadosImportados) {
          const { dadosCabecalho, itens: importedItens } = dadosImportados;
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
            valor_total: parseFloat(item.quantidade || 0) * parseFloat(item.valor_unitario || 0),
            is_opcional: false
          })) : [];
          setOrcamento({
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
            valor_total: calcularTotal(itensIniciais),
            observacoes: dadosCabecalho?.observacoes ? `[Importado via IA]\n\n${dadosCabecalho.observacoes}` : "[Importado via IA]"
          });
          setItens(itensIniciais);
          toast.success(`✅ Orçamento importado com ${itensIniciais.length} itens!`, { duration: 4000 });
        } else {
          setOrcamento({
            cliente_id: null, cliente_nome: "", cliente_telefone: "", cliente_celular: "",
            cliente_email: "", cliente_empresa: "", vendedor: "",
            data_orcamento: new Date().toISOString().slice(0, 10), data_vencimento: "",
            status: "rascunho", valor_total: 0, observacoes: ""
          });
          setItens([]);
        }
      } else {
        setOrcamento({
          cliente_id: null, cliente_nome: "", cliente_telefone: "", cliente_celular: "",
          cliente_email: "", cliente_empresa: "",
          vendedor: currentUser?.full_name || currentUser?.email || "",
          vendedor_id: currentUser?.id || null,
          data_orcamento: new Date().toISOString().slice(0, 10), data_vencimento: "",
          status: "rascunho", valor_total: 0, observacoes: ""
        });
        setItens([]);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Falha ao carregar dados do orçamento.");
    } finally {
      setLoading(false);
    }
  }, [location.search, location.state, calcularTotal]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // PASTE LISTENER
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
  }, [itens]);

  const somenteAnexarImagem = async (file) => {
    setProcessing(true);
    try {
      toast.info('📤 Anexando imagem...');
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const novoAnexo = { url: uploadResult.file_url, descricao: 'Imagem anexada manualmente', data_anexo: new Date().toISOString(), tipo_estudo: 'manual', is_opcional: true };
      setEstudosAnexos((prev) => [...prev, novoAnexo]);
      toast.success('✅ Imagem anexada!');
    } catch (error) {
      toast.error('❌ Erro ao anexar: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const removerAnexo = (index) => {
    setEstudosAnexos((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleOpcionalAnexo = (index) => {
    setEstudosAnexos((prev) => prev.map((a, i) => i === index ? { ...a, is_opcional: !a.is_opcional } : a));
  };

  const processarImagemCompleta = async (file) => {
    setProcessing(true);
    try {
      toast.info('📤 Salvando imagem...');
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;
      setEstudosAnexos((prev) => [...prev, { url: fileUrl, descricao: 'Processado pela IA (completo)', data_anexo: new Date().toISOString(), tipo_estudo: 'orcamento_completo_ia', is_opcional: false }]);

      toast.info('🔍 Carregando dados da base...');
      const [clientesResult, usersResult] = await Promise.allSettled([
      base44.entities.Cliente.list(),
      base44.entities.User.list()]
      );
      const clientes = clientesResult.status === 'fulfilled' ? clientesResult.value || [] : [];
      const vendedoresBase = usersResult.status === 'fulfilled' ?
      (usersResult.value || []).filter((u) => u.codigo || u.attendant_sector === 'vendas').map((u) => ({ id: u.id, nome: u.full_name || u.email, codigo: u.codigo, email: u.email })) :
      vendedores;

      const clientesInfo = clientes.map((c) => ({ id: c.id, razao_social: c.razao_social, nome_fantasia: c.nome_fantasia, cnpj: c.cnpj, telefone: c.telefone }));
      const vendedoresInfo = vendedoresBase.map((v) => ({ id: v.id, nome: v.nome, codigo: v.codigo, email: v.email }));

      const prompt = `Você é um extrator de dados de orçamentos comerciais. Analise a imagem e extraia os dados com PRECISÃO MÁXIMA.

LISTA DE CLIENTES CADASTRADOS (use o id e razao_social exatos se encontrar correspondência):
${JSON.stringify(clientesInfo, null, 2)}

LISTA DE VENDEDORES CADASTRADOS (use o id e nome exatos se encontrar correspondência):
${JSON.stringify(vendedoresInfo, null, 2)}

REGRAS IMPORTANTES:
1. "cliente_nome" deve ser o nome da EMPRESA/CLIENTE do orçamento (razão social ou nome fantasia). NÃO deixe vazio.
2. Se o nome do cliente da imagem bater com algum da lista acima, preencha "cliente_id" com o id correspondente.
3. "cliente_empresa" é o mesmo que "cliente_nome" — use o nome da empresa encontrado.
4. Para "vendedor_nome": procure na LISTA DE VENDEDORES acima. Se não encontrar, use o nome que aparece no documento.
5. Extraia: código do orçamento, cliente/empresa, telefone, email, vendedor, data emissão, condição pagamento, itens (código, nome, descrição, quantidade, valor unitário, total), observações.

RETORNE o JSON estruturado conforme o schema.`;

      const schema = {
        type: "object",
        properties: {
          numero_orcamento: { type: "string" },
          cliente_encontrado: { type: "boolean" },
          cliente_id: { type: "string" },
          cliente_nome: { type: "string" },
          cliente_telefone: { type: "string" },
          cliente_email: { type: "string" },
          cliente_empresa: { type: "string" },
          vendedor_encontrado: { type: "boolean" },
          vendedor_nome: { type: "string" },
          data_orcamento: { type: "string" },
          data_validade: { type: "string" },
          condicao_pagamento: { type: "string" },
          observacoes: { type: "string" },
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
        required: ["cliente_nome", "itens", "data_orcamento"]
      };

      toast.info('🤖 IA analisando orçamento...');
      const iaResult = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema, file_urls: [fileUrl] });

      if (!iaResult || !iaResult.itens || iaResult.itens.length === 0) {
        toast.warning('⚠️ Nenhum item foi encontrado no orçamento.');
        return;
      }

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

      const itensAtualizados = [...itens, ...novosItens];
      // Normaliza datas para YYYY-MM-DD
      const parseIADate = (d) => {
        if (!d) return '';
        // já está no formato correto
        if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
        // DD/MM/YYYY
        const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        try {return new Date(d).toISOString().slice(0, 10);} catch {return '';}
      };

      // Resolve vendedor pelo id retornado ou pelo nome exato na lista
      const vendedorResolvido = vendedoresBase.find((v) =>
      iaResult.vendedor_id && v.id === iaResult.vendedor_id ||
      iaResult.vendedor_nome && v.nome?.toLowerCase() === iaResult.vendedor_nome?.toLowerCase()
      );

      setOrcamento((prev) => ({
        ...prev,
        cliente_id: iaResult.cliente_id || prev.cliente_id,
        cliente_nome: iaResult.cliente_nome || prev.cliente_nome,
        cliente_telefone: iaResult.cliente_telefone || prev.cliente_telefone,
        cliente_email: iaResult.cliente_email || prev.cliente_email,
        cliente_empresa: iaResult.cliente_empresa || iaResult.cliente_nome || prev.cliente_empresa,
        vendedor: vendedorResolvido?.nome || iaResult.vendedor_nome || prev.vendedor,
        vendedor_id: vendedorResolvido?.id || prev.vendedor_id,
        numero_orcamento: iaResult.numero_orcamento || prev.numero_orcamento,
        data_orcamento: parseIADate(iaResult.data_orcamento) || prev.data_orcamento,
        data_vencimento: parseIADate(iaResult.data_validade) || prev.data_vencimento,
        condicao_pagamento: iaResult.condicao_pagamento || prev.condicao_pagamento,
        observacoes: `${prev.observacoes ? prev.observacoes + '\n\n' : ''}[\uD83D\uDCC4 Importado via IA - ${new Date().toLocaleString('pt-BR')}]\n\n${iaResult.observacoes || ''}`.trim(),
        valor_total: calcularTotal(itensAtualizados)
      }));
      setItens(itensAtualizados);
      toast.success(`✅ ${novosItens.length} itens extraídos e adicionados!`, { duration: 4000 });
      if (!iaResult.cliente_encontrado) toast.info('ℹ️ Cliente não encontrado na base. Será criado ao salvar.', { duration: 3000 });
      if (!vendedorResolvido) toast.info('ℹ️ Vendedor não encontrado na lista — verifique manualmente.', { duration: 3000 });
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
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;
      setEstudosAnexos((prev) => [...prev, { url: fileUrl, descricao: 'Processado pela IA (itens)', data_anexo: new Date().toISOString(), tipo_estudo: 'itens_ia', is_opcional: true }]);
      const iaResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Extraia TODOS os produtos/itens desta imagem. Para cada um: código, nome, descrição, quantidade, valor unitário, valor total.`,
        response_json_schema: {
          type: "object",
          properties: {
            produtos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  codigo: { type: "string" }, nome: { type: "string" }, descricao: { type: "string" },
                  quantidade: { type: "number" }, valor_unitario: { type: "number" }, valor_total: { type: "number" }
                }
              }
            }
          }
        },
        file_urls: [fileUrl]
      });

      if (!iaResult?.produtos?.length) {toast.warning('⚠️ Nenhum item foi encontrado.');return;}

      const novosItens = iaResult.produtos.map((p) => ({
        _tempId: `import-${Date.now()}-${Math.random()}`,
        produto_id: null, nome_produto: p.nome, descricao: p.descricao || '',
        referencia: p.codigo || '', quantidade: parseFloat(p.quantidade || 0),
        valor_unitario: parseFloat(p.valor_unitario || 0),
        valor_total: parseFloat(p.quantidade || 0) * parseFloat(p.valor_unitario || 0),
        is_opcional: false
      }));

      const itensAtualizados = [...itens, ...novosItens];
      setItens(itensAtualizados);
      setOrcamento((prev) => ({ ...prev, valor_total: calcularTotal(itensAtualizados) }));
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
      if (tipo === 'completo') processarImagemCompleta(file);else
      if (tipo === 'itens') processarApenasItens(file);else
      somenteAnexarImagem(file);
    } else {
      toast.error('Por favor, envie uma imagem.');
    }
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
      _tempId: Date.now().toString(), produto_id: null, nome_produto: '', descricao: '',
      marca: '', modelo: '', referencia: '', quantidade: 1, valor_unitario: 0, valor_total: 0, is_opcional: false
    };
    setItens(Array.isArray(itens) ? [...itens, novoItem] : [novoItem]);
  };

  const atualizarItem = useCallback((itemId, campo, valor) => {
    setItens((prev) => {
      if (!Array.isArray(prev)) return [];
      const updated = prev.map((item) => {
        const id = item.id || item._tempId;
        if (id !== itemId) return item;
        const itemAtualizado = { ...item, [campo]: valor };
        if (campo === 'quantidade' || campo === 'valor_unitario') {
          itemAtualizado.valor_total = (parseFloat(itemAtualizado.quantidade) || 0) * (parseFloat(itemAtualizado.valor_unitario) || 0);
        }
        return itemAtualizado;
      });
      setOrcamento((orcPrev) => ({ ...orcPrev, valor_total: calcularTotal(updated) }));
      return updated;
    });
  }, [calcularTotal]);

  const removerItem = async (itemId) => {
    if (!Array.isArray(itens)) return;
    const itemToRemove = itens.find((item) => (item.id || item._tempId) === itemId);
    if (itemToRemove?.id) {
      try {
        await base44.entities.ItemOrcamento.delete(itemToRemove.id);
        toast.success("Item removido.");
      } catch (error) {
        toast.error("Erro ao remover item.");
        return;
      }
    }
    const itensAtualizados = itens.filter((item) => (item.id || item._tempId) !== itemId);
    setItens(itensAtualizados);
    setOrcamento((prev) => ({ ...prev, valor_total: calcularTotal(itensAtualizados) }));
  };

  const validarFormulario = useCallback(() => {
    if (!orcamento) return false;
    if (!orcamento.cliente_nome) {toast.error("O nome do cliente é obrigatório.");return false;}
    if (!Array.isArray(itens) || itens.length === 0) {toast.error("O orçamento deve ter pelo menos um item.");return false;}
    const invalidItems = itens.filter((item) => !item.nome_produto || parseFloat(item.quantidade) <= 0 || isNaN(parseFloat(item.quantidade)));
    if (invalidItems.length > 0) {toast.error("Preencha todos os campos obrigatórios dos itens.");return false;}
    return true;
  }, [orcamento, itens]);

  const handleSalvar = async () => {
    if (!validarFormulario()) return;
    setSaving(true);
    try {
      const totalCalculado = calcularTotal(itens);
      const orcamentoDataToSave = { ...orcamento, valor_total: totalCalculado, estudos_anexos: estudosAnexos };

      const saveParams = new URLSearchParams(location.search);
      const origemChatSave = saveParams.get('origem') === 'chat';

      let clienteIdFinal = orcamento.cliente_id;
      if (!clienteIdFinal && orcamento.cliente_nome) {
        try {
          const clientesExistentes = await base44.entities.Cliente.filter({ razao_social: orcamento.cliente_nome });
          if (clientesExistentes?.length > 0) {
            clienteIdFinal = clientesExistentes[0].id;
            toast.info(`Cliente "${orcamento.cliente_nome}" já existe no sistema.`);
          } else {
            const novoCliente = await base44.entities.Cliente.create({
              razao_social: orcamento.cliente_nome,
              telefone: orcamento.cliente_telefone,
              email: orcamento.cliente_email,
              nome_fantasia: orcamento.cliente_empresa || orcamento.cliente_nome,
              origem: origemChatSave ? 'WhatsApp' : 'Orçamento'
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

      let savedOrcamento;
      if (orcamento.id) {
        savedOrcamento = await base44.entities.Orcamento.update(orcamento.id, orcamentoDataToSave);
        toast.success('✅ Orçamento atualizado!');
      } else {
        savedOrcamento = await base44.entities.Orcamento.create(orcamentoDataToSave);
        setOrcamento((prev) => ({ ...prev, id: savedOrcamento.id }));
        toast.success('✅ Orçamento criado!');
      }

      if (Array.isArray(itens)) {
        for (const item of itens) {
          const itemData = {
            orcamento_id: savedOrcamento.id,
            produto_id: item.produto_id || null,
            nome_produto: item.nome_produto, descricao: item.descricao,
            marca: item.marca, modelo: item.modelo, referencia: item.referencia,
            quantidade: parseFloat(item.quantidade), valor_unitario: parseFloat(item.valor_unitario),
            valor_total: parseFloat(item.valor_total), is_opcional: item.is_opcional
          };
          if (item.id) {
            await base44.entities.ItemOrcamento.update(item.id, itemData);
          } else {
            const novoItem = await base44.entities.ItemOrcamento.create(itemData);
            setItens((prev) => prev.map((i) => i._tempId === item._tempId ? { ...i, id: novoItem.id, _tempId: undefined } : i));
          }
        }
      }

      if (!orcamento.id) {
        navigate(createPageUrl(`OrcamentoDetalhes?id=${savedOrcamento.id}`), { replace: true });
      }
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
      </div>);

  }

  if (!orcamento) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="bg-slate-800 p-8 border-slate-700 text-center">
          <FileText className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Orçamento não encontrado</h2>
          <Button onClick={() => navigate(createPageUrl('LeadsQualificados'))} className="mt-4 bg-amber-500">
            Voltar aos Orçamentos
          </Button>
        </Card>
      </div>);

  }

  // Display params (no conflict with loadData scope)
  const displayParams = new URLSearchParams(location.search);
  const currentOrcamentoId = displayParams.get('id');
  const currentOrigemChat = displayParams.get('origem') === 'chat';
  const currentOrigemImportacao = displayParams.get('importacao') === 'true';
  const currentCarrinhoData = displayParams.get('carrinho');

  const modoOperacao = currentOrcamentoId ? 'edicao' :
  currentCarrinhoData ? 'carrinho' :
  currentOrigemChat ? 'chat' :
  currentOrigemImportacao ? 'importacao' :
  'novo';

  const getTitulo = () => {
    if (modoOperacao === 'edicao') return `#${orcamento.numero_orcamento || orcamento.id?.slice(-6)}`;
    if (modoOperacao === 'carrinho') return '🛒 Orçamento do Carrinho';
    if (modoOperacao === 'chat') return '🗨️ Oportunidade do Chat';
    if (modoOperacao === 'importacao') return '✨ Orçamento Importado';
    return '📄 Novo Orçamento';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 pb-16">
      {processing &&
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-800 rounded-xl p-8 border border-amber-500 shadow-2xl">
            <Loader2 className="w-16 h-16 text-amber-400 animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-semibold">🤖 IA processando dados...</p>
          </div>
        </div>
      }

      {/* HEADER */}
      <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('LeadsQualificados'))} className="text-white">
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
            {modoOperacao === 'edicao' &&
            <div className="flex flex-col items-start gap-0.5">
                <span className="text-[10px] text-slate-400 font-medium">Etapa do Kanban</span>
                <Select value={orcamento.status || 'rascunho'} onValueChange={(value) => handleSelectChange('status', value)}>
                  <SelectTrigger className="h-8 border border-amber-500/60 bg-amber-500/10 text-amber-300 text-xs font-semibold rounded-full px-3 min-w-[140px] focus:ring-0 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {['rascunho', 'aguardando_cotacao', 'cotando', 'aguardando_analise', 'analisando', 'aguardando_liberacao', 'liberado', 'enviado', 'negociando', 'aprovado', 'rejeitado', 'vencido'].map((s) =>
                  <SelectItem key={s} value={s} className="text-white text-xs">{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                  )}
                  </SelectContent>
                </Select>
              </div>
            }
            {modoOperacao === 'edicao' &&
            <Button variant="outline" size="sm" onClick={() => window.print()} className="text-white border-slate-600 hover:bg-slate-700">
                Imprimir
              </Button>
            }
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



      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-4">

          {/* COLUNA ESQUERDA: IMAGENS ANEXADAS */}
          {(estudosAnexos.length > 0 || modoOperacao === 'edicao') &&
          <div className="w-64 flex-shrink-0">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden sticky top-4">
                {/* Cabeçalho com título + botões de importação */}
                <div className="px-2 pt-1.5 pb-1 border-b border-slate-700">
                  <div className="flex items-center gap-1 mb-1.5">
                    <ImageIcon className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span className="text-[10px] font-semibold text-white">Imagens ({estudosAnexos.length})</span>
                  </div>
                  {(modoOperacao === 'novo' || modoOperacao === 'chat' || modoOperacao === 'edicao') &&
                <div className="flex gap-1">
                      <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && processarImagemCompleta(e.target.files[0])} className="hidden" id="upload-completo" />
                      <label htmlFor="upload-completo" title="Importar Completo" className="cursor-pointer flex-1">
                        <div className="bg-amber-500 hover:bg-amber-600 rounded px-1.5 py-1 flex items-center gap-1 transition-colors">
                          <Sparkles className="w-2.5 h-2.5 text-white flex-shrink-0" />
                          <div>
                            <p className="text-[8px] font-bold text-white leading-none">Importar Completo</p>
                            <p className="text-[7px] text-amber-100 leading-none mt-0.5">IA extrai tudo</p>
                          </div>
                        </div>
                      </label>
                      <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && processarApenasItens(e.target.files[0])} className="hidden" id="upload-itens" />
                      <label htmlFor="upload-itens" title="Importar Itens" className="cursor-pointer flex-1">
                        <div className="bg-purple-500 py-4 rounded hover:bg-purple-600 flex items-center gap-1 transition-colors">
                          <ShoppingCart className="w-2.5 h-2.5 text-white flex-shrink-0" />
                          <div>
                            <p className="text-[8px] font-bold text-white leading-none">Importar Itens</p>
                            <p className="text-[7px] text-purple-100 leading-none mt-0.5">IA extrai produtos</p>
                          </div>
                        </div>
                      </label>
                      <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && somenteAnexarImagem(e.target.files[0])} className="hidden" id="upload-manual" />
                      <label htmlFor="upload-manual" title="Fixar Imagem" className="cursor-pointer flex-1">
                        <div className="bg-blue-500 py-4 rounded hover:bg-blue-600 flex items-center gap-1 transition-colors">
                          <Plus className="w-2.5 h-2.5 text-white flex-shrink-0" />
                          <div>
                            <p className="text-[8px] font-bold text-white leading-none">Fixar Imagem</p>
                            <p className="text-[7px] text-blue-100 leading-none mt-0.5">Somente anexar</p>
                          </div>
                        </div>
                      </label>
                    </div>
                }
                </div>

                <div className="p-2 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
                  {estudosAnexos.length === 0 &&
                <div className="text-center py-6 px-2">
                      <ImageIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">Nenhuma imagem anexada</p>
                    </div>
                }
                  {estudosAnexos.map((anexo, index) => {
                  const dataFormatada = anexo.data_anexo ?
                  new Date(anexo.data_anexo).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }) :
                  null;
                  return (
                    <div key={index} className="bg-slate-700/50 rounded-lg border border-slate-600 overflow-hidden">
                      <div className="flex items-center justify-between px-2 py-1 bg-slate-800/80 border-b border-slate-600">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        anexo.tipo_estudo === 'orcamento_completo_ia' ? 'bg-amber-500 text-white' :
                        anexo.tipo_estudo === 'itens_ia' ? 'bg-purple-500 text-white' :
                        'bg-slate-600 text-slate-300'}`
                        }>
                          {anexo.tipo_estudo === 'orcamento_completo_ia' ? '✨ IA Completo' :
                          anexo.tipo_estudo === 'itens_ia' ? '🛒 IA Itens' : '📎 Manual'}
                        </span>
                        {dataFormatada &&
                        <span className="text-[9px] text-slate-400">{dataFormatada}</span>
                        }
                      </div>
                      <div className="relative">
                        <img
                          src={anexo.url}
                          alt={anexo.descricao || `Anexo ${index + 1}`}
                          className="w-full h-32 object-contain bg-slate-900 cursor-pointer"
                          onClick={() => window.open(anexo.url, '_blank')} />
                        
                      </div>
                      <div className="p-1.5 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={!anexo.is_opcional}
                            onChange={() => toggleOpcionalAnexo(index)}
                            className="w-3 h-3 flex-shrink-0"
                            title="Marcar como obrigatório" />
                          
                          <span className="text-[9px] text-slate-400 truncate">{anexo.descricao || `Anexo ${index + 1}`}</span>
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0">
                          <Button
                            size="sm"
                            className="h-5 w-5 p-0 bg-amber-500 hover:bg-amber-600"
                            onClick={async () => {
                              const resp = await fetch(anexo.url);
                              const blob = await resp.blob();
                              processarImagemCompleta(new File([blob], 'reimport.png', { type: blob.type }));
                            }}
                            title="Reprocessar com IA">
                            
                            <Sparkles className="w-2.5 h-2.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-red-400 hover:text-red-300"
                            onClick={() => removerAnexo(index)}>
                            
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                      </div>
                    </div>);

                })}
                </div>
              </div>
            </div>
          }

          {/* COLUNA DIREITA: CONTEÚDO PRINCIPAL */}
          <div className="flex-1 min-w-0 space-y-4">

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
                <Input name="numero_orcamento" value={orcamento.numero_orcamento || ''} onChange={handleOrcamentoChange} placeholder="Código do orçamento" className="bg-slate-900 border-slate-600 text-white h-9 text-sm" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1">Cliente *</Label>
                <ClienteCombobox value={orcamento.cliente_nome} onChange={(value) => handleSelectChange('cliente_nome', value)} />
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
                <Select value={orcamento.vendedor_id || ''} onValueChange={(value) => {
                      const v = vendedores.find((u) => u.id === value);
                      setOrcamento((prev) => ({ ...prev, vendedor_id: value, vendedor: v?.nome || v?.email || '' }));
                    }}>
                  <SelectTrigger className="bg-slate-900 border-slate-600 text-white h-9 text-sm">
                    <SelectValue placeholder={orcamento.vendedor || 'Selecionar vendedor'} />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {vendedores.map((v) =>
                        <SelectItem key={v.id} value={v.id} className="text-white text-sm">{v.nome || v.email}</SelectItem>
                        )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1">Data Orçamento</Label>
                <Input name="data_orcamento" type="date" value={orcamento.data_orcamento || ''} onChange={handleOrcamentoChange} className="bg-slate-900 border-slate-600 text-white h-9 text-sm" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1">Validade</Label>
                <Input name="data_vencimento" type="date" value={orcamento.data_vencimento || ''} onChange={handleOrcamentoChange} className="bg-slate-900 border-slate-600 text-white h-9 text-sm" />
              </div>
              <div>
                <Label className="text-slate-300 text-xs mb-1">Cond. Pagamento</Label>
                <Input name="condicao_pagamento" value={orcamento.condicao_pagamento || ''} onChange={handleOrcamentoChange} placeholder="Ex: 30/60/90" className="bg-slate-900 border-slate-600 text-white h-9 text-sm" />
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
          <CardHeader className="px-3 flex flex-col space-y-1.5">
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
                </div>);

                })}
          </CardContent>
        </Card>

        {/* PLANOS DE PAGAMENTO */}
        {orcamento.valor_total > 0 &&
            <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Planos de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlanosPagamento orcamentoId={currentOrcamentoId || 'temp'} valorTotal={orcamento.valor_total} onPlanosChange={() => {}} />
            </CardContent>
          </Card>
            }

          </div> {/* fim coluna direita */}
        </div> {/* fim flex */}
      </div>
    </div>);

}