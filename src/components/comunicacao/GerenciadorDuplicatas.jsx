import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Loader2, Users, AlertTriangle, CheckCircle2, Merge, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { normalizarTelefone } from '../lib/phoneUtils';

export default function GerenciadorDuplicatas() {
  const [buscando, setBuscando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [duplicatas, setDuplicatas] = useState([]);
  const [stats, setStats] = useState(null);

  const buscarDuplicatas = async () => {
    setBuscando(true);
    try {
      const contatos = await base44.entities.Contact.list('-created_date', 2000);
      
      // Agrupar por telefone normalizado
      const grupos = new Map();
      let semTelefone = 0;
      
      for (const contato of contatos) {
        if (!contato.telefone) {
          semTelefone++;
          continue;
        }
        
        const normalizado = normalizarTelefone(contato.telefone);
        if (!normalizado) continue;
        
        const chave = `${normalizado}|${contato.conexao_origem || 'GLOBAL'}`;
        
        if (!grupos.has(chave)) {
          grupos.set(chave, []);
        }
        grupos.get(chave).push(contato);
      }
      
      // Filtrar apenas grupos com duplicatas
      const gruposDuplicados = Array.from(grupos.entries())
        .filter(([_, contatos]) => contatos.length > 1)
        .map(([telefone, contatos]) => ({
          telefone: telefone.split('|')[0],
          conexao: telefone.split('|')[1],
          contatos: contatos.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        }));
      
      setDuplicatas(gruposDuplicados);
      setStats({
        total_contatos: contatos.length,
        sem_telefone: semTelefone,
        grupos_duplicados: gruposDuplicados.length,
        total_duplicatas: gruposDuplicados.reduce((sum, g) => sum + g.contatos.length - 1, 0)
      });
      
      toast.success(`✅ ${gruposDuplicados.length} grupos duplicados encontrados`);
    } catch (error) {
      console.error('[GerenciadorDuplicatas] Erro:', error);
      toast.error('Erro ao buscar duplicatas');
    } finally {
      setBuscando(false);
    }
  };

  const limparAutomaticamente = async () => {
    if (!confirm(`⚠️ Consolidar ${stats.grupos_duplicados} grupos de duplicatas?\n\nEsta ação vai:\n- Manter o contato mais completo\n- Redirecionar threads/mensagens\n- Marcar duplicatas como "merged"\n\nDeseja continuar?`)) {
      return;
    }

    setLimpando(true);
    try {
      // Usar função backend existente
      const response = await base44.functions.invoke('limparContatosDuplicados', {});
      
      if (response.success) {
        toast.success(`✅ ${response.stats.contacts_merged} duplicatas consolidadas!`);
        await buscarDuplicatas(); // Atualizar lista
      } else {
        toast.error(`❌ ${response.error}`);
      }
    } catch (error) {
      console.error('[GerenciadorDuplicatas] Erro na limpeza:', error);
      toast.error('Erro ao limpar duplicatas');
    } finally {
      setLimpando(false);
    }
  };

  const consolidarGrupo = async (grupo) => {
    if (!confirm(`Consolidar ${grupo.contatos.length} registros deste telefone?`)) return;

    try {
      // Escolher principal (mais antigo, mais completo)
      const principal = grupo.contatos.reduce((best, curr) => {
        const tipoOrder = { cliente: 4, lead: 3, parceiro: 2, fornecedor: 1, novo: 0 };
        const bestTipo = tipoOrder[best.tipo_contato] || 0;
        const currTipo = tipoOrder[curr.tipo_contato] || 0;
        if (currTipo > bestTipo) return curr;
        if (currTipo < bestTipo) return best;
        return new Date(curr.created_date) < new Date(best.created_date) ? curr : best;
      });

      // Processar duplicatas
      for (const duplicata of grupo.contatos) {
        if (duplicata.id === principal.id) continue;

        // Redirecionar threads
        const threads = await base44.entities.MessageThread.filter({ contact_id: duplicata.id });
        for (const thread of threads) {
          await base44.entities.MessageThread.update(thread.id, { contact_id: principal.id });
        }

        // Redirecionar mensagens
        const mensagens = await base44.entities.Message.filter({
          sender_id: duplicata.id,
          sender_type: 'contact'
        });
        for (const msg of mensagens) {
          await base44.entities.Message.update(msg.id, { sender_id: principal.id });
        }

        // Marcar como merged
        await base44.entities.Contact.update(duplicata.id, {
          tipo_contato: 'novo',
          tags: [...(duplicata.tags || []), 'merged', 'duplicata'],
          observacoes: `[MERGED] Consolidado em ${principal.id} em ${new Date().toISOString()}\n\n${duplicata.observacoes || ''}`
        });
      }

      toast.success(`✅ Grupo consolidado em: ${principal.nome}`);
      await buscarDuplicatas(); // Atualizar
    } catch (error) {
      console.error('[GerenciadorDuplicatas] Erro ao consolidar:', error);
      toast.error('Erro ao consolidar grupo');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gerenciador de Duplicatas</h2>
          <p className="text-sm text-slate-500 mt-1">Consolidar contatos duplicados por telefone</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={buscarDuplicatas}
            disabled={buscando}
            variant="outline"
          >
            {buscando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            Buscar Duplicatas
          </Button>
          {duplicatas.length > 0 && (
            <Button
              onClick={limparAutomaticamente}
              disabled={limpando}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {limpando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Merge className="w-4 h-4 mr-2" />}
              Consolidar Todas
            </Button>
          )}
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total de Contatos</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total_contatos}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Grupos Duplicados</p>
                <p className="text-2xl font-bold text-orange-600">{stats.grupos_duplicados}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Duplicatas</p>
                <p className="text-2xl font-bold text-red-600">{stats.total_duplicatas}</p>
              </div>
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Sem Telefone</p>
                <p className="text-2xl font-bold text-slate-400">{stats.sem_telefone}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-slate-400" />
            </div>
          </Card>
        </div>
      )}

      {/* Lista de Duplicatas */}
      <div className="space-y-4">
        {duplicatas.length === 0 && stats && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <div className="ml-2">
              <p className="font-semibold text-green-900">Nenhuma duplicata encontrada</p>
              <p className="text-sm text-green-700">Todos os contatos estão únicos.</p>
            </div>
          </Alert>
        )}

        {duplicatas.map((grupo, idx) => (
          <Card key={idx} className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-mono font-semibold text-lg text-slate-900">{grupo.telefone}</p>
                <p className="text-sm text-slate-500">
                  {grupo.contatos.length} registros • Conexão: {grupo.conexao}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => consolidarGrupo(grupo)}
                className="text-orange-600 border-orange-600 hover:bg-orange-50"
              >
                <Merge className="w-4 h-4 mr-1" />
                Consolidar
              </Button>
            </div>

            <div className="space-y-2">
              {grupo.contatos.map((contato, cIdx) => (
                <div
                  key={contato.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    cIdx === 0 ? 'bg-green-50 border border-green-200' : 'bg-slate-50'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{contato.nome || 'Sem nome'}</p>
                      {cIdx === 0 && <Badge className="bg-green-600">Principal</Badge>}
                      <Badge variant="outline">{contato.tipo_contato}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{contato.empresa || 'Sem empresa'}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Criado: {new Date(contato.created_date).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {cIdx > 0 && (
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      Duplicata
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}