import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

import { MotorIntegridade } from "../components/importacao/MotorIntegridade";
import MotorInteligencia from "../components/agenda/MotorInteligencia";

import { Button } from "@/components/ui/button";
import { Brain, Upload, Settings, Database, X } from "lucide-react";
import { toast } from 'react-hot-toast';

import UploadZone from "../components/importacao/UploadZone";
import HistoricoImportacao from "../components/importacao/HistoricoImportacao";
import GradeDadosEstruturados from "../components/importacao/GradeDadosEstruturados";
import GerenciadorMapeamentos from "../components/importacao/GerenciadorMapeamentos";
import GoogleSheetsManager from "../components/importacao/GoogleSheetsManager";
import DiagnosticoImportacao from "../components/importacao/DiagnosticoImportacao";
import { processarArquivo, processarComIntegracaoCompleta } from "../components/importacao/MotorImportacao";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import AlertasInteligentesIA from '../components/global/AlertasInteligentesIA';
import BotaoNexusFlutuante from '../components/global/BotaoNexusFlutuante';

export default function Importacao() {
  const [processamentos, setProcessamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processandoAtual, setProcessandoAtual] = useState(null);
  const [dadosParaRevisao, setDadosParaRevisao] = useState(null);
  const [showGerenciadorMapeamentos, setShowGerenciadorMapeamentos] = useState(false);
  const [showDiagnostico, setShowDiagnostico] = useState(false);
  const [arquivoParaDiagnostico, setArquivoParaDiagnostico] = useState(null);

  const [activeTab, setActiveTab] = useState("upload");
  const [alertasIA, setAlertasIA] = useState([]);

  const handleRevisarImportacao = useCallback((processamento) => {
    if (!processamento.dados_extraidos || !Array.isArray(processamento.dados_extraidos.dados_processados) || processamento.dados_extraidos.dados_processados.length === 0) {
      alert("Este registro de importação não contém dados extraídos para revisar. Tente reprocessar o arquivo.");
      return;
    }

    setDadosParaRevisao({
      dados: processamento.dados_extraidos.dados_processados,
      nomeImportacao: processamento.nome_arquivo,
      destinoSugerido: processamento.destino_dados || 'nao_aplicavel',
      tiposDetectados: processamento.dados_extraidos.tipos_detectados || [],
      mapeamentoSugerido: null,
      confiancaCampos: processamento.dados_extraidos.confianca_por_campo || {},
      urlArquivo: processamento.url_arquivo,
      processamentoId: processamento.id,
      estruturaDocumento: processamento.dados_extraidos.estrutura_documento || 'simples'
    });
    setActiveTab("upload");
  }, [setDadosParaRevisao, setActiveTab]);

  const gerarAlertasImportacao = useCallback((historico) => {
    const alertas = [];

    const importacoesComErro = historico.filter(h => h.status_processamento === "erro");
    if (importacoesComErro.length > 0) {
      alertas.push({
        id: 'erros_importacao',
        prioridade: 'alta',
        titulo: `${importacoesComErro.length} Importações com Erros`,
        descricao: importacoesComErro.map(h => `"${h.nome_arquivo}": ${h.erro_detalhado || 'erro desconhecido'}`).join('\n'),
        acao_sugerida: 'Revisar Detalhes',
        onAcao: () => toast.error('📋 Verifique o histórico para mais detalhes dos erros.')
      });
    }

    let totalDuplicidadesDetectadas = 0;
    historico.forEach(h => {
      if (h.dados_extraidos && h.dados_extraidos.resultado_salvamento && h.dados_extraidos.resultado_salvamento.duplicidades_encontradas > 0) {
        totalDuplicidadesDetectadas += h.dados_extraidos.resultado_salvamento.duplicidades_encontradas;
      }
    });

    if (totalDuplicidadesDetectadas > 0) {
      alertas.push({
        id: 'duplicatas',
        prioridade: 'media',
        titulo: `${totalDuplicidadesDetectadas} Duplicatas Detectadas`,
        descricao: 'Alguns registros podem ter sido atualizados ou ignorados devido à duplicidade.',
        acao_sugerida: 'Gerenciar Duplicatas',
        onAcao: () => toast.info('🔄 O sistema de dedupicação inteligente foi ativado. Você pode revisar as políticas de duplicidade nas configurações.')
      });
    }

    const revisaoManual = historico.filter(h => h.status_processamento === "revisao_manual");
    if (revisaoManual.length > 0) {
      alertas.push({
        id: 'revisao_manual',
        prioridade: 'media',
        titulo: `${revisaoManual.length} Importações Aguardando Revisão`,
        descricao: 'Verifique os dados extraídos antes de salvar no sistema.',
        acao_sugerida: 'Revisar Agora',
        onAcao: () => {
          if (revisaoManual[0]) {
            handleRevisarImportacao(revisaoManual[0]);
            toast.info(`Abrindo "${revisaoManual[0].nome_arquivo}" para revisão.`);
          }
        }
      });
    }

    setAlertasIA(alertas);
  }, [handleRevisarImportacao, setAlertasIA]);

  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    try {
      const historico = await base44.entities.ImportacaoDocumento.list("-created_date", 50);
      setProcessamentos(historico);
      gerarAlertasImportacao(historico);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    }
    setLoading(false);
  }, [gerarAlertasImportacao]);

  const handleFileUpload = useCallback(async (files) => {
    setLoading(true);
    const errorMessages = [];

    for (const file of files) {
      setProcessandoAtual({ id: null, nome_arquivo: file.name, status_processamento: "processando" });
      try {
        const resultadoParaRevisao = await processarArquivo(file);
        if (resultadoParaRevisao) {
          setDadosParaRevisao(resultadoParaRevisao);
          setActiveTab("upload");
        }
      } catch (error) {
        errorMessages.push(`Arquivo "${file.name}": ${error.message}`);
      } finally {
        setProcessandoAtual(null);
      }
    }

    setLoading(false);
    carregarHistorico();

    if (errorMessages.length > 0) {
      alert("Ocorreram os seguintes erros na importação:\n\n" + errorMessages.join("\n"));
    }
  }, [carregarHistorico]);

  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      if (dadosParaRevisao || showGerenciadorMapeamentos || showDiagnostico) {
        return;
      }

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const fileName = `imagem-colada-${Date.now()}.png`;
            const renamedFile = new File([file], fileName, { type: file.type });
            await handleFileUpload([renamedFile]);
          }
        }
      }
    };

    carregarHistorico();
    
    const inicializarSistema = async () => {
      try {
        setTimeout(() => {
          MotorIntegridade.inicializarControles().catch(error => {
            console.warn("⚠️ Inicialização de controles em background falhou:", error.message);
          });
        }, 2000);
      } catch (error) {
        console.warn("⚠️ Erro na inicialização do sistema:", error);
      }
    };
    
    inicializarSistema();
    
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [dadosParaRevisao, showGerenciadorMapeamentos, showDiagnostico, handleFileUpload, carregarHistorico]);

  const handleReprocessarImportacao = async (processamento, opcoes = null) => {
    setLoading(true);
    setProcessandoAtual(processamento);
    
    try {
      console.log(`🔄 Iniciando reprocessamento de: ${processamento.nome_arquivo}`);
      
      const extensao = processamento.nome_arquivo.split('.').pop().toLowerCase();
      if (extensao === 'xls') {
        throw new Error("Arquivos .xls não são suportados. Salve como .xlsx ou .csv.");
      }

      if (!processamento.url_arquivo) {
        throw new Error("URL do arquivo não encontrada. O arquivo pode ter expirado.");
      }

      if (processamento.dados_extraidos && 
          processamento.dados_extraidos.dados_processados && 
          Array.isArray(processamento.dados_extraidos.dados_processados) && 
          processamento.dados_extraidos.dados_processados.length > 0) {
        
        console.log(`📊 Usando dados já processados: ${processamento.dados_extraidos.dados_processados.length} registros`);
        
        if (opcoes) {
          await processarReimportacaoComOpcoes(
            processamento.dados_extraidos.dados_processados, 
            processamento.destino_dados || 'nao_aplicavel', 
            opcoes, 
            processamento
          );
        } else {
          setDadosParaRevisao({
            dados: processamento.dados_extraidos.dados_processados,
            nomeImportacao: processamento.nome_arquivo.replace(/\.[^/.]+$/, ""),
            destinoSugerido: processamento.destino_dados || 'nao_aplicavel',
            tiposDetectados: processamento.dados_extraidos.tipos_detectados || [],
            mapeamentoSugerido: null,
            confiancaCampos: processamento.dados_extraidos.confianca_por_campo || {},
            urlArquivo: processamento.url_arquivo,
            processamentoId: processamento.id,
            estruturaDocumento: processamento.dados_extraidos.estrutura_documento || 'simples'
          });
          setActiveTab("upload");
        }
        return;
      }

      console.log("⚠️ Nenhum dado processado encontrado. Iniciando diagnóstico...");
      setArquivoParaDiagnostico({
        nome: processamento.nome_arquivo,
        tipo: processamento.tipo_documento,
        url: processamento.url_arquivo,
        processamentoId: processamento.id
      });
      setShowDiagnostico(true);

    } catch (error) {
      console.error("❌ Erro no reprocessamento:", error);
      
      try {
        await base44.entities.ImportacaoDocumento.update(processamento.id, {
          status_processamento: "erro",
          erro_detalhado: error.message,
          data_processamento: new Date().toISOString()
        });
      } catch (updateError) {
        console.error("Erro ao atualizar status:", updateError);
      }

      alert(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
      setProcessandoAtual(null);
      carregarHistorico();
    }
  };

  const handleDiagnosticoResultado = async (resultado) => {
    if (resultado.sucesso && resultado.dados_extraidos && resultado.dados_extraidos.length > 0) {
      const processamento = processamentos.find(p => p.id === arquivoParaDiagnostico?.processamentoId);
      
      setDadosParaRevisao({
        dados: resultado.dados_extraidos,
        nomeImportacao: arquivoParaDiagnostico.nome.replace(/\.[^/.]+$/, ""),
        destinoSugerido: 'nao_aplicavel',
        tiposDetectados: [{ tipo: 'generico', confianca: 70, descricao: 'Detectado via diagnóstico' }],
        mapeamentoSugerido: null,
        confiancaCampos: {},
        urlArquivo: arquivoParaDiagnostico.url,
        processamentoId: arquivoParaDiagnostico.processamentoId,
        estruturaDocumento: 'simples'
      });
      setActiveTab("upload");

      if (processamento) {
        try {
          await base44.entities.ImportacaoDocumento.update(processamento.id, {
            status_processamento: "revisao_manual",
            dados_extraidos: {
              dados_processados: resultado.dados_extraidos,
              total_registros: resultado.dados_extraidos.length,
              estrutura_documento: 'simples',
              processamento_completo: true,
              diagnostico_executado: true
            }
          });
        } catch (error) {
          console.error("Erro ao atualizar processamento:", error);
        }
      }

      setShowDiagnostico(false);
      setArquivoParaDiagnostico(null);
    } else {
      alert("O diagnóstico não conseguiu extrair dados estruturados ou encontrou problemas. Por favor, verifique o arquivo e tente novamente.");
      setShowDiagnostico(false);
      setArquivoParaDiagnostico(null);
    }
  };
  
  const processarReimportacaoComOpcoes = async (dados, destino, opcoes, processamento) => {
    try {
      console.log(`🔄 Iniciando reimportação ${opcoes.opcao} para ${destino}`);

      if (opcoes.opcao === 'sobrescrever' || opcoes.opcao === 'mesclar' || opcoes.opcao === 'incrementar') {
        // Para todos os modos, usa processarComIntegracaoCompleta como fonte única de salvamento
        const resultado = await processarComIntegracaoCompleta(
          dados,
          destino,
          null,
          { nomeMapeamento: opcoes.observacoes || '', origem: 'reimportacao', estruturaDocumento: 'simples' }
        );

        await base44.entities.ImportacaoDocumento.update(processamento.id, {
          status_processamento: 'sucesso',
          dados_extraidos: {
            ...processamento.dados_extraidos,
            reimportacao: { data: new Date().toISOString(), opcao: opcoes.opcao, observacoes: opcoes.observacoes, resultados: resultado }
          }
        });

        alert(`✅ Reimportação ${opcoes.opcao} concluída!\n\n📊 ${resultado.sucesso} registro(s) processados`);
      }
    } catch (error) {
      console.error('Erro na reimportação:', error);
      throw error;
    }
  };

  const handleSalvarDadosInteligente = async (dadosProcessados) => {
    setLoading(true);
    const { dados, destino, mapeamentoCampos, campoTotalizador, nomeMapeamento, processamentoId, estruturaDocumento, origem } = dadosProcessados;
    
    try {
      console.log(`🚀 Iniciando processamento de ${dados.length} registro(s) para destino: ${destino}`);
      console.log(`👤 Nome do Mapeamento (Vendedor): ${nomeMapeamento || 'Não informado'}`);
      
      const dataToProcess = Array.isArray(dados) ? dados : [dados];

      // Salvar mapeamento se tiver nome
      if (mapeamentoCampos && nomeMapeamento && destino !== 'nao_aplicavel') {
        const classificacao = processamentos.find(p => p.id === processamentoId)?.classificacao_automatica || 'generico';
        
        try {
          await base44.entities.MapeamentoImportacao.create({
            tipo_documento: classificacao,
            nome_mapeamento: nomeMapeamento,
            mapeamento_campos: mapeamentoCampos,
            entidade_destino: destino,
            campo_totalizador: campoTotalizador || '',
            confianca_media: 85,
            vezes_usado: 1,
            usuario_criador: 'Sistema'
          });
        } catch (error) {
          console.log("Mapeamento já existe ou erro ao salvar:", error);
        }
      }

      // Mapear campos
      const dadosLimpos = dataToProcess.map(item => {
        if (!item || typeof item !== 'object') return {};
        
        const itemMapeado = {};
        
        Object.keys(item).forEach(campoOriginal => {
          const campoDestino = mapeamentoCampos?.[campoOriginal] || campoOriginal;
          itemMapeado[campoDestino] = item[campoOriginal];
        });
        
        return itemMapeado;
      }).filter(item => Object.keys(item).length > 0);

      console.log('📦 Dados após mapeamento:', dadosLimpos.slice(0, 2));

      // USAR A FUNÇÃO CORRIGIDA COM CONTEXTO E NOVA ASSINATURA
      let resultadoProcessamento = await processarComIntegracaoCompleta(
        dadosLimpos, 
        destino, 
        mapeamentoCampos, // Passing mapeamentoCampos as new argument
        {
          nomeMapeamento,
          origem: origem || 'importacao_manual',
          estruturaDocumento
        }
      );

      // Atualizar registro de importação
      if (processamentoId) {
        const dadosExtraidosAtuais = processamentos.find(p => p.id === processamentoId)?.dados_extraidos || {};
        
        await base44.entities.ImportacaoDocumento.update(processamentoId, {
          status_processamento: "sucesso",
          dados_extraidos: {
            ...dadosExtraidosAtuais,
            mapeamento_aplicado: nomeMapeamento || 'Sem nome',
            resultado_salvamento: {
              totalProcessados: resultadoProcessamento.sucesso,
              erros: resultadoProcessamento.erros,
              duplicidades_encontradas: resultadoProcessamento.duplicados
            }
          }
        });
      } else if (origem === 'google_sheets') {
        console.warn("Should not hit this block for Google Sheets if processamentoId is set correctly.");
      }
      
      let alertMessage = `✅ Processamento concluído:\n`;
      alertMessage += `• ${resultadoProcessamento.sucesso} registro(s) processados\n`;
      if (nomeMapeamento) {
        alertMessage += `• Vendedor atribuído: ${nomeMapeamento}\n`;
      }
      if (resultadoProcessamento.erros > 0) {
        alertMessage += `• ${resultadoProcessamento.erros} erro(s)\n`;
      }
      if (resultadoProcessamento.duplicados > 0) {
          alertMessage += `• ${resultadoProcessamento.duplicados} duplicidade(s) resolvida(s)\n`;
      }
      if (resultadoProcessamento.fluxosCriados > 0) {
          alertMessage += `• ${resultadoProcessamento.fluxosCriados} fluxo(s) inteligente(s) criado(s)\n`;
      }
      if (resultadoProcessamento.clientesEnriquecidos > 0) {
          alertMessage += `• ${resultadoProcessamento.clientesEnriquecidos} cliente(s) enriquecido(s)\n`;
      }
      alert(alertMessage);

    } catch (error) {
      console.error("Erro ao salvar dados inteligente:", error);
      alert('Erro ao salvar os dados. Verifique o console para mais detalhes.');
    }
    
    setLoading(false);
    setDadosParaRevisao(null);
    carregarHistorico();
  };

  const handleGoogleSheetsImport = async (dadosGoogleSheets) => {
    setLoading(true);
    try {
      console.log("🔄 Importando dados do Google Sheets:", dadosGoogleSheets);
      
      const novoProcessamentoGS = await base44.entities.ImportacaoDocumento.create({
          nome_arquivo: `GoogleSheets_${dadosGoogleSheets.configuracao.nome_configuracao}`,
          tipo_documento: 'google_sheets',
          status_processamento: "revisao_manual",
          data_processamento: new Date().toISOString(),
          usuario_processamento: "Sistema",
          url_arquivo: dadosGoogleSheets.configuracao.url_planilha
      });

      const localDeterminarDestinoDados = (tipo) => {
        const mapping = {
          'lista_clientes': 'clientes',
          'relatorio_vendas': 'vendas',
          'planilha_metas': 'vendedores',
          'orcamento': 'orcamentos',
          'vendas': 'vendas',
          'clientes': 'clientes',
          'vendedores': 'vendedores',
          'generico': 'nao_aplicavel',
          'google_sheets_data': 'nao_aplicavel',
        };
        return mapping[String(tipo).toLowerCase()] || 'nao_aplicavel';
      };


      const dadosProcessados = {
        dados: dadosGoogleSheets.dados,
        nomeImportacao: `GoogleSheets_${dadosGoogleSheets.configuracao.nome_configuracao}`,
        destinoSugerido: localDeterminarDestinoDados(dadosGoogleSheets.tipoDetectado),
        tiposDetectados: [{ 
          tipo: dadosGoogleSheets.tipoDetectado, 
          confianca: 90, 
          descricao: "Detectado automaticamente via Google Sheets" 
        }],
        mapeamentoSugerido: null,
        confiancaCampos: {},
        urlArquivo: dadosGoogleSheets.configuracao.url_planilha,
        processamentoId: novoProcessamentoGS.id,
        estruturaDocumento: 'simples',
        origem: 'google_sheets'
      };

      setDadosParaRevisao(dadosProcessados);
      setActiveTab("upload");
      carregarHistorico();
      
    } catch (error) {
      console.error("Erro ao processar dados do Google Sheets:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
                <Upload className="w-9 h-9 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                  Sistema de Importação Inteligente
                </h1>
                <p className="text-slate-300 mt-1">
                  Importação com IA e detecção automática de dados
                </p>
              </div>
            </div>
          </div>
        </div>
      
        <BotaoNexusFlutuante
          contadorLembretes={alertasIA.length}
          onClick={() => {
            if (alertasIA.length > 0) {
              toast.info(`📊 ${alertasIA.length} alertas de importação`);
            }
          }}
        />

        <AlertasInteligentesIA
          alertas={alertasIA}
          titulo="Importação IA"
          onAcaoExecutada={(alerta) => {
            if (alerta.id === 'fechar_tudo') {
              setAlertasIA([]);
              return;
            }
            setAlertasIA(prev => prev.filter(a => a.id !== alerta.id));
          }}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">Upload de Arquivos</TabsTrigger>
            <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <UploadZone onFileSelect={handleFileUpload} loading={loading || processandoAtual} />
            
            {processandoAtual && (
              <div className="bg-sky-800/50 backdrop-blur-lg rounded-xl p-4 border border-sky-700/50 animate-pulse flex items-center gap-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <div>
                  <p className="text-white font-semibold">Processando: {processandoAtual.nome_arquivo}</p>
                  <p className="text-slate-300 text-sm">
                    Análise inteligente + Integração automática com todo o sistema ⚡
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sheets" className="space-y-6">
            <GoogleSheetsManager 
              onImportData={handleGoogleSheetsImport} 
              onImportComplete={carregarHistorico} 
            />
          </TabsContent>

          <TabsContent value="historico" className="space-y-6">
            <HistoricoImportacao 
              processamentos={processamentos} 
              onRecarregar={carregarHistorico}
              onReprocessar={handleReprocessarImportacao}
              onRevisar={handleRevisarImportacao}
              loading={loading}
            />
          </TabsContent>
        </Tabs>

        {dadosParaRevisao && (
          <GradeDadosEstruturados
            dadosIniciais={dadosParaRevisao.dados}
            nomeImportacao={dadosParaRevisao.nomeImportacao}
            destinoSugerido={dadosParaRevisao.destinoSugerido}
            tiposDetectados={dadosParaRevisao.tiposDetectados}
            mapeamentoSugerido={dadosParaRevisao.mapeamentoSugerido}
            confiancaCampos={dadosParaRevisao.confiancaCampos}
            urlArquivo={dadosParaRevisao.urlArquivo}
            processamentoId={dadosParaRevisao.processamentoId}
            estruturaDocumento={dadosParaRevisao.estruturaDocumento}
            onSalvar={handleSalvarDadosInteligente}
            onCancelar={() => setDadosParaRevisao(null)}
            loading={loading}
          />
        )}

        {showGerenciadorMapeamentos && (
          <GerenciadorMapeamentos
            onClose={() => setShowGerenciadorMapeamentos(false)}
          />
        )}

        {showDiagnostico && arquivoParaDiagnostico && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-auto">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Diagnóstico de Importação</h2>
                <Button 
                  onClick={() => {
                    setShowDiagnostico(false);
                    setArquivoParaDiagnostico(null);
                  }} 
                  variant="ghost" 
                  size="icon"
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="p-6">
                <DiagnosticoImportacao 
                  arquivo={arquivoParaDiagnostico}
                  onResultado={handleDiagnosticoResultado}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}