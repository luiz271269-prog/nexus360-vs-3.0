import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Save, X, Edit, Plus, Trash2, Check, Table, ArrowRight, Loader2, AlertTriangle, Info, Brain, Eye, Target, Link2, UserCheck, UserPlus, AlertCircle
} from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function GradeDadosEstruturados({
  dadosIniciais,
  nomeImportacao,
  destinoSugerido,
  tiposDetectados = [],
  mapeamentoSugerido = null,
  confiancaCampos = {},
  urlArquivo = '',
  processamentoId = '',
  onSalvar,
  onCancelar,
  loading,
  estruturaDocumento = 'simples', // Adicionado 'simples' como padrão
}) {
  const [dadosEditaveis, setDadosEditaveis] = useState([]);
  const [cabecalhos, setCabecalhos] = useState([]);
  const [nome, setNome] = useState(nomeImportacao || '');
  const [destino, setDestino] = useState(destinoSugerido || 'nao_aplicavel');
  const [nomeMapeamento, setNomeMapeamento] = useState('');
  const [campoTotalizador, setCampoTotalizador] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [mapeamentoCampos, setMapeamentoCampos] = useState({});
  const [editandoCabecalho, setEditandoCabecalho] = useState(null);
  const [_internalLoading, set_internalLoading] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [validacaoLinhas, setValidacaoLinhas] = useState({});

  const entidadesMap = {
    'clientes': base44.entities.Cliente,
    'vendedores': base44.entities.Vendedor,
    'vendas': base44.entities.Venda,
    'orcamentos': base44.entities.Orcamento
  };

  const vendedorObrigatorio = destino === 'vendas' || destino === 'clientes';
  const destinoBloqueado = destinoSugerido && destinoSugerido !== 'nao_aplicavel';
  
  const obterSchema = useCallback((entidade) => {
    try {
      if (!entidade) return null;
      if (typeof entidade.schema === 'function') {
        return entidade.schema();
      }
      return null;
    } catch (e) {
      console.warn('Erro ao obter schema:', e);
      return null;
    }
  }, []);
  
  const formatarNomeCampo = useCallback((campo) => (
    campo.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
  ), []);

  const detectarTipoCampo = useCallback((dados, campo) => {
    const valores = dados.slice(0, 5).map(item => item[campo]).filter(v => v != null && v !== '');
    if (valores.length === 0) return 'texto';

    const amostra = valores[0];
    if (typeof amostra === 'number') return 'numero';
    if (typeof amostra === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(amostra)) return 'data';
      if (/^\d+\.?\d*$/.test(amostra)) return 'numero';
      if (/@/.test(amostra)) return 'email';
      if (/^\d{2,3}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(amostra)) return 'cnpj';
      if (/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/.test(amostra)) return 'telefone';
    }
    return 'texto';
  }, []);

  const extrairCabecalhos = useCallback((arrayDados) => {
    if (!arrayDados || arrayDados.length === 0) return [];

    const todasChaves = new Set();
    arrayDados.forEach(item => {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach(chave => todasChaves.add(chave));
      }
    });

    return Array.from(todasChaves).map(key => ({
      id: key,
      nome: formatarNomeCampo(key),
      original: key,
      tipo: detectarTipoCampo(arrayDados, key)
    }));
  }, [formatarNomeCampo, detectarTipoCampo]);

  const validarTodasAsLinhas = useCallback(() => {
    const novaValidacao = {};
    const cleanText = (text) => text ? String(text).trim().toLowerCase() : '';

    dadosEditaveis.forEach((linha, index) => {
      let statusCliente = 'na'; // not applicable
      let statusVendedor = 'na';

      if (destino === 'vendas' || destino === 'orcamentos' || destino === 'clientes') {
        statusCliente = 'novo';
        const campoClienteKey = Object.keys(mapeamentoCampos).find(k => mapeamentoCampos[k] === 'cliente_nome' || mapeamentoCampos[k] === 'razao_social');
        if (campoClienteKey && linha[campoClienteKey]) {
            const nomeClienteLimpo = cleanText(linha[campoClienteKey]);
            const clienteEncontrado = clientes.some(c => 
                (c.razao_social && cleanText(c.razao_social) === nomeClienteLimpo) ||
                (c.nome_fantasia && cleanText(c.nome_fantasia) === nomeClienteLimpo)
            );
            if (clienteEncontrado) statusCliente = 'encontrado';
        }
      }

      if (destino === 'vendas' || destino === 'orcamentos') {
        statusVendedor = 'nao_encontrado';
        const campoVendedorKey = Object.keys(mapeamentoCampos).find(k => mapeamentoCampos[k] === 'vendedor');
        if (campoVendedorKey && linha[campoVendedorKey]) {
            const nomeVendedorLimpo = cleanText(linha[campoVendedorKey]);
            const vendedorEncontrado = vendedores.some(v => 
                (v.nome && cleanText(v.nome) === nomeVendedorLimpo) ||
                (v.codigo && cleanText(v.codigo) === nomeVendedorLimpo)
            );
            if (vendedorEncontrado) statusVendedor = 'encontrado';
        }
      }

      novaValidacao[index] = { cliente: statusCliente, vendedor: statusVendedor };
    });
    setValidacaoLinhas(novaValidacao);
  }, [dadosEditaveis, clientes, vendedores, mapeamentoCampos, destino]);
  
  const processarDadosIniciais = useCallback(() => {
    if (!dadosIniciais) return;

    let linhas = Array.isArray(dadosIniciais) ? dadosIniciais : [dadosIniciais];
    if (linhas.length === 0) return;

    const colunas = extrairCabecalhos(linhas);
    setDadosEditaveis(linhas);
    setCabecalhos(colunas);
    
    // Auto-map based on destination if no mapping is suggested
    let mapeamentoInicial = {};
    if (mapeamentoSugerido?.mapeamento_campos) {
      mapeamentoInicial = mapeamentoSugerido.mapeamento_campos;
      setNomeMapeamento(mapeamentoSugerido.nome_mapeamento || '');
      setCampoTotalizador(mapeamentoSugerido.campo_totalizador || '');
    } else {
        // Simple auto-mapping based on common names
        const Entidade = entidadesMap[destino];
        if (Entidade) {
            const schema = obterSchema(Entidade);
            if (schema && schema.properties) {
                const camposDestino = Object.keys(schema.properties);
                colunas.forEach(coluna => {
                    const nomeOriginal = coluna.original.toLowerCase().replace(/_/g, ' ');
                    const match = camposDestino.find(cd => nomeOriginal.includes(cd.toLowerCase().replace(/_/g, ' ')));
                    if (match) {
                        mapeamentoInicial[coluna.original] = match;
                    }
                });
            }
        }
    }
    setMapeamentoCampos(mapeamentoInicial);
  }, [dadosIniciais, mapeamentoSugerido, extrairCabecalhos, destino, obterSchema]);

  useEffect(() => {
    const carregarDadosApoio = async () => {
      set_internalLoading(true);
      try {
        const [clientesData, vendedoresData] = await Promise.all([
          base44.entities.Cliente.list(),
          base44.entities.Vendedor.list()
        ]);
        setClientes(clientesData);
        setVendedores(vendedoresData);
      } catch (error) {
        console.error("Erro ao carregar dados de apoio:", error);
      }
      set_internalLoading(false);
    };
    carregarDadosApoio();
  }, []);

  useEffect(() => {
    processarDadosIniciais();
  }, [processarDadosIniciais]); // Depende da versão memoizada de processarDadosIniciais
  
  useEffect(() => {
    if (clientes.length > 0 && vendedores.length > 0 && dadosEditaveis.length > 0) {
      validarTodasAsLinhas();
    }
  }, [validarTodasAsLinhas, clientes.length, vendedores.length, dadosEditaveis.length]); // Depende da versão memoizada de validarTodasAsLinhas e dos lengths para evitar recriação desnecessária

  // NOVO: Replicar vendedor para todas as linhas quando nomeMapeamento mudar
  useEffect(() => {
    if (!nomeMapeamento) return;
    
    // Encontrar qual coluna original está mapeada para "vendedor" ou "vendedor_responsavel"
    const colunaVendedor = Object.keys(mapeamentoCampos).find(
      colOriginal => mapeamentoCampos[colOriginal] === 'vendedor' || 
                     mapeamentoCampos[colOriginal] === 'vendedor_responsavel'
    );
    
    if (colunaVendedor) {
      console.log(`🔄 Replicando vendedor "${nomeMapeamento}" para coluna "${colunaVendedor}"`);
      
      setDadosEditaveis(prevDados => 
        prevDados.map(linha => ({
          ...linha,
          [colunaVendedor]: nomeMapeamento
        }))
      );
    }
  }, [nomeMapeamento, mapeamentoCampos]);
  
  const handleEditarCabecalho = (original, novoNome) => {
    setMapeamentoCampos(prev => ({
      ...prev,
      [original]: novoNome
    }));
  };

  const handleEditarCelula = (linhaIndex, colunaOriginal, valor) => {
    const novosDados = [...dadosEditaveis];
    if (!novosDados[linhaIndex]) {
      novosDados[linhaIndex] = {};
    }
    novosDados[linhaIndex][colunaOriginal] = valor;
    setDadosEditaveis(novosDados);
  };

  const adicionarLinha = () => {
    const novaLinha = cabecalhos.reduce((acc, cabecalho) => ({ ...acc, [cabecalho.original]: "" }), {});
    setDadosEditaveis([...dadosEditaveis, novaLinha]);
  };

  const adicionarColuna = () => {
    const nomeNovaColuna = prompt("Digite o nome da nova coluna (ex: 'observacoes'):");
    if (!nomeNovaColuna) return;

    const chaveNovaColuna = nomeNovaColuna.toLowerCase().replace(/\s+/g, '_');
    const novoCabecalho = {
      id: chaveNovaColuna,
      nome: nomeNovaColuna,
      original: chaveNovaColuna,
      tipo: 'texto'
    };

    setCabecalhos([...cabecalhos, novoCabecalho]);

    const novosDados = dadosEditaveis.map(linha => ({
      ...linha,
      [chaveNovaColuna]: ""
    }));
    setDadosEditaveis(novosDados);
  };

  const removerLinha = (index) => {
    setDadosEditaveis(dadosEditaveis.filter((_, i) => i !== index));
  };
  
  const renderizarValorSeguro = (valor) => {
    if (valor === null || valor === undefined) {
      return '';
    }
    if (typeof valor === 'object') {
      return JSON.stringify(valor);
    }
    return String(valor);
  };
  
  // ─── Enriquecimento pós-salvamento para alimentar o Dashboard ──────────────
  const executarPosSalvamentoDashboard = async (destinoDados, registros) => {
    try {
      const agora = new Date().toISOString();

      if (destinoDados === 'vendas') {
        // Criar Interacao para cada venda
        for (const venda of registros) {
          if (!venda.cliente_nome || !venda.vendedor) continue;
          await base44.entities.Interacao.create({
            cliente_nome: venda.cliente_nome,
            vendedor: venda.vendedor,
            tipo_interacao: 'outro',
            data_interacao: venda.data_venda ? new Date(venda.data_venda).toISOString() : agora,
            resultado: 'venda_fechada',
            observacoes: `Venda importada - Pedido: ${venda.numero_pedido || 'S/N'} - Valor: R$ ${venda.valor_total || 0}`,
            categoria_interacao: 'vendas'
          });
        }

        // Atualizar ultimo_contato dos clientes envolvidos
        const clientesMap = {};
        for (const venda of registros) {
          if (!venda.cliente_nome) continue;
          if (!clientesMap[venda.cliente_nome]) {
            clientesMap[venda.cliente_nome] = { ultimaVenda: venda.data_venda || agora.split('T')[0], totalValor: 0, count: 0 };
          }
          clientesMap[venda.cliente_nome].totalValor += parseFloat(venda.valor_total || 0);
          clientesMap[venda.cliente_nome].count += 1;
          if (venda.data_venda > clientesMap[venda.cliente_nome].ultimaVenda) {
            clientesMap[venda.cliente_nome].ultimaVenda = venda.data_venda;
          }
        }

        const todosClientes = await base44.entities.Cliente.list();
        for (const [nomeCliente, stats] of Object.entries(clientesMap)) {
          const clienteEncontrado = todosClientes.find(c =>
            c.razao_social?.toLowerCase().includes(nomeCliente.toLowerCase()) ||
            c.nome_fantasia?.toLowerCase().includes(nomeCliente.toLowerCase())
          );
          if (clienteEncontrado) {
            await base44.entities.Cliente.update(clienteEncontrado.id, {
              ultimo_contato: stats.ultimaVenda ? String(stats.ultimaVenda).split('T')[0] : new Date().toISOString().split('T')[0],
              valor_recorrente_mensal: Math.round(stats.count > 0 ? stats.totalValor / stats.count : 0)
            });
          }
        }
      }

      if (destinoDados === 'orcamentos') {
        for (const orc of registros) {
          if (!orc.cliente_nome || !orc.vendedor) continue;
          await base44.entities.Interacao.create({
            cliente_nome: orc.cliente_nome,
            vendedor: orc.vendedor,
            tipo_interacao: 'outro',
            data_interacao: orc.data_orcamento ? new Date(orc.data_orcamento).toISOString() : agora,
            resultado: 'orcamento_solicitado',
            observacoes: `Orçamento importado - Nº: ${orc.numero_orcamento || 'S/N'} - Valor: R$ ${orc.valor_total || 0}`,
            categoria_interacao: 'vendas'
          });
        }
      }
    } catch (err) {
      console.warn('[executarPosSalvamentoDashboard] Erro não-crítico:', err.message);
    }
  };

  // NOVA FUNÇÃO DE SALVAMENTO COM VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS
  const handleSalvar = async () => {
    set_internalLoading(true);
    try {
      if (destino === 'nao_aplicavel') {
        throw new Error("Selecione um destino para salvar os dados.");
      }

      // VALIDAÇÃO: Verificar se vendedor é obrigatório e foi preenchido
      if (vendedorObrigatorio && !nomeMapeamento) {
        alert("⚠️ Para importações de Vendas e Clientes, você precisa identificar o Vendedor Responsável no campo 'Nome do Mapeamento'.");
        set_internalLoading(false);
        return;
      }

      // VALIDAÇÃO CRÍTICA: Verificar se pelo menos uma coluna foi mapeada
      const mapeamentosAtivos = Object.entries(mapeamentoCampos || {})
        .filter(([_orig, dest]) => dest && dest !== '' && dest !== 'ignorar');
      
      if (mapeamentosAtivos.length === 0) {
        alert('⚠️ Você precisa mapear pelo menos uma coluna antes de salvar.\n\nSelecione qual campo do arquivo corresponde a cada campo da entidade destino.');
        set_internalLoading(false);
        return;
      }

      console.log('[handleSalvar] Mapeamentos ativos:', mapeamentosAtivos.length, JSON.stringify(mapeamentoCampos));

      const EntidadeDestino = entidadesMap[destino];
      if (!EntidadeDestino) {
        throw new Error(`Destino inválido: ${destino}`);
      }

      // 1. Mapear os dados
      const dadosMapeados = dadosEditaveis.map(linha => {
        const novaLinha = {};
        for (const original in mapeamentoCampos) {
          const destinoCampo = mapeamentoCampos[original];
          if (destinoCampo && destinoCampo !== 'ignorar') {
            novaLinha[destinoCampo] = linha[original];
          }
        }
        return novaLinha;
      });

      // 2. PREENCHER CAMPOS OBRIGATÓRIOS FALTANTES
      const dadosComObrigatorios = dadosMapeados.map(item => {
        const itemCompleto = { ...item };
        
        // Para CLIENTES - garantir vendedor_responsavel
        if (destino === 'clientes') {
          // Usar o nomeMapeamento como vendedor responsável (obrigatório)
          itemCompleto.vendedor_responsavel = nomeMapeamento;
          
          // Garantir razão_social
          if (!itemCompleto.razao_social) {
            itemCompleto.razao_social = itemCompleto.nome_fantasia || itemCompleto.empresa || 'Cliente sem nome';
          }
        }
        
        // Para VENDEDORES - garantir campos obrigatórios
        if (destino === 'vendedores') {
          if (!itemCompleto.codigo) {
            itemCompleto.codigo = `V-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
          }
          if (!itemCompleto.nome) {
            itemCompleto.nome = itemCompleto.vendedor || 'Vendedor sem nome';
          }
          if (!itemCompleto.email) {
            itemCompleto.email = 'nao-informado@email.com';
          }
        }
        
        // Para VENDAS - garantir campos obrigatórios
        if (destino === 'vendas') {
          if (!itemCompleto.cliente_nome) {
            itemCompleto.cliente_nome = itemCompleto.cliente || 'Cliente não informado';
          }
          // Usar o nomeMapeamento como vendedor (obrigatório)
          itemCompleto.vendedor = nomeMapeamento;
          
          if (!itemCompleto.data_venda) {
            itemCompleto.data_venda = new Date().toISOString().slice(0, 10);
          }
          if (itemCompleto.valor_total === undefined || itemCompleto.valor_total === null) {
            itemCompleto.valor_total = 0;
          }
          // Converter valor_total se for string
          if (typeof itemCompleto.valor_total === 'string') {
            const cleaned = itemCompleto.valor_total.replace(/\./g, '').replace(',', '.');
            itemCompleto.valor_total = parseFloat(cleaned) || 0;
          }
        }
        
        // Para ORCAMENTOS - garantir campos obrigatórios
        if (destino === 'orcamentos') {
          if (!itemCompleto.cliente_nome) {
            itemCompleto.cliente_nome = itemCompleto.cliente || 'Cliente não informado';
          }
          if (!itemCompleto.vendedor) {
            itemCompleto.vendedor = nomeMapeamento || 
              (vendedores.length > 0 ? vendedores[0].nome : 'Vendedor Padrão');
          }
          if (!itemCompleto.data_orcamento) {
            itemCompleto.data_orcamento = new Date().toISOString().slice(0, 10);
          }
          if (itemCompleto.valor_total === undefined || itemCompleto.valor_total === null) {
            itemCompleto.valor_total = 0;
          }
          // Converter valor_total se for string
          if (typeof itemCompleto.valor_total === 'string') {
            const cleaned = itemCompleto.valor_total.replace(/\./g, '').replace(',', '.');
            itemCompleto.valor_total = parseFloat(cleaned) || 0;
          }
        }
        
        return itemCompleto;
      });

      console.log("✅ Dados com campos obrigatórios preenchidos (amostra):", dadosComObrigatorios.slice(0, 2));

      // 3. Salvar em lote
      await EntidadeDestino.bulkCreate(dadosComObrigatorios);

      // 4. Enriquecer dados para o Dashboard (best-effort, não bloqueia)
      executarPosSalvamentoDashboard(destino, dadosComObrigatorios);

      // 5. Salvar o mapeamento com deduplicação
      if (nomeMapeamento) {
        const mapeamentosExistentes = await base44.entities.MapeamentoImportacao.filter({
          nome_mapeamento: nomeMapeamento,
          entidade_destino: destino
        });
        if (mapeamentosExistentes.length > 0) {
          await base44.entities.MapeamentoImportacao.update(mapeamentosExistentes[0].id, {
            mapeamento_campos: mapeamentoCampos,
            vezes_usado: (mapeamentosExistentes[0].vezes_usado || 0) + 1
          });
        } else {
          await base44.entities.MapeamentoImportacao.create({
            nome_mapeamento: nomeMapeamento,
            tipo_documento: tiposDetectados[0]?.tipo || 'generico',
            entidade_destino: destino,
            mapeamento_campos: mapeamentoCampos,
            ativo: true,
            vezes_usado: 1
          });
        }
      }

      // 5. Atualizar o registro de importação
      if (processamentoId) {
        await base44.entities.ImportacaoDocumento.update(processamentoId, {
          status_processamento: 'sucesso',
          dados_extraidos: {
              ...(dadosIniciais || {}),
              total_registros: dadosEditaveis.length,
              mapeamento_aplicado: nomeMapeamento || 'Mapeamento Manual'
          }
        });
      }

      alert(`${dadosComObrigatorios.length} registros salvos com sucesso em "${destino}"!`);
      if (onSalvar) onSalvar({
        dados: dadosComObrigatorios,
        destino,
        mapeamentoCampos,
        nomeMapeamento
      });

    } catch (error) {
      console.error("Erro ao salvar dados:", error);
      if (processamentoId) {
        await base44.entities.ImportacaoDocumento.update(processamentoId, {
          status_processamento: 'erro',
          erro_detalhado: `${error.message || 'Erro desconhecido'}. Destino: ${destino}. Arquivo: ${nomeImportacao}`
        }).catch(() => {});
      }
      alert(`Erro: ${error.message}`);
    } finally {
      set_internalLoading(false);
    }
  };


  const StatusIcon = ({ status }) => {
    if (!status) return null;

    const renderStatus = (type, st) => {
        if (st === 'na') return null;
        if (st === 'encontrado') return <div title={`${type} encontrado`} className="flex items-center gap-1 text-green-600"><Link2 className="w-3 h-3" /> Encontrado</div>;
        if (st === 'novo') return <div title={`Novo ${type}`} className="flex items-center gap-1 text-blue-600"><UserPlus className="w-3 h-3" /> Novo</div>;
        if (st === 'nao_encontrado') return <div title={`${type} não encontrado`} className="flex items-center gap-1 text-red-500"><AlertCircle className="w-3 h-3" /> Não encontrado</div>;
        return null;
    }
    
    return (
        <div className="space-y-1 text-xs font-medium">
            {renderStatus('Cliente', status.cliente)}
            {renderStatus('Vendedor', status.vendedor)}
        </div>
    );
  };
  
  const camposDisponiveis = useMemo(() => {
    if (destino === 'nao_aplicavel' || !entidadesMap[destino]) return [];
    const schema = obterSchema(entidadesMap[destino]);
    return schema && schema.properties ? Object.keys(schema.properties) : [];
  }, [destino, entidadesMap, obterSchema]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-slate-50 rounded-2xl w-full max-w-[95vw] h-[95vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center border border-indigo-200">
                <Brain className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Revisão e Mapeamento de Dados</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="bg-white">{nomeImportacao}</Badge>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <Badge className="bg-amber-100 text-amber-700">{dadosEditaveis.length} registros</Badge>
                  {destinoBloqueado && (
                    <>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <Badge className="bg-blue-100 text-blue-700 capitalize">
                        🔒 Destino: {destino}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onCancelar} variant="ghost" className="text-slate-700">
                Cancelar
              </Button>
              <Button
                onClick={handleSalvar}
                disabled={loading || _internalLoading || destino === 'nao_aplicavel' || (vendedorObrigatorio && !nomeMapeamento)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[150px]"
              >
                {_internalLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar em <span className="capitalize ml-1">{destino}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Configurações */}
         <div className="p-4 bg-white border-b border-slate-200">
           {/* Indicador de Mapeamento */}
           <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <Target className="w-4 h-4 text-blue-600" />
               <span className="text-sm font-medium text-blue-900">
                 Colunas mapeadas: {Object.values(mapeamentoCampos || {}).filter(v => v && v !== 'ignorar').length} de {cabecalhos.length}
               </span>
             </div>
             {Object.values(mapeamentoCampos || {}).filter(v => v && v !== 'ignorar').length === 0 && (
               <span className="text-xs text-red-600 font-semibold">⚠️ Nenhuma coluna mapeada ainda</span>
             )}
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="font-semibold text-slate-600 mb-1 block">
                1. Destino dos Dados
                {destinoBloqueado && (
                  <span className="ml-2 text-xs text-blue-600">(bloqueado pelo contexto)</span>
                )}
              </Label>
              <Select 
                value={destino} 
                onValueChange={setDestino}
                disabled={destinoBloqueado}
              >
                <SelectTrigger className={`bg-white ${destinoBloqueado ? 'opacity-75 cursor-not-allowed' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_aplicavel">🚫 Ignorar / Não salvar</SelectItem>
                  <SelectItem value="clientes">👥 Clientes</SelectItem>
                  <SelectItem value="vendas">💰 Vendas</SelectItem>
                  <SelectItem value="orcamentos">📋 Orçamentos</SelectItem>
                  <SelectItem value="vendedores">🏆 Vendedores</SelectItem>
                </SelectContent>
              </Select>
              {destinoBloqueado && (
                <p className="text-xs text-slate-500 mt-1">
                  🔒 O destino foi automaticamente definido pelo contexto de importação
                </p>
              )}
            </div>
            <div>
              <Label className="font-semibold text-slate-600 mb-1 block flex items-center gap-2">
                2. Nome do Mapeamento (Vendedor Responsável)
                {vendedorObrigatorio && (
                  <span className="text-red-500 text-xs">*OBRIGATÓRIO</span>
                )}
              </Label>
              <Input
                value={nomeMapeamento}
                onChange={(e) => setNomeMapeamento(e.target.value)}
                placeholder={vendedorObrigatorio ? "Digite o nome do vendedor *" : "Ex: Importação ERP (opcional)"}
                className={`bg-white ${vendedorObrigatorio && !nomeMapeamento ? 'border-red-300 focus:border-red-500' : ''}`}
                required={vendedorObrigatorio}
              />
              {vendedorObrigatorio && (
                <p className="text-xs text-slate-500 mt-1">
                  ℹ️ Este campo identifica o vendedor responsável e será replicado para todas as linhas
                </p>
              )}
            </div>
            <div>
              <Label className="font-semibold text-slate-600 mb-1 block">3. Campo Totalizador (Opcional)</Label>
              <Select value={campoTotalizador} onValueChange={setCampoTotalizador}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Nenhum</SelectItem>
                  {cabecalhos.filter(c => c.tipo === 'numero').map(cabecalho => (
                    <SelectItem key={cabecalho.id} value={cabecalho.original}>
                      {cabecalho.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {destino === 'nao_aplicavel' && (
              <div className="mt-2 p-2 bg-amber-100 border border-amber-300 rounded text-amber-800 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <strong>Atenção:</strong> Escolha um destino para poder salvar os dados no sistema.
              </div>
          )}
          {vendedorObrigatorio && !nomeMapeamento && (
              <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-800 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <strong>Campo Obrigatório:</strong> Informe o vendedor responsável para continuar.
              </div>
          )}
        </div>

        {/* Tabela */}
        <div className="flex-grow overflow-auto p-4">
            {dadosEditaveis.length === 0 ? (
                 <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 text-center p-8">
                    <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
                    <h3 className="text-2xl font-bold text-slate-800">Nenhum dado encontrado no arquivo</h3>
                    <p className="text-slate-600 mt-2 max-w-lg">
                        A IA não conseguiu extrair uma tabela de dados estruturados. Verifique se o arquivo possui uma linha de cabeçalho clara e dados organizados em colunas.
                    </p>
                </div>
            ) : (
                <div className="w-full h-full">
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-slate-200 sticky top-0 z-10">
                    <tr>
                        <th className="p-2 w-12 text-center border border-slate-300"><Trash2 className="w-4 h-4 mx-auto text-slate-500"/></th>
                        <th className="p-2 w-40 text-left border border-slate-300">Status da Integração</th>
                        {cabecalhos.map((cabecalho, index) => {
                          const estaMapeado = mapeamentoCampos[cabecalho.original] && mapeamentoCampos[cabecalho.original] !== 'ignorar';
                          return (
                        <th key={index} className={`p-2 text-left border min-w-[250px] ${estaMapeado ? 'bg-blue-50 border-blue-300' : 'bg-yellow-50 border-yellow-300'}`}>
                            <p className={`font-mono text-xs px-2 py-1 rounded-full inline-block ${estaMapeado ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {estaMapeado ? '✓' : '⚠️'} {cabecalho.original}
                            </p>
                            <Select onValueChange={(value) => handleEditarCabecalho(cabecalho.original, value)} value={mapeamentoCampos[cabecalho.original] || 'ignorar'}>
                                <SelectTrigger className="mt-2 bg-white h-9">
                                    <SelectValue placeholder="Mapear para..."/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ignorar">-- Ignorar esta coluna --</SelectItem>
                                    {camposDisponiveis.map(campo => (
                                        <SelectItem key={campo} value={campo}>{campo}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                                </th>
                                );
                                })}
                                <th className="p-2 w-20 border border-slate-300">
                          <Button onClick={adicionarColuna} size="sm" variant="ghost" className="w-full">
                            <Plus className="w-4 h-4 mr-1" /> Col
                          </Button>
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                        {dadosEditaveis.map((linha, linhaIndex) => (
                        <tr key={linhaIndex} className="hover:bg-slate-100 transition-colors bg-white">
                            <td className="p-2 text-center border border-slate-200">
                                <Button size="icon" variant="ghost" onClick={() => removerLinha(linhaIndex)} className="h-7 w-7 text-red-500 hover:bg-red-100">
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </td>
                            <td className="p-2 border border-slate-200">
                                <StatusIcon status={validacaoLinhas[linhaIndex]} />
                            </td>
                            {cabecalhos.map((cabecalho, colunaIndex) => (
                            <td key={colunaIndex} className="p-1 border border-slate-200">
                                <Input
                                value={renderizarValorSeguro(linha[cabecalho.original])}
                                onChange={(e) => handleEditarCelula(linhaIndex, cabecalho.original, e.target.value)}
                                className="h-9 bg-transparent border-none focus:bg-white focus:ring-1 focus:ring-indigo-400 p-2"
                                />
                            </td>
                            ))}
                            <td className="border border-slate-200"></td>
                        </tr>
                        ))}
                    </tbody>
                </table>
                 <Button onClick={adicionarLinha} size="sm" variant="ghost" className="mt-2">
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Linha
                </Button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}