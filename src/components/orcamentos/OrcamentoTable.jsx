
import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Phone, Mail, Brain, MessageSquare } from "lucide-react";
import StatusPipeline from './StatusPipeline';
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner"; // Changed from 'react-hot-toast' to 'sonner'

// Definir as etapas
const etapasFluxo = {
  interna: {
    title: 'Etapa Interna',
    subtitle: 'Sistema • Compras • Gerência',
    statuses: ['rascunho', 'aguardando_cotacao', 'analisando', 'liberado'],
    color: 'from-blue-600/90 via-indigo-600/90 to-purple-600/90'
  },
  negociacao: {
    title: 'Etapa de Negociação',
    subtitle: 'Vendedor • Cliente',
    statuses: ['enviado', 'negociando', 'aprovado', 'rejeitado', 'vencido'],
    color: 'from-orange-600/90 via-amber-600/90 to-yellow-600/90'
  }
};

export default function OrcamentoTable({ orcamentos, onEdit, onUpdateStatus, usuario, onDelete, onDuplicar }) { // Removed onMostrarInsightsIA, onAbrirComunicacao; Added onDelete, onDuplicar
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState(null);

  const navigate = useNavigate();

  const formatCurrency = (value) => {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const handleOrcamentoClick = (orcamento) => {
    setOrcamentoSelecionado(orcamento);
  };

  const handleStatusChange = (novoStatus) => {
    if (orcamentoSelecionado && typeof onUpdateStatus === 'function') {
      onUpdateStatus(orcamentoSelecionado.id, novoStatus);
    } else {
      console.error('onUpdateStatus não é uma função ou orçamento não selecionado');
      toast.error('Erro ao atualizar status. Orçamento não selecionado ou função de atualização inválida.');
    }
  };

  // ✅ NOVA FUNÇÃO: Abrir WhatsApp com Contexto
  const abrirWhatsAppComContexto = async (orcamento) => {
    try {
      const telefone = orcamento.cliente_telefone || orcamento.cliente_celular;

      if (!telefone || telefone.trim() === '') {
        toast.error('❌ Número de WhatsApp não encontrado', {
          description: 'Este orçamento não possui telefone cadastrado.',
          duration: 5000
        });
        return;
      }

      const telefoneNormalizado = telefone.replace(/\D/g, '');

      if (telefoneNormalizado.length < 10) {
        toast.error('❌ Número de telefone inválido', {
          description: 'O número de telefone não parece ser um número válido.',
          duration: 5000
        });
        return;
      }

      const urlParams = new URLSearchParams({
        orcamentoId: orcamento.id,
        clienteTelefone: telefoneNormalizado,
        clienteNome: orcamento.cliente_nome,
        orcamentoNumero: orcamento.numero_orcamento || '',
        valorTotal: orcamento.valor_total || 0
      });

      toast.success('📱 Abrindo WhatsApp...', {
        description: `Iniciando conversa com ${orcamento.cliente_nome}`,
        duration: 2000
      });

      navigate(`${createPageUrl('Comunicacao')}?${urlParams.toString()}`);

    } catch (error) {
      console.error('[TABLE] ❌ Erro ao abrir WhatsApp:', error);
      toast.error('Erro ao abrir WhatsApp');
    }
  };

  // Agrupar orçamentos por etapa
  const orcamentosPorEtapa = Object.keys(etapasFluxo).reduce((acc, etapa) => {
    acc[etapa] = orcamentos.filter(o => etapasFluxo[etapa].statuses.includes(o.status));
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Pipeline com destaque do orçamento selecionado */}
      {orcamentoSelecionado && (
        <div className="bg-gradient-to-br from-white via-orange-50/30 to-white rounded-xl p-4 border-2 border-orange-200 shadow-lg">
          <h3 className="text-lg font-semibold bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 bg-clip-text text-transparent mb-3 flex items-center gap-2">
            📍 Posição no Fluxo: {orcamentoSelecionado.cliente_nome}
          </h3>
          <StatusPipeline
            orcamentos={orcamentos}
            currentStatus={orcamentoSelecionado.status}
            onStatusChange={handleStatusChange}
            showInteractive={true}
            usuario={usuario}
          />
        </div>
      )}

      {/* Lista em Duas Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(etapasFluxo).map(([etapaKey, etapa]) => {
          const orcamentosEtapa = orcamentosPorEtapa[etapaKey];

          return (
            <div key={etapaKey} className={`bg-gradient-to-br from-white via-slate-50/50 to-white rounded-2xl p-4 border border-slate-200/50 shadow-lg`}>
              {/* Header da Etapa */}
              <div className="mb-4">
                <h2 className={`font-bold text-lg mb-1 bg-gradient-to-r ${etapa.color} bg-clip-text text-transparent`}>{etapa.title}</h2>
                <div className="flex justify-between items-center text-sm">
                  <p className="text-slate-600">{etapa.subtitle}</p>
                  <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg px-3 py-1">
                    <span className="text-amber-400 font-semibold">{orcamentosEtapa.length}</span>
                    <span className="text-slate-300 text-sm ml-2">
                      {formatCurrency(orcamentosEtapa.reduce((sum, o) => sum + (o.valor_total || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabela da Etapa */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {orcamentosEtapa.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-slate-300 text-4xl mb-2">📋</div>
                    <p className="text-slate-500 text-sm">Nenhum orçamento nesta etapa</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-800 hover:to-slate-700 border-b border-slate-600">
                        <TableHead className="text-slate-300 font-semibold text-xs py-2 px-3">Cliente</TableHead>
                        <TableHead className="text-slate-300 font-semibold text-xs py-2 px-3">Status</TableHead>
                        <TableHead className="text-slate-300 font-semibold text-xs py-2 px-3 text-right">Valor</TableHead>
                        <TableHead className="text-slate-300 font-semibold text-xs py-2 px-3 text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orcamentosEtapa.map((orcamento) => {
                        const temTelefone = orcamento.cliente_telefone || orcamento.cliente_celular;

                        return (
                          <TableRow
                            key={orcamento.id}
                            className={`
                              hover:bg-orange-50 transition-colors border-b border-slate-200 last:border-b-0 cursor-pointer
                              ${orcamentoSelecionado?.id === orcamento.id ? 'bg-orange-50 ring-2 ring-orange-300' : ''}
                            `}
                            onClick={() => handleOrcamentoClick(orcamento)}
                          >
                            <TableCell className="py-2 px-3 leading-tight">
                              <div className="font-medium text-slate-800 text-sm">{orcamento.cliente_nome}</div>
                              <div className="text-xs text-slate-500 space-x-2">
                                <span>#{orcamento.numero_orcamento || orcamento.id?.slice(-6)}</span>
                                {orcamento.vendedor && <span>• {orcamento.vendedor}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="py-2 px-3">
                              <Badge variant="outline" className="text-xs font-normal border-orange-300 text-orange-700">
                                {orcamento.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 px-3 text-right leading-tight">
                              <span className="font-semibold text-sm bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                {formatCurrency(orcamento.valor_total)}
                              </span>
                              <div className="text-xs text-slate-500">
                                {formatDate(orcamento.data_orcamento)}
                              </div>
                            </TableCell>
                            <TableCell className="py-2 px-3 text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(orcamento);
                                  }}
                                  className="h-7 w-7 text-slate-500 hover:bg-orange-100 hover:text-orange-700"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>

                                {/* ✅ BOTÃO WHATSAPP */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevents row click from firing
                                    abrirWhatsAppComContexto(orcamento);
                                  }}
                                  className={`h-7 w-7 ${
                                    temTelefone
                                      ? 'text-green-600 hover:bg-green-100 hover:text-green-700'
                                      : 'text-slate-300 cursor-not-allowed'
                                  }`}
                                  disabled={!temTelefone}
                                  title={temTelefone ? 'Abrir conversa no WhatsApp' : 'Sem telefone cadastrado'}
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </Button>

                                {/* No outline, the Brain button and old MessageSquare button were removed. */}
                                {/* If onDelete or onDuplicar were to have buttons, they would go here */}

                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
