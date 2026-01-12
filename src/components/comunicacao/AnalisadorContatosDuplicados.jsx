import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Phone, AlertCircle, CheckCircle, Trash2,
  ChevronDown, ChevronUp, Clock, MessageCircle, User, Copy
} from "lucide-react";
import { normalizarTelefone } from "@/components/lib/phoneUtils";
import { toast } from "sonner";

export default function AnalisadorContatosDuplicados({ telefone: telefoneProp, isAdmin = false, onClose }) {
  const [telefone, setTelefone] = useState(telefoneProp || '');
  const [carregando, setCarregando] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [expandedContatos, setExpandedContatos] = useState({});

  // ✅ ANÁLISE COMPLETA DE DUPLICADOS
  const analisar = async (tel) => {
    setCarregando(true);
    setResultado(null);
    setExpandedContatos({});

    try {
      const telefonNormalizado = normalizarTelefone(tel || telefone);
      if (!telefonNormalizado) {
        setResultado({ erro: 'Telefone inválido' });
        return;
      }

      // 1️⃣ Buscar TODOS os contatos com este telefone (todas as variações)
      const variacoesTelefone = gerarVariacoesTelefone(telefonNormalizado);
      let contatosComTelefone = [];

      for (const tel of variacoesTelefone) {
        const resultado = await base44.entities.Contact.filter({ telefone: tel });
        if (resultado && resultado.length > 0) {
          contatosComTelefone = [...contatosComTelefone, ...resultado];
        }
      }

      // Remover duplicatas por ID
      const contatosUnicos = Array.from(
        new Map(contatosComTelefone.map(c => [c.id, c])).values()
      );

      // 2️⃣ Para cada contato: análise completa (threads, mensagens, interações)
      const analiseCompleta = await Promise.all(
        contatosUnicos.map(async (contato) => {
          const threads = await base44.entities.MessageThread.filter({ contact_id: contato.id });
          
          const todasMensagens = await base44.entities.Message.filter(
            { sender_id: contato.id },
            '-sent_at',
            500
          );

          const interacoes = await base44.entities.Interacao.filter(
            { contact_id: contato.id },
            '-created_date',
            100
          );

          // Calcular score de importância
          const ultimaInteracao = todasMensagens[0]?.sent_at || interacoes[0]?.created_date || contato.created_date;
          const quantidadeMensagens = todasMensagens.length;
          const quantidadeInteracoes = interacoes.length;
          const temThreadsAtivas = threads.some(t => t.status === 'aberta');

          return {
            contato,
            threads: threads.length,
            threadsCom: threads,
            quantidadeMensagens,
            quantidadeInteracoes,
            ultimaInteracao: new Date(ultimaInteracao),
            temThreadsAtivas,
            score: calcularScoreImportancia({
              quantidadeMensagens,
              quantidadeInteracoes,
              temThreadsAtivas,
              diasDesdeUltima: Math.floor((Date.now() - new Date(ultimaInteracao)) / (1000 * 60 * 60 * 24))
            })
          };
        })
      );

      // Ordenar por score (maior = principal)
      analiseCompleta.sort((a, b) => b.score - a.score);

      setResultado({
        telefone: telefonNormalizado,
        contatosDuplicados: analiseCompleta,
        principal: analiseCompleta[0]?.contato,
        duplicatasParaMesclar: analiseCompleta.slice(1)
      });
    } catch (error) {
      console.error('[AnalisadorContatosDuplicados]', error);
      setResultado({ erro: error.message });
    } finally {
      setCarregando(false);
    }
  };

  // ✅ GERAR VARIAÇÕES DE TELEFONE PARA BUSCA COMPLETA
  const gerarVariacoesTelefone = (tel) => {
    const limpo = tel.replace(/\D/g, '');
    const variacoes = new Set([tel]);

    // Variações comuns brasileiras
    if (limpo.length === 13 && limpo.startsWith('55')) {
      variacoes.add('+' + limpo);
      variacoes.add(limpo);
      variacoes.add('+55' + limpo.substring(2));
    }
    if (limpo.length === 12 && limpo.startsWith('55')) {
      variacoes.add('+' + limpo);
      variacoes.add('+55' + limpo.substring(2) + '9');
    }

    return Array.from(variacoes);
  };

  // ✅ CALCULAR SCORE DE IMPORTÂNCIA (qual manter)
  const calcularScoreImportancia = ({ quantidadeMensagens, quantidadeInteracoes, temThreadsAtivas, diasDesdeUltima }) => {
    let score = 0;
    score += quantidadeMensagens * 10; // Mensagens são importantes
    score += quantidadeInteracoes * 15; // Interações mais ainda
    score += temThreadsAtivas ? 50 : 0; // Thread ativa = MUITO importante
    score += Math.max(0, 100 - (diasDesdeUltima * 2)); // Recência
    return score;
  };

  // ✅ MESCLAR CONTATOS (ADMIN ONLY)
  const mesclarContatos = async () => {
    if (!isAdmin || !resultado?.principal || resultado?.duplicatasParaMesclar?.length === 0) {
      toast.error('Ação não permitida ou sem duplicatas para mesclar');
      return;
    }

    setCorrigindo(true);
    try {
      const principal = resultado.principal;
      const duplicatas = resultado.duplicatasParaMesclar;

      toast.loading('🔄 Mesclando contatos...');

      // 1. Mesclar informações do contato principal
      const updateData = { ...principal };
      
      // Tentar manter melhor nome (não vazio, não repetido com telefone)
      for (const dup of duplicatas) {
        if (dup.contato.nome && dup.contato.nome !== principal.telefone && !updateData.nome?.includes(dup.contato.nome)) {
          updateData.nome = `${updateData.nome} / ${dup.contato.nome}`;
        }
        // Herdar campos vazios
        if (!updateData.empresa && dup.contato.empresa) updateData.empresa = dup.contato.empresa;
        if (!updateData.cargo && dup.contato.cargo) updateData.cargo = dup.contato.cargo;
        if (!updateData.email && dup.contato.email) updateData.email = dup.contato.email;
      }

      await base44.entities.Contact.update(principal.id, updateData);

      // 2. Redirecionar threads das duplicatas para principal
      for (const dup of duplicatas) {
        const threadsDup = await base44.entities.MessageThread.filter({ contact_id: dup.contato.id });
        for (const thread of threadsDup) {
          // Verificar se já existe thread para contato principal nessa integração
          const threadPrincipal = resultado.contatosDuplicados[0].threadsCom.find(
            t => t.whatsapp_integration_id === thread.whatsapp_integration_id
          );

          if (threadPrincipal) {
            // Redirecionar mensagens da duplicata para thread principal
            const mensagens = await base44.entities.Message.filter({ thread_id: thread.id });
            for (const msg of mensagens) {
              await base44.entities.Message.update(msg.id, { thread_id: threadPrincipal.id });
            }
            // Deletar thread duplicata
            await base44.entities.MessageThread.delete(thread.id);
          } else {
            // Atualizar thread para apontar ao contato principal
            await base44.entities.MessageThread.update(thread.id, { contact_id: principal.id });
          }
        }

        // 3. Redirecionar interações
        const interacoes = await base44.entities.Interacao.filter({ contact_id: dup.contato.id });
        for (const int of interacoes) {
          await base44.entities.Interacao.update(int.id, { contact_id: principal.id });
        }

        // 4. Deletar contato duplicata
        await base44.entities.Contact.delete(dup.contato.id);
      }

      toast.success(`✅ ${duplicatas.length} contatos mesclados com sucesso!`);
      
      // Recarregar análise
      await analisar(telefone);
    } catch (error) {
      console.error('[AnalisadorContatosDuplicados] Erro ao mesclar:', error);
      toast.error(`Erro ao mesclar: ${error.message}`);
    } finally {
      setCorrigindo(false);
    }
  };

  // ✅ DELETAR CONTATO DUPLICATA (ADMIN ONLY)
  const deletarDuplicata = async (contatoId) => {
    if (!isAdmin) {
      toast.error('Apenas admin pode deletar');
      return;
    }

    try {
      toast.loading('🗑️ Deletando...');
      
      // Deletar threads e mensagens associadas
      const threads = await base44.entities.MessageThread.filter({ contact_id: contatoId });
      for (const thread of threads) {
        const mensagens = await base44.entities.Message.filter({ thread_id: thread.id });
        for (const msg of mensagens) {
          await base44.entities.Message.delete(msg.id);
        }
        await base44.entities.MessageThread.delete(thread.id);
      }

      // Deletar contato
      await base44.entities.Contact.delete(contatoId);

      toast.success('✅ Contato deletado!');
      
      // Recarregar
      await analisar(telefone);
    } catch (error) {
      console.error('[AnalisadorContatosDuplicados] Erro ao deletar:', error);
      toast.error(`Erro ao deletar: ${error.message}`);
    }
  };

  useEffect(() => {
    if (telefoneProp) {
      analisar(telefoneProp);
    }
  }, [telefoneProp]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <Card className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <div className="flex items-center gap-3 mb-4">
          <Phone className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-indigo-900">Análise de Duplicados</h1>
        </div>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="Telefone (ex: 5548999561413)"
            className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && analisar(telefone)}
          />
          <Button 
            onClick={() => analisar(telefone)} 
            disabled={carregando}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {carregando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
            Analisar
          </Button>
        </div>
      </Card>

      {resultado?.erro && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <AlertDescription className="text-red-700 ml-2">{resultado.erro}</AlertDescription>
        </Alert>
      )}

      {resultado && !resultado.erro && (
        <div className="space-y-4">
          {/* RESUMO */}
          <Card className={`p-4 ${resultado.contatosDuplicados.length > 1 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-start gap-3">
              {resultado.contatosDuplicados.length > 1 ? (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <h2 className={`font-bold mb-2 ${resultado.contatosDuplicados.length > 1 ? 'text-red-900' : 'text-green-900'}`}>
                  {resultado.contatosDuplicados.length > 1 
                    ? `⚠️ ${resultado.contatosDuplicados.length} CONTATOS ENCONTRADOS` 
                    : `✅ Apenas 1 contato com este telefone`}
                </h2>
                
                {isAdmin && resultado.contatosDuplicados.length > 1 && (
                  <Button
                    onClick={mesclarContatos}
                    disabled={corrigindo}
                    className="mt-3 bg-green-600 hover:bg-green-700"
                  >
                    {corrigindo ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Mesclando...
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Mesclar {resultado.duplicatasParaMesclar.length} duplicatas
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* CONTATOS DETALHADO */}
          {resultado.contatosDuplicados.map((analise, idx) => (
            <Card key={analise.contato.id} className={`p-4 ${idx === 0 ? 'border-2 border-green-500 bg-green-50' : 'bg-slate-50'}`}>
              <div className="space-y-3">
                {/* Header */}
                <div 
                  onClick={() => setExpandedContatos(p => ({ ...p, [analise.contato.id]: !p[analise.contato.id] }))}
                  className="cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <User className="w-5 h-5 text-slate-500" />
                    <div>
                      <h3 className="font-bold text-lg">
                        {analise.contato.nome}
                        {idx === 0 && <Badge className="ml-2 bg-green-600">Principal</Badge>}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Score: {analise.score.toFixed(0)} | {analise.quantidadeMensagens} mensagens | {analise.quantidadeInteracoes} interações
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-600">Criado: {new Date(analise.contato.created_date).toLocaleDateString('pt-BR')}</p>
                    <p className="text-xs text-slate-600">Última: {analise.ultimaInteracao.toLocaleDateString('pt-BR')}</p>
                    {expandedContatos[analise.contato.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Detalhes expandível */}
                {expandedContatos[analise.contato.id] && (
                  <div className="border-t pt-3 space-y-2 text-xs text-slate-700">
                    <p><strong>ID:</strong> <code className="bg-white px-1 rounded">{analise.contato.id.substring(0, 12)}...</code></p>
                    <p><strong>Tipo:</strong> {analise.contato.tipo_contato}</p>
                    <p><strong>Telefone:</strong> {analise.contato.telefone}</p>
                    {analise.contato.empresa && <p><strong>Empresa:</strong> {analise.contato.empresa}</p>}
                    {analise.contato.email && <p><strong>Email:</strong> {analise.contato.email}</p>}
                    
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Badge variant="outline">{analise.threads} threads</Badge>
                      <Badge variant="outline">{analise.quantidadeMensagens} mensagens</Badge>
                      <Badge variant="outline">{analise.quantidadeInteracoes} interações</Badge>
                      {analise.temThreadsAtivas && <Badge className="bg-blue-200 text-blue-800">Threads ativas</Badge>}
                    </div>

                    {/* Ações Admin */}
                    {isAdmin && idx > 0 && (
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          onClick={() => deletarDuplicata(analise.contato.id)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Deletar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}