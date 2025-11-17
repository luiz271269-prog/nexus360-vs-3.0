/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ATENDENTE SELECTOR - Seleciona melhor atendente            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export class AtendenteSelector {
  
  static async buscarAtendentesDisponiveis(base44, setor) {
    console.log('[SELECTOR] Buscando atendentes para setor:', setor);
    
    try {
      const todosAtendentes = await base44.asServiceRole.entities.User.filter({
        is_whatsapp_attendant: true,
        attendant_sector: setor
      });
      
      console.log('[SELECTOR] Total de atendentes no setor:', todosAtendentes.length);
      
      const atendentesDisponiveis = todosAtendentes.filter(atendente => {
        const isOnline = atendente.availability_status === 'online';
        const conversasAtuais = atendente.current_conversations_count || 0;
        const capacidadeMax = atendente.max_concurrent_conversations || 5;
        const temCapacidade = conversasAtuais < capacidadeMax;
        
        console.log('[SELECTOR] Atendente:', {
          nome: atendente.full_name,
          isOnline,
          conversasAtuais,
          capacidadeMax,
          temCapacidade
        });
        
        return isOnline && temCapacidade;
      });
      
      atendentesDisponiveis.sort((a, b) => {
        const cargaA = a.current_conversations_count || 0;
        const cargaB = b.current_conversations_count || 0;
        return cargaA - cargaB;
      });
      
      console.log('[SELECTOR] Atendentes disponíveis:', atendentesDisponiveis.length);
      
      return atendentesDisponiveis;
      
    } catch (error) {
      console.error('[SELECTOR] Erro ao buscar atendentes:', error);
      return [];
    }
  }
  
  static async selecionarMelhorAtendente(base44, setor, preferencia = null) {
    const disponiveis = await this.buscarAtendentesDisponiveis(base44, setor);
    
    if (disponiveis.length === 0) {
      console.log('[SELECTOR] ⚠️ Nenhum atendente disponível no setor:', setor);
      return null;
    }
    
    if (preferencia) {
      const preferido = disponiveis.find(a => a.id === preferencia);
      if (preferido) {
        console.log('[SELECTOR] ✅ Atendente preferido encontrado:', preferido.full_name);
        return preferido;
      }
    }
    
    const melhor = disponiveis[0];
    console.log('[SELECTOR] ✅ Melhor atendente:', {
      nome: melhor.full_name,
      carga: melhor.current_conversations_count
    });
    
    return melhor;
  }
  
  static async validarDisponibilidade(base44, atendenteId) {
    try {
      const atendente = await base44.asServiceRole.entities.User.get(atendenteId);
      
      const isOnline = atendente.availability_status === 'online';
      const conversasAtuais = atendente.current_conversations_count || 0;
      const capacidadeMax = atendente.max_concurrent_conversations || 5;
      const temCapacidade = conversasAtuais < capacidadeMax;
      
      return {
        disponivel: isOnline && temCapacidade,
        motivo: !isOnline ? 'offline' : !temCapacidade ? 'sem_capacidade' : 'ok',
        atendente
      };
      
    } catch (error) {
      console.error('[SELECTOR] Erro ao validar disponibilidade:', error);
      return {
        disponivel: false,
        motivo: 'erro',
        erro: error.message
      };
    }
  }
}