/* ── O resumo do mês: o documento que a pessoa entrega ao contador ──

   Monta um HTML fechado em si mesmo — estilo embutido, nada de fora — escreve
   num iframe escondido e manda imprimir. Sai como PDF pela caixa de impressão
   do navegador.

   Mora aqui, e não em bindings.js, porque é um documento inteiro: quase tudo
   nele é marcação, e misturar isso com os cliques do app fazia o arquivo de
   ligações dobrar de tamanho sem ganhar nada.

   Duas regras mandam no formato:

   1. Toda linha de dinheiro cai numa de duas colunas — REALIZADO (já passou
      pela conta até hoje) ou PREVISTO (ainda vai passar até o fim do mês).
      Sem essa separação o documento não bate com extrato nenhum.
   2. Seção vazia não é impressa. Quem não tem dívida não precisa de uma folha
      dizendo "nenhuma dívida"; as seções são numeradas no fim, pelo que
      sobrou. */

/* soma os itens de um lado só da divisão */
function somaRelatorio(itens,realizado){
  return (itens||[]).filter(i=>!!i.realizado===realizado).reduce((s,i)=>s+(i.val||0),0);
}
/* linha de dinheiro em duas colunas: o valor cai na coluna que lhe cabe */
function linhaRelatorio(descHtml,val,realizado,classe){
  const c=classe?' '+classe:'';
  const vazio=`<td class="num${c}">—</td>`;
  const cheio=`<td class="num${c}">${formatBRL(val)}</td>`;
  return `<tr><td class="${classe||''}">${descHtml}</td>${realizado?cheio:vazio}${realizado?vazio:cheio}</tr>`;
}
function dataCurtaRelatorio(iso){
  if(!iso) return '';
  const d=new Date(iso+'T12:00:00');
  return isNaN(d)?'':d.toLocaleDateString(localeAtual());
}

function imprimirRelatorioDoMes(){
  const t=today();
  const ano=t.getFullYear(), mes=t.getMonth()+1;
  const primeiroDia=new Date(ano,mes-1,1), ultimoDia=new Date(ano,mes,0);
  const dataLonga=d=>d.toLocaleDateString(localeAtual());

  /* ── 1. receitas ── */
  const receitaItens=computeReceitasMesDetalhe();
  const receitaFeita=somaRelatorio(receitaItens,true);
  const receitaPrevista=somaRelatorio(receitaItens,false);
  const rowsReceitas=receitaItens.map(i=>linhaRelatorio(
    `${esc(i.nome)}${i.data?` <span class="muted">· ${i.data}</span>`:''} <span class="muted tag">${esc(i.tag)}</span>`,i.val,i.realizado
  )).join('')||`<tr><td colspan="3" class="muted">${L('rp.semReceita')}</td></tr>`;

  /* ── 2. despesas por categoria ── */
  const {entries}=computeCategoryBreakdown();
  const detalhe=computeCategoryDetalhe();
  const prevMes=computeCategoryPrevMonth();
  let despesaFeita=0, despesaPrevista=0;
  const rowsDespesas=entries.map(([cat,v])=>{
    const itens=detalhe[cat]||[];
    const feito=somaRelatorio(itens,true), previsto=somaRelatorio(itens,false);
    despesaFeita+=feito; despesaPrevista+=previsto;
    const antes=prevMes[cat]||0;
    let delta='';
    if(antes>0){
      const pct=Math.round(((v-antes)/antes)*100);
      if(pct!==0) delta=`<span class="${pct>0?'up':'down'}"> ${pct>0?'▲':'▼'} ${Math.abs(pct)}%</span>`;
    }
    const cabeca=`<tr><td class="cat-head">${catIcon(cat)} ${esc(categoriaLabel(cat))}${delta}</td>`+
      `<td class="num cat-head">${feito?formatBRL(feito):'—'}</td>`+
      `<td class="num cat-head">${previsto?formatBRL(previsto):'—'}</td></tr>`;
    const linhas=itens.map(it=>linhaRelatorio(
      `${esc(it.nome)}${it.data?` <span class="muted">· ${it.data}</span>`:''} <span class="muted tag">${esc(it.origem||'')}</span>`,
      it.val,it.realizado,'sub')).join('');
    return cabeca+linhas;
  }).join('')||`<tr><td colspan="3" class="muted">${L('rp.semDespesa')}</td></tr>`;

  const resultadoFeito=receitaFeita-despesaFeita;
  const resultadoMes=(receitaFeita+receitaPrevista)-(despesaFeita+despesaPrevista);

  /* ── situação patrimonial ── */
  const tot=computeTotals();
  const metasGuardado=(data.metas||[]).reduce((s,m)=>s+(m.valorGuardado||0),0);
  const reservaFora=reservaContaNoPatrimonio();
  const investido=(data.investimentos||[]).reduce((s,i)=>s+(i.valorInvestido||0),0);

  /* ── listas que antes não apareciam no documento ── */
  const entradasPendentes=(data.entradasExtras||[]).filter(e=>!e.feito&&restanteEntrada(e)>0);
  const dividasAbertas=(data.dividas||[]).filter(d=>!d.quitado&&restanteDivida(d)>0);
  const investimentos=data.investimentos||[];
  const viagens=data.viagens||[];

  const previsaoDe=it=>it.modo==='semPrevisao'?L('rp.semPrevisao')
    :(dataCurtaRelatorio(it.dataPrevista)||L('rp.semPrevisao'));

  /* ── reserva de emergência ── */
  const custoEssencial=custoMensalEssencial();
  const reservaMeses=data.reservaMeses||3;
  const reservaAlvo=custoEssencial*reservaMeses;
  const reservaGuardado=data.reservaGuardado||0;

  /* ── as seções, na ordem; as vazias caem fora antes de numerar ── */
  const secoes=[];
  const secao=(titulo,corpoHtml,extraHtml)=>secoes.push({titulo,corpoHtml,extraHtml:extraHtml||''});

  /* o total mora DENTRO da tabela: fora dela ele nunca cai debaixo da coluna
     que soma, e um demonstrativo com número desalinhado da coluna se lê errado */
  const cabecalhoDuplo=`<tr><td class="muted">${L('rp.descricao')}</td><td class="num muted">${L('rp.realizado')}</td><td class="num muted">${L('rp.previsto')}</td></tr>`;
  const linhaTotal=(rotulo,feito,previsto)=>`<tr class="tot"><td>${esc(rotulo)}</td><td class="num">${formatBRL(feito)}</td><td class="num">${formatBRL(previsto)}</td></tr>`;
  const somaGeral=v=>`<div class="rp-soma"><span>${L('rp.totalDoMes')}</span><span>${formatBRL(v)}</span></div>`;

  secao(L('rp.s1'),
    `<table>${cabecalhoDuplo}${rowsReceitas}${linhaTotal(L('rp.totalReceitas'),receitaFeita,receitaPrevista)}</table>`,
    somaGeral(receitaFeita+receitaPrevista));

  secao(L('rp.s2'),
    `<table>${cabecalhoDuplo}${rowsDespesas}${linhaTotal(L('rp.totalDespesas'),despesaFeita,despesaPrevista)}</table>`,
    somaGeral(despesaFeita+despesaPrevista));

  secao(L('rp.s3'),`<table>
      <tr><td>${L('rp.saldoConta')}</td><td class="num">${formatBRL(data.saldoAtual||0)}</td></tr>
      <tr><td>${L('rp.dinheiroEspecie')}</td><td class="num">${formatBRL(data.dinheiroVivo||0)}</td></tr>
      <tr><td>${L('rp.metasGuardado')}</td><td class="num">${formatBRL(metasGuardado)}</td></tr>
      ${reservaFora>0?`<tr><td>${L('rp.reservaFora')}</td><td class="num">${formatBRL(reservaFora)}</td></tr>`:''}
      <tr><td class="cat-head">${L('rp.patrimonio')}</td><td class="num cat-head">${formatBRL(patrimonioCalculado())}</td></tr>
      ${investido>0?`<tr><td>${L('rp.investido')} <span class="muted tag">${L('rp.foraDoPatrimonio')}</span></td><td class="num">${formatBRL(investido)}</td></tr>`:''}
      <tr><td>${L('rp.saldoProjetado').replace('{data}',dataLonga(new Date(data.dataAlvo+'T12:00:00')))}</td><td class="num">${formatBRL(tot.projetado)}</td></tr>
    </table>`);

  if((data.cartoes||[]).length) secao(L('rp.s4'),`<table>
      <tr><td class="muted">${L('rp.cartao')}</td><td class="num muted">${L('rp.vencimento')}</td><td class="num muted">${L('rp.comprometido')}</td><td class="num muted">${L('rp.limite')}</td><td class="num muted">${L('rp.pctUsado')}</td></tr>
      ${data.cartoes.map(c=>{
        const info=computeCartao(c.id);
        const dia=Math.min(31,Math.max(1,c.diaVencimento||data.diaVencimentoFatura||10));
        return `<tr><td>${esc(c.nome)}</td><td class="num">${L('rp.dia')} ${dia}</td><td class="num">${formatBRL(info.comprometido)}</td><td class="num">${formatBRL(info.limite)}</td><td class="num">${info.pct.toFixed(0)}%</td></tr>`;
      }).join('')}
    </table>`);

  if((data.gastosMensais||[]).length) secao(L('rp.s5'),`<table>
      <tr><td class="muted">${L('rp.descricao')}</td><td class="num muted">${L('rp.vencimento')}</td><td class="num muted">${L('rp.valor')}</td><td class="num muted">${L('rp.situacao')}</td></tr>
      ${data.gastosMensais.map(g=>{
        const ativo=gastoFixoAtivoEm(g,ano,mes);
        const saiu=gastoFixoPagoEm(g,ano,mes)||startOfDay(dataNoMes(ano,mes,g.diaDoMes))<=t;
        const sit=!ativo?L('rp.inativo'):saiu?L('rp.contaPaga'):L('rp.contaAVencer');
        return `<tr><td>${esc(g.nome)}</td><td class="num">${L('rp.dia')} ${g.diaDoMes}</td><td class="num">${formatBRL(g.valor)}</td><td class="num">${sit}</td></tr>`;
      }).join('')}
    </table>`);

  if(entradasPendentes.length) secao(L('rp.sEntradas'),`<table>
      <tr><td class="muted">${L('rp.descricao')}</td><td class="num muted">${L('rp.previsao')}</td><td class="num muted">${L('rp.valor')}</td><td class="num muted">${L('rp.recebido')}</td><td class="num muted">${L('rp.aReceber')}</td></tr>
      ${entradasPendentes.map(e=>`<tr><td>${esc(e.nome||L('rp.entradaExtra'))}</td><td class="num">${previsaoDe(e)}</td><td class="num">${formatBRL(e.valor||0)}</td><td class="num">${formatBRL(e.recebido||0)}</td><td class="num">${formatBRL(restanteEntrada(e))}</td></tr>`).join('')}
      <tr><td class="cat-head">${L('rp.totalAReceber')}</td><td></td><td></td><td></td><td class="num cat-head">${formatBRL(entradasPendentes.reduce((s,e)=>s+restanteEntrada(e),0))}</td></tr>
    </table>`);

  if(dividasAbertas.length) secao(L('rp.sDividas'),`<table>
      <tr><td class="muted">${L('rp.descricao')}</td><td class="muted">${L('rp.credor')}</td><td class="num muted">${L('rp.previsao')}</td><td class="num muted">${L('rp.valor')}</td><td class="num muted">${L('rp.pago')}</td><td class="num muted">${L('rp.aPagar')}</td></tr>
      ${dividasAbertas.map(d=>`<tr><td>${esc(d.nome)}</td><td>${esc(d.credor||'—')}</td><td class="num">${previsaoDe(d)}</td><td class="num">${formatBRL(d.valor||0)}</td><td class="num">${formatBRL(d.pago||0)}</td><td class="num">${formatBRL(restanteDivida(d))}</td></tr>`).join('')}
      <tr><td class="cat-head">${L('rp.totalAPagar')}</td><td></td><td></td><td></td><td></td><td class="num cat-head">${formatBRL(dividasAbertas.reduce((s,d)=>s+restanteDivida(d),0))}</td></tr>
    </table>`);

  secao(L('rp.s6'),`<table>
      <tr><td class="muted">${L('rp.meta')}</td><td class="num muted">${L('rp.prazo')}</td><td class="num muted">${L('rp.guardado')}</td><td class="num muted">${L('rp.alvo')}</td></tr>
      ${(data.metas||[]).map(m=>`<tr><td>${esc(m.nome)}</td><td class="num">${dataCurtaRelatorio(m.dataAlvo)||'—'}</td><td class="num">${formatBRL(m.valorGuardado||0)}</td><td class="num">${formatBRL(m.valorAlvo||0)}</td></tr>`).join('')
        ||`<tr><td colspan="4" class="muted">${L('rp.semMeta')}</td></tr>`}
    </table>
    <div class="rp-sub" style="margin-top:10px;">${L('rp.sReserva')}</div>
    <table>
      <tr><td>${L('rp.custoEssencial')}</td><td class="num">${formatBRL(custoEssencial)}</td></tr>
      <tr><td>${L('rp.reservaAlvo').replace('{n}',reservaMeses)}</td><td class="num">${formatBRL(reservaAlvo)}</td></tr>
      <tr><td class="cat-head">${L('rp.guardado')} <span class="muted tag">${data.reservaNaConta===false?L('rp.reservaForaTag'):L('rp.reservaNaContaTag')}</span></td><td class="num cat-head">${formatBRL(reservaGuardado)}</td></tr>
    </table>`);

  if(investimentos.length) secao(L('rp.sInvest'),`<table>
      <tr><td class="muted">${L('rp.tipo')}</td><td class="muted">${L('rp.descricao')}</td><td class="num muted">${L('rp.rendimento')}</td><td class="num muted">${L('rp.investido')}</td></tr>
      ${investimentos.map(i=>{
        const tp=tipoInvest(i.tipo);
        return `<tr><td>${esc(tp.label)}</td><td>${esc(i.nome||tp.label)}</td><td class="num">${i.percentCdi?i.percentCdi+'% CDI':'—'}</td><td class="num">${formatBRL(i.valorInvestido||0)}</td></tr>`;
      }).join('')}
      <tr><td class="cat-head">${L('rp.totalInvestido')}</td><td></td><td></td><td class="num cat-head">${formatBRL(investido)}</td></tr>
    </table>`);

  if(viagens.length) secao(L('rp.sViagens'),`<table>
      <tr><td class="muted">${L('rp.descricao')}</td><td class="num muted">${L('rp.orcamento')}</td><td class="num muted">${L('rp.gastoAcumulado')}</td></tr>
      ${viagens.map(v=>`<tr><td>${esc(v.nome)}</td><td class="num">${formatBRL(v.orcamento||0)}</td><td class="num">${formatBRL(gastoDaViagem(v.id))}</td></tr>`).join('')}
    </table>`);

  const corpoHtml=secoes.map((s,i)=>
    `<h2>${i+1}. ${esc(s.titulo)}</h2>${s.corpoHtml}${s.extraHtml}`+
    (i===1?`<div class="rp-resultado">
        <div class="linha"><span class="lbl">${L('rp.resultadoRealizado')}</span><span class="val${resultadoFeito<0?' neg':''}">${formatBRL(resultadoFeito)}</span></div>
        <div class="linha peq"><span class="lbl">${L('rp.resultadoMes')}</span><span class="val peq${resultadoMes<0?' neg':''}">${formatBRL(resultadoMes)}</span></div>
      </div>`:'')
  ).join('');

  const geradoEm=`${dataLonga(t)} ${L('rp.as')} ${t.toLocaleTimeString(localeAtual(),{hour:'2-digit',minute:'2-digit'})}`;
  const nomeMes=t.toLocaleDateString(localeAtual(),{month:'long',year:'numeric'});
  const periodoRealizado=L('rp.periodoRealizado').replace('{ini}',dataLonga(primeiroDia)).replace('{fim}',dataLonga(t));
  const periodoPrevisto=L('rp.periodoPrevisto').replace('{fim}',dataLonga(ultimoDia));

  const doc=`<!DOCTYPE html><html lang="${localeAtual()}"><head><meta charset="utf-8"><title>${L('rp.tituloDoc')} ${nomeMes}</title>
  <style>
    *{box-sizing:border-box;}
    body{font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;background:#fff;padding:40px 44px;margin:0;font-size:13px;}
    .rp-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1a1a1a;padding-bottom:14px;margin-bottom:14px;}
    h1{font-size:20px;margin:0 0 4px;font-weight:700;letter-spacing:.01em;}
    .rp-doc-sub{font-size:11.5px;color:#555;font-family:Arial,sans-serif;}
    .rp-meta{text-align:right;font-family:Arial,sans-serif;font-size:10.5px;color:#666;line-height:1.5;}
    .rp-periodo{font-family:Arial,sans-serif;font-size:11px;color:#333;line-height:1.7;border-left:3px solid #1a1a1a;padding:8px 12px;background:#f4f4f4;margin-bottom:6px;}
    .rp-periodo b{letter-spacing:.02em;}
    .rp-criterio{font-family:Arial,sans-serif;font-size:10px;color:#777;line-height:1.6;margin-bottom:18px;}
    h2{font-size:13px;margin:28px 0 10px;padding:6px 0 6px 10px;background:#1a1a1a;color:#fff;font-family:Arial,sans-serif;font-weight:700;letter-spacing:.03em;text-transform:uppercase;}
    .rp-sub{font-size:11px;color:#555;margin-bottom:4px;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em;font-weight:700;}
    .muted{color:#888;font-family:Arial,sans-serif;}
    .tag{font-size:10.5px;}
    table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:4px;}
    td{padding:6px 4px;border-bottom:1px solid #ddd;font-family:Arial,sans-serif;vertical-align:top;}
    td.num{text-align:right;font-family:'Courier New',monospace;white-space:nowrap;}
    td.cat-head{font-weight:700;}
    td.sub{padding-left:18px;font-size:11.5px;color:#555;border-bottom:none;line-height:1.6;}
    .up{color:#8a2e22;font-size:10.5px;font-weight:700;}
    .down{color:#295c46;font-size:10.5px;font-weight:700;}
    tr.tot td{border-top:1.5px solid #1a1a1a;border-bottom:none;font-weight:700;font-size:13px;padding-top:9px;}
    .rp-soma{display:flex;justify-content:space-between;font-family:Arial,sans-serif;font-size:11.5px;color:#444;border-top:1px solid #ddd;padding-top:6px;margin-top:2px;}
    .rp-soma span:last-child{font-family:'Courier New',monospace;font-weight:700;}
    .rp-resultado{margin-top:22px;padding:14px 18px;border:2px solid #1a1a1a;font-family:Arial,sans-serif;}
    .rp-resultado .linha{display:flex;justify-content:space-between;align-items:center;}
    .rp-resultado .linha.peq{margin-top:8px;padding-top:8px;border-top:1px solid #ddd;}
    .rp-resultado .lbl{font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}
    .rp-resultado .linha.peq .lbl{font-weight:400;color:#555;text-transform:none;letter-spacing:0;}
    .rp-resultado .val{font-family:'Courier New',monospace;font-size:22px;font-weight:700;}
    .rp-resultado .val.peq{font-size:15px;font-weight:400;color:#333;}
    .rp-resultado .val.neg{color:#8a2e22;}
    .rp-footer{margin-top:34px;padding-top:12px;border-top:1px solid #ccc;font-family:Arial,sans-serif;font-size:10px;color:#888;line-height:1.6;}
    @media print{ h2{page-break-after:avoid;} tr{page-break-inside:avoid;} }
  </style></head><body>
    <div class="rp-header">
      <div>
        <h1>${L('rp.tituloDoc')}</h1>
        <div class="rp-doc-sub">${L('rp.subDoc')} — ${nomeMes}</div>
      </div>
      <div class="rp-meta">${L('rp.geradoEm')}<br>${geradoEm}</div>
    </div>
    <div class="rp-periodo">
      <b>${L('rp.periodo')}</b><br>${periodoRealizado}<br>${periodoPrevisto}
    </div>
    <div class="rp-criterio">${L('rp.criterio')}</div>
    ${corpoHtml}
    <div class="rp-footer">${L('rp.rodape')}</div>
  </body></html>`;

  const ifr=document.createElement('iframe');
  ifr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(ifr);
  const idoc=ifr.contentWindow.document;
  idoc.open(); idoc.write(doc); idoc.close();
  setTimeout(()=>{
    ifr.contentWindow.focus();
    ifr.contentWindow.print();
    setTimeout(()=>ifr.remove(),1000);
  },250);
}
