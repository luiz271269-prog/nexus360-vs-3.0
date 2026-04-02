import React, { useEffect } from 'react';
import { FileText, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OrcamentoImpressao({ orcamento, itens, onClose }) {
  useEffect(() => {
    // Auto-focus para impressão
    window.focus();
  }, []);

  if (!orcamento) return null;

  const totalOrcamento = itens.reduce((acc, item) => acc + (item.valor_total || 0), 0);
  const dataFormatada = new Intl.DateTimeFormat('pt-BR').format(new Date(orcamento.data_orcamento));
  const dataVencimentoFormatada = orcamento.data_vencimento ? new Intl.DateTimeFormat('pt-BR').format(new Date(orcamento.data_vencimento)) : '-';

  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* TOOLBAR DE IMPRESSÃO */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-slate-900">Visualizar Impressão - Orçamento #{orcamento.numero_orcamento}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Imprimir / PDF
          </Button>
          {onClose && (
            <Button
              onClick={onClose}
              variant="outline"
              className="text-slate-600"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* CONTEÚDO IMPRIMÍVEL */}
      <div className="pt-20 pb-12 px-8 max-w-4xl mx-auto print:pt-0 print:px-0 print:max-w-none">
        
        {/* HEADER */}
        <div className="mb-8 pb-8 border-b-2 border-slate-300">
          <div className="grid grid-cols-3 gap-6 items-start">
            {/* LOGO/EMPRESA */}
            <div>
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white font-bold text-2xl mb-2">
                🏢
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Sua Empresa</h1>
              <p className="text-xs text-slate-600 mt-1">CNPJ: 00.000.000/0000-00</p>
              <p className="text-xs text-slate-600">São Paulo - SP</p>
            </div>

            {/* TÍTULO E Nº */}
            <div className="text-center">
              <h2 className="text-4xl font-bold text-blue-600 mb-2">ORÇAMENTO</h2>
              <p className="text-lg font-bold text-slate-900">#{orcamento.numero_orcamento || 'S/N'}</p>
              <div className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
                orcamento.status === 'aprovado' ? 'bg-green-100 text-green-700' :
                orcamento.status === 'rejeitado' ? 'bg-red-100 text-red-700' :
                orcamento.status === 'enviado' ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {orcamento.status?.toUpperCase() || 'RASCUNHO'}
              </div>
            </div>

            {/* DATAS */}
            <div className="text-right">
              <div className="mb-4">
                <p className="text-xs text-slate-600 font-semibold">DATA EMISSÃO</p>
                <p className="text-lg font-bold text-slate-900">{dataFormatada}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-semibold">DATA VENCIMENTO</p>
                <p className="text-lg font-bold text-slate-900">{dataVencimentoFormatada}</p>
              </div>
            </div>
          </div>
        </div>

        {/* CLIENTE E VENDEDOR */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          {/* CLIENTE */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-xs font-bold text-slate-600 uppercase mb-3">👤 Cliente</h3>
            <p className="text-sm font-bold text-slate-900 mb-1">{orcamento.cliente_nome}</p>
            {orcamento.cliente_empresa && <p className="text-xs text-slate-600 mb-2">{orcamento.cliente_empresa}</p>}
            {orcamento.cliente_telefone && <p className="text-xs text-slate-600">📱 {orcamento.cliente_telefone}</p>}
            {orcamento.cliente_email && <p className="text-xs text-slate-600">📧 {orcamento.cliente_email}</p>}
          </div>

          {/* VENDEDOR */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-xs font-bold text-blue-600 uppercase mb-3">👨‍💼 Vendedor</h3>
            <p className="text-sm font-bold text-slate-900">{orcamento.vendedor || 'Não especificado'}</p>
            {orcamento.condicao_pagamento && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-blue-600 font-semibold">Condição de Pagamento</p>
                <p className="text-sm text-slate-900">{orcamento.condicao_pagamento}</p>
              </div>
            )}
          </div>
        </div>

        {/* ITENS */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 pb-2 border-b-2 border-slate-300">
            📦 Itens do Orçamento ({itens.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="text-left px-3 py-2 font-bold text-slate-900">#</th>
                  <th className="text-left px-3 py-2 font-bold text-slate-900">Descrição</th>
                  <th className="text-center px-3 py-2 font-bold text-slate-900">Qtd</th>
                  <th className="text-right px-3 py-2 font-bold text-slate-900">V. Unit.</th>
                  <th className="text-right px-3 py-2 font-bold text-slate-900">Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-3 text-slate-600 font-semibold">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">{item.nome_produto}</p>
                      {item.descricao && <p className="text-xs text-slate-600 mt-1">{item.descricao}</p>}
                      {item.referencia && <p className="text-xs text-slate-500">Ref: {item.referencia}</p>}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-900 font-semibold">{item.quantidade}</td>
                    <td className="px-3 py-3 text-right text-slate-900">{formatarMoeda(item.valor_unitario)}</td>
                    <td className="px-3 py-3 text-right font-bold text-slate-900">{formatarMoeda(item.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TOTALIZADOR */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div />
          <div />
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border-2 border-blue-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-700">Subtotal:</span>
              <span className="text-lg font-bold text-slate-900">{formatarMoeda(totalOrcamento)}</span>
            </div>
            <div className="pt-3 border-t-2 border-blue-300 flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">TOTAL:</span>
              <span className="text-3xl font-bold text-blue-600">{formatarMoeda(totalOrcamento)}</span>
            </div>
          </div>
        </div>

        {/* OBSERVAÇÕES */}
        {orcamento.observacoes && (
          <div className="mb-8 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h3 className="text-sm font-bold text-amber-900 uppercase mb-2">📝 Observações</h3>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{orcamento.observacoes}</p>
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-12 pt-8 border-t-2 border-slate-300 text-center text-xs text-slate-600">
          <p>Este orçamento é válido por 30 dias a partir da data de emissão.</p>
          <p className="mt-2">Obrigado pela preferência!</p>
          <p className="mt-4 text-slate-400 print:text-slate-600">Gerado em {new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* CSS PARA IMPRESSÃO */}
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:pt-0 {
            padding-top: 0 !important;
          }
          
          .print\\:px-0 {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          
          .print\\:max-w-none {
            max-width: none !important;
          }
          
          .print\\:text-slate-600 {
            color: #4b5563 !important;
          }
          
          table {
            width: 100%;
          }
          
          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}