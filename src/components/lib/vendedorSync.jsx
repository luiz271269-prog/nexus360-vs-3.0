/**
 * Sincronizador de Vendedores — agora vendedor = User com campo "codigo" preenchido
 * Fonte única: entidade User
 */

import { base44 } from "@/api/base44Client";

export function normalizarNome(nome) {
  if (!nome) return '';
  return nome.trim().replace(/\s+/g, ' ').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Retorna o nome de exibição preferencial do usuário
 * Prioridade: display_name (top-level ou data) > full_name real > email > full_name técnico
 */
export function getNomeExibicao(user) {
  if (!user) return '';
  // display_name pode estar no nível raiz ou dentro de data
  if (user.display_name) return user.display_name;
  if (user.data?.display_name) return user.data.display_name;
  const nome = user.full_name || '';
  // Nome real contém espaço (ex: "João Silva"); nome técnico não (ex: "vendas1")
  if (nome && nome.includes(' ')) return nome;
  // Fallback: email é mais legível que "vendas1"
  return user.email || nome || '';
}

/**
 * Busca User (vendedor) pelo full_name
 */
export async function buscarVendedorPorNome(nome) {
  if (!nome) return null;
  try {
    const users = await base44.entities.User.list();
    const nomeNorm = normalizarNome(nome).toLowerCase();
    return users.find(u =>
      normalizarNome(u.full_name || '').toLowerCase() === nomeNorm ||
      normalizarNome(u.full_name || '').toLowerCase().includes(nomeNorm) ||
      nomeNorm.includes(normalizarNome(u.full_name || '').toLowerCase())
    ) || null;
  } catch (error) {
    console.error('Erro ao buscar vendedor:', error);
    return null;
  }
}

/**
 * Sincroniza clientes com Users (vendedores) por nome
 */
export async function sincronizarClientesComVendedores() {
  console.log('🔄 Sincronizando Clientes com Users (vendedores)...');
  try {
    const [users, clientes] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.Cliente.list()
    ]);

    const vendedores = users.filter(u => u.codigo || u.attendant_sector === 'vendas');
    const vendedorMap = new Map();
    vendedores.forEach(u => {
      // indexar por display_name E por full_name legado
      const nomeDisplay = normalizarNome(getNomeExibicao(u)).toLowerCase();
      if (nomeDisplay) vendedorMap.set(nomeDisplay, u);
      const nomeLegado = normalizarNome(u.full_name || '').toLowerCase();
      if (nomeLegado && nomeLegado !== nomeDisplay) vendedorMap.set(nomeLegado, u);
    });

    let atualizados = 0, erros = 0, semVendedor = 0;

    for (const cliente of clientes) {
      if (!cliente.vendedor_responsavel) { semVendedor++; continue; }
      const nomeNorm = normalizarNome(cliente.vendedor_responsavel).toLowerCase();
      const user = vendedorMap.get(nomeNorm);
      if (user) {
        try {
          await base44.entities.Cliente.update(cliente.id, {
            vendedor_id: user.id,
            vendedor_responsavel: getNomeExibicao(user)
          });
          atualizados++;
        } catch { erros++; }
      } else {
        erros++;
      }
    }

    const resultado = { total: clientes.length, atualizados, erros, semVendedor, sucesso: true };
    console.log('✅ Sincronização concluída:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Erro:', error);
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Atribui vendedor (User) a um cliente
 */
export async function atribuirVendedorAoCliente(clienteId, userId) {
  try {
    const user = await base44.entities.User.get(userId);
    if (!user) throw new Error('Usuário não encontrado');
    await base44.entities.Cliente.update(clienteId, {
      vendedor_id: user.id,
      vendedor_responsavel: user.full_name
    });
    return { sucesso: true, vendedor: user };
  } catch (error) {
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Sincroniza orçamentos: atualiza campo "vendedor" com full_name do User via vendedor_id
 * ou via match de nome aproximado. Resolve nomes legados como "vendas1", "vendas5", etc.
 */
export async function sincronizarOrcamentosComUsuarios() {
  console.log('🔄 Sincronizando Orçamentos com Users...');
  try {
    const [users, orcamentos] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.Orcamento.list()
    ]);

    const userById = new Map(users.map(u => [u.id, u]));
    const userByNome = new Map();
    users.forEach(u => {
      const nome = normalizarNome(getNomeExibicao(u)).toLowerCase();
      if (nome) userByNome.set(nome, u);
      // também indexar pelo full_name legado (ex: 'vendas1')
      const nomeLegado = normalizarNome(u.full_name || '').toLowerCase();
      if (nomeLegado && nomeLegado !== nome) userByNome.set(nomeLegado, u);
    });

    let atualizados = 0, semMatch = 0;

    for (const orc of orcamentos) {
      let user = null;

      if (orc.vendedor_id) user = userById.get(orc.vendedor_id) || null;

      if (!user && orc.vendedor) {
        const nomeNorm = normalizarNome(orc.vendedor).toLowerCase();
        user = userByNome.get(nomeNorm) || null;
      }

      if (!user && orc.vendedor) {
        const nomeNorm = normalizarNome(orc.vendedor).toLowerCase();
        user = users.find(u =>
          normalizarNome(u.full_name || '').toLowerCase().includes(nomeNorm) ||
          (u.email || '').toLowerCase().includes(nomeNorm)
        ) || null;
      }

      if (user) {
        const nomeCorreto = getNomeExibicao(user);
        if (orc.vendedor !== nomeCorreto || orc.vendedor_id !== user.id) {
          try {
            await base44.entities.Orcamento.update(orc.id, {
              vendedor: nomeCorreto,
              vendedor_id: user.id
            });
            atualizados++;
          } catch (e) {
            console.error('Erro ao atualizar orçamento:', orc.id, e);
          }
        }
      } else {
        semMatch++;
      }
    }

    const resultado = { total: orcamentos.length, atualizados, semMatch, sucesso: true };
    console.log('✅ Orçamentos sincronizados:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Erro:', error);
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Resolve o nome de exibição de um vendedor a partir do User.id
 * Fase 1: leitura sempre via User, nunca via entidade Vendedor
 */
export async function resolverNomeVendedor(userId) {
  if (!userId) return null;
  try {
    const users = await base44.entities.User.list();
    const user = users.find(u => u.id === userId);
    return user ? (user.full_name || user.email) : null;
  } catch {
    return null;
  }
}

/**
 * Lista Users que são vendedores (têm codigo ou setor=vendas) para Select/Combobox
 */
export async function listarVendedoresParaSelect() {
  try {
    const users = await base44.entities.User.list();
    const vendedores = users.filter(u => u.codigo || u.attendant_sector === 'vendas');

    const nomesVistos = new Set();
    return vendedores
      .filter(u => {
        const nome = getNomeExibicao(u).trim().toLowerCase();
        if (!nome || nomesVistos.has(nome)) return false;
        nomesVistos.add(nome);
        return true;
      })
      .map(u => ({
        value: u.id,
        label: getNomeExibicao(u),
        email: u.email,
        codigo: u.codigo
      }));
  } catch (error) {
    console.error('Erro ao listar vendedores:', error);
    return [];
  }
}