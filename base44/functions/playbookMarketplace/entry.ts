import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  PLAYBOOK MARKETPLACE                                         ║
 * ║  Instalação, avaliação e gestão de playbooks prontos         ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') {
    return Response.json(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    }

    const payload = await req.json();
    const { action, ...params } = payload;

    console.log('[MARKETPLACE] 🛍️ Action:', action);

    switch (action) {
      case 'list_playbooks':
        return Response.json(await listarPlaybooks(base44, params), { headers });
      
      case 'install_playbook':
        return Response.json(await instalarPlaybook(base44, user, params), { headers });
      
      case 'rate_playbook':
        return Response.json(await avaliarPlaybook(base44, user, params), { headers });
      
      case 'create_default_marketplace':
        return Response.json(await criarMarketplacePadrao(base44), { headers });
      
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

  } catch (error) {
    console.error('[MARKETPLACE] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500, headers });
  }
});

async function listarPlaybooks(base44, params) {
  const { categoria, setor, nivel_dificuldade } = params;

  const query = { ativo: true };
  
  if (categoria) query.categoria = categoria;
  if (setor) query.setor = setor;
  if (nivel_dificuldade) query.nivel_dificuldade = nivel_dificuldade;

  const playbooks = await base44.asServiceRole.entities.PlaybookMarketplace.filter(
    query,
    '-total_instalacoes',
    50
  );

  return {
    success: true,
    total: playbooks.length,
    playbooks: playbooks.map(p => ({
      id: p.id,
      nome: p.nome,
      descricao: p.descricao,
      categoria: p.categoria,
      setor: p.setor,
      nivel_dificuldade: p.nivel_dificuldade,
      avaliacao_media: p.avaliacao_media,
      total_instalacoes: p.total_instalacoes,
      destaque: p.destaque
    }))
  };
}

async function instalarPlaybook(base44, user, params) {
  const { playbook_id, customizar } = params;

  console.log(`[MARKETPLACE] 📥 Instalando playbook ${playbook_id}`);

  try {
    const playbook = await base44.asServiceRole.entities.PlaybookMarketplace.get(playbook_id);

    // Criar FlowTemplate baseado no template do marketplace
    const novoFlow = await base44.asServiceRole.entities.FlowTemplate.create({
      ...playbook.template_json,
      nome: customizar?.nome || `${playbook.nome} (Instalado)`,
      descricao: customizar?.descricao || playbook.descricao,
      created_by: user.id,
      metricas: {
        total_execucoes: 0,
        total_concluidos: 0,
        total_abandonados: 0,
        tempo_medio_conclusao: 0,
        taxa_sucesso: 0
      }
    });

    // Atualizar contador de instalações
    await base44.asServiceRole.entities.PlaybookMarketplace.update(playbook_id, {
      total_instalacoes: (playbook.total_instalacoes || 0) + 1
    });

    console.log(`[MARKETPLACE] ✅ Playbook instalado: ${novoFlow.id}`);

    return {
      success: true,
      message: `Playbook "${playbook.nome}" instalado com sucesso`,
      flow_template_id: novoFlow.id,
      nome: novoFlow.nome
    };

  } catch (error) {
    console.error('[MARKETPLACE] Erro ao instalar:', error);
    throw error;
  }
}

async function avaliarPlaybook(base44, user, params) {
  const { playbook_id, rating, comentario } = params;

  if (rating < 1 || rating > 5) {
    throw new Error('Avaliação deve estar entre 1 e 5');
  }

  const playbook = await base44.asServiceRole.entities.PlaybookMarketplace.get(playbook_id);

  const novaMedia = (
    (playbook.avaliacao_media * playbook.total_avaliacoes) + rating
  ) / (playbook.total_avaliacoes + 1);

  await base44.asServiceRole.entities.PlaybookMarketplace.update(playbook_id, {
    avaliacao_media: novaMedia,
    total_avaliacoes: playbook.total_avaliacoes + 1
  });

  return {
    success: true,
    message: 'Avaliação registrada',
    nova_media: novaMedia
  };
}

async function criarMarketplacePadrao(base44) {
  console.log('[MARKETPLACE] 🏗️ Criando playbooks padrão...');

  const playbooks = [
    {
      nome: 'Boas-vindas e Qualificação de Lead',
      descricao: 'Fluxo completo de boas-vindas que qualifica o lead automaticamente',
      categoria: 'qualificacao',
      setor: 'todos',
      nivel_dificuldade: 'iniciante',
      destaque: true,
      template_json: {
        nome: 'Boas-vindas e Qualificação',
        gatilhos: ['ola', 'oi', 'bom dia'],
        steps: [
          {
            type: 'message',
            texto: 'Olá! 👋 Bem-vindo(a)! Sou o assistente virtual e estou aqui para te ajudar.'
          },
          {
            type: 'input',
            texto: 'Para começar, qual é o seu nome?',
            campo: 'nome',
            tipo_input: 'text'
          },
          {
            type: 'message',
            texto: 'Prazer em te conhecer, {{nome}}! 😊'
          },
          {
            type: 'input',
            texto: 'Como posso te ajudar hoje?\n\n1️⃣ Conhecer produtos\n2️⃣ Solicitar orçamento\n3️⃣ Suporte técnico\n4️⃣ Falar com vendedor',
            campo: 'interesse',
            opcoes: ['1', '2', '3', '4']
          },
          {
            type: 'route',
            mapa: {
              '1': 'catalogo_produtos',
              '2': 'solicitar_orcamento',
              '3': 'suporte_tecnico',
              '4': 'transferir_vendedor'
            }
          }
        ]
      },
      preview_steps: [
        'Mensagem de boas-vindas',
        'Coleta do nome',
        'Menu de opções',
        'Roteamento inteligente'
      ],
      tags_recomendadas: ['lead_novo', 'em_qualificacao']
    },
    {
      nome: 'Follow-up de Orçamento Enviado',
      descricao: 'Automatiza o acompanhamento de orçamentos enviados',
      categoria: 'vendas',
      setor: 'todos',
      nivel_dificuldade: 'intermediario',
      destaque: true,
      template_json: {
        nome: 'Follow-up Orçamento',
        gatilhos: [],
        steps: [
          {
            type: 'message',
            texto: 'Olá {{nome}}! 👋\n\nPassei para saber se você recebeu nosso orçamento e se ficou com alguma dúvida.'
          },
          {
            type: 'delay',
            delay_seconds: 3600
          },
          {
            type: 'input',
            texto: 'Conseguiu analisar nossa proposta?',
            campo: 'analisou',
            opcoes: ['Sim', 'Ainda não', 'Preciso de mais informações']
          },
          {
            type: 'route',
            mapa: {
              'Sim': 'negociacao',
              'Ainda não': 'lembrar_depois',
              'Preciso de mais informações': 'agendar_reuniao'
            }
          }
        ]
      },
      preview_steps: [
        'Mensagem inicial de follow-up',
        'Aguarda 1 hora',
        'Pergunta sobre análise',
        'Roteamento baseado na resposta'
      ],
      tags_recomendadas: ['orcamento_enviado', 'follow_up']
    },
    {
      nome: 'Reativação de Clientes Inativos',
      descricao: 'Recupera clientes que não compram há mais de 90 dias',
      categoria: 'reativacao',
      setor: 'todos',
      nivel_dificuldade: 'intermediario',
      destaque: false,
      template_json: {
        nome: 'Reativação 90 dias',
        gatilhos: [],
        steps: [
          {
            type: 'message',
            texto: 'Olá {{nome}}! 😊\n\nSentimos sua falta! Temos novidades especiais para clientes como você.'
          },
          {
            type: 'message',
            texto: '🎁 Preparamos uma oferta exclusiva:\n\n✨ 15% de desconto\n✨ Frete grátis\n✨ Suporte prioritário\n\nVálido apenas esta semana!'
          },
          {
            type: 'input',
            texto: 'Que tal voltarmos a trabalhar juntos? Posso te mostrar nossos novos produtos?',
            campo: 'interesse_reativacao',
            opcoes: ['Sim, quero conhecer', 'Envie o catálogo', 'Não tenho interesse no momento']
          },
          {
            type: 'route',
            mapa: {
              'Sim, quero conhecer': 'mostrar_novidades',
              'Envie o catálogo': 'enviar_catalogo',
              'Não tenho interesse no momento': 'agendar_contato_futuro'
            }
          }
        ]
      },
      preview_steps: [
        'Mensagem de reativação',
        'Oferta exclusiva',
        'Coleta de interesse',
        'Roteamento'
      ],
      tags_recomendadas: ['cliente_inativo', 'reativacao']
    },
    {
      nome: 'Pós-venda e Satisfação',
      descricao: 'Coleta feedback e garante satisfação após a compra',
      categoria: 'pos_venda',
      setor: 'todos',
      nivel_dificuldade: 'iniciante',
      destaque: false,
      template_json: {
        nome: 'Pós-venda',
        gatilhos: [],
        steps: [
          {
            type: 'message',
            texto: 'Olá {{nome}}! 🎉\n\nSeu produto foi entregue e queremos saber: está tudo certo?'
          },
          {
            type: 'input',
            texto: 'Como foi sua experiência de compra?\n\n⭐⭐⭐⭐⭐ Excelente\n⭐⭐⭐⭐ Boa\n⭐⭐⭐ Regular\n⭐⭐ Ruim\n⭐ Péssima',
            campo: 'satisfacao',
            opcoes: ['5', '4', '3', '2', '1']
          },
          {
            type: 'message',
            texto: 'Obrigado pelo feedback! Ele é muito importante para nós. 💙'
          },
          {
            type: 'action',
            acao: 'registrarFeedback'
          }
        ]
      },
      preview_steps: [
        'Mensagem pós-entrega',
        'Coleta de satisfação',
        'Agradecimento',
        'Registro de feedback'
      ],
      tags_recomendadas: ['pos_venda', 'feedback']
    },
    {
      nome: 'Cobrança Amigável',
      descricao: 'Lembra o cliente sobre pagamentos pendentes de forma educada',
      categoria: 'cobranca',
      setor: 'todos',
      nivel_dificuldade: 'intermediario',
      destaque: false,
      template_json: {
        nome: 'Cobrança Amigável',
        gatilhos: [],
        steps: [
          {
            type: 'message',
            texto: 'Olá {{nome}}! 😊\n\nPassei para lembrá-lo(a) que identificamos um pagamento pendente.'
          },
          {
            type: 'message',
            texto: '📋 Detalhes:\n\nValor: R$ {{valor_pendente}}\nVencimento: {{data_vencimento}}\n\nPodemos te ajudar com algo?'
          },
          {
            type: 'input',
            texto: 'Como prefere resolver?\n\n1️⃣ Já paguei\n2️⃣ Enviar novo boleto\n3️⃣ Negociar condições\n4️⃣ Falar com financeiro',
            campo: 'opcao_cobranca',
            opcoes: ['1', '2', '3', '4']
          },
          {
            type: 'route',
            mapa: {
              '1': 'confirmar_pagamento',
              '2': 'gerar_novo_boleto',
              '3': 'negociar',
              '4': 'transferir_financeiro'
            }
          }
        ]
      },
      preview_steps: [
        'Lembrete educado',
        'Detalhes do pagamento',
        'Opções de resolução',
        'Roteamento'
      ],
      tags_recomendadas: ['cobranca', 'pagamento_pendente']
    }
  ];

  let criados = 0;

  for (const playbook of playbooks) {
    try {
      await base44.asServiceRole.entities.PlaybookMarketplace.create(playbook);
      criados++;
      console.log(`[MARKETPLACE] ✅ Criado: ${playbook.nome}`);
    } catch (error) {
      console.error(`[MARKETPLACE] Erro ao criar ${playbook.nome}:`, error.message);
    }
  }

  return {
    success: true,
    message: `${criados} playbooks criados no marketplace`,
    total_criados: criados
  };
}