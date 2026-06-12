import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { gerarPixCopiaECola } from '@/lib/pixPayload';
import {
  MessageCircle,
  ShoppingCart,
  Wallet,
  QrCode,
  Globe,
  Package,
  Instagram,
  Copy,
  Check,
  Zap,
  ChevronUp
} from 'lucide-react';

const PIX_CHAVE = '62982374000107'; // CNPJ
const PIX_NOME = 'NEURALTEC TECNOLOGIA';
const PIX_CIDADE = 'FLORIANOPOLIS';

const LINKS = [
  {
    id: 'vendas',
    label: 'Falar com Vendas',
    sub: 'Orçamentos, produtos e condições',
    icon: MessageCircle,
    cor: 'from-emerald-500 to-green-600',
    href: 'https://wa.me/554830452076?text=' + encodeURIComponent('Olá! Vim pelo Cartão NeuralTec e quero falar com Vendas.')
  },
  {
    id: 'compras',
    label: 'Compras / Fornecedor',
    sub: 'Cotações e parcerias',
    icon: ShoppingCart,
    cor: 'from-blue-500 to-indigo-600',
    href: 'https://wa.me/554830452078?text=' + encodeURIComponent('Olá! Vim pelo Cartão NeuralTec — assunto: Compras/Fornecedor.')
  },
  {
    id: 'financeiro',
    label: 'Financeiro / 2ª via',
    sub: 'Boletos, faturas e notas fiscais',
    icon: Wallet,
    cor: 'from-amber-500 to-orange-600',
    href: 'https://wa.me/554830452079?text=' + encodeURIComponent('Olá! Vim pelo Cartão NeuralTec e preciso de atendimento do Financeiro (2ª via / nota fiscal).')
  },
  {
    id: 'site',
    label: 'Nosso Site',
    sub: 'Conheça a NeuralTec',
    icon: Globe,
    cor: 'from-cyan-500 to-sky-600',
    href: 'https://www.neuraltec360.com.br'
  },
  {
    id: 'catalogo',
    label: 'Catálogo de Produtos',
    sub: 'Pronta entrega e sob encomenda',
    icon: Package,
    cor: 'from-purple-500 to-violet-600',
    href: 'https://www.neuraltec360.com.br/catalogo'
  },
  {
    id: 'instagram',
    label: '@neuraltec.tecnologia',
    sub: 'Novidades e promoções',
    icon: Instagram,
    cor: 'from-pink-500 to-rose-600',
    href: 'https://instagram.com/neuraltec.tecnologia'
  }
];

export default function PortalCliente() {
  const [pixAberto, setPixAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const pixPayload = useMemo(
    () => gerarPixCopiaECola({ chave: PIX_CHAVE, nome: PIX_NOME, cidade: PIX_CIDADE }),
    []
  );
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pixPayload)}`;

  const track = (botao) => {
    try {
      base44.analytics.track({ eventName: 'cartao_acesso_clique', properties: { botao } });
    } catch (e) { /* analytics nunca bloqueia o clique */ }
  };

  const copiarPix = async () => {
    track('pix_copia_cola');
    await navigator.clipboard.writeText(pixPayload);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/30 mb-4">
            <Zap className="w-11 h-11 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">NeuralTec Tecnologia</h1>
          <p className="text-slate-400 text-sm mt-1">Atendimento, catálogo e pagamentos em um só lugar</p>
        </div>

        {/* Botões */}
        <div className="space-y-3">
          {LINKS.map(({ id, label, sub, icon: Icon, cor, href }) => (
            <a
              key={id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(id)}
              className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/70 border border-slate-700/60 hover:border-slate-500 hover:bg-slate-800 transition-all active:scale-[0.98]"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cor} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-semibold">{label}</div>
                <div className="text-slate-400 text-xs truncate">{sub}</div>
              </div>
            </a>
          ))}

          {/* Pix */}
          <button
            onClick={() => { setPixAberto(!pixAberto); if (!pixAberto) track('pix_abrir'); }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-800/70 border border-slate-700/60 hover:border-teal-500 hover:bg-slate-800 transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 text-left flex-1">
              <div className="text-white font-semibold">Pagar com Pix</div>
              <div className="text-slate-400 text-xs">CNPJ: 62.982.374/0001-07</div>
            </div>
            <ChevronUp className={`w-5 h-5 text-slate-400 transition-transform ${pixAberto ? '' : 'rotate-180'}`} />
          </button>

          {pixAberto && (
            <div className="p-5 rounded-2xl bg-slate-800/70 border border-teal-700/40 text-center space-y-4">
              <img src={qrUrl} alt="QR Code Pix NeuralTec" className="mx-auto rounded-xl bg-white p-2 w-56 h-56" />
              <p className="text-slate-300 text-sm">Aponte a câmera do app do seu banco ou use o copia e cola:</p>
              <button
                onClick={copiarPix}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-semibold hover:opacity-90 transition-opacity"
              >
                {copiado ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copiado ? 'Copiado!' : 'Copiar código Pix'}
              </button>
              <p className="text-slate-500 text-xs">Após pagar, envie o comprovante para o Financeiro 💰</p>
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">
          NeuralTec Tecnologia • CNPJ 62.982.374/0001-07
        </p>
      </div>
    </div>
  );
}