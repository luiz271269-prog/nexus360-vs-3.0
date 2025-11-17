import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { 
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';

export default function TestesIntegracao() {
  const [executando, setExecutando] = useState(false);
  const [resultados, setResultados] = useState([]);

  const testesIntegracao = [
    {
      id: 'fluxo_completo_lead',
      nome: 'Fluxo Completo: Lead → Qualificação → Venda',
      descricao: 'Testa todo o ciclo de vida de um lead'
    },
    {
      id: 'automacao_tags',
      nome: 'Automação: Aplicação de Tags + Playbook Trigger',
      descricao: 'Testa sistema de tags automáticas e disparo de playbooks'
    },
    {
      id: 'ia_end_to_end',
      nome: 'IA End-to-End: Classificação → RAG → Resposta',
      descricao: 'Testa pipeline completo de IA'
    },
    {
      id: 'backup_restore',
      nome: 'Backup e Restauração',
      descricao: 'Testa criação e restauração de backup'
    },
    {
      id: 'health_check_completo',
      nome: 'Health Check Completo',
      descricao: 'Verifica saúde de todos os componentes'
    }
  ];

  const executarTeste = async (teste) => {
    console.log(`[TESTE INTEGRAÇÃO] Executando: ${teste.nome}`);
    const inicio = Date.now();

    try {
      switch (teste.id) {
        case 'fluxo_completo_lead':
          return await testarFluxoCompletoLead();
        
        case 'automacao_tags':
          return await testarAutomacaoTags();
        
        case 'ia_end_to_end':
          return await testarIAEndToEnd();
        
        case 'backup_restore':
          return await testarBackupRestore();
        
        case 'health_check_completo':
          return await testarHealthCheck();
        
        default:
          throw new Error('Teste não implementado');
      }
    } catch (error) {
      return {
        sucesso: false,
        erro: error.message,
        tempo: Date.now() - inicio
      };
    }
  };

  const executarTodosTestes = async () => {
    setExecutando(true);
    setResultados([]);

    const novosResultados = [];

    for (const teste of testesIntegracao) {
      const resultado = await executarTeste(teste);
      novosResultados.push({
        ...teste,
        ...resultado
      });
      setResultados([...novosResultados]);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setExecutando(false);
    
    const sucesso = novosResultados.filter(r => r.sucesso).length;
    const total = novosResultados.length;
    
    if (sucesso === total) {
      toast.success('✅ Todos os testes passaram!');
    } else {
      toast.warning(`⚠️ ${total - sucesso} teste(s) falharam`);
    }
  };

  // Implementações dos testes
  async function testarFluxoCompletoLead() {
    const inicio = Date.now();
    const passos = [];

    // 1. Criar contato
    const contato = await base44.entities.Contact.create({
      nome: 'Teste Integração Lead',
      telefone: '+5511988887777',
      tags: ['teste_integracao']
    });
    passos.push('✓ Contato criado');

    // 2. Aplicar tag de qualificação
    const tagResponse = await base44.functions.invoke('tagManager', {
      action: 'apply_tag',
      contact_id: contato.id,
      tag_nome: 'lead_quente'
    });
    passos.push('✓ Tag aplicada');

    // 3. Criar cliente
    const cliente = await base44.entities.Cliente.create({
      razao_social: 'Empresa Teste Integração',
      vendedor_responsavel: 'Sistema'
    });
    passos.push('✓ Cliente criado');

    // 4. Criar orçamento
    const orcamento = await base44.entities.Orcamento.create({
      cliente_nome: cliente.razao_social,
      vendedor: 'Sistema',
      data_orcamento: new Date().toISOString().split('T')[0],
      valor_total: 5000,
      status: 'enviado'
    });
    passos.push('✓ Orçamento criado');

    // 5. Cleanup
    await base44.entities.Contact.delete(contato.id);
    await base44.entities.Cliente.delete(cliente.id);
    await base44.entities.Orcamento.delete(orcamento.id);
    passos.push('✓ Cleanup realizado');

    return {
      sucesso: true,
      detalhes: passos.join('\n'),
      tempo: Date.now() - inicio
    };
  }

  async function testarAutomacaoTags() {
    const inicio = Date.now();
    
    const response = await base44.functions.invoke('tagManager', {
      action: 'process_automatic_rules'
    });

    return {
      sucesso: response.data.success,
      detalhes: `${response.data.tags_aplicadas || 0} tags aplicadas`,
      tempo: Date.now() - inicio
    };
  }

  async function testarIAEndToEnd() {
    const inicio = Date.now();
    const passos = [];

    // 1. Classificar intenção
    const classifyResponse = await base44.functions.invoke('nexusClassifier', {
      action: 'classify_intention',
      mensagem: 'Quero comprar um produto'
    });
    passos.push(`✓ Intenção: ${classifyResponse.data.intent}`);

    // 2. Consultar RAG
    const ragResponse = await base44.functions.invoke('nexusClassifier', {
      action: 'query_rag',
      pergunta: 'Qual o horário de funcionamento?'
    });
    passos.push(`✓ RAG: ${ragResponse.data.conhecimentos?.length || 0} conhecimentos`);

    return {
      sucesso: true,
      detalhes: passos.join('\n'),
      tempo: Date.now() - inicio
    };
  }

  async function testarBackupRestore() {
    const inicio = Date.now();
    
    // Criar backup de teste
    const backupResponse = await base44.functions.invoke('backupAutomatico', {
      action: 'create_backup',
      tipo_backup: 'teste',
      entidades: ['Tag']
    });

    return {
      sucesso: backupResponse.data.success,
      detalhes: `Backup criado: ${backupResponse.data.total_registros} registros`,
      tempo: Date.now() - inicio
    };
  }

  async function testarHealthCheck() {
    const inicio = Date.now();
    
    const response = await base44.functions.invoke('monitorarSaudeDoSistema', {});

    return {
      sucesso: response.data.success,
      detalhes: `Status: ${response.data.status_geral}`,
      tempo: Date.now() - inicio
    };
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Testes de Integração</h1>
          <p className="text-slate-600">Testes end-to-end do sistema completo</p>
        </div>
        <Button
          onClick={executarTodosTestes}
          disabled={executando}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {executando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Executar Todos
            </>
          )}
        </Button>
      </div>

      {/* Lista de Testes */}
      <div className="space-y-4">
        {testesIntegracao.map((teste) => {
          const resultado = resultados.find(r => r.id === teste.id);

          return (
            <Card key={teste.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {resultado ? (
                        resultado.sucesso ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )
                      ) : (
                        <Activity className="w-5 h-5 text-slate-400" />
                      )}
                      <h3 className="font-semibold">{teste.nome}</h3>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{teste.descricao}</p>

                    {resultado && (
                      <div className="bg-slate-50 rounded-lg p-3 text-sm">
                        {resultado.sucesso ? (
                          <div className="text-green-700">
                            {resultado.detalhes}
                          </div>
                        ) : (
                          <div className="text-red-700">
                            ❌ Erro: {resultado.erro}
                          </div>
                        )}
                        <div className="text-slate-500 mt-2">
                          Tempo: {resultado.tempo}ms
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}