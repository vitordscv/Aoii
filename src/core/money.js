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

function formatBRL(n){
  const neg=n<-0.004, abs=Math.abs(n);
  const cfg=CURRENCY_INFO[data.moeda]||CURRENCY_INFO.BRL;
  return (neg?'-':'')+' '+cfg.symbol+' '+abs.toLocaleString(cfg.locale,{minimumFractionDigits:2,maximumFractionDigits:2});
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
  return d.toLocaleDateString(localeAtual(),{day:'2-digit',month:'2-digit',year:'numeric'})+' às '+
         d.toLocaleTimeString(localeAtual(),{hour:'2-digit',minute:'2-digit'});
}
function isoDate(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

