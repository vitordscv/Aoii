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

/* O Pierre categoriza sozinho e em português. A lista dele não é fixa, então
   isto é um ponto de partida: primeiro tenta casar com o que a pessoa já usa
   no Aoii, depois com esta tabela, e por fim cai em Outros. */
const PIERRE_CATEGORIAS = {
  'alimentacao': 'Mercado',
  'alimentacao e bebidas': 'Mercado',
  'supermercado': 'Mercado',
  'mercado': 'Mercado',
  'restaurantes': 'Mercado',
  'transporte': 'Transporte',
  'combustivel': 'Transporte',
  'lazer': 'Lazer',
  'entretenimento': 'Lazer',
  'saude': 'Saúde',
  'moradia': 'Casa',
  'casa': 'Casa',
  'servicos': 'Casa',
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

/* Uma transação do Pierre no formato do Diário, ou `null` se não deve entrar. */
function transacaoDoPierre(t){
  if(!t||ehDeCartao(t)) return null;
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

/* O saldo em conta: só as contas de banco. */
function saldoDoPierre(contas){
  return (contas||[])
    .filter(c=>String(c&&c.accountType||'').toUpperCase()==='BANK')
    .reduce((s,c)=>{ const v=parseNum(c.accountBalance); return s+(Number.isFinite(v)?v:0); },0);
}

/* O que uma sincronização traria, sem ainda mexer em nada. Devolver o plano
   antes de aplicá-lo é o que permite mostrar à pessoa o que vai acontecer —
   e o que permite testar a conta sem gravar nada. */
function planoDeSincronizacaoPierre(contas,transacoes){
  const jaTem=new Set((data.transacoes||[]).map(t=>t.idExterno).filter(Boolean));
  const novas=[], repetidas=[], doCartao=[], recusadas=[];

  (transacoes||[]).forEach(bruta=>{
    if(ehDeCartao(bruta)){ doCartao.push(bruta); return; }
    const pronta=transacaoDoPierre(bruta);
    if(!pronta){ recusadas.push(bruta); return; }
    if(pronta.idExterno&&jaTem.has(pronta.idExterno)){ repetidas.push(pronta); return; }
    /* duas iguais dentro da mesma leva também contam como repetida */
    if(pronta.idExterno) jaTem.add(pronta.idExterno);
    novas.push(pronta);
  });

  const saldo=saldoDoPierre(contas);
  return {
    novas, repetidas, doCartao, recusadas,
    contasDeBanco:(contas||[]).filter(c=>String(c&&c.accountType||'').toUpperCase()==='BANK').length,
    instituicoes:[...new Set((contas||[]).map(c=>c.providerCode).filter(Boolean))],
    saldo,
    saldoAtual:data.saldoAtual||0,
    diferencaDeSaldo:saldo-(data.saldoAtual||0),
  };
}

/* Aplica o plano. Fora do `planoDe…` de propósito: quem desenha a tela mostra
   o plano primeiro e só chama isto depois de a pessoa confirmar. */
function aplicarSincronizacaoPierre(plano,opcoes){
  if(!plano) return null;
  const {trazerSaldo=true}=opcoes||{};
  if(!data.transacoes) data.transacoes=[];
  plano.novas.forEach(t=>{ data.transacoes.push(t); });
  if(trazerSaldo&&plano.contasDeBanco>0){
    data.saldoAtual=plano.saldo;
    data.saldoAtualizadoEm=new Date().toISOString();
  }
  data.pierreSincronizadoEm=new Date().toISOString();
  return {lancadas:plano.novas.length,saldoAtualizado:trazerSaldo&&plano.contasDeBanco>0};
}
