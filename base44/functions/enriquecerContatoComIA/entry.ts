import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ==========================================
// ENRIQUECER CONTATO COM IA (sob demanda)
// ==========================================
// Roda SOMENTE quando o usuário clica "Atualizar com IA" no painel.
// Usa busca na internet para descobrir campos que faltam.
// NUNCA sobrescreve campo que já tem valor — só preenche o que está vazio.
// Campos alvo: empresa, ramo_atividade (setor), email, localização (Maps), Instagram.

const vazio = (v) => !v || String(v).trim() === '';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { contact_id } = await req.json();
    if (!contact_id) return Response.json({ error: 'contact_id obrigatório' }, { status: 400 });

    const contato = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!contato) return Response.json({ error: 'Contato não encontrado' }, { status: 404 });

    // Quais campos faltam (pré-análise no servidor para confirmar)
    const faltando = {
      empresa: vazio(contato.empresa),
      ramo_atividade: vazio(contato.ramo_atividade),
      email: vazio(contato.email),
      localizacao: vazio(contato.campos_personalizados?.localizacao_maps),
      instagram_empresa: vazio(contato.campos_personalizados?.instagram_empresa),
      instagram_contato: vazio(contato.campos_personalizados?.instagram_contato)
    };

    if (!Object.values(faltando).some(Boolean)) {
      return Response.json({ success: true, updated: false, reason: 'Todos os campos já preenchidos', dados_atualizados: {} });
    }

    // Deduz a cidade/UF pelo DDD do telefone quando a cidade não é conhecida.
    // Ajuda a IA a confirmar a empresa/perfil certo (ex: DDD 41 = Curitiba/PR).
    const DDD_REGIAO = {
      '11': 'São Paulo/SP', '12': 'Vale do Paraíba/SP', '13': 'Santos/SP', '14': 'Bauru/SP',
      '15': 'Sorocaba/SP', '16': 'Ribeirão Preto/SP', '17': 'São José do Rio Preto/SP',
      '18': 'Presidente Prudente/SP', '19': 'Campinas/SP', '21': 'Rio de Janeiro/RJ',
      '22': 'Campos dos Goytacazes/RJ', '24': 'Volta Redonda/RJ', '27': 'Vitória/ES',
      '28': 'Cachoeiro de Itapemirim/ES', '31': 'Belo Horizonte/MG', '32': 'Juiz de Fora/MG',
      '33': 'Governador Valadares/MG', '34': 'Uberlândia/MG', '35': 'Poços de Caldas/MG',
      '37': 'Divinópolis/MG', '38': 'Montes Claros/MG', '41': 'Curitiba/PR', '42': 'Ponta Grossa/PR',
      '43': 'Londrina/PR', '44': 'Maringá/PR', '45': 'Foz do Iguaçu/PR', '46': 'Pato Branco/PR',
      '47': 'Joinville/SC', '48': 'Florianópolis/SC', '49': 'Chapecó/SC', '51': 'Porto Alegre/RS',
      '53': 'Pelotas/RS', '54': 'Caxias do Sul/RS', '55': 'Santa Maria/RS', '61': 'Brasília/DF',
      '62': 'Goiânia/GO', '63': 'Palmas/TO', '64': 'Rio Verde/GO', '65': 'Cuiabá/MT',
      '66': 'Rondonópolis/MT', '67': 'Campo Grande/MS', '68': 'Rio Branco/AC', '69': 'Porto Velho/RO',
      '71': 'Salvador/BA', '73': 'Itabuna/BA', '74': 'Juazeiro/BA', '75': 'Feira de Santana/BA',
      '77': 'Barreiras/BA', '79': 'Aracaju/SE', '81': 'Recife/PE', '82': 'Maceió/AL',
      '83': 'João Pessoa/PB', '84': 'Natal/RN', '85': 'Fortaleza/CE', '86': 'Teresina/PI',
      '87': 'Petrolina/PE', '88': 'Juazeiro do Norte/CE', '89': 'Picos/PI', '91': 'Belém/PA',
      '92': 'Manaus/AM', '93': 'Santarém/PA', '94': 'Marabá/PA', '95': 'Boa Vista/RR',
      '96': 'Macapá/AP', '97': 'Coari/AM', '98': 'São Luís/MA', '99': 'Imperatriz/MA'
    };
    const soDigitos = String(contato.telefone || '').replace(/\D/g, '');
    const dddMatch = soDigitos.match(/^55(\d{2})/);
    const cidadePorDDD = dddMatch ? DDD_REGIAO[dddMatch[1]] : null;
    const cidadeConhecida = contato.campos_personalizados?.cidade || cidadePorDDD || '(desconhecida)';

    const prompt = `Você é um assistente de enriquecimento de cadastro B2B no Brasil.
Com base nas informações abaixo de um contato/empresa, encontre dados públicos REAIS na internet.
Só retorne um valor se tiver ALTA confiança de que é a empresa/pessoa correta. Caso contrário, retorne string vazia.

Dados conhecidos:
- Nome do contato: ${contato.nome || '(desconhecido)'}
- Empresa (se houver): ${contato.empresa || '(desconhecida)'}
- Telefone: ${contato.telefone || '(desconhecido)'}
- Cidade/UF (conhecida ou deduzida pelo DDD do telefone): ${cidadeConhecida}

ESTRATÉGIA DE BUSCA:
- Existem DOIS perfis de Instagram distintos a procurar: o da EMPRESA e o da PESSOA (contato).
- O nome da EMPRESA "${contato.empresa || ''}" identifica o perfil OFICIAL DA EMPRESA no Instagram (ex: a empresa "Farben" tem o @industrial.farben).
- O nome da PESSOA "${contato.nome || ''}" identifica o perfil PESSOAL do contato no Instagram (ex: "Anderson Selinger" tem o @andersonselinger).
- Procure ambos no Instagram e em buscadores junto da cidade "${cidadeConhecida}".
- Muitos contatos são clínicas, profissionais autônomos ou pequenas empresas — use os nomes + a cidade deduzida para localizar os perfis reais.

Encontre e retorne (apenas os que faltam):
- nome da empresa/negócio oficial
- ramo de atividade / setor (ex: Estética, Saúde, Saneamento, Varejo, Indústria, Tecnologia)
- e-mail de contato público da empresa
- endereço completo da empresa (para localizar no Google Maps)
- @ do Instagram OFICIAL DA EMPRESA (campo instagram_empresa, com @)
- @ do Instagram PESSOAL do contato (campo instagram_contato, com @)

Se não tiver certeza de um campo, deixe-o vazio. NÃO invente. NÃO troque o perfil da empresa pelo da pessoa nem vice-versa.`;

    // Timeout de 45s: a busca de IA na internet pode travar/demorar demais.
    // Em vez de deixar o botão "Buscando dados..." eternamente, cortamos e avisamos.
    const chamadaIA = base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          empresa: { type: 'string' },
          ramo_atividade: { type: 'string' },
          email: { type: 'string' },
          endereco: { type: 'string' },
          instagram_empresa: { type: 'string' },
          instagram_contato: { type: 'string' }
        }
      }
    });

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout_ia')), 45000)
    );

    let resultado;
    try {
      resultado = await Promise.race([chamadaIA, timeout]);
    } catch (e) {
      if (e.message === 'timeout_ia') {
        return Response.json({
          success: false,
          updated: false,
          reason: 'A IA demorou demais para responder. Tente novamente em instantes.'
        });
      }
      throw e;
    }

    // Montar update SÓ com campos que faltam E que a IA retornou com valor
    const dadosAtualizados = {};
    const camposPersonalizados = { ...(contato.campos_personalizados || {}) };

    if (faltando.empresa && !vazio(resultado.empresa)) dadosAtualizados.empresa = resultado.empresa.trim();
    if (faltando.ramo_atividade && !vazio(resultado.ramo_atividade)) {
      dadosAtualizados.ramo_atividade = resultado.ramo_atividade.trim();
      dadosAtualizados.ramo_atividade_origem = 'ia';
    }
    if (faltando.email && !vazio(resultado.email)) dadosAtualizados.email = resultado.email.trim().toLowerCase();

    if (faltando.localizacao && !vazio(resultado.endereco)) {
      const endereco = resultado.endereco.trim();
      camposPersonalizados.localizacao_maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
      camposPersonalizados.endereco = endereco;
    }
    if (faltando.instagram_empresa && !vazio(resultado.instagram_empresa)) {
      const ig = resultado.instagram_empresa.trim().replace(/^@/, '');
      camposPersonalizados.instagram_empresa = `@${ig}`;
      camposPersonalizados.instagram_empresa_url = `https://instagram.com/${ig}`;
    }
    if (faltando.instagram_contato && !vazio(resultado.instagram_contato)) {
      const ig = resultado.instagram_contato.trim().replace(/^@/, '');
      camposPersonalizados.instagram_contato = `@${ig}`;
      camposPersonalizados.instagram_contato_url = `https://instagram.com/${ig}`;
    }

    const mudouCamposPersonalizados =
      JSON.stringify(camposPersonalizados) !== JSON.stringify(contato.campos_personalizados || {});
    if (mudouCamposPersonalizados) dadosAtualizados.campos_personalizados = camposPersonalizados;

    if (Object.keys(dadosAtualizados).length === 0) {
      return Response.json({ success: true, updated: false, reason: 'IA não encontrou dados confiáveis', dados_atualizados: {} });
    }

    await base44.asServiceRole.entities.Contact.update(contact_id, dadosAtualizados);

    return Response.json({
      success: true,
      updated: true,
      dados_atualizados: dadosAtualizados,
      campos_preenchidos: Object.keys(dadosAtualizados).filter((k) => k !== 'ramo_atividade_origem')
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});