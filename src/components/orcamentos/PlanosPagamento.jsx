
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  Trash2, 
  Calculator, 
  CreditCard, 
  DollarSign, 
  Banknote, 
  Smartphone,
  Calendar,
  CheckCircle,
  X,
  Edit3,
  Loader2,
  Save
} from 'lucide-react';
import { PlanosPagamento as PlanosPagamentoEntity } from '@/entities/PlanosPagamento';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Configurações das formas de pagamento, como descrito.
const formasPagamentoPadrao = [
  {
    id: 'avista',
    nome: 'À Vista',
    icon: DollarSign,
    tipo: 'avista',
    desconto_avista: 5,
    taxa_juros_mensal: 0,
    parcela_minima: 1,
    parcela_maxima: 1,
  },
  {
    id: 'credito',
    nome: 'Cartão de Crédito',
    icon: CreditCard,
    tipo: 'parcelado',
    taxa_juros_mensal: 2.5,
    parcela_minima: 1,
    parcela_maxima: 12,
    valor_minimo_parcela: 20,
  },
  {
    id: 'bloqueto',
    nome: 'Bloqueto',
    icon: Banknote,
    tipo: 'parcelado',
    taxa_juros_mensal: 1.8,
    parcela_minima: 1,
    parcela_maxima: 24,
    valor_minimo_parcela: 50,
  },
  {
    id: 'carne',
    nome: 'Carnê',
    icon: Calendar,
    tipo: 'parcelado',
    taxa_juros_mensal: 2.2,
    parcela_minima: 2,
    parcela_maxima: 36,
    valor_minimo_parcela: 50,
  },
];

export default function PlanosPagamentoComponent({ orcamentoId, valorTotal, onPlanosChange }) {
  const [formaSelecionada, setFormaSelecionada] = useState(null);
  const [valorEntrada, setValorEntrada] = useState(0);
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [primeiraParcela, setPrimeiraParcela] = useState(new Date().toISOString().slice(0, 10));
  
  const [planosCalculados, setPlanosCalculados] = useState([]);
  const [planosSelecionados, setPlanosSelecionados] = useState([]);
  const [planosSalvos, setPlanosSalvos] = useState([]);
  const [planoEscolhido, setPlanoEscolhido] = useState(null); // Novo estado para plano escolhido

  const [loading, setLoading] = useState(true);

  const loadPlanosSalvos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await PlanosPagamentoEntity.filter({ orcamento_id: orcamentoId });
      setPlanosSalvos(data);
      if (onPlanosChange) onPlanosChange(data.length);
    } catch (error) {
      console.error('Erro ao carregar planos salvos:', error);
    } finally {
      setLoading(false);
    }
  }, [orcamentoId, onPlanosChange]);

  useEffect(() => {
    loadPlanosSalvos();
  }, [loadPlanosSalvos]);
  
  const calcularPlanos = useCallback(() => {
    const valorFinanciado = valorTotal - valorEntrada;
    if (valorFinanciado <= 0 && formaSelecionada?.tipo !== 'avista') {
        setPlanosCalculados([]);
        return;
    }

    let planos = [];

    // Adiciona a opção "À Vista" na tabela de parcelado para comparação
    const formaAvista = formasPagamentoPadrao.find(f => f.id === 'avista');
    const valorComDesconto = valorTotal * (1 - (formaAvista.desconto_avista || 0) / 100);
    planos.push({
      parcelas: 'À Vista',
      entrada: 0,
      valorParcela: valorComDesconto,
      total: valorComDesconto,
      juros: valorComDesconto - valorTotal,
      taxa: `${formaAvista.desconto_avista}% desc.`,
      config: { ...formaAvista, numero_parcelas: 1, valor_entrada: 0 }
    });


    if (formaSelecionada?.tipo === 'parcelado') {
      const taxaMensal = formaSelecionada.taxa_juros_mensal / 100;
      
      for (let i = formaSelecionada.parcela_minima; i <= formaSelecionada.parcela_maxima; i++) {
        if (i === 1 && formaSelecionada.id !== 'credito') continue; // Pula 1x, já que a opção "À Vista" já está lá, a não ser que seja crédito
        let valorParcela;
        if (taxaMensal === 0) {
          valorParcela = valorFinanciado / i;
        } else {
          valorParcela = valorFinanciado * (taxaMensal * Math.pow(1 + taxaMensal, i)) / (Math.pow(1 + taxaMensal, i) - 1);
        }

        if (valorParcela >= (formaSelecionada.valor_minimo_parcela || 0)) {
          const valorTotalCalculado = valorEntrada + (valorParcela * i);
          const jurosTotal = valorTotalCalculado - valorTotal;
          planos.push({
            parcelas: `${i}x`,
            entrada: valorEntrada,
            valorParcela,
            total: valorTotalCalculado,
            juros: jurosTotal,
            taxa: `${formaSelecionada.taxa_juros_mensal}% a.m.`,
            config: { ...formaSelecionada, numero_parcelas: i, valor_entrada: valorEntrada }
          });
        }
      }
    }
    setPlanosCalculados(planos);
  }, [formaSelecionada, valorEntrada, valorTotal]);

  useEffect(() => {
    if (formaSelecionada && valorTotal > 0) {
      calcularPlanos();
    } else {
      setPlanosCalculados([]);
    }
  }, [calcularPlanos, formaSelecionada, valorTotal]);
  
  const handleAdicionarPlano = (planoCalculado) => {
    const nomePlano = `${planoCalculado.parcelas} - ${planoCalculado.config.nome}`;
    const planoParaAdicionar = {
      ...planoCalculado,
      nome_plano: nomePlano,
    };
    setPlanosSelecionados(prev => [...prev, planoParaAdicionar]);
    toast.info(`Plano "${nomePlano}" adicionado à seleção.`);
  };

  const handleRemoverPlanoSelecionado = (index) => {
    setPlanosSelecionados(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSalvarTodosPlanos = async () => {
    if (planosSelecionados.length === 0) {
      toast.warning("Nenhum plano selecionado para salvar.");
      return;
    }

    setLoading(true);
    try {
      const planosParaSalvar = planosSelecionados.map(plano => ({
        orcamento_id: orcamentoId,
        nome_plano: plano.nome_plano,
        forma_pagamento: plano.config.id,
        valor_entrada: plano.entrada,
        numero_parcelas: plano.config.numero_parcelas,
        valor_parcela: plano.valorParcela,
        valor_total_com_juros: plano.total,
        taxa_juros: plano.config.taxa_juros_mensal || 0,
        desconto_avista: plano.config.desconto_avista || 0,
      }));

      await PlanosPagamentoEntity.bulkCreate(planosParaSalvar);
      
      toast.success(`${planosParaSalvar.length} plano(s) salvo(s) com sucesso!`);
      setPlanosSelecionados([]);
      await loadPlanosSalvos();

    } catch (error) {
      console.error("Erro ao salvar planos:", error);
      toast.error("Falha ao salvar os planos selecionados.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoverPlanoSalvo = async (planoId) => {
     if (!confirm("Tem certeza que deseja remover este plano permanentemente?")) return;
     try {
       await PlanosPagamentoEntity.delete(planoId);
       toast.success("Plano removido com sucesso.");
       await loadPlanosSalvos();
       // If the removed plan was the chosen one, clear it
       if (planoEscolhido?.id === planoId) {
         setPlanoEscolhido(null);
       }
     } catch (error) {
       console.error("Erro ao remover plano salvo:", error);
       toast.error("Falha ao remover o plano.");
     }
  };

  const isPlanoselecionado = (planoCalculado) => {
    return planosSelecionados.some(p => 
      p.parcelas === planoCalculado.parcelas && 
      p.config.id === planoCalculado.config.id &&
      p.entrada === planoCalculado.entrada // Also check for entry value to differentiate
    );
  };

  const getIconeFormaPagamento = (formaPagamentoId) => {
    const forma = formasPagamentoPadrao.find(f => f.id === formaPagamentoId);
    return forma ? forma.icon : DollarSign;
  };

  const getCorConfig = (id) => {
    switch(id) {
      case 'avista': return { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700', icon: 'text-green-600' };
      case 'credito': return { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-700', icon: 'text-blue-600' };
      case 'bloqueto': return { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-700', icon: 'text-purple-600' };
      case 'carne': return { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-700', icon: 'text-orange-600' };
      default: return { bg: 'bg-gray-50', border: 'border-gray-500', text: 'text-gray-700', icon: 'text-gray-600' };
    }
  };

  if (valorTotal <= 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Planos de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6 bg-slate-50 rounded-lg">
            <Calculator className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="font-semibold text-slate-600">Adicione itens ao orçamento para calcular os planos de pagamento.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 mt-6">
      {/* Planos Selecionados (Temporários) */}
      {planosSelecionados.length > 0 && (
        <Card className="bg-gradient-to-br from-indigo-600/10 via-purple-600/10 to-pink-600/10 border-2 border-indigo-400/30 backdrop-blur-lg shadow-xl">
           <CardHeader className="flex flex-row items-center justify-between border-b border-indigo-400/20 pb-3">
              <CardTitle className="bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 bg-clip-text text-transparent text-base">Planos Selecionados para Salvar</CardTitle>
              <Button onClick={handleSalvarTodosPlanos} disabled={loading} className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-white font-semibold shadow-lg h-8 text-sm">
                {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />} Salvar Planos
              </Button>
           </CardHeader>
           <CardContent className="pt-3">
             <ul className="space-y-1.5">
               {planosSelecionados.map((plano, i) => (
                 <li key={i} className="flex items-center justify-between p-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-indigo-200/50">
                   <span className="font-semibold text-slate-800 text-sm">{plano.nome_plano}</span>
                   <div className="flex items-center gap-3">
                     <span className="font-bold text-green-600">R$ {plano.total.toFixed(2).replace('.', ',')}</span>
                     <Button variant="ghost" size="icon" onClick={() => handleRemoverPlanoSelecionado(i)} className="hover:bg-red-100 h-7 w-7">
                       <Trash2 className="w-3 h-3 text-red-500"/>
                     </Button>
                   </div>
                 </li>
               ))}
             </ul>
           </CardContent>
        </Card>
      )}

      {/* Layout Principal: Formas de Pagamento (Esquerda) + Planos Ativos (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* ESQUERDA: Formas de Pagamento - CARTÕES PEQUENOS 1x1cm */}
        <div className="lg:col-span-1">
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 shadow-2xl">
            <CardHeader className="border-b border-slate-700/50 pb-2 pt-3 px-3">
              <CardTitle className="flex items-center gap-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 bg-clip-text text-transparent text-sm">
                <DollarSign className="w-4 h-4 text-amber-400" />
                Formas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 px-2 space-y-1.5">
              {formasPagamentoPadrao.map(forma => {
                const Icon = forma.icon;
                const isSelected = formaSelecionada?.id === forma.id;
                const cores = getCorConfig(forma.id);
                
                return (
                  <button 
                    key={forma.id}
                    onClick={() => setFormaSelecionada(forma)}
                    title={forma.nome}
                    className={`w-full p-1.5 border rounded-lg text-left transition-all duration-200 hover:scale-105 ${
                      isSelected 
                        ? `${cores.bg} ${cores.border} ring-1 ${cores.border.replace('border-', 'ring-')} shadow-md` 
                        : `bg-slate-800/50 border-slate-600 hover:${cores.bg} hover:${cores.border}`
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${cores.bg} flex-shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${cores.icon}`} />
                      </div>
                      <span className={`font-semibold text-[10px] ${isSelected ? cores.text : 'text-slate-200'}`}>{forma.nome}</span>
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* DIREITA: Planos Ativos + Config + Tabela */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Planos de Pagamento Ativos - GRADE COMPACTA */}
          {planosSalvos.length > 0 && (
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 shadow-2xl">
              <CardHeader className="border-b border-slate-700/50 pb-2 pt-3 px-4">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 bg-clip-text text-transparent text-base">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Planos Ativos ({planosSalvos.length})
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {planosSalvos.map(plano => {
                    const Icon = getIconeFormaPagamento(plano.forma_pagamento);
                    const cores = getCorConfig(plano.forma_pagamento);
                    const isSelected = planoEscolhido?.id === plano.id;
                    
                    return (
                      <button 
                        key={plano.id}
                        onClick={() => setPlanoEscolhido(isSelected ? null : plano)}
                        className={`flex items-center gap-2 p-2 border rounded-lg text-left transition-all duration-200 ${
                          isSelected 
                            ? `${cores.bg} ${cores.border} ring-1 ${cores.border.replace('border-', 'ring-')} shadow-md` 
                            : `bg-slate-800/50 border-slate-600 hover:${cores.bg}`
                        }`}
                      >
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="opacity-60 hover:opacity-100 h-6 w-6 flex-shrink-0" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoverPlanoSalvo(plano.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </Button>
                        
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${cores.bg} flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${cores.icon}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-xs ${isSelected ? cores.text : 'text-slate-200'} truncate`}>
                            {plano.nome_plano}
                          </div>
                          <div className={`text-[10px] ${isSelected ? cores.text + '/80' : 'text-slate-400'}`}>
                            {plano.numero_parcelas}x R$ {(plano.valor_parcela || 0).toFixed(2).replace('.', ',')}
                            {plano.valor_entrada > 0 && ` + R$ ${plano.valor_entrada.toFixed(2).replace('.', ',')} entrada`}
                          </div>
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-sm text-green-400">
                            R$ {(plano.valor_total_com_juros || 0).toFixed(2).replace('.', ',')}
                          </div>
                          {plano.taxa_juros > 0 && (
                            <div className="text-[9px] text-slate-400">{plano.taxa_juros}% a.m.</div>
                          )}
                          {plano.desconto_avista > 0 && (
                            <div className="text-[9px] text-green-400">{plano.desconto_avista}% desc.</div>
                          )}
                        </div>
                        
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configurar Plano */}
          <AnimatePresence>
            {formaSelecionada && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 shadow-2xl">
                  <CardHeader className="border-b border-slate-700/50 pb-2 pt-3 px-4">
                    <CardTitle className="bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 bg-clip-text text-transparent text-sm">
                      Configurar Plano - {formaSelecionada.nome}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 px-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <Label className="text-slate-300 text-xs">Valor Total do Orçamento</Label>
                      <Input value={`R$ ${valorTotal.toFixed(2).replace('.', ',')}`} disabled className="font-semibold bg-slate-800/50 text-white border-slate-600 h-8 text-sm" />
                    </div>
                    
                    {formaSelecionada.tipo === 'parcelado' && (
                      <>
                        <div>
                          <Label htmlFor="valorEntrada" className="text-slate-300 text-xs">Valor da Entrada</Label>
                          <Input id="valorEntrada" type="number" value={valorEntrada} onChange={e => setValorEntrada(Number(e.target.value))} className="bg-slate-800/50 text-white border-slate-600 h-8 text-sm" />
                        </div>
                        
                        <div>
                          <Label htmlFor="numeroParcelas" className="text-slate-300 text-xs">Número de Parcelas</Label>
                          <Select value={`${numeroParcelas}x`} onValueChange={value => setNumeroParcelas(Number(value.replace('x', '')))}>
                            <SelectTrigger className="bg-slate-800/50 text-white border-slate-600 h-8 text-sm">
                              <SelectValue placeholder="Escolha as parcelas" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: formaSelecionada.parcela_maxima - formaSelecionada.parcela_minima + 1 }, (_, i) => {
                                const parcela = formaSelecionada.parcela_minima + i;
                                return (
                                  <SelectItem key={parcela} value={`${parcela}x`}>{parcela}x</SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    
                    <div>
                      <Label htmlFor="primeiraParcela" className="text-slate-300 text-xs">Primeira Parcela</Label>
                      <Input id="primeiraParcela" type="date" value={primeiraParcela} onChange={e => setPrimeiraParcela(e.target.value)} className="bg-slate-800/50 text-white border-slate-600 h-8 text-sm" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Planos Disponíveis - Tabela */}
          <AnimatePresence>
          {planosCalculados.length > 0 && formaSelecionada && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 shadow-2xl">
                <CardHeader className="border-b border-slate-700/50 pb-2 pt-3 px-4">
                  <CardTitle className="bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 bg-clip-text text-transparent text-sm">
                    Planos Disponíveis - {formaSelecionada.nome}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3 px-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="p-1.5 text-left font-medium text-slate-400">Parcelas</th>
                          <th className="p-1.5 text-right font-medium text-slate-400">Entrada</th>
                          <th className="p-1.5 text-right font-medium text-slate-400">Valor Parc.</th>
                          <th className="p-1.5 text-right font-medium text-green-400">Total</th>
                          <th className="p-1.5 text-right font-medium text-red-400">Juros</th>
                          <th className="p-1.5 text-right font-medium text-slate-400">Taxa</th>
                          <th className="p-1.5 text-center font-medium text-slate-400">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planosCalculados.map((plano, i) => {
                          const jaSelecionado = isPlanoselecionado(plano);
                          return (
                            <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                              <td className="p-1.5 font-semibold text-slate-200">{plano.parcelas}</td>
                              <td className="p-1.5 text-right text-slate-300">R$ {plano.entrada.toFixed(2).replace('.', ',')}</td>
                              <td className="p-1.5 text-right text-slate-300">R$ {plano.valorParcela.toFixed(2).replace('.', ',')}</td>
                              <td className="p-1.5 text-right font-bold text-green-400">R$ {plano.total.toFixed(2).replace('.', ',')}</td>
                              <td className="p-1.5 text-right text-red-400">R$ {plano.juros.toFixed(2).replace('.', ',')}</td>
                              <td className="p-1.5 text-right text-slate-400">{plano.taxa}</td>
                              <td className="p-1.5 text-center">
                                {jaSelecionado ? (
                                  <Button size="sm" variant="outline" disabled className="bg-green-900/30 text-green-400 border-green-700 h-6 text-[10px] px-2">
                                    <CheckCircle className="w-3 h-3 mr-0.5" /> OK
                                  </Button>
                                ) : (
                                  <Button size="sm" onClick={() => handleAdicionarPlano(plano)} className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-white h-6 text-[10px] px-2">
                                    <Plus className="w-3 h-3 mr-0.5" /> Add
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
