/* ─── default data ─── */

function defaultData(){
  const Y=new Date().getFullYear();
  return {
    schemaVersion:SCHEMA_VERSAO,
    saldoAtual:0,
    saldoAtualizadoEm:new Date().toISOString(),
    dinheiroVivo:0,
    dinheiroVivoAtualizadoEm:new Date().toISOString(),
    dataAlvo:`${Y}-12-31`,
    tipoRenda:'diaria',
    rendaDiaria:0,
    diasTrabalho:[1,2,3,4,5],
    rendaMensal:{valor:0,diaDoMes:5},
    gastosMensais:[],
    diasNaoTrabalhados:[],
    faturas:[],
    transacoes:[],
    entradasExtras:[],
    comprasPlanejadas:[],
    limiteCartao:0,
    diaVencimentoFatura:10,
    cartoes:[],
    metas:[],
    patrimonioHistorico:[],
    rendasRecorrentes:[],
    orcamentos:{},
    investimentos:[],
    viagens:[],
    taxasManuais:{cdi:null,selic:null,atualizadoEm:null},
    fundoIlustrado:false,
    gastoDiario:false,
    reservaGuardado:0,
    reservaMeses:3,
    reservaNaConta:true,
    tema:'onda',
    moeda:'BRL',
    onboardingCompleto:false,
    tourCompleto:false,
    idioma:'pt',
  };
}

function migrateData(d){
  /* dados importados (código de sync ou arquivo JSON) podem trazer valor
     como texto — aí "soma" vira concatenação e a conta toda quebra.
     Roda antes dos defaults abaixo, que descartam tudo que não é número. */
  {
    const n=v=>{ if(v==null||v==='') return 0; const x=parseNum(v); return isNaN(x)?0:x; };
    const dia=v=>{ const x=parseInt(v,10); return isNaN(x)?1:Math.min(31,Math.max(1,x)); };
    const lista=k=>Array.isArray(d[k])?d[k]:[];
    d.saldoAtual=n(d.saldoAtual);
    d.dinheiroVivo=n(d.dinheiroVivo);
    d.rendaDiaria=n(d.rendaDiaria);
    d.limiteCartao=n(d.limiteCartao);
    d.reservaGuardado=n(d.reservaGuardado);
    if(d.rendaMensal&&typeof d.rendaMensal==='object'){
      d.rendaMensal.valor=n(d.rendaMensal.valor);
      d.rendaMensal.diaDoMes=dia(d.rendaMensal.diaDoMes);
    }
    lista('gastosMensais').forEach(g=>{ g.valor=n(g.valor); g.diaDoMes=dia(g.diaDoMes); });
    lista('rendasRecorrentes').forEach(r=>{ r.valor=n(r.valor); r.diaDoMes=dia(r.diaDoMes); });
    lista('faturas').forEach(f=>{ f.valor=n(f.valor); (f.gastos||[]).forEach(g=>{ g.valor=n(g.valor); }); });
    lista('transacoes').forEach(t=>{ t.valor=n(t.valor); });
    lista('entradasExtras').forEach(e=>{ e.valor=n(e.valor); });
    lista('comprasPlanejadas').forEach(c=>{ c.valor=n(c.valor); c.parcelas=Math.max(1,parseInt(c.parcelas,10)||1); });
    lista('metas').forEach(m=>{ m.valorAlvo=n(m.valorAlvo); m.valorGuardado=n(m.valorGuardado); m.aporteMensal=n(m.aporteMensal); });
    lista('investimentos').forEach(i=>{ i.valorInvestido=n(i.valorInvestido); (i.dividendos||[]).forEach(x=>{ x.valor=n(x.valor); }); });
    lista('viagens').forEach(v=>{ v.orcamento=n(v.orcamento); });
    lista('cartoes').forEach(c=>{ c.limite=n(c.limite); });
    if(d.orcamentos&&typeof d.orcamentos==='object') Object.keys(d.orcamentos).forEach(k=>{ d.orcamentos[k]=n(d.orcamentos[k]); });
  }
  if(typeof d.onboardingCompleto!=='boolean') d.onboardingCompleto=true; // quem já tinha dados salvos não precisa do assistente
  if(typeof d.tourCompleto!=='boolean') d.tourCompleto=false; // o tour guiado é novo pra todo mundo, mesmo quem já usava o app
  if(!d.idioma) d.idioma='pt';
  if(typeof d.saldoAtual!=='number') d.saldoAtual=0;
  if(!d.dataAlvo) d.dataAlvo=defaultTargetValue();
  // se a meta guardada era "31/12 do ano X" (padrão automático) e já virou o ano, avança pro 31/12 do ano atual sozinho
  else{
    const anoAtual=today().getFullYear();
    const m=/^(\d{4})-12-31$/.exec(d.dataAlvo);
    if(m && parseInt(m[1],10)<anoAtual) d.dataAlvo=`${anoAtual}-12-31`;
  }
  if(!d.diasTrabalho)         d.diasTrabalho=[1,2,3,4,5];
  if(!d.tipoRenda)            d.tipoRenda='diaria';
  if(typeof d.rendaDiaria!=='number') d.rendaDiaria=0;
  if(!d.rendaMensal)          d.rendaMensal={valor:0,diaDoMes:5};
  if(!d.gastosMensais)        d.gastosMensais=[];
  if(d.internet){
    d.gastosMensais.push({id:uid(),nome:d.internet.nome||'Internet',valor:d.internet.valor||0,diaDoMes:d.internet.diaDoMes||10});
    delete d.internet;
  }
  if(d.spotify){
    d.gastosMensais.push({id:uid(),nome:d.spotify.nome||'Assinatura',valor:d.spotify.valor||0,diaDoMes:d.spotify.diaDoMes||10});
    delete d.spotify;
  }
  if(!d.diasNaoTrabalhados)   d.diasNaoTrabalhados=[];
  if(!d.faturas)              d.faturas=[];
  if(typeof d.limiteCartao!=='number') d.limiteCartao=0;
  if(!d.cartoes) d.cartoes=[];
  if(!d.categorias||!d.categorias.length) d.categorias=CATEGORIAS_DEFAULT.slice();
  d.cartoes.forEach(c=>{
    if(typeof c.diaFechamento!=='number') c.diaFechamento=null;
    if(typeof c.diaVencimento!=='number')  c.diaVencimento=null;
  });
  const primeiroCartaoId=d.cartoes.length?d.cartoes[0].id:null;
  d.faturas.forEach(f=>{ if(!f.gastos) f.gastos=[]; f.gastos.forEach(g=>{ if(!g.categoria) g.categoria='Outros'; }); if(!f.cartaoId) f.cartaoId=primeiroCartaoId; });
  // conserta faturas duplicadas (mesmo mês+ano+cartão) que possam ter ficado de uma versão anterior — funde em vez de duplicar
  {
    const vistos={};
    const fundidas=[];
    d.faturas.forEach(f=>{
      const chave=`${f.ano}-${f.mes}-${f.cartaoId}`;
      if(vistos[chave]){
        vistos[chave].valor=(vistos[chave].valor||0)+(f.valor||0);
        vistos[chave].gastos=[...(vistos[chave].gastos||[]),...(f.gastos||[])];
        // se qualquer uma das duplicatas foi marcada como paga, a fatura fundida também é — nunca perde esse estado no meio da fusão
        if(f.pago) vistos[chave].pago=true;
      }else{
        vistos[chave]=f;
        fundidas.push(f);
      }
    });
    d.faturas=fundidas;
    // fatura paga => todas as compras dela contam como pagas (mesma regra usada ao marcar a caixa manualmente)
    d.faturas.forEach(f=>{ if(f.pago) (f.gastos||[]).forEach(g=>{ g.pago=true; }); });
  }
  d.gastosMensais.forEach(g=>{
    if(!g.categoria) g.categoria='Outros';
    if(typeof g.ativo!=='boolean') g.ativo=true;
    if(typeof g.inicioAno!=='number')  g.inicioAno=null;
    if(typeof g.inicioMes!=='number')  g.inicioMes=null;
  });
  if(!d.entradasExtras)       d.entradasExtras=[];
  d.entradasExtras.forEach(e=>{
    /* veio da versão anterior, que só tinha o interruptor "aos poucos" */
    if(!e.modo) e.modo = e.aosPoucos ? 'aosPoucos' : 'unica';
    if(!['unica','aosPoucos','semPrevisao'].includes(e.modo)) e.modo='unica';
    const r=parseNum(e.recebido); e.recebido=isNaN(r)?0:Math.max(0,r);
    delete e.aosPoucos;
  });
  if(!d.transacoes)           d.transacoes=[];
  d.transacoes.forEach(t=>{
    if(!t.categoria) t.categoria='Outros';
    if(!t.metodo) t.metodo='debito';
    if(!t.data) t.data=todayISO();
  });
  if(!d.comprasPlanejadas)    d.comprasPlanejadas=[];
  d.comprasPlanejadas.forEach(c=>{
    if(typeof c.cartao!=='boolean')          c.cartao=false;
    if(typeof c.parcelas!=='number')         c.parcelas=1;
    if(typeof c.parcelasLancadas!=='boolean') c.parcelasLancadas=false;
    if(!c.cartaoId)                          c.cartaoId=primeiroCartaoId;
  });
  if(typeof d.dinheiroVivo!=='number') d.dinheiroVivo=0;
  if(!d.dinheiroVivoAtualizadoEm) d.dinheiroVivoAtualizadoEm=new Date().toISOString();
  if(typeof d.diaVencimentoFatura!=='number') d.diaVencimentoFatura=10;
  if(!d.metas)                d.metas=[];
  if(!d.patrimonioHistorico)  d.patrimonioHistorico=[];
  if(!d.tema)                 d.tema='onda';
  if(!d.moeda)                d.moeda='BRL';
  if(!d.customTheme)          d.customTheme={};
  if(!d.rendasRecorrentes)    d.rendasRecorrentes=[];
  d.rendasRecorrentes.forEach(r=>{
    if(!r.tipo) r.tipo='outros';
    if(typeof r.valor!=='number') r.valor=0;
    if(!r.diaDoMes) r.diaDoMes=1;
  });
  if(!d.orcamentos)           d.orcamentos={};
  if(!d.investimentos)        d.investimentos=[];
  if(!d.viagens)               d.viagens=[];
  if(typeof d.reservaGuardado!=='number') d.reservaGuardado=0;
  /* padrão "na conta": preserva o patrimônio de quem já usava o app */
  if(typeof d.reservaNaConta!=='boolean') d.reservaNaConta=true;
  if(typeof d.reservaMeses!=='number')    d.reservaMeses=3;
  if(typeof d.iaAtiva!=='boolean') d.iaAtiva=false;
  d.viagens.forEach(v=>{ if(typeof v.orcamento!=='number') v.orcamento=0; });
  d.metas.forEach(m=>{ if(typeof m.aporteMensal!=='number') m.aporteMensal=0; if(!m.ultimoAporte) m.ultimoAporte=null; });
  d.transacoes.forEach(t=>{ if(!t.viagemId) t.viagemId=null; });
  d.investimentos.forEach(inv=>{
    if(!inv.tipo) inv.tipo='cdi';
    if(!inv.dividendos) inv.dividendos=[];
    if(typeof inv.valorInvestido!=='number') inv.valorInvestido=0;
  });
  if(!d.taxasManuais)         d.taxasManuais={cdi:null,selic:null,atualizadoEm:null};
  if(typeof d.fundoIlustrado!=='boolean') d.fundoIlustrado=false;
  if(typeof d.gastoDiario!=='boolean') d.gastoDiario=false;
  return d;
}

