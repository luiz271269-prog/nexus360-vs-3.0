/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  VALIDADORES - Valida inputs do usuário                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export class ValidadorPreAtendimento {
  
  static validarEscolhaSetor(input) {
    const inputLimpo = input?.trim().toLowerCase();
    
    if (['1', '2', '3', '4'].includes(inputLimpo)) {
      return {
        valido: true,
        setor: this.mapearSetor(inputLimpo)
      };
    }
    
    const mapeamento = {
      'vendas': 'vendas',
      'venda': 'vendas',
      'comprar': 'vendas',
      'assistencia': 'assistencia',
      'assistência': 'assistencia',
      'suporte': 'assistencia',
      'ajuda': 'assistencia',
      'financeiro': 'financeiro',
      'financeira': 'financeiro',
      'pagar': 'financeiro',
      'pagamento': 'financeiro',
      'boleto': 'financeiro',
      'fornecedor': 'fornecedor',
      'fornecedora': 'fornecedor',
      'parceiro': 'fornecedor'
    };
    
    if (mapeamento[inputLimpo]) {
      return {
        valido: true,
        setor: mapeamento[inputLimpo]
      };
    }
    
    return {
      valido: false,
      erro: 'Por favor, escolha uma opção válida (1, 2, 3 ou 4)'
    };
  }
  
  static mapearSetor(numero) {
    const mapa = {
      '1': 'vendas',
      '2': 'assistencia',
      '3': 'financeiro',
      '4': 'fornecedor'
    };
    return mapa[numero];
  }
  
  static validarEscolhaAtendente(input, totalAtendentes) {
    const inputLimpo = input?.trim();
    const numero = parseInt(inputLimpo);
    
    if (isNaN(numero) || numero < 1 || numero > totalAtendentes) {
      return {
        valido: false,
        erro: `Por favor, escolha um número entre 1 e ${totalAtendentes}`
      };
    }
    
    return {
      valido: true,
      indice: numero - 1
    };
  }
  
  static verificarComandoCancelamento(input) {
    const inputLimpo = input?.trim().toLowerCase();
    const comandos = ['cancelar', 'sair', 'voltar', 'parar', 'cancel', 'exit'];
    return comandos.includes(inputLimpo);
  }
  
  static verificarComandoAjuda(input) {
    const inputLimpo = input?.trim().toLowerCase();
    const comandos = ['ajuda', 'help', '?', 'menu'];
    return comandos.includes(inputLimpo);
  }
  
  static formatarNomeSetor(setor) {
    const nomes = {
      'vendas': '💼 Vendas',
      'assistencia': '🔧 Suporte Técnico',
      'financeiro': '💰 Financeiro',
      'fornecedor': '📦 Fornecedores'
    };
    return nomes[setor] || setor;
  }
}