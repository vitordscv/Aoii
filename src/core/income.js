/* ── rendas recorrentes: múltiplas fontes com dia do mês ── */
const TIPOS_RENDA=[
  {id:'clt',label:'Salário CLT',icon:'💼'},
  {id:'pj',label:'PJ · NF',icon:'🧾'},
  {id:'passiva',label:'Renda passiva',icon:'🌱'},
  {id:'freela',label:'Freela',icon:'🛠️'},
  {id:'outros',label:'Outros',icon:'📦'},
];
function tipoRenda(id){ return TIPOS_RENDA.find(t=>t.id===id)||TIPOS_RENDA[4]; }
function rendasRecorrentesAtivas(){ return (data.rendasRecorrentes||[]).filter(r=>r.ativo!==false&&(r.valor||0)>0); }
/* soma as ocorrências de cada renda com data > inicio e <= fim */
function rendasRecorrentesEntre(inicio,fim){
  let total=0;
  rendasRecorrentesAtivas().forEach(r=>{
    let y=inicio.getFullYear(), m=inicio.getMonth();
    for(let i=0;i<72;i++){
      const d=dataNoMes(y,m+1,r.diaDoMes);
      if(d>fim) break;
      if(d>inicio) total+=r.valor;
      m++; if(m>11){m=0;y++;}
    }
  });
  return total;
}

