import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { google } from 'npm:googleapis@128.0.0';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  PROCESSADOR DE FILA GOOGLE SHEETS (IDEMPOTENTE)           ║
 * ║  Processa operações de escrita com controle de duplicação  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Buscar operações pendentes (ordenadas por prioridade e data)
    const operacoes = await base44.asServiceRole.entities.SheetWriteQueue.filter(
      { status: 'pendente' },
      '-prioridade,-created_date',
      10 // Processar 10 por vez
    );

    if (operacoes.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Nenhuma operação pendente',
        processadas: 0
      });
    }

    console.log(`📝 Processando ${operacoes.length} operações da fila`);

    // Inicializar Google Sheets API
    const serviceAccountKey = JSON.parse(Deno.env.get('GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY'));
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    let processadas = 0;
    let erros = 0;

    for (const operacao of operacoes) {
      try {
        // Marcar como processando
        await base44.asServiceRole.entities.SheetWriteQueue.update(operacao.id, {
          status: 'processando',
          tentativas: (operacao.tentativas || 0) + 1
        });

        // Verificar idempotência: operação já foi concluída?
        const jaProcessada = await base44.asServiceRole.entities.SheetWriteQueue.filter({
          operation_hash: operacao.operation_hash,
          status: 'concluido'
        });

        if (jaProcessada.length > 0) {
          console.log(`⚠️ Operação ${operacao.id} já foi processada (hash: ${operacao.operation_hash})`);
          await base44.asServiceRole.entities.SheetWriteQueue.update(operacao.id, {
            status: 'concluido',
            processado_em: new Date().toISOString(),
            erro_detalhes: 'Operação duplicada - pulada por idempotência'
          });
          processadas++;
          continue;
        }

        // Executar operação
        let resultado;
        switch (operacao.operation_type) {
          case 'write':
            resultado = await sheets.spreadsheets.values.update({
              spreadsheetId: operacao.spreadsheet_id,
              range: operacao.range,
              valueInputOption: 'USER_ENTERED',
              resource: { values: operacao.values }
            });
            break;

          case 'append':
            resultado = await sheets.spreadsheets.values.append({
              spreadsheetId: operacao.spreadsheet_id,
              range: operacao.range,
              valueInputOption: 'USER_ENTERED',
              resource: { values: operacao.values }
            });
            break;

          case 'clear':
            resultado = await sheets.spreadsheets.values.clear({
              spreadsheetId: operacao.spreadsheet_id,
              range: operacao.range
            });
            break;

          default:
            throw new Error(`Tipo de operação desconhecido: ${operacao.operation_type}`);
        }

        // Marcar como concluída
        await base44.asServiceRole.entities.SheetWriteQueue.update(operacao.id, {
          status: 'concluido',
          processado_em: new Date().toISOString()
        });

        processadas++;
        console.log(`✅ Operação ${operacao.id} concluída com sucesso`);

      } catch (error) {
        console.error(`❌ Erro ao processar operação ${operacao.id}:`, error);
        erros++;

        const tentativas = (operacao.tentativas || 0) + 1;
        const maxTentativas = operacao.max_tentativas || 3;

        if (tentativas >= maxTentativas) {
          // Máximo de tentativas atingido
          await base44.asServiceRole.entities.SheetWriteQueue.update(operacao.id, {
            status: 'erro',
            erro_detalhes: error.message,
            tentativas
          });
        } else {
          // Voltar para pendente para nova tentativa
          await base44.asServiceRole.entities.SheetWriteQueue.update(operacao.id, {
            status: 'pendente',
            erro_detalhes: error.message,
            tentativas
          });
        }
      }

      // Rate limiting: aguardar 100ms entre operações
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return Response.json({
      success: true,
      processadas,
      erros,
      total: operacoes.length
    });

  } catch (error) {
    console.error('❌ Erro no processador da fila:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});