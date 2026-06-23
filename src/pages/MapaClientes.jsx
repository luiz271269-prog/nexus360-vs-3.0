import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapaClientes } from '@/functions/getMapaClientes';
import { coordenadaPara } from '@/components/mapa/coordenadasBR';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, Building2, AlertTriangle, Loader2 } from 'lucide-react';

export default function MapaClientes() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getMapaClientes({});
        setDados(res.data);
      } catch (e) {
        setErro(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin" /> Carregando mapa de clientes...
      </div>
    );
  }

  if (erro) {
    return (
      <div className="p-8 text-red-600 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" /> {erro}
      </div>
    );
  }

  const ufEntries = Object.entries(dados.porUF || {}).sort((a, b) => b[1] - a[1]);
  // Pontos para o mapa: uma circle por cidade com coordenada conhecida
  const pontos = (dados.cidades || [])
    .map(c => ({ ...c, coord: coordenadaPara(c.cidade, c.uf) }))
    .filter(c => c.coord);
  const maxTotal = Math.max(1, ...pontos.map(p => p.total));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
          <MapPin className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mapa de Localização de Clientes</h1>
          <p className="text-sm text-slate-500">Distribuição por estado e cidade, com responsável de cada cliente.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm"><Building2 className="w-4 h-4" /> Total de clientes</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{dados.total}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm"><MapPin className="w-4 h-4" /> Com localização</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{dados.comLocalizacao}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm"><Users className="w-4 h-4" /> Estados (UF)</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{ufEntries.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm"><AlertTriangle className="w-4 h-4" /> Sem localização</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{dados.semLocalizacao}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mapa */}
        <Card className="lg:col-span-2 p-0 overflow-hidden h-[520px]">
          <MapContainer center={[-27.5, -50.0]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {pontos.map((p, i) => (
              <CircleMarker
                key={i}
                center={p.coord}
                radius={8 + (p.total / maxTotal) * 22}
                pathOptions={{ color: '#ea580c', fillColor: '#f97316', fillOpacity: 0.55, weight: 2 }}
              >
                <Tooltip direction="top">{p.cidade}/{p.uf} — {p.total} cliente(s)</Tooltip>
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold mb-1">{p.cidade}/{p.uf} ({p.total})</div>
                    <ul className="space-y-0.5 max-h-40 overflow-auto">
                      {p.clientes.map((c, j) => (
                        <li key={j} className="text-xs">
                          <span className="font-medium">{c.nome}</span>
                          <span className="text-slate-500"> · {c.vendedor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </Card>

        {/* Distribuição por UF */}
        <Card className="p-4">
          <h2 className="font-bold text-slate-900 mb-3">Por estado</h2>
          <div className="space-y-2">
            {ufEntries.length === 0 && <p className="text-sm text-slate-400">Nenhum estado com dados.</p>}
            {ufEntries.map(([uf, count]) => {
              const max = ufEntries[0][1];
              return (
                <div key={uf} className="flex items-center gap-2">
                  <Badge variant="outline" className="w-10 justify-center font-bold">{uf}</Badge>
                  <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-400 to-red-500" style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Ranking por cidade */}
      <Card className="p-4">
        <h2 className="font-bold text-slate-900 mb-3">Cidades ({dados.cidades.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dados.cidades.map((c, i) => (
            <div key={i} className="border rounded-lg p-3 bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{c.cidade}/{c.uf}</span>
                <Badge className="bg-orange-500">{c.total}</Badge>
              </div>
              <ul className="mt-2 space-y-0.5">
                {c.clientes.slice(0, 5).map((cl, j) => (
                  <li key={j} className="text-xs text-slate-600 truncate">
                    {cl.nome} <span className="text-slate-400">· {cl.vendedor}</span>
                  </li>
                ))}
                {c.clientes.length > 5 && <li className="text-xs text-slate-400">+{c.clientes.length - 5} mais</li>}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}