import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, MessageSquare, Search, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const TIPOS = {
  contato: {
    label: "Etiquetas de Contato",
    icon: Tag,
    fn: "unificarEtiquetasContato",
    iconColor: "text-purple-600",
    badgeColor: "bg-purple-600 text-white",
    btnColor: "bg-purple-600 hover:bg-purple-700",
    chaveAtualizadas: "contatos_atualizados",
    rotuloAtualizadas: "contatos atualizados",
  },
  conversa: {
    label: "Etiquetas de Conversa",
    icon: MessageSquare,
    fn: "unificarEtiquetasConversa",
    iconColor: "text-blue-600",
    badgeColor: "bg-blue-600 text-white",
    btnColor: "bg-blue-600 hover:bg-blue-700",
    chaveAtualizadas: "threads_atualizadas",
    rotuloAtualizadas: "conversas atualizadas",
  },
};

function PainelDedup({ config, isAdmin }) {
  const Icon = config.icon;
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [aplicando, setAplicando] = useState(false);

  const analisar = async () => {
    setCarregando(true);
    setResultado(null);
    try {
      const { data } = await base44.functions.invoke(config.fn, { dry_run: true });
      setResultado(data);
    } catch (e) {
      toast.error("Erro ao analisar duplicatas");
    } finally {
      setCarregando(false);
    }
  };

  const aplicar = async () => {
    if (!confirm("Aplicar a unificação? As etiquetas duplicadas serão fundidas (irreversível).")) return;
    setAplicando(true);
    try {
      const { data } = await base44.functions.invoke(config.fn, { dry_run: false });
      if (data.success) {
        const qtd = data[config.chaveAtualizadas] ?? 0;
        toast.success(`✅ ${data.etiquetas_removidas} etiquetas removidas • ${qtd} ${config.rotuloAtualizadas}`);
        await analisar();
      } else {
        toast.error(data.error || "Erro ao aplicar");
      }
    } catch (e) {
      toast.error("Erro ao aplicar unificação");
    } finally {
      setAplicando(false);
    }
  };

  const temDuplicatas = resultado?.planos?.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-500">
          Funde etiquetas iguais (acento, maiúscula, plural) <strong>dentro do mesmo setor</strong>.
        </p>
        <Button onClick={analisar} disabled={carregando} variant="outline">
          {carregando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Analisar duplicatas
        </Button>
      </div>

      {resultado && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
            <span className="font-semibold text-slate-800">
              {resultado.total_etiquetas} etiquetas analisadas
            </span>
            <Badge variant={temDuplicatas ? "destructive" : "secondary"}>
              {resultado.grupos_duplicados} grupo(s) duplicado(s)
            </Badge>
          </div>

          {!temDuplicatas ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm py-2">
              <CheckCircle2 className="w-4 h-4" /> Nenhuma duplicata encontrada. Base limpa.
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {resultado.planos.map((p, i) => (
                  <div key={i} className="border rounded-lg p-3 bg-amber-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <Badge variant="outline" className="text-[10px] uppercase">{p.setor}</Badge>
                      <code className="text-xs text-slate-500">{p.slug}</code>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      {p.perdedores.map((perd) => (
                        <Badge key={perd.id} variant="secondary" className="line-through opacity-60">
                          {perd.label} ({perd.uso_count})
                        </Badge>
                      ))}
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <Badge className={config.badgeColor}>
                        {p.vencedor.label} ({p.vencedor.uso_count})
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {isAdmin ? (
                <Button onClick={aplicar} disabled={aplicando} className={config.btnColor}>
                  {aplicando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Aplicar unificação
                </Button>
              ) : (
                <p className="text-xs text-slate-500">Apenas administradores podem aplicar a unificação.</p>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}

export default function DeduplicadorEtiquetas({ usuarioAtual }) {
  const isAdmin = usuarioAtual?.role === 'admin';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="w-5 h-5 text-slate-700" />
        <h3 className="font-semibold text-slate-800">Deduplicação de Etiquetas</h3>
      </div>

      <Tabs defaultValue="contato">
        <TabsList>
          <TabsTrigger value="contato"><Tag className="w-3.5 h-3.5 mr-1.5" /> Contatos</TabsTrigger>
          <TabsTrigger value="conversa"><MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Conversas</TabsTrigger>
        </TabsList>
        <TabsContent value="contato" className="mt-4">
          <PainelDedup config={TIPOS.contato} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="conversa" className="mt-4">
          <PainelDedup config={TIPOS.conversa} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}