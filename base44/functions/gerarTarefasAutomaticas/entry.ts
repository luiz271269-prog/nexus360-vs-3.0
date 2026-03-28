import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Função Agendada para Gerar Tarefas Automaticamente
 * Analisa scores e gera tarefas para vendedores
 * Recomendado: executar 3x por dia (manhã, tarde, noite)
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
        
        console.log("🎯 [GeracaoTarefas] Iniciando geração automática de tarefas...");
        
        // Importar MotorInteligencia
        const { default: MotorInteligenciaV3 } = await import('../components/inteligencia/MotorInteligenciaV3.js');
        
        // Gerar tarefas urgentes
        const tarefasCriadas = await MotorInteligenciaV3.gerarTarefasUrgentes();
        
        console.log(`✅ [GeracaoTarefas] ${tarefasCriadas} tarefas geradas`);
        
        return Response.json({
            success: true,
            timestamp: new Date().toISOString(),
            tarefas_criadas: tarefasCriadas
        });
        
    } catch (error) {
        console.error("❌ [GeracaoTarefas] Erro:", error);
        return Response.json({ 
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
});