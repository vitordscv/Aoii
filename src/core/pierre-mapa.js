/* ── De-Para: o que o Pierre devolve vira o que o Aoii guarda ──────────────

   Três decisões que valem mais que o código:

   1. **Só entra o que sai da conta.** O Pierre devolve transações de todos os
      tipos de conta, cartão de crédito incluído. No Aoii, compra no crédito
      mora dentro da fatura, não no Diário — e o guia é claro: renda e gasto
      entram uma vez por mês, nunca uma vez por fatura. Trazer as do cartão
      para `transacoes` contaria o mesmo real duas vezes, uma no Diário e
      outra na fatura. Então ficam de fora, e a rotina diz quantas ficaram.

   2. **Cada lançamento carrega de onde veio.** `idExterno` guarda o id do
      Pierre. Sem isso, sincronizar duas vezes duplicaria tudo — e ninguém
      sincroniza uma vez só.

   3. **O saldo é a soma das contas de banco.** Cartão tem saldo negativo
      (é dívida) e investimento não é dinheiro em conta; somar os três daria
      um número que não existe em lugar nenhum. */

/* O Pierre categoriza sozinho e em português. A ordem é: primeiro o que a
   pessoa já usa no Aoii, depois esta tabela, e por fim Outros.

   As entradas marcadas (real) são nomes que a API devolveu de verdade, vistos
   num extrato com chave real. As outras são palpites razoáveis que ficam como
   rede. Quando aparecer um nome novo caindo em Outros, o lugar de consertar é
   aqui — e vale conferir antes de escrever, porque a primeira versão desta
   tabela foi escrita de cabeça e acertava pouco.

   Transferência e PIX ficam em Outros de propósito: um PIX pode ser aluguel
   ou pode ser racha de pizza, e a API não diz qual. Chutar Casa em 25
   lançamentos estragaria o relatório do mês inteiro. */
const PIERRE_CATEGORIAS = {
  /* comida */
  'alimentacao': 'Mercado',
  'alimentacao e bebidas': 'Mercado',
  'supermercado': 'Mercado',
  'mercado': 'Mercado',
  'restaurantes': 'Mercado',
  'restaurantes, bares e lanchonetes': 'Mercado',      /* real */
  'delivery': 'Mercado',
  /* transporte */
  'transporte': 'Transporte',
  'combustivel': 'Transporte',
  'taxi e transporte privado urbano': 'Transporte',    /* real */
  'transporte publico': 'Transporte',
  'estacionamento': 'Transporte',
  /* lazer */
  'lazer': 'Lazer',
  'entretenimento': 'Lazer',
  'livraria': 'Lazer',                                 /* real */
  'streaming': 'Lazer',
  'viagem': 'Lazer',
  /* saude */
  'saude': 'Saúde',
  'bem-estar': 'Saúde',                                /* real */
  'farmacia': 'Saúde',
  'academia': 'Saúde',
  /* casa e contas */
  'moradia': 'Casa',
  'casa': 'Casa',
  'servicos': 'Casa',                                  /* real */
  'telecomunicacao': 'Casa',                           /* real */
  'energia eletrica': 'Casa',
  'agua': 'Casa',
  'internet': 'Casa',
  /* sem categoria natural no Aoii */
  'compras': 'Outros',                                 /* real */
  'transferencias': 'Outros',                          /* real */
  'transferencia - pix': 'Outros',                     /* real */
  'estorno': 'Outros',                                 /* real */
  'investimentos': 'Outros',                           /* real */
  'pagamento de cartao de credito': 'Outros',          /* real */
  'educacao': 'Outros',
  'vestuario': 'Outros',
  'outros': 'Outros',
};

function semAcento(t){
  return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

/* A categoria que a PESSOA usa ganha da tabela: quem criou "Rolê" no Aoii não
   quer ver "Lazer" aparecendo do lado. */
function categoriaDoPierre(nome){
  const limpo=semAcento(nome);
  if(!limpo) return 'Outros';
  const doUsuario=(CATS()||[]).find(c=>semAcento(c)===limpo);
  if(doUsuario) return doUsuario;
  const daTabela=PIERRE_CATEGORIAS[limpo];
  if(daTabela&&(CATS()||[]).includes(daTabela)) return daTabela;
  return 'Outros';
}

/* O Aoii guarda valor sempre positivo e diz o sentido em `tipo`. O Pierre usa
   sinal no `amount` E um campo `type`; quando os dois discordam, o `type` é
   quem manda, porque é o campo declarado. */
function ehEntradaNoPierre(t){
  const tipo=String(t&&t.type||'').toUpperCase();
  if(tipo==='CREDIT') return true;
  if(tipo==='DEBIT') return false;
  return Number(t&&t.amount||0)>0;
}

function ehDeCartao(t){
  const tipo=String(t&&t.account_type||t&&t.accountType||'').toUpperCase();
  const sub=String(t&&t.account_subtype||t&&t.accountSubtype||'').toUpperCase();
  return tipo==='CREDIT'||sub==='CREDIT_CARD';
}

/* Lançamento que o banco ainda não confirmou muda de valor — a gorjeta que
   entra depois, a compra que o estabelecimento ajusta. O pedido manda
   `includeStatus=POSTED` e mesmo assim vêm PENDING (conferido: 9 em 55), então
   a barreira fica aqui, onde não depende de a API obedecer. */
function aindaNaoCaiu(t){
  const st=String(t&&t.status||'').toUpperCase();
  return st==='PENDING'||st==='SCHEDULED';
}

/* Uma transação do Pierre no formato do Diário, ou `null` se não deve entrar. */
function transacaoDoPierre(t){
  if(!t||ehDeCartao(t)||aindaNaoCaiu(t)) return null;
  const valor=Math.abs(parseNum(t.amount));
  if(!Number.isFinite(valor)||valor<=0) return null;
  const dia=String(t.date||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const entrada=ehEntradaNoPierre(t);
  return {
    id:uid(),
    idExterno:String(t.id||''),
    tipo:entrada?'receita':'gasto',
    nome:String(t.description||'').trim()||L('pierre.semDescricao'),
    valor,
    data:dia,
    categoria:entrada?'Outros':categoriaDoPierre(t.category),
    /* nem débito nem pix dá pra distinguir no que o Pierre manda; `debito` é o
       que o Diário usa como padrão pra dinheiro que sai da conta */
    metodo:entrada?undefined:'debito',
  };
}

/* `get-accounts` devolve número de máquina em texto: "1268.01", ponto decimal,
   sempre duas casas. `parseNum()` é para número DIGITADO, onde "1.268" vale mil
   duzentos e sessenta e oito — aqui isso erraria por mil vezes. */
function numeroDoPierre(v){
  if(typeof v==='number') return Number.isFinite(v)?v:0;
  const n=Number(String(v==null?'':v).trim());
  return Number.isFinite(n)?n:0;
}

/* Os nomes dos campos de uma conta, conferidos contra a API de verdade:
   `id`, `name`, `customName`, `type`, `subtype`, `balance`, `connectorName`.
   Não são os mesmos das transações, que usam `account_id`, `account_type`… */
function contaEhBanco(c){
  return String(c&&c.type||'').toUpperCase()==='BANK';
}

function nomeDaContaPierre(c){
  if(!c) return '';
  return String(c.customName||c.name||c.marketingName||'').trim();
}

/* O saldo em conta: só as contas de banco. Cartão tem saldo também, e é
   dívida — somar os dois daria um número que não é nada. */
function saldoDoPierre(contas){
  return (contas||[])
    .filter(contaEhBanco)
    .reduce((s,c)=>s+numeroDoPierre(c.balance),0);
}

/* O que uma sincronização traria, sem ainda mexer em nada. Devolver o plano
   antes de aplicá-lo é o que permite mostrar à pessoa o que vai acontecer —
   e o que permite testar a conta sem gravar nada. */
function planoDeSincronizacaoPierre(contas,transacoes,escolhas){
  const {
    contas:escolhidas=null,        /* null ou vazio = todas */
    trazerLancamentos=true,
    trazerSaldo=true,
  }=escolhas||{};

  const todas=contas||[];
  const querTodas=!escolhidas||!escolhidas.length;
  const aceitas=querTodas?todas:todas.filter(c=>escolhidas.includes(c.id));

  /* O vinculo entre conta escolhida e transacao e o `account_id`, que casa com
     o `id` de `get-accounts` — conferido contra a API de verdade. O nome NAO
     serve: `account_name` na transacao e o nome do BANCO, igual para a conta
     corrente e para o cartao do mesmo banco. Filtrar por ele juntaria os dois.
     O nome fica so como ultimo recurso, para conta que venha sem id. */
  const idsAceitos=new Set(aceitas.map(c=>c.id).filter(Boolean));
  const nomesAceitos=new Set(aceitas.map(c=>semAcento(nomeDaContaPierre(c))).filter(Boolean));

  const jaTem=new Set((data.transacoes||[]).map(t=>t.idExterno).filter(Boolean));
  const novas=[], repetidas=[], doCartao=[], recusadas=[], deOutrasContas=[];

  (transacoes||[]).forEach(bruta=>{
    if(ehDeCartao(bruta)){ doCartao.push(bruta); return; }
    if(!trazerLancamentos) return;
    if(!querTodas){
      const id=String(bruta.account_id||bruta.accountId||'');
      const nome=semAcento(bruta.account_name||bruta.accountName);
      /* transacao que nao da pra atribuir a nenhuma conta escolhida fica de
         fora: adivinhar de qual conta ela e seria pior que deixar de fora */
      const daConta=id?idsAceitos.has(id):(!!nome&&nomesAceitos.has(nome));
      if(!daConta){ deOutrasContas.push(bruta); return; }
    }
    const pronta=transacaoDoPierre(bruta);
    if(!pronta){ recusadas.push(bruta); return; }
    if(pronta.idExterno&&jaTem.has(pronta.idExterno)){ repetidas.push(pronta); return; }
    if(pronta.idExterno) jaTem.add(pronta.idExterno);
    novas.push(pronta);
  });

  const deBanco=aceitas.filter(contaEhBanco);
  const saldo=saldoDoPierre(aceitas);
  return {
    novas, repetidas, doCartao, recusadas, deOutrasContas,
    trazerSaldo, trazerLancamentos,
    contasDeBanco:deBanco.length,
    instituicoes:[...new Set(aceitas.map(c=>c.connectorName).filter(Boolean))],
    saldo,
    saldoAtual:data.saldoAtual||0,
    diferencaDeSaldo:trazerSaldo?saldo-(data.saldoAtual||0):0,
  };
}

/* Aplica o plano. Fora do `planoDe…` de propósito: quem desenha a tela mostra
   o plano primeiro e só chama isto depois de a pessoa confirmar. */
function aplicarSincronizacaoPierre(plano,opcoes){
  if(!plano) return null;
  /* o plano ja carrega a escolha; `opcoes` so serve pra sobrepor na hora */
  const trazerSaldo=(opcoes&&'trazerSaldo' in opcoes)?opcoes.trazerSaldo
    :(plano.trazerSaldo!==false);
  if(!data.transacoes) data.transacoes=[];
  plano.novas.forEach(t=>{ data.transacoes.push(t); });
  if(trazerSaldo&&plano.contasDeBanco>0){
    data.saldoAtual=plano.saldo;
    data.saldoAtualizadoEm=new Date().toISOString();
  }
  data.pierreSincronizadoEm=new Date().toISOString();
  return {lancadas:plano.novas.length,saldoAtualizado:trazerSaldo&&plano.contasDeBanco>0};
}

/* ══ O CARTÃO ═══════════════════════════════════════════════════════════════

   Aqui vale uma regra que custou uma medição para descobrir: **cada mês tira o
   valor da fatura de UMA fonte só.** Medido na conta real:

       fatura 2026-08: o banco diz R$ 1.049,43
                       a soma das compras que a API devolve: R$ 317,63

   Não fecha, e não é erro de ninguém: juros, IOF, saldo anterior e a janela de
   busca fazem a fatura ser mais do que a lista de compras. Somar `valor` com
   `gastos[]` — que no Aoii se somam, veja `computeCartao()` — daria um número
   que não existe em lugar nenhum.

   Então, por mês, nesta ordem:

     1. tem fatura fechada no banco  → o valor é o do banco, ponto;
     2. é o mês corrente             → o valor é o saldo que o cartão informa,
                                       que é o que você deve hoje;
     3. é mês futuro                 → o valor é a soma das parcelas ainda não
                                       pagas que vencem nele.

   Nenhum mês soma duas fontes, e o plano diz de onde cada número veio. */

function diaDoIso(iso){
  const t=String(iso||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d=parseInt(t.slice(8,10),10);
  return d>=1&&d<=31?d:null;
}

function anoMesDoIso(iso){
  const t=String(iso||'').slice(0,7);
  if(!/^\d{4}-\d{2}$/.test(t)) return null;
  return {ano:parseInt(t.slice(0,4),10),mes:parseInt(t.slice(5,7),10)};
}

function contaEhCartao(c){
  const tipo=String(c&&c.type||'').toUpperCase();
  const sub=String(c&&c.subtype||'').toUpperCase();
  return tipo==='CREDIT'||sub==='CREDIT_CARD';
}

/* Uma conta de crédito do Pierre no formato do cartão do Aoii. O dia de
   fechamento não vem na conta (`balanceCloseDate` veio nulo na conta real);
   quem tem é a fatura, em `billClosingDate`. */
function cartaoDoPierre(conta,faturas){
  if(!contaEhCartao(conta)) return null;
  const credito=conta.creditData||{};
  const nome=[conta.connectorName,nomeDaContaPierre(conta)].filter(Boolean).join(' ')
    ||L('pierre.contaSemNome');
  const minhas=(faturas||[]).filter(f=>String(f.accountId||'')===String(conta.id||''));
  const maisNova=minhas.slice().sort((a,b)=>
    String(b.dueDate||'').localeCompare(String(a.dueDate||'')))[0];
  return {
    idExterno:String(conta.id||''),
    nome:nome.slice(0,60),
    limite:numeroDoPierre(credito.creditLimit),
    diaVencimento:diaDoIso(credito.balanceDueDate)||diaDoIso(maisNova&&maisNova.dueDate),
    diaFechamento:diaDoIso(credito.balanceCloseDate)||diaDoIso(maisNova&&maisNova.billClosingDate),
  };
}

/* Parcela que ainda não foi paga, com o mês em que cai. O Pierre repete a
   mesma parcela em registros irmãos — um com `status`, outro sem — então junta
   por número de parcela e fica com a versão que tem status. */
function parcelasAbertasDoPierre(resposta){
  const raiz=(resposta&&resposta.data)||resposta||{};
  const compras=raiz.purchases||[];
  const abertas=[];
  compras.forEach(compra=>{
    const porNumero=new Map();
    (compra.installments||[]).forEach(pa=>{
      const atual=porNumero.get(pa.installmentNumber);
      if(!atual||(!atual.status&&pa.status)) porNumero.set(pa.installmentNumber,pa);
    });
    porNumero.forEach(pa=>{
      if(pa.isPaid) return;
      const quando=anoMesDoIso(pa.dueDate);
      if(!quando) return;
      const valor=numeroDoPierre(pa.amount);
      if(!(valor>0)) return;
      abertas.push({
        ano:quando.ano, mes:quando.mes, valor,
        numero:pa.installmentNumber, de:pa.totalInstallments,
        nome:String(pa.description||'').trim()||L('pierre.semDescricao'),
        categoria:categoriaDoPierre(pa.category),
      });
    });
  });
  return abertas;
}

/* O que a sincronização faria com o cartão, sem gravar nada. */
function planoDoCartaoPierre(contas,faturas,parcelas,hojeISO){
  const hoje=String(hojeISO||todayISO()).slice(0,10);
  const agora=anoMesDoIso(hoje)||{ano:2000,mes:1};
  const chaveDeAgora=agora.ano*12+agora.mes;

  const cartoes=(contas||[]).filter(contaEhCartao)
    .map(c=>cartaoDoPierre(c,faturas))
    .filter(Boolean);

  const abertas=parcelasAbertasDoPierre(parcelas);
  const meses=new Map();   /* 'ano-mes' → {ano,mes,valor,origem,cartaoExterno} */

  const porMes=(ano,mes,valor,origem,cartaoExterno)=>{
    const k=ano+'-'+mes+'-'+cartaoExterno;
    /* a primeira fonte a chegar manda: a ordem de chamada é a prioridade */
    if(meses.has(k)) return;
    /* Fatura de mês que já passou entra como PAGA. Sem isto, `computeCartao()`
       — que soma TODA fatura em aberto — leu as seis faturas fechadas do ano
       como dívida viva: R$ 5.314 comprometidos num limite de R$ 700, e limite
       disponível negativo em R$ 4.614. Elas são histórico; o que se deve está
       no mês corrente e nos que vêm. */
    const jaPassou=ano*12+mes<chaveDeAgora;
    meses.set(k,{ano,mes,valor,origem,cartaoExterno,pago:jaPassou});
  };

  /* 1. fatura fechada: o número do banco */
  (faturas||[]).forEach(f=>{
    const quando=anoMesDoIso(f.dueDate);
    if(!quando) return;
    const valor=numeroDoPierre(f.totalAmount);
    if(!(valor>0)) return;
    porMes(quando.ano,quando.mes,valor,'banco',String(f.accountId||''));
  });

  /* 2. mês corrente: o saldo que o cartão informa */
  (contas||[]).filter(contaEhCartao).forEach(c=>{
    const valor=numeroDoPierre(c.balance);
    if(!(valor>0)) return;
    porMes(agora.ano,agora.mes,valor,'saldo',String(c.id||''));
  });

  /* 3. meses futuros: as parcelas que ainda vão cair */
  const soma=new Map();
  abertas.forEach(pa=>{
    if(pa.ano*12+pa.mes<=chaveDeAgora) return;   /* passado e mês corrente já têm fonte */
    const k=pa.ano+'-'+pa.mes;
    soma.set(k,(soma.get(k)||0)+pa.valor);
  });
  const doCartao=cartoes[0]?cartoes[0].idExterno:'';
  soma.forEach((valor,k)=>{
    const [ano,mes]=k.split('-').map(Number);
    porMes(ano,mes,Math.round(valor*100)/100,'parcelas',doCartao);
  });

  const jaTenho=new Set((data.cartoes||[]).map(c=>c.idExterno).filter(Boolean));
  return {
    cartoes,
    cartoesNovos:cartoes.filter(c=>!jaTenho.has(c.idExterno)).length,
    faturas:[...meses.values()].sort((a,b)=>(a.ano*12+a.mes)-(b.ano*12+b.mes)),
    faturasFechadas:[...meses.values()].filter(f=>f.pago).length,
    parcelasAbertas:abertas.filter(pa=>pa.ano*12+pa.mes>chaveDeAgora),
    totalParcelas:abertas.filter(pa=>pa.ano*12+pa.mes>chaveDeAgora)
      .reduce((s,pa)=>s+pa.valor,0),
  };
}

/* Grava o cartão e as faturas. Fatura que já existe tem o valor SUBSTITUÍDO,
   não somado: a fonte é o banco, e o banco é quem está certo sobre a fatura
   dele. Os `gastos[]` de quem já tinha ficam como estão — foi você que
   digitou, e apagar o que a pessoa escreveu nunca é a resposta. */
function aplicarCartaoPierre(plano){
  if(!plano) return null;
  if(!data.cartoes) data.cartoes=[];
  if(!data.faturas) data.faturas=[];

  const idPorExterno=new Map();
  let criados=0, atualizados=0;
  (plano.cartoes||[]).forEach(novo=>{
    const existente=(data.cartoes||[]).find(c=>c.idExterno===novo.idExterno);
    if(existente){
      existente.nome=novo.nome;
      existente.limite=novo.limite;
      if(novo.diaVencimento) existente.diaVencimento=novo.diaVencimento;
      if(novo.diaFechamento) existente.diaFechamento=novo.diaFechamento;
      idPorExterno.set(novo.idExterno,existente.id);
      atualizados++;
      return;
    }
    const cartao={id:uid(),nome:novo.nome,limite:novo.limite,
      diaFechamento:novo.diaFechamento||null,diaVencimento:novo.diaVencimento||null,
      idExterno:novo.idExterno};
    data.cartoes.push(cartao);
    idPorExterno.set(novo.idExterno,cartao.id);
    criados++;
  });

  let faturasNovas=0, faturasAtualizadas=0;
  (plano.faturas||[]).forEach(f=>{
    const cartaoId=idPorExterno.get(f.cartaoExterno)
      ||((data.cartoes||[])[0]||{}).id||null;
    const existente=(data.faturas||[]).find(x=>
      x.ano===f.ano&&x.mes===f.mes&&x.cartaoId===cartaoId);
    if(existente){
      /* o valor é do banco, mas o "pago" é de quem usa: se a pessoa marcou
         como paga aqui, uma sincronização não desmarca */
      if(existente.valor!==f.valor){ existente.valor=f.valor; faturasAtualizadas++; }
      if(f.pago&&!existente.pago) existente.pago=true;
      return;
    }
    data.faturas.push({id:uid(),ano:f.ano,mes:f.mes,valor:f.valor,
      pago:Boolean(f.pago),gastos:[],cartaoId});
    faturasNovas++;
  });

  return {criados,atualizados,faturasNovas,faturasAtualizadas};
}

/* ══ GASTOS FIXOS ═══════════════════════════════════════════════════════════

   O Pierre não tem rota de "gasto recorrente" — conferi a especificação
   inteira. Então isto é **inferência a partir do extrato**, e inferência não
   cria conta fixa sozinha: devolve sugestão, e quem decide é quem está lendo.

   O critério é conservador de propósito, porque um falso positivo aqui vira
   despesa fantasma na projeção de todos os meses seguintes:

     - só saída de conta de banco, já confirmada;
     - a mesma descrição em 2 meses distintos ou mais;
     - valor estável (o maior não passa 15% do menor);
     - fora pagamento de fatura, que já é a fatura do cartão. */

const PIERRE_NAO_EH_FIXO=/pagamento de fatura|pagamento de cartao|fatura do cartao|estorno|transferencia recebida/;

function assinaturaDoGasto(t){
  return semAcento(t&&t.description)
    .replace(/\d+/g,'')
    .replace(/[|\-–—]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function sugerirGastosFixosPierre(transacoes,hojeISO){
  const hoje=String(hojeISO||todayISO()).slice(0,10);
  const porAssinatura=new Map();

  (transacoes||[]).forEach(t=>{
    if(ehDeCartao(t)||aindaNaoCaiu(t)) return;
    if(String(t&&t.type||'').toUpperCase()!=='DEBIT') return;
    const dia=String(t&&t.date||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dia)||dia>hoje) return;
    const assinatura=assinaturaDoGasto(t);
    /* 3 e nao 4: "TIM" e nome de operadora, e uma conta fixa de verdade */
    if(!assinatura||assinatura.length<3) return;
    if(PIERRE_NAO_EH_FIXO.test(assinatura)) return;
    const valor=Math.abs(numeroDoPierre(t.amount));
    if(!(valor>0)) return;
    if(!porAssinatura.has(assinatura)) porAssinatura.set(assinatura,[]);
    porAssinatura.get(assinatura).push({dia,valor,nome:String(t.description||'').trim(),
      categoria:t.category});
  });

  const jaTenho=new Set((data.gastosMensais||[]).map(g=>semAcento(g.nome)));
  const sugestoes=[];
  porAssinatura.forEach(lista=>{
    const meses=new Set(lista.map(x=>x.dia.slice(0,7)));
    if(meses.size<2) return;
    const valores=lista.map(x=>x.valor);
    const menor=Math.min(...valores), maior=Math.max(...valores);
    if(menor<=0||maior>menor*1.15) return;
    const maisNovo=lista.slice().sort((a,b)=>b.dia.localeCompare(a.dia))[0];
    /* o dia que mais se repete: conta fixa cai sempre por volta da mesma data */
    const contagem=new Map();
    lista.forEach(x=>{
      const d=parseInt(x.dia.slice(8,10),10);
      contagem.set(d,(contagem.get(d)||0)+1);
    });
    const diaDoMes=[...contagem.entries()].sort((a,b)=>b[1]-a[1])[0][0];
    sugestoes.push({
      nome:maisNovo.nome.slice(0,60),
      valor:Math.round(maisNovo.valor*100)/100,
      diaDoMes,
      categoria:categoriaDoPierre(maisNovo.categoria),
      vezes:lista.length,
      meses:meses.size,
      sempreIgual:menor===maior,
      jaExiste:jaTenho.has(semAcento(maisNovo.nome)),
    });
  });

  return sugestoes
    .filter(x=>!x.jaExiste)
    .sort((a,b)=>b.meses-a.meses||b.valor-a.valor);
}

/* Cria os fixos que a pessoa marcou. Passa pelo comando de sempre, que valida
   — não escreve em `data.gastosMensais` por fora. */
function aplicarGastosFixosPierre(escolhidos,hojeISO){
  const quando=anoMesDoIso(String(hojeISO||todayISO()).slice(0,7))||{ano:2000,mes:1};
  let criados=0;
  (escolhidos||[]).forEach(g=>{
    const feito=criarGastoFixo({
      nome:g.nome, valor:g.valor, diaDoMes:g.diaDoMes,
      categoria:g.categoria||'Outros', ativo:true,
      inicioAno:quando.ano, inicioMes:quando.mes,
    });
    if(feito) criados++;
  });
  return {criados};
}
