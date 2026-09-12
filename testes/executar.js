#!/usr/bin/env node
/* Roda a suíte de testes do motor financeiro do Aoii.
   Uso:  node testes/executar.js
   Sem dependências: só Node. */
const path=require('path');
if(process.argv[2]) process.env.AOII_INDEX=path.resolve(process.argv[2]);

let passou=0, falhou=0, grupoAtual='';
const falhas=[];

function grupo(nome){ grupoAtual=nome; console.log('\n\x1b[1m'+nome+'\x1b[0m'); }
function ok(msg){ passou++; console.log('  \x1b[32m✓\x1b[0m '+msg); }
function erro(msg,detalhe){ falhou++; falhas.push(grupoAtual+' → '+msg+'\n      '+detalhe);
  console.log('  \x1b[31m✗\x1b[0m '+msg+'\n      \x1b[31m'+detalhe+'\x1b[0m'); }

/* comparação de dinheiro: tolera o ruído de ponto flutuante */
function perto(a,b,tol=0.005){ return Math.abs(a-b)<=tol; }

const t={
  igual(real,esperado,msg){
    if(real===esperado) ok(msg);
    else erro(msg,'esperado '+JSON.stringify(esperado)+', veio '+JSON.stringify(real));
  },
  valor(real,esperado,msg){
    if(typeof real==='number'&&perto(real,esperado)) ok(msg);
    else erro(msg,'esperado '+esperado+', veio '+real);
  },
  verdadeiro(cond,msg,detalhe){ cond?ok(msg):erro(msg,detalhe||'condição falsa'); },
  naoNumero(real,msg){
    if(typeof real==='number'&&Number.isNaN(real)) ok(msg);
    else erro(msg,'esperava NaN, veio '+JSON.stringify(real));
  }
};

const arquivos=['motor.test.js','entrada.test.js','datas.test.js','listas.test.js','i18n.test.js',
                'dividas.test.js','fixo-pago.test.js','validacao.test.js','juros.test.js','ferramentas.test.js','cripto.test.js','nuvem.test.js','ciclo-sync.test.js','conflito-real.test.js','sync-queue.test.js','relatorio.test.js','cartao-e-memo.test.js','pierre.test.js'];

/* O arquivo de teste pode devolver uma promessa — a criptografia é assíncrona
   por natureza (Web Crypto). Esperar por ela é o que impede o resumo de sair
   antes dos testes terminarem, contando tudo como se tivesse passado. */
(async()=>{
  for(const f of arquivos){
    try{ await require(path.join(__dirname,f))(t); }
    catch(e){ falhou++; console.log('\n\x1b[31mFALHA AO CARREGAR '+f+':\x1b[0m '+e.message+'\n'+e.stack); }
  }

  console.log('\n'+'─'.repeat(58));
  if(falhou===0){
    console.log('\x1b[32m\x1b[1m'+passou+' testes passaram.\x1b[0m');
    process.exit(0);
  }else{
    console.log('\x1b[31m\x1b[1m'+falhou+' falha(s)\x1b[0m de '+(passou+falhou)+' testes.\n');
    falhas.forEach(f=>console.log('  • '+f));
    process.exit(1);
  }
})();
