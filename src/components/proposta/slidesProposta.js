const gold = (t) => `<span class="text-[#D4AF37] font-bold">${t}</span>`;

export const slidesProposta = [
  {
    capa: true,
    titulo: 'Proposta de Renovação e Melhorias',
    blocos: [
      {
        tipo: 'tech',
        tech: [
          'IMÓVEL: CASA 1 - GAROPABA/SC',
          'LOCADOR: CLAUDIO FREITAS MALLMANN',
          'LOCATÁRIO: LUIZ CARLOS LIESCH',
          'PERÍODO: AGO/2026 - AGO/2027'
        ],
        texto: 'Análise técnica e estrutural baseada em 18 meses de ocupação. A presente proposta condiciona a renovação comercial à resolução definitiva de falhas estruturais, garantindo a integridade do patrimônio e a viabilidade do contrato.'
      }
    ]
  },
  {
    titulo: '01. Histórico e Diagnóstico Estrutural',
    blocos: [
      {
        tipo: 'grid',
        colunas: [
          {
            subtitulo: 'Problemas Enfrentados',
            lista: [
              'Infiltrações severas na estrutura.',
              'Vazamentos recorrentes no piso.',
              "Transtornos com a caixa d'água.",
              'Deficiência de luminosidade natural.'
            ]
          },
          {
            subtitulo: 'O Novo Acordo',
            texto: `Devido aos desgastes e ao alto investimento de tempo para gerenciamento de obras no último ano, ${gold('TODAS as melhorias estruturais e estéticas listadas a seguir serão de responsabilidade e custo exclusivo do LOCADOR')}, como condição para a manutenção do aluguel.`
          }
        ]
      }
    ]
  },
  {
    titulo: '02. Exigências Estruturais (Locador)',
    blocos: [
      {
        tipo: 'tech',
        tech: [],
        lista: [
          `${gold('Sacada Superior e Piso:')} Impermeabilização definitiva do piso que causa infiltrações e instalação de cobertura adequada na sacada.`,
          `${gold('Luminosidade e Ventilação:')} Abertura de panos de vidro no pavimento inferior para suprir a falta de luz natural (conforme fotos enviadas).`,
          `${gold('Circulação e Portas:')} Correção da abertura invertida das portas dos banheiros ou substituição por portas de correr para viabilizar o uso do espaço.`
        ]
      }
    ]
  },
  {
    titulo: '03. Adequação de Infraestrutura (Locador)',
    blocos: [
      {
        tipo: 'tech',
        tech: [
          'STATUS: COZINHA ATUAL (Ref: 1000754513.heic)',
          'DIAGNÓSTICO: INADEQUADA E SEM PLANEJAMENTO'
        ],
        texto: 'A estrutura atual da cozinha é precária e incompatível com o valor de locação exigido.',
        lista: [
          `${gold('Exigência:')} Execução e instalação de cozinha planejada completa (balcão, armários aéreos e torre quente).`,
          `${gold('Pintura:')} Restauração completa da pintura interna do imóvel.`
        ]
      }
    ]
  },
  {
    titulo: '04. Proposta Financeira de Renovação',
    blocos: [
      { tipo: 'destaque', subtitulo: 'Valor Total (12 meses)', valor: 'R$ 45.000,00' },
      {
        tipo: 'grid',
        colunas: [
          { subtitulo: 'Entrada (Adiantamento)', tech: ['3 PARCELAS DE R$ 6.000,00', 'SUBTOTAL: R$ 18.000,00'] },
          { subtitulo: 'Mensalidades (Saldo)', tech: ['9 PARCELAS DE R$ 3.000,00', 'SUBTOTAL: R$ 27.000,00'] }
        ]
      },
      {
        tipo: 'alerta',
        texto: 'A efetivação dos pagamentos está vinculada à execução das obras pelo Proprietário. Aguardamos o de acordo para formalização do aditivo.'
      }
    ]
  }
];