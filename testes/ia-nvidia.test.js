/* A ponte api/ia-nvidia.js: só repassa, com modelo fixo, e não ecoa nada.
   O fetch da NVIDIA é um dublê — nenhuma chamada sai daqui. */
const path=require('path');
const {Readable}=require('stream');

function pedido(metodo,cabecalhos,corpo){
  const req=Readable.from(corpo===undefined?[]:[corpo]);
  req.method=metodo; req.headers=cabecalhos||{};
  return req;
}
function resposta(){
  const r={statusCode:0,cab:{},corpo:'',setHeader(k,v){this.cab[k.toLowerCase()]=v;},end(t){this.corpo=t||'';}};
  return r;
}
const CHAVE='Bearer nvapi-'+'x'.repeat(40);

module.exports=async function(t){
  console.log('\n\x1b[1mIA: ponte para a NVIDIA (api/ia-nvidia.js)\x1b[0m');
  const ponte=require(path.join(__dirname,'..','api','ia-nvidia.js'));
  const fetchReal=global.fetch;
  let enviado=null, devolver=null;
  global.fetch=async(url,init)=>{ enviado={url,init,corpo:JSON.parse(init.body)}; return devolver(); };
  try{
    let res=resposta(); await ponte(pedido('GET',{}),res);
    t.igual(res.statusCode,405,'só aceita POST');

    res=resposta(); await ponte(pedido('POST',{authorization:'Bearer sk-errada'},'{"prompt":"oi"}'),res);
    t.igual(res.statusCode,401,'recusa chave que não é da NVIDIA');
    t.igual(enviado,null,'sem chave válida, nada sai para a NVIDIA');

    res=resposta(); await ponte(pedido('POST',{authorization:CHAVE},'{"prompt":""}'),res);
    t.igual(res.statusCode,400,'recusa pergunta vazia');
    res=resposta(); await ponte(pedido('POST',{authorization:CHAVE},JSON.stringify({prompt:'a'.repeat(40001)})),res);
    t.igual(res.statusCode,400,'recusa pergunta grande demais');

    devolver=()=>({ok:true,json:async()=>({choices:[{message:{content:'<think>contas</think>  Cabe: sobram R$ 610,00. '}}]})});
    res=resposta(); await ponte(pedido('POST',{authorization:CHAVE},JSON.stringify({prompt:'pergunta',model:'outro/modelo-caro'})),res);
    t.igual(res.statusCode,200,'resposta da NVIDIA volta com 200');
    t.igual(JSON.parse(res.corpo).texto,'Cabe: sobram R$ 610,00.','o raciocínio entre <think> fica de fora');
    t.igual(enviado.url,'https://integrate.api.nvidia.com/v1/chat/completions','vai para o endereço oficial');
    t.igual(enviado.corpo.model,'nvidia/nemotron-3-ultra-550b-a55b','o modelo é o fixado aqui, não o que o cliente pediu');
    t.igual(enviado.corpo.temperature,0.2,'temperatura baixa');
    t.igual(enviado.init.headers.Authorization,CHAVE,'a chave de quem usa é repassada');
    t.igual(res.cab['cache-control'],'no-store','resposta não fica em cache');

    devolver=()=>({ok:false,status:401,text:async()=>'eco da chave '+CHAVE});
    res=resposta(); await ponte(pedido('POST',{authorization:CHAVE},'{"prompt":"p"}'),res);
    t.igual(res.statusCode,401,'chave recusada pela NVIDIA vira 401');
    t.verdadeiro(!res.corpo.includes('nvapi-'),'o corpo do erro da NVIDIA não é repassado',res.corpo);

    devolver=()=>({ok:false,status:500});
    res=resposta(); await ponte(pedido('POST',{authorization:CHAVE},'{"prompt":"p"}'),res);
    t.igual(res.statusCode,503,'erro do servidor da NVIDIA vira 503 (o app tenta de novo)');

    devolver=()=>({ok:true,json:async()=>({choices:[{message:{content:'   '}}]})});
    res=resposta(); await ponte(pedido('POST',{authorization:CHAVE},'{"prompt":"p"}'),res);
    t.igual(res.statusCode,502,'resposta vazia não chega como sucesso');

    devolver=()=>{ throw new Error('rede'); };
    res=resposta(); await ponte(pedido('POST',{authorization:CHAVE},'{"prompt":"p"}'),res);
    t.igual(res.statusCode,504,'falha de rede vira 504');
  }finally{ global.fetch=fetchReal; }
};
