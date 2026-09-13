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
      val.textContent=formatBRL(g.valor)+' · '+L('pierre.planoFixoDia').replace('{d}',g.diaDoMes);
      item.appendChild(val);
      lista.appendChild(item);
    });
  }

  /* as três primeiras, pra conferir que é mesmo o extrato certo */
  plano.novas.slice(0,3).forEach(t=>{
    linha((t.tipo==='receita'?'+ ':'− ')+formatBRL(t.valor)+' · '+t.nome+' · '+t.data,'pierre-amostra');
  });
  if(plano.novas.length>3) linha(L('pierre.planoEMais').replace('{n}',plano.novas.length-3),'pierre-amostra');

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
  const nadaAFazer=plano.novas.length===0&&plano.diferencaDeSaldo===0&&!temCartao&&!temFixos;
  if(nadaAFazer){ confirmar.disabled=true; confirmar.textContent=L('pierre.nadaNovo'); }

  cancelar.addEventListener('click',()=>{ caixa.hidden=true; caixa.innerHTML=''; });
  umEnvioPorVez(confirmar,async()=>{
    const r=aplicarSincronizacaoPierre(plano);
    let doCartao=null, fixos={criados:0};
    if(plano.cartao) doCartao=aplicarCartaoPierre(plano.cartao);
    if(plano.fixos&&plano.fixos.length){
      const marcados=[...caixa.querySelectorAll('#pierre-fixos-lista input:checked')]
        .map(i=>plano.fixos[Number(i.value)]).filter(Boolean);
      fixos=aplicarGastosFixosPierre(marcados,todayISO());
    }
    await persist(); render();
    caixa.hidden=true; caixa.innerHTML='';
    let aviso=L('pierre.pronto').replace('{n}',r.lancadas);
    if(doCartao&&(doCartao.criados||doCartao.faturasNovas)){
      aviso+=' '+L('pierre.prontoCartao')
        .replace('{c}',doCartao.criados).replace('{f}',doCartao.faturasNovas);
    }
    if(fixos.criados) aviso+=' '+L('pierre.prontoFixos').replace('{n}',fixos.criados);
    pierreEstado(aviso,'ok');
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
      const marcadas=[...caixa.querySelectorAll('input:checked')].map(i=>i.value);
      const todas=contas.length;
      /* todas marcadas volta a ser "vazio = todas": assim, uma conta nova que
         apareça depois no Pierre entra sozinha, em vez de ficar de fora calada */
      data.pierreContas=marcadas.length===todas?[]:marcadas;
      await persist();
    });

    caixa.appendChild(linha);
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

  /* Buscar ao abrir. Só com a opção ligada, a integração ativa e a chave já no
     aparelho — sem a chave não há o que buscar, e pedir para colar no meio da
     abertura seria pior que não fazer nada. NÃO grava: só deixa o plano pronto
     na tela, e quem confirma continua sendo quem está lendo. */
  if(data.pierreBuscarAoAbrir===true&&data.pierreAtivo===true
     &&chavePierreParece(getPierreChave())&&sync){
    setTimeout(()=>{ if(!sync.disabled) sync.click(); },1500);
  }

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
      const plano=planoDeSincronizacaoPierre(contas.contas,lista,{
        contas:data.pierreContas||[],
        trazerSaldo:data.pierreTrazerSaldo!==false,
        trazerLancamentos:data.pierreTrazerLancamentos!==false,
      });

      /* O cartao pede duas chamadas a mais, e so as faz se estiver ligado:
         quem nao usa cartao nao espera por elas. */
      if(data.pierreTrazerCartao===true){
        const faturas=await buscarFaturasPierre();
        /* janela larga de proposito: parcela de compra antiga ainda esta
           caindo hoje, e `startDate` em branco faz o Pierre olhar so 3 meses */
        const parcelas=await buscarParcelasPierre(
          isoDate(new Date(new Date().getTime()-540*86400000)),todayISO());
        plano.cartao=planoDoCartaoPierre(contas.contas,faturas,parcelas,todayISO());
      }

      /* Sugestao de gasto fixo sai do MESMO extrato que ja veio: nao custa
         chamada nenhuma, so leitura. Uma janela curta acha pouco, entao pede
         o historico mais longo quando a opcao esta ligada. */
      if(data.pierreTrazerFixos===true){
        const {lista:historico}=await buscarTransacoesPierre(
          isoDate(new Date(new Date().getTime()-180*86400000)),todayISO());
        plano.fixos=sugerirGastosFixosPierre(historico,todayISO());
      }

      pierreEstado('');
      pierreDesenharPlano(plano);
    }catch(e){ pierreEstado(pierreDizOErro(e),'erro'); }
  });
}
