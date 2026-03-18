// functions/listarTopicosComunicacao.js
// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED TOPIC - Motor de Unificação da Central de Comunicação
// Versão: 1.0.0
// ═══════════════════════════════════════════════════════════════════════════════
// Responsabilidades:
// 1. Buscar Thread, Contact e Cliente do Base44
// 2. Unificar e deduplicar em UnifiedTopic[]
// 3. Aplicar regras de prioridade: Thread > Contato sem Thread > Cliente sem Contato
// 4. Enriquecer com dados do Cliente (ramo_atividade, vendedor, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES DE NORMALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

function normalizarTexto(valor) {
  if (!valor) return '';
  return String(valor).trim().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
}

function normalizarTelefone(valor) {
  if (!valor) return '';
  return String(valor).replace(/\D/g, ''); // Apenas números
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAVE DE UNICIDADE DO CONTATO
// REGRA: TELEFONE + EMPRESA + CARGO + NOME
// ═══════════════════════════════════════════════════════════════════════════════

function makeContactKey({ telefone, empresa, cargo, nome }) {
  const tel = normalizarTelefone(telefone);
  const emp = normalizarTexto(empresa);
  const carg = normalizarTexto(cargo);
  const nom = normalizarTexto(nome);
  return `${tel}|${emp}|${carg}|${nom}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILDERS DE UNIFIED TOPIC
// ═══════════════════════════════════════════════════════════════════════════════

function buildTopicFromThread(thread, contato, cliente) {
  const telefone = contato?.telefone || cliente?.telefone || '';
  const empresa = contato?.empresa || cliente?.nome_fantasia || cliente?.razao_social || '';
  const nomeExibicao = contato?.nome || empresa || telefone || 'Contato';

  // Herança de ramo_atividade: Contact > Cliente > Segmento
  const ramoAtividade = contato?.ramo_atividade || cliente?.ramo_atividade || cliente?.segmento || null;

  return {
    id: `thread:${thread.id}`,
    origin: 'thread',
    thread_id: thread.id,
    contato_id: contato?.id || null,
    cliente_id: cliente?.id || null,

    nome_exibicao: nomeExibicao,
    telefone,
    empresa,
    cargo: contato?.cargo || null,
    email: contato?.email || cliente?.email || null,
    vendedor_responsavel: contato?.vendedor_responsavel || cliente?.vendedor_responsavel || null,
    ramo_atividade: ramoAtividade,
    segmento: cliente?.segmento || null,
    tipo_contato: contato?.tipo_contato || 'novo',
    tags: contato?.tags || [],

    // Dados da thread
    last_message_at: thread.last_message_at,
    last_message_content: thread.last_message_content,
    last_message_sender: thread.last_message_sender,
    last_media_type: thread.last_media_type,
    unread_count: thread.unread_count || 0,
    status: thread.status,
    assigned_user_id: thread.assigned_user_id,
    assigned_user_name: thread.assigned_user_name,
    whatsapp_integration_id: thread.whatsapp_integration_id,

    status_label: 'Conversa ativa',
    is_contact_only: false,
    is_cliente_only: false
  };
}

function buildTopicFromContatoSemThread(contato, cliente) {
  const telefone = contato.telefone || cliente?.telefone || '';
  const empresa = contato.empresa || cliente?.nome_fantasia || cliente?.razao_social || '';
  const nomeExibicao = contato.nome || empresa || telefone || 'Contato';

  const ramoAtividade = contato.ramo_atividade || cliente?.ramo_atividade || cliente?.segmento || null;

  return {
    id: `contato:${contato.id}`,
    origin: 'contato_sem_thread',
    contato_id: contato.id,
    cliente_id: cliente?.id || null,

    nome_exibicao: nomeExibicao,
    telefone,
    empresa,
    cargo: contato.cargo || null,
    email: contato.email || cliente?.email || null,
    vendedor_responsavel: contato.vendedor_responsavel || cliente?.vendedor_responsavel || null,
    ramo_atividade: ramoAtividade,
    segmento: cliente?.segmento || null,
    tipo_contato: contato.tipo_contato || 'novo',
    tags: contato.tags || [],

    // Sem dados de thread
    last_message_at: contato.ultima_interacao || contato.created_date,
    last_message_content: null,
    last_message_sender: null,
    last_media_type: 'none',
    unread_count: 0,
    status: 'sem_conversa',
    assigned_user_id: null,
    assigned_user_name: null,
    whatsapp_integration_id: null,

    status_label: 'Contato sem conversa',
    is_contact_only: true,
    is_cliente_only: false
  };
}

function buildTopicFromClienteSemContato(cliente) {
  const empresa = cliente.nome_fantasia || cliente.razao_social || cliente.cnpj || '';
  const nomeExibicao = cliente.contato_principal_nome || empresa;
  const ramoAtividade = cliente.ramo_atividade || cliente.segmento || null;

  return {
    id: `cliente:${cliente.id}`,
    origin: 'cliente_sem_contato',
    cliente_id: cliente.id,
    contato_id: null,

    nome_exibicao: nomeExibicao,
    telefone: cliente.telefone || '',
    empresa,
    cargo: cliente.contato_principal_cargo || null,
    email: cliente.email || null,
    vendedor_responsavel: cliente.vendedor_responsavel || null,
    ramo_atividade: ramoAtividade,
    segmento: cliente.segmento || null,
    tipo_contato: 'cliente',
    tags: [],

    // Sem dados de thread
    last_message_at: cliente.ultimo_contato || cliente.created_date,
    last_message_content: null,
    last_message_sender: null,
    last_media_type: 'none',
    unread_count: 0,
    status: 'sem_conversa',
    assigned_user_id: null,
    assigned_user_name: null,
    whatsapp_integration_id: null,

    status_label: 'Cliente sem contato',
    is_contact_only: false,
    is_cliente_only: true
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES DE BUSCA NO BASE44
// ═══════════════════════════════════════════════════════════════════════════════

async function buscarThreads(base44, limit = 200) {
  try {
    const threads = await base44.asServiceRole.entities.MessageThread.list('-last_message_at', limit);
    return threads || [];
  } catch (error) {
    console.error('[UnifiedTopic] Erro ao buscar threads:', error.message);
    return [];
  }
}

async function buscarContatos(base44, limit = 500) {
  try {
    const contatos = await base44.asServiceRole.entities.Contact.list('-created_date', limit);
    return contatos || [];
  } catch (error) {
    console.error('[UnifiedTopic] Erro ao buscar contatos:', error.message);
    return [];
  }
}

async function buscarClientes(base44, limit = 300) {
  try {
    const clientes = await base44.asServiceRole.entities.Cliente.list('-created_date', limit);
    return clientes || [];
  } catch (error) {
    console.error('[UnifiedTopic] Erro ao buscar clientes:', error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO DE BUSCA (MATCH ESTILO GOOGLE)
// ═══════════════════════════════════════════════════════════════════════════════

function matchBuscaGoogle(item, termo) {
  if (!termo || termo.length < 2) return true;

  const termoNormalizado = normalizarTexto(termo);
  const termoNumeros = normalizarTelefone(termo);
  const palavrasBusca = termoNormalizado.split(/\s+/).filter(p => p.length > 0);

  // Campos de texto para busca
  const camposTexto = [
    item.nome,
    item.empresa,
    item.cargo,
    item.email,
    item.observacoes,
    item.vendedor_responsavel,
    item.ramo_atividade,
    item.segmento_atual,
    // Campos de Cliente
    item.razao_social,
    item.nome_fantasia,
    item.contato_principal_nome,
    item.segmento,
    ...(Array.isArray(item.tags) ? item.tags : [])
  ].filter(Boolean);

  // Campos numéricos (telefone, CNPJ)
  const camposNumero = [
    item.telefone,
    item.cnpj
  ].filter(Boolean);

  const textoCompleto = camposTexto.map(c => normalizarTexto(String(c))).join(' ');
  const numerosCompletos = camposNumero.map(c => normalizarTelefone(String(c))).join(' ');

  // Todas as palavras devem aparecer
  const todasPalavrasEncontradas = palavrasBusca.every(palavra =>
    textoCompleto.includes(palavra)
  );

  // OU busca por número parcial (mínimo 3 dígitos)
  const numeroEncontrado = termoNumeros.length >= 3 && numerosCompletos.includes(termoNumeros);

  return todasPalavrasEncontradas || numeroEncontrado;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    const limitParam = parseInt(url.searchParams.get('limit') || '100', 10);

    console.log(`[UnifiedTopic] 🔍 Busca: "${q}" | Limit: ${limitParam}`);

    // 1. Buscar dados em paralelo
    const [threads, contatos, clientes] = await Promise.all([
      buscarThreads(base44, 200),
      buscarContatos(base44, 500),
      buscarClientes(base44, 300)
    ]);

    console.log(`[UnifiedTopic] 📊 Dados: ${threads.length} threads | ${contatos.length} contatos | ${clientes.length} clientes`);

    // 2. Indexar em memória para "JOIN"
    const clientesById = new Map();
    for (const cli of clientes) {
      clientesById.set(cli.id, cli);
    }

    const contatosById = new Map();
    const contatosPorClienteId = new Map();
    for (const c of contatos) {
      contatosById.set(c.id, c);
      if (c.cliente_id) {
        if (!contatosPorClienteId.has(c.cliente_id)) {
          contatosPorClienteId.set(c.cliente_id, []);
        }
        contatosPorClienteId.get(c.cliente_id).push(c);
      }
    }

    const topics = [];
    const representedClients = new Set();      // IDs de clientes já representados
    const representedContactKeys = new Set();  // TELEFONE+EMPRESA+CARGO+NOME

    // ═══════════════════════════════════════════════════════════════════════════════
    // NÍVEL 1: THREADS (prioridade máxima)
    // ═══════════════════════════════════════════════════════════════════════════════
    for (const thread of threads) {
      const contato = thread.contact_id ? contatosById.get(thread.contact_id) : null;
      const cliente = (contato?.cliente_id) ? clientesById.get(contato.cliente_id) : null;

      // Aplicar filtro de busca
      if (q) {
        const matchThread = matchBuscaGoogle(thread, q);
        const matchContato = contato ? matchBuscaGoogle(contato, q) : false;
        const matchCliente = cliente ? matchBuscaGoogle(cliente, q) : false;
        if (!matchThread && !matchContato && !matchCliente) continue;
      }

      const topic = buildTopicFromThread(thread, contato, cliente);

      // Marcar chave de contato como representada
      if (contato) {
        const key = makeContactKey({
          telefone: topic.telefone,
          empresa: topic.empresa,
          cargo: topic.cargo,
          nome: contato.nome
        });
        representedContactKeys.add(key);
      }

      if (cliente?.id) {
        representedClients.add(cliente.id);
      }

      topics.push(topic);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // NÍVEL 2: CONTATOS SEM THREAD
    // ═══════════════════════════════════════════════════════════════════════════════
    for (const contato of contatos) {
      // Pular contatos bloqueados
      if (contato.bloqueado) continue;

      const cliente = contato.cliente_id ? clientesById.get(contato.cliente_id) : null;

      // Aplicar filtro de busca
      if (q) {
        const matchContato = matchBuscaGoogle(contato, q);
        const matchCliente = cliente ? matchBuscaGoogle(cliente, q) : false;
        if (!matchContato && !matchCliente) continue;
      }

      const topic = buildTopicFromContatoSemThread(contato, cliente);

      const key = makeContactKey({
        telefone: topic.telefone,
        empresa: topic.empresa,
        cargo: topic.cargo,
        nome: contato.nome
      });

      // Se essa chave já foi representada por uma thread, pular
      if (representedContactKeys.has(key)) {
        continue;
      }

      representedContactKeys.add(key);

      if (cliente?.id) {
        representedClients.add(cliente.id);
      }

      topics.push(topic);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // NÍVEL 3: CLIENTES SEM CONTATO
    // ═══════════════════════════════════════════════════════════════════════════════
    for (const cliente of clientes) {
      // Se já tiver contato representando esse cliente, pula
      if (representedClients.has(cliente.id)) {
        continue;
      }

      // Aplicar filtro de busca
      if (q && !matchBuscaGoogle(cliente, q)) {
        continue;
      }

      const topic = buildTopicFromClienteSemContato(cliente);
      topics.push(topic);

      representedClients.add(cliente.id);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ORDENAÇÃO FINAL
    // 1º conversas ativas (por última mensagem)
    // 2º contatos sem conversa
    // 3º clientes sem contato
    // ═══════════════════════════════════════════════════════════════════════════════
    topics.sort((a, b) => {
      const peso = (t) => {
        if (t.origin === 'thread') return 0;
        if (t.origin === 'contato_sem_thread') return 1;
        if (t.origin === 'cliente_sem_contato') return 2;
        return 3;
      };

      const pa = peso(a);
      const pb = peso(b);
      if (pa !== pb) return pa - pb;

      // Dentro do mesmo grupo: mais recente primeiro
      const dateA = new Date(a.last_message_at || 0).getTime();
      const dateB = new Date(b.last_message_at || 0).getTime();
      return dateB - dateA;
    });

    // Aplicar limit
    const topicsLimitados = topics.slice(0, limitParam);

    console.log(`[UnifiedTopic] ✅ Retornando ${topicsLimitados.length} tópicos unificados`);

    return new Response(
      JSON.stringify({
        success: true,
        topics: topicsLimitados,
        total: topics.length,
        query: q
      }),
      { status: 200, headers }
    );

  } catch (error) {
    console.error('[UnifiedTopic] ❌ Erro:', error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        topics: []
      }),
      { status: 500, headers }
    );
  }
});