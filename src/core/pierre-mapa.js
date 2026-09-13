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
