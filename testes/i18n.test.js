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

  /* ── palpite de idioma e moeda de quem abre o app pela primeira vez ──
     Nasciam fixos em português e real: um italiano abria o app em português e
     só descobria a troca lendo até o fim do primeiro diálogo, num idioma que
     ele não fala. Vale só pra quem começa agora — quem já tem dados salvos
     passa por migrateData(), que não encosta nesses dois campos. */
  console.log('\n\x1b[1mIdioma e moeda do navegador\x1b[0m');
  const {criarAmbiente}=require('./ambiente');
  const cenario={saldoAtual:0,dinheiroVivo:0,tipoRenda:'mensal',rendaMensal:{valor:0,diaDoMes:5},
    rendaDiaria:0,diasTrabalho:[1,2,3,4,5],idioma:'pt',dataAlvo:'2026-12-31',
    gastosMensais:[],cartoes:[],faturas:[],transacoes:[],entradasExtras:[],comprasPlanejadas:[],
    metas:[],rendasRecorrentes:[],investimentos:[],viagens:[],orcamentos:{},diasNaoTrabalhados:[]};
  const ctxNav=criarAmbiente(cenario,'2026-09-05');

  [[['it-IT'],'it','EUR','Itália'],
   [['en-US','es'],'en','USD','Estados Unidos'],
   [['pt-BR'],'pt','BRL','Brasil'],
   [['pt-PT'],'pt','EUR','Portugal — mesma língua, outra moeda'],
   [['en-GB'],'en','GBP','Reino Unido'],
   [['en-DE'],'en','EUR','inglês na Alemanha: a região manda'],
   [['de-DE','fr-FR'],'fr','EUR','idioma não suportado cede pro próximo'],
   [['ja-JP'],'pt','BRL','nada reconhecido cai no padrão de casa'],
   [[],'pt','BRL','navegador sem idioma nenhum'],
   [['pt'],'pt','BRL','etiqueta sem região usa o idioma']].forEach(([lista,idioma,moeda,apelido])=>{
    t.igual(ctxNav.idiomaDoNavegador(lista),idioma,`idioma em ${apelido}`);
    t.igual(ctxNav.moedaDoNavegador(lista),moeda,`moeda em ${apelido}`);
  });
  /* ── dinheiro se escreve na língua de quem lê, não na do país da moeda ──
     Cada moeda trazia um locale colado nela: o euro vinha com 'de-DE', então
     um francês via "€ 1.234,56" onde se escreve "1 234,56 €" — separador de
     milhar alemão e símbolo do lado errado. Italiano e espanhol viam o
     símbolo antes, quando nas três línguas ele vem depois. */
  console.log('\n\x1b[1mDinheiro no formato de cada língua\x1b[0m');
  const escreve=(idioma,moeda,n)=>{
    ctxNav.data.idioma=idioma; ctxNav.data.moeda=moeda;
    return ctxNav.formatBRL(n);
  };
  /* o próprio Intl é a referência: é ele que carrega a convenção de cada língua */
  const referencia=(idioma,moeda,n)=>new Intl.NumberFormat(
    ({pt:'pt-BR',en:'en-US',es:'es-ES',fr:'fr-FR',it:'it-IT'})[idioma],
    {style:'currency',currency:moeda,minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

  [['pt','BRL'],['en','USD'],['en','GBP'],['fr','EUR'],['it','EUR'],['es','EUR'],
   ['fr','BRL'],['pt','EUR']].forEach(([idioma,moeda])=>{
    t.igual(escreve(idioma,moeda,1234.56),referencia(idioma,moeda,1234.56),
      `${idioma} + ${moeda} sai como se escreve em ${idioma}`);
  });

  /* o mesmo número em duas línguas não pode sair igual quando a convenção
     difere — é o que provava que o locale estava preso à moeda */
  t.verdadeiro(escreve('fr','EUR',1234.56)!==escreve('pt','EUR',1234.56),
    'francês e português não escrevem euro do mesmo jeito',
    'os dois deram '+escreve('fr','EUR',1234.56));
  t.verdadeiro(/^1/.test(escreve('it','EUR',1234.56)),
    'em italiano o símbolo vem depois do número',
    'veio '+escreve('it','EUR',1234.56));
  t.verdadeiro(/^R\$/.test(escreve('pt','BRL',1234.56)),
    'em português o símbolo vem antes',
    'veio '+escreve('pt','BRL',1234.56));

  /* negativo e zero continuam legíveis */
  t.verdadeiro(escreve('pt','BRL',-50).includes('-'),'valor negativo mostra o sinal');
  t.igual(escreve('pt','BRL',0),referencia('pt','BRL',0),'zero também passa pelo formatador');
  t.igual(escreve('pt','BRL',NaN),referencia('pt','BRL',0),'valor ilegível vira zero em vez de "NaN" na tela');

  /* sem moeda, pro eixo do gráfico — que antes arrancava o símbolo com replace */
  ctxNav.data.idioma='fr';
  t.verdadeiro(!/[€$£]/.test(ctxNav.formatValorSemMoeda(1234.56)),
    'o valor sem moeda não traz símbolo nenhum','veio '+ctxNav.formatValorSemMoeda(1234.56));
  ctxNav.data.idioma='pt'; ctxNav.data.moeda='BRL';

  /* o palpite precisa ser um valor que os comandos aceitem, senão entra torto */
  t.verdadeiro(['pt','en','es','fr','it'].every(i=>ctxNav.definirIdioma(ctxNav.idiomaDoNavegador([i+'-XX']))!==null),
    'todo idioma palpitado é aceito por definirIdioma()');
  t.verdadeiro(['BR','US','GB','DE'].every(r=>ctxNav.definirMoeda(ctxNav.moedaDoNavegador(['xx-'+r]))!==null),
    'toda moeda palpitada é aceita por definirMoeda()');
};
