import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getMapaClientes } from '@/functions/getMapaClientes';
import { coordenadaPara } from '@/components/mapa/coordenadasBR';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Users, Building2, AlertTriangle, Loader2, DollarSign, FileText } from 'lucide-react';

const fmtMoeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtMes = (m) => {
  if (!m) return 'Todos os meses';
  const [ano, mes] = m.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[parseInt(mes, 10) - 1]}/${ano}`;
};

export default function MapaClientes() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [mes, setMes] = useState('todos');

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    (async () => {
      try {
        const payload = mes === 'todos' ? {} : { mes_referencia: mes };
        const res = await getMapaClientes(payload);
        if (ativo) setDados(res.data);
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => { ativo = false; };
  }, [mes]);

  if (erro) {
    return (
      <div className="p-8 text-red-600 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" /> {erro}
      </div>
    );
  }

  const ufEntries = dados ? Object.entries(dados.porUF || {}).sort((a, b) => b[1] - a[1]) : [];
  const pontos = dados
    ? (dados.cidades || [])
        .map(c => ({ ...c, coord: coordenadaPara(c.cidade, c.uf) }))
        .filter(c => c.coord)
    : [];
  const maxValor = Math.max(1, ...pontos.map(p => p.valor));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mapa de Vendas por Localização</h1>
            <p className="text-sm text-slate-500">Baseado nas Notas Fiscais emitidas (Neural Fin Flow), mês a mês.</p>
          </div>
        </div>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {(dados?.meses || []).map(m => (
              <SelectItem key={m} value={m}>{fmtMes(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading || !dados ? (
        <div className="flex items-center justify-center h-[50vh] gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" /> Carregando dados de vendas...
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm"><DollarSign className="w-4 h-4" /> Faturamento</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">{fmtMoeda(dados.faturamento)}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm"><FileText className="w-4 h-4" /> Notas fiscais</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{dados.totalNotas}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm"><Building2 className="w-4 h-4" /> Clientes</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{dados.clientesUnicos}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm"><MapPin className="w-4 h-4" /> Localizados</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{dados.comLocalizacao}</div>
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
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {pontos.map((p, i) => (
                  <CircleMarker
                    key={i}
                    center={p.coord}
                    radius={8 + (p.valor / maxValor) * 24}
                    pathOptions={{ color: '#ea580c', fillColor: '#f97316', fillOpacity: 0.55, weight: 2 }}
                  >
                    <Tooltip direction="top">{p.cidade}/{p.uf} — {fmtMoeda(p.valor)}</Tooltip>
                    <Popup>
                      <div className="text-sm">
                        <div className="font-bold mb-1">{p.cidade}/{p.uf} · {fmtMoeda(p.valor)}</div>
                        <ul className="space-y-0.5 max-h-40 overflow-auto">
                          {p.clientes.map((c, j) => (
                            <li key={j} className="text-xs">
                              <span className="font-medium">{c.nome}</span>
                              <span className="text-slate-500"> · {fmtMoeda(c.valor)} ({c.notas} NF)</span>
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
                    <Badge className="bg-emerald-600">{fmtMoeda(c.valor)}</Badge>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {c.clientes.slice(0, 5).map((cl, j) => (
                      <li key={j} className="text-xs text-slate-600 truncate">
                        {cl.nome} <span className="text-slate-400">· {fmtMoeda(cl.valor)}</span>
                      </li>
                    ))}
                    {c.clientes.length > 5 && <li className="text-xs text-slate-400">+{c.clientes.length - 5} mais</li>}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          {/* Clientes sem localização — gargalo do cadastro */}
          {dados.clientesSemLocalizacao.length > 0 && (
            <Card className="p-4 border-amber-200 bg-amber-50/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h2 className="font-bold text-slate-900">
                  {dados.clientesSemLocalizacao.length} clientes vendidos sem cidade/UF cadastrada
                </h2>
              </div>
              <p className="text-sm text-slate-500 mb-3">
                Estes clientes têm notas fiscais emitidas mas ainda não aparecem no mapa porque não têm localização no cadastro. Complete a cidade/UF deles para entrarem na visualização.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-auto">
                {dados.clientesSemLocalizacao.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.nome}</p>
                      <p className="text-xs text-slate-400">{c.vendedor} · {c.notas} NF</p>
                    </div>
                    <Badge variant="outline" className="text-emerald-700 border-emerald-200 shrink-0 ml-2">{fmtMoeda(c.valor)}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}