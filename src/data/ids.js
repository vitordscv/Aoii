/* Identificadores opacos para itens locais e para ids substituídos na validação.
   Web Crypto é preferida; o último degrau preserva o uso offline em navegadores
   antigos sem fingir que o valor tem finalidade de segurança. */
function uid(){
  try{
    if(typeof crypto!=='undefined'&&crypto.randomUUID) return 'id-'+crypto.randomUUID();
    if(typeof crypto!=='undefined'&&crypto.getRandomValues){
      const b=new Uint8Array(16);
      crypto.getRandomValues(b);
      return 'id-'+Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
    }
  }catch(e){ /* segue para o identificador local monotônico */ }
  uid._n=(uid._n||0)+1;
  return 'id-'+Date.now().toString(36)+'-'+uid._n.toString(36);
}
