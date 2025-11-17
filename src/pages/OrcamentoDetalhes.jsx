
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
  User, Upload, Image as ImageIcon
} from 'lucide-react';
import { toast } from "sonner";
import { createPageUrl } from '@/utils';
import StatusPipeline from '../components/orcamentos/StatusPipeline';
import PlanosPagamento from '../components/orcamentos/PlanosPagamento';
import ClienteCombobox from '../components/orcamentos/ClienteCombobox';
import IntelligentImporter from '../components/importacao/IntelligentImporter';
import ImportacaoCompletaOrcamento from '../components/importacao/ImportacaoCompletaOrcamento';

export default function OrcamentoDetalhes() {
  const [orcamento, setOrcamento] = useState(null);
  const [itens, setItens] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showImporterItens, setShowImporterItens] = useState(false);
  const [showImporterCompleto, setShowImporterCompleto] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  
  // DETECTAR MODO DE OPERAÇÃO
  const urlParams = new URLSearchParams(location.search);
  const orcamentoId = urlParams.get('id');
  const carrinhoData = urlParams.get('carrinho');
  const origemChat = urlParams.get('origem') === 'chat';
  const origemImportacao = urlParams.get('importacao') === 'true';
  
  // Determinar modo: 'edicao', 'carrinho', 'chat', 'importacao', 'novo'
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const vendedoresData = await base44.entities.Vendedor.list();
      setVendedores(Array.isArray(vendedoresData) ? vendedoresData : []);

      // ========== MODO 1: EDIÇÃO (ID existente) ==========
      if (modoOperacao === 'edicao') {
        const [orcData, itensData] = await Promise.all([
          base44.entities.Orcamento.get(orcamentoId),
          base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentoId })
        ]);
        setOrcamento(orcData);
        setItens(Array.isArray(itensData) ? itensData : []);
      } 
      
      // ========== MODO 2: CARRINHO (Produtos) ==========
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
      
      // ========== MODO 3: CHAT (Criar Oportunidade) ==========
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
        
        toast.success('🎯 Oportunidade criada! Adicione os itens do orçamento.', { duration: 5000 });
      }
      
      // ========== MODO 4: IMPORTAÇÃO (Via IA) ==========
      else if (modoOperacao === 'importacao') {
        const dadosImportados = location.state?.dadosImportados;
        
        if (dadosImportados) {
          const { dadosCabecalho, itens: importedItens } = dadosImportados;
          
          // Preencher dados do orçamento
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
          
          // Mapear itens importados
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
          // Fallback se não houver dados
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
      
      // ========== MODO 5: NOVO (Limpo) ==========
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
  }, [orcamentoId, carrinhoData, modoOperacao, urlParams, location.state]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleImportacaoCompleta = (dadosImportados) => {
    const { dadosCabecalho, itens: importedItens, imagemOriginal, cliente_encontrado, vendedor_encontrado } = dadosImportados;

    if (dadosCabecalho) {
      setOrcamento(prev => {
        const newOrcamento = { ...prev };
        if (dadosCabecalho.cliente_nome) newOrcamento.cliente_nome = dadosCabecalho.cliente_nome;
        if (dadosCabecalho.cliente_telefone) newOrcamento.cliente_telefone = dadosCabecalho.cliente_telefone;
        if (dadosCabecalho.cliente_email) newOrcamento.cliente_email = dadosCabecalho.cliente_email;
        if (dadosCabecalho.vendedor_nome) newOrcamento.vendedor = dadosCabecalho.vendedor_nome;
        if (dadosCabecalho.numero_orcamento) newOrcamento.numero_orcamento = dadosCabecalho.numero_orcamento;
        if (dadosCabecalho.data_orcamento) newOrcamento.data_orcamento = dadosCabecalho.data_orcamento;
        if (dadosCabecalho.data_validade) newOrcamento.data_vencimento = dadosCabecalho.data_validade;
        if (dadosCabecalho.condicao_pagamento) newOrcamento.condicao_pagamento = dadosCabecalho.condicao_pagamento;

        let newObservacoes = prev.observacoes || '';
        if (dadosCabecalho.observacoes) {
          newObservacoes = `${newObservacoes}\n\n[Importado]: ${dadosCabecalho.observacoes}`.trim();
        }
        if (imagemOriginal) {
          newObservacoes = `${newObservacoes}\n\n[Imagem Original]: ${imagemOriginal}`.trim();
        }
        newOrcamento.observacoes = newObservacoes;

        return newOrcamento;
      });
    }

    if (Array.isArray(importedItens) && importedItens.length > 0) {
      const novosItensMapeados = importedItens.map(item => ({
        _tempId: `completa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      }));
      setItens(prev => Array.isArray(prev) ? [...prev, ...novosItensMapeados] : novosItensMapeados);
    }

    toast.success(
      `✅ Orçamento importado!\n${cliente_encontrado ? '✓' : '⚠'} Cliente\n${vendedor_encontrado ? '✓' : '⚠'} Vendedor\n📦 ${Array.isArray(importedItens) ? importedItens.length : 0} itens`,
      { duration: 6000 }
    );
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

  // Título dinâmico baseado no modo
  const getTitulo = () => {
    if (modoOperacao === 'edicao') return `#${orcamento.numero_orcamento || orcamento.id?.slice(-6)}`;
    if (modoOperacao === 'carrinho') return '🛒 Orçamento do Carrinho';
    if (modoOperacao === 'chat') return '🗨️ Oportunidade do Chat';
    if (modoOperacao === 'importacao') return '✨ Orçamento Importado';
    return '📄 Novo Orçamento';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 pb-16">
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
        
        {/* CARDS DE IMPORTAÇÃO - APENAS PARA MODO NOVO */}
        {modoOperacao === 'novo' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 border border-amber-500/50 hover:border-amber-400 transition-all cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white">Importar Orçamento Completo</h3>
                    <p className="text-xs text-slate-400">IA extrai cliente, vendedor e itens</p>
                  </div>
                  <Button size="sm" onClick={() => setShowImporterCompleto(true)} className="bg-amber-500 hover:bg-amber-600 h-8">
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/50 hover:border-purple-400 transition-all cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white">Importar Apenas Itens</h3>
                    <p className="text-xs text-slate-400">Adicione produtos com IA</p>
                  </div>
                  <Button size="sm" onClick={() => setShowImporterItens(true)} className="bg-purple-500 hover:bg-purple-600 h-8">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* BOTÃO DE IMPORTAÇÃO PARA OUTROS MODOS */}
        {(modoOperacao === 'chat' || modoOperacao === 'carrinho') && (
          <Card className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Adicionar Mais Itens com IA</h3>
                    <p className="text-xs text-slate-400">Cole texto ou envie print para adicionar produtos</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => setShowImporterItens(true)} className="bg-purple-500 hover:bg-purple-600 h-8">
                  <Plus className="w-4 h-4 mr-1" /> Importar
                </Button>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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

      {/* MODAIS */}
      <ImportacaoCompletaOrcamento
        isOpen={showImporterCompleto}
        onOpenChange={setShowImporterCompleto}
        onSuccess={handleImportacaoCompleta}
      />

      <IntelligentImporter
        isOpen={showImporterItens}
        onOpenChange={setShowImporterItens}
        title="Importar Itens com IA"
        description="Cole texto ou envie print da lista de produtos"
        aiPromptBase="Extraia TODOS os produtos. Para cada um: código, nome, descrição, quantidade, valor unitário, valor total."
        dataSchema={{
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
        }}
        entityKey="produtos"
        fieldDefinitions={[
          { key: 'codigo', label: 'Código', type: 'text' },
          { key: 'nome', label: 'Nome', type: 'text', required: true },
          { key: 'quantidade', label: 'Qtd', type: 'number', required: true },
          { key: 'valor_unitario', label: 'Vlr Unit.', type: 'number', required: true }
        ]}
        onSuccess={(data) => {
          if (data.produtos && data.produtos.length > 0) {
            const novosItens = data.produtos.map(p => ({
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
            setItens(prev => Array.isArray(prev) ? [...prev, ...novosItens] : novosItens);
            toast.success(`${novosItens.length} itens adicionados!`);
          }
        }}
      />
    </div>
  );
}
