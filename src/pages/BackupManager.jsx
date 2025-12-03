import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Trash2, 
  Plus,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [restaurando, setRestaurando] = useState(null);

  useEffect(() => {
    carregarBackups();
  }, []);

  const carregarBackups = async () => {
    try {
      setLoading(true);
      const response = await base44.functions.invoke('backupAutomatico', {
        action: 'list_backups',
        limit: 50
      });

      if (response.data.success) {
        setBackups(response.data.backups);
      }
    } catch (error) {
      console.error('Erro ao carregar backups:', error);
      toast.error('Erro ao carregar lista de backups');
    } finally {
      setLoading(false);
    }
  };

  const handleCriarBackup = async () => {
    try {
      setCriando(true);
      
      const response = await base44.functions.invoke('backupAutomatico', {
        action: 'create_backup',
        tipo_backup: 'manual',
        notas: `Backup manual criado em ${new Date().toLocaleString('pt-BR')}`
      });

      if (response.data.success) {
        toast.success('✅ Backup criado com sucesso!');
        await carregarBackups();
      }
    } catch (error) {
      console.error('Erro ao criar backup:', error);
      toast.error('Erro ao criar backup');
    } finally {
      setCriando(false);
    }
  };

  const handleRestaurar = async (backupId) => {
    if (!confirm('⚠️ ATENÇÃO: A restauração irá criar registros duplicados. Deseja continuar?')) {
      return;
    }

    try {
      setRestaurando(backupId);
      
      const response = await base44.functions.invoke('backupAutomatico', {
        action: 'restore_backup',
        backup_id: backupId
      });

      if (response.data.success) {
        toast.success('✅ Backup restaurado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao restaurar backup:', error);
      toast.error('Erro ao restaurar backup');
    } finally {
      setRestaurando(null);
    }
  };

  const handleDeletar = async (backupId) => {
    if (!confirm('Tem certeza que deseja deletar este backup?')) {
      return;
    }

    try {
      const response = await base44.functions.invoke('backupAutomatico', {
        action: 'delete_backup',
        backup_id: backupId
      });

      if (response.data.success) {
        toast.success('Backup deletado');
        await carregarBackups();
      }
    } catch (error) {
      console.error('Erro ao deletar backup:', error);
      toast.error('Erro ao deletar backup');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciador de Backups</h1>
          <p className="text-slate-600">Crie e restaure backups do sistema</p>
        </div>
        <Button
          onClick={handleCriarBackup}
          disabled={criando}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {criando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Criando...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Novo Backup
            </>
          )}
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">⚠️ Importante sobre Restauração:</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>A restauração cria NOVOS registros, não substitui os existentes</li>
                <li>Pode gerar duplicatas se os registros originais ainda existirem</li>
                <li>Use apenas para recuperação de dados perdidos</li>
                <li>Backups expiram automaticamente após 90 dias</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Backups */}
      <div className="space-y-4">
        {backups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <HardDrive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Nenhum backup encontrado</p>
            </CardContent>
          </Card>
        ) : (
          backups.map((backup) => (
            <Card key={backup.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant={backup.status === 'sucesso' ? 'default' : 'destructive'}>
                        {backup.tipo_backup}
                      </Badge>
                      {backup.pode_restaurar ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Data</p>
                        <p className="font-semibold">
                          {new Date(backup.data_backup).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Registros</p>
                        <p className="font-semibold">{backup.total_registros.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Tamanho</p>
                        <p className="font-semibold">{backup.tamanho_mb} MB</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Expira em</p>
                        <p className="font-semibold">
                          {new Date(backup.expira_em).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    {backup.notas && (
                      <p className="text-sm text-slate-600 mt-3">{backup.notas}</p>
                    )}

                    <div className="flex flex-wrap gap-1 mt-3">
                      {backup.entidades_incluidas?.map((entidade) => (
                        <Badge key={entidade} variant="outline" className="text-xs">
                          {entidade}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestaurar(backup.id)}
                      disabled={!backup.pode_restaurar || restaurando === backup.id}
                    >
                      {restaurando === backup.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeletar(backup.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}