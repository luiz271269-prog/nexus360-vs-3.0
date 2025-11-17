import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Função de Teste de Conectividade com Evolution API
 * Use esta função para diagnosticar problemas de conexão
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.inovacode.app.br';
        const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
        
        const resultados = {
            timestamp: new Date().toISOString(),
            usuario: user.email,
            testes: []
        };
        
        // Teste 1: Verificar variáveis de ambiente
        const apiKeyConfigurada = !!evolutionApiKey;
        
        resultados.testes.push({
            teste: 'Variáveis de Ambiente',
            status: apiKeyConfigurada ? 'sucesso' : 'falha',
            detalhes: {
                EVOLUTION_API_URL: evolutionApiUrl,
                EVOLUTION_API_KEY_CONFIGURADA: apiKeyConfigurada
            }
        });
        
        if (!apiKeyConfigurada) {
            return Response.json({
                success: false,
                erro: 'EVOLUTION_API_KEY não configurada',
                mensagem_usuario: '🔑 Configure a chave de API da Evolution no Dashboard',
                instrucoes: [
                    '1. Acesse Dashboard > Settings > Environment Variables',
                    '2. Adicione: EVOLUTION_API_KEY = sua_chave_aqui',
                    '3. Opcional: EVOLUTION_API_URL = url_do_servidor (padrão: https://evo.inovacode.app.br)',
                    '4. Salve e tente novamente'
                ],
                resultados
            });
        }
        
        // Teste 2: Conectividade básica com Evolution API
        try {
            const response = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
                method: 'GET',
                headers: {
                    'apikey': evolutionApiKey
                }
            });
            
            if (response.ok) {
                const instancias = await response.json();
                resultados.testes.push({
                    teste: 'Conectividade Evolution API',
                    status: 'sucesso',
                    detalhes: {
                        status_code: response.status,
                        total_instancias: Array.isArray(instancias) ? instancias.length : 0,
                        instancias: instancias
                    }
                });
            } else {
                const errorText = await response.text();
                resultados.testes.push({
                    teste: 'Conectividade Evolution API',
                    status: 'falha',
                    detalhes: {
                        status_code: response.status,
                        erro: errorText,
                        mensagem: 'Chave de API inválida ou servidor inacessível'
                    }
                });
            }
        } catch (error) {
            resultados.testes.push({
                teste: 'Conectividade Evolution API',
                status: 'erro',
                detalhes: {
                    erro: error.message,
                    tipo: 'Falha de conexão',
                    mensagem: 'Não foi possível conectar ao servidor Evolution API'
                }
            });
        }
        
        // Teste 3: Verificar webhook configurado
        const baseUrl = new URL(req.url).origin;
        const webhookUrl = `${baseUrl}/api/functions/whatsappWebhook`;
        
        resultados.testes.push({
            teste: 'Configuração Webhook',
            status: 'info',
            detalhes: {
                webhook_url: webhookUrl,
                base_url: baseUrl,
                observacao: 'Certifique-se de que este webhook está acessível publicamente'
            }
        });
        
        // Teste 4: Verificar integrações no VendaPro
        const integracoes = await base44.entities.WhatsAppIntegration.list('-created_date', 10);
        resultados.testes.push({
            teste: 'Integrações VendaPro',
            status: 'sucesso',
            detalhes: {
                total: integracoes.length,
                conectadas: integracoes.filter(i => i.status === 'conectado').length,
                aguardando: integracoes.filter(i => i.status === 'pendente_qrcode').length,
                desconectadas: integracoes.filter(i => i.status === 'desconectado').length,
                integracoes: integracoes.map(i => ({
                    id: i.id,
                    nome: i.nome_instancia,
                    status: i.status,
                    numero: i.numero_telefone
                }))
            }
        });
        
        // Resumo final
        const todosSucesso = resultados.testes.every(t => t.status === 'sucesso' || t.status === 'info');
        
        return Response.json({
            success: todosSucesso,
            mensagem_usuario: todosSucesso ? 
                '✅ Tudo configurado corretamente!' : 
                '⚠️ Algumas configurações precisam de atenção',
            resumo: {
                total_testes: resultados.testes.length,
                sucessos: resultados.testes.filter(t => t.status === 'sucesso').length,
                falhas: resultados.testes.filter(t => t.status === 'falha' || t.status === 'erro').length
            },
            resultados
        });
        
    } catch (error) {
        console.error("❌ [TesteConexao] Erro:", error);
        return Response.json({ 
            success: false,
            erro: 'Erro interno no teste de conexão',
            mensagem_usuario: '❌ Ocorreu um erro ao testar a conexão',
            detalhes: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});