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
      instagram: vazio(contato.campos_personalizados?.instagram)
    };

    if (!Object.values(faltando).some(Boolean)) {
      return Response.json({ success: true, updated: false, reason: 'Todos os campos já preenchidos', dados_atualizados: {} });
    }

    const prompt = `Você é um assistente de enriquecimento de cadastro B2B no Brasil.
Com base nas informações abaixo de um contato/empresa, encontre dados públicos REAIS na internet.
Só retorne um valor se tiver ALTA confiança de que é a empresa/pessoa correta. Caso contrário, retorne string vazia.

Dados conhecidos:
- Nome do contato: ${contato.nome || '(desconhecido)'}
- Empresa (se houver): ${contato.empresa || '(desconhecida)'}
- Telefone: ${contato.telefone || '(desconhecido)'}
- Cidade/UF conhecida: ${contato.campos_personalizados?.cidade || '(desconhecida)'}

Encontre e retorne (apenas os que faltam):
- nome da empresa oficial
- ramo de atividade / setor (ex: Saneamento, Varejo, Indústria, Tecnologia, Saúde)
- e-mail de contato público da empresa
- endereço completo da empresa (para localizar no Google Maps)
- @ do Instagram oficial da empresa (com @)

Se não tiver certeza de um campo, deixe-o vazio. NÃO invente.`;

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
          instagram: { type: 'string' }
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
    if (faltando.instagram && !vazio(resultado.instagram)) {
      const ig = resultado.instagram.trim().replace(/^@/, '');
      camposPersonalizados.instagram = `@${ig}`;
      camposPersonalizados.instagram_url = `https://instagram.com/${ig}`;
    }

    const mudouCamposPersonalizados =
      JSON.stringify(camposPersonalizados) !== JSON.stringify(contato.campos_personalizados || {});
    if (mudouCamposPersonalizados) dadosAtualizados.campos_personalizados = camposPersonalizados;

    if (Object.keys(dadosAtualizados).length > 0) {
      await base44.asServiceRole.entities.Contact.update(contact_id, dadosAtualizados);
    }

    // Vínculo automático com o CRM (empresa/nome primeiro, telefone como reforço).
    // Roda sempre que o contato ainda não tem cliente_id — mesmo que a IA não tenha
    // encontrado dados novos, pois a empresa pode já casar com um Cliente cadastrado.
    let vinculoCRM = null;
    try {
      const respVinculo = await base44.functions.invoke('vincularClienteAutomatico', { contact_id });
      vinculoCRM = respVinculo?.data || null;
    } catch (_) { /* vínculo é best-effort; não bloqueia o enriquecimento */ }

    const houveUpdate = Object.keys(dadosAtualizados).length > 0 || vinculoCRM?.vinculado === true;

    return Response.json({
      success: true,
      updated: houveUpdate,
      dados_atualizados: dadosAtualizados,
      campos_preenchidos: Object.keys(dadosAtualizados).filter((k) => k !== 'ramo_atividade_origem'),
      vinculo_crm: vinculoCRM,
      reason: houveUpdate ? undefined : 'Nenhum dado novo encontrado.'
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});