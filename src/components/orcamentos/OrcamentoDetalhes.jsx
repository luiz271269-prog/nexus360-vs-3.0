import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Orcamento } from '@/entities/Orcamento';
import { Cliente } from '@/entities/Cliente';
import { Produto } from '@/entities/Produto';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Edit, 
  Send, 
  Download, 
  Copy,
  User,
  Calendar,
  DollarSign,
  Package,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function OrcamentoDetalhes({ orcamentoId }) {
  const [searchParams] = useSearchParams();
  const id = orcamentoId || searchParams.get('id');
  
  const [orcamento, setOrcamento] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDetalhes();
  }, [id]);

  const carregarDetalhes = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Buscar orçamento
      const orcamentoData = await Orcamento.list();
      const orcamentoEncontrado = orcamentoData.find(o => o.id === id);
      
      if (orcamentoEncontrado) {
        setOrcamento(orcamentoEncontrado);
        
        // Buscar dados do cliente
        const clientes = await Cliente.list();
        const clienteEncontrado = clientes.find(c => 
          c.razao_social === orcamentoEncontrado.cliente_nome ||
          c.nome_fantasia === orcamentoEncontrado.cliente_nome
        );
        setCliente(clienteEncontrado);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    }
    setLoading(false);
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Aprovado': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'Rejeitado': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Aprovado': return 'bg-green-100 text-green-800 border-green-200';
      case 'Rejeitado': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const formatCurrency = (value) => {
    return (value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div className="text-center py-16">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Orçamento não encontrado</h2>
        <p className="text-slate-600 mb-6">O orçamento que você está procurando não existe ou foi removido.</p>
        <Link to={createPageUrl('Orcamentos')}>
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar aos Orçamentos
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Orcamentos')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">
              Orçamento {orcamento.numero_orcamento}
            </h1>
            <p className="text-gray-300 mt-1">
              Cliente: {orcamento.cliente_nome} • Vendedor: {orcamento.vendedor}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20">
            <Copy className="w-4 h-4 mr-2" />
            Duplicar
          </Button>
          <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20">
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button className="bg-amber-500 hover:bg-amber-600">
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informações Principais */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status e Valor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Status do Orçamento</span>
                <Badge className={getStatusColor(orcamento.status)}>
                  {getStatusIcon(orcamento.status)}
                  <span className="ml-2">{orcamento.status}</span>
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Valor Total</p>
                  <p className="text-xl font-bold text-slate-800">
                    {formatCurrency(orcamento.valor_total)}
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Data</p>
                  <p className="font-semibold text-slate-800">
                    {new Date(orcamento.data_orcamento).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <Clock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Validade</p>
                  <p className="font-semibold text-slate-800">
                    {orcamento.prazo_validade 
                      ? new Date(orcamento.prazo_validade).toLocaleDateString('pt-BR')
                      : 'Não definida'
                    }
                  </p>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Itens</p>
                  <p className="text-xl font-bold text-slate-800">
                    {orcamento.produtos?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Produtos/Serviços */}
          <Card>
            <CardHeader>
              <CardTitle>Produtos e Serviços</CardTitle>
            </CardHeader>
            <CardContent>
              {orcamento.produtos && orcamento.produtos.length > 0 ? (
                <div className="space-y-4">
                  {orcamento.produtos.map((produto, index) => (
                    <div key={index} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800">{produto.nome}</h4>
                        {produto.descricao && (
                          <p className="text-sm text-slate-600">{produto.descricao}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                          <span>Qtd: {produto.quantidade}</span>
                          <span>Valor Unit.: {formatCurrency(produto.valor_unitario)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-800">
                          {formatCurrency(produto.valor_total)}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {/* Total */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-slate-800">Total Geral:</span>
                      <span className="text-2xl font-bold text-green-600">
                        {formatCurrency(orcamento.valor_total)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">
                  Nenhum produto ou serviço adicionado
                </p>
              )}
            </CardContent>
          </Card>

          {/* Observações */}
          {orcamento.observacoes && (
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 whitespace-pre-wrap">
                  {orcamento.observacoes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Dados do Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-600">Empresa</p>
                <p className="font-semibold text-slate-800">{orcamento.cliente_nome}</p>
              </div>
              {cliente && (
                <>
                  {cliente.cnpj && (
                    <div>
                      <p className="text-sm text-slate-600">CNPJ</p>
                      <p className="font-mono text-slate-800">{cliente.cnpj}</p>
                    </div>
                  )}
                  {cliente.email && (
                    <div>
                      <p className="text-sm text-slate-600">E-mail</p>
                      <p className="text-slate-800">{cliente.email}</p>
                    </div>
                  )}
                  {cliente.telefone && (
                    <div>
                      <p className="text-sm text-slate-600">Telefone</p>
                      <p className="text-slate-800">{cliente.telefone}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Condições Comerciais */}
          <Card>
            <CardHeader>
              <CardTitle>Condições Comerciais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-600">Vendedor Responsável</p>
                <p className="font-semibold text-slate-800">{orcamento.vendedor}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Probabilidade</p>
                <p className="font-semibold text-slate-800">{orcamento.probabilidade}</p>
              </div>
              {orcamento.condicao_pagamento && (
                <div>
                  <p className="text-sm text-slate-600">Condição de Pagamento</p>
                  <p className="text-slate-800">{orcamento.condicao_pagamento}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ações */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full bg-green-600 hover:bg-green-700">
                <Send className="w-4 h-4 mr-2" />
                Enviar para Cliente
              </Button>
              <Button variant="outline" className="w-full">
                <Copy className="w-4 h-4 mr-2" />
                Converter em Venda
              </Button>
              <Button variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}