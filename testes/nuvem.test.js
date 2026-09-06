/* Transporte da sincronização: as duas funções do banco (src/storage/sync.js).

   Aqui não há rede. O `fetch` é um dublê que responde o que aoii_get e aoii_put
   respondem de verdade — os formatos foram conferidos contra o projeto real ao
   aplicar a migração, e estão anotados no rodapé de
   supabase/migrations/0001_sync_seguro.sql.

   O que se testa é a tradução: resposta do banco → decisão do app. Em especial
   que conflito é DESFECHO, não exceção: se ele virasse `throw`, o app cairia no
   catch e trataria como erro de rede, que é justamente onde a sobrescrita
   silenciosa nasceria de novo. */
const {criarAmbiente}=require('./ambiente');

const HOJE='2026-09-05';

/* dublê de fetch: guarda o que foi pedido e devolve o que for combinado */
function fetchFalso(respostas){
  const chamadas=[];
  const f=async(url,opcoes)=>{
    const corpo=JSON.parse(opcoes.body);
    chamadas.push({url,corpo});
    const r=respostas.shift();
    if(r&&r.rede) throw new Error('falha de rede');
    return {
      ok:r?r.ok!==false:true,
      status:r&&r.status||200,
      json:async()=>(r?r.json:null),
    };
  };
  f.chamadas=chamadas;
  return f;
}

module.exports=async function(t){
  console.log('\n\x1b[1mTransporte da sincronização\x1b[0m');

  const comFetch=(respostas)=>{
    const c=criarAmbiente({},HOJE);
    c.fetch=fetchFalso(respostas);
    c.AbortController=AbortController;
    c.setTimeout=setTimeout; c.clearTimeout=clearTimeout;
    return c;
  };

  /* ── leitura ── */
  {
    const c=comFetch([{json:{data:{aoii:'sync',cipher:{}},revision:7,device_id:'ap-a',updated_at:'2026-09-05T10:00:00Z'}}]);
    const r=await c.nuvemLer('CODIGO12');
    t.igual(c.fetch.chamadas[0].url.endsWith('/rest/v1/rpc/aoii_get'),true,
      'a leitura chama a função, não a tabela');
    t.igual(c.fetch.chamadas[0].corpo.p_id,'CODIGO12','manda o id pedido');
    t.igual(r.revision,7,'devolve a revisão');
    t.igual(r.device_id,'ap-a','e qual aparelho gravou por último');
    t.igual(r.envelope.aoii,'sync','e o envelope como está guardado');
  }
  {
    const c=comFetch([{json:null}]);
    t.igual(await c.nuvemLer('NAOEXISTE'),null,'código que não existe devolve nulo, não erro');
  }
  {
    const c=comFetch([{json:{data:{saldoAtual:10},revision:null,device_id:null,updated_at:null}}]);
    const r=await c.nuvemLer('ANTIGO12');
    t.igual(r.revision,0,'linha antiga, sem revisão, conta como revisão 0');
    t.igual(r.envelope.saldoAtual,10,'e o conteúdo em texto puro atravessa — quem decide é quem chama');
  }

  /* ── gravação: os três desfechos ── */
  {
    const c=comFetch([{json:{ok:true,revision:1}}]);
    const r=await c.nuvemGravar('CODIGO12',{aoii:'sync'},0,'t'.repeat(64));
    t.igual(c.fetch.chamadas[0].url.endsWith('/rest/v1/rpc/aoii_put'),true,'a gravação também');
    t.igual(c.fetch.chamadas[0].corpo.p_expected_revision,0,'manda a revisão esperada');
    t.igual(c.fetch.chamadas[0].corpo.p_write_token.length,64,'e o token de escrita');
    t.igual(r.ok,true,'gravou');
    t.igual(r.revision,1,'e devolve a revisão nova');
  }
  {
    const c=comFetch([{json:{conflito:true,revision:9}}]);
    const r=await c.nuvemGravar('CODIGO12',{aoii:'sync'},4,'t'.repeat(64));
    t.igual(r.conflito,true,'conflito é desfecho, não exceção');
    t.igual(r.revision,9,'e diz qual é a revisão de lá');
    t.igual(r.ok,undefined,'conflito nunca sai como sucesso');
  }
  {
    const c=comFetch([{json:{erro:'token'}}]);
    const r=await c.nuvemGravar('CODIGO12',{aoii:'sync'},1,'x'.repeat(64));
    t.igual(r.erro,'token','token errado é recusa nomeada');
    t.igual(r.ok,undefined,'e não sucesso');
  }
  {
    const c=comFetch([{json:{erro:'tamanho'}}]);
    t.igual((await c.nuvemGravar('CODIGO12',{},1,'t'.repeat(64))).erro,'tamanho',
      'o servidor também tem teto de tamanho, e ele chega nomeado');
  }
  {
    const c=comFetch([{json:{}}]);
    t.igual((await c.nuvemGravar('CODIGO12',{},1,'t'.repeat(64))).erro,'desconhecido',
      'resposta que não reconhecemos não passa por sucesso');
  }

  /* ── rede ── */
  {
    const c=comFetch([{rede:true}]);
    let erro=null;
    try{ await c.nuvemGravar('CODIGO12',{},0,'t'.repeat(64)); }catch(e){ erro=e.message; }
    t.igual(erro,'falha de rede','falha de rede sobe como exceção — é ela que merece retentativa');
  }
  {
    const c=comFetch([{ok:false,status:404}]);
    let erro=null;
    try{ await c.nuvemLer('CODIGO12'); }catch(e){ erro=e.message; }
    t.igual(erro,'rpc-aoii_get-404','erro de HTTP vira mensagem com o status, pra dar pra diagnosticar');
  }
};
