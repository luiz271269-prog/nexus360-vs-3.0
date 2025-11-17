import { base44 } from '@/api/base44Client';
import NexusEngineV3 from './NexusEngineV3';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MOTOR DE AUTO-OTIMIZAÇÃO                                   ║
 * ║  A IA ajusta seus próprios parâmetros baseado em resultados║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export default class MotorAutoOtimizacao {
  
  /**
   * Otimizar prompts baseado em taxa de sucesso
   */
  static async otimizarPrompts() {
    console.log('[AutoOtimizacao] 🔧 Iniciando otimização de prompts...');
    
    try {
      const templates = await base44.entities.PromptTemplate.list();
      
      for (const template of templates) {
        // Buscar conhecimentos gerados por este template
        const conhecimentos = await base44.entities.BaseConhecimento.filter({
          'origem_ia.prompt_usado': template.template_texto.substring(0, 100)
        }, null, 50);

        if (conhecimentos.length < 10) {
          console.log(`[AutoOtimizacao] ⏭️ Template ${template.nome}: dados insuficientes (${conhecimentos.length} registros)`);
          continue;
        }

        // Calcular taxa de sucesso
        const conhecimentosComTaxa = conhecimentos.filter(c => c.taxa_sucesso !== null);
        
        if (conhecimentosComTaxa.length === 0) continue;

        const taxaMedia = conhecimentosComTaxa.reduce((sum, c) => sum + c.taxa_sucesso, 0) / conhecimentosComTaxa.length;

        // Atualizar métricas do template
        await base44.entities.PromptTemplate.update(template.id, {
          'metricas_performance.taxa_sucesso': Math.round(taxaMedia),
          'metricas_performance.n_execucoes': (template.metricas_performance?.n_execucoes || 0) + conhecimentos.length
        });

        console.log(`[AutoOtimizacao] ✅ Template ${template.nome}: Taxa de sucesso atualizada para ${Math.round(taxaMedia)}%`);

        // Se taxa de sucesso for baixa, criar alerta
        if (taxaMedia < 50) {
          await NexusEngineV3.registrarConhecimento({
            titulo: `⚠️ Template de Baixo Desempenho: ${template.nome}`,
            tipo_registro: 'aprendizado_ia',
            categoria: 'inteligencia',
            conteudo: `O template "${template.nome}" apresenta taxa de sucesso de apenas ${Math.round(taxaMedia)}%. Recomenda-se revisão manual.`,
            conteudo_estruturado: {
              template_id: template.id,
              taxa_sucesso_atual: taxaMedia,
              recomendacao: 'revisar_prompt'
            },
            relevancia_score: 80,
            confianca_ia: 90,
            tags: ['prompt', 'baixo_desempenho', 'necessita_revisao'],
            origem_ia: {
              motor_gerador: 'MotorAutoOtimizacao',
              timestamp_geracao: new Date().toISOString()
            }
          });
        }
      }

      console.log('[AutoOtimizacao] ✅ Otimização de prompts concluída');
      
    } catch (error) {
      console.error('[AutoOtimizacao] ❌ Erro na otimização:', error);
    }
  }

  /**
   * Identificar padrões de sucesso e criar "melhores práticas"
   */
  static async identificarMelhoresPraticas() {
    console.log('[AutoOtimizacao] 💎 Identificando melhores práticas...');
    
    try {
      // Buscar conhecimentos com alta taxa de sucesso
      const conhecimentos = await base44.entities.BaseConhecimento.list();
      const sucessos = conhecimentos.filter(c => c.taxa_sucesso >= 80);

      // Agrupar por tipo_registro
      const sucessosPorTipo = sucessos.reduce((acc, c) => {
        if (!acc[c.tipo_registro]) acc[c.tipo_registro] = [];
        acc[c.tipo_registro].push(c);
        return acc;
      }, {});

      for (const [tipo, items] of Object.entries(sucessosPorTipo)) {
        if (items.length < 5) continue;

        // Extrair padrões comuns (tags mais frequentes)
        const todasTags = items.flatMap(i => i.tags || []);
        const frequenciaTags = todasTags.reduce((acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        }, {});

        const tagsComuns = Object.entries(frequenciaTags)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tag]) => tag);

        // Criar melhor prática
        await NexusEngineV3.registrarConhecimento({
          titulo: `💎 Melhor Prática Identificada: ${tipo}`,
          tipo_registro: 'melhor_pratica',
          categoria: 'estrategia',
          conteudo: `Padrão de sucesso identificado para ${tipo}. ${items.length} casos com taxa média de ${Math.round(items.reduce((sum, i) => sum + i.taxa_sucesso, 0) / items.length)}%.`,
          conteudo_estruturado: {
            tipo_original: tipo,
            n_casos_sucesso: items.length,
            taxa_sucesso_media: items.reduce((sum, i) => sum + i.taxa_sucesso, 0) / items.length,
            tags_comuns: tagsComuns,
            exemplos: items.slice(0, 3).map(i => ({
              titulo: i.titulo,
              taxa_sucesso: i.taxa_sucesso
            }))
          },
          relevancia_score: 90,
          confianca_ia: 85,
          tags: ['melhor_pratica', tipo, ...tagsComuns],
          origem_ia: {
            motor_gerador: 'MotorAutoOtimizacao',
            timestamp_geracao: new Date().toISOString()
          }
        });

        console.log(`[AutoOtimizacao] 💎 Melhor prática criada para ${tipo}`);
      }

      console.log('[AutoOtimizacao] ✅ Identificação de melhores práticas concluída');
      
    } catch (error) {
      console.error('[AutoOtimizacao] ❌ Erro na identificação:', error);
    }
  }

  /**
   * Executar ciclo completo de auto-otimização
   */
  static async executarCicloCompleto() {
    console.log('[AutoOtimizacao] 🔄 Iniciando ciclo completo de auto-otimização...');
    
    try {
      await this.otimizarPrompts();
      await this.identificarMelhoresPraticas();
      
      console.log('[AutoOtimizacao] ✅ Ciclo completo de auto-otimização concluído');
      
      return {
        success: true,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[AutoOtimizacao] ❌ Erro no ciclo:', error);
      throw error;
    }
  }
}