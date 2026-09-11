/* ── leitura de número digitado ──────────────────────────────────────────
   os campos de dinheiro são <input type="text" inputmode="decimal">, então
   chega "1.234,56" (teclado brasileiro), "1234,56" ou "1234.56". parseFloat
   sozinho lia "1234,56" como 1234 e "5.400,00" como 5,4.
   Regra: com dois separadores diferentes, o ÚLTIMO é o decimal. Com um só,
   três dígitos depois dele indicam separador de milhar (grupo de milhar tem
   sempre 3 dígitos) — a não ser em inglês, onde o ponto é o decimal.
   Devolve NaN quando não dá pra ler, igual ao parseFloat, pra não mexer em
   nenhuma validação que já existe.                                        */
function parseNum(v){
  if(typeof v==='number') return v;
  let s=String(v==null?'':v).trim().replace(/[^\d.,-]/g,'');
  if(!s||!/\d/.test(s)) return NaN;
  const neg=s[0]==='-';
  s=s.replace(/-/g,'');
  const seps=s.match(/[.,]/g)||[];
  let n;
  if(seps.length===0){
    n=parseFloat(s);
  }else{
    const iUlt=Math.max(s.lastIndexOf('.'),s.lastIndexOf(','));
    const depois=s.length-1-iUlt;
    const antes=s.slice(0,iUlt).replace(/[.,]/g,'');
    let decimal;
    if(new Set(seps).size>1) decimal=true;             // "1.234,56" / "1,234.56"
    else if(seps.length>1) decimal=false;              // "1.234.567" → tudo milhar
    else if(depois!==3) decimal=true;                  // milhar tem sempre 3 dígitos
    else if(antes==='0'||antes.length>3) decimal=true; // "0.125", "1234.567"
    else decimal=(((typeof data!=='undefined'&&data&&data.idioma)||'pt')==='en')?s[iUlt]==='.':s[iUlt]===',';
    n=decimal
      ? parseFloat(s.slice(0,iUlt).replace(/[.,]/g,'')+'.'+s.slice(iUlt+1).replace(/[.,]/g,''))
      : parseFloat(s.replace(/[.,]/g,''));
  }
  if(isNaN(n)) return NaN;
  return neg?-n:n;
}

/* Campo de dinheiro que o rótulo diz ser opcional. parseNum('') devolve NaN,
   igual ao parseFloat — o que está certo para um campo obrigatório e errado
   para um opcional: o NaN descia até a validação, que recusava o registro
   inteiro, e a folha fechava sem salvar e sem dizer o porquê. Aqui, branco
   vale zero; texto que não é número continua NaN e continua sendo recusado. */
function parseNumOpcional(v){
  if(v===null||v===undefined) return 0;
  if(typeof v==='number') return v;
  return String(v).trim()===''?0:parseNum(v);
}

/* Percentual no idioma da pessoa. O número cru do JavaScript escreve sempre
   com ponto: um brasileiro lia "14.9%" onde escreve 14,9%, e a calculadora
   era o único canto do app com esse ponto. */
function formatPct(n,casas){
  if(!Number.isFinite(n)) return '—';
  return n.toLocaleString(localeAtual(),
    {minimumFractionDigits:0,maximumFractionDigits:casas==null?2:casas})+'%';
}
/* Dinheiro escrito como se escreve no idioma de QUEM LÊ, e não como se escreve
   no país da moeda.

   Cada moeda trazia um locale colado nela — o euro vinha com 'de-DE' —, e o
   símbolo era sempre prefixado à mão. Duas consequências, ambas só para quem
   não usa o app em português:

     · um francês via "€ 1.234,56" onde se escreve "1 234,56 €": separador de
       milhar alemão, e o símbolo do lado errado;
     · italiano e espanhol viam o símbolo antes, quando nas três línguas ele
       vem depois do número.

   Pior: no mesmo cartão do hero, o campo editável já usava o idioma
   (valorDeCampo) e o total usava a moeda, então as duas linhas mostravam
   separadores de milhar diferentes, uma embaixo da outra.

   Quem decide agora é o Intl, com os dados da própria língua — símbolo,
   posição, separador e agrupamento. É o mesmo caminho que o conversor de
   moedas já usava em formatarNaMoeda(); aqui é que estava fora de passo.

   O formatador é guardado porque isto é chamado muitas vezes por render, e
   montar um Intl.NumberFormat não é de graça. A chave carrega idioma e moeda:
   trocar qualquer um dos dois monta outro. */
let _fmtMoeda=null, _fmtMoedaChave='';
function formatadorDeMoeda(){
  const idioma=localeAtual(), moeda=(CURRENCY_INFO[data.moeda]?data.moeda:'BRL');
  const chave=idioma+'|'+moeda;
  if(_fmtMoedaChave!==chave){
    try{
      _fmtMoeda=new Intl.NumberFormat(idioma,{style:'currency',currency:moeda,
        minimumFractionDigits:2,maximumFractionDigits:2});
    }catch(e){ _fmtMoeda=null; }
    _fmtMoedaChave=chave;
  }
  return _fmtMoeda;
}
function formatBRL(n){
  const v=Number.isFinite(n)?n:0;
  const fmt=formatadorDeMoeda();
  if(fmt) return fmt.format(v);
  /* navegador sem dados da moeda: o número no idioma, o símbolo na frente */
  const cfg=CURRENCY_INFO[data.moeda]||CURRENCY_INFO.BRL;
  return (v<0?'-':'')+cfg.symbol+' '+Math.abs(v).toLocaleString(localeAtual(),{minimumFractionDigits:2,maximumFractionDigits:2});
}
/* O mesmo número, sem a moeda. O eixo do gráfico precisa disto e vinha
   arrancando o símbolo do texto pronto com um replace — que só funcionava
   enquanto o símbolo estivesse na frente e colado num espaço. */
function formatValorSemMoeda(n){
  const v=Number.isFinite(n)?n:0;
  return v.toLocaleString(localeAtual(),{minimumFractionDigits:2,maximumFractionDigits:2});
}
/* dia do mês que existe de verdade: 31 em fevereiro vira o último dia,
   senão o Date rola pro mês seguinte e a conta cai no mês errado */
function dataNoMes(ano,mes,dia){ // mes: 1-12
  const ultimo=new Date(ano,mes,0).getDate();
  return new Date(ano,mes-1,Math.min(Math.max(1,dia||1),ultimo));
}

function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function today(){ return startOfDay(new Date()); }
/* data de hoje no fuso LOCAL do usuário (nunca use toISOString().slice(0,10) pra isso — vira UTC e troca de dia perto da meia-noite) */
window.todayISO = function todayISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
function fmtDate(iso){
  if(!iso) return '—';
  const d=new Date(iso);
  return d.toLocaleDateString(localeAtual(),{day:'2-digit',month:'2-digit',year:'numeric'})+' '+L('rp.as')+' '+
         d.toLocaleTimeString(localeAtual(),{hour:'2-digit',minute:'2-digit'});
}
function isoDate(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
