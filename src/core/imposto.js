/* ── Carnê-Leão: o imposto do mês, pronto para copiar ──────────────────────

   Quem recebe como pessoa física informal recolhe o IR todo mês, por conta
   própria, no Carnê-Leão. O programa da Receita pede **data e valor de cada
   recebimento** — é imposto de regime de caixa, não de competência. Isso manda
   no desenho inteiro deste arquivo.

   Três decisões que valem mais que o código:

   1. **A tabela é por ano, e mês antigo usa a tabela do ano dele.** As faixas
      mudam; recalcular janeiro de um ano com a tabela do seguinte produziria um
      número que nunca foi devido. `tabelaIRDoAno()` é a única porta para as
      constantes, e ninguém aqui lê `IR_TABELA_PADRAO` direto.

   2. **Nada aqui cria lançamento no Diário.** Renda fixa marcada para o IR
      entra no resumo como ocorrência DERIVADA — data é o dia do mês, valor é o
      da renda. Gravar movimento de verdade chamaria `aplicarEfeitoTransacao()`
      e mexeria no `saldoAtual`: o app passaria a somar dinheiro que talvez não
      tenha entrado, e a projeção inteira iria atrás. O resumo é uma leitura,
      não um comando.

   3. **Recebimento registrado vence a ocorrência derivada.** Quem lança a
      mensalidade no Diário e marca "conta para o IR" veria o mesmo dinheiro
      duas vezes — uma do registro, outra derivada da renda fixa. Havendo
      registro com a mesma fonte no mês, a derivada sai de cena: o que a pessoa
      escreveu é mais verdade que a projeção.

   O que ESTE arquivo não faz, e está escrito de propósito: estimativa não é
   apuração. Não há malha fina aqui, não há livro-caixa, não há compensação de
   despesa de autônomo. Quem desenha a tela diz isso em voz alta. */

/* Centavo é a menor unidade que existe aqui, e `0.075*2826.65` não dá um
   número de centavos exatos. Arredondar a cada passo, e não só no fim, é o que
   faz a soma das parcelas na tela fechar com o total — senão o resumo mostra
   R$ 0,01 de diferença e quem confere perde a confiança no resto. */
function arred2(v){ return Math.round((Number(v)||0)*100)/100; }

/* A tabela de 2026, em um lugar só. Editável pela tela — ver `salvarTabelaIR()`
   — e nunca lida direto: `tabelaIRDoAno()` é a porta. */
const IR_TABELA_PADRAO={
  anoVigencia:2026,
  /* o desconto simplificado mensal: alternativa às deduções, nunca soma */
  descontoSimplificado:607.20,
  dependente:189.59,
  /* `ate:null` é a última faixa, a que não tem teto */
  faixas:[
    {ate:2428.80,aliquota:0,    deduzir:0},
    {ate:2826.65,aliquota:0.075,deduzir:182.16},
    {ate:3751.05,aliquota:0.15, deduzir:394.16},
    {ate:4664.68,aliquota:0.225,deduzir:675.49},
    {ate:null,   aliquota:0.275,deduzir:896.00},
  ],
  /* A redução de 2026 incide sobre o rendimento BRUTO, e não sobre a base.
     Fonte de erro clássica: aplicar na base dá redução maior do que a devida
     justamente para quem tem dependente. */
  reducao:{isentoAte:5000.00,limite:7350.00,base:978.62,fator:0.133145},
  /* DARF abaixo disto não se paga: acumula para o mês seguinte */
  darfMinimo:10.00,
};

/* ── a tabela do ano ─────────────────────────────────────────────────────── */

/* As tabelas editadas vivem em LISTA, uma por ano, e não num mapa de ano para
   tabela. O validador do app não tem tipo "mapa de objetos" — e inventar um
   significaria mexer em `validation.js`, que é o portão por onde todo dado de
   fora entra. Lista ele já sabe conferir item a item, inclusive as faixas
   aninhadas. O `ano` é campo do item. */
function tabelaSalvaIR(ano){
  return (data.impostoTabelas||[]).find(t=>Number(t.ano)===Number(ano))||null;
}

/* A porta única para as constantes. Mês antigo chega aqui com o ano dele e sai
   com a tabela dele — é a decisão 1 em uma função. */
function tabelaIRDoAno(ano){
  const salva=tabelaSalvaIR(ano);
  if(!salva) return IR_TABELA_PADRAO;
  const t=Object.assign({},IR_TABELA_PADRAO,salva);
  /* faixa vazia seria tabela sem faixa nenhuma: o padrão volta inteiro, porque
     mesclar lista item a item esconderia uma faixa que a pessoa removeu */
  if(!Array.isArray(salva.faixas)||!salva.faixas.length) t.faixas=IR_TABELA_PADRAO.faixas;
  t.reducao=Object.assign({},IR_TABELA_PADRAO.reducao,salva.reducao||{});
  return t;
}

/* O ano cuja tabela está em vigor hoje: o maior ano com tabela salva, ou o
   `anoVigencia` do padrão. É o que o aviso da tela compara com o ano atual. */
function anoVigenciaIR(){
  const anos=(data.impostoTabelas||[])
    .map(t=>Number(t.anoVigencia)||Number(t.ano))
    .filter(Number.isFinite);
  anos.push(IR_TABELA_PADRAO.anoVigencia);
  return Math.max.apply(null,anos);
}

/* "Conferi, continua igual": a tabela que valia passa a valer no ano novo.
   COPIA em vez de mover o carimbo — o ano antigo tem que continuar calculável
   com o que valia nele. */
function confirmarAnoVigenciaIR(ano){
  const alvo=Number(ano)||new Date().getFullYear();
  if(alvo<=anoVigenciaIR()) return null;
  if(!data.impostoTabelas) data.impostoTabelas=[];
  const atual=tabelaIRDoAno(anoVigenciaIR());
  const nova=Object.assign({},atual,{ano:alvo,anoVigencia:alvo});
  const i=(data.impostoTabelas).findIndex(t=>Number(t.ano)===alvo);
  if(i>=0) data.impostoTabelas[i]=nova; else data.impostoTabelas.push(nova);
  return nova;
}

/* Uma tabela digitada à mão. Devolve `null` sem gravar nada quando algo não
   fecha: tabela de imposto meio salva é pior que tabela não salva. */
function validarTabelaIR(bruta){
  const t=bruta||{};
  const num=v=>{ const n=Number(v); return Number.isFinite(n)&&n>=0?n:null; };
  const simplificado=num(t.descontoSimplificado);
  const dependente=num(t.dependente);
  const minimo=num(t.darfMinimo);
  if(simplificado===null||dependente===null||minimo===null) return null;

  if(!Array.isArray(t.faixas)||!t.faixas.length) return null;
  const faixas=[];
  for(let i=0;i<t.faixas.length;i++){
    const f=t.faixas[i]||{};
    const ultima=i===t.faixas.length-1;
    const ate=ultima?null:num(f.ate);
    const aliquota=num(f.aliquota);
    const deduzir=num(f.deduzir);
    if(aliquota===null||deduzir===null||aliquota>1) return null;
    if(!ultima&&(ate===null||ate<=0)) return null;
    /* faixa tem que subir: fora de ordem, `faixaIR()` pararia na errada */
    if(!ultima&&faixas.length&&ate<=faixas[faixas.length-1].ate) return null;
    faixas.push({ate,aliquota,deduzir});
  }
  /* a última faixa sai daqui sempre com `ate:null` — ver o laço acima, que
     força isso. Havia uma conferência aqui pra recusar tabela sem faixa
     aberta; ela nunca podia falhar, e um teste apontou. Código que não pode
     falhar dá a impressão de guardar algo que ninguém guarda. */

  const r=t.reducao||{};
  const isentoAte=num(r.isentoAte), limite=num(r.limite),
        base=num(r.base), fator=num(r.fator);
  if([isentoAte,limite,base,fator].some(v=>v===null)) return null;
  if(limite<isentoAte) return null;

  const anoVigencia=Number(t.anoVigencia);
  if(!Number.isInteger(anoVigencia)||anoVigencia<2000||anoVigencia>2200) return null;

  return {anoVigencia,descontoSimplificado:simplificado,dependente,
    faixas,reducao:{isentoAte,limite,base,fator},darfMinimo:minimo};
}

function salvarTabelaIR(ano,bruta){
  const t=validarTabelaIR(bruta); if(!t) return null;
  const alvo=Number(ano)||t.anoVigencia;
  const item=Object.assign({ano:alvo},t);
  if(!data.impostoTabelas) data.impostoTabelas=[];
  const i=data.impostoTabelas.findIndex(x=>Number(x.ano)===alvo);
  if(i>=0) data.impostoTabelas[i]=item; else data.impostoTabelas.push(item);
  return item;
}

/* Restaurar o padrão é APAGAR a tabela daquele ano, não gravar o padrão em
   cima. Assim quem corrigir a tabela embutida numa versão futura do app
   alcança também quem já mexeu e desistiu. */
function restaurarTabelaIR(ano){
  const lista=data.impostoTabelas||[];
  const i=lista.findIndex(t=>Number(t.ano)===Number(ano));
  if(i<0) return false;
  lista.splice(i,1);
  return true;
}

/* ── as fontes de renda ──────────────────────────────────────────────────── */

/* O Carnê-Leão não pede a fonte, mas quem declara precisa dela: "Financeiro
   pizzaria" e "Diária presencial" têm cara diferente no extrato e na memória.
   `mensal` é valor fixo que cai num dia; `diaria` é valor por dia trabalhado,
   registrado um a um. */
const IR_TIPOS_DE_FONTE=['mensal','diaria'];

function camposFonteIR(campos){
  campos=campos||{};
  const nome=String(campos.nome||'').trim();
  const tipo=String(campos.tipo||'mensal');
  const valorPadrao=Number(campos.valorPadrao);
  if(!nome) return null;
  if(!IR_TIPOS_DE_FONTE.includes(tipo)) return null;
  if(!Number.isFinite(valorPadrao)||valorPadrao<0) return null;
  return {nome:nome.slice(0,60),tipo,valorPadrao};
}

function criarFonteIR(campos){
  const valores=camposFonteIR(campos); if(!valores) return null;
  if(!data.irFontes) data.irFontes=[];
  const fonte=Object.assign({id:uid()},valores,{criadoEm:new Date().toISOString()});
  data.irFontes.push(fonte);
  return fonte;
}

function atualizarFonteIR(id,campos){
  const fonte=(data.irFontes||[]).find(f=>f.id===id); if(!fonte) return null;
  const valores=camposFonteIR(Object.assign({},fonte,campos||{})); if(!valores) return null;
  Object.assign(fonte,valores);
  return fonte;
}

/* Remover a fonte NÃO apaga recebimento nenhum: o dinheiro entrou e o mês
   antigo continua tendo que fechar. O recebimento fica sem fonte e a tela o
   mostra como "sem fonte" — perder o lançamento seria perder a declaração. */
function removerFonteIR(id){
  const lista=data.irFontes||[];
  const i=lista.findIndex(f=>f.id===id);
  if(i<0) return false;
  lista.splice(i,1);
  return true;
}

function fonteIR(id){
  return (data.irFontes||[]).find(f=>f.id===id)||null;
}

function nomeFonteIR(id){
  const f=fonteIR(id);
  return f?f.nome:L('ir.semFonte');
}

/* Uma diária, em um toque. É `registrarMovimento()` de verdade — dinheiro que
   entrou na mão entra no saldo como qualquer outro —, só já marcado. */
function registrarDiariaIR(fonteId,campos){
  const fonte=fonteIR(fonteId); if(!fonte) return null;
  campos=campos||{};
  const valor=Number.isFinite(Number(campos.valor))&&Number(campos.valor)>0
    ?Number(campos.valor):Number(fonte.valorPadrao);
  if(!Number.isFinite(valor)||valor<=0) return null;
  const mov=registrarMovimento({
    tipo:'receita',nome:fonte.nome,valor,
    categoria:campos.categoria||'Outros',
    metodo:campos.metodo||'pix',
    data:campos.data||todayISO(),
  });
  if(!mov) return null;
  mov.ir=true;
  mov.irFonteId=fonte.id;
  return mov;
}

/* ── os recebimentos do mês ──────────────────────────────────────────────── */

function _mesDoISO(iso){
  const t=String(iso||'').slice(0,7);
  if(!/^\d{4}-\d{2}$/.test(t)) return null;
  return {ano:parseInt(t.slice(0,4),10),mes:parseInt(t.slice(5,7),10)};
}

/* O que o Carnê-Leão quer do mês: cada recebimento com data e valor, em ordem
   de data. Duas origens, e a ordem entre elas importa — ver decisão 3. */
function recebimentosTributaveisIR(ano,mes){
  const registrados=(data.transacoes||[]).filter(t=>{
    if(t.tipo!=='receita'||!t.ir) return false;
    const q=_mesDoISO(t.data);
    return !!q&&q.ano===ano&&q.mes===mes;
  }).map(t=>({
    data:String(t.data).slice(0,10),
    valor:Number(t.valor)||0,
    fonteId:t.irFonteId||null,
    nome:String(t.nome||'')||nomeFonteIR(t.irFonteId),
    origem:'registrado',
    transacaoId:t.id,
  }));

  /* fonte que já tem registro no mês não gera ocorrência derivada */
  const comRegistro=new Set(registrados.map(r=>r.fonteId).filter(Boolean));

  const derivados=[];
  (data.rendasRecorrentes||[]).forEach(r=>{
    if(!r.irPadrao||r.ativo===false) return;
    const valor=Number(r.valor)||0;
    if(valor<=0) return;
    if(r.irFonteId&&comRegistro.has(r.irFonteId)) return;
    derivados.push({
      data:isoDate(dataNoMes(ano,mes,r.diaDoMes)),
      valor,
      fonteId:r.irFonteId||null,
      nome:String(r.nome||'')||nomeFonteIR(r.irFonteId),
      origem:'derivado',
      rendaId:r.id,
    });
  });

  /* Comparar as datas direto no `sort` seria o natural aqui. Nao da: o campo
     da data se chama `data`, igual ao objeto financeiro do app, e o lint de
     campos persistidos toma qualquer acesso dentro dele como campo novo --
     acusar campo fora do esquema e justamente o que esse lint existe pra
     fazer. O comparador separado diz a mesma coisa sem a ambiguidade. */
  const porTexto=(x,y)=>String(x||'').localeCompare(String(y||''));
  return registrados.concat(derivados)
    .sort((a,b)=>porTexto(a.data,b.data)||porTexto(a.nome,b.nome));
}

/* O mesmo mês agrupado por fonte, que é como a pessoa confere antes de digitar
   no programa da Receita. */
function tributavelPorFonteIR(ano,mes){
  const porFonte=new Map();
  recebimentosTributaveisIR(ano,mes).forEach(r=>{
    const chave=r.fonteId||('sem:'+r.nome);
    if(!porFonte.has(chave)){
      porFonte.set(chave,{fonteId:r.fonteId,nome:r.nome,total:0,quantos:0,
        recebimentos:[]});
    }
    const g=porFonte.get(chave);
    g.total+=r.valor; g.quantos++; g.recebimentos.push(r);
  });
  return [...porFonte.values()].sort((a,b)=>b.total-a.total);
}

/* ── o cálculo ───────────────────────────────────────────────────────────── */

/* A faixa em que a base cai. Percorre em ordem porque `validarTabelaIR()`
   garante que elas sobem, e a última não tem teto. */
function faixaIR(base,tabela){
  const faixas=(tabela||IR_TABELA_PADRAO).faixas;
  for(let i=0;i<faixas.length;i++){
    const f=faixas[i];
    if(f.ate===null||base<=f.ate) return Object.assign({indice:i},f);
  }
  return Object.assign({indice:faixas.length-1},faixas[faixas.length-1]);
}

/* As deduções informadas. Nunca somam com o desconto simplificado: a lei dá
   um OU outro, e a pessoa fica com o que lhe for maior. */
function deducoesIR(tabela){
  const t=tabela||IR_TABELA_PADRAO;
  const d=data.impostoDeducoes||{};
  const dependentes=Math.max(0,Math.trunc(Number(d.dependentes)||0));
  const pensao=Math.max(0,Number(d.pensao)||0);
  const inss=Math.max(0,Number(d.inss)||0);
  const porDependentes=dependentes*t.dependente;
  const detalhado=porDependentes+pensao+inss;
  return {dependentes,porDependentes,pensao,inss,detalhado,
    simplificado:t.descontoSimplificado,
    usado:Math.max(t.descontoSimplificado,detalhado),
    usouSimplificado:t.descontoSimplificado>=detalhado};
}

/* A redução de 2026, sobre o BRUTO. Devolve quanto abater do imposto — nunca
   mais do que o próprio imposto, que é o "nunca negativo" da regra. */
function reducaoIR(bruto,impostoDaTabela,tabela){
  const r=(tabela||IR_TABELA_PADRAO).reducao;
  if(bruto<=r.isentoAte) return impostoDaTabela;
  if(bruto>r.limite) return 0;
  const bruta=r.base-r.fator*bruto;
  return Math.min(impostoDaTabela,Math.max(0,bruta));
}

/* O mês fechado: do bruto ao líquido, com cada passo visível. A tela mostra os
   passos porque "confie no número" não serve a quem vai digitar isso na
   Receita e responder por ele. */
function calcularIRMes(ano,mes){
  const tabela=tabelaIRDoAno(ano);
  const recebimentos=recebimentosTributaveisIR(ano,mes);
  const bruto=arred2(recebimentos.reduce((s,r)=>s+r.valor,0));
  const ded=deducoesIR(tabela);
  const base=arred2(Math.max(0,bruto-ded.usado));
  const faixa=faixaIR(base,tabela);
  const daTabela=arred2(Math.max(0,base*faixa.aliquota-faixa.deduzir));
  const reducao=arred2(reducaoIR(bruto,daTabela,tabela));
  const imposto=arred2(Math.max(0,daTabela-reducao));
  return {
    ano,mes,tabela,recebimentos,
    quantos:recebimentos.length,
    bruto,deducoes:ded,base,
    faixa:{indice:faixa.indice,aliquota:faixa.aliquota,deduzir:faixa.deduzir,ate:faixa.ate},
    impostoDaTabela:daTabela,reducao,imposto,
    aliquotaEfetiva:bruto>0?imposto/bruto:0,
    liquido:arred2(bruto-imposto),
    anoDaTabela:tabela.anoVigencia,
  };
}

/* ── o DARF ──────────────────────────────────────────────────────────────── */

/* Imposto abaixo do mínimo não gera DARF: acumula e sai junto com o do mês
   seguinte. Por isso não existe "o DARF de março" isolado — a cadeia tem que
   ser percorrida do começo do ano, e é o que `darfsDoAnoIR()` faz.

   O acúmulo não atravessa o ano. É o comportamento comum do código 0190 e,
   principalmente, é o que mantém a declaração de um ano fechada em si mesma.
   Dezembro abaixo do mínimo some, e a tela diz isso em vez de esconder. */
function darfsDoAnoIR(ano){
  const minimo=tabelaIRDoAno(ano).darfMinimo;
  const meses=[], pagos=data.impostoDarfs||[];
  let acumulado=0, vemDe=[];
  for(let mes=1;mes<=12;mes++){
    const calc=calcularIRMes(ano,mes);
    acumulado=arred2(acumulado+calc.imposto);
    if(calc.imposto>0) vemDe.push(mes);
    const fecha=acumulado>=minimo;
    const ultimo=mes===12;
    const registro=pagos.find(p=>Number(p.ano)===ano&&Number(p.mes)===mes)||{};
    meses.push({
      ano,mes,
      imposto:calc.imposto,
      bruto:calc.bruto,
      /* o que de fato se paga neste mês: o acumulado, quando fecha */
      valor:fecha?acumulado:0,
      acumulado,
      acumuladoDe:vemDe.slice(),
      /* 'pagar' fecha e tem DARF; 'acumula' carrega; 'perdido' é dezembro
         abaixo do mínimo, que não vira DARF nem carrega pra frente; 'nada' é
         mês sem imposto nenhum */
      estado:fecha?'pagar':(acumulado>0?(ultimo?'perdido':'acumula'):'nada'),
      vencimento:fecha?isoDate(ultimoDiaUtilDoMesSeguinte(ano,mes)):null,
      pago:!!registro.pago,
      pagoEm:registro.pagoEm||null,
    });
    if(fecha){ acumulado=0; vemDe=[]; }
  }
  return meses;
}

function darfIR(ano,mes){
  return darfsDoAnoIR(ano).find(d=>d.mes===mes)||null;
}

/* O status de pago é marcado à mão e é a única coisa que o DARF persiste: o
   valor se recalcula da tabela e dos recebimentos, mas "eu paguei" só a pessoa
   sabe. */
function marcarDarfIRPago(ano,mes,pago){
  const a=Number(ano), m=Number(mes);
  if(!Number.isInteger(a)||!Number.isInteger(m)||m<1||m>12) return null;
  if(!data.impostoDarfs) data.impostoDarfs=[];
  const i=data.impostoDarfs.findIndex(p=>Number(p.ano)===a&&Number(p.mes)===m);
  if(!pago){ if(i>=0) data.impostoDarfs.splice(i,1); return null; }
  const registro={ano:a,mes:m,pago:true,pagoEm:todayISO()};
  if(i>=0) data.impostoDarfs[i]=registro; else data.impostoDarfs.push(registro);
  return registro;
}

/* ── o ano ───────────────────────────────────────────────────────────────── */

/* O que a declaração do ano seguinte vai pedir: quanto entrou, quanto se pagou,
   e o que ficou pendente. Mês pendente é DARF que fechou e ninguém marcou como
   pago — vencido ou não, é o que precisa de olho. */
function resumoAnualIR(ano){
  const meses=darfsDoAnoIR(ano);
  const hoje=todayISO();
  let bruto=0,imposto=0,pago=0;
  const pendentes=[],vencidos=[];
  meses.forEach(m=>{
    bruto=arred2(bruto+m.bruto);
    imposto=arred2(imposto+m.imposto);
    if(m.valor<=0) return;
    if(m.pago){ pago=arred2(pago+m.valor); return; }
    pendentes.push(m);
    if(m.vencimento&&m.vencimento<hoje) vencidos.push(m);
  });
  return {ano,meses,bruto,imposto,pago,
    aPagar:arred2(imposto-pago),
    pendentes,vencidos,
    aliquotaEfetiva:bruto>0?imposto/bruto:0};
}

/* ── o texto que vai pra área de transferência ───────────────────────────── */

function _diaBR(iso){
  const t=String(iso||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return t.slice(8,10)+'/'+t.slice(5,7)+'/'+t.slice(0,4);
}

/* Data e valor, uma linha por recebimento, mais o total. Sem o aviso de
   estimativa e sem enfeite: isto é feito pra ser colado num formulário, e
   cabeçalho bonito ali só dá trabalho de apagar. O valor sai com vírgula
   decimal e sem símbolo, que é o formato que o programa da Receita aceita. */
function textoCarneLeaoIR(ano,mes){
  const calc=calcularIRMes(ano,mes);
  const num=v=>(Number(v)||0).toFixed(2).replace('.',',');
  const linhas=[];
  linhas.push(String(mes).padStart(2,'0')+'/'+ano);
  tributavelPorFonteIR(ano,mes).forEach(g=>{
    linhas.push('');
    linhas.push(g.nome+' — '+num(g.total));
    g.recebimentos.forEach(r=>{ linhas.push(_diaBR(r.data)+'\t'+num(r.valor)); });
  });
  linhas.push('');
  linhas.push(L('ir.copiaTotal')+' '+num(calc.bruto));
  linhas.push(L('ir.copiaImposto')+' '+num(calc.imposto));
  return linhas.join('\n');
}
