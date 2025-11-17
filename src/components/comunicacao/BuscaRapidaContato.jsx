import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Plus, MessageCircle, Loader2, CheckCircle, Phone } from "lucide-react";
import { toast } from "sonner";

export default function BuscaRapidaContato({ onContatoSelecionado, onThreadCriada }) {
  const [numero, setNumero] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [contatoParaCriar, setContatoParaCriar] = useState(null);
  const [criandoContato, setCriandoContato] = useState(false);

  const formatarNumero = (num) => {
    let limpo = num.replace(/\D/g, '');
    
    if (limpo.length > 0 && !limpo.startsWith('55')) {
      limpo = '55' + limpo;
    }
    
    return limpo.length > 0 ? '+' + limpo : '';
  };

  const validarNumero = (num) => {
    const limpo = num.replace(/\D/g, '');
    return limpo.length >= 12 && limpo.length <= 13 && limpo.startsWith('55');
  };

  const buscarOuCriarContato = async () => {
    if (!numero.trim()) {
      toast.error("Digite um número de telefone");
      return;
    }

    const numeroFormatado = formatarNumero(numero);

    if (!validarNumero(numeroFormatado)) {
      toast.error("Número inválido. Use: 48999322400 ou +5548999322400");
      return;
    }

    setBuscando(true);

    try {
      console.log('[BUSCA] Procurando contato:', numeroFormatado);
      
      const contatos = await base44.entities.Contact.filter({
        telefone: numeroFormatado
      });

      if (contatos.length > 0) {
        const contato = contatos[0];
        console.log('[BUSCA] Contato encontrado:', contato.id);
        toast.success(`Contato encontrado: ${contato.nome || numeroFormatado}`);
        
        await abrirConversa(contato);
        setNumero("");
      } else {
        console.log('[BUSCA] Contato não encontrado, perguntando se quer criar');
        setContatoParaCriar({ telefone: numeroFormatado });
        setShowDialog(true);
      }

    } catch (error) {
      console.error("[BUSCA] Erro:", error);
      toast.error("Erro ao buscar contato: " + error.message);
    }

    setBuscando(false);
  };

  const abrirConversa = async (contato) => {
    try {
      console.log('[ABRIR] Buscando thread para contato:', contato.id);
      
      const threads = await base44.entities.MessageThread.filter({
        contact_id: contato.id
      });

      let thread;

      if (threads.length > 0) {
        thread = threads[0];
        console.log('[ABRIR] Thread existente encontrada:', thread.id);
        
        // CORREÇÃO: Verificar se a thread tem integração associada
        if (!thread.whatsapp_integration_id) {
          console.log('[ABRIR] ⚠️ Thread sem integração, buscando integração ativa...');
          
          // Buscar primeira integração ativa
          const integracoes = await base44.entities.WhatsAppIntegration.filter({
            status: 'conectado'
          });
          
          if (integracoes.length === 0) {
            toast.error('⚠️ Nenhuma integração WhatsApp conectada. Configure uma integração primeiro.');
            return;
          }
          
          const integracaoAtiva = integracoes[0];
          console.log('[ABRIR] 🔗 Associando thread à integração:', integracaoAtiva.nome_instancia);
          
          // Atualizar thread com a integração
          await base44.entities.MessageThread.update(thread.id, {
            whatsapp_integration_id: integracaoAtiva.id
          });
          
          thread.whatsapp_integration_id = integracaoAtiva.id;
          toast.info(`🔗 Conversa associada à integração: ${integracaoAtiva.nome_instancia}`);
        }
      } else {
        console.log('[ABRIR] Criando nova thread...');
        
        // Buscar integração ativa ANTES de criar a thread
        const integracoes = await base44.entities.WhatsAppIntegration.filter({
          status: 'conectado'
        });
        
        if (integracoes.length === 0) {
          toast.error('⚠️ Nenhuma integração WhatsApp conectada. Configure uma integração primeiro.');
          return;
        }
        
        const integracaoAtiva = integracoes[0];
        console.log('[ABRIR] 🔗 Criando thread com integração:', integracaoAtiva.nome_instancia);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        thread = await base44.entities.MessageThread.create({
          contact_id: contato.id,
          whatsapp_integration_id: integracaoAtiva.id, // CORREÇÃO: Associar integração ao criar
          status: 'aberta',
          prioridade: 'normal',
          can_send_without_template: true,
          total_mensagens: 0,
          unread_count: 0,
          last_message_at: new Date().toISOString()
        });
        console.log('[ABRIR] Thread criada:', thread.id);
        toast.success(`✅ Conversa criada com ${integracaoAtiva.nome_instancia}`);
      }

      // Adicionar contato à thread para facilitar exibição
      thread.contato = contato;

      // Chamar callbacks
      if (onThreadCriada) {
        console.log('[ABRIR] Chamando onThreadCriada');
        onThreadCriada(thread);
      }

      if (onContatoSelecionado) {
        console.log('[ABRIR] Chamando onContatoSelecionado');
        onContatoSelecionado(contato);
      }

      toast.success("✅ Conversa aberta!");

    } catch (error) {
      console.error("[ABRIR] Erro:", error);
      toast.error("Erro ao abrir conversa: " + error.message);
    }
  };

  const confirmarCriacaoContato = async () => {
    setCriandoContato(true);

    try {
      console.log('[CRIAR] Criando contato:', contatoParaCriar.telefone);
      
      const novoContato = await base44.entities.Contact.create({
        nome: contatoParaCriar.telefone,
        telefone: contatoParaCriar.telefone,
        tipo_contato: "lead",
        vendedor_responsavel: "Sistema",
        whatsapp_status: "nao_verificado",
        whatsapp_optin: false,
        tags: ["novo_contato"],
        observacoes: "Contato criado via busca rápida"
      });

      console.log('[CRIAR] Contato criado:', novoContato.id);
      toast.success("✅ Contato criado!");

      setShowDialog(false);
      setContatoParaCriar(null);
      setNumero("");

      // Aguardar um pouco para garantir que o contato foi salvo
      await new Promise(resolve => setTimeout(resolve, 500));

      // Abrir conversa
      await abrirConversa(novoContato);

    } catch (error) {
      console.error("[CRIAR] Erro:", error);
      toast.error("Erro ao criar contato: " + error.message);
    }

    setCriandoContato(false);
  };

  return (
    <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-green-50 to-emerald-50">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 w-4 h-4" />
          <Input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && buscarOuCriarContato()}
            placeholder="Digite o número: 48999322400"
            className="pl-10 border-green-200 focus:border-green-400"
            disabled={buscando}
          />
        </div>
        <Button
          onClick={buscarOuCriarContato}
          disabled={buscando || !numero.trim()}
          className="bg-green-600 hover:bg-green-700"
        >
          {buscando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4 mr-2" />
          )}
          {buscando ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      <p className="text-xs text-green-700 mt-2 font-medium">
        💡 Se o contato não existir, você poderá criá-lo automaticamente e já começar a conversar!
      </p>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-600" />
              Contato Não Encontrado
            </DialogTitle>
            <DialogDescription>
              O número <strong>{contatoParaCriar?.telefone}</strong> não está cadastrado.
            </DialogDescription>
          </DialogHeader>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Deseja criar este contato e iniciar uma conversa?
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    O contato será salvo automaticamente e você poderá enviar mensagens.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setContatoParaCriar(null);
              }}
              disabled={criandoContato}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarCriacaoContato}
              disabled={criandoContato}
              className="bg-green-600 hover:bg-green-700"
            >
              {criandoContato ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Sim, Criar e Conversar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}