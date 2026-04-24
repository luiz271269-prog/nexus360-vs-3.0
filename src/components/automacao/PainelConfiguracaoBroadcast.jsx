import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Save, RefreshCw, Clock, Shield, AlertTriangle, Ban } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULTS = {
  nome_config: 'default',
  ativo: true,
  horario_inicio: 8,
  horario_fim: 20,
  enviar_fim_semana: false,
  tier_novo_max_dia: 30,
  tier_aquecendo_max_dia: 80,
  tier_maduro_max_dia: 150,
  tier_novo_janela_min: 240,
  tier_aquecendo_janela_min: 180,
  tier_maduro_janela_min: 120,
  delay_min_segundos: 4,
  delay_max_segundos: 15,
  pausa_a_cada_n_envios: 10,
  pausa_duracao_segundos: 30,
  saturacao_max_bloqueios_24h: 3,
  palavras_opt_out: ['pare', 'parar', 'remover', 'cancelar', 'descadastrar', 'sair', 'nao quero', 'não quero', 'stop', 'chega'],
  auto_pausar_em_429: true,
  pausa_429_minutos: 30,
  pausa_403_minutos: 120
};

export default function PainelConfiguracaoBroadcast() {
  const [config, setConfig] = useState(DEFAULTS);
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const lista = await base44.entities.BroadcastConfig.filter({ nome_config: 'default' });
      if (lista.length > 0) {
        setConfig({ ...DEFAULTS, ...lista[0] });
        setConfigId(lista[0].id);
      } else {
        setConfig(DEFAULTS);
        setConfigId(null);
      }
    } catch (e) {
      console.error('[PainelConfigBroadcast]', e);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    setSaving(true);
    try {
      if (configId) {
        await base44.entities.BroadcastConfig.update(configId, config);
      } else {
        const novo = await base44.entities.BroadcastConfig.create(config);
        setConfigId(novo.id);
      }
      toast.success('✅ Configurações salvas!');
    } catch (e) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const restaurarPadrao = () => {
    setConfig({ ...DEFAULTS, ...(configId ? { id: configId } : {}) });
    toast.info('Valores padrão restaurados (lembre de salvar)');
  };

  const atualizarPalavras = (texto) => {
    const palavras = texto.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    setConfig({ ...config, palavras_opt_out: palavras });
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold">Configurações de Broadcast</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={restaurarPadrao}>
            Restaurar padrão
          </Button>
          <Button size="sm" onClick={salvar} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* HORÁRIO COMERCIAL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            Horário permitido para envio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Hora início (0-23)</Label>
              <Input type="number" min="0" max="23" value={config.horario_inicio}
                onChange={e => setConfig({ ...config, horario_inicio: parseInt(e.target.value) || 8 })} />
            </div>
            <div>
              <Label className="text-xs">Hora fim (1-24)</Label>
              <Input type="number" min="1" max="24" value={config.horario_fim}
                onChange={e => setConfig({ ...config, horario_fim: parseInt(e.target.value) || 20 })} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Permitir envio em fins de semana</Label>
            <Switch checked={config.enviar_fim_semana}
              onCheckedChange={v => setConfig({ ...config, enviar_fim_semana: v })} />
          </div>
        </CardContent>
      </Card>

      {/* LIMITES POR TIER */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            Limites diários por tier de integração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Novo (&lt;7d)</Label>
              <Input type="number" value={config.tier_novo_max_dia}
                onChange={e => setConfig({ ...config, tier_novo_max_dia: parseInt(e.target.value) || 30 })} />
              <p className="text-[10px] text-slate-500 mt-1">msgs/dia</p>
            </div>
            <div>
              <Label className="text-xs">Aquecendo (&lt;30d)</Label>
              <Input type="number" value={config.tier_aquecendo_max_dia}
                onChange={e => setConfig({ ...config, tier_aquecendo_max_dia: parseInt(e.target.value) || 80 })} />
              <p className="text-[10px] text-slate-500 mt-1">msgs/dia</p>
            </div>
            <div>
              <Label className="text-xs">Maduro</Label>
              <Input type="number" value={config.tier_maduro_max_dia}
                onChange={e => setConfig({ ...config, tier_maduro_max_dia: parseInt(e.target.value) || 150 })} />
              <p className="text-[10px] text-slate-500 mt-1">msgs/dia</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div>
              <Label className="text-xs">Janela novo (min)</Label>
              <Input type="number" value={config.tier_novo_janela_min}
                onChange={e => setConfig({ ...config, tier_novo_janela_min: parseInt(e.target.value) || 240 })} />
            </div>
            <div>
              <Label className="text-xs">Janela aquec. (min)</Label>
              <Input type="number" value={config.tier_aquecendo_janela_min}
                onChange={e => setConfig({ ...config, tier_aquecendo_janela_min: parseInt(e.target.value) || 180 })} />
            </div>
            <div>
              <Label className="text-xs">Janela maduro (min)</Label>
              <Input type="number" value={config.tier_maduro_janela_min}
                onChange={e => setConfig({ ...config, tier_maduro_janela_min: parseInt(e.target.value) || 120 })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DELAYS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Delays humanizados entre envios
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Delay mín (seg)</Label>
            <Input type="number" value={config.delay_min_segundos}
              onChange={e => setConfig({ ...config, delay_min_segundos: parseInt(e.target.value) || 4 })} />
          </div>
          <div>
            <Label className="text-xs">Delay máx (seg)</Label>
            <Input type="number" value={config.delay_max_segundos}
              onChange={e => setConfig({ ...config, delay_max_segundos: parseInt(e.target.value) || 15 })} />
          </div>
          <div>
            <Label className="text-xs">Pausa a cada N envios</Label>
            <Input type="number" value={config.pausa_a_cada_n_envios}
              onChange={e => setConfig({ ...config, pausa_a_cada_n_envios: parseInt(e.target.value) || 10 })} />
          </div>
          <div>
            <Label className="text-xs">Duração da pausa (seg)</Label>
            <Input type="number" value={config.pausa_duracao_segundos}
              onChange={e => setConfig({ ...config, pausa_duracao_segundos: parseInt(e.target.value) || 30 })} />
          </div>
        </CardContent>
      </Card>

      {/* SATURAÇÃO & 429 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            Proteção anti-ban
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Auto-pausar integração ao receber 429 (rate-limit)</Label>
            <Switch checked={config.auto_pausar_em_429}
              onCheckedChange={v => setConfig({ ...config, auto_pausar_em_429: v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Máx bloqueios 24h</Label>
              <Input type="number" value={config.saturacao_max_bloqueios_24h}
                onChange={e => setConfig({ ...config, saturacao_max_bloqueios_24h: parseInt(e.target.value) || 3 })} />
            </div>
            <div>
              <Label className="text-xs">Pausa por 429 (min)</Label>
              <Input type="number" value={config.pausa_429_minutos}
                onChange={e => setConfig({ ...config, pausa_429_minutos: parseInt(e.target.value) || 30 })} />
            </div>
            <div>
              <Label className="text-xs">Pausa por 403 (min)</Label>
              <Input type="number" value={config.pausa_403_minutos}
                onChange={e => setConfig({ ...config, pausa_403_minutos: parseInt(e.target.value) || 120 })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OPT-OUT */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-600" />
            Palavras que disparam opt-out automático
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-xs">Separadas por vírgula (min. 3 caracteres cada)</Label>
          <Textarea
            rows={3}
            value={(config.palavras_opt_out || []).join(', ')}
            onChange={e => atualizarPalavras(e.target.value)}
            placeholder="pare, parar, remover, cancelar, stop"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Quando o contato enviar qualquer dessas palavras isoladas, recebe tag <code className="bg-slate-100 px-1 rounded">opt_out</code> e é bloqueado para broadcasts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}