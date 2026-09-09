/* Traduções: um arquivo por idioma (src/i18n/<idioma>.js), montados em I18N
   por src/i18n/dictionary.js. Estes testes guardam o que a separação em
   arquivos pode quebrar sem ninguém perceber: um idioma ficar com um conjunto
   de chaves diferente do português, ou a montagem sair fora de ordem e o
   dicionário chegar vazio na hora de traduzir. */
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {lerAppInterno,CAMINHO_PADRAO}=require('./extrair-motor');

const IDIOMAS=['pt','en','es','fr','it'];

/* recorta `const I18N_XX={…\n};` do HTML publicado e avalia */
function carregarDicionarios(arquivo){
  const src=lerAppInterno(arquivo||process.env.AOII_INDEX||CAMINHO_PADRAO);
  let codigo='';
  for(const id of IDIOMAS){
    const marca='const I18N_'+id.toUpperCase()+'={';
    const ini=src.indexOf(marca);
    if(ini<0) throw new Error('não achei '+marca+' no HTML publicado');
    const fim=src.indexOf('\n};',ini);
    if(fim<0) throw new Error(id+': o dicionário não fecha com "};" em linha própria');
    codigo+=src.slice(ini,fim+3)+'\n';
  }
  const iMont=src.indexOf('const I18N={pt:');
  if(iMont<0) throw new Error('não achei a montagem `const I18N={pt:…}`');
  codigo+=src.slice(iMont,src.indexOf(';',iMont)+1)+'\nglobalThis.SAIDA=I18N;';
  const ctx={}; vm.createContext(ctx);
  vm.runInContext(codigo,ctx,{filename:'i18n-aoii.js'});
  return ctx.SAIDA;
}

module.exports=function(t){
  console.log('\n\x1b[1mTraduções\x1b[0m');

  let I18N;
  try{ I18N=carregarDicionarios(); }
  catch(e){ t.verdadeiro(false,'os dicionários carregam',e.message); return; }

  t.igual(Object.keys(I18N).join(','),IDIOMAS.join(','),
    'I18N tem os cinco idiomas, na ordem esperada');

  const chavesPt=Object.keys(I18N.pt).sort();
  t.verdadeiro(chavesPt.length>500,
    'o português tem o dicionário cheio ('+chavesPt.length+' chaves)',
    'veio com '+chavesPt.length+' — a montagem provavelmente pegou o arquivo errado');

  for(const id of IDIOMAS.slice(1)){
    const chaves=Object.keys(I18N[id]).sort();
    const faltam=chavesPt.filter(k=>!(k in I18N[id]));
    const sobram=chaves.filter(k=>!(k in I18N.pt));
    t.verdadeiro(faltam.length===0&&sobram.length===0,
      id+': mesmo conjunto de chaves do português',
      'faltam '+faltam.length+' ('+faltam.slice(0,5).join(', ')+
      '), sobram '+sobram.length+' ('+sobram.slice(0,5).join(', ')+')');
  }

  /* nenhum valor pode estar vazio: chave traduzida pra string vazia some da tela */
  const vazias=[];
  for(const id of IDIOMAS){
    for(const [k,v] of Object.entries(I18N[id])){
      if(typeof v!=='string'||v.trim()==='') vazias.push(id+'/'+k);
    }
  }
  t.igual(vazias.length,0,'nenhuma tradução vazia ou não-texto');

  /* os marcadores {…} têm que aparecer nas traduções também, senão o valor
     nunca é substituído e o usuário lê "A partir de" sem o mês */
  const semMarcador=[];
  for(const [k,v] of Object.entries(I18N.pt)){
    const marcadores=(v.match(/\{[a-zA-Z]+\}/g)||[]);
    if(!marcadores.length) continue;
    for(const id of IDIOMAS.slice(1)){
      const alvo=I18N[id][k]||'';
      for(const m of marcadores) if(!alvo.includes(m)) semMarcador.push(id+'/'+k+' sem '+m);
    }
  }
  t.igual(semMarcador.length,0,'todo marcador {…} do português existe nas traduções');
  if(semMarcador.length) console.log('      '+semMarcador.slice(0,10).join('\n      '));

  /* L() cai no português quando a chave não existe no idioma escolhido */
  const arquivo=process.env.AOII_INDEX||CAMINHO_PADRAO;
  const src=lerAppInterno(arquivo);
  const iL=src.indexOf('function L(key)');
  const fimL=src.indexOf('\n',iL);
  const ctx={I18N,data:{idioma:'fr'}};
  vm.createContext(ctx);
  vm.runInContext(src.slice(iL,fimL)+'\nglobalThis.R=L;',ctx,{filename:'L.js'});
  t.igual(ctx.R('nav.entradas'),I18N.fr['nav.entradas'],'L() usa o idioma escolhido');
  t.igual(ctx.R('chave.que.nao.existe'),'chave.que.nao.existe',
    'chave inexistente devolve a própria chave (fica visível na tela em vez de sumir)');
  ctx.data.idioma='xx';
  t.igual(ctx.R('nav.entradas'),I18N.pt['nav.entradas'],'idioma desconhecido cai no português');

  /* Os identificadores antigos das categorias continuam em português nos
     dados. Só o rótulo mostrado muda, e categorias pessoais não são tocadas. */
  const iCat=src.indexOf('const CATEGORIA_I18N_KEYS=');
  const iCatFn=src.indexOf('function categoriaLabel(c)',iCat);
  const fimCat=src.indexOf('\n',iCatFn);
  const ctxCat={I18N,data:{idioma:'en'}};
  vm.createContext(ctxCat);
  vm.runInContext(src.slice(iL,fimL)+'\n'+src.slice(iCat,fimCat)+
    '\nglobalThis.C=categoriaLabel;',ctxCat,{filename:'categoria-label.js'});
  t.igual(ctxCat.C('Mercado'),'Groceries','categoria padrão é traduzida só na apresentação');
  ctxCat.data.idioma='pt';
  t.igual(ctxCat.C('Saúde'),'Saúde','categoria padrão mantém o rótulo em português');
  ctxCat.data.idioma='fr';
  t.igual(ctxCat.C('Pets'),'Pets','categoria criada pela pessoa nunca é renomeada');
};
