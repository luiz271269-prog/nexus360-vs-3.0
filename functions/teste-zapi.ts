/**
 * Script de Teste Automatizado Z-API
 * 
 * Este script testa a capacidade de envio de mensagens da Z-API
 * de forma isolada, sem depender do VendaPro.
 * 
 * Como usar:
 * 
 * 1. Configure as variáveis de ambiente ou edite diretamente no script:
 *    export INSTANCE_ID=suainstancia
 *    export TOKEN=seutoken
 *    export PHONE_TESTE=55seunumeroteste
 * 
 * 2. Execute o script:
 *    deno run --allow-net --allow-env teste-zapi.js
 * 
 * Códigos de retorno:
 *   0 - Sucesso (mensagem enviada)
 *   1 - Falha no envio (Z-API retornou erro)
 *   2 - Erro na requisição (rede, timeout, etc)
 */

// ══════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ══════════════════════════════════════════════════════════

const INSTANCE_ID = Deno.env.get('INSTANCE_ID') || 'SUA_INSTANCE_ID_AQUI';
const TOKEN = Deno.env.get('TOKEN') || 'SEU_TOKEN_AQUI';
const PHONE_TESTE = Deno.env.get('PHONE_TESTE') || '55SEUNUMEROAQUI';
const BASE_URL = Deno.env.get('BASE_URL') || 'https://api.z-api.io';

// ══════════════════════════════════════════════════════════
// FUNÇÃO DE TESTE
// ══════════════════════════════════════════════════════════

async function testarEnvioMensagem() {
  console.log('\n🧪 [TESTE Z-API] Iniciando teste de envio de mensagem...\n');
  
  // Validar configuração
  if (INSTANCE_ID === 'SUA_INSTANCE_ID_AQUI' || TOKEN === 'SEU_TOKEN_AQUI' || PHONE_TESTE === '55SEUNUMEROAQUI') {
    console.error('❌ [ERRO] Configure as variáveis de ambiente antes de executar o teste:');
    console.error('   export INSTANCE_ID=suainstancia');
    console.error('   export TOKEN=seutoken');
    console.error('   export PHONE_TESTE=55seunumeroteste');
    console.error('\n   Ou edite diretamente o arquivo teste-zapi.js\n');
    Deno.exit(2);
  }

  const url = `${BASE_URL}/instances/${INSTANCE_ID}/token/${TOKEN}/send-text`;
  
  const payload = {
    phone: PHONE_TESTE,
    message: 'Teste automatizado Z-API - VendaPro'
  };

  console.log('📋 [CONFIG] Configuração do teste:');
  console.log(`   URL: ${url}`);
  console.log(`   Telefone destino: ${PHONE_TESTE}`);
  console.log(`   Mensagem: "${payload.message}"\n`);

  try {
    console.log('🌐 [REQUISIÇÃO] Enviando requisição para Z-API...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const statusCode = res.status;
    const body = await res.json();

    console.log(`\n📊 [RESPOSTA] Status HTTP: ${statusCode}`);
    console.log('📦 [RESPOSTA] Corpo da resposta:');
    console.log(JSON.stringify(body, null, 2));

    // ══════════════════════════════════════════════════════
    // VALIDAÇÃO DA RESPOSTA
    // ══════════════════════════════════════════════════════

    if (statusCode === 200 && body.sent === true) {
      console.log('\n✅ [SUCESSO] Mensagem enviada com sucesso!');
      console.log(`   Message ID: ${body.messageId || 'N/A'}`);
      console.log('\n🎉 A Z-API está funcionando perfeitamente!\n');
      Deno.exit(0);
    } else if (statusCode === 200 && body.sent === false) {
      console.error('\n❌ [FALHA] Z-API retornou sucesso HTTP, mas sent=false');
      console.error('   Motivo:', body.error || body.message || 'Não especificado');
      console.error('\n🔍 Possíveis causas:');
      console.error('   - Dispositivo WhatsApp desconectado');
      console.error('   - Número de telefone inválido');
      console.error('   - Instância pausada/bloqueada\n');
      Deno.exit(1);
    } else {
      console.error(`\n❌ [FALHA] Status HTTP ${statusCode}`);
      console.error('   Resposta:', JSON.stringify(body, null, 2));
      console.error('\n🔍 Possíveis causas:');
      if (statusCode === 401 || statusCode === 403) {
        console.error('   - Token ou Instance ID incorretos');
        console.error('   - Falta Client-Token no header (se necessário)');
      } else if (statusCode === 404) {
        console.error('   - URL da API incorreta');
        console.error('   - Instance ID não existe');
      } else if (statusCode >= 500) {
        console.error('   - Erro interno da Z-API');
        console.error('   - Tente novamente em alguns minutos');
      }
      console.error('');
      Deno.exit(1);
    }

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('\n❌ [TIMEOUT] A requisição demorou mais de 30 segundos');
      console.error('   A Z-API pode estar com problemas de conectividade\n');
    } else {
      console.error('\n❌ [ERRO] Erro na requisição:', err.message);
      console.error('   Stack:', err.stack);
      console.error('\n🔍 Possíveis causas:');
      console.error('   - Sem conexão com a internet');
      console.error('   - URL da API incorreta');
      console.error('   - Firewall bloqueando a requisição\n');
    }
    Deno.exit(2);
  }
}

// ══════════════════════════════════════════════════════════
// EXECUÇÃO
// ══════════════════════════════════════════════════════════

testarEnvioMensagem();