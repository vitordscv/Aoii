/* ── A integração com o Pierre, na tela ────────────────────────────────────

   Duas regras de conduta aqui:

   1. **Nada acontece sem a pessoa ver antes.** Sincronizar não grava direto:
      busca, monta o plano — quantos lançamentos novos, quantos já estavam,
      quantos são do cartão e ficam de fora, e qual saldo o banco diz — e só
      grava depois do "confirmar". Mexer no extrato de alguém sem dizer o que
      vai mudar não é opção.

   2. **Erro tem nome.** Chave recusada se resolve colando outra; assinatura
      vencida não se resolve dentro do Aoii; sem rede é esperar. Dizer
      "não deu" nos três casos deixa a pessoa tentando a coisa errada. */

function pierreDizOErro(e){
  const codigo=e&&e.codigo;
  const conhecidos={
    'sem-chave':'pierre.semChave',
    'chave-invalida':'pierre.chaveInvalida',
    'sem-assinatura':'pierre.semAssinatura',
    'sem-ponte':'pierre.semPonte',
    'demorou':'pierre.demorou',
    'rota':'pierre.erroGenerico',
  };
  return conhecidos[codigo]?L(conhecidos[codigo]):(e&&e.message)||L('pierre.erroGenerico');
}

/* O plano achado pela busca-ao-abrir, esperando alguém olhar. Fica em memória
   e não em `data`: é uma foto do banco, não um dado do app — e se a pessoa
   fechar sem confirmar, não sobra nada. */
let pierrePlanoPendente=null;
/* Por que a última busca automática não deu certo. Fica aqui e não em `data`
   porque é estado de agora, não dado do app. */
let pierreFalhaAoAbrir=null;

function pierreEstado(texto,tom){
  const el=document.getElementById('pierre-estado');
  if(!el) return;
  el.textContent=texto||'';
  el.classList.toggle('pierre-erro',tom==='erro');
  el.classList.toggle('pierre-ok',tom==='ok');
}

/* O que uma sincronização faria, em texto. Montado com `textContent` por
   linha: nome de banco e descrição de compra vêm de fora, e não entram em
   marcação. */
function pierreDesenharPlano(plano){
  const caixa=document.getElementById('pierre-plano');
  if(!caixa) return;
  caixa.innerHTML='';
  caixa.hidden=false;

  const linha=(texto,classe)=>{
    const d=document.createElement('div');
    d.className=classe||'help-text';
    d.textContent=texto;
    caixa.appendChild(d);
    return d;
  };

  const titulo=document.createElement('div');
  titulo.className='ia-envio-titulo';
  titulo.textContent=L('pierre.planoTitulo');
  caixa.appendChild(titulo);

  linha(L('pierre.planoNovas').replace('{n}',plano.novas.length));
  if(plano.repetidas.length) linha(L('pierre.planoRepetidas').replace('{n}',plano.repetidas.length));
  if(plano.doCartao.length) linha(L('pierre.planoCartao').replace('{n}',plano.doCartao.length));
  if(plano.recusadas.length) linha(L('pierre.planoRecusadas').replace('{n}',plano.recusadas.length));
  if(plano.deOutrasContas.length) linha(L('pierre.planoOutrasContas').replace('{n}',plano.deOutrasContas.length));

  /* ── o que o banco confirma do que você já tinha escrito ── */
  if(plano.conciliadas&&plano.conciliadas.length){
    const sub=document.createElement('div');
    sub.className='ia-envio-titulo pierre-plano-sub';
    sub.textContent=L('pierre.conciliaTitulo');
    caixa.appendChild(sub);
    linha(L('pierre.conciliaAjuda'));
    const lista=document.createElement('div');
    lista.className='pierre-contas';
    lista.id='pierre-concilia-lista';
    caixa.appendChild(lista);
    plano.conciliadas.forEach((par,i)=>{
      const item=document.createElement('label');
      item.className='pierre-conta';
      const marca=document.createElement('input');
      marca.type='checkbox';
      marca.value=String(i);
      /* marcado = é o mesmo. É o caso comum, e desmarcar deixa os dois. */
      marca.checked=true;
      item.appendChild(marca);
      const nome=document.createElement('span');
      nome.className='pierre-conta-nome';
      nome.textContent=par.meuNome||par.doBanco.nome;
      item.appendChild(nome);
      const info=document.createElement('span');
      info.className='pierre-conta-tipo';
      info.textContent=formatBRL(par.doBanco.valor)+' · '
        +(par.dias===0?L('pierre.conciliaMesmoDia')
                      :L('pierre.conciliaDias').replace('{n}',par.dias));
      item.appendChild(info);
      lista.appendChild(item);
    });
  }
  if(!plano.trazerLancamentos) linha(L('pierre.planoSemLancamentos'));
  if(!plano.trazerSaldo) linha(L('pierre.planoSemSaldo'));

  if(plano.trazerSaldo&&plano.contasDeBanco>0){
    linha(L('pierre.planoSaldo')
      .replace('{banco}',formatBRL(plano.saldo))
      .replace('{app}',formatBRL(plano.saldoAtual)));
  }

  /* ── o cartão ── */
  if(plano.cartao&&plano.cartao.cartoes.length){
    const c=plano.cartao;
    const sub=document.createElement('div');
    sub.className='ia-envio-titulo pierre-plano-sub';
    sub.textContent=L('pierre.planoCartaoTitulo');
    caixa.appendChild(sub);
    c.cartoes.forEach(k=>{
      linha(k.nome+' · '+L('pierre.planoLimite').replace('{v}',formatBRL(k.limite))
        +(k.diaVencimento?' · '+L('pierre.planoVence').replace('{d}',k.diaVencimento):''),
        'pierre-amostra');
    });
    linha(L('pierre.planoFaturas')
      .replace('{n}',c.faturas.length)
      .replace('{fechadas}',c.faturasFechadas));
    if(c.parcelasAbertas.length){
      linha(L('pierre.planoParcelas')
        .replace('{n}',c.parcelasAbertas.length)
        .replace('{v}',formatBRL(c.totalParcelas)));
    }
    if(c.faturasSemPagamento&&c.faturasSemPagamento.length){
      linha(L('pierre.planoFaturaSemPagamento').replace('{n}',c.faturasSemPagamento.length));
    }
    if(c.parcelasSemCartao) linha(L('pierre.planoParcelaSemCartao').replace('{n}',c.parcelasSemCartao));
    if(c.faturasComItens) linha(L('pierre.planoFaturaReconcilia').replace('{n}',c.faturasComItens));

    /* cada fatura, com o mês e de onde o número veio: é o que permite conferir
       antes de deixar entrar, em vez de confiar num total */
    if(c.faturas.length){
      const detalhe=document.createElement('div');
      detalhe.hidden=true;
      caixa.appendChild(detalhe);
      c.faturas.forEach(f=>{
        const d=document.createElement('div');
        d.className='pierre-amostra';
        const fonte=f.origem==='banco'||f.origem==='banco-paga'?L('pierre.fonteBanco')
          :f.origem==='saldo'?L('pierre.fonteSaldo'):L('pierre.fonteParcelas');
        d.textContent=String(f.mes).padStart(2,'0')+'/'+f.ano+' · '
          +formatBRL(f.valor)+' · '+fonte
          +(f.origem==='banco-paga'?' · '+L('pierre.fonteJaPaga'):'');
        detalhe.appendChild(d);
      });
      const verF=document.createElement('button');
      verF.type='button';
      verF.className='pierre-ver-todos';
      verF.setAttribute('aria-expanded','false');
      verF.textContent=L('pierre.verFaturas').replace('{n}',c.faturas.length);
      verF.addEventListener('click',()=>{
        detalhe.hidden=!detalhe.hidden;
        verF.setAttribute('aria-expanded',detalhe.hidden?'false':'true');
        verF.textContent=detalhe.hidden
          ? L('pierre.verFaturas').replace('{n}',c.faturas.length)
          : L('pierre.verMenos');
      });
      caixa.appendChild(verF);
    }

    linha(L('pierre.planoFaturaFonte'),'pierre-amostra');
  }

  /* ── os gastos fixos, para marcar ── */
  if(plano.fixos&&plano.fixos.length){
    const sub=document.createElement('div');
    sub.className='ia-envio-titulo pierre-plano-sub';
    sub.textContent=L('pierre.planoFixosTitulo');
    caixa.appendChild(sub);
    linha(L('pierre.planoFixosAjuda'));
    const lista=document.createElement('div');
    lista.className='pierre-contas';
    lista.id='pierre-fixos-lista';
    caixa.appendChild(lista);
    plano.fixos.forEach((g,i)=>{
      const item=document.createElement('label');
      item.className='pierre-conta';
      const marca=document.createElement('input');
      marca.type='checkbox';
      marca.value=String(i);
      /* nasce DESMARCADO: conta fixa entra na projeção de todo mês seguinte,
         e isto aqui é palpite lido do extrato, não fato declarado pelo banco */
      marca.checked=false;
      item.appendChild(marca);
      const nome=document.createElement('span');
      nome.className='pierre-conta-nome';
      nome.textContent=g.nome;
      item.appendChild(nome);
      const val=document.createElement('span');
      val.className='pierre-conta-tipo';
      val.textContent=formatBRL(g.valor)+' · '
        +L('pierre.planoFixoDia').replace('{d}',g.diaDoMes)
        +(g.cartao?' · '+L('pierre.planoFixoCartao'):'');
      item.appendChild(val);
      lista.appendChild(item);
    });
  }

  /* Três linhas bastam pra reconhecer o extrato, e não bastam pra conferir o
     que vai entrar. Mostra três e abre o resto a um toque: quem confia segue,
     quem quer olhar item a item consegue. */
  const AMOSTRA=3;
  const linhaDoLancamento=t=>(t.tipo==='receita'?'+ ':'− ')
    +formatBRL(t.valor)+' · '+t.nome+' · '+t.data
    +(t.categoria?' · '+t.categoria:'');

  plano.novas.slice(0,AMOSTRA).forEach(t=>linha(linhaDoLancamento(t),'pierre-amostra'));

  if(plano.novas.length>AMOSTRA){
    const resto=document.createElement('div');
    resto.hidden=true;
    caixa.appendChild(resto);
    plano.novas.slice(AMOSTRA).forEach(t=>{
      const d=document.createElement('div');
      d.className='pierre-amostra';
      d.textContent=linhaDoLancamento(t);
      resto.appendChild(d);
    });
    const ver=document.createElement('button');
    ver.type='button';
    ver.className='pierre-ver-todos';
    ver.setAttribute('aria-expanded','false');
    ver.textContent=L('pierre.verTodos').replace('{n}',plano.novas.length-AMOSTRA);
    ver.addEventListener('click',()=>{
      resto.hidden=!resto.hidden;
      ver.setAttribute('aria-expanded',resto.hidden?'false':'true');
      ver.textContent=resto.hidden
        ? L('pierre.verTodos').replace('{n}',plano.novas.length-AMOSTRA)
        : L('pierre.verMenos');
    });
    caixa.appendChild(ver);
  }

  const acoes=document.createElement('div');
  acoes.className='pierre-plano-acoes';
  caixa.appendChild(acoes);

  const confirmar=document.createElement('button');
  confirmar.type='button';
  confirmar.className='add-gasto-confirm';
  confirmar.textContent=L('pierre.confirmar');
  acoes.appendChild(confirmar);

  const cancelar=document.createElement('button');
  cancelar.type='button';
  cancelar.className='reset-btn';
  cancelar.textContent=L('btn.cancelar');
  acoes.appendChild(cancelar);

  const temCartao=!!(plano.cartao&&plano.cartao.cartoes.length);
  const temFixos=!!(plano.fixos&&plano.fixos.length);
  const temConciliar=!!(plano.conciliadas&&plano.conciliadas.length);
  const nadaAFazer=plano.novas.length===0&&plano.diferencaDeSaldo===0
    &&!temCartao&&!temFixos&&!temConciliar;
  if(nadaAFazer){ confirmar.disabled=true; confirmar.textContent=L('pierre.nadaNovo'); }

  cancelar.addEventListener('click',()=>{ caixa.hidden=true; caixa.innerHTML=''; });
  umEnvioPorVez(confirmar,async()=>{
    /* desmarcada = não é o mesmo: volta a ser lançamento novo */
    if(plano.conciliadas&&plano.conciliadas.length){
      const marcas=[...caixa.querySelectorAll('#pierre-concilia-lista input')];
      marcas.forEach((m,i)=>{
        const par=plano.conciliadas[i];
        if(!par) return;
        par.dispensada=!m.checked;
        if(par.dispensada&&!plano.novas.includes(par.doBanco)) plano.novas.push(par.doBanco);
      });
    }
    const r=aplicarSincronizacaoPierre(plano);
    let doCartao=null, fixos={criados:0,ids:[]};
    if(plano.cartao) doCartao=aplicarCartaoPierre(plano.cartao);
    if(plano.fixos&&plano.fixos.length){
      const marcados=[...caixa.querySelectorAll('#pierre-fixos-lista input:checked')]
        .map(i=>plano.fixos[Number(i.value)]).filter(Boolean);
      fixos=aplicarGastosFixosPierre(marcados,todayISO());
    }
    /* o rastro é gravado ANTES do persist: se a gravação falhar, o rastro cai
       junto com o resto, e não sobra um "desfazer" apontando pro nada */
    registrarImportacaoPierre({sinc:r,cartao:doCartao,fixos});
    await persist(); render();
    caixa.hidden=true; caixa.innerHTML='';
    /* o achado virou lançamento: a faixa do Resumo não tem mais o que oferecer */
    pierrePlanoPendente=null;
    pierreDesenharAviso();
    pierreDesenharHistorico();
    let aviso=L('pierre.pronto').replace('{n}',r.lancadas);
    if(r.jaEstavam) aviso+=' '+L('pierre.prontoJaEstavam').replace('{n}',r.jaEstavam);
    if(r.conciliadas) aviso+=' '+L('pierre.prontoConciliadas').replace('{n}',r.conciliadas);
    if(doCartao&&doCartao.estourando&&doCartao.estourando.length){
      aviso+=' '+L('pierre.prontoEstouro').replace('{n}',doCartao.estourando.length);
    }
    if(doCartao&&(doCartao.criados||doCartao.faturasNovas)){
      aviso+=' '+L('pierre.prontoCartao')
        .replace('{c}',doCartao.criados).replace('{f}',doCartao.faturasNovas);
    }
    if(fixos.criados) aviso+=' '+L('pierre.prontoFixos').replace('{n}',fixos.criados);
    pierreEstado(aviso,'ok');
    pierreMostrarDesfazer();
  });
}

/* As contas que existem do outro lado, com uma caixa cada. Lista vazia em
   `data.pierreContas` quer dizer TODAS — é como a integração se comporta antes
   de alguém escolher, e é o que mantém quem já usava sem surpresa. */
function pierreDesenharContas(contas){
  const caixa=document.getElementById('pierre-contas-lista');
  const bloco=document.getElementById('pierre-escolhas');
  if(!caixa||!bloco) return;
  caixa.innerHTML='';
  bloco.style.display=contas.length?'block':'none';
  const escolhidas=data.pierreContas||[];

  contas.forEach(c=>{
    const linha=document.createElement('label');
    linha.className='pierre-conta';

    const marca=document.createElement('input');
    marca.type='checkbox';
    marca.value=c.id;
    /* nada escolhido = tudo escolhido */
    marca.checked=!escolhidas.length||escolhidas.includes(c.id);
    linha.appendChild(marca);

    const texto=document.createElement('span');
    texto.className='pierre-conta-nome';
    /* nome de banco e de conta vêm de fora: texto, nunca marcação */
    texto.textContent=[c.connectorName,nomeDaContaPierre(c)]
      .filter(Boolean).join(' · ')||L('pierre.contaSemNome');
    linha.appendChild(texto);

    const tipo=document.createElement('span');
    tipo.className='pierre-conta-tipo';
    tipo.textContent=contaEhBanco(c)?formatBRL(numeroDoPierre(c.balance)):L('pierre.naoEhConta');
    linha.appendChild(tipo);

    marca.addEventListener('change',async()=>{
      /* A lista guardada é sempre a lista MARCADA, inteira. Antes, "todas
         marcadas" virava vazio para que conta nova entrasse sozinha — mas
         vazio também era o que sobrava ao desmarcar tudo, e aí o app trazia
         justamente o extrato inteiro que a pessoa acabara de dispensar.
         Agora vazio quer dizer nenhuma, e conta nova aparece desmarcada com o
         plano avisando — de fora sabendo, em vez de dentro sem querer. */
      data.pierreContas=[...caixa.querySelectorAll('input:checked')].map(i=>i.value);
      data.pierreContasDefinidas=true;
      await persist();
    });

    caixa.appendChild(linha);
  });
}

/* O botão de desfazer só existe quando há o que desfazer, e diz o que vai tirar
   antes de tirar. */
function pierreMostrarDesfazer(){
  const botao=document.getElementById('pierre-desfazer-btn');
  const resumo=document.getElementById('pierre-desfazer-resumo');
  if(!botao||!resumo) return;
  const r=resumoDaUltimaImportacaoPierre();
  if(!r||(!r.lancamentos&&!r.faturas&&!r.gastosFixos&&!r.cartoes&&r.saldoVolta===null)){
    botao.style.display='none';
    resumo.textContent='';
    return;
  }
  botao.style.display='block';
  const partes=[];
  if(r.lancamentos) partes.push(L('pierre.desfazLancamentos').replace('{n}',r.lancamentos));
  if(r.faturas) partes.push(L('pierre.desfazFaturas').replace('{n}',r.faturas));
  if(r.cartoes) partes.push(L('pierre.desfazCartoes').replace('{n}',r.cartoes));
  if(r.gastosFixos) partes.push(L('pierre.desfazFixos').replace('{n}',r.gastosFixos));
  if(r.saldoVolta!==null) partes.push(L('pierre.desfazSaldo').replace('{v}',formatBRL(r.saldoVolta)));
  let texto=partes.join(' · ');
  if(r.faturasComGastoSeu){
    texto+=' — '+L('pierre.desfazGuardadas').replace('{n}',r.faturasComGastoSeu);
  }
  resumo.textContent=texto;
}

/* ── O que o banco tem de novo, no Resumo ────────────────────────────────

   A busca ao abrir existe para poupar o caminho até Configurações. Desenhar o
   resultado DENTRO de Configurações desfazia o próprio motivo dela: gastava a
   chamada e não entregava nada, porque o app abre no Resumo.

   Então o achado aparece aqui, com um toque para ver o plano inteiro. Continua
   sem gravar nada sozinho. */
function pierreDesenharAviso(){
  const el=document.getElementById('pierre-aviso');
  if(!el) return;
  el.innerHTML='';

  /* Falhar calado era o jeito de o app enganar por omissão: se a chave morre, a
     faixa simplesmente para de aparecer e a pessoa conclui que não houve
     movimentação. Silêncio e "não tem nada" ficam idênticos na tela. */
  if(pierreFalhaAoAbrir){
    const erro=document.createElement('div');
    erro.className='banco-banner banco-banner-erro';
    const t=document.createElement('span');
    t.className='banco-banner-texto';
    t.textContent='\u{1F3E6} '+L('pierre.avisoFalhou').replace('{motivo}',pierreFalhaAoAbrir);
    erro.appendChild(t);
    const abrir=document.createElement('button');
    abrir.type='button';
    abrir.className='banco-banner-btn';
    abrir.textContent=L('pierre.avisoResolver');
    abrir.addEventListener('click',()=>{
      document.getElementById('topbar-settings-btn')?.click();
      setTimeout(()=>document.getElementById('settings-tab-banco')?.click(),400);
    });
    erro.appendChild(abrir);
    const x=document.createElement('button');
    x.type='button';
    x.className='banco-banner-fechar';
    x.textContent='\u2715';
    x.title=L('btn.fechar');
    x.setAttribute('aria-label',L('btn.fechar'));
    x.addEventListener('click',()=>{ pierreFalhaAoAbrir=null; pierreDesenharAviso(); });
    erro.appendChild(x);
    el.appendChild(erro);
    return;
  }

  const p=pierrePlanoPendente;
  if(!p) return;

  const novas=p.novas.length;
  const mexeNoSaldo=p.trazerSaldo&&Math.abs(p.diferencaDeSaldo)>=0.01;
  const temCartao=!!(p.cartao&&p.cartao.cartoes.length);
  const temFixos=!!(p.fixos&&p.fixos.length);
  if(!novas&&!mexeNoSaldo&&!temCartao&&!temFixos) return;

  const faixa=document.createElement('div');
  faixa.className='banco-banner';

  const texto=document.createElement('span');
  texto.className='banco-banner-texto';
  const partes=[];
  if(novas) partes.push(L('pierre.avisoLancamentos').replace('{n}',novas));
  if(mexeNoSaldo) partes.push(L('pierre.avisoSaldo').replace('{v}',formatBRL(p.saldo)));
  if(temFixos) partes.push(L('pierre.avisoFixos').replace('{n}',p.fixos.length));
  texto.textContent='🏦 '+partes.join(' · ');
  faixa.appendChild(texto);

  const ver=document.createElement('button');
  ver.type='button';
  ver.className='banco-banner-btn';
  ver.textContent=L('pierre.avisoVer');
  ver.addEventListener('click',()=>{
    document.getElementById('topbar-settings-btn')?.click();
    setTimeout(()=>{
      document.getElementById('settings-tab-banco')?.click();
      setTimeout(()=>{
        if(pierrePlanoPendente) pierreDesenharPlano(pierrePlanoPendente);
        document.getElementById('pierre-plano')?.scrollIntoView({block:'center'});
      },250);
    },400);
  });
  faixa.appendChild(ver);

  const fechar=document.createElement('button');
  fechar.type='button';
  fechar.className='banco-banner-fechar';
  fechar.textContent='✕';
  fechar.title=L('btn.fechar');
  fechar.setAttribute('aria-label',L('btn.fechar'));
  fechar.addEventListener('click',()=>{ pierrePlanoPendente=null; pierreDesenharAviso(); });
  faixa.appendChild(fechar);

  el.appendChild(faixa);
}

/* Busca sem abrir folha nenhuma. Devolve o plano em vez de desenhá-lo: quem
   chama decide onde mostrar. */
async function pierreBuscarPlano(){
  const contas=await buscarContasPierre();
  const desde=data.pierreSincronizadoEm
    ? isoDate(new Date(new Date(data.pierreSincronizadoEm).getTime()-7*86400000))
    : '';
  const {lista}=await buscarTransacoesPierre(desde,todayISO());
  const escolhidas=data.pierreContas||[];
  const definidas=data.pierreContasDefinidas===true;
  const plano=planoDeSincronizacaoPierre(contas.contas,lista,{
    contas:escolhidas, definidas,
    trazerSaldo:data.pierreTrazerSaldo!==false,
    trazerLancamentos:data.pierreTrazerLancamentos!==false,
  });
  plano._contas=contas.contas;
  return plano;
}

/* A folga entre uma busca automática e a seguinte. Extrato de banco não muda
   de minuto em minuto, e cada abertura custa de uma a quatro chamadas. */
const PIERRE_FOLGA_HORAS=6;

function pierrePodeBuscarAoAbrir(){
  if(data.pierreBuscarAoAbrir!==true||data.pierreAtivo!==true) return false;
  if(!chavePierreParece(getPierreChave())) return false;
  const ultima=data.pierreBuscadoEm?new Date(data.pierreBuscadoEm).getTime():0;
  return !ultima||(Date.now()-ultima)>=PIERRE_FOLGA_HORAS*3600000;
}

/* O histórico: o que cada importação fez, e quando. Não desfaz nada — desfazer
   continua valendo só para a última. Serve para responder "de onde veio isto?"
   sem ter que reconstruir de cabeça. */
function pierreDesenharHistorico(){
  const el=document.getElementById('pierre-historico');
  if(!el) return;
  const lista=(data.pierreHistorico||[]);
  el.innerHTML='';
  if(!lista.length) return;

  const titulo=document.createElement('div');
  titulo.className='sheet-section-label';
  titulo.textContent=L('pierre.historicoTitulo');
  el.appendChild(titulo);

  lista.forEach(h=>{
    const d=document.createElement('div');
    d.className='pierre-amostra';
    const quando=h.em?new Date(h.em).toLocaleString(localeAtual(),
      {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
    const partes=[];
    if(h.lancamentos) partes.push(L('pierre.desfazLancamentos').replace('{n}',h.lancamentos));
    if(h.conciliados) partes.push(L('pierre.histConciliados').replace('{n}',h.conciliados));
    if(h.faturas) partes.push(L('pierre.desfazFaturas').replace('{n}',h.faturas));
    if(h.cartoes) partes.push(L('pierre.desfazCartoes').replace('{n}',h.cartoes));
    if(h.fixos) partes.push(L('pierre.desfazFixos').replace('{n}',h.fixos));
    if(!partes.length) partes.push(L('pierre.histNada'));
    d.textContent=quando+' · '+partes.join(' · ');
    el.appendChild(d);
  });
}

function setupPierre(){
  const check=document.getElementById('pierre-ativo-check');
  const campos=document.getElementById('pierre-campos');
  const entrada=document.getElementById('pierre-chave-input');
  const verBtn=document.getElementById('pierre-chave-ver');
  const lembrar=document.getElementById('pierre-lembrar-check');
  const verificar=document.getElementById('pierre-verificar-btn');
  const sync=document.getElementById('pierre-sync-btn');
  if(!check||!campos) return;

  check.addEventListener('change',async e=>{
    if(definirPreferenciaBooleana('pierreAtivo',e.target.checked)===null) return;
    /* desligar apaga a chave: guardar credencial de banco de um recurso que a
       pessoa acabou de dispensar não serve a ninguém */
    if(!e.target.checked){
      esquecerPierreChave();
      if(entrada) entrada.value='';
      pierreEstado('');
      const caixa=document.getElementById('pierre-plano');
      if(caixa){ caixa.hidden=true; caixa.innerHTML=''; }
    }
    vibrate(8);
    await persist(); render();
  });

  if(entrada) entrada.addEventListener('input',e=>{
    setPierreChave(e.target.value.trim());
    pierreEstado('');
    /* mexeu na chave: o motivo da falha anterior deixou de valer */
    pierreFalhaAoAbrir=null;
    render();
  });

  if(verBtn) verBtn.addEventListener('click',e=>{
    const mostrando=entrada.type==='text';
    entrada.type=mostrando?'password':'text';
    const b=e.currentTarget;
    b.setAttribute('aria-pressed',mostrando?'false':'true');
    b.title=L(mostrando?'tt.mostrarChave':'tt.ocultarChave');
    entrada.focus();
  });

  const saldoCheck=document.getElementById('pierre-saldo-check');
  const lancCheck=document.getElementById('pierre-lanc-check');
  const cartaoCheck=document.getElementById('pierre-cartao-check');
  const fixosCheck=document.getElementById('pierre-fixos-check');
  const abrirCheck=document.getElementById('pierre-abrir-check');
  [[saldoCheck,'pierreTrazerSaldo'],[lancCheck,'pierreTrazerLancamentos'],
   [cartaoCheck,'pierreTrazerCartao'],[fixosCheck,'pierreTrazerFixos'],
   [abrirCheck,'pierreBuscarAoAbrir']].forEach(([el,chave])=>{
    if(!el) return;
    el.addEventListener('change',async e=>{
      if(definirPreferenciaBooleana(chave,e.target.checked)===null) return;
      vibrate(6);
      await persist(); render();
      /* "Buscar ao abrir" depende da chave sobreviver ao fechar o app, e por
         padrão ela mora só na sessão. Sem avisar, a opção fica verde na tela
         sem nunca rodar — ligada e inútil é pior que desligada. */
      if(chave==='pierreBuscarAoAbrir'&&e.target.checked&&!lembrarPierreChave()){
        if(await confirmDialog({text:L('pierre.abrirPrecisaLembrar')})){
          definirLembrarPierreChave(true);
          const lembrarEl=document.getElementById('pierre-lembrar-check');
          if(lembrarEl) lembrarEl.checked=true;
          render();
        }
      }
    });
  });

  if(lembrar) lembrar.addEventListener('change',e=>{
    definirLembrarPierreChave(e.target.checked);
    vibrate(6); render();
  });

  if(verificar) umEnvioPorVez(verificar,async()=>{
    if(!chavePierreParece(getPierreChave())){
      pierreEstado(L('pierre.chaveCurta'),'erro'); return;
    }
    pierreEstado(L('pierre.verificando'));
    try{
      const r=await validarChavePierre();
      if(!r.quantas){ pierreEstado(L('pierre.semContas'),'erro'); return; }
      pierreEstado(L('pierre.contasOk')
        .replace('{n}',r.quantas)
        .replace('{bancos}',r.instituicoes.join(', ')||'—'),'ok');
      pierreDesenharContas(r.contas);
      if(sync) sync.style.display='block';
    }catch(e){ pierreEstado(pierreDizOErro(e),'erro'); }
  });

  /* Buscar ao abrir. Só com a opção ligada, a integração ativa, a chave já no
     aparelho e a folga cumprida. NÃO grava: deixa o achado no Resumo, e quem
     confirma continua sendo quem está lendo. */
  if(pierrePodeBuscarAoAbrir()){
    setTimeout(async()=>{
      try{
        const plano=await pierreBuscarPlano();
        if(data.pierreTrazerCartao===true){
          const doCartao=plano._contas;
          const faturas=await buscarFaturasPierre();
          const desdeLonge=isoDate(new Date(new Date().getTime()-540*86400000));
          const parcelas=await buscarParcelasPierre(desdeLonge,todayISO());
          const {lista:extratoLongo}=await buscarTransacoesPierre(desdeLonge,todayISO());
          plano.cartao=planoDoCartaoPierre(doCartao,faturas,parcelas,todayISO(),extratoLongo);
        }
        pierrePlanoPendente=plano;
        data.pierreBuscadoEm=new Date().toISOString();
        await persist();
        pierreDesenharAviso();
      }catch(e){
        /* Não é diálogo na cara de quem só abriu o app — é uma faixa, do mesmo
           tamanho das outras, dizendo o que houve. Chave recusada e assinatura
           vencida a pessoa PRECISA saber; falta de rede, não: isso se resolve
           sozinho e avisar seria ruído. */
        const codigo=e&&e.codigo;
        if(codigo!=='sem-ponte'&&codigo!=='demorou'&&codigo!=='sem-resposta'){
          pierreFalhaAoAbrir=pierreDizOErro(e);
        }
        data.pierreBuscadoEm=new Date().toISOString();
        await persist();
        pierreDesenharAviso();
      }
    },1500);
  }

  const desfazer=document.getElementById('pierre-desfazer-btn');
  if(desfazer) umEnvioPorVez(desfazer,async()=>{
    const r=resumoDaUltimaImportacaoPierre();
    if(!r) { pierreMostrarDesfazer(); return; }
    const pergunta=L('pierre.desfazConfirma')
      .replace('{n}',r.lancamentos)
      .replace('{f}',r.faturas);
    if(!(await confirmDialog({text:pergunta}))) return;
    const feito=desfazerImportacaoPierre();
    await persist(); render();
    pierreMostrarDesfazer();
    pierreDesenharHistorico();
    if(feito){
      let aviso=L('pierre.desfeito').replace('{n}',feito.lancamentos);
      if(feito.faturasGuardadas||feito.cartoesGuardados){
        aviso+=' '+L('pierre.desfeitoGuardou')
          .replace('{f}',feito.faturasGuardadas)
          .replace('{c}',feito.cartoesGuardados);
      }
      pierreEstado(aviso,'ok');
    }
  });

  /* ao abrir a tela, se houve importação, o caminho de volta já está à vista */
  pierreMostrarDesfazer();
  pierreDesenharHistorico();

  if(sync) umEnvioPorVez(sync,async()=>{
    pierreEstado(L('pierre.buscando'));
    try{
      const contas=await buscarContasPierre();
      /* desde a última vez, com uma semana de folga pra pegar o que o banco
         só liberou depois; o id externo cuida das repetidas */
      const desde=data.pierreSincronizadoEm
        ? isoDate(new Date(new Date(data.pierreSincronizadoEm).getTime()-7*86400000))
        : '';
      const {lista}=await buscarTransacoesPierre(desde,todayISO());
      pierreDesenharContas(contas.contas);
      const escolhidas=data.pierreContas||[];
      const definidas=data.pierreContasDefinidas===true;
      const plano=planoDeSincronizacaoPierre(contas.contas,lista,{
        contas:escolhidas, definidas,
        trazerSaldo:data.pierreTrazerSaldo!==false,
        trazerLancamentos:data.pierreTrazerLancamentos!==false,
      });

      /* O cartao pede duas chamadas a mais, e so as faz se estiver ligado:
         quem nao usa cartao nao espera por elas. */
      if(data.pierreTrazerCartao===true){
        /* o cartão também obedece a escolha de contas: dispensar um cartão na
           lista e vê-lo aparecer assim mesmo seria a escolha não valer */
        const doCartao=definidas
          ? contas.contas.filter(c=>escolhidas.includes(c.id))
          : contas.contas;
        const faturas=(await buscarFaturasPierre())
          .filter(f=>!definidas||escolhidas.includes(String(f.accountId||'')));
        /* janela larga de proposito: parcela de compra antiga ainda esta
           caindo hoje, e `startDate` em branco faz o Pierre olhar so 3 meses */
        const desdeLonge=isoDate(new Date(new Date().getTime()-540*86400000));
        const parcelas=await buscarParcelasPierre(desdeLonge,todayISO());
        /* o pagamento de fatura mora no extrato do cartão, e a janela curta da
           sincronização não alcança as faturas fechadas do ano */
        const {lista:extratoLongo}=await buscarTransacoesPierre(desdeLonge,todayISO());
        plano.cartao=planoDoCartaoPierre(doCartao,faturas,parcelas,todayISO(),extratoLongo);
      }

      /* Sugestao de gasto fixo sai do MESMO extrato que ja veio: nao custa
         chamada nenhuma, so leitura. Uma janela curta acha pouco, entao pede
         o historico mais longo quando a opcao esta ligada. */
      if(data.pierreTrazerFixos===true){
        const {lista:historico}=await buscarTransacoesPierre(
          isoDate(new Date(new Date().getTime()-180*86400000)),todayISO());
        /* o cartão do Pierre, se já existe aqui: assinatura cobrada no
           crédito precisa apontar para ele, senão o dinheiro sairia da conta
           no dia em vez de entrar na fatura */
        const doPierre=(data.cartoes||[]).find(k=>k.idExterno);
        plano.fixos=sugerirGastosFixosPierre(historico,todayISO(),
          doPierre?doPierre.id:null);
      }

      pierreEstado('');
      pierreDesenharPlano(plano);
    }catch(e){ pierreEstado(pierreDizOErro(e),'erro'); }
  });
}
