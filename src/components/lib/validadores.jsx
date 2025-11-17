/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  VALIDADORES UNIFICADOS - ÚNICA FONTE DE VERDADE            ║
 * ║  Usado por: Importação, Forms, Motor de Integridade        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export const Validadores = {
  /**
   * Valida CNPJ
   */
  cnpj(cnpj) {
    if (!cnpj) return { valido: false, erro: 'CNPJ não informado' };
    
    const limpo = cnpj.replace(/\D/g, '');
    
    if (limpo.length !== 14) {
      return { valido: false, erro: 'CNPJ deve ter 14 dígitos' };
    }
    
    if (/^(\d)\1+$/.test(limpo)) {
      return { valido: false, erro: 'CNPJ inválido' };
    }
    
    // Validação dos dígitos verificadores
    let tamanho = limpo.length - 2;
    let numeros = limpo.substring(0, tamanho);
    const digitos = limpo.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }
    
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado != digitos.charAt(0)) {
      return { valido: false, erro: 'CNPJ inválido' };
    }
    
    tamanho = tamanho + 1;
    numeros = limpo.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado != digitos.charAt(1)) {
      return { valido: false, erro: 'CNPJ inválido' };
    }
    
    return { valido: true };
  },

  /**
   * Valida CPF
   */
  cpf(cpf) {
    if (!cpf) return { valido: false, erro: 'CPF não informado' };
    
    const limpo = cpf.replace(/\D/g, '');
    
    if (limpo.length !== 11) {
      return { valido: false, erro: 'CPF deve ter 11 dígitos' };
    }
    
    if (/^(\d)\1+$/.test(limpo)) {
      return { valido: false, erro: 'CPF inválido' };
    }
    
    // Validação dos dígitos verificadores
    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(limpo.charAt(i)) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(limpo.charAt(9))) {
      return { valido: false, erro: 'CPF inválido' };
    }
    
    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(limpo.charAt(i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(limpo.charAt(10))) {
      return { valido: false, erro: 'CPF inválido' };
    }
    
    return { valido: true };
  },

  /**
   * Valida e-mail
   */
  email(email) {
    if (!email) return { valido: false, erro: 'E-mail não informado' };
    
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!regex.test(email)) {
      return { valido: false, erro: 'E-mail inválido' };
    }
    
    return { valido: true };
  },

  /**
   * Valida telefone (formato brasileiro)
   */
  telefone(telefone) {
    if (!telefone) return { valido: false, erro: 'Telefone não informado' };
    
    const limpo = telefone.replace(/\D/g, '');
    
    // Aceita com ou sem código do país
    if (limpo.length === 13 && limpo.startsWith('55')) {
      // Com código do país: 5511999999999
      return { valido: true };
    }
    
    if (limpo.length === 11 || limpo.length === 10) {
      // 11999999999 ou 1199999999
      return { valido: true };
    }
    
    return { valido: false, erro: 'Telefone deve ter 10 ou 11 dígitos' };
  },

  /**
   * Valida URL
   */
  url(url) {
    if (!url) return { valido: false, erro: 'URL não informada' };
    
    try {
      new URL(url);
      return { valido: true };
    } catch {
      return { valido: false, erro: 'URL inválida' };
    }
  },

  /**
   * Valida URL de Google Sheets
   */
  googleSheetsUrl(url) {
    if (!url) return { valido: false, erro: 'URL não informada', spreadsheetId: null };
    
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    
    if (!match) {
      return { valido: false, erro: 'URL do Google Sheets inválida', spreadsheetId: null };
    }
    
    return { valido: true, spreadsheetId: match[1] };
  },

  /**
   * Valida range do Google Sheets (A1 notation)
   */
  googleSheetsRange(range) {
    if (!range) return { valido: false, erro: 'Range não informada' };
    
    // Formato: Sheet1!A1:Z100 ou A1:Z100 ou A:Z
    const regex = /^([a-zA-Z0-9\s]+!)?[A-Z]+[0-9]*:[A-Z]+[0-9]*$|^([a-zA-Z0-9\s]+!)?[A-Z]+:[A-Z]+$/;
    
    if (!regex.test(range)) {
      return { valido: false, erro: 'Range inválida (use formato A1:Z100 ou A:Z)' };
    }
    
    return { valido: true };
  },

  /**
   * Valida data (formato ISO ou brasileiro)
   */
  data(data) {
    if (!data) return { valido: false, erro: 'Data não informada' };
    
    // Tenta converter para ISO
    const dataISO = data.match(/^\d{4}-\d{2}-\d{2}/) ? data : null;
    const dataBR = data.match(/^\d{2}\/\d{2}\/\d{4}/) ? data : null;
    
    if (!dataISO && !dataBR) {
      return { valido: false, erro: 'Data inválida (use DD/MM/YYYY ou YYYY-MM-DD)' };
    }
    
    try {
      const dateObj = dataISO ? new Date(dataISO) : new Date(dataBR.split('/').reverse().join('-'));
      if (isNaN(dateObj.getTime())) {
        return { valido: false, erro: 'Data inválida' };
      }
      return { valido: true };
    } catch {
      return { valido: false, erro: 'Data inválida' };
    }
  },

  /**
   * Valida número
   */
  numero(valor) {
    if (valor === null || valor === undefined || valor === '') {
      return { valido: false, erro: 'Número não informado' };
    }
    
    const numero = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(/[^\d.,-]/g, '').replace(',', '.'));
    
    if (isNaN(numero)) {
      return { valido: false, erro: 'Número inválido' };
    }
    
    return { valido: true, valor: numero };
  },

  /**
   * Valida campo obrigatório
   */
  obrigatorio(valor, nomeCampo = 'Campo') {
    if (valor === null || valor === undefined || String(valor).trim() === '') {
      return { valido: false, erro: `${nomeCampo} é obrigatório` };
    }
    return { valido: true };
  },

  /**
   * Valida tamanho mínimo de texto
   */
  tamanhoMinimo(texto, minimo, nomeCampo = 'Campo') {
    if (!texto || String(texto).length < minimo) {
      return { valido: false, erro: `${nomeCampo} deve ter no mínimo ${minimo} caracteres` };
    }
    return { valido: true };
  },

  /**
   * Valida tamanho máximo de texto
   */
  tamanhoMaximo(texto, maximo, nomeCampo = 'Campo') {
    if (texto && String(texto).length > maximo) {
      return { valido: false, erro: `${nomeCampo} deve ter no máximo ${maximo} caracteres` };
    }
    return { valido: true };
  }
};