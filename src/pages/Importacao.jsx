
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
  
  const adicionarNumeracaoAutomatica = async (destino, item) => {
    const camposNumeracao = {
      'clientes': 'codigo',
      'vendedores': 'codigo', 
      'orcamentos': 'numero_orcamento',
      'vendas': 'numero_pedido'
    };

    const campoNumero = camposNumeracao[destino];
    if (campoNumero && (!item[campoNumero] || String(item[campoNumero]).trim() === '')) {
      item[campoNumero] = await MotorIntegridade.gerarProximoNumero(destino.slice(0, -1));
    }

    return item;
  };

  const enriquecerDados = async (destino, item, clientesExistentes, vendedoresExistentes, estruturaDocumento, nomeMapeamento = '') => {
    let enrichedItem = { ...item }; 

    const parseMonetaryValue = (value) => {
      if (typeof value === 'number') return value;
      if (!value) return 0;
      const cleaned = String(value).replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    const parseDate = (dateStr) => {
      if (!dateStr) return new Date().toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        return new Date(dateStr).toISOString().slice(0, 10);
      }
      if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
        const [dia, mes, ano] = dateStr.split('/');
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
      try {
        return new Date(dateStr).toISOString().slice(0, 10);
      } catch {
        return new Date().toISOString().slice(0, 10);
      }
    };

    if (enrichedItem.valor_total !== undefined) {
      enrichedItem.valor_total = parseMonetaryValue(enrichedItem.valor_total);
    }
    if (enrichedItem.valor_recorrente_mensal !== undefined) {
      enrichedItem.valor_recorrente_mensal = parseMonetaryValue(enrichedItem.valor_recorrente_mensal);
    }
    if (enrichedItem.data_venda !== undefined) {
      enrichedItem.data_venda = parseDate(enrichedItem.data_venda);
    }
    if (enrichedItem.data_orcamento !== undefined) {
      enrichedItem.data_orcamento = parseDate(enrichedItem.data_orcamento);
    }

    if (destino === 'orcamentos' || destino === 'vendas') {
        const cleanText = (text) => text ? String(text).trim().toLowerCase() : '';

        if (enrichedItem.cliente_nome) {
            const clienteNomeLimpo = cleanText(enrichedItem.cliente_nome);
            const clienteEncontrado = clientesExistentes.find(c => 
                (c.razao_social && cleanText(c.razao_social) === clienteNomeLimpo) || 
                (c.nome_fantasia && cleanText(c.nome_fantasia) === clienteNomeLimpo) ||
                (c.cnpj && enrichedItem.cnpj && cleanText(c.cnpj) === cleanText(enrichedItem.cnpj))
            );

            if (clienteEncontrado) {
                enrichedItem.cliente_id = clienteEncontrado.id;
                enrichedItem.cliente_email = enrichedItem.cliente_email || clienteEncontrado.email;
                enrichedItem.cliente_telefone = enrichedItem.cliente_telefone || clienteEncontrado.telefone;
                enrichedItem.cliente_segmento = enrichedItem.cliente_segmento || clienteEncontrado.segmento;
                enrichedItem.vendedor_responsavel = enrichedItem.vendedor_responsavel || clienteEncontrado.vendedor_responsavel;
                if (!enrichedItem.vendedor) {
                    enrichedItem.vendedor = clienteEncontrado.vendedor_responsavel;
                }
            }
        }

        if (enrichedItem.vendedor) {
            const vendedorNomeLimpo = cleanText(enrichedItem.vendedor);
            const vendedorEncontrado = vendedoresExistentes.find(v => 
                (v.nome && cleanText(v.nome) === vendedorNomeLimpo) || 
                (v.codigo && cleanText(v.codigo) === vendedorNomeLimpo) ||
                (v.email && enrichedItem.vendedor_email && cleanText(v.email) === cleanText(enrichedItem.vendedor_email))
            );

            if (vendedorEncontrado) {
                enrichedItem.vendedor_id = vendedorEncontrado.id;
                enrichedItem.vendedor = vendedorEncontrado.nome;
                enrichedItem.vendedor_codigo = enrichedItem.vendedor_codigo || vendedorEncontrado.codigo;
                enrichedItem.vendedor_email = enrichedItem.vendedor_email || vendedorEncontrado.email;
            }
        }

        if (!enrichedItem.vendedor) { 
            if (nomeMapeamento) {
                enrichedItem.vendedor = nomeMapeamento;
            } else if (vendedoresExistentes.length > 0) {
                enrichedItem.vendedor = vendedoresExistentes[0].nome;
            } else {
                enrichedItem.vendedor = 'Vendedor Padrão';
            }
        }

        if (destino === 'orcamentos') {
          enrichedItem.mes_referencia = enrichedItem.data_orcamento.slice(0, 7);
          enrichedItem.status = enrichedItem.status || 'rascunho';
          enrichedItem.numero_orcamento = enrichedItem.numero_orcamento || enrichedItem.orcamento || `ORC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          enrichedItem.cliente_nome = enrichedItem.cliente_nome || enrichedItem.cliente || 'Cliente não informado';
          enrichedItem.condicao_pagamento = enrichedItem.condicao_pagamento || enrichedItem.condicoes_pagamento || '';

          if (!enrichedItem.prazo_validade && enrichedItem.data_orcamento) {
            const dataOrc = new Date(enrichedItem.data_orcamento);
            dataOrc.setDate(dataOrc.getDate() + 30);
            enrichedItem.prazo_validade = dataOrc.toISOString().slice(0, 10);
          }
          
          if (estruturaDocumento === 'cabecalho_corpo' && enrichedItem.produtos && Array.isArray(enrichedItem.produtos)) {
            enrichedItem.produtos = enrichedItem.produtos.map(produto => ({
              nome: produto.nome || produto.produto || 'Produto sem nome',
              quantidade: Number(produto.quantidade) || 1,
              valor_unitario: parseMonetaryValue(produto.valor_unitario),
              valor_total: parseMonetaryValue(produto.valor_total) || (Number(produto.quantidade) * parseMonetaryValue(produto.valor_unitario))
            }));
          } else {
            enrichedItem.produtos = [];
          }
        }

        if (destino === 'vendas') {
          enrichedItem.mes_referencia = enrichedItem.data_venda.slice(0, 7);
          enrichedItem.status = enrichedItem.status || 'Pendente';
          enrichedItem.numero_pedido = enrichedItem.numero_pedido || enrichedItem.pedido || `PED-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          enrichedItem.cliente_nome = enrichedItem.cliente_nome || enrichedItem.cliente || 'Cliente não informado';
          enrichedItem.condicao_pagamento = enrichedItem.condicao_pagamento || enrichedItem.condicoes_pagamento || '';

          if (estruturaDocumento === 'cabecalho_corpo' && enrichedItem.produtos && Array.isArray(enrichedItem.produtos)) {
            enrichedItem.produtos = enrichedItem.produtos.map(produto => ({
              nome: produto.nome || produto.produto || 'Produto sem nome',
              quantidade: Number(produto.quantidade) || 1,
              valor_unitario: parseMonetaryValue(produto.valor_unitario),
              valor_total: parseMonetaryValue(produto.valor_total) || (Number(produto.quantidade) * parseMonetaryValue(produto.valor_unitario))
            }));
          } else {
            enrichedItem.produtos = [];
          }
        }
    }
    
    if (destino === 'clientes') {
      enrichedItem.razao_social = enrichedItem.razao_social || enrichedItem.empresa || enrichedItem.nome || 'Cliente sem nome';
      enrichedItem.vendedor_responsavel = enrichedItem.vendedor_responsavel || enrichedItem.vendedor || enrichedItem.gerente_conta || nomeMapeamento || (vendedoresExistentes.length > 0 ? vendedoresExistentes[0].nome : 'Não atribuído');
    }
    
    if (destino === 'vendedores') {
      enrichedItem.codigo = enrichedItem.codigo || `V-${Date.now()}`;
      enrichedItem.nome = enrichedItem.nome || enrichedItem.vendedor || 'Vendedor sem nome';
      enrichedItem.email = enrichedItem.email || 'nao-informado@email.com';
    }

    return enrichedItem;
  };

  const salvarItemCompleto = async (destino, item) => {
    const entidadesMap = {
      'clientes': base44.entities.Cliente,
      'vendedores': base44.entities.Vendedor,
      'vendas': base44.entities.Venda,
      'orcamentos': base44.entities.Orcamento
    };

    const Entidade = entidadesMap[destino];
    if (Entidade) {
      let itemSalvo;
      if (item.id) {
        itemSalvo = await Entidade.update(item.id, item);
        console.log(`✅ ${destino.slice(0, -1)} atualizado com ID: ${itemSalvo.id}`);
      } else {
        itemSalvo = await Entidade.create(item);
        console.log(`✅ ${destino.slice(0, -1)} criado com ID: ${itemSalvo.id}`);
      }
      return itemSalvo;
    }

    return null;
  };

  const executarIntegracaoPosSalvamento = async (destino, item) => {
    if (destino === 'orcamentos') {
      try {
        await base44.entities.Interacao.create({
          cliente_id: item.cliente_id || null,
          cliente_nome: item.cliente_nome,
          vendedor: item.vendedor,
          tipo_interacao: 'email',
          data_interacao: new Date().toISOString(),
          resultado: 'orcamento_solicitado',
          observacoes: `Orçamento ${item.numero_orcamento} criado via importação inteligente`,
          temperatura_cliente: 'morno'
        });
        console.log(`✅ Interação inicial registrada para orçamento ${item.numero_orcamento}`);
      } catch (error) {
        console.error("Erro ao registrar interação para orçamento:", error);
      }
    }

    if (destino === 'vendas') {
      try {
        await base44.entities.Interacao.create({
          cliente_id: item.cliente_id || null,
          cliente_nome: item.cliente_nome,
          vendedor: item.vendedor,
          tipo_interacao: 'reuniao',
          data_interacao: item.data_venda || new Date().toISOString(),
          resultado: 'venda_fechada',
          observacoes: `Venda ${item.numero_pedido} no valor de R$ ${item.valor_total} registrada via importação`,
          temperatura_cliente: 'muito_quente'
        });
        console.log(`✅ Interação de venda registrada para pedido ${item.numero_pedido}`);
      } catch (error) {
        console.error("Erro ao registrar interação de venda:", error);
      }
    }
  };

  const enriquecerClienteComTransacao = async (transacao) => {
    try {
      const clientes = await base44.entities.Cliente.filter({ razao_social: transacao.cliente_nome });
      if (clientes.length > 0) {
        const cliente = clientes[0];
        const atualizacoes = {};

        const transacaoDate = new Date(transacao.data_orcamento || transacao.data_venda);
        const lastContactDate = cliente.ultimo_contato ? new Date(cliente.ultimo_contato) : new Date(0);

        if (transacaoDate > lastContactDate) {
          atualizacoes.ultimo_contato = transacaoDate.toISOString().slice(0, 10);
        }

        if (transacao.valor_total !== undefined && transacao.valor_total !== null) {
          const valorAtual = cliente.valor_recorrente_mensal || 0;
          const numTransacoes = cliente.historico_transacoes_count || 0;
          atualizacoes.valor_recorrente_mensal = ((valorAtual * numTransacoes) + transacao.valor_total) / (numTransacoes + 1);
          atualizacoes.historico_transacoes_count = numTransacoes + 1;
        }

        const novaObs = `Última transação: R$ ${transacao.valor_total} em ${transacaoDate.toLocaleDateString('pt-BR')}`;
        atualizacoes.observacoes = cliente.observacoes 
          ? `${cliente.observacoes}\n${novaObs}` 
          : novaObs;

        if (Object.keys(atualizacoes).length > 0) {
          await base44.entities.Cliente.update(cliente.id, atualizacoes);
          console.log(`✅ Cliente ${cliente.razao_social} enriquecido com dados da transação`);
        }
      }
    } catch (error) {
      console.error("Erro ao enriquecer cliente:", error);
    }
  };

  const processarReimportacaoComOpcoes = async (dados, destino, opcoes, processamento) => {
    try {
      console.log(`🔄 Iniciando reimportação ${opcoes.opcao} para ${destino}`);
      
      const entidadesMap = {
        'clientes': base44.entities.Cliente,
        'vendedores': base44.entities.Vendedor,
        'vendas': base44.entities.Venda,
        'orcamentos': base44.entities.Orcamento
      };

      const Entidade = entidadesMap[destino];
      if (!Entidade) {
        throw new Error(`Entidade não suportada: ${destino}`);
      }

      const [clientesExistentes, vendedoresExistentes, dadosExistentes] = await Promise.all([
        base44.entities.Cliente.list(),
        base44.entities.Vendedor.list(),
        Entidade.list()
      ]);

      let resultados = {
        processados: 0,
        novos: 0,
        atualizados: 0,
        ignorados: 0,
        erros: []
      };

      const parseMonetaryValue = (value) => {
        if (typeof value === 'number') return value;
        if (!value) return 0;
        const cleaned = String(value).replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      };

      const parseDate = (dateStr) => {
        if (!dateStr) return new Date().toISOString().slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          return new Date(dateStr).toISOString().slice(0, 10);
        }
        if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
          const [dia, mes, ano] = dateStr.split('/');
          return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        }
        try {
          return new Date(dateStr).toISOString().slice(0, 10);
        } catch {
          return new Date().toISOString().slice(0, 10);
        }
      };

      const dadosPreProcessados = dados.map(item => {
        const itemCopy = { ...item };
        if (itemCopy.valor_total !== undefined) itemCopy.valor_total = parseMonetaryValue(itemCopy.valor_total);
        if (itemCopy.valor_recorrente_mensal !== undefined) itemCopy.valor_recorrente_mensal = parseMonetaryValue(itemCopy.valor_recorrente_mensal);
        if (itemCopy.data_venda !== undefined) itemCopy.data_venda = parseDate(itemCopy.data_venda);
        if (itemCopy.data_orcamento !== undefined) itemCopy.data_orcamento = parseDate(itemCopy.data_orcamento);
        return itemCopy;
      });

      for (const item of dadosPreProcessados) {
        try {
          const itemEnriquecido = await enriquecerDados(destino, item, clientesExistentes, vendedoresExistentes, 'simples');
          
          let acao = 'criar';
          let registroExistente = null;

          if (destino === 'orcamentos' && itemEnriquecido.numero_orcamento) {
            registroExistente = dadosExistentes.find(r => r.numero_orcamento === itemEnriquecido.numero_orcamento);
          } else if (destino === 'vendas' && itemEnriquecido.numero_pedido) {
            registroExistente = dadosExistentes.find(r => r.numero_pedido === itemEnriquecido.numero_pedido);
          } else if (destino === 'clientes' && itemEnriquecido.cnpj) {
            registroExistente = dadosExistentes.find(r => r.cnpj === itemEnriquecido.cnpj);
          }

          if (registroExistente) {
            switch (opcoes.opcao) {
              case 'incrementar':
                acao = 'ignorar';
                resultados.ignorados++;
                break;
              case 'sobrescrever':
                acao = 'atualizar';
                await Entidade.update(registroExistente.id, itemEnriquecido);
                resultados.atualizados++;
                break;
              case 'mesclar':
                const dadosMesclados = { ...registroExistente, ...itemEnriquecido };
                await Entidade.update(registroExistente.id, dadosMesclados);
                resultados.atualizados++;
                break;
              default:
                console.warn(`Opção de reimportação desconhecida: ${opcoes.opcao}. Item ignorado.`);
                acao = 'ignorar';
                resultados.ignorados++;
                break;
            }
          } else {
            await Entidade.create(itemEnriquecido);
            resultados.novos++;
          }

          resultados.processados++;

        } catch (error) {
          console.error("Erro ao processar item:", error, item);
          resultados.erros.push(error.message);
        }
      }

      await base44.entities.ImportacaoDocumento.update(processamento.id, {
        status_processamento: "sucesso",
        dados_extraidos: {
          ...processamento.dados_extraidos,
          reimportacao: {
            data: new Date().toISOString(),
            opcao: opcoes.opcao,
            observacoes: opcoes.observacoes,
            resultados
          }
        }
      });

      let mensagem = `✅ Reimportação ${opcoes.opcao} concluída!\n\n`;
      mensagem += `📊 Processados: ${resultados.processados}\n`;
      mensagem += `🆕 Novos: ${resultados.novos}\n`;
      mensagem += `🔄 Atualizados: ${resultados.atualizados}\n`;
      mensagem += `⏭️ Ignorados: ${resultados.ignorados}\n`;
      
      if (resultados.erros.length > 0) {
        mensagem += `❌ Erros: ${resultados.erros.length}\n`;
      }

      if (opcoes.observacoes) {
        mensagem += `\n📝 Observações: ${opcoes.observacoes}`;
      }

      alert(mensagem);

    } catch (error) {
      console.error("Erro na reimportação:", error);
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
