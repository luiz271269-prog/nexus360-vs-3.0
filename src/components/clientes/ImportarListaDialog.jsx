import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const somenteDigitos = (s) => (s || '').replace(/\D/g, '');

/**
 * Importa clientes para uma ListaVendedor a partir de CSV/Excel/PDF.
 * Faz o match por CNPJ ou nome contra os clientes cadastrados;
 * itens não encontrados são mantidos como "itens importados" na lista.
 */
export default function ImportarListaDialog({ open, onClose, lista, clientes = [], onConfirm }) {
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null); // { encontrados: [ids], naoEncontrados: [{...}] }

  const handleArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessando(true);
    setResultado(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const extracao = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            registros: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  cnpj: { type: "string" },
                  telefone: { type: "string" },
                  cidade: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (extracao.status !== 'success') {
        toast.error('Não foi possível ler o arquivo: ' + (extracao.details || 'formato inválido'));
        return;
      }

      const registros = extracao.output?.registros || (Array.isArray(extracao.output) ? extracao.output : []);
      if (registros.length === 0) {
        toast.error('Nenhum registro encontrado no arquivo.');
        return;
      }

      // Match contra clientes cadastrados
      const porCnpj = new Map();
      clientes.forEach(c => { const d = somenteDigitos(c.cnpj); if (d) porCnpj.set(d, c); });

      const encontrados = [];
      const naoEncontrados = [];
      registros.forEach(r => {
        const cnpjD = somenteDigitos(r.cnpj);
        let match = cnpjD ? porCnpj.get(cnpjD) : null;
        if (!match && r.nome) {
          const q = r.nome.toLowerCase().trim();
          match = clientes.find(c =>
            c.razao_social?.toLowerCase().includes(q) ||
            c.nome_fantasia?.toLowerCase().includes(q) ||
            q.includes((c.razao_social || '').toLowerCase())
          );
        }
        if (match) {
          encontrados.push(match.id);
        } else {
          naoEncontrados.push({
            nome: r.nome || '',
            cnpj: r.cnpj || '',
            telefone: r.telefone || '',
            cidade: r.cidade || ''
          });
        }
      });

      setResultado({ encontrados: [...new Set(encontrados)], naoEncontrados });
    } catch (err) {
      console.error('Erro na importação:', err);
      toast.error('Erro ao processar o arquivo');
    } finally {
      setProcessando(false);
      e.target.value = '';
    }
  };

  const handleConfirmar = () => {
    onConfirm(resultado.encontrados, resultado.naoEncontrados);
    setResultado(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setResultado(null); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Importar para "{lista?.nome}"
          </DialogTitle>
        </DialogHeader>

        {!resultado ? (
          <label className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${processando ? 'border-slate-200 bg-slate-50' : 'border-blue-300 hover:bg-blue-50'}`}>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.pdf"
              className="hidden"
              onChange={handleArquivo}
              disabled={processando}
            />
            {processando ? (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-sm">Lendo e cruzando com o cadastro...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <Upload className="w-8 h-8 text-blue-500" />
                <span className="font-medium">Clique para escolher o arquivo</span>
                <span className="text-xs text-slate-400">CSV, Excel ou PDF com nome, CNPJ e telefone</span>
              </div>
            )}
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800">
                <b>{resultado.encontrados.length}</b> vinculado(s) a clientes cadastrados
              </span>
            </div>
            {resultado.naoEncontrados.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-800 mb-2">
                  <b>{resultado.naoEncontrados.length}</b> não encontrado(s) no cadastro — serão mantidos como itens importados:
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {resultado.naoEncontrados.slice(0, 20).map((r, i) => (
                    <Badge key={i} variant="outline" className="mr-1 text-xs">{r.nome || r.cnpj || r.telefone}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setResultado(null); onClose(); }}>Cancelar</Button>
          {resultado && (
            <Button onClick={handleConfirmar} className="bg-green-600 hover:bg-green-700 text-white">
              Adicionar à lista
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}