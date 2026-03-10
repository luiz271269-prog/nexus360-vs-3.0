import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = await req.json();
    const { contact_id, corrigir = false } = payload;

    if (!contact_id) {
      return Response.json({ error: 'contact_id é obrigatório' }, { status: 400 });
    }

    console.log(`[sincronizarContactoErros] Iniciando análise contato=${contact_id}, modo=diagnostico`);

    // 1️⃣ Buscar contato
    const contatos = await base44.asServiceRole.entities.Contact.filter({ id: contact_id });
    if (!contatos || contatos.length === 0) {
      return Response.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    const contato = contatos[0];
    const erros = [];

    // 2️⃣ ERRO #2: Telefone vazio ou não sincronizado
    if (!contato.telefone || !contato.telefone.trim()) {
      erros.push({
        tipo: 'telefone_vazio',
        descricao: 'Campo telefone está vazio',
        campo: 'telefone',
        valor_atual: contato.telefone || 'NULL'
      });
    }

    if (!contato.telefone_canonico || !contato.telefone_canonico.trim()) {
      erros.push({
        tipo: 'telefone_canonico_vazio',
        descricao: 'Campo telefone_canonico não foi preenchido (necessário para busca e deduplica)',
        campo: 'telefone_canonico',
        valor_atual: contato.telefone_canonico || 'NULL'
      });
    }

    // 3️⃣ ERRO #3: Verificar duplicatas por telefone
    const telefoneNorm = normalizarTelefone(contato.telefone);
    if (telefoneNorm) {
      const duplicatas = await base44.asServiceRole.entities.Contact.filter({
        telefone_canonico: telefoneNorm,
        id: { $ne: contact_id } // Excluir ele mesmo
      });

      if (duplicatas && duplicatas.length > 0) {
        erros.push({
          tipo: 'duplicata_encontrada',
          descricao: `Encontradas ${duplicatas.length} duplicata(s) com mesmo telefone normalizado`,
          campo: 'telefone_canonico',
          duplicatas: duplicatas.map(d => ({ id: d.id, nome: d.nome }))
        });
      }
    }

    // 4️⃣ ERRO #1: Verificar se nome está preenchido (afeta busca)
    const nomePuro = (contato.nome || '').trim();
    if (!nomePuro) {
      erros.push({
        tipo: 'nome_vazio',
        descricao: 'Campo nome está vazio (impede busca por nome)',
        campo: 'nome',
        valor_atual: 'NULL'
      });
    } else if (nomePuro.match(/^\+?\d+$/)) {
      // Se nome = apenas telefone, é erro
      erros.push({
        tipo: 'nome_igual_telefone',
        descricao: 'Nome contém apenas números (parece ter sido preenchido com telefone)',
        campo: 'nome',
        valor_atual: nomePuro
      });
    }

    // 5️⃣ CORRIGIR se modo correção
    let corrigidos = [];
    if (corrigir) {
      const updates = {};

      // Corrigir telefone_canonico
      if (telefoneNorm && !contato.telefone_canonico) {
        updates.telefone_canonico = telefoneNorm;
        corrigidos.push('telefone_canonico normalizado');
      }

      // Corrigir nome se vazio
      if (!nomePuro && contato.empresa) {
        updates.nome = contato.empresa;
        corrigidos.push('nome preenchido com empresa');
      } else if (!nomePuro && contato.telefone) {
        updates.nome = `Contato ${contato.telefone}`;
        corrigidos.push('nome gerado do telefone');
      }

      // Aplicar correções
      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Contact.update(contact_id, updates);
        console.log(`[sincronizarContactoErros] ✅ Contato corrigido:`, corrigidos, 'Updates:', updates);
      }

      // Consolidar threads órfãs se necessário
      try {
        const threads = await base44.asServiceRole.entities.MessageThread.filter({ 
          contact_id: contact_id 
        });
        
        if (threads && threads.length > 1) {
          const principal = threads[0];
          let threadsConsolidadas = 0;
          
          for (let i = 1; i < threads.length; i++) {
            const thread = threads[i];
            
            if (thread.status !== 'merged') {
              await base44.asServiceRole.entities.MessageThread.update(thread.id, {
                status: 'merged',
                merged_into: principal.id
              });
              threadsConsolidadas++;
            }
          }
          
          if (threadsConsolidadas > 0) {
            corrigidos.push(`${threadsConsolidadas} thread(s) consolidada(s)`);
            console.log(`[sincronizarContactoErros] 📌 Consolidadas ${threadsConsolidadas} threads`);
          }
        }
      } catch (threadError) {
        console.warn('[sincronizarContactoErros] Aviso ao consolidar threads:', threadError.message);
      }
    }

    return Response.json({
      success: true,
      contact_id,
      erros_encontrados: erros.length,
      erros,
      corrigidos,
      modo: corrigir ? 'correcao' : 'diagnostico'
    });

  } catch (error) {
    console.error('[sincronizarContactoErros]', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});

function normalizarTelefone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/[\s\-\(\)\+]/g, '').replace(/^55/, '').replace(/^0+/, '');
  return clean || '';
}