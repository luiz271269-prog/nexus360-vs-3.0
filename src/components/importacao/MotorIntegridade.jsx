import { ControleNumeracao } from "@/entities/ControleNumeracao";
import { RegistroDuplicidade } from "@/entities/RegistroDuplicidade";
import { Cliente } from "@/entities/Cliente";
import { Vendedor } from "@/entities/Vendedor";
import { Venda } from "@/entities/Venda";
import { Orcamento } from "@/entities/Orcamento";

export class MotorIntegridade {
  // Cache para evitar múltiplas inicializações
  static _inicializacaoEmAndamento = false;
  static _controlesInicializados = false;
  
  // Inicializar controles de numeração padrão - COM CONTROLE DE RATE LIMIT
  static async inicializarControles() {
    // Evitar múltiplas inicializações simultâneas
    if (this._inicializacaoEmAndamento || this._controlesInicializados) {
      console.log("⏩ Controles já inicializados ou em processo de inicialização");
      return;
    }
    
    this._inicializacaoEmAndamento = true;
    
    const controlesBase = [
      {
        tipo_entidade: "cliente",
        prefixo: "CLI",
        formato_mascara: "CLI-{AAAA}-{NNNN}",
        reiniciar_anualmente: true
      },
      {
        tipo_entidade: "vendedor", 
        prefixo: "VEN",
        formato_mascara: "VEN-{NNN}",
        reiniciar_anualmente: false
      },
      {
        tipo_entidade: "orcamento",
        prefixo: "ORC",
        formato_mascara: "ORC-{MM}{AA}-{NNNN}",
        reiniciar_mensalmente: true
      },
      {
        tipo_entidade: "venda",
        prefixo: "PED",
        formato_mascara: "PED-{AAAA}-{NNNNN}",
        reiniciar_anualmente: true
      },
      {
        tipo_entidade: "nota_fiscal",
        prefixo: "NF",
        formato_mascara: "NF-{AAAA}-{NNNNN}",
        reiniciar_anualmente: true
      }
    ];

    try {
      console.log("🔄 Iniciando verificação de controles de numeração...");
      
      // Verificar se já existem controles ANTES de tentar criar
      const controlesExistentes = await ControleNumeracao.list();
      const tiposExistentes = new Set(controlesExistentes.map(c => c.tipo_entidade));
      
      // Filtrar apenas os controles que realmente precisam ser criados
      const controlesParaCriar = controlesBase.filter(controle => 
        !tiposExistentes.has(controle.tipo_entidade)
      );
      
      if (controlesParaCriar.length === 0) {
        console.log("✅ Todos os controles já existem");
        this._controlesInicializados = true;
        this._inicializacaoEmAndamento = false;
        return;
      }
      
      console.log(`📝 Criando ${controlesParaCriar.length} novos controles...`);
      
      // Criar controles SEQUENCIALMENTE (não em paralelo) para evitar rate limit
      for (const controle of controlesParaCriar) {
        try {
          await ControleNumeracao.create({
            ...controle,
            ano_atual: new Date().getFullYear(),
            mes_atual: new Date().getMonth() + 1,
            proximo_numero: 1,
            historico_numeros: []
          });
          
          console.log(`✅ Controle criado para: ${controle.tipo_entidade}`);
          
          // Pequeno delay entre criações para evitar rate limit
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`❌ Erro ao criar controle para ${controle.tipo_entidade}:`, error.message);
          // Continue tentando os próximos mesmo se um falhar
        }
      }
      
      this._controlesInicializados = true;
      console.log("🎉 Inicialização de controles concluída");
      
    } catch (error) {
      console.error("❌ Erro geral na inicialização de controles:", error.message);
    } finally {
      this._inicializacaoEmAndamento = false;
    }
  }

  // Método para resetar o cache (útil para testes ou reinicializações forçadas)
  static resetarCacheInicializacao() {
    this._inicializacaoEmAndamento = false;
    this._controlesInicializados = false;
  }

  // Gerar próximo número automático
  static async gerarProximoNumero(tipoEntidade, entidadeId = null) {
    try {
      // Verificar se os controles foram inicializados primeiro
      if (!this._controlesInicializados && !this._inicializacaoEmAndamento) {
        await this.inicializarControles();
      }
      
      const controles = await ControleNumeracao.filter({ tipo_entidade: tipoEntidade });
      if (controles.length === 0) {
        console.log(`⚠️ Controle não encontrado para ${tipoEntidade}, tentando inicializar...`);
        await this.inicializarControles();
        return await this.gerarProximoNumero(tipoEntidade, entidadeId);
      }

      const controle = controles[0];
      const agora = new Date();
      const anoAtual = agora.getFullYear();
      const mesAtual = agora.getMonth() + 1;

      // Verificar se precisa reiniciar numeração
      let proximoNumero = controle.proximo_numero;
      let precisaReiniciar = false;

      if (controle.reiniciar_anualmente && controle.ano_atual !== anoAtual) {
        proximoNumero = 1;
        precisaReiniciar = true;
      } else if (controle.reiniciar_mensalmente && (controle.mes_atual !== mesAtual || controle.ano_atual !== anoAtual)) {
        proximoNumero = 1;
        precisaReiniciar = true;
      }

      // Gerar número formatado
      const numeroGerado = this.formatarNumero(controle.formato_mascara, proximoNumero, anoAtual, mesAtual);

      // Atualizar controle
      await ControleNumeracao.update(controle.id, {
        proximo_numero: proximoNumero + 1,
        ano_atual: anoAtual,
        mes_atual: mesAtual,
        historico_numeros: [
          ...(controle.historico_numeros || []),
          {
            numero_gerado: numeroGerado,
            data_geracao: agora.toISOString(),
            entidade_id: entidadeId
          }
        ].slice(-100) // Manter só os últimos 100
      });

      return numeroGerado;

    } catch (error) {
      console.error("Erro ao gerar próximo número:", error);
      // Fallback para formato simples
      return `${tipoEntidade.toUpperCase()}-${Date.now()}`;
    }
  }

  // Formatar número segundo a máscara
  static formatarNumero(mascara, numero, ano, mes) {
    return mascara
      .replace(/\{AAAA\}/g, ano.toString())
      .replace(/\{AA\}/g, ano.toString().slice(-2))
      .replace(/\{MM\}/g, mes.toString().padStart(2, '0'))
      .replace(/\{NNNNN\}/g, numero.toString().padStart(5, '0'))
      .replace(/\{NNNN\}/g, numero.toString().padStart(4, '0'))
      .replace(/\{NNN\}/g, numero.toString().padStart(3, '0'))
      .replace(/\{NN\}/g, numero.toString().padStart(2, '0'));
  }

  // Verificar duplicidades antes de salvar
  static async verificarDuplicidade(tipoEntidade, dados, camposChave = []) {
    const entidadesMap = {
      'clientes': Cliente,
      'vendedores': Vendedor, 
      'vendas': Venda,
      'orcamentos': Orcamento
    };

    const entidade = entidadesMap[tipoEntidade];
    if (!entidade) return { duplicidade: false, dados: dados };

    // Definir campos-chave por tipo de entidade
    const camposChavePadrao = {
      'clientes': ['cnpj', 'razao_social'],
      'vendedores': ['email', 'codigo'],
      'vendas': ['numero_pedido'],
      'orcamentos': ['numero_orcamento']
    };

    const chavesParaVerificar = camposChave.length > 0 ? camposChave : camposChavePadrao[tipoEntidade] || [];
    
    for (const campo of chavesParaVerificar) {
      if (!dados[campo]) continue;

      try {
        const existentes = await entidade.filter({ [campo]: dados[campo] });
        
        if (existentes.length > 0) {
          // Registrar duplicidade encontrada
          await RegistroDuplicidade.create({
            tipo_entidade: tipoEntidade.slice(0, -1), // Remove 's' do final
            campo_chave: campo,
            valor_chave: dados[campo],
            registros_encontrados: existentes.map(item => ({
              id: item.id,
              data_criacao: item.created_date,
              origem: 'existente',
              dados_resumo: this.criarResumoEntidade(item, tipoEntidade)
            })),
            acao_tomada: 'pendente_decisao'
          });

          return {
            duplicidade: true,
            campo: campo,
            valor: dados[campo],
            registrosExistentes: existentes,
            dados: dados
          };
        }
      } catch (error) {
        console.error(`Erro ao verificar duplicidade no campo ${campo}:`, error);
        // Continue verificando outros campos mesmo se um falhar
      }
    }

    return { duplicidade: false, dados: dados };
  }

  // Resolver duplicidade automaticamente
  static async resolverDuplicidade(registroExistente, acao, dadosNovos, usuarioId = 'sistema') {
    const entidadesMap = {
      'cliente': Cliente,
      'vendedor': Vendedor,
      'venda': Venda,
      'orcamento': Orcamento
    };

    const entidade = entidadesMap[registroExistente.tipo_entidade];
    let resultado = null;

    switch (acao) {
      case 'atualizar_existente':
        resultado = await entidade.update(registroExistente.registros_encontrados[0].id, dadosNovos);
        break;

      case 'criar_novo':
        // Gerar novo código/número para evitar duplicidade
        if (registroExistente.campo_chave.includes('numero') || registroExistente.campo_chave.includes('codigo')) {
          dadosNovos[registroExistente.campo_chave] = await this.gerarProximoNumero(registroExistente.tipo_entidade);
        }
        resultado = await entidade.create(dadosNovos);
        break;

      case 'mesclar':
        const existente = registroExistente.registros_encontrados[0];
        const dadosMesclados = this.mesclarDados(existente.dados_resumo, dadosNovos);
        resultado = await entidade.update(existente.id, dadosMesclados);
        break;

      default:
        resultado = registroExistente.registros_encontrados[0];
    }

    // Atualizar registro de duplicidade
    await RegistroDuplicidade.update(registroExistente.id, {
      acao_tomada: acao,
      dados_mesclados: resultado,
      usuario_decisao: usuarioId,
      data_resolucao: new Date().toISOString(),
      justificativa: `Ação automática: ${acao}`
    });

    return resultado;
  }

  // Mesclar dados inteligentemente
  static mesclarDados(dadosExistentes, dadosNovos) {
    const dadosMesclados = { ...dadosExistentes };

    Object.keys(dadosNovos).forEach(campo => {
      const valorNovo = dadosNovos[campo];
      const valorExistente = dadosExistentes[campo];

      // Se o valor novo está preenchido e o existente não, usar o novo
      if (valorNovo && (!valorExistente || valorExistente === '' || valorExistente === null)) {
        dadosMesclados[campo] = valorNovo;
      }
      // Se ambos estão preenchidos, manter o existente (pode ser customizado)
      else if (valorNovo && valorExistente) {
        // Para campos de data, usar o mais recente
        if (campo.includes('data') && new Date(valorNovo) > new Date(valorExistente)) {
          dadosMesclados[campo] = valorNovo;
        }
        // Para campos numéricos, usar o maior
        else if (typeof valorNovo === 'number' && valorNovo > valorExistente) {
          dadosMesclados[campo] = valorNovo;
        }
      }
    });

    return dadosMesclados;
  }

  // Criar resumo da entidade para registro
  static criarResumoEntidade(item, tipoEntidade) {
    const resumos = {
      'clientes': { 
        razao_social: item.razao_social, 
        cnpj: item.cnpj, 
        vendedor: item.vendedor_responsavel 
      },
      'vendedores': { 
        nome: item.nome, 
        email: item.email, 
        codigo: item.codigo 
      },
      'vendas': { 
        numero_pedido: item.numero_pedido, 
        cliente: item.cliente_nome, 
        valor: item.valor_total 
      },
      'orcamentos': { 
        numero_orcamento: item.numero_orcamento, 
        cliente: item.cliente_nome, 
        valor: item.valor_total 
      }
    };

    return resumos[tipoEntidade] || item;
  }

  // Validar integridade completa dos dados
  static async validarIntegridade(tipoEntidade, dados) {
    const validacoes = [];

    // 1. Verificar duplicidade
    const verificacaoDuplicidade = await this.verificarDuplicidade(tipoEntidade, dados);
    if (verificacaoDuplicidade.duplicidade) {
      validacoes.push({
        tipo: 'duplicidade',
        nivel: 'warning',
        mensagem: `Possível duplicidade no campo ${verificacaoDuplicidade.campo}: ${verificacaoDuplicidade.valor}`,
        dados: verificacaoDuplicidade
      });
    }

    // 2. Verificar campos obrigatórios
    const camposObrigatorios = this.getCamposObrigatorios(tipoEntidade);
    for (const campo of camposObrigatorios) {
      if (!dados[campo] || dados[campo] === '') {
        validacoes.push({
          tipo: 'campo_obrigatorio',
          nivel: 'error',
          mensagem: `Campo obrigatório não preenchido: ${campo}`,
          campo: campo
        });
      }
    }

    // 3. Validar formatos
    const validacoesFormato = this.validarFormatos(dados, tipoEntidade);
    validacoes.push(...validacoesFormato);

    return {
      valido: validacoes.filter(v => v.nivel === 'error').length === 0,
      validacoes: validacoes,
      dados: dados
    };
  }

  // Obter campos obrigatórios por tipo
  static getCamposObrigatorios(tipoEntidade) {
    const campos = {
      'clientes': ['razao_social', 'vendedor_responsavel'],
      'vendedores': ['nome', 'codigo', 'email'],
      'vendas': ['cliente_nome', 'vendedor', 'data_venda', 'valor_total'],
      'orcamentos': ['cliente_nome', 'vendedor', 'data_orcamento', 'valor_total']
    };

    return campos[tipoEntidade] || [];
  }

  // Validar formatos de dados
  static validarFormatos(dados, tipoEntidade) {
    const validacoes = [];

    // Validar CNPJ para clientes
    if (tipoEntidade === 'clientes' && dados.cnpj) {
      if (!this.validarCNPJ(dados.cnpj)) {
        validacoes.push({
          tipo: 'formato_invalido',
          nivel: 'warning',
          mensagem: 'CNPJ em formato inválido',
          campo: 'cnpj'
        });
      }
    }

    // Validar email
    if (dados.email && !this.validarEmail(dados.email)) {
      validacoes.push({
        tipo: 'formato_invalido',
        nivel: 'error',
        mensagem: 'Email em formato inválido',
        campo: 'email'
      });
    }

    // Validar datas
    Object.keys(dados).forEach(campo => {
      if (campo.includes('data') && dados[campo]) {
        if (!this.validarData(dados[campo])) {
          validacoes.push({
            tipo: 'formato_invalido',
            nivel: 'warning',
            mensagem: `Data em formato inválido: ${campo}`,
            campo: campo
          });
        }
      }
    });

    return validacoes;
  }

  // Utilitários de validação
  static validarCNPJ(cnpj) {
    return cnpj && cnpj.replace(/\D/g, '').length === 14;
  }

  static validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  static validarData(data) {
    return !isNaN(new Date(data).getTime());
  }
}