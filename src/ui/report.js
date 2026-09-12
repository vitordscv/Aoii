/* ── O resumo do mês: o documento que a pessoa entrega ao contador ──

   Monta um HTML fechado em si mesmo — estilo embutido, nada de fora — escreve
   num iframe escondido e manda imprimir. Sai como PDF pela caixa de impressão
   do navegador.

   Mora aqui, e não em bindings.js, porque é um documento inteiro: quase tudo
   nele é marcação, e misturar isso com os cliques do app fazia o arquivo de
   ligações dobrar de tamanho sem ganhar nada. */
function imprimirRelatorioDoMes(){
  const t=today();
  const {entries,total}=computeCategoryBreakdown();
  const tot=computeTotals();
  const detalhe=computeCategoryDetalhe();
  const prevMes=computeCategoryPrevMonth();
  const rowsDetalhadas=entries.map(([cat,v])=>{
    const itens=(detalhe[cat]||[]).map(it=>`<tr><td class="sub">${esc(it.nome)}${it.data?` <span class="muted">· ${it.data}</span>`:''} <span class="muted" style="font-size:10.5px;">${esc(it.origem||'')}</span></td><td class="num sub">${formatBRL(it.val)}</td></tr>`).join('');
    const antes=prevMes[cat]||0;
    let delta='';
    if(antes>0){
      const pct=Math.round(((v-antes)/antes)*100);
      if(pct!==0) delta=`<span class="${pct>0?'up':'down'}"> ${pct>0?'▲':'▼'} ${Math.abs(pct)}%</span>`;
    }
    return `<tr><td class="cat-head">${catIcon(cat)} ${esc(categoriaLabel(cat))}${delta}</td><td class="num cat-head">${formatBRL(v)}</td></tr>${itens}`;
  }).join('')||`<tr><td colspan="2" class="muted">${L('rp.semDespesa')}</td></tr>`;

  const receitaItens=computeReceitasMesDetalhe();
  const totalReceitas=receitaItens.reduce((s,i)=>s+i.val,0);
  const rowsReceitas=receitaItens.map(i=>`<tr><td>${esc(i.nome)} <span class="muted" style="font-size:10.5px;">${esc(i.tag)}</span></td><td class="num">${formatBRL(i.val)}</td></tr>`).join('')||`<tr><td colspan="2" class="muted">${L('rp.semReceita')}</td></tr>`;

  const resultado=totalReceitas-total;

  const cartaoRows=(data.cartoes||[]).map(c=>{
    const info=computeCartao(c.id);
    return `<tr><td>${esc(c.nome)}</td><td class="num">${formatBRL(info.comprometido)}</td><td class="num">${formatBRL(info.limite)}</td><td class="num">${info.pct.toFixed(0)}%</td></tr>`;
  }).join('')||`<tr><td colspan="4" class="muted">${L('rp.semCartao')}</td></tr>`;

  const fixosRows=(data.gastosMensais||[]).map(g=>{
    const ativo=gastoFixoAtivoEm(g,t.getFullYear(),t.getMonth()+1);
    return `<tr><td>${esc(g.nome)}</td><td class="num">${L('rp.dia')} ${g.diaDoMes}</td><td class="num">${formatBRL(g.valor)}</td><td class="num">${ativo?L('rp.ativo'):L('rp.inativo')}</td></tr>`;
  }).join('')||`<tr><td colspan="4" class="muted">${L('rp.semConta')}</td></tr>`;

  const metaRows=(data.metas||[]).map(m=>
    `<tr><td>${esc(m.nome)}</td><td class="num">${formatBRL(m.valorGuardado||0)}</td><td class="num">${formatBRL(m.valorAlvo||0)}</td></tr>`
  ).join('')||`<tr><td colspan="3" class="muted">${L('rp.semMeta')}</td></tr>`;

  const geradoEm=`${t.toLocaleDateString(localeAtual())} ${L('rp.as')} ${t.toLocaleTimeString(localeAtual(),{hour:'2-digit',minute:'2-digit'})}`;
  const nomeMes=t.toLocaleDateString(localeAtual(),{month:'long',year:'numeric'});

  const doc=`<!DOCTYPE html><html lang="${localeAtual()}"><head><meta charset="utf-8"><title>${L('rp.tituloDoc')} ${nomeMes}</title>
  <style>
    *{box-sizing:border-box;}
    body{font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;background:#fff;padding:40px 44px;margin:0;font-size:13px;}
    .rp-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1a1a1a;padding-bottom:14px;margin-bottom:22px;}
    h1{font-size:20px;margin:0 0 4px;font-weight:700;letter-spacing:.01em;}
    .rp-doc-sub{font-size:11.5px;color:#555;font-family:Arial,sans-serif;}
    .rp-meta{text-align:right;font-family:Arial,sans-serif;font-size:10.5px;color:#666;line-height:1.5;}
    h2{font-size:13px;margin:28px 0 10px;padding:6px 0 6px;background:#1a1a1a;color:#fff;padding-left:10px;font-family:Arial,sans-serif;font-weight:700;letter-spacing:.03em;text-transform:uppercase;}
    .rp-sub{font-size:12px;color:#555;margin-bottom:6px;font-family:Arial,sans-serif;}
    .muted{color:#888;font-family:Arial,sans-serif;}
    table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:4px;}
    td{padding:6px 4px;border-bottom:1px solid #ddd;font-family:Arial,sans-serif;}
    td.num{text-align:right;font-family:'Courier New',monospace;white-space:nowrap;}
    td.cat-head{font-weight:700;}
    td.sub{padding-left:18px;font-size:11.5px;color:#555;border-bottom:none;line-height:1.6;}
    .up{color:#8a2e22;font-size:10.5px;font-weight:700;}
    .down{color:#295c46;font-size:10.5px;font-weight:700;}
    .rp-total{font-weight:700;font-size:13.5px;border-top:1.5px solid #1a1a1a;margin-top:2px;padding-top:8px;display:flex;justify-content:space-between;font-family:Arial,sans-serif;}
    .rp-resultado{margin-top:26px;padding:16px 18px;border:2px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center;font-family:Arial,sans-serif;}
    .rp-resultado .lbl{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}
    .rp-resultado .val{font-family:'Courier New',monospace;font-size:22px;font-weight:700;}
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

    <h2>1. ${L('rp.s1')}</h2>
    <table>${rowsReceitas}</table>
    <div class="rp-total"><span>${L('rp.totalReceitas')}</span><span>${formatBRL(totalReceitas)}</span></div>

    <h2>2. ${L('rp.s2')}</h2>
    <table>${rowsDetalhadas}</table>
    <div class="rp-total"><span>${L('rp.totalDespesas')}</span><span>${formatBRL(total)}</span></div>

    <div class="rp-resultado">
      <span class="lbl">${L('rp.resultado')}</span>
      <span class="val${resultado<0?' neg':''}">${formatBRL(resultado)}</span>
    </div>

    <h2>3. ${L('rp.s3')}</h2>
    <table>
      <tr><td>${L('rp.saldoConta')}</td><td class="num">${formatBRL(data.saldoAtual||0)}</td></tr>
      <tr><td>${L('rp.dinheiroEspecie')}</td><td class="num">${formatBRL(data.dinheiroVivo||0)}</td></tr>
      <tr><td class="cat-head">${L('rp.saldoProjetado').replace('{data}',new Date(data.dataAlvo+'T12:00:00').toLocaleDateString(localeAtual()))}</td><td class="num cat-head">${formatBRL(tot.projetado)}</td></tr>
    </table>

    <h2>4. ${L('rp.s4')}</h2>
    <table>
      <tr><td class="muted">${L('rp.cartao')}</td><td class="num muted">${L('rp.comprometido')}</td><td class="num muted">${L('rp.limite')}</td><td class="num muted">${L('rp.pctUsado')}</td></tr>
      ${cartaoRows}
    </table>

    <h2>5. ${L('rp.s5')}</h2>
    <table>
      <tr><td class="muted">${L('rp.descricao')}</td><td class="num muted">${L('rp.vencimento')}</td><td class="num muted">${L('rp.valor')}</td><td class="num muted">${L('rp.situacao')}</td></tr>
      ${fixosRows}
    </table>

    <h2>6. ${L('rp.s6')}</h2>
    <table>
      <tr><td class="muted">${L('rp.meta')}</td><td class="num muted">${L('rp.guardado')}</td><td class="num muted">${L('rp.alvo')}</td></tr>
      ${metaRows}
    </table>

    <div class="rp-footer">
      ${L('rp.rodape')}
    </div>
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
