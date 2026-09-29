/* Dados fictícios; nenhuma chave ou consulta real. O runner isolado bloqueia
   tráfego externo. Mede avisos e vínculos no caminho de confirmação da UI. */
const {conectar,avaliar,irPara,esperar}=require('./cdp');
const {APP,conferir,encerrar,limparAparelho}=require('./ajuda');
const {criarAmbiente}=require('../ambiente');
const hoje=new Date().toISOString().slice(0,10);
const motor=criarAmbiente({},hoje),d=motor.defaultData(); motor.data=d;
Object.assign(d,{idioma:'pt',onboardingCompleto:true,tourCompleto:true,pierreAtivo:true,
  pierreTrazerSaldo:false,pierreTrazerLancamentos:false,pierreTrazerCartao:true,pierreTrazerFixos:true});
const sinc=motor.aplicarSincronizacaoPierre({novas:[{id:'teste-manual',idExterno:'teste-banco',
  nome:'Antes',valor:100,metodo:'debito',data:hoje,categoria:'Outros'}],trazerSaldo:false});
motor.registrarImportacaoPierre({sinc});d.transacoes[0].nome='Editado depois';d.transacoes[0].valor=75;
async function painel(c){
  await avaliar(c,`document.getElementById('topbar-settings-btn').click(); return 1;`);
  await esperar(600);
  await avaliar(c,`document.getElementById('settings-tab-banco').click(); return 1;`);
  await esperar(400);
}
(async()=>{
  const c=await conectar();await limparAparelho(c);
  await avaliar(c,`localStorage.setItem('financas-data',${JSON.stringify(JSON.stringify(d))});
    sessionStorage.setItem('financas-pierre-chave','sk-ficticia000000000000000000000000');return 1;`);
  await irPara(c,APP);await esperar(1500);await painel(c);
  const resumo=await avaliar(c,`return {botao:document.getElementById('pierre-desfazer-btn').style.display,
    texto:document.getElementById('pierre-desfazer-resumo').textContent};`);
  conferir(resumo.botao!=='none','desfazer continua acessível quando todos os lançamentos foram editados');
  conferir(resumo.texto.includes('Mantidos por segurança: 1'),'prévia informa o registro preservado');
  await avaliar(c,`document.getElementById('pierre-desfazer-btn').click();return 1;`);await esperar(400);
  await avaliar(c,`document.getElementById('confirm-ok').click();return 1;`);await esperar(900);
  const salvo=await avaliar(c,`return {d:JSON.parse(localStorage.getItem('financas-data')),
    aviso:document.getElementById('pierre-estado').textContent};`);
  conferir(salvo.d.transacoes[0].valor===75&&salvo.d.transacoes[0].nome==='Editado depois','edição permanece após confirmar pela interface');
  conferir(salvo.aviso.includes('Mantidos por segurança: 1'),'resultado informa o que permaneceu');
  await avaliar(c,`
    window.fetch=async entrada=>{
      const rota=new URL(String(entrada),location.origin).searchParams.get('rota');
      let data=[];
      if(rota==='get-accounts') data=['a','b'].map(id=>({id,name:'Cartão '+id,type:'CREDIT',
        subtype:'CREDIT_CARD',balance:'0.00',connectorName:'Banco teste',creditData:{creditLimit:1000}}));
      if(rota==='get-transactions') data=['a','b','sem-vinculo'].flatMap(id=>[1,2].map(atras=>{
        const dia=new Date();dia.setDate(5);dia.setMonth(dia.getMonth()-atras);
        return {id:id+atras,account_id:id,account_type:'CREDIT',type:'DEBIT',amount:-30,
          description:'Serviço mensal',status:'POSTED',date:dia.toISOString().slice(0,10)};
      }));
      return new Response(JSON.stringify({success:true,count:data.length,data}),{status:200});
    };
    document.getElementById('pierre-sync-btn').click();return 1;`);
  await esperar(1700);
  const opcoes=await avaliar(c,`return [...document.querySelectorAll('#pierre-fixos-lista label')].map(l=>({
    texto:l.textContent,desabilitado:l.querySelector('input').disabled}));`);
  conferir(opcoes.length===3,'sugestões de três origens não são agrupadas pelo mesmo nome');
  conferir(opcoes.some(o=>o.texto.includes('Cartão a')&&!o.desabilitado)&&opcoes.some(o=>o.texto.includes('Cartão b')&&!o.desabilitado),
    'prévia distingue os dois cartões que serão importados');
  conferir(opcoes.filter(o=>o.desabilitado).length===1&&opcoes.some(o=>o.texto.includes('Não foi possível vincular')),
    'origem sem vínculo fica desabilitada e explica o motivo');
  await avaliar(c,`const l=[...document.querySelectorAll('#pierre-fixos-lista label')].find(l=>l.textContent.includes('Cartão b'));
    l.querySelector('input').checked=true;document.querySelector('#pierre-plano .add-gasto-confirm').click();return 1;`);
  await esperar(1000);
  const final=await avaliar(c,`return JSON.parse(localStorage.getItem('financas-data'));`);
  conferir(final.gastosMensais.length===1&&final.gastosMensais[0].cartaoId===final.cartoes.find(k=>k.idExterno==='b').id,
    'confirmar vincula a assinatura ao cartão escolhido recém-importado');
  c.fechar();encerrar();
})().catch(e=>{console.error(e);process.exit(1);});
