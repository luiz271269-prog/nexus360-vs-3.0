
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, XCircle, Clock, AlertTriangle, Eye, RefreshCw, FileText, Image, Table, Loader2, Brain, RotateCcw, Trash2, Edit, Upload, Merge, Replace, Plus } from "lucide-react";

// Modal de Opções de Reimportação
const ModalReimportacao = ({ processamento, onClose, onConfirm, loading }) => {
  const [opcaoEscolhida, setOpcaoEscolhida] = useState('incrementar');
  const [observacoes, setObservacoes] = useState('');

  const opcoes = {
    incrementar: {
      icon: Plus,
      title: 'Incrementar',
      desc: 'Adiciona apenas dados novos, sem duplicar registros existentes',
      cor: 'bg-green-100 text-green-700 border-green-300'
    },
    sobrescrever: {
      icon: Replace,
      title: 'Sobrescrever',
      desc: 'Substitui completamente os dados existentes pelos novos',
      cor: 'bg-orange-100 text-orange-700 border-orange-300'
    },
    mesclar: {
      icon: Merge,
      title: 'Mesclar',
      desc: 'Combina dados antigos com novos de forma inteligente',
      cor: 'bg-blue-100 text-blue-700 border-blue-300'
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Reimportar Arquivo</h3>
              <p className="text-slate-600">{processamento.nome_arquivo}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h4 className="font-semibold text-slate-700 mb-3">Como deseja tratar os dados?</h4>
            <div className="space-y-3">
              {Object.entries(opcoes).map(([key, opcao]) => (
                <div
                  key={key}
                  onClick={() => setOpcaoEscolhida(key)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    opcaoEscolhida === key ? opcao.cor : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <opcao.icon className="w-5 h-5" />
                    <div>
                      <h5 className="font-semibold">{opcao.title}</h5>
                      <p className="text-sm opacity-80">{opcao.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-lg resize-none"
              rows={3}
              placeholder="Adicione observações sobre esta reimportação..."
            />
          </div>

          <div className="bg-slate-50 rounded-lg p-4">
            <h5 className="font-semibold text-slate-700 mb-2">Informações do Arquivo Original</h5>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Tipo:</span>
                <span className="ml-2 font-medium">{processamento.classificacao_automatica || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500">Data:</span>
                <span className="ml-2 font-medium">{new Date(processamento.created_date).toLocaleDateString('pt-BR')}</span>
              </div>
              <div>
                <span className="text-slate-500">Registros:</span>
                <span className="ml-2 font-medium">{processamento.dados_extraidos?.total_registros || 0}</span>
              </div>
              <div>
                <span className="text-slate-500">Status:</span>
                <span className="ml-2 font-medium">{processamento.status_processamento}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <Button onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm({ opcao: opcaoEscolhida, observacoes })}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Reimportando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Reimportar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function HistoricoImportacao({ processamentos, onRecarregar, loading, onRevisar, onReprocessar }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [showModalReimportacao, setShowModalReimportacao] = useState(null);
  const [reimportacaoLoading, setReimportacaoLoading] = useState(false);

  const getStatusInfo = (status) => {
    const map = {
      sucesso: { icon: CheckCircle, color: "text-green-600", label: "Sucesso", bg: "bg-green-50" },
      erro: { icon: XCircle, color: "text-red-600", label: "Erro", bg: "bg-red-50" },
      processando: { icon: Clock, color: "text-blue-600", label: "Processando", bg: "bg-blue-50" },
      revisao_manual: { icon: AlertTriangle, color: "text-yellow-600", label: "Revisão", bg: "bg-yellow-50" },
      pendente: { icon: Clock, color: "text-slate-500", label: "Pendente", bg: "bg-slate-50" }
    };
    return map[status] || map.pendente;
  };

  const getTipoIcon = (tipo) => {
    const IconMap = {
      pdf: FileText,
      excel: Table,
      imagem: Image,
      csv: Table,
      word: FileText
    };
    return IconMap[tipo] || FileText;
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(processamentos.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectItem = (id, checked) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleReimportar = async (processamento, opcoes) => {
    setReimportacaoLoading(true);
    try {
      console.log(`🔄 Iniciando reimportação de: ${processamento.nome_arquivo}`);
      console.log(`⚙️ Opções:`, opcoes);

      // Verificar se há dados para reprocessar
      if (!processamento.url_arquivo) {
        throw new Error("Arquivo não encontrado. Não é possível reimportar sem o arquivo original.");
      }

      // Verificar se há dados extraídos anteriormente
      const temDadosAnteriores = processamento.dados_extraidos &&
                                processamento.dados_extraidos.dados_processados &&
                                Array.isArray(processamento.dados_extraidos.dados_processados) &&
                                processamento.dados_extraidos.dados_processados.length > 0;

      if (!temDadosAnteriores) {
        console.log("⚠️ Sem dados anteriores, tentando reprocessar arquivo...");
        // Chamar função de reprocessamento sem opções primeiro
        await onReprocessar(processamento);
        setShowModalReimportacao(null);
        return;
      }

      // Usar dados existentes para reimportação
      console.log(`📊 Usando ${processamento.dados_extraidos.dados_processados.length} registros existentes`);

      // Chamar função de reimportação com as opções escolhidas
      await onReprocessar(processamento, opcoes);
      setShowModalReimportacao(null);
      await onRecarregar();

    } catch (error) {
      console.error("❌ Erro na reimportação:", error);
      alert(`Erro na reimportação: ${error.message}`);
    }
    setReimportacaoLoading(false);
  };

  const handleExcluir = async (processamento) => {
    if (!confirm(`Tem certeza que deseja excluir a importação "${processamento.nome_arquivo}"?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const { ImportacaoDocumento } = await import("@/entities/ImportacaoDocumento");
      await ImportacaoDocumento.delete(processamento.id);
      alert("Importação excluída com sucesso!");
      await onRecarregar();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir importação");
    }
    setActionLoading(false);
  };

  const handleExcluirSelecionados = async () => {
    if (selectedIds.size === 0) {
      alert("Selecione pelo menos um item para excluir");
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.size} importação(ões) selecionada(s)?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const { ImportacaoDocumento } = await import("@/entities/ImportacaoDocumento");

      for (const id of selectedIds) {
        await ImportacaoDocumento.delete(id);
      }

      setSelectedIds(new Set());
      alert(`${selectedIds.size} importação(ões) excluída(s) com sucesso!`);
      await onRecarregar();
    } catch (error) {
      console.error("Erro ao excluir selecionados:", error);
      alert("Erro ao excluir importações selecionadas");
    }
    setActionLoading(false);
  };

  const handleLimparTodosOsDados = async () => {
    const confirmacao = prompt(`
⚠️ ATENÇÃO: Esta ação irá excluir TODOS os dados de TODAS as tabelas do sistema!

Isso incluirá:
- Todas as importações e mapeamentos
- Todos os clientes, vendedores, vendas e orçamentos
- Todas as interações registradas
- Qualquer outro dado armazenado no sistema

⚠️ ESTA OPERAÇÃO É IRREVERSÍVEL! ⚠️

Digite "LIMPAR TUDO AGORA" para confirmar (sem aspas):
    `);

    if (confirmacao !== "LIMPAR TUDO AGORA") {
      alert("Operação cancelada");
      return;
    }

    setActionLoading(true);
    try {
      console.log("🧹 Iniciando limpeza completa do banco de dados...");

      // Lista COMPLETA de todas as entidades possíveis, em ordem de dependência (dependentes primeiro)
      const todasAsEntidades = [
        'Atividade', 'Nota', 'Anexo', 'Interacao', 'Ligacao', 'WhatsApp', 'Venda', 'Orcamento',
        'Cliente', 'Vendedor', 'Oportunidade', 'Produto',
        'ImportacaoDocumento', 'MapeamentoImportacao', 'Historico',
        'CurvaABC', 'RelatorioVendas', 'Pipeline', 'Dashboard', 'KPI', 'Metrica',
        'Task', 'Categoria', 'Config', 'Log', 'Meta', 'Comissao', 'Territorio', 'Segmento', 'Evento', 'Notificacao', 'Configuracao', 'Backup'
      ];

      const relatorio = {
        encontradasComDados: [],
        limpasComSucesso: [],
        errosNaLimpeza: [],
        naoEncontradas: [],
        encontradasVazias: [],
        totalExcluido: 0,
        totalErros: 0
      };

      for (const nomeEntidade of todasAsEntidades) {
        try {
          const module = await import(`@/entities/${nomeEntidade}`);
          const Entidade = module[nomeEntidade];

          if (!Entidade || typeof Entidade.list !== 'function' || typeof Entidade.delete !== 'function') {
            continue;
          }

          const registros = await Entidade.list();

          if (!registros || registros.length === 0) {
            relatorio.encontradasVazias.push(nomeEntidade);
            continue;
          }

          relatorio.encontradasComDados.push({ nome: nomeEntidade, count: registros.length });

          const promessasDelecao = registros.map(item => Entidade.delete(item.id));
          const resultados = await Promise.allSettled(promessasDelecao);

          const sucessoCount = resultados.filter(r => r.status === 'fulfilled').length;
          const erroCount = resultados.length - sucessoCount;

          if (sucessoCount > 0) {
            relatorio.limpasComSucesso.push({ nome: nomeEntidade, count: sucessoCount });
            relatorio.totalExcluido += sucessoCount;
          }
          if (erroCount > 0) {
            relatorio.errosNaLimpeza.push({ nome: nomeEntidade, count: erroCount });
            relatorio.totalErros += erroCount;
            console.error(`Erros ao excluir de ${nomeEntidade}:`, resultados.filter(r => r.status === 'rejected'));
          }

        } catch (error) {
          if (error.message.includes("Cannot find module")) {
            relatorio.naoEncontradas.push(nomeEntidade);
          } else {
            console.error(`Erro inesperado ao processar entidade ${nomeEntidade}:`, error);
            relatorio.errosNaLimpeza.push({ nome: nomeEntidade, count: 'ERRO GERAL' });
            relatorio.totalErros++;
          }
        }
      }

      setSelectedIds(new Set());

      let mensagemAlerta = `🧹 LIMPEZA COMPLETA REALIZADA! \n\n`;
      mensagemAlerta += `✅ TOTAL DE REGISTROS EXCLUÍDOS: ${relatorio.totalExcluido}\n`;
      if (relatorio.totalErros > 0) {
        mensagemAlerta += `❌ TOTAL DE ERROS NA EXCLUSÃO: ${relatorio.totalErros}\n`;
      }
      mensagemAlerta += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      if(relatorio.limpasComSucesso.length > 0) {
        mensagemAlerta += '📊 ENTIDADES LIMPAS COM SUCESSO:\n' + relatorio.limpasComSucesso.map(e => `• ${e.nome}: ${e.count} registros`).join('\n') + '\n\n';
      }

      if(relatorio.errosNaLimpeza.length > 0) {
        mensagemAlerta += '⚠️ ENTIDADES COM ERROS NA LIMPEZA (ver console):\n' + relatorio.errosNaLimpeza.map(e => `• ${e.nome}: ${e.count} erros`).join('\n') + '\n\n';
      }

      mensagemAlerta += `🎯 SISTEMA COMPLETAMENTE RESETADO!\n\n`;
      mensagemAlerta += `⚠️ Se ainda aparecerem dados, pode ser cache. A página será recarregada automaticamente.`;

      alert(mensagemAlerta);

      await onRecarregar();

      setTimeout(() => {
        window.location.reload(true);
      }, 2000);

    } catch (error) {
        console.error("❌ Erro GERAL durante a limpeza completa:", error);
        alert(`❌ Erro GERAL durante a limpeza dos dados: ${error.message}\n\nVerifique o console para detalhes.`);
    }
    setActionLoading(false);
  };

  const isAllSelected = processamentos.length > 0 && selectedIds.size === processamentos.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < processamentos.length;

  return (
    <>
      <div className="bg-white/80 backdrop-blur-lg rounded-xl p-5 border border-slate-200/50 shadow-lg">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
              <Brain className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Histórico de Importações</h2>
              <p className="text-xs text-slate-600">Acompanhe o aprendizado da IA</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
                <span className="text-sm font-medium text-slate-700">
                  {selectedIds.size} selecionado(s)
                </span>
                <Button
                  onClick={handleExcluirSelecionados}
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 h-7 px-2"
                  disabled={actionLoading}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Excluir
                </Button>
              </div>
            )}
            <Button
              onClick={handleLimparTodosOsDados}
              size="sm"
              variant="outline"
              className="text-orange-600 hover:bg-orange-50 border-orange-200 h-7 px-3"
              disabled={actionLoading}
            >
              <RotateCcw className="w-3 h-3 mr-2" />
              Limpar Dados
            </Button>
            <Button onClick={onRecarregar} size="sm" variant="ghost" disabled={loading || actionLoading}>
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {/* Tabela Compacta */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80 rounded-lg">
              <tr className="text-left">
                <th className="p-2 w-10">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    className={isSomeSelected ? "data-[state=checked]:bg-indigo-600" : ""}
                  />
                </th>
                <th className="p-2 text-xs font-semibold text-slate-600">Data/Arquivo</th>
                <th className="p-2 text-xs font-semibold text-slate-600">Tipo/Destino</th>
                <th className="p-2 text-xs font-semibold text-slate-600">Status</th>
                <th className="p-2 text-xs font-semibold text-slate-600">Ações</th>
                <th className="p-2 text-xs font-semibold text-slate-600 w-16">Ver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/50">
              {processamentos.map((proc) => {
                const statusInfo = getStatusInfo(proc.status_processamento);
                const TipoIcon = getTipoIcon(proc.tipo_documento);

                return (
                  <tr key={proc.id} className="hover:bg-slate-50/50 transition-colors text-sm">
                    <td className="p-2">
                      <Checkbox
                        checked={selectedIds.has(proc.id)}
                        onCheckedChange={(checked) => handleSelectItem(proc.id, checked)}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <TipoIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate text-xs">
                            {proc.nome_arquivo}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(proc.created_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-xs">
                          {proc.classificacao_automatica || 'N/A'}
                        </Badge>
                        <p className="text-xs text-slate-500">→ {proc.destino_dados || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="p-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${statusInfo.bg} text-xs cursor-default`}>
                              <statusInfo.icon className={`w-3 h-3 ${statusInfo.color}`} />
                              <span className={`font-medium ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            </div>
                          </TooltipTrigger>
                          {proc.status_processamento === 'erro' && proc.erro_detalhado && (
                            <TooltipContent>
                              <p>{proc.erro_detalhado}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={() => setShowModalReimportacao(proc)}
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          disabled={actionLoading}
                          title="Reimportar com opções"
                        >
                          <Upload className="w-3 h-3 mr-1" />
                          Reimportar
                        </Button>
                        <Button
                          onClick={() => onRevisar(proc)}
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                          disabled={actionLoading}
                          title="Revisar e Corrigir"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={() => handleExcluir(proc)}
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          disabled={actionLoading}
                          title="Excluir"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(proc.url_arquivo, '_blank')}
                        className="text-slate-500 hover:text-slate-700 h-6 px-1"
                        title="Ver arquivo"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {processamentos.length === 0 && !loading && (
          <div className="text-center py-8 text-slate-500">
            <Brain className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Nenhuma importação encontrada</p>
            <p className="text-xs">Faça upload de arquivos para começar.</p>
          </div>
        )}

        {actionLoading && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-4 shadow-xl flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span className="font-medium text-slate-800 text-sm">Processando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Reimportação */}
      {showModalReimportacao && (
        <ModalReimportacao
          processamento={showModalReimportacao}
          onClose={() => setShowModalReimportacao(null)}
          onConfirm={(opcoes) => handleReimportar(showModalReimportacao, opcoes)}
          loading={reimportacaoLoading}
        />
      )}
    </>
  );
}
