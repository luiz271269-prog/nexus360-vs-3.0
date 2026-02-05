import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CheckCircle2, RefreshCw, Settings, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracaoSincronizacao({ usuario, onUpdate }) {
  const [config, setConfig] = useState(usuario?.calendar_sync_config || {});
  const [salvando, setSalvando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    if (usuario?.calendar_sync_config) {
      setConfig(usuario.calendar_sync_config);
    }
  }, [usuario?.calendar_sync_config]);

  const handleSalvarConfig = async () => {
    setSalvando(true);
    try {
      await base44.auth.updateMe({ calendar_sync_config: config });
      toast.success('✅ Configurações salvas!');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('❌ Erro ao salvar configurações');
    } finally {
      setSalvando(false);
    }
  };

  const handleAutorizarGoogle = () => {
    toast.info('🔐 Redirecionando para autorização Google...');
    // O app connector do Base44 cuida da autorização
    window.open(base44.agents.getWhatsAppConnectURL('googlecalendar'), '_blank');
  };

  const handleAutorizarOutlook = () => {
    toast.info('🔐 Abrindo autorização Outlook...');
    window.open('/functions/authorizeOutlookCalendar', 'outlook-auth', 'width=600,height=700');
  };

  const handleSincronizarAgora = async () => {
    setSincronizando(true);
    try {
      // Sincronizar Nexus → Calendários
      const syncResult = await base44.functions.invoke('syncScheduleToCalendars', {});
      
      // Importar Calendários → Nexus
      const importResult = await base44.functions.invoke('importFromCalendars', {});
      
      const totalSync = (syncResult.data?.total_synced || 0);
      const totalImport = (importResult.data?.total_imported || 0);
      
      if (totalSync > 0 || totalImport > 0) {
        toast.success(`✅ Sincronizado! ${totalSync} enviados, ${totalImport} importados`);
      } else {
        toast.info('ℹ️ Nenhum evento novo para sincronizar');
      }
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      toast.error('❌ Erro na sincronização');
    } finally {
      setSincronizando(false);
    }
  };

  const handleDesconectarGoogle = async () => {
    if (!confirm('Desconectar Google Calendar? Eventos já sincronizados permanecerão.')) return;
    
    setSalvando(true);
    try {
      await base44.auth.updateMe({
        'calendar_sync_config.google_calendar_enabled': false
      });
      setConfig(prev => ({ ...prev, google_calendar_enabled: false }));
      toast.success('✅ Google Calendar desconectado');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('❌ Erro ao desconectar');
    } finally {
      setSalvando(false);
    }
  };

  const handleDesconectarOutlook = async () => {
    if (!confirm('Desconectar Outlook? Eventos já sincronizados permanecerão.')) return;
    
    setSalvando(true);
    try {
      await base44.auth.updateMe({
        'calendar_sync_config.outlook_calendar_enabled': false,
        'calendar_sync_config.outlook_refresh_token': null
      });
      setConfig(prev => ({ 
        ...prev, 
        outlook_calendar_enabled: false,
        outlook_refresh_token: null 
      }));
      toast.success('✅ Outlook desconectado');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('❌ Erro ao desconectar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Google Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Google Calendar</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Sincronize eventos com Google Calendar</p>
              </div>
            </div>
            {config.google_calendar_enabled && (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Conectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!config.google_calendar_enabled ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-600 mb-4">
                Conecte sua conta Google para sincronização automática de eventos
              </p>
              <Button onClick={handleAutorizarGoogle} className="bg-blue-600 hover:bg-blue-700">
                <Calendar className="w-4 h-4 mr-2" />
                Autorizar Google Calendar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge className="bg-green-100 text-green-700">Ativo</Badge>
              </div>
              {config.last_sync_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Última sincronização</span>
                  <span className="text-sm font-medium">
                    {new Date(config.last_sync_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
              <Button 
                variant="outline" 
                onClick={handleDesconectarGoogle}
                className="w-full text-red-600 hover:bg-red-50"
              >
                Desconectar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outlook Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Outlook Calendar</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Sincronize eventos com Microsoft Outlook</p>
              </div>
            </div>
            {config.outlook_calendar_enabled && (
              <Badge className="bg-purple-100 text-purple-700">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Conectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!config.outlook_calendar_enabled ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-600 mb-4">
                Conecte sua conta Microsoft para sincronização com Outlook
              </p>
              <Button onClick={handleAutorizarOutlook} className="bg-purple-600 hover:bg-purple-700">
                <Calendar className="w-4 h-4 mr-2" />
                Autorizar Outlook Calendar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge className="bg-purple-100 text-purple-700">Ativo</Badge>
              </div>
              {config.last_sync_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Última sincronização</span>
                  <span className="text-sm font-medium">
                    {new Date(config.last_sync_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
              <Button 
                variant="outline" 
                onClick={handleDesconectarOutlook}
                className="w-full text-red-600 hover:bg-red-50"
              >
                Desconectar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configurações de Sincronização */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações de Sincronização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Quais eventos sincronizar</label>
            <Select
              value={config.sync_mode || 'apenas_meus'}
              onValueChange={(value) => setConfig({ ...config, sync_mode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apenas_meus">📌 Apenas meus eventos</SelectItem>
                <SelectItem value="meu_setor">👥 Eventos do meu setor</SelectItem>
                <SelectItem value="todos">🌐 Todos os eventos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Direção da sincronização</label>
            <Select
              value={config.sync_direction || 'bidirectional'}
              onValueChange={(value) => setConfig({ ...config, sync_direction: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bidirectional">↔️ Bidirecional (recomendado)</SelectItem>
                <SelectItem value="nexus_to_calendar">→ Apenas Nexus → Calendário</SelectItem>
                <SelectItem value="calendar_to_nexus">← Apenas Calendário → Nexus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 border-t space-y-2">
            <Button 
              onClick={handleSalvarConfig} 
              disabled={salvando}
              className="w-full"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Configurações'
              )}
            </Button>
            
            {(config.google_calendar_enabled || config.outlook_calendar_enabled) && (
              <Button 
                onClick={handleSincronizarAgora}
                disabled={sincronizando}
                variant="outline"
                className="w-full"
              >
                {sincronizando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sincronizar Agora
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Avisos */}
      {!config.google_calendar_enabled && !config.outlook_calendar_enabled && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Sincronização de calendário não configurada
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Conecte Google Calendar ou Outlook para sincronizar automaticamente seus eventos da Agenda IA Nexus.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}