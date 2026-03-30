/**
 * Remove duplicatas de um array de entidades pelo campo `id`.
 * Mantém o registro mais recente (updated_date) quando há duplicatas.
 */
export function dedupById(arr) {
  if (!Array.isArray(arr)) return [];
  const map = new Map();
  for (const item of arr) {
    const key = item.id;
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      // Manter o mais recente
      const dNew = new Date(item.updated_date || item.created_date || 0);
      const dOld = new Date(existing.updated_date || existing.created_date || 0);
      if (dNew > dOld) map.set(key, item);
    }
  }
  return Array.from(map.values());
}

/**
 * Deduplicar Contatos pelo telefone_canonico ou telefone.
 * Mantém o registro com mais campos preenchidos.
 */
export function dedupContatos(arr) {
  if (!Array.isArray(arr)) return [];
  // Primeiro dedup por id
  const porId = dedupById(arr);
  // Depois dedup por telefone canônico
  const map = new Map();
  const semTelefone = [];
  for (const c of porId) {
    const tel = c.telefone_canonico || c.telefone;
    if (!tel) { semTelefone.push(c); continue; }
    const existing = map.get(tel);
    if (!existing) {
      map.set(tel, c);
    } else {
      // Manter o com mais campos preenchidos
      const scoreNew = Object.values(c).filter(v => v !== null && v !== undefined && v !== '').length;
      const scoreOld = Object.values(existing).filter(v => v !== null && v !== undefined && v !== '').length;
      if (scoreNew > scoreOld) map.set(tel, c);
    }
  }
  return [...Array.from(map.values()), ...semTelefone];
}

/**
 * Deduplicar Clientes pelo CNPJ ou razao_social.
 */
export function dedupClientes(arr) {
  if (!Array.isArray(arr)) return [];
  const porId = dedupById(arr);
  const map = new Map();
  const semChave = [];
  for (const c of porId) {
    const key = c.cnpj || (c.razao_social || '').trim().toLowerCase();
    if (!key) { semChave.push(c); continue; }
    const existing = map.get(key);
    if (!existing) {
      map.set(key, c);
    } else {
      const dNew = new Date(c.updated_date || c.created_date || 0);
      const dOld = new Date(existing.updated_date || existing.created_date || 0);
      if (dNew > dOld) map.set(key, c);
    }
  }
  return [...Array.from(map.values()), ...semChave];
}

/**
 * Deduplicar Vendas pelo numero_pedido.
 */
export function dedupVendas(arr) {
  if (!Array.isArray(arr)) return [];
  const porId = dedupById(arr);
  const map = new Map();
  const semNumero = [];
  for (const v of porId) {
    const key = v.numero_pedido;
    if (!key) { semNumero.push(v); continue; }
    const existing = map.get(key);
    if (!existing) {
      map.set(key, v);
    } else {
      const dNew = new Date(v.updated_date || v.created_date || 0);
      const dOld = new Date(existing.updated_date || existing.created_date || 0);
      if (dNew > dOld) map.set(key, v);
    }
  }
  return [...Array.from(map.values()), ...semNumero];
}

/**
 * Deduplicar Orçamentos pelo numero_orcamento.
 */
export function dedupOrcamentos(arr) {
  if (!Array.isArray(arr)) return [];
  const porId = dedupById(arr);
  const map = new Map();
  const semNumero = [];
  for (const o of porId) {
    const key = o.numero_orcamento;
    if (!key) { semNumero.push(o); continue; }
    const existing = map.get(key);
    if (!existing) {
      map.set(key, o);
    } else {
      const dNew = new Date(o.updated_date || o.created_date || 0);
      const dOld = new Date(existing.updated_date || existing.created_date || 0);
      if (dNew > dOld) map.set(key, o);
    }
  }
  return [...Array.from(map.values()), ...semNumero];
}