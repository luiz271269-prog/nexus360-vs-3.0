import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Função Agendada para Análise em Lote de Clientes
 * Executa análise completa de todos os clientes ativos
 * Recomendado: executar 1x por dia (madrugada)
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Validar autorização
        const authHeader = req.headers.get('authorization');
        const cronSecret = Deno.env.get('CRON_SECRET');
        
        if (authHeader !== `Bearer ${cronSecret}`) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        console.log("🧠 [AnaliseLote] Iniciando análise em lote de clientes...");
        const inicio = Date.now();
        
        // Importar MotorInteligencia
        const { default: MotorInteligenciaV3 } = await import('../components/inteligencia/MotorInteligenciaV3.js');
        
        // Analisar todos os clientes
        const resultados = await MotorInteligenciaV3.analisarClientesEmLote();
        
        const tempoTotal = ((Date.now() - inicio) / 1000).toFixed(2);
        
        console.log(`✅ [AnaliseLote] Concluído em ${tempoTotal}s: ${resultados.length} clientes analisados`);
        
        return Response.json({
            success: true,
            timestamp: new Date().toISOString(),
            clientes_analisados: resultados.length,
            tempo_segundos: parseFloat(tempoTotal),
            resumo: {
                score_medio: resultados.reduce((sum, r) => sum + (r.score || 0), 0) / resultados.length,
                clientes_urgentes: resultados.filter(r => r.analise?.score_urgencia >= 70).length,
                clientes_risco_churn: resultados.filter(r => 
                    r.analise?.risco_churn === 'alto' || r.analise?.risco_churn === 'critico'
                ).length
            }
        });
        
    } catch (error) {
        console.error("❌ [AnaliseLote] Erro:", error);
        return Response.json({ 
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
});