/* ─── conversão de moedas: a conta ───

   A tabela vem de fora com uma moeda-base e as cotações dela para as outras
   ({base:'BRL', taxas:{USD:0.195, …}}). Converter entre duas moedas que não
   são a base é uma divisão: BRL→USD→EUR não passa duas vezes pelo mercado,
   passa uma vez pela base.

   Estas funções não buscam nada e não guardam nada: recebem a tabela pronta.
   Assim dá pra testá-las sem rede, que é o único jeito de um teste de câmbio
   valer alguma coisa. */
function taxaEntre(de,para,tabela){
  if(!tabela||!tabela.taxas||!tabela.base) return null;
  const cotacao=m=>{
    if(m===tabela.base) return 1;
    const v=tabela.taxas[m];
    return (typeof v==='number'&&Number.isFinite(v)&&v>0)?v:null;
  };
  const a=cotacao(de), b=cotacao(para);
  if(a===null||b===null) return null;
  return b/a;
}

function converterMoeda(valor,de,para,tabela){
  const taxa=taxaEntre(de,para,tabela);
  if(taxa===null||typeof valor!=='number'||!Number.isFinite(valor)) return null;
  return valor*taxa;
}

/* Os códigos que a tabela cobre, em ordem alfabética e sem repetir a base. */
function moedasDaTabela(tabela){
  if(!tabela||!tabela.taxas||!tabela.base) return [];
  const vistos=new Set([tabela.base]);
  Object.keys(tabela.taxas).forEach(m=>{ if(typeof tabela.taxas[m]==='number'&&tabela.taxas[m]>0) vistos.add(m); });
  return [...vistos].sort();
}

/* Uma tabela vinda de fora só é aceita se der pra confiar nela: base, data e
   pelo menos uma cotação positiva. Sem isso a tela mostraria "—" para tudo
   sem dizer por quê. */
function tabelaDeCambioValida(t){
  if(!t||typeof t!=='object') return false;
  if(typeof t.base!=='string'||!/^[A-Z]{3}$/.test(t.base)) return false;
  if(typeof t.data!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(t.data)) return false;
  if(!t.taxas||typeof t.taxas!=='object') return false;
  return Object.keys(t.taxas).some(m=>/^[A-Z]{3}$/.test(m)&&typeof t.taxas[m]==='number'&&t.taxas[m]>0);
}
