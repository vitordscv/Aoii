/* ─── cotações de câmbio: buscar e guardar ───

   Fonte: api.frankfurter.dev, que republica as taxas de referência do Banco
   Central Europeu. Sem chave, sem cadastro, CORS aberto. O BCE publica uma vez
   por dia útil, por volta das 16h de Frankfurt — não é cotação de mercado ao
   vivo, e a tela diz a data de cada uma para ninguém confundir as duas coisas.

   A tabela fica em localStorage, NÃO em `data`. Dois motivos: ela muda todo
   dia e faria a sincronização escrever na nuvem por causa de um dado público
   que qualquer aparelho busca sozinho; e não é informação do usuário — perder
   a tabela custa uma ida à rede, não custa um dado dele. */
const CAMBIO_CHAVE='aoii-cambio';
const CAMBIO_FONTE='https://api.frankfurter.dev/v1/latest';
const CAMBIO_VALIDADE_MS=6*60*60*1000;

function cambioGuardado(){
  try{
    const bruto=localStorage.getItem(CAMBIO_CHAVE);
    if(!bruto) return null;
    const t=JSON.parse(bruto);
    return tabelaDeCambioValida(t)?t:null;
  }catch(e){ return null; }
}

function guardarCambio(tabela){
  if(!tabelaDeCambioValida(tabela)) return false;
  try{ localStorage.setItem(CAMBIO_CHAVE,JSON.stringify(tabela)); return true; }
  catch(e){ return false; }
}

function cambioEstaVelho(tabela,agora){
  if(!tabela||typeof tabela.buscadoEm!=='number') return true;
  return (agora||Date.now())-tabela.buscadoEm>CAMBIO_VALIDADE_MS;
}

async function buscarCambio(base){
  const moeda=/^[A-Z]{3}$/.test(String(base||''))?base:'BRL';
  const res=await fetch(CAMBIO_FONTE+'?base='+encodeURIComponent(moeda));
  if(!res.ok) throw new Error('http '+res.status);
  const corpo=await res.json();
  const tabela={base:corpo.base,data:corpo.date,taxas:corpo.rates,buscadoEm:Date.now()};
  if(!tabelaDeCambioValida(tabela)) throw new Error('resposta fora do formato');
  return tabela;
}
