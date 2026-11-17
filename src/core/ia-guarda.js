
/* ─── A resposta da IA só pode citar número que saiu daqui ───────────────────

   Num app de dinheiro, uma frase bonita com um número errado é pior que
   nenhuma resposta: a pessoa decide em cima dele. Testando com dados fictícios,
   um modelo grande acertou todas as contas e ainda assim escreveu "o cartão
   cobra ~300% ao ano" e "o Tesouro rende ~13%" — números que não estavam nos
   dados. O prompt pede para não inventar; isto aqui CONFERE.

   A regra: todo valor em dinheiro, todo percentual e todo número com casa
   decimal ou separador de milhar que a resposta citar precisa estar no texto
   que foi enviado (dados, fatos calculados, pergunta, conversa) ou ser a soma
   ou a diferença direta de dois deles ("sobram R$ 610" quando o livre é 910 e
   a compra é 300). Inteiro pequeno solto (3 meses, 5 dias, 2027) não entra:
   prazo e data aparecem o tempo todo e quase nunca são o que machuca.

   Não é prova de que a resposta está certa — é a garantia de que ela não
   trouxe número de fora. O resto fica com os fatos que o código calcula e com
   as regras do prompt. */

/* "1.234,56", "1,234.56", "3.500", "0,7": a resposta vem no idioma que a
   pessoa escolheu, então o separador pode ser de qualquer um. Uma leitura só
   por número — ler "2.700,00" também como 2,7 criava valores pequenos que
   casavam com qualquer coisa (2,7 − 0,7 = 2 "justificava" um R$ 2.000
   inventado). A regra: com os dois sinais, o último é o decimal; com um só,
   ele é milhar quando separa grupos de exatamente três dígitos. */
function leiturasDoNumero(tok){
  const s=String(tok).replace(/\s/g,'');
  let n;
  const ultimoPonto=s.lastIndexOf('.'), ultimaVirgula=s.lastIndexOf(',');
  if(ultimoPonto>=0&&ultimaVirgula>=0){
    const dec=ultimoPonto>ultimaVirgula?'.':',';
    const mil=dec==='.'?',':'.';
    n=Number(s.split(mil).join('').replace(dec,'.'));
  }else if(ultimoPonto>=0||ultimaVirgula>=0){
    const sep=ultimoPonto>=0?'.':',';
    const partes=s.split(sep);
    const ehMilhar=partes.length>1&&partes.slice(1).every(p=>p.length===3)&&partes[0].length<=3&&partes[0]!=='0';
    n=Number(ehMilhar?partes.join(''):partes.join('.'));
  }else n=Number(s);
  return Number.isFinite(n)?[Math.round(n*100)/100]:[];
}

/* todo número do texto — o conjunto do que é permitido */
function numerosDoTexto(texto){
  const vistos=new Set();
  for(const m of String(texto||'').matchAll(/\d(?:[\d.,]*\d)?/g))
    for(const n of leiturasDoNumero(m[0])) vistos.add(n);
  return [...vistos];
}

/* só o que a resposta afirma como valor: dinheiro, percentual, ou número com
   separador. Devolve o pedaço como apareceu, para dizer qual foi barrado.
   "R$ 32 mil", "1,5 mil", "$2k": o número vem arredondado e multiplicado, e
   precisa ser lido assim — senão "32" passa como se fosse um valor pequeno
   qualquer. A tolerância é a do próprio arredondamento: "32 mil" cobre de
   31.500 a 32.500, "1,5 mil" de 1.450 a 1.550. */
function numerosConferiveis(texto){
  /* espaço fino e espaço inquebrável: o francês separa milhar com eles */
  const milhar='['+String.fromCharCode(0xa0,0x202f)+']';
  const re=new RegExp(String.raw`((?:R\$|US\$|\$|€|£|¥|CHF)\s?)?(\d{1,3}(?:(?:[.,]|`+milhar+String.raw`)\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?)(\s?%|\s?(?:mil|k|thousand|mille|mila)\b)?`,'gi');
  const achados=[];
  for(const m of String(texto||'').matchAll(re)){
    const sufixo=(m[3]||'').trim().toLowerCase();
    const moeda=!!m[1], pct=sufixo==='%', vezesMil=!!sufixo&&!pct, comSeparador=/\D/.test(m[2]);
    if(!moeda&&!pct&&!comSeparador&&!vezesMil) continue;
    const base=leiturasDoNumero(m[2].replace(new RegExp(milhar,'g'),'.'));
    if(vezesMil){
      const casas=(m[2].split(/[.,]/)[1]||'').length;
      achados.push({texto:m[0].trim(),pct:false,valores:base.map(v=>Math.round(v*1000*100)/100),tolerancia:500/Math.pow(10,casas)});
    }else achados.push({texto:m[0].trim(),pct,valores:base,tolerancia:0});
  }
  return achados;
}

/* aceita v se ele está na lista, se é soma/diferença de dois valores de base,
   ou se é um valor de base multiplicado ou dividido por uma contagem (2 a
   120: meses, parcelas, pessoas) que aparece no texto — "R$ 500 por mês em 12
   meses dá R$ 6.000", "R$ 1.200 em 4 parcelas de R$ 300". */
function bateComLista(v,lista,base,contagens){
  const conjunto=new Set(lista);
  if(conjunto.has(v)) return true;
  const ops=new Set(base||lista);
  for(const a of ops){
    if(ops.has(Math.round((v-a)*100)/100)) return true;
    if(ops.has(Math.round((a-v)*100)/100)) return true;
    for(const k of contagens||[]){
      if(Math.abs(a*k-v)<0.011||Math.abs(a/k-v)<0.011) return true;
    }
  }
  return false;
}

/* Conta pedida na pergunta ("20+20+20+7", "1.200 / 4", "10% de 3.500") é
   resolvida aqui, e o resultado vai pronto para o modelo. Sem isso ele ou
   errava a conta, ou — com a regra de não inventar número — se recusava a
   somar o que a própria pessoa escreveu. Só + − × ÷ e parênteses; nada de
   eval. */
function contasDaPergunta(texto){
  /* data não é conta: "17/11" não é dezessete dividido por onze, nem
     "2026 - 2027" é menos um */
  const t=String(texto||'').replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,' ').replace(/\b(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\b/g,' ');
  const contas=[];
  const num='\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d+)?';
  const termo='[(\\s]*(?:R\\$\\s?)?(?:'+num+')[)\\s]*';
  const reExpr=new RegExp(termo+'(?:\\s*[-+*/x×÷]\\s*'+termo+')+','g');
  for(const m of t.matchAll(reExpr)){
    const expr=m[0].trim();
    const r=avaliarConta(expr);
    if(r!==null) contas.push({expressao:expr,resultado:r});
  }
  const rePct=new RegExp('('+num+')\\s?%\\s*(?:de|of|di|du)\\s*(?:R\\$\\s?)?('+num+')','gi');
  for(const m of t.matchAll(rePct)){
    const p=leiturasDoNumero(m[1])[0], b=leiturasDoNumero(m[2])[0];
    if(p!==undefined&&b!==undefined) contas.push({expressao:m[0].trim(),resultado:Math.round(p*b)/100});
  }
  return contas;
}

/* avaliador pequeno: números, + − × ÷ e parênteses, com precedência */
function avaliarConta(expr){
  const fichas=[];
  const re=/\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?|[-+*/x×÷()])/gy;
  const limpa=String(expr).replace(/R\$\s?/g,'');
  let m, fim=0;
  while((m=re.exec(limpa))){ fichas.push(m[1]); fim=re.lastIndex; }
  if(limpa.slice(fim).trim()||fichas.length<3) return null;
  let i=0;
  const ver=()=>fichas[i];
  function fator(){
    const f=fichas[i++];
    if(f==='('){ const v=soma(); if(fichas[i++]!==')') throw new Error('parêntese'); return v; }
    if(f==='-') return -fator();
    const n=leiturasDoNumero(f)[0];
    if(n===undefined) throw new Error('número');
    return n;
  }
  function produto(){
    let v=fator();
    while(['*','/','x','×','÷'].includes(ver())){
      const o=fichas[i++], d=fator();
      if(o==='/'||o==='÷'){ if(d===0) throw new Error('divisão por zero'); v/=d; } else v*=d;
    }
    return v;
  }
  function soma(){
    let v=produto();
    while(ver()==='+'||ver()==='-'){ const o=fichas[i++]; const d=produto(); v=o==='+'?v+d:v-d; }
    return v;
  }
  try{
    const v=soma();
    if(i!==fichas.length||!Number.isFinite(v)) return null;
    return Math.round(v*100)/100;
  }catch(e){ return null; }
}

function verificarRespostaIA(resposta,fonte,pergunta){
  /* repetir um número enviado vale para qualquer número do texto. Somar,
     subtrair, ou multiplicar/dividir por uma contagem vale entre valores de
     dinheiro enviados e números que a pessoa escreveu na pergunta. Somar dia
     do mês, ano e contagem entre si dava para "justificar" quase qualquer
     valor pequeno; média por dia, rendimento ou projeção sem o dado
     continuam barrados pelas regras e por aqui. */
  const valores=numerosDoTexto(fonte);
  const conferiveis=numerosConferiveis(fonte);
  const daPergunta=numerosDoTexto(pergunta||'');
  const dinheiro=[...conferiveis.filter(n=>!n.pct).flatMap(n=>n.valores),...daPergunta];
  const contagens=[...new Set(valores.filter(n=>Number.isInteger(n)&&n>=2&&n<=120))];
  /* percentual só bate com percentual: "300% ao ano" não vira verdade porque
     existe uma compra de R$ 300 nos dados */
  const percentuais=conferiveis.filter(n=>n.pct).flatMap(n=>n.valores);
  const suspeitos=[];
  for(const n of numerosConferiveis(resposta)){
    let ok;
    if(n.tolerancia) ok=n.valores.some(v=>dinheiro.some(d=>Math.abs(d-v)<n.tolerancia));
    else if(n.pct) ok=n.valores.some(v=>bateComLista(v,percentuais));
    else ok=n.valores.some(v=>bateComLista(v,valores,dinheiro,contagens));
    if(!ok && !suspeitos.includes(n.texto)) suspeitos.push(n.texto);
  }
  return {ok:suspeitos.length===0,suspeitos};
}
