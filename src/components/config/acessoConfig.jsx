// components/config/acessoConfig.js

export const PAGINAS_E_ACOES_DO_SISTEMA = [
  // --- Nível 1: Menus/Páginas Principais ---
  {
    identificador: "Comunicacao",
    nome: "Central de Comunicação",
    tipo: "menu",
    path_frontend: "/Comunicacao",
    categoria: "Comunicação",
    description: "Gerencia a comunicação com clientes via WhatsApp e outros canais.",
    sub_recursos: [
      {
        identificador: "Comunicacao.conversas",
        nome: "Conversas",
        tipo: "subtela",
        path_frontend: "conversas",
        description: "Interface principal de chat para atendimento ao cliente.",
        permissoes_funcao: [
          { identificador: "Comunicacao.conversas.enviar_mensagem", nome: "Enviar Mensagem de Texto", tipo: "acao", description: "Permite enviar mensagens de texto no chat." },
          { identificador: "Comunicacao.conversas.enviar_midia", nome: "Enviar Mídia (Imagens, Vídeos, Docs)", tipo: "acao", description: "Permite anexar e enviar arquivos de mídia." },
          { identificador: "Comunicacao.conversas.enviar_audio", nome: "Enviar Áudios", tipo: "acao", description: "Permite gravar e enviar mensagens de voz." },
          { identificador: "Comunicacao.conversas.transferir", nome: "Transferir Conversa", tipo: "acao", description: "Permite transferir conversas para outros atendentes." },
          { identificador: "Comunicacao.conversas.apagar_mensagem", nome: "Apagar Mensagem", tipo: "acao", description: "Permite apagar mensagens enviadas (para todos)." },
          { identificador: "Comunicacao.conversas.ver_detalhes_contato", nome: "Ver Detalhes do Contato", tipo: "acao", description: "Permite visualizar informações completas do contato." },
          { identificador: "Comunicacao.conversas.criar_oportunidade", nome: "Criar Oportunidade de Chat", tipo: "acao", description: "Permite criar oportunidades de venda diretamente do chat." },
          { identificador: "Comunicacao.conversas.ver_todas", nome: "Ver Todas Conversas (Supervisão)", tipo: "acao", description: "Permite visualizar conversas de outros atendentes." },
        ]
      },
      {
        identificador: "Comunicacao.controle_operacional",
        nome: "Controle Operacional",
        tipo: "subtela",
        path_frontend: "controle",
        description: "Dashboard de monitoramento de filas e saúde do sistema WhatsApp.",
        permissoes_funcao: [
          { identificador: "Comunicacao.controle_operacional.gerenciar_filas", nome: "Gerenciar Filas de Atendimento", tipo: "acao", description: "Permite modificar a prioridade e atribuição de filas." },
          { identificador: "Comunicacao.controle_operacional.ver_metricas", nome: "Ver Métricas Operacionais", tipo: "acao", description: "Permite acesso a KPIs de performance da central." },
        ]
      },
      {
        identificador: "Comunicacao.automacao",
        nome: "Automação",
        tipo: "subtela",
        path_frontend: "automacao",
        description: "Gerenciamento de playbooks, respostas rápidas e automações de atendimento.",
        permissoes_funcao: [
          { identificador: "Comunicacao.automacao.gerenciar_playbooks", nome: "Gerenciar Playbooks", tipo: "acao", description: "Permite criar, editar e desativar playbooks de automação." },
          { identificador: "Comunicacao.automacao.gerenciar_respostas_rapidas", nome: "Gerenciar Respostas Rápidas", tipo: "acao", description: "Permite criar e editar respostas rápidas." },
          { identificador: "Comunicacao.automacao.gerenciar_pre_atendimento", nome: "Gerenciar Pré-Atendimento", tipo: "acao", description: "Permite configurar fluxos de pré-atendimento." },
        ]
      },
      {
        identificador: "Comunicacao.diagnostico",
        nome: "Diagnóstico",
        tipo: "subtela",
        path_frontend: "diagnostico",
        description: "Ferramentas para diagnosticar problemas nas integrações WhatsApp.",
        permissoes_funcao: [
          { identificador: "Comunicacao.diagnostico.executar", nome: "Executar Diagnóstico", tipo: "acao", description: "Permite iniciar o diagnóstico de conexão e webhook." },
          { identificador: "Comunicacao.diagnostico.ver_logs", nome: "Ver Logs de Diagnóstico", tipo: "acao", description: "Permite acessar os logs detalhados dos testes." },
        ]
      },
      {
        identificador: "Comunicacao.configuracoes",
        nome: "Configurações",
        tipo: "subtela",
        path_frontend: "configuracoes",
        description: "Configurações gerais da Central de Comunicação.",
        permissoes_funcao: [
          { identificador: "Comunicacao.configuracoes.gerenciar_integracoes_whatsapp", nome: "Gerenciar Integrações WhatsApp", tipo: "acao", description: "Permite configurar e gerenciar as conexões do WhatsApp." },
        ]
      }
    ]
  },
  {
    identificador: "Dashboard",
    nome: "Dashboard",
    tipo: "menu",
    path_frontend: "/Dashboard",
    categoria: "Geral",
    description: "Visão geral do desempenho comercial e KPIs.",
    sub_recursos: [
      {
        identificador: "Dashboard.visao_empresa",
        nome: "Visão Empresa",
        tipo: "subtela",
        path_frontend: "empresa",
        description: "KPIs consolidados e tendências da empresa.",
        permissoes_funcao: []
      },
      {
        identificador: "Dashboard.performance_vendas",
        nome: "Performance Vendas",
        tipo: "subtela",
        path_frontend: "vendedores",
        description: "Ranking e análise individual de vendedores.",
        permissoes_funcao: []
      },
      {
        identificador: "Dashboard.analise_clientes",
        nome: "Análise Clientes",
        tipo: "subtela",
        path_frontend: "clientes",
        description: "Segmentação e oportunidades de clientes.",
        permissoes_funcao: []
      },
      {
        identificador: "Dashboard.metricas_operacionais",
        nome: "Métricas Operacionais",
        tipo: "subtela",
        path_frontend: "operacional",
        description: "Funil de vendas e atividades operacionais.",
        permissoes_funcao: []
      },
      {
        identificador: "Dashboard.filtrar",
        nome: "Filtrar Dados",
        tipo: "acao",
        path_frontend: "filtrar",
        description: "Permite aplicar filtros por período, vendedor, etc."
      },
      {
        identificador: "Dashboard.exportar",
        nome: "Exportar Dashboard",
        tipo: "acao",
        path_frontend: "exportar",
        description: "Permite exportar os dados do dashboard."
      },
      {
        identificador: "Dashboard.analise_ia",
        nome: "Análise com IA",
        tipo: "acao",
        path_frontend: "analise_ia",
        description: "Permite gerar análises e insights com IA para o dashboard."
      }
    ]
  },
  {
    identificador: "LeadsQualificados",
    nome: "Central de Qualificação",
    tipo: "menu",
    path_frontend: "/LeadsQualificados",
    categoria: "Vendas",
    description: "Gestão completa do funil de leads, clientes e orçamentos.",
    sub_recursos: [
      {
        identificador: "LeadsQualificados.kanban_leads",
        nome: "Kanban de Gestão de Leads",
        tipo: "subtela",
        path_frontend: "leads",
        description: "Gerenciamento visual de leads no funil de vendas.",
        permissoes_funcao: [
          { identificador: "LeadsQualificados.kanban_leads.mudar_status", nome: "Mudar Status do Lead (Kanban)", tipo: "acao", description: "Permite arrastar e mudar o status de leads no kanban." },
          { identificador: "LeadsQualificados.kanban_leads.editar_lead", nome: "Editar Lead", tipo: "acao", description: "Permite editar os detalhes de um lead." },
          { identificador: "LeadsQualificados.kanban_leads.excluir_lead", nome: "Excluir Lead", tipo: "acao", description: "Permite excluir um lead permanentemente." },
          { identificador: "LeadsQualificados.kanban_leads.ver_detalhes", nome: "Ver Detalhes do Lead", tipo: "acao", description: "Permite visualizar detalhes completos do lead." },
        ]
      },
      {
        identificador: "LeadsQualificados.kanban_clientes",
        nome: "Kanban de Gestão de Clientes",
        tipo: "subtela",
        path_frontend: "clientes",
        description: "Gerenciamento visual de clientes ativos e inativos.",
        permissoes_funcao: [
          { identificador: "LeadsQualificados.kanban_clientes.mudar_status", nome: "Mudar Status do Cliente (Kanban)", tipo: "acao", description: "Permite arrastar e mudar o status de clientes no kanban." },
          { identificador: "LeadsQualificados.kanban_clientes.editar_cliente", nome: "Editar Cliente", tipo: "acao", description: "Permite editar os detalhes de um cliente." },
          { identificador: "LeadsQualificados.kanban_clientes.excluir_cliente", nome: "Excluir Cliente", tipo: "acao", description: "Permite excluir um cliente permanentemente." },
          { identificador: "LeadsQualificados.kanban_clientes.ver_detalhes", nome: "Ver Detalhes do Cliente", tipo: "acao", description: "Permite visualizar detalhes completos do cliente." },
        ]
      },
      {
        identificador: "LeadsQualificados.pipeline_orcamentos",
        nome: "Pipeline de Orçamentos",
        tipo: "subtela",
        path_frontend: "orcamentos",
        description: "Visualização do pipeline de orçamentos (Kanban e Tabela).",
        permissoes_funcao: [
          { identificador: "LeadsQualificados.pipeline_orcamentos.ver", nome: "Ver Orçamentos", tipo: "acao", description: "Permite visualizar orçamentos." },
          { identificador: "LeadsQualificados.pipeline_orcamentos.editar", nome: "Editar Orçamentos", tipo: "acao", description: "Permite editar orçamentos existentes." },
          { identificador: "LeadsQualificados.pipeline_orcamentos.excluir", nome: "Excluir Orçamentos", tipo: "acao", description: "Permite excluir orçamentos." },
        ]
      },
      { identificador: "LeadsQualificados.sync_vendedores", nome: "Sincronizar Vendedores", tipo: "acao", description: "Sincroniza a lista de vendedores e atribuições." },
      { identificador: "LeadsQualificados.novo_lead", nome: "Novo Lead", tipo: "acao", description: "Permite criar um novo lead." },
      { identificador: "LeadsQualificados.novo_cliente", nome: "Novo Cliente", tipo: "acao", description: "Permite criar um novo cliente." },
      { identificador: "LeadsQualificados.novo_orcamento", nome: "Novo Orçamento", tipo: "acao", description: "Permite criar um novo orçamento." },
    ]
  },
  {
    identificador: "Clientes",
    nome: "Gestão de Clientes",
    tipo: "menu",
    path_frontend: "/Clientes",
    categoria: "CRM",
    description: "Gerenciamento detalhado de clientes, com visão em lista e kanban.",
    sub_recursos: [
      {
        identificador: "Clientes.lista",
        nome: "Visualização em Lista",
        tipo: "subtela",
        path_frontend: "lista",
        description: "Exibe clientes em formato de tabela.",
        permissoes_funcao: []
      },
      {
        identificador: "Clientes.kanban",
        nome: "Visualização em Kanban",
        tipo: "subtela",
        path_frontend: "kanban",
        description: "Exibe clientes em um quadro Kanban por status.",
        permissoes_funcao: []
      },
      { identificador: "Clientes.novo_cliente", nome: "Novo Cliente", tipo: "acao", description: "Permite adicionar um novo registro de cliente." },
      { identificador: "Clientes.editar_cliente", nome: "Editar Cliente", tipo: "acao", description: "Permite modificar os dados de um cliente existente." },
      { identificador: "Clientes.excluir_cliente", nome: "Excluir Cliente", tipo: "acao", description: "Permite remover um cliente permanentemente." },
      { identificador: "Clientes.ver_detalhes", nome: "Ver Detalhes do Cliente", tipo: "acao", description: "Permite acessar a página de detalhes do cliente." },
      { identificador: "Clientes.filtrar", nome: "Filtrar Clientes", tipo: "acao", description: "Permite aplicar filtros na lista/kanban de clientes." },
    ]
  },
  {
    identificador: "Vendedores",
    nome: "Gestão de Vendedores",
    tipo: "menu",
    path_frontend: "/Vendedores",
    categoria: "Vendas",
    description: "Gerenciamento de vendedores e sua performance.",
    sub_recursos: [
      { identificador: "Vendedores.novo_vendedor", nome: "Novo Vendedor", tipo: "acao", description: "Permite cadastrar um novo vendedor." },
      { identificador: "Vendedores.editar_vendedor", nome: "Editar Vendedor", tipo: "acao", description: "Permite editar os dados de um vendedor existente." },
      { identificador: "Vendedores.excluir_vendedor", nome: "Excluir Vendedor", tipo: "acao", description: "Permite remover um vendedor." },
      { identificador: "Vendedores.analise_ia", nome: "Análise com IA", tipo: "acao", description: "Permite gerar análises de performance de vendedores com IA." },
      { identificador: "Vendedores.ver_metricas", nome: "Ver Métricas de Vendedores", tipo: "acao", description: "Permite visualizar métricas de desempenho de vendedores." },
    ]
  },
  {
    identificador: "Produtos",
    nome: "Catálogo de Produtos",
    tipo: "menu",
    path_frontend: "/Produtos",
    categoria: "Catálogo",
    description: "Gestão do catálogo de produtos com análise de qualidade RAG e precificação IA.",
    sub_recursos: [
      { identificador: "Produtos.novo_produto", nome: "Novo Produto", tipo: "acao", description: "Permite cadastrar um novo produto." },
      { identificador: "Produtos.editar_produto", nome: "Editar Produto", tipo: "acao", description: "Permite editar os dados de um produto existente." },
      { identificador: "Produtos.excluir_produto", nome: "Excluir Produto", tipo: "acao", description: "Permite excluir um produto." },
      { identificador: "Produtos.add_carrinho", nome: "Adicionar ao Carrinho de Cotação", tipo: "acao", description: "Permite adicionar produtos ao carrinho para gerar orçamentos." },
      { identificador: "Produtos.limpar_carrinho", nome: "Limpar Carrinho de Cotação", tipo: "acao", description: "Permite remover todos os produtos do carrinho." },
      { identificador: "Produtos.sugerir_preco_ia", nome: "Sugerir Preço (IA)", tipo: "acao", description: "Permite que a IA sugira preços para produtos." },
      { identificador: "Produtos.importar_ia", nome: "Importar Produtos (IA)", tipo: "acao", description: "Permite importar produtos usando o sistema de IA." },
      { identificador: "Produtos.ver_insights_precificacao", nome: "Ver Insights de Precificação IA", tipo: "acao", description: "Permite acessar os insights gerados pela IA para precificação." },
      { identificador: "Produtos.modo_correcao", nome: "Modo Correção de Qualidade", tipo: "acao", description: "Permite entrar no modo de correção para produtos com baixa qualidade RAG." },
      { identificador: "Produtos.filtrar", nome: "Filtrar Produtos", tipo: "acao", description: "Permite aplicar filtros no catálogo de produtos." },
      { identificador: "Produtos.selecao_massa", nome: "Seleção em Massa", tipo: "acao", description: "Permite selecionar múltiplos produtos para ações em massa." },
      { identificador: "Produtos.excluir_selecionados", nome: "Excluir Produtos Selecionados", tipo: "acao", description: "Permite excluir múltiplos produtos de uma vez." },
      { identificador: "Produtos.cotar_selecionados", nome: "Cotar Produtos Selecionados", tipo: "acao", description: "Permite adicionar múltiplos produtos ao carrinho para cotação." },
    ]
  },
  {
    identificador: "Agenda",
    nome: "Agenda Inteligente",
    tipo: "menu",
    path_frontend: "/Agenda",
    categoria: "Geral",
    description: "Gerencia tarefas priorizadas pela IA para otimização do dia a dia.",
    sub_recursos: [
      { identificador: "Agenda.gerar_tarefas_ia", nome: "Gerar Tarefas com IA", tipo: "acao", description: "Permite que a IA gere novas tarefas baseadas em prioridades." },
      { identificador: "Agenda.concluir_tarefa", nome: "Concluir Tarefa", tipo: "acao", description: "Permite marcar uma tarefa como concluída e adicionar observações." },
      { identificador: "Agenda.analisar_clientes_ia", nome: "Analisar Clientes (IA)", tipo: "acao", description: "Permite que a IA analise todos os clientes para gerar insights e tarefas." },
      { identificador: "Agenda.filtrar", nome: "Filtrar Tarefas", tipo: "acao", description: "Permite filtrar tarefas por status, prioridade e data." },
      { identificador: "Agenda.ver_detalhes_cliente", nome: "Ver Detalhes do Cliente (Contexto)", tipo: "acao", description: "Permite visualizar o contexto do cliente associado a uma tarefa." },
      { identificador: "Agenda.ver_insights_ia", nome: "Ver Insights da IA (Tarefa)", tipo: "acao", description: "Permite acessar insights de IA relacionados a uma tarefa específica." },
    ]
  },
  {
    identificador: "AnalyticsAvancado",
    nome: "Analytics Avançado",
    tipo: "menu",
    path_frontend: "/AnalyticsAvancado",
    categoria: "Relatórios",
    description: "Análise inteligente de dados e tendências de performance.",
    sub_recursos: [
      {
        identificador: "AnalyticsAvancado.visao_geral",
        nome: "Visão Geral",
        tipo: "subtela",
        path_frontend: "overview",
        description: "KPIs e gráficos de faturamento e vendas.",
        permissoes_funcao: []
      },
      {
        identificador: "AnalyticsAvancado.vendas",
        nome: "Análise de Vendas",
        tipo: "subtela",
        path_frontend: "vendas",
        description: "Análise de ticket médio, tipos de venda e top produtos.",
        permissoes_funcao: []
      },
      {
        identificador: "AnalyticsAvancado.clientes",
        nome: "Análise de Clientes",
        tipo: "subtela",
        path_frontend: "clientes",
        description: "Distribuição de score, matriz de segmentação e clientes em risco.",
        permissoes_funcao: []
      },
      {
        identificador: "AnalyticsAvancado.performance",
        nome: "Performance",
        tipo: "subtela",
        path_frontend: "performance",
        description: "Radar de competências e métricas de eficiência dos vendedores.",
        permissoes_funcao: []
      },
      {
        identificador: "AnalyticsAvancado.preditivo",
        nome: "Análise Preditiva",
        tipo: "subtela",
        path_frontend: "preditivo",
        description: "Previsão de faturamento e recomendações estratégicas da IA.",
        permissoes_funcao: []
      },
      { identificador: "AnalyticsAvancado.filtrar", nome: "Filtrar Período", tipo: "acao", description: "Permite selecionar o período da análise." },
      { identificador: "AnalyticsAvancado.atualizar", nome: "Atualizar Dados", tipo: "acao", description: "Força a atualização dos dados da análise." },
      { identificador: "AnalyticsAvancado.exportar", nome: "Exportar Relatórios", tipo: "acao", description: "Permite exportar os relatórios de analytics." },
    ]
  },
  {
    identificador: "NexusCommandCenter",
    nome: "Nexus Command Center",
    tipo: "menu",
    path_frontend: "/NexusCommandCenter",
    categoria: "IA",
    description: "Central de controle para as funcionalidades de IA do sistema.",
    sub_recursos: [
      // As ações aqui dependeriam da implementação interna do ControlCenter
      { identificador: "NexusCommandCenter.monitorar_ia", nome: "Monitorar Atividades IA", tipo: "acao", description: "Permite monitorar as operações da inteligência artificial." },
      { identificador: "NexusCommandCenter.configurar_ia", nome: "Configurar Parâmetros IA", tipo: "acao", description: "Permite ajustar as configurações dos modelos de IA." }
    ]
  },
  {
    identificador: "Importacao",
    nome: "Sistema de Importação Inteligente",
    tipo: "menu",
    path_frontend: "/Importacao",
    categoria: "Dados",
    description: "Ferramenta de importação de dados com IA e detecção automática.",
    sub_recursos: [
      {
        identificador: "Importacao.upload_arquivos",
        nome: "Upload de Arquivos",
        tipo: "subtela",
        path_frontend: "upload",
        description: "Permite fazer upload de arquivos para importação.",
        permissoes_funcao: [
          { identificador: "Importacao.upload_arquivos.upload", nome: "Realizar Upload", tipo: "acao", description: "Permite enviar arquivos para processamento." },
          { identificador: "Importacao.upload_arquivos.revisar_dados", nome: "Revisar Dados Extraídos", tipo: "acao", description: "Permite revisar e corrigir dados antes de salvar." },
          { identificador: "Importacao.upload_arquivos.salvar_dados", nome: "Salvar Dados Processados", tipo: "acao", description: "Permite salvar os dados extraídos no sistema." },
        ]
      },
      {
        identificador: "Importacao.google_sheets",
        nome: "Google Sheets",
        tipo: "subtela",
        path_frontend: "sheets",
        description: "Importação de dados diretamente do Google Sheets.",
        permissoes_funcao: [
          { identificador: "Importacao.google_sheets.conectar", nome: "Conectar Google Sheets", tipo: "acao", description: "Permite configurar a conexão com planilhas do Google Sheets." },
          { identificador: "Importacao.google_sheets.importar", nome: "Importar do Google Sheets", tipo: "acao", description: "Permite iniciar a importação de dados de uma planilha conectada." },
        ]
      },
      {
        identificador: "Importacao.historico",
        nome: "Histórico de Importações",
        tipo: "subtela",
        path_frontend: "historico",
        description: "Visualiza o histórico de todas as importações realizadas.",
        permissoes_funcao: [
          { identificador: "Importacao.historico.reprocessar", nome: "Reprocessar Importação", tipo: "acao", description: "Permite tentar novamente o processamento de um arquivo do histórico." },
          { identificador: "Importacao.historico.ver_detalhes", nome: "Ver Detalhes da Importação", tipo: "acao", description: "Permite visualizar detalhes e logs de um processo de importação." },
          { identificador: "Importacao.historico.diagnostico", nome: "Executar Diagnóstico de Arquivo", tipo: "acao", description: "Permite executar um diagnóstico em um arquivo importado para identificar problemas." },
        ]
      },
      { identificador: "Importacao.gerenciar_mapeamentos", nome: "Gerenciar Mapeamentos", tipo: "acao", description: "Permite criar e gerenciar regras de mapeamento de campos para importação." },
    ]
  },
  {
    identificador: "Usuarios",
    nome: "Gerenciamento de Usuários",
    tipo: "menu",
    path_frontend: "/Usuarios",
    categoria: "Administração",
    description: "Configuração de usuários e seus níveis de acesso e permissões.",
    permissoes_funcao: [
      { identificador: "Usuarios.novo_usuario", nome: "Novo Usuário", tipo: "acao", description: "Permite convidar e cadastrar novos usuários no sistema." },
      { identificador: "Usuarios.editar_usuario", nome: "Editar Usuário", tipo: "acao", description: "Permite editar os dados básicos e configurações de um usuário existente." },
      { identificador: "Usuarios.alterar_role", nome: "Alterar Tipo de Acesso (Role)", tipo: "acao", description: "Permite mudar o nível de acesso global de um usuário (Admin/Usuário)." },
      { identificador: "Usuarios.gerenciar_paginas", nome: "Gerenciar Páginas de Acesso", tipo: "acao", description: "Permite configurar quais páginas do sistema o usuário pode visualizar." },
      { identificador: "Usuarios.gerenciar_permissoes_comunicacao", nome: "Gerenciar Permissões de Comunicação", tipo: "acao", description: "Permite configurar permissões granulares para a Central de Comunicação (e.g., enviar mensagens, transferir)." },
      { identificador: "Usuarios.gerenciar_permissoes_whatsapp", nome: "Gerenciar Permissões WhatsApp por Instância", tipo: "acao", description: "Permite configurar quais canais de WhatsApp o usuário pode acessar e suas ações." },
      { identificador: "Usuarios.gerenciar_horarios", nome: "Gerenciar Horários de Atendimento", tipo: "acao", description: "Permite configurar os horários de disponibilidade do atendente." },
      { identificador: "Usuarios.ver_matriz_permissoes", nome: "Ver Matriz de Permissões", tipo: "acao", description: "Permite visualizar a matriz consolidada de permissões por usuário." },
    ]
  },
  {
    identificador: "Auditoria",
    nome: "Auditoria",
    tipo: "menu",
    path_frontend: "/Auditoria",
    categoria: "Administração",
    description: "Logs detalhados de todas as ações realizadas no sistema para rastreamento e segurança.",
    permissoes_funcao: [
      { identificador: "Auditoria.filtrar_logs", nome: "Filtrar Logs", tipo: "acao", description: "Permite aplicar filtros na visualização dos logs de auditoria." },
      { identificador: "Auditoria.atualizar_logs", nome: "Atualizar Logs", tipo: "acao", description: "Força a atualização da lista de logs." },
      { identificador: "Auditoria.exportar_logs", nome: "Exportar Logs", tipo: "acao", description: "Permite exportar os logs de auditoria para arquivo (CSV/Excel)." },
      { identificador: "Auditoria.ver_detalhes_log", nome: "Ver Detalhes do Log", tipo: "acao", description: "Permite visualizar os detalhes completos de um registro de log." },
    ]
  },
  {
    identificador: "DiagnosticoCirurgico",
    nome: "Diagnóstico Cirúrgico",
    tipo: "menu",
    path_frontend: "/DiagnosticoCirurgico",
    categoria: "Administração",
    description: "Ferramenta avançada para identificar problemas específicos no sistema.",
    permissoes_funcao: [
      { identificador: "DiagnosticoCirurgico.executar_diagnostico", nome: "Executar Diagnóstico", tipo: "acao", description: "Permite iniciar o diagnóstico cirúrgico para identificar falhas." },
      { identificador: "DiagnosticoCirurgico.ver_resultados", nome: "Ver Resultados do Diagnóstico", tipo: "acao", description: "Permite visualizar os resultados detalhados dos testes de diagnóstico." },
    ]
  }
];

export const MAPA_ACOES_POR_ENTIDADE = {
    // Permissões gerais de CRUD para entidades principais
    Cliente: {
        criar: "Clientes.novo_cliente",
        editar: "Clientes.editar_cliente",
        excluir: "Clientes.excluir_cliente",
        ver: "Clientes.ver_detalhes",
    },
    Vendedor: {
        criar: "Vendedores.novo_vendedor",
        editar: "Vendedores.editar_vendedor",
        excluir: "Vendedores.excluir_vendedor",
        ver: "Vendedores.ver_metricas",
    },
    Produto: {
        criar: "Produtos.novo_produto",
        editar: "Produtos.editar_produto",
        excluir: "Produtos.excluir_produto",
        ver: "Produtos", // A página de produtos é a própria visualização
    },
    Orcamento: {
        criar: "LeadsQualificados.novo_orcamento", // Ou via Produtos.add_carrinho
        editar: "LeadsQualificados.pipeline_orcamentos.editar",
        excluir: "LeadsQualificados.pipeline_orcamentos.excluir",
        ver: "LeadsQualificados.pipeline_orcamentos.ver",
    },
    User: { // Acesso ao próprio User (sistema)
        editar: "Usuarios.editar_usuario", // Editar a si mesmo
    },
    WhatsAppIntegration: {
        criar: "Comunicacao.configuracoes.gerenciar_integracoes_whatsapp",
        editar: "Comunicacao.configuracoes.gerenciar_integracoes_whatsapp",
        excluir: "Comunicacao.configuracoes.gerenciar_integracoes_whatsapp",
        ver: "Comunicacao.configuracoes.gerenciar_integracoes_whatsapp",
    }
    // Adicionar outras entidades conforme necessário
};

export const PERFIS_ACESSO_RAPIDO = {
  admin: {
    label: "👑 Administrador (Acesso Total)",
    permissoes: PAGINAS_E_ACOES_DO_SISTEMA.flatMap(menu => {
      const menuAcoes = [{ identificador: menu.identificador, tipo: menu.tipo }];
      const subAcoes = (menu.sub_recursos || []).flatMap(sub => {
        const subPerms = [{ identificador: sub.identificador, tipo: sub.tipo }];
        return subPerms.concat(sub.permissoes_funcao || []);
      });
      return menuAcoes.concat(subAcoes).map(a => a.identificador);
    })
  },
  gerente_geral: {
    label: "👔 Gerente Geral",
    permissoes: [
      "Comunicacao", "Comunicacao.conversas.ver_todas", "Comunicacao.controle_operacional",
      "Comunicacao.automacao", "Comunicacao.diagnostico", "Comunicacao.configuracoes",
      "Dashboard", "Dashboard.visao_empresa", "Dashboard.performance_vendas",
      "Dashboard.analise_clientes", "Dashboard.metricas_operacionais",
      "LeadsQualificados", "LeadsQualificados.kanban_leads", "LeadsQualificados.kanban_clientes",
      "LeadsQualificados.pipeline_orcamentos",
      "Clientes", "Clientes.ver_detalhes",
      "Vendedores", "Vendedores.ver_metricas", "Vendedores.analise_ia",
      "Produtos", "Produtos.ver_insights_precificacao",
      "Agenda", "Agenda.gerar_tarefas_ia", "Agenda.analisar_clientes_ia",
      "AnalyticsAvancado", "AnalyticsAvancado.visao_geral", "AnalyticsAvancado.vendas", "AnalyticsAvancado.clientes", "AnalyticsAvancado.performance", "AnalyticsAvancado.preditivo",
      "Importacao", "Importacao.historico",
      "Auditoria", "Auditoria.filtrar_logs", "Auditoria.ver_detalhes_log",
      "NexusCommandCenter", "NexusCommandCenter.monitorar_ia",
    ]
  },
  supervisor_vendas: {
    label: "📋 Supervisor de Vendas",
    permissoes: [
      "Comunicacao", "Comunicacao.conversas.enviar_mensagem", "Comunicacao.conversas.enviar_midia",
      "Comunicacao.conversas.transferir", "Comunicacao.conversas.ver_todas",
      "LeadsQualificados", "LeadsQualificados.kanban_leads", "LeadsQualificados.kanban_clientes",
      "LeadsQualificados.pipeline_orcamentos.ver",
      "Clientes", "Clientes.ver_detalhes",
      "Vendedores", "Vendedores.ver_metricas",
      "Produtos", "Produtos.add_carrinho", "Produtos.ver_insights_precificacao",
      "Dashboard", "Dashboard.performance_vendas", "Dashboard.analise_clientes",
      "Agenda", "Agenda.gerar_tarefas_ia", "Agenda.concluir_tarefa",
    ]
  },
  atendente_comercial: {
    label: "💼 Atendente Comercial",
    permissoes: [
      "Comunicacao", "Comunicacao.conversas.enviar_mensagem", "Comunicacao.conversas.enviar_midia",
      "Comunicacao.conversas.transferir", "Comunicacao.conversas.ver_detalhes_contato",
      "LeadsQualificados", "LeadsQualificados.kanban_leads.mudar_status", "LeadsQualificados.kanban_leads.editar_lead",
      "Clientes", "Clientes.ver_detalhes",
      "Produtos", "Produtos.add_carrinho",
      "Agenda", "Agenda.concluir_tarefa",
    ]
  },
  atendente_suporte: {
    label: "🎧 Atendente de Suporte",
    permissoes: [
      "Comunicacao", "Comunicacao.conversas.enviar_mensagem", "Comunicacao.conversas.enviar_midia",
      "Comunicacao.conversas.transferir", "Comunicacao.conversas.ver_detalhes_contato",
      "Clientes", "Clientes.ver_detalhes",
      "Agenda", "Agenda.concluir_tarefa",
    ]
  },
  analista_dados: {
    label: "📈 Analista de Dados",
    permissoes: [
      "Dashboard", "Dashboard.visao_empresa", "Dashboard.performance_vendas",
      "Dashboard.analise_clientes", "Dashboard.metricas_operacionais", "Dashboard.exportar",
      "AnalyticsAvancado", "AnalyticsAvancado.ver_detalhes_log", "AnalyticsAvancado.exportar",
      "Importacao", "Importacao.historico.ver_detalhes",
    ]
  },
  personalizado: {
    label: "⚙️ Personalizado",
    permissoes: []
  }
};