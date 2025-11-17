/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  SINCRONIZADOR DE VENDEDORES/ATENDENTES                      ║
 * ║  Normaliza e sincroniza dados entre Cliente e Vendedor       ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import { base44 } from "@/api/base44Client";

/**
 * Normaliza o nome do vendedor (remove espaços extras, acentos, etc)
 */
export function normalizarNome(nome) {
  if (!nome) return '';
  
  return nome
    .trim()
    .replace(/\s+/g, ' ') // Remove espaços duplicados
    .normalize("NFD") // Normaliza caracteres Unicode
    .replace(/[\u0300-\u036f]/g, ""); // Remove acentos
}

/**
 * Busca vendedor por nome (com normalização)
 */
export async function buscarVendedorPorNome(nome) {
  if (!nome) return null;
  
  try {
    const vendedores = await base44.entities.Vendedor.list();
    const nomeNormalizado = normalizarNome(nome).toLowerCase();
    
    // Busca exata primeiro
    let vendedor = vendedores.find(v => 
      normalizarNome(v.nome).toLowerCase() === nomeNormalizado
    );
    
    // Se não encontrou, busca parcial
    if (!vendedor) {
      vendedor = vendedores.find(v => 
        normalizarNome(v.nome).toLowerCase().includes(nomeNormalizado) ||
        nomeNormalizado.includes(normalizarNome(v.nome).toLowerCase())
      );
    }
    
    return vendedor;
  } catch (error) {
    console.error('Erro ao buscar vendedor:', error);
    return null;
  }
}

/**
 * Sincroniza todos os clientes com vendedores
 * Atualiza vendedor_id baseado em vendedor_responsavel
 */
export async function sincronizarClientesComVendedores() {
  console.log('🔄 Iniciando sincronização de Clientes com Vendedores...');
  
  try {
    // Carregar todos os vendedores e clientes
    const [vendedores, clientes] = await Promise.all([
      base44.entities.Vendedor.list(),
      base44.entities.Cliente.list()
    ]);
    
    console.log(`📊 Encontrados ${vendedores.length} vendedores e ${clientes.length} clientes`);
    
    let atualizados = 0;
    let erros = 0;
    let semVendedor = 0;
    
    // Criar mapa de vendedores (nome normalizado -> vendedor)
    const vendedorMap = new Map();
    vendedores.forEach(v => {
      const nomeNormalizado = normalizarNome(v.nome).toLowerCase();
      vendedorMap.set(nomeNormalizado, v);
    });
    
    // Processar cada cliente
    for (const cliente of clientes) {
      try {
        if (!cliente.vendedor_responsavel) {
          semVendedor++;
          continue;
        }
        
        const nomeNormalizado = normalizarNome(cliente.vendedor_responsavel).toLowerCase();
        const vendedor = vendedorMap.get(nomeNormalizado);
        
        if (vendedor) {
          // Atualizar cliente com ID do vendedor E nome normalizado
          await base44.entities.Cliente.update(cliente.id, {
            vendedor_id: vendedor.id,
            vendedor_responsavel: vendedor.nome // Normaliza o nome também
          });
          atualizados++;
          
          if (atualizados % 10 === 0) {
            console.log(`✅ ${atualizados} clientes sincronizados...`);
          }
        } else {
          console.warn(`⚠️ Vendedor não encontrado para cliente "${cliente.razao_social}": "${cliente.vendedor_responsavel}"`);
          erros++;
        }
      } catch (error) {
        console.error(`❌ Erro ao sincronizar cliente ${cliente.id}:`, error);
        erros++;
      }
    }
    
    const resultado = {
      total: clientes.length,
      atualizados,
      erros,
      semVendedor,
      sucesso: true
    };
    
    console.log('✅ Sincronização concluída:', resultado);
    return resultado;
    
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    return {
      sucesso: false,
      erro: error.message
    };
  }
}

/**
 * Atribui vendedor a um cliente (usando ID)
 */
export async function atribuirVendedorAoCliente(clienteId, vendedorId) {
  try {
    const vendedor = await base44.entities.Vendedor.get(vendedorId);
    
    if (!vendedor) {
      throw new Error('Vendedor não encontrado');
    }
    
    await base44.entities.Cliente.update(clienteId, {
      vendedor_id: vendedor.id,
      vendedor_responsavel: vendedor.nome
    });
    
    return { sucesso: true, vendedor };
  } catch (error) {
    console.error('Erro ao atribuir vendedor:', error);
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Lista vendedores formatados para Select/Combobox
 */
export async function listarVendedoresParaSelect() {
  try {
    const vendedores = await base44.entities.Vendedor.list('nome');
    
    return vendedores.map(v => ({
      value: v.id, // USAR ID COMO VALUE
      label: v.nome,
      email: v.email,
      codigo: v.codigo
    }));
  } catch (error) {
    console.error('Erro ao listar vendedores:', error);
    return [];
  }
}

/**
 * Verifica e corrige duplicatas de vendedores
 */
export async function verificarDuplicatasVendedores() {
  try {
    const vendedores = await base44.entities.Vendedor.list();
    const nomesMap = new Map();
    const duplicatas = [];
    
    vendedores.forEach(v => {
      const nomeNormalizado = normalizarNome(v.nome).toLowerCase();
      
      if (nomesMap.has(nomeNormalizado)) {
        duplicatas.push({
          nome: v.nome,
          duplicadoDe: nomesMap.get(nomeNormalizado).nome,
          ids: [nomesMap.get(nomeNormalizado).id, v.id]
        });
      } else {
        nomesMap.set(nomeNormalizado, v);
      }
    });
    
    if (duplicatas.length > 0) {
      console.warn('⚠️ Duplicatas de vendedores encontradas:', duplicatas);
    } else {
      console.log('✅ Nenhuma duplicata de vendedor encontrada');
    }
    
    return duplicatas;
  } catch (error) {
    console.error('Erro ao verificar duplicatas:', error);
    return [];
  }
}