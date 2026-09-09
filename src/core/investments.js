/* ── tipos de investimento ── */
function TIPOS_INVEST(){
  const L2={pt:{acoes:'Ações',fundos:'Fundos',cripto:'Cripto'},en:{acoes:'Stocks',fundos:'Funds',cripto:'Crypto'},es:{acoes:'Acciones',fundos:'Fondos',cripto:'Cripto'},fr:{acoes:'Actions',fundos:'Fonds',cripto:'Crypto'},it:{acoes:'Azioni',fundos:'Fondi',cripto:'Cripto'}}[data.idioma||'pt'];
  return [
    {id:'cdi',label:'CDI',icon:'🏦',conservador:true},
    {id:'selic',label:'Selic',icon:'🏛️',conservador:true},
    {id:'cdb',label:'CDB',icon:'💰',conservador:true},
    {id:'acoes',label:L2.acoes,icon:'📈',conservador:false},
    {id:'fundos',label:L2.fundos,icon:'🧺',conservador:false},
    {id:'fiis',label:'FIIs',icon:'🏢',conservador:false},
    {id:'cripto',label:L2.cripto,icon:'🪙',conservador:false},
    {id:'bdrs',label:'BDRs',icon:'🌎',conservador:false},
  ];
}
function tipoInvest(id){ return TIPOS_INVEST().find(t=>t.id===id)||TIPOS_INVEST()[0]; }
