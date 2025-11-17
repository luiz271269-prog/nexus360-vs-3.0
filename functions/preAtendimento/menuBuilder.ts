/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  MENU BUILDER - Constrói menus do pré-atendimento           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export class MenuBuilder {
  
  static construirMenuBoasVindas(nomeContato) {
    const nome = nomeContato && nomeContato !== nomeContato.match(/\d+/)?.[0] 
      ? nomeContato.split(' ')[0] 
      : '';
    
    return `👋 Olá${nome ? ` ${nome}` : ''}! Bem-vindo(a)!

Estou aqui para te conectar com a equipe certa. 

🎯 *Qual setor você precisa?*

1️⃣ *Vendas* - Orçamentos e novos pedidos
2️⃣ *Assistência Técnica* - Suporte e dúvidas
3️⃣ *Financeiro* - Pagamentos e boletos
4️⃣ *Fornecedores* - Parcerias comerciais

📝 Digite o *número* ou *nome* do setor:`;
  }
  
  static construirMenuAtendentes(atendentes, setor) {
    if (!atendentes || atendentes.length === 0) {
      return this.construirMensagemNenhumAtendente(setor);
    }
    
    const emoji = this.getEmojiSetor(setor);
    const setorNome = this.getNomeSetor(setor);
    
    let menu = `${emoji} *${setorNome}*\n\n`;
    menu += `✨ Escolha quem vai te atender:\n\n`;
    
    atendentes.forEach((atendente, index) => {
      const numero = index + 1;
      const nome = atendente.full_name || atendente.email.split('@')[0];
      const status = atendente.availability_status === 'online' ? '🟢' : '🟡';
      const conversas = atendente.current_conversations_count || 0;
      
      menu += `${numero}️⃣ ${status} *${nome}*\n`;
      if (conversas > 0) {
        menu += `   └ ${conversas} conversa${conversas > 1 ? 's' : ''} ativa${conversas > 1 ? 's' : ''}\n`;
      }
      menu += `\n`;
    });
    
    menu += `📝 Digite o *número* do atendente:`;
    
    return menu;
  }
  
  static construirMensagemNenhumAtendente(setor) {
    const setorNome = this.getNomeSetor(setor);
    
    return `😔 Ops! No momento não temos atendentes disponíveis em *${setorNome}*.

⏰ *Horário de atendimento:*
Segunda a Sexta: 08h às 18h
Sábado: 08h às 12h

💡 *Você pode:*
• Deixar sua mensagem que responderemos em breve
• Tentar outro setor digitando *MENU*
• Aguardar um momento que tentaremos te atender

Digite sua mensagem ou *MENU* para voltar:`;
  }
  
  static construirMensagemErro(erro, contexto) {
    let mensagem = `❌ ${erro}\n\n`;
    
    if (contexto === 'setor') {
      mensagem += `Por favor, escolha uma das opções:\n`;
      mensagem += `1️⃣ Vendas\n`;
      mensagem += `2️⃣ Assistência\n`;
      mensagem += `3️⃣ Financeiro\n`;
      mensagem += `4️⃣ Fornecedores\n\n`;
      mensagem += `Ou digite *MENU* para ver as opções novamente.`;
    } else if (contexto === 'atendente') {
      mensagem += `Digite o número do atendente ou *VOLTAR* para escolher outro setor.`;
    }
    
    return mensagem;
  }
  
  static construirMensagemConectando(nomeAtendente, setor) {
    const setorNome = this.getNomeSetor(setor);
    
    return `✅ *Perfeito!*

🔗 Você será conectado(a) com *${nomeAtendente}* do setor de *${setorNome}*.

⏳ Aguarde um momento...`;
  }
  
  static construirMensagemSucesso(nomeAtendente) {
    return `✅ *Conexão estabelecida!*

Você está conversando com *${nomeAtendente}*.

💬 Sua mensagem será respondida em breve.`;
  }
  
  static construirMensagemTimeout() {
    return `⏰ *Tempo esgotado!*

Você não respondeu a tempo e o atendimento foi cancelado.

💡 Para iniciar novamente, basta enviar *OI* ou *MENU*.`;
  }
  
  static construirMensagemCancelamento() {
    return `❌ *Atendimento cancelado*

Não se preocupe! Para recomeçar, basta enviar *OI* ou *MENU* a qualquer momento.

Até logo! 👋`;
  }
  
  static construirMensagemAjuda(estadoAtual) {
    let mensagem = `ℹ️ *Central de Ajuda*\n\n`;
    
    if (estadoAtual === 'WAITING_SECTOR_CHOICE') {
      mensagem += `Você está escolhendo o setor de atendimento.\n\n`;
      mensagem += `*Comandos disponíveis:*\n`;
      mensagem += `• Digite 1, 2, 3 ou 4 para escolher\n`;
      mensagem += `• Digite *MENU* para ver as opções\n`;
      mensagem += `• Digite *CANCELAR* para sair\n`;
    } else if (estadoAtual === 'WAITING_ATTENDANT_CHOICE') {
      mensagem += `Você está escolhendo um atendente.\n\n`;
      mensagem += `*Comandos disponíveis:*\n`;
      mensagem += `• Digite o número do atendente\n`;
      mensagem += `• Digite *VOLTAR* para mudar de setor\n`;
      mensagem += `• Digite *CANCELAR* para sair\n`;
    }
    
    return mensagem;
  }
  
  static construirMensagemAtendenteOcupado(nomeAtendente) {
    return `😔 Desculpe, *${nomeAtendente}* ficou indisponível agora.

🔄 Vou te mostrar outros atendentes disponíveis...`;
  }
  
  static getEmojiSetor(setor) {
    const emojis = {
      'vendas': '🛒',
      'assistencia': '🔧',
      'financeiro': '💰',
      'fornecedor': '🤝'
    };
    return emojis[setor] || '📋';
  }
  
  static getNomeSetor(setor) {
    const nomes = {
      'vendas': 'Vendas',
      'assistencia': 'Assistência Técnica',
      'financeiro': 'Financeiro',
      'fornecedor': 'Fornecedores'
    };
    return nomes[setor] || setor;
  }
}