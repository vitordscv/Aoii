/* Relógio e rede controlados; executa a fila e persist do HTML construído. */
const vm=require('vm');
const {lerAppInterno,CAMINHO_PADRAO,recortar}=require('./extrair-motor');
const {criarArmazenamentoFalso}=require('./nuvem-falsa');
const src=lerAppInterno(process.env.AOII_INDEX||CAMINHO_PADRAO);
const trecho=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
function adiar(){let resolver;const promessa=new Promise(r=>{resolver=r;});return {promessa,resolver};}
function aparelho(storage=criarArmazenamentoFalso()){
  const timers=new Map(),eventos={};let id=0;
  const c={console,JSON,Map,Number,Math,localStorage:storage,code:'FILA12345',
    data:{saldoAtual:100},STORAGE_KEY:'dados-teste',sync:{revisao:1,status:'sincronizada'},
    getSyncCode:()=>c.code,sufixoDeHomologacao:()=> '_homolog',
    setSyncCode:codigo=>{c.code=codigo;},sincronizacaoDestrancada:()=>true,
    invalidarTimeline:()=>{},L:k=>k,renderStatusSync:()=>{},render:()=>{},
    document:{getElementById:()=>null},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},
    clearTimeout:n=>timers.delete(n),adotarDadosDeFora:d=>({ok:true,data:d}),
    pedirSenhaSync:async()=> 'senha-teste',alertDialog:async()=>{},
    consultarSincronizacao:async()=>({resultado:'cifrada'}),
    esquecerSenha:()=>{c.esqueceuSenha=true;},
  };
  c.window={addEventListener:(nome,fn)=>{eventos[nome]=fn;}};
  vm.createContext(c);
  vm.runInContext(trecho('const store={','const CHAVE_RESGATE='),c);
  vm.runInContext(trecho("const CHAVE_ESTADO_SYNC=",'function textoDoStatusSync'),c);
  ['abrirSyncPelaInterface','destrancarSincronizacao','puxarDaNuvem','conduzirMigracao'].forEach(n=>vm.runInContext(recortar(src,n),c));
  return {c,timers,eventos,storage,async disparar(){const [n,t]=timers.entries().next().value;timers.delete(n);return t.fn();}};
}
module.exports=async t=>{
  console.log('\nFila de sincronização: persistência e concorrência');
  const a=aparelho(),c=a.c,rede=adiar(),enviados=[];
  c.confirmarRevisaoLocal(1);
  c.empurrarParaNuvem=async()=>{enviados.push(c.data.saldoAtual);if(enviados.length===1)await rede.promessa;c.sync.revisao++;return {resultado:'enviado'};};
  await c.persist();
  const primeira=a.disparar();
  c.data.saldoAtual=222;await c.persist();
  t.igual(a.timers.size,0,'uma edição durante o envio não inicia rede concorrente');
  t.igual(c.espelhoPendente(),true,'a edição continua pendente durante a rede');
  rede.resolver();await primeira;
  t.igual(c.espelhoPendente(),true,'a confirmação antiga não limpa a edição nova');
  t.igual(a.timers.size,1,'a conclusão agenda a segunda rodada');
  await a.disparar();
  t.igual(enviados.join(','),'100,222','a segunda rodada envia o saldo mais recente');
  t.igual(c.espelhoPendente(),false,'só limpa após confirmar a última geração');
  t.igual(a.timers.size,0,'não fica repetindo sem alterações');

  c.data.saldoAtual=333;await c.persist(); // fecha antes de disparar 1,5 s
  const b=aparelho(a.storage);b.c.data=JSON.parse(a.storage.getItem('dados-teste'));
  t.igual(b.c.espelhoPendente(),true,'pendência sobrevive ao fechamento antes do debounce');
  b.c.abrirSincronizacao=async()=>{b.c.sync.revisao=9;return {resultado:'aberta',dados:{saldoAtual:999}};};
  await b.c.destrancarSincronizacao();
  t.igual(b.c.data.saldoAtual,333,'reabrir não substitui a edição pendente pela nuvem');
  t.igual(b.c.sync.revisao,3,'reabertura preserva a revisão local para detectar conflito');
  t.igual(b.timers.size,1,'destrancar retoma o envio pendente');
  b.c.empurrarParaNuvem=async()=>({resultado:'sem-conexao'});
  await b.disparar();
  t.igual(b.c.espelhoPendente(),true,'falha de rede não perde a pendência');
  t.verdadeiro([...b.timers.values()][0].ms>1500,'falha de rede usa espera crescente');
  b.c.empurrarParaNuvem=async()=>({resultado:'adiado'});
  await b.disparar();
  t.igual(b.timers.size,0,'conflito adiado não reabre o diálogo em loop');
  t.igual(b.c.espelhoPendente(),true,'conflito adiado mantém o trabalho pendente');
  b.c.data.saldoAtual=444;await b.c.persist();
  t.igual(b.timers.size,0,'nova edição não desfaz a decisão de adiar');

  const d=aparelho();
  await d.c.persist({remoto:true});
  t.igual(d.c.espelhoPendente(),false,'adotar dados remotos não cria envio de eco');
  d.c.sincronizacaoDestrancada=()=>false;await d.c.persist();
  t.igual(d.timers.size,0,'sem senha a fila não tenta enviar');
  t.igual(d.c.espelhoPendente(),true,'salvar trancado deixa o envio pendente');
  d.c.sincronizacaoDestrancada=()=>true;d.eventos.online();
  t.igual(d.timers.size,1,'voltar à rede retoma quando a sessão tem senha');

  const e=aparelho(),leitura=adiar();e.c.confirmarRevisaoLocal(1);
  e.c.receberDaNuvem=async()=>{await leitura.promessa;e.c.sync.revisao=2;return {resultado:'novidade',dados:{saldoAtual:999}};};
  const puxando=e.c.puxarDaNuvem();
  e.c.data.saldoAtual=555;await e.c.persist();leitura.resolver();await puxando;
  t.igual(e.c.data.saldoAtual,555,'edição durante leitura não é sobrescrita');
  t.igual(e.c.sync.revisao,1,'leitura concorrente não avança a revisão local');
  t.igual(e.timers.size,1,'envio retoma depois da leitura concorrente');

  const g=aparelho(),abertura=adiar();g.c.confirmarRevisaoLocal(1);
  g.c.abrirSincronizacao=async()=>{await abertura.promessa;g.c.sync.revisao=8;return {resultado:'aberta',dados:{saldoAtual:999}};};
  const abrindo=g.c.destrancarSincronizacao();
  await Promise.resolve();g.c.data.saldoAtual=777;await g.c.persist();
  abertura.resolver();await abrindo;
  t.igual(g.c.data.saldoAtual,777,'edição durante abertura da rede também fica no aparelho');
  t.igual(g.c.sync.revisao,1,'abrir não adota revisão de dados que não foram aceitos');

  const h=aparelho();h.c.adotarDadosDeFora=()=>({ok:false});
  h.c.receberDaNuvem=async()=>{h.c.sync.revisao=6;return {resultado:'novidade',dados:{}};};
  await h.c.puxarDaNuvem();
  t.igual(h.c.sync.revisao,1,'dados recusados não avançam a revisão local');

  const legado=aparelho();let migrou=false;
  legado.c.consultarSincronizacao=async()=>({resultado:'migrar'});
  legado.c.abrirSincronizacao=async()=>({resultado:'migrar',dados:{saldoAtual:4321}});
  legado.c.exigirBackupAntesDeCifrar=async()=>false;
  legado.c.conduzirMigracao=async()=>{migrou=true;return true;};
  t.igual(await legado.c.destrancarSincronizacao('LEGADO12345'),false,'migração para quando o backup não foi confirmado');
  t.igual(migrou,false,'registro antigo não é cifrado antes do backup');
  t.igual(legado.c.code,'FILA12345','cancelar o backup restaura o código anterior');
  t.igual(legado.c.sync.revisao,1,'cancelar o backup restaura a sessão anterior');

  const inexistente=aparelho();inexistente.c.abrirSincronizacao=async()=>({resultado:'nova'});
  inexistente.c.consultarSincronizacao=async()=>({resultado:'nova'});
  inexistente.c.exigirBackupAntesDeCifrar=async()=>false;
  t.igual(await inexistente.c.destrancarSincronizacao('CODIGONOVO12'),false,'código inexistente também exige backup antes do primeiro envio');
  t.igual(inexistente.c.code,'FILA12345','cancelar a criação restaura o código anterior');

  const m=aparelho(),migracao=adiar(),iniciou=adiar();m.c.confirmarRevisaoLocal(1);
  m.c.mostrarConflitoSync=async()=> 'nuvem';m.c.confirmDialog=async()=>true;
  m.c.migrarParaCifrado=async()=>{iniciou.resolver();await migracao.promessa;m.c.sync.revisao=2;return {resultado:'enviado'};};
  m.c.prepararSincronizacao();const migrando=m.c.conduzirMigracao({saldoAtual:888});
  await iniciou.promessa;m.c.data.saldoAtual=999;await m.c.persist();migracao.resolver();await migrando;
  t.igual(m.c.data.saldoAtual,999,'edição durante migração não é substituída pela cópia escolhida antes');
  t.igual(m.c.espelhoPendente(),true,'migração não limpa a geração criada durante a rede');
  t.igual(m.c.sync.revisao,1,'nova edição após escolher nuvem ainda exige conflito');

  const f=aparelho();f.c.window.storage={set:async()=>false};
  await f.c.persist();
  t.igual(f.c.espelhoPendente(),false,'falha ao salvar não é tratada como edição confirmada');

  console.log('\nConfirmação de envio: captura e releitura concorrente');
  const criptografia=adiar();let recebido,gravado;
  const motor={JSON,sync:{codigo:'FILA12345',chave:{type:'secret'},token:'token-teste',salt:'salt-teste',revisao:1},
    sincronizacaoDestrancada:()=>true,idDesteAparelho:()=> 'aparelho-teste',guardarSalt:()=>{},
    cifrarParaNuvem:async dados=>{await criptografia.promessa;recebido=dados;return {cipher:{ciphertext:'envio-1'}};},
    nuvemGravar:async(codigo,envelope,revisao)=>{gravado={codigo,envelope,revisao};return {ok:true,revision:2};},
    nuvemLer:async()=>({revision:3,envelope:{cipher:{ciphertext:'envio-outro'}}}),
    ehEnvelopeCifrado:()=>true,decifrarDaNuvem:async()=>({saldoAtual:888}),
  };
  vm.createContext(motor);vm.runInContext(recortar(src,'enviarParaNuvem'),motor);
  const dados={saldoAtual:100};const enviando=motor.enviarParaNuvem(dados);
  dados.saldoAtual=200;criptografia.resolver();const resultado=await enviando;
  t.igual(recebido.saldoAtual,100,'criptografia recebe uma cópia estável antes da primeira espera');
  t.igual(gravado.revisao,1,'a gravação usa a revisão capturada');
  t.igual(resultado.resultado,'conflito','outro envio entre gravação e releitura é conflito');
  t.igual(motor.sync.revisao,1,'releitura concorrente não adota revisão de outro aparelho');
  motor.nuvemLer=async()=>({revision:2,envelope:{cipher:{ciphertext:'envio-1'}}});
  t.igual((await motor.enviarParaNuvem(dados)).resultado,'enviado','confirmação do próprio envelope conclui o envio');
};
