/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CONVERSORES UNIFICADOS - ÚNICA FONTE DE VERDADE            ║
 * ║  Usado por: Importação, Automação, Forms, Validações       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export const Conversores = {
  /**
   * Converte valor monetário de qualquer formato para número
   * Suporta: R$ 1.234,56 | 1,234.56 | 1234.56 | USD 1,234.56
   */
  paraNumero(valor) {
    if (typeof valor === 'number') return valor;
    if (!valor) return 0;
    
    const valorString = String(valor);
    let limpo = valorString.replace(/[R$\s€£¥USD]/g, '');
    
    const temPontoEVirgula = limpo.includes('.') && limpo.includes(',');
    const ultimoPonto = limpo.lastIndexOf('.');
    const ultimaVirgula = limpo.lastIndexOf(',');
    
    if (temPontoEVirgula) {
      if (ultimaVirgula > ultimoPonto) {
        // Formato brasileiro: 1.234,56
        limpo = limpo.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato americano: 1,234.56
        limpo = limpo.replace(/,/g, '');
      }
    } else if (limpo.includes(',')) {
      const partesVirgula = limpo.split(',');
      if (partesVirgula[partesVirgula.length - 1].length === 2) {
        limpo = limpo.replace(',', '.');
      } else {
        limpo = limpo.replace(/,/g, '');
      }
    }
    
    const numero = parseFloat(limpo);
    return isNaN(numero) ? 0 : numero;
  },

  /**
   * Converte data de qualquer formato para ISO (YYYY-MM-DD)
   * Suporta: DD/MM/YYYY | MM/DD/YYYY | YYYY-MM-DD | DD-MM-YYYY
   */
  paraDataISO(dataStr) {
    if (!dataStr) return new Date().toISOString().slice(0, 10);
    
    // Já está em formato ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(dataStr)) {
      return new Date(dataStr).toISOString().slice(0, 10);
    }
    
    // Formato brasileiro DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}/.test(dataStr)) {
      const [dia, mes, ano] = dataStr.split('/');
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    
    // Formato brasileiro DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}/.test(dataStr)) {
      const [dia, mes, ano] = dataStr.split('-');
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    
    // Formato americano MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dataStr)) {
      const partes = dataStr.split('/');
      if (partes[0].length <= 2 && parseInt(partes[0]) <= 12) {
        const [mes, dia, ano] = partes;
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      }
    }
    
    // Tentar parse genérico
    try {
      return new Date(dataStr).toISOString().slice(0, 10);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  },

  /**
   * Converte data ISO para formato brasileiro
   */
  paraDataBR(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
  },

  /**
   * Converte datetime ISO para formato brasileiro com hora
   */
  paraDataHoraBR(datetimeISO) {
    if (!datetimeISO) return '';
    const data = new Date(datetimeISO);
    return data.toLocaleString('pt-BR');
  },

  /**
   * Formata número como moeda brasileira
   */
  paraMoedaBR(numero) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numero);
  },

  /**
   * Formata número como moeda USD
   */
  paraMoedaUSD(numero) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numero);
  },

  /**
   * Limpa e formata CNPJ
   */
  formatarCNPJ(cnpj) {
    if (!cnpj) return '';
    const limpo = cnpj.replace(/\D/g, '');
    if (limpo.length !== 14) return cnpj;
    return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  },

  /**
   * Limpa e formata CPF
   */
  formatarCPF(cpf) {
    if (!cpf) return '';
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length !== 11) return cpf;
    return limpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  },

  /**
   * Limpa e formata telefone
   */
  formatarTelefone(telefone) {
    if (!telefone) return '';
    const limpo = telefone.replace(/\D/g, '');
    
    if (limpo.length === 13 && limpo.startsWith('55')) {
      // Com código do país
      const ddd = limpo.slice(2, 4);
      const numero = limpo.slice(4);
      if (numero.length === 9) {
        return `+55 (${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
      } else if (numero.length === 8) {
        return `+55 (${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
      }
    }
    
    if (limpo.length === 11) {
      return limpo.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (limpo.length === 10) {
      return limpo.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    }
    
    return telefone;
  },

  /**
   * Normaliza texto removendo acentos e caracteres especiais
   */
  normalizarTexto(texto) {
    if (!texto) return '';
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  },

  /**
   * Limpa texto mantendo apenas números
   */
  apenasNumeros(texto) {
    if (!texto) return '';
    return String(texto).replace(/\D/g, '');
  },

  /**
   * Limpa e normaliza e-mail
   */
  normalizarEmail(email) {
    if (!email) return '';
    return String(email).toLowerCase().trim();
  },

  /**
   * Converte texto para formato de nome próprio (Title Case)
   */
  paraNomedProprio(texto) {
    if (!texto) return '';
    return texto
      .toLowerCase()
      .split(' ')
      .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
      .join(' ');
  },

  /**
   * Trunca texto com reticências
   */
  truncar(texto, maxLength = 50) {
    if (!texto) return '';
    if (texto.length <= maxLength) return texto;
    return texto.slice(0, maxLength) + '...';
  }
};