// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ MOTOR DE DESDUPLICAÇÃO AUTOMÁTICA - BUSCA E CONSOLIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════
// Implementa a lógica de busca inteligente com variações de telefone
// e consolidação automática de duplicatas, conforme especificação do estudo.
// ═══════════════════════════════════════════════════════════════════════════════

import { normalizarTelefone } from './phoneUtils';

/**
 * Gera todas as variações possíveis de um telefone normalizado
 * Exemplo: 5548999999999 → [5548999999999, 554899999999, 48999999999, 4899999999]
 */
export function gerarVariacoesTelefone(telefoneNormalizado) {
  if (!telefoneNormalizado) return [];
  
  const variacoes = new Set([telefoneNormalizado]);
  
  // Se é número brasileiro (começa com 55)
  if (telefoneNormalizado.startsWith('55')) {
    const semDDI = telefoneNormalizado.substring(2); // Remove 55
    variacoes.add(semDDI);
    
    // Se tem 11 dígitos (com 9), adicionar versão sem o 9
    if (semDDI.length === 11 && semDDI.charAt(2) === '9') {
      const sem9 = semDDI.substring(0, 2) + semDDI.substring(3);
      variacoes.add(sem9);
      variacoes.add('55' + sem9); // Com DDI mas sem 9
    }
    
    // Se tem 10 dígitos (sem 9), adicionar versão com o 9
    if (semDDI.length === 10) {
      const com9 = semDDI.substring(0, 2) + '9' + semDDI.substring(2);
      variacoes.add(com9);
      variacoes.add('55' + com9); // Com DDI e com 9
    }
  }
  
  return Array.from(variacoes);
}

/**
 * Busca TODOS os contatos com qualquer variação do telefone
 * ✅ AGNÓSTICO de provedor/instância/integração
 */
export async function buscarContatosPorTelefone(base44, telefone) {
  const normalizado = normalizarTelefone(telefone);
  if (!normalizado) return [];
  
  const variacoes = gerarVariacoesTelefone(normalizado);
  
  // Buscar TODOS os contatos com qualquer uma das variações
  const promises = variacoes.map(variacao =>
    base44.entities.Contact.filter({ telefone: variacao })
  );
  
  const resultados = await Promise.all(promises);
  const todosContatos = resultados.flat();
  
  // Remover duplicatas por ID
  const contatosUnicos = Array.from(
    new Map(todosContatos.map(c => [c.id, c])).values()
  );
  
  return contatosUnicos;
}

/**
 * Escolhe o contato PRINCIPAL de uma lista de duplicatas
 * Critérios (em ordem de prioridade - DINÂMICO):
 * 1. tipo_contato: cliente > lead > parceiro > fornecedor > novo
 * 2. Último atualizado (mais recente) - para capturar dados atualizados
 * 3. Última interação recente - atividade
 * 4. Mais antigo (como fallback)
 */
export function escolherContatoPrincipal(contatos) {
  if (!contatos || contatos.length === 0) return null;
  if (contatos.length === 1) return contatos[0];
  
  const prioridades = {
    'cliente': 5,
    'lead': 4,
    'parceiro': 3,
    'fornecedor': 2,
    'novo': 1
  };
  
  // Ordenar por múltiplos critérios para evitar seleção "fixa"
  const ordenados = [...contatos].sort((a, b) => {
    // 1️⃣ PRIORIDADE: tipo_contato
    const prioA = prioridades[a.tipo_contato] || 0;
    const prioB = prioridades[b.tipo_contato] || 0;
    if (prioB !== prioA) return prioB - prioA;
    
    // 2️⃣ DINÂMICO: Mais recentemente ATUALIZADO (dados frescos)
    const updateA = new Date(a.updated_date || a.created_date).getTime();
    const updateB = new Date(b.updated_date || b.created_date).getTime();
    if (updateA !== updateB) return updateB - updateA; // Mais recente primeiro
    
    // 3️⃣ DINÂMICO: Última interação (atividade recente)
    const interacaoA = a.ultima_interacao ? new Date(a.ultima_interacao).getTime() : 0;
    const interacaoB = b.ultima_interacao ? new Date(b.ultima_interacao).getTime() : 0;
    if (interacaoA !== interacaoB) return interacaoB - interacaoA; // Mais ativo primeiro
    
    // 4️⃣ FALLBACK: Mais antigo
    const dataA = new Date(a.created_date).getTime();
    const dataB = new Date(b.created_date).getTime();
    return dataA - dataB;
  });
  
  return ordenados[0];
}

/**
 * Consolida duplicatas automaticamente
 * ✅ Migra threads para o contato principal
 * ✅ Marca duplicatas como mescladas
 * 
 * @returns {object} { principal, duplicatas, threadsMovidas }
 */
export async function consolidarDuplicatasAutomatico(base44, telefone) {
  const contatos = await buscarContatosPorTelefone(base44, telefone);
  
  if (contatos.length <= 1) {
    return { 
      principal: contatos[0] || null, 
      duplicatas: [], 
      threadsMovidas: 0 
    };
  }
  
  const principal = escolherContatoPrincipal(contatos);
  const duplicatas = contatos.filter(c => c.id !== principal.id);
  
  console.log(`[DEDUPE] Consolidando ${duplicatas.length} duplicatas para o principal ${principal.id}`);
  
  let threadsMovidas = 0;
  
  // Migrar threads das duplicatas para o principal
  for (const duplicata of duplicatas) {
    try {
      // Buscar threads desta duplicata
      const threads = await base44.entities.MessageThread.filter({
        contact_id: duplicata.id
      });
      
      // Migrar cada thread para o principal
      for (const thread of threads) {
        await base44.entities.MessageThread.update(thread.id, {
          contact_id: principal.id
        });
        threadsMovidas++;
      }
      
      // Marcar duplicata como mesclada
      await base44.entities.Contact.update(duplicata.id, {
        observacoes: (duplicata.observacoes || '') + 
          `\n\n[MESCLADO] Contato mesclado em ${principal.nome} (ID: ${principal.id}) em ${new Date().toLocaleString('pt-BR')}`,
        tipo_contato: 'novo', // Rebaixar para "novo"
        bloqueado: true, // Opcional: bloquear para evitar uso acidental
        motivo_bloqueio: `Duplicata mesclada no contato ${principal.id}`
      });
      
      console.log(`[DEDUPE] ✅ Migradas ${threads.length} threads de ${duplicata.id} → ${principal.id}`);
    } catch (error) {
      console.error(`[DEDUPE] ❌ Erro ao migrar threads de ${duplicata.id}:`, error);
    }
  }
  
  return { principal, duplicatas, threadsMovidas };
}

/**
 * Busca ou consolida contato - DEVE RODAR EM TODO PONTO DE BUSCA
 * ✅ Normaliza telefone
 * ✅ Busca todas as variações
 * ✅ Consolida automaticamente se houver duplicatas
 * ✅ Retorna o contato principal único
 */
export async function buscarOuConsolidarContato(base44, telefone) {
  const normalizado = normalizarTelefone(telefone);
  if (!normalizado) return null;
  
  const contatos = await buscarContatosPorTelefone(base44, telefone);
  
  if (contatos.length === 0) return null;
  if (contatos.length === 1) return contatos[0];
  
  // Múltiplos contatos → CONSOLIDAR AUTOMATICAMENTE
  console.log(`[DEDUPE] ⚠️ Encontradas ${contatos.length} duplicatas para ${normalizado}. Consolidando...`);
  
  const resultado = await consolidarDuplicatasAutomatico(base44, telefone);
  
  console.log(`[DEDUPE] ✅ Consolidação concluída: ${resultado.threadsMovidas} threads migradas`);
  
  return resultado.principal;
}