import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { contact_id, corrigir } = await req.json();

    if (!contact_id) {
      return Response.json({ error: 'contact_id requerido' }, { status: 400 });
    }

    // 1. Buscar contato
    const contact = await base44.asServiceRole.entities.Contact.get(contact_id);
    if (!contact) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    const erros = [];
    const corrigidos = [];

    // 2. Validar campo telefone_canonico
    if (!contact.telefone_canonico && contact.telefone) {
      erros.push({
        tipo: 'telefone_canonico_faltando',
        descricao: 'Campo telefone_canonico está vazio'
      });
      if (corrigir) {
        const canonico = contact.telefone.replace(/\D/g, '');
        await base44.asServiceRole.entities.Contact.update(contact_id, {
          telefone_canonico: canonico
        });
        corrigidos.push(`telefone_canonico preenchido: ${canonico}`);
      }
    }

    return Response.json({
      success: true,
      contact_id,
      erros_encontrados: erros.length,
      erros,
      corrigidos,
      validacoes: {
        tem_telefone: !!contact.telefone,
        tem_canonico: !!contact.telefone_canonico
      }
    });

  } catch (error) {
    console.error('[sincronizarContactoErros]', error);
    return Response.json({ 
      error: error.message, 
      success: false 
    }, { status: 500 });
  }
});