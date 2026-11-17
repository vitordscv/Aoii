
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

/* aceita v se ele está na lista ou é soma/diferença de dois valores de base */
function bateComLista(v,lista,base){
  const conjunto=new Set(lista);
  if(conjunto.has(v)) return true;
  const ops=new Set(base||lista);
  for(const a of ops){
    if(ops.has(Math.round((v-a)*100)/100)) return true;
    if(ops.has(Math.round((a-v)*100)/100)) return true;
  }
  return false;
}

function verificarRespostaIA(resposta,fonte){
  /* repetir um número enviado vale para qualquer número do texto; somar ou
     subtrair só vale entre valores de dinheiro enviados. Somar dia do mês,
     ano e contagem dava para "justificar" quase qualquer valor pequeno.
     Multiplicação e divisão ficam de fora de propósito — é nelas que
     aparecem as médias por dia e as projeções que o resumo não sustenta. */
  const valores=numerosDoTexto(fonte);
  const conferiveis=numerosConferiveis(fonte);
  const dinheiro=conferiveis.filter(n=>!n.pct).flatMap(n=>n.valores);
  /* percentual só bate com percentual: "300% ao ano" não vira verdade porque
     existe uma compra de R$ 300 nos dados */
  const percentuais=conferiveis.filter(n=>n.pct).flatMap(n=>n.valores);
  const suspeitos=[];
  for(const n of numerosConferiveis(resposta)){
    let ok;
    if(n.tolerancia) ok=n.valores.some(v=>dinheiro.some(d=>Math.abs(d-v)<n.tolerancia));
    else if(n.pct) ok=n.valores.some(v=>bateComLista(v,percentuais));
    else ok=n.valores.some(v=>bateComLista(v,valores,dinheiro));
    if(!ok && !suspeitos.includes(n.texto)) suspeitos.push(n.texto);
  }
  return {ok:suspeitos.length===0,suspeitos};
}
