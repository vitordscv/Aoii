#!/usr/bin/env node
/* Auditorias estruturais do HTML publicado — as coisas que um teste de unidade
   não pega: integridade do arquivo, cobertura de tradução, contraste dos temas,
   classes de CSS órfãs e ids repetidos.

   Uso:  node testes/auditar.js  [caminho/para/index.html]
   Sem argumento, audita dist/index.html (rode npm run build antes).
   Sai com 0 se estiver tudo certo, 1 se houver problema. */
const fs=require('fs');
const path=require('path');
const {lerAppInterno,estaEmpacotado,CAMINHO_PADRAO}=require('./extrair-motor');

const ARQUIVO=process.argv[2]?path.resolve(process.argv[2]):CAMINHO_PADRAO;
const src=lerAppInterno(ARQUIVO);
const bruto=fs.readFileSync(ARQUIVO,'utf8');

let problemas=0;
const titulo=t=>console.log('\n\x1b[1m'+t+'\x1b[0m');
const ok=m=>console.log('  \x1b[32m✓\x1b[0m '+m);
const ruim=(m,d)=>{problemas++;console.log('  \x1b[31m✗\x1b[0m '+m+(d?'\n      \x1b[31m'+d+'\x1b[0m':''));};

/* ── cores ── */
const h2=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));};
const lum=c=>{const f=c.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return .2126*f[0]+.7152*f[1]+.0722*f[2];};
const cr=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);};

titulo('Integridade do arquivo publicado');
{
  if(estaEmpacotado(ARQUIVO)){
    /* formato antigo (até 6556d20): a página vive como string JSON */
    const linhas=bruto.split('\n');
    const i=linhas.findIndex(l=>l.trim().startsWith('"<!DOCTYPE html>'));
    try{ JSON.parse(linhas[i]); ok('o template desempacota como JSON válido'); }
    catch(e){ ruim('o template não desempacota','JSON inválido: '+e.message); }
    if(linhas[i].includes('</')) ruim('há "</" cru dentro da string do template — isso fecha o <script> antes da hora');
    else ok('nenhum "</" cru dentro da string (o </script> não vaza)');
  }else{
    if(/^<!DOCTYPE html>/i.test(bruto.trim())) ok('documento HTML simples, sem invólucro de bundler');
    else ruim('o arquivo não começa com <!DOCTYPE html>');
    const aviso=bruto.split('\n')[1]||'';
    if(aviso.includes('ARQUIVO GERADO')) ok('traz o aviso de arquivo gerado');
    else ruim('falta o aviso "ARQUIVO GERADO" na segunda linha','quem editar isto à mão perde o trabalho no próximo build');
  }
  const vm=require('vm');
  const blocos=[...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .filter(m=>!/type=["'](?!text\/javascript|module)/.test(m[0].slice(0,m[0].indexOf('>')+1)))
    .map(m=>m[1]).filter(c=>c.trim());
  let erros=0;
  blocos.forEach((c,i)=>{ try{ new vm.Script(c,{filename:'bloco'+i}); }catch(e){ erros++; ruim('erro de sintaxe no bloco JS '+i,e.message); } });
  if(!erros) ok(blocos.length+' bloco(s) de JavaScript com sintaxe válida');
}

titulo('Tradução');
{
  /* Hoje cada idioma é um `const I18N_XX={…};` próprio (src/i18n/<idioma>.js).
     Até a extração era um objeto único, `const I18N={pt:{…},en:{…}}`. Reconhece
     os dois pra poder auditar também um index.html antigo. */
  const chaves=t=>new Set((t.match(/'([a-zA-Z0-9_.]+)':/g)||[]).map(k=>k.slice(1,-2)));
  const IDIOMAS=['pt','en','es','fr','it'];
  const idiomas={};
  if(src.includes('const I18N_PT={')){
    IDIOMAS.forEach(id=>{
      const ini=src.indexOf('const I18N_'+id.toUpperCase()+'={');
      if(ini<0){ ruim('não achei o dicionário de '+id); idiomas[id]=new Set(); return; }
      /* o dicionário fecha com "};" em linha própria; se o corte não achar isso,
         para no próximo dicionário — nunca engole o idioma seguinte */
      const fecha=src.indexOf('\n};',ini);
      const proximo=src.indexOf('\nconst I18N',ini+1);
      const fim=Math.min(fecha<0?Infinity:fecha, proximo<0?Infinity:proximo);
      if(!isFinite(fim)){ ruim('não achei o fim do dicionário de '+id); idiomas[id]=new Set(); return; }
      idiomas[id]=chaves(src.slice(ini,fim));
    });
  }else{
    const ini=src.indexOf('const I18N='), fim=src.indexOf('function localeAtual');
    const bloco=src.slice(ini,fim>ini?fim:src.indexOf('function L(key)'));
    const marcas=IDIOMAS.map(id=>({id,pos:bloco.indexOf('\n  '+id+':{')})).sort((a,b)=>a.pos-b.pos);
    marcas.forEach((m,i)=>{
      idiomas[m.id]=chaves(bloco.slice(m.pos, i+1<marcas.length?marcas[i+1].pos:bloco.length));
    });
  }
  const usadas=new Set([
    ...(src.match(/L\('([a-zA-Z0-9_.]+)'\)/g)||[]).map(s=>s.slice(3,-2)),
    ...(src.match(/data-i18n(?:-placeholder|-title)?="([a-zA-Z0-9_.]+)"/g)||[]).map(s=>s.split('"')[1])]);
  const semPt=[...usadas].filter(k=>!idiomas.pt.has(k)).sort();
  semPt.length ? ruim(semPt.length+' chave(s) usadas sem definição',semPt.join(', '))
               : ok(usadas.size+' chaves usadas, todas definidas');
  ['en','es','fr','it'].forEach(id=>{
    const faltam=[...idiomas.pt].filter(k=>!idiomas[id].has(k));
    faltam.length ? ruim(id+': faltam '+faltam.length+' tradução(ões)',faltam.slice(0,12).join(', '))
                  : ok(id+': completo');
  });
}

titulo('Contraste dos temas (mínimo WCAG AA 4.5:1)');
{
  const temas={};let m;
  const re=/html\[data-theme="([a-z]+)"\]\{([\s\S]*?)\n\}/g;
  while((m=re.exec(src))) temas[m[1]]=m[2];
  const raiz=/:root\{([\s\S]*?)\n\}/.exec(src);
  if(raiz) temas['onda']=raiz[1];
  const v=(b,n)=>{const r=new RegExp('--'+n+':\\s*([^;]+);').exec(b);return r?r[1].trim():null;};
  const resolve=(b,n)=>{let x=v(b,n);let g=0;while(x&&/^var\(--([\w-]+)\)$/.test(x)&&g++<5) x=v(b,/^var\(--([\w-]+)\)$/.exec(x)[1]);return x;};
  const pares=[
    ['muted','white',4.5,'texto de apoio no card'],
    ['muted','cream',4.5,'texto de apoio no fundo'],
    ['muted2','white',4.5,'texto secundário no card'],
    ['muted2','cream',4.5,'texto secundário no fundo'],
    ['muted3','white',3.5,'tom de desênfase'],
    ['on-accent','disney-blue-deep',4.5,'texto sobre o acento'],
    ['accent-ink','white',4.5,'acento usado como texto'],
    ['accent-ink','mist-lilac',4.5,'acento como texto em etiqueta'],
    ['gold-ink','white',4.5,'dourado como texto'],
    ['pos','white',4.5,'valor positivo'],
    ['neg','white',4.5,'valor negativo'],
    ['num-color','white',4.5,'número principal'],
    ['warn-text','warn-bg',4.5,'texto do aviso'],
  ];
  let falhas=0, checados=0;
  Object.entries(temas).forEach(([nome,b])=>{
    pares.forEach(([fg,bg,min,desc])=>{
      const a=resolve(b,fg), c=resolve(b,bg);
      if(!a||!c||!a.startsWith('#')||!c.startsWith('#')) return;
      checados++;
      const r=cr(h2(a),h2(c));
      if(r<min){ falhas++; ruim(nome+': '+r.toFixed(2)+' (mín '+min+') --'+fg+' sobre --'+bg,desc); }
    });
  });
  if(!falhas) ok(checados+' pares de cor verificados em '+Object.keys(temas).length+' temas, todos acima do mínimo');
}

titulo('CSS e marcação');
{
  let css='',resto=src;
  [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].forEach(m=>{css+='\n'+m[1];resto=resto.split(m[0]).join('');});
  const definidas=new Set((css.match(/\.[-A-Za-z][-A-Za-z0-9_]*/g)||[]).map(c=>c.slice(1)));
  const usadas=new Set();
  (resto.match(/class="([^"]*)"/g)||[]).forEach(m=>m.slice(7,-1).split(/\s+/).forEach(c=>{
    c=c.replace(/\$\{[\s\S]*?\}/g,'').trim(); if(c&&!/[${}'"?:]/.test(c)) usadas.add(c);}));
  (resto.match(/classList\.(?:add|remove|toggle|contains)\('([-A-Za-z0-9_]+)'/g)||[]).forEach(m=>usadas.add(m.split("'")[1]));
  (resto.match(/querySelector(?:All)?\('\.([-A-Za-z0-9_]+)/g)||[]).forEach(m=>usadas.add(m.split("'.")[1]));
  const semRegra=[...usadas].filter(c=>!definidas.has(c)).sort();
  /* classes que só existem junto de outra já estilizada não são problema */
  const toleradas=new Set(['settings-panel','meta-alvo','meta-guardado']);
  const reais=semRegra.filter(c=>!toleradas.has(c));
  reais.length ? ruim(reais.length+' classe(s) usadas sem nenhuma regra de CSS',reais.join(', '))
               : ok(usadas.size+' classes usadas, todas com estilo');

  const ids=(resto.match(/\sid="([a-zA-Z0-9_-]+)"/g)||[]).map(s=>s.split('"')[1]);
  const cont={}; ids.forEach(i=>cont[i]=(cont[i]||0)+1);
  const dups=Object.entries(cont).filter(([,n])=>n>1);
  dups.length ? ruim('id repetido no HTML',dups.map(([i,n])=>i+' ×'+n).join(', '))
              : ok(new Set(ids).size+' ids únicos, nenhum repetido');

  const geradosPrefixo=(resto.match(/id="([a-zA-Z0-9_-]*)\$\{/g)||[]).map(s=>s.slice(4).replace('${',''));
  const buscados=[...new Set((resto.match(/getElementById\('([a-zA-Z0-9_-]+)'\)/g)||[]).map(s=>s.slice(16,-2)))];
  const criadosEmJs=new Set(['info-tip-popover']);
  const fantasmas=buscados.filter(i=>!new Set(ids).has(i)&&!criadosEmJs.has(i)&&!geradosPrefixo.some(p=>p&&i.startsWith(p)));
  fantasmas.length ? ruim('getElementById aponta pra id que não existe',fantasmas.join(', '))
                   : ok(buscados.length+' referências getElementById, todas resolvem');
}

console.log('\n'+'─'.repeat(58));
if(problemas===0){ console.log('\x1b[32m\x1b[1mAuditoria limpa.\x1b[0m'); process.exit(0); }
console.log('\x1b[31m\x1b[1m'+problemas+' problema(s) encontrados.\x1b[0m'); process.exit(1);
