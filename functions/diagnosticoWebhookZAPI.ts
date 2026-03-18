import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const VERSION = 'DIAGNÓSTICO-WEBHOOK-ZAPI';

/**
 * 🔍 DIAGNÓSTICO CIRÚRGICO DO WEBHOOK Z-API
 * Analisa EXATAMENTE por que mensagens do contato não aparecem
 * 
 * FOCO:
 * 1. Lógica de fromMe (como decide sender_type)
 * 2. Extração de conteúdo (por que pode ficar vazio)
 * 3. Ponto de falha silenciosa na thread/mensagem
 */

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      version: VERSION,
      purpose: 'Diagnóstico de webhook Z-API',
      mode: 'POST only'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  let base44;
  let payload;

  try {
    base44 = createClientFromRequest(req.clone());
    const body = await req.text();
    payload = JSON.parse(body);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'parse_error', details: e.message }), { status: 400 });
  }

  console.log(`[${VERSION}] 📥 PAYLOAD BRUTO RECEBIDO:`);
  console.log(JSON.stringify(payload, null, 2));

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 AUDITORIA #1: LÓGICA DE fromMe
  // ═══════════════════════════════════════════════════════════════════════════════
  const fromMeValue = payload.fromMe;
  const fromMeType = typeof fromMeValue;
  const fromMeIsExactlyFalse = fromMeValue === false;
  const fromMeIsStrictFalse = payload.fromMe === false;

  console.log(`[${VERSION}] 🔍 AUDITORIA #1: fromMe`);
  console.log(`  - Valor bruto: ${JSON.stringify(fromMeValue)}`);
  console.log(`  - Tipo: ${fromMeType}`);
  console.log(`  - fromMe === false: ${fromMeIsStrictFalse} ← CRÍTICO`);
  console.log(`  - fromMe == false (loose): ${fromMeValue == false}`);
  console.log(`  - !fromMe: ${!fromMeValue}`);
  console.log(`  - Verdict: ${fromMeIsStrictFalse ? '✅ PASSA (é mensagem de entrada)' : '❌ FALHA (não passaria no filtro)'}`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 AUDITORIA #2: EXTRAÇÃO DE CONTEÚDO
  // ═══════════════════════════════════════════════════════════════════════════════
  const conteudoSources = {
    'payload.text?.message': payload.text?.message,
    'payload.text': payload.text,
    'payload.body': payload.body,
    'payload.message': payload.message,
    'payload.caption': payload.caption,
  };

  console.log(`[${VERSION}] 🔍 AUDITORIA #2: EXTRAÇÃO DE CONTEÚDO`);
  for (const [source, value] of Object.entries(conteudoSources)) {
    const status = value ? '✅' : '❌';
    console.log(`  ${status} ${source}: ${JSON.stringify(value)}`);
  }

  const conteudoExtraido = 
    payload.text?.message ??
    payload.text ??
    payload.body ??
    payload.message ??
    payload.caption ??
    '';

  console.log(`  📋 Conteúdo final extraído: "${conteudoExtraido}"`);
  console.log(`  📊 Comprimento: ${String(conteudoExtraido).trim().length} chars`);
  console.log(`  Verdict: ${conteudoExtraido.trim() ? '✅ TEM CONTEÚDO' : '❌ VAZIO'}`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 AUDITORIA #3: INDICADORES DE MENSAGEM
  // ═══════════════════════════════════════════════════════════════════════════════
  const temConteudoMensagem = payload.text || payload.body || payload.message || 
                              payload.image || payload.video || payload.audio || 
                              payload.document || payload.sticker;
  const temIndicadoresMensagem = payload.senderName || payload.chatName || payload.pushName;

  console.log(`[${VERSION}] 🔍 AUDITORIA #3: INDICADORES`);
  console.log(`  - temConteudoMensagem: ${!!temConteudoMensagem}`);
  console.log(`    - payload.text: ${!!payload.text}`);
  console.log(`    - payload.body: ${!!payload.body}`);
  console.log(`    - payload.message: ${!!payload.message}`);
  console.log(`    - payload.image: ${!!payload.image}`);
  console.log(`    - payload.video: ${!!payload.video}`);
  console.log(`    - payload.audio: ${!!payload.audio}`);
  console.log(`    - payload.document: ${!!payload.document}`);
  console.log(`    - payload.sticker: ${!!payload.sticker}`);
  console.log(`  - temIndicadoresMensagem: ${!!temIndicadoresMensagem}`);
  console.log(`    - payload.senderName: ${payload.senderName}`);
  console.log(`    - payload.chatName: ${payload.chatName}`);
  console.log(`    - payload.pushName: ${payload.pushName}`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 AUDITORIA #4: LÓGICA DE DECISÃO ehMensagemReal
  // ═══════════════════════════════════════════════════════════════════════════════
  const ehMensagemReal = payload.messageId && 
                         payload.phone && 
                         payload.fromMe === false && 
                         (temConteudoMensagem || temIndicadoresMensagem);

  console.log(`[${VERSION}] 🔍 AUDITORIA #4: LÓGICA ehMensagemReal`);
  console.log(`  - Checklist:`);
  console.log(`    ✓ payload.messageId: ${!!payload.messageId} (${payload.messageId})`);
  console.log(`    ✓ payload.phone: ${!!payload.phone} (${payload.phone})`);
  console.log(`    ✓ payload.fromMe === false: ${fromMeIsStrictFalse}`);
  console.log(`    ✓ (temConteudoMensagem || temIndicadoresMensagem): ${!!(temConteudoMensagem || temIndicadoresMensagem)}`);
  console.log(`  📊 RESULTADO ehMensagemReal: ${ehMensagemReal ? '✅ PASSA - vai ser processada' : '❌ FALHA - vai ser ignorada ou marcar como update'}`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔍 AUDITORIA #5: FLUXO DE DECISÃO NO normalizarPayload
  // ═══════════════════════════════════════════════════════════════════════════════
  const tipo = String(payload.type ?? payload.event ?? '').toLowerCase();
  const isQRCode = tipo.includes('qrcode') || payload.qrcode || payload.qr;
  const isConnection = tipo.includes('connection') || typeof payload.connected === 'boolean';
  const isStatusUpdate = !ehMensagemReal && (tipo.includes('messagestatuscallback') || tipo.includes('message-status') || (Array.isArray(payload.ids) && payload.ids.length > 0));

  console.log(`[${VERSION}] 🔍 AUDITORIA #5: FLUXO DE DECISÃO`);
  console.log(`  - tipo: "${tipo}"`);
  console.log(`  - isQRCode: ${isQRCode}`);
  console.log(`  - isConnection: ${isConnection}`);
  console.log(`  - isStatusUpdate: ${isStatusUpdate}`);
  console.log(`  - ehMensagemReal: ${ehMensagemReal}`);
  console.log(`  📊 FLUXO RESULTANTE:`);
  if (isQRCode) {
    console.log(`     → Será processado como QR_CODE`);
  } else if (isConnection) {
    console.log(`     → Será processado como CONNECTION`);
  } else if (isStatusUpdate) {
    console.log(`     → Será processado como MESSAGE_UPDATE (status callback)`);
  } else if (ehMensagemReal) {
    console.log(`     → ✅ Será processado como MENSAGEM REAL (vai para handleMessage)`);
  } else {
    console.log(`     → ❌ SERÁ DESCARTADO COMO UNKNOWN`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🎯 CONCLUSÃO DO DIAGNÓSTICO
  // ═══════════════════════════════════════════════════════════════════════════════
  const diagnostico = {
    version: VERSION,
    timestamp: new Date().toISOString(),
    payload_tipo: tipo,
    fromMe_resultado: fromMeIsSt