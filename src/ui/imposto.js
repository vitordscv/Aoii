/* ── A tela do imposto ─────────────────────────────────────────────────────

   Duas regras de conduta, as mesmas do resto do app:

   1. **O número aparece com a conta ao lado.** Quem vai digitar isto no
      programa da Receita responde por ele; "confie em mim" não serve. Bruto,
      dedução usada, base, faixa, imposto da tabela, redução e imposto final
      ficam todos na tela, em ordem.

   2. **Nada aqui calcula nada.** Tudo vem de `core/imposto.js`. Esta tela
      desenha, ouve clique e copia texto — e quando um número estiver errado, o
      lugar de consertar é um só.

   O mês escolhido vive em memória e não em `data`: é onde a pessoa está
   olhando agora, não um dado do app. Reabrir volta para o mês corrente, que é
   o que ela quer ver em 99% das vezes. */

let irMesVisto=null;   /* {ano,mes} */
let irAnoVisto=null;
let irEditandoTabela=false;

function irMesAtual(){
  if(!irMesVisto){
    const t=today();
    irMesVisto={ano:t.getFullYear(),mes:t.getMonth()+1};
  }
  return irMesVisto;
}

function irAnoAtual(){
  if(irAnoVisto===null) irAnoVisto=irMesAtual().ano;
  return irAnoVisto;
}

function irPct(v){
  return (Number(v)||0).toLocaleString(localeAtual(),
    {style:'percent',minimumFractionDigits:2,maximumFractionDigits:2});
}

function irDia(iso){
  const t=String(iso||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '—';
  return new Date(t+'T12:00:00').toLocaleDateString(localeAtual(),
    {day:'2-digit',month:'2-digit'});
}

function irDiaCompleto(iso){
  const t=String(iso||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '—';
  return new Date(t+'T12:00:00').toLocaleDateString(localeAtual());
}

function irNomeDoMes(ano,mes){
  /* MONTH_NAMES e mutado por idioma em dictionary.js: ja vem traduzido */
  return MONTH_NAMES[mes-1]+' '+ano;
}

/* ── o aviso de ano ──────────────────────────────────────────────────────── */

/* A tabela envelhece sozinha: as faixas mudam por lei e o app não tem como
   saber. Em vez de calcular calado com número velho, ele avisa — e oferece os
   dois caminhos honestos: confirmar que continua igual, ou corrigir à mão. */
function renderIrBannerAno(){
  const el=document.getElementById('ir-banner-ano'); if(!el) return;
  const vigencia=anoVigenciaIR();
  const atual=today().getFullYear();
  if(atual<=vigencia){ el.innerHTML=''; return; }
  el.innerHTML=`<div class="warn-banner ir-banner">
    <div class="ir-banner-txt">${esc(L('ir.bannerAviso')
      .replace('{ano}',vigencia).replace('{atual}',atual))}</div>
    <div class="ir-banner-acoes">
      <button type="button" class="gf-new-btn" id="ir-conferi">${esc(L('ir.bannerConferi'))}</button>
      <button type="button" class="reset-btn" id="ir-editar-tabela">${esc(L('ir.bannerEditar'))}</button>
    </div>
  </div>`;
  document.getElementById('ir-conferi').addEventListener('click',async()=>{
    if(!confirmarAnoVigenciaIR(atual)) return;
    vibrate(8); await persist(); render();
    setSaveStatus(L('ir.anoConfirmado').replace('{ano}',atual));
  });
  document.getElementById('ir-editar-tabela').addEventListener('click',()=>{
    irEditandoTabela=true; vibrate(6); renderImposto();
    document.getElementById('ir-tabela-editor')?.scrollIntoView({block:'center'});
  });
}

/* ── o mês ───────────────────────────────────────────────────────────────── */

function renderIrMes(){
  const label=document.getElementById('ir-mes-label');
  const resumo=document.getElementById('ir-resumo');
  const calculo=document.getElementById('ir-calculo');
  if(!resumo||!calculo) return;

  const {ano,mes}=irMesAtual();
  if(label) label.textContent=irNomeDoMes(ano,mes);

  const calc=calcularIRMes(ano,mes);
  const grupos=tributavelPorFonteIR(ano,mes);

  if(!calc.quantos){
    resumo.innerHTML=`<div class="empty-illus"><span class="ei-icon">🧾</span>${esc(L('ir.nenhumRecebimento'))}<br>${esc(L('ir.nenhumRecebimentoSub'))}</div>`;
    calculo.innerHTML='';
    return;
  }

  /* por fonte, com a data de cada recebimento: é o que o Carnê-Leão pede, e é
     nesta lista que a pessoa confere antes de digitar */
  resumo.innerHTML=grupos.map(g=>`
    <div class="ir-fonte-grupo">
      <div class="ir-fonte-cab">
        <span class="ir-fonte-nome">${esc(g.nome)}</span>
        <span class="ir-fonte-total">${formatBRL(g.total)}</span>
      </div>
      <div class="ir-receb-lista">${g.recebimentos.map(r=>`
        <div class="ir-receb">
          <span class="ir-receb-data">${esc(irDia(r.data))}</span>
          <span class="ir-receb-marca">${r.origem==='derivado'
            ? '↻ '+esc(L('ir.derivado'))
            : '✓ '+esc(L('ir.registrado'))}</span>
          <span class="ir-receb-valor">${formatBRL(r.valor)}</span>
        </div>`).join('')}</div>
    </div>`).join('')
    +`<div class="list-total"><span>${esc(L('ir.totalTributavel'))}</span><span class="v">${formatBRL(calc.bruto)}</span></div>`;

  const d=calc.deducoes;
  const linha=(rotulo,valor,classe)=>`<div class="ir-linha${classe?' '+classe:''}">
      <span>${esc(rotulo)}</span><span>${valor}</span></div>`;

  calculo.innerHTML=
    linha(L('ir.bruto'),formatBRL(calc.bruto))
    +linha(d.usouSimplificado
        ? L('ir.deducaoSimplificado')
        : L('ir.deducaoDetalhado').replace('{n}',d.dependentes),
      '− '+formatBRL(d.usado))
    +linha(L('ir.base'),formatBRL(calc.base),'ir-linha-forte')
    +linha(L('ir.faixa'),calc.faixa.aliquota>0
        ? irPct(calc.faixa.aliquota)+' − '+formatBRL(calc.faixa.deduzir)
        : esc(L('ir.isento')))
    +linha(L('ir.impostoTabela'),formatBRL(calc.impostoDaTabela))
    +(calc.reducao>0?linha(L('ir.reducao'),'− '+formatBRL(calc.reducao)):'')
    +linha(L('ir.imposto'),formatBRL(calc.imposto),'ir-linha-total')
    +linha(L('ir.aliquotaEfetiva'),irPct(calc.aliquotaEfetiva))
    +linha(L('ir.liquido'),formatBRL(calc.liquido))
    +`<div class="help-text">${esc(L('ir.tabelaDoAno').replace('{ano}',calc.anoDaTabela))}</div>`;
}

/* ── o DARF ──────────────────────────────────────────────────────────────── */

function renderIrDarf(){
  const el=document.getElementById('ir-darf'); if(!el) return;
  const {ano,mes}=irMesAtual();
  const darf=darfIR(ano,mes);
  if(!darf||darf.estado==='nada'){ el.innerHTML=''; return; }

  const minimo=tabelaIRDoAno(ano).darfMinimo;

  if(darf.estado==='acumula'){
    el.innerHTML=`<div class="ir-darf ir-darf-acumula">
      <div class="ir-darf-titulo">${esc(L('ir.darfTitulo'))}</div>
      <div class="help-text">${esc(L('ir.darfAcumula')
        .replace('{valor}',formatBRL(darf.imposto))
        .replace('{minimo}',formatBRL(minimo)))}</div>
    </div>`;
    return;
  }

  if(darf.estado==='perdido'){
    el.innerHTML=`<div class="ir-darf ir-darf-acumula">
      <div class="ir-darf-titulo">${esc(L('ir.darfTitulo'))}</div>
      <div class="help-text">${esc(L('ir.darfPerdido')
        .replace('{valor}',formatBRL(darf.acumulado))
        .replace('{minimo}',formatBRL(minimo)))}</div>
    </div>`;
    return;
  }

  const vencido=!darf.pago&&darf.vencimento&&darf.vencimento<todayISO();
  const deVariosMeses=darf.acumuladoDe.length>1;
  el.innerHTML=`<div class="ir-darf${darf.pago?' ir-darf-pago':(vencido?' ir-darf-vencido':'')}">
    <div class="ir-darf-titulo">${esc(L('ir.darfTitulo'))}</div>
    <div class="ir-darf-valor">${formatBRL(darf.valor)}</div>
    ${deVariosMeses?`<div class="help-text">${esc(L('ir.darfSomaDe')
      .replace('{meses}',darf.acumuladoDe.map(m=>MONTH_ABBR[m-1]).join(', ')))}</div>`:''}
    <div class="ir-darf-venc">${esc(L('ir.darfVence'))} ${esc(irDiaCompleto(darf.vencimento))}</div>
    ${vencido?`<div class="ir-darf-alerta">${esc(L('ir.darfVencido'))}</div>`:''}
    <div class="ir-darf-status">
      <span class="ir-darf-tag${darf.pago?' pago':''}">${esc(darf.pago
        ? L('ir.darfPago')+(darf.pagoEm?' · '+irDiaCompleto(darf.pagoEm):'')
        : L('ir.darfPendente'))}</span>
      <button type="button" class="gf-new-btn" id="ir-darf-toggle">${esc(darf.pago
        ? L('ir.darfMarcarPendente') : L('ir.darfMarcarPago'))}</button>
    </div>
    <div class="help-text">${esc(L('ir.darfFeriadoHelp'))}</div>
  </div>`;

  document.getElementById('ir-darf-toggle').addEventListener('click',async()=>{
    marcarDarfIRPago(ano,mes,!darf.pago);
    vibrate(10); await persist(); render();
  });
}

/* ── as fontes ───────────────────────────────────────────────────────────── */

function renderIrFontes(){
  const el=document.getElementById('ir-fontes-list'); if(!el) return;
  const fontes=data.irFontes||[];
  if(!fontes.length){
    el.innerHTML=`<div class="empty-illus"><span class="ei-icon">🏷️</span>${esc(L('ir.fonteNenhuma'))}<br>${esc(L('ir.fonteNenhumaSub'))}</div>`;
    return;
  }
  el.innerHTML=fontes.map(f=>`
    <div class="gf-item-row" data-fonte-id="${esc(f.id)}">
      <div class="gf-item-main">
        <div class="gf-item-nome">${f.tipo==='diaria'?'📅':'🔁'} ${esc(f.nome)}</div>
        <div class="inv-item-sub">${esc(L(f.tipo==='diaria'?'ir.fonteDiaria':'ir.fonteMensal'))}${
          f.valorPadrao>0?' · '+formatBRL(f.valorPadrao):''}</div>
      </div>
      <div class="ir-fonte-acoes">
        ${f.tipo==='diaria'&&f.valorPadrao>0
          ? `<button type="button" class="gf-new-btn ir-lancar" data-id="${esc(f.id)}">${esc(L('ir.lancarDiaria'))}</button>`
          : ''}
        <button type="button" class="swipe-act-del ir-fonte-del" data-id="${esc(f.id)}" title="${esc(L('btn.excluir'))}" aria-label="${esc(L('a11y.deleteItem').replace('{name}',f.nome))}">🗑</button>
      </div>
    </div>`).join('');

  el.querySelectorAll('.ir-lancar').forEach(btn=>btn.addEventListener('click',async()=>{
    const mov=registrarDiariaIR(btn.getAttribute('data-id'));
    if(!mov) return;
    vibrate(12); await persist(); render();
    setSaveStatus(L('ir.diariaLancada').replace('{valor}',formatBRL(mov.valor)));
  }));

  el.querySelectorAll('.ir-fonte-del').forEach(btn=>btn.addEventListener('click',async()=>{
    const id=btn.getAttribute('data-id');
    const fonte=fonteIR(id); if(!fonte) return;
    if(!await confirmDialog({text:L('ir.fonteRemoverPergunta').replace('{nome}',fonte.nome)})) return;
    if(!removerFonteIR(id)) return;
    vibrate(15); await persist(); render();
  }));
}

/* ── as deduções ─────────────────────────────────────────────────────────── */

function renderIrDeducoes(){
  const d=data.impostoDeducoes||{};
  const dep=document.getElementById('ir-dependentes');
  const pensao=document.getElementById('ir-pensao');
  const inss=document.getElementById('ir-inss');
  const nota=document.getElementById('ir-deducoes-nota');
  if(dep&&document.activeElement!==dep) dep.value=d.dependentes||0;
  if(pensao&&document.activeElement!==pensao) pensao.value=d.pensao?valorDeCampo(d.pensao):'';
  if(inss&&document.activeElement!==inss) inss.value=d.inss?valorDeCampo(d.inss):'';
  if(nota){
    const {ano}=irMesAtual();
    const ded=deducoesIR(tabelaIRDoAno(ano));
    nota.textContent=ded.usouSimplificado
      ?L('ir.usandoSimplificado').replace('{valor}',formatBRL(ded.simplificado))
      :L('ir.usandoDetalhado').replace('{valor}',formatBRL(ded.detalhado));
  }
}

/* ── o ano ───────────────────────────────────────────────────────────────── */

function renderIrAnual(){
  const sel=document.getElementById('ir-ano-select');
  const el=document.getElementById('ir-anual');
  if(!el) return;

  /* os anos que têm algum recebimento marcado, mais o ano corrente */
  const anos=new Set([today().getFullYear(),irMesAtual().ano]);
  (data.transacoes||[]).forEach(t=>{
    if(t.tipo==='receita'&&t.ir&&/^\d{4}/.test(String(t.data||''))){
      anos.add(parseInt(String(t.data).slice(0,4),10));
    }
  });
  const lista=[...anos].filter(Number.isFinite).sort((a,b)=>b-a);
  if(sel){
    const escolhido=lista.includes(irAnoAtual())?irAnoAtual():lista[0];
    irAnoVisto=escolhido;
    sel.innerHTML=lista.map(a=>`<option value="${a}"${a===escolhido?' selected':''}>${a}</option>`).join('');
  }

  const r=resumoAnualIR(irAnoAtual());
  const linha=(rotulo,valor,classe)=>`<div class="ir-linha${classe?' '+classe:''}">
      <span>${esc(rotulo)}</span><span>${valor}</span></div>`;

  el.innerHTML=
    linha(L('ir.anualRecebido'),formatBRL(r.bruto))
    +linha(L('ir.anualImposto'),formatBRL(r.imposto))
    +linha(L('ir.anualPago'),formatBRL(r.pago))
    +linha(L('ir.anualAPagar'),formatBRL(r.aPagar),'ir-linha-total')
    +linha(L('ir.anualAliquota'),irPct(r.aliquotaEfetiva))
    +(r.pendentes.length
      ?`<div class="ir-pendentes">
          <div class="ir-pendentes-titulo">${esc(L('ir.anualPendentes').replace('{n}',r.pendentes.length))}</div>
          ${r.pendentes.map(m=>`<div class="ir-pendente${m.vencimento&&m.vencimento<todayISO()?' vencido':''}">
            <span>${esc(MONTH_NAMES[m.mes-1])}</span>
            <span>${formatBRL(m.valor)}</span>
            <span>${esc(L('ir.darfVence'))} ${esc(irDiaCompleto(m.vencimento))}</span>
          </div>`).join('')}
        </div>`
      :`<div class="help-text">${esc(L('ir.anualNenhumPendente'))}</div>`)
    +(r.vencidos.length
      ?`<div class="ir-darf-alerta">${esc(L('ir.anualVencidos').replace('{n}',r.vencidos.length))}</div>`
      :'');
}

/* ── o editor da tabela ──────────────────────────────────────────────────── */

/* A tabela à mão, sem mexer no código. Mora no próprio painel e não numa folha
   nova: são muitos campos, e folha dessa altura no celular vira rolagem dentro
   de rolagem. O ano fica em campo próprio porque editar 2027 não pode
   reescrever 2026 — ver a decisão 1 em core/imposto.js. */
function renderIrTabelaEditor(){
  const el=document.getElementById('ir-tabela-editor'); if(!el) return;
  if(!irEditandoTabela){ el.innerHTML=''; el.hidden=true; return; }
  el.hidden=false;

  const ano=irAnoAtual();
  const t=tabelaIRDoAno(ano);
  /* Campo de dinheiro mostra duas casas: `607,2` num campo de real parece
     valor truncado, e quem abre o editor pra conferir a tabela da Receita
     precisa reconhecer o número que leu lá. */
  const num=v=>v==null||v===''?'':String(v).replace('.',',');
  const dinheiro=v=>v==null||v===''?'':(Number(v)||0).toFixed(2).replace('.',',');
  const campo=(id,rotulo,valor,dica)=>`
    <div class="sheet-field ir-campo">
      <label for="${id}">${esc(rotulo)}</label>
      <input type="text" inputmode="decimal" id="${id}" value="${esc(valor)}">
      ${dica?`<div class="help-text">${esc(dica)}</div>`:''}
    </div>`;

  el.innerHTML=`<div class="list-panel ir-editor">
    <h3>${esc(L('ir.tabelaTitulo'))}</h3>
    <div class="panel-sub">${esc(L('ir.tabelaSub'))}</div>
    ${campo('ir-t-ano',L('ir.tabelaAno'),String(ano),L('ir.tabelaAnoHelp'))}
    ${campo('ir-t-simplificado',L('ir.tabelaSimplificado'),dinheiro(t.descontoSimplificado))}
    ${campo('ir-t-dependente',L('ir.tabelaDependente'),dinheiro(t.dependente))}
    ${campo('ir-t-darfminimo',L('ir.tabelaDarfMinimo'),dinheiro(t.darfMinimo))}

    <div class="ir-editor-sub">${esc(L('ir.tabelaFaixas'))}</div>
    <div class="ir-faixas-cab">
      <span>${esc(L('ir.tabelaFaixaAte'))}</span>
      <span>${esc(L('ir.tabelaFaixaAliquota'))}</span>
      <span>${esc(L('ir.tabelaFaixaDeduzir'))}</span>
    </div>
    ${t.faixas.map((f,i)=>`
      <div class="ir-faixa-linha" data-faixa="${i}">
        <input type="text" inputmode="decimal" class="ir-f-ate" value="${esc(dinheiro(f.ate))}"
          placeholder="${esc(L('ir.tabelaUltimaFaixa'))}"${f.ate===null?' disabled':''}>
        <input type="text" inputmode="decimal" class="ir-f-aliquota" value="${esc(num(f.aliquota))}">
        <input type="text" inputmode="decimal" class="ir-f-deduzir" value="${esc(dinheiro(f.deduzir))}">
      </div>`).join('')}
    <div class="help-text">${esc(L('ir.tabelaFaixasHelp'))}</div>

    <div class="ir-editor-sub">${esc(L('ir.tabelaReducao'))}</div>
    ${campo('ir-t-isento',L('ir.tabelaIsentoAte'),dinheiro(t.reducao.isentoAte))}
    ${campo('ir-t-limite',L('ir.tabelaLimite'),dinheiro(t.reducao.limite))}
    ${campo('ir-t-base',L('ir.tabelaBase'),dinheiro(t.reducao.base))}
    ${campo('ir-t-fator',L('ir.tabelaFator'),num(t.reducao.fator),L('ir.tabelaFatorHelp'))}

    <div class="sheet-actions">
      <button type="button" class="sheet-cancel-btn" id="ir-t-restaurar">${esc(L('ir.tabelaRestaurar'))}</button>
      <button type="button" class="sheet-cancel-btn" id="ir-t-fechar">${esc(L('btn.cancelar'))}</button>
      <button type="button" class="sheet-submit-btn" id="ir-t-salvar">${esc(L('ir.tabelaSalvar'))}</button>
    </div>
    <div class="help-text" id="ir-t-estado"></div>
  </div>`;

  const estado=msg=>{ const e=document.getElementById('ir-t-estado'); if(e) e.textContent=msg||''; };

  document.getElementById('ir-t-fechar').addEventListener('click',()=>{
    irEditandoTabela=false; renderImposto();
  });

  document.getElementById('ir-t-restaurar').addEventListener('click',async()=>{
    if(!await confirmDialog({text:L('ir.tabelaRestaurarPergunta')})) return;
    restaurarTabelaIR(ano);
    vibrate(10); await persist(); irEditandoTabela=false; render();
    setSaveStatus(L('ir.tabelaRestaurada'));
  });

  document.getElementById('ir-t-salvar').addEventListener('click',async()=>{
    const ler=id=>parseNum(document.getElementById(id).value);
    const faixas=[...el.querySelectorAll('.ir-faixa-linha')].map((linha,i,todas)=>{
      const ultima=i===todas.length-1;
      const ate=linha.querySelector('.ir-f-ate');
      return {
        ate:ultima?null:parseNum(ate.value),
        aliquota:parseNum(linha.querySelector('.ir-f-aliquota').value),
        deduzir:parseNum(linha.querySelector('.ir-f-deduzir').value),
      };
    });
    const anoAlvo=Math.trunc(ler('ir-t-ano'));
    const salva=salvarTabelaIR(anoAlvo,{
      anoVigencia:anoAlvo,
      descontoSimplificado:ler('ir-t-simplificado'),
      dependente:ler('ir-t-dependente'),
      darfMinimo:ler('ir-t-darfminimo'),
      faixas,
      reducao:{isentoAte:ler('ir-t-isento'),limite:ler('ir-t-limite'),
        base:ler('ir-t-base'),fator:ler('ir-t-fator')},
    });
    /* tabela de imposto meio salva é pior que tabela não salva: ou entra
       inteira e conferida, ou não entra e a tela diz por quê */
    if(!salva){ estado(L('ir.tabelaInvalida')); vibrate(20); return; }
    vibrate(10); await persist(); irEditandoTabela=false; render();
    setSaveStatus(L('ir.tabelaSalva'));
  });
}

/* ── a tela inteira ──────────────────────────────────────────────────────── */

function renderImposto(){
  if(!document.getElementById('pane-entradas-imposto')) return;
  renderIrBannerAno();
  renderIrMes();
  renderIrDarf();
  renderIrFontes();
  renderIrDeducoes();
  renderIrAnual();
  renderIrTabelaEditor();
}

/* ── ligações ────────────────────────────────────────────────────────────── */

function setupImposto(){
  const pane=document.getElementById('pane-entradas-imposto');
  if(!pane) return;

  const andar=n=>async()=>{
    const {ano,mes}=irMesAtual();
    const d=new Date(ano,mes-1+n,1);
    irMesVisto={ano:d.getFullYear(),mes:d.getMonth()+1};
    vibrate(6); renderImposto();
  };
  document.getElementById('ir-mes-ant')?.addEventListener('click',andar(-1));
  document.getElementById('ir-mes-prox')?.addEventListener('click',andar(1));

  /* copiar: data e valor, que é o que o Carnê-Leão pede. O aviso de estimativa
     NÃO vai no texto — isto é feito pra ser colado num formulário, e aviso ali
     só dá trabalho de apagar. */
  document.getElementById('ir-copiar')?.addEventListener('click',async()=>{
    const {ano,mes}=irMesAtual();
    const texto=textoCarneLeaoIR(ano,mes);
    try{
      await navigator.clipboard.writeText(texto);
      vibrate(10); setSaveStatus(L('tools.copiado'));
    }catch(e){ setSaveStatus(L('ir.copiaFalhou')); }
  });

  const fonteAdd=document.getElementById('ir-fonte-add');
  if(fonteAdd) fonteAdd.addEventListener('click',async()=>{
    const nome=document.getElementById('ir-fonte-nome');
    const tipo=document.getElementById('ir-fonte-tipo');
    const valor=document.getElementById('ir-fonte-valor');
    const fonte=criarFonteIR({nome:nome.value,tipo:tipo.value,
      valorPadrao:parseNum(valor.value)||0});
    if(!fonte){ vibrate(20); setSaveStatus(L('ir.fonteInvalida')); return; }
    nome.value=''; valor.value='';
    vibrate(10); await persist(); render();
  });

  /* as deduções gravam no blur, como todo campo de dinheiro do app */
  const ligarDeducao=(id,chave,inteiro)=>{
    const el=document.getElementById(id); if(!el) return;
    el.addEventListener('change',async()=>{
      if(!data.impostoDeducoes) data.impostoDeducoes={dependentes:0,pensao:0,inss:0};
      const bruto=inteiro?parseInt(el.value,10):parseNum(el.value);
      data.impostoDeducoes[chave]=Math.max(0,Number.isFinite(bruto)?bruto:0);
      await persist(); render();
    });
  };
  ligarDeducao('ir-dependentes','dependentes',true);
  ligarDeducao('ir-pensao','pensao',false);
  ligarDeducao('ir-inss','inss',false);

  document.getElementById('ir-ano-select')?.addEventListener('change',e=>{
    irAnoVisto=parseInt(e.target.value,10)||today().getFullYear();
    renderImposto();
  });

  document.getElementById('ir-abrir-tabela')?.addEventListener('click',()=>{
    irEditandoTabela=!irEditandoTabela; vibrate(6); renderImposto();
    if(irEditandoTabela){
      document.getElementById('ir-tabela-editor')?.scrollIntoView({block:'center'});
    }
  });
}
