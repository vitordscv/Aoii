/* ─── calculadora: avaliar a expressão digitada ───

   Não existe eval() aqui, e não é preguiça de escrever o parser: eval() num
   app que guarda dinheiro é uma porta que não se abre "só desta vez". A
   gramática cabe em vinte linhas.

     expressão := termo (('+'|'−') termo)*
     termo     := unário (('×'|'÷') unário)*
     unário    := '−' unário | primário
     primário  := '(' expressão ')' | número, seguido de zero ou mais '%'

   O '%' é sufixo e significa "dividido por cem". É a leitura que não tem
   ambiguidade: 250 × 10% dá 25, que é o que se quer perguntar numa conta de
   dinheiro. A outra convenção (50 + 10% = 55) depende do operador anterior e
   surpreende metade das pessoas.

   Devolve NaN para qualquer entrada que não feche — expressão incompleta,
   parêntese solto, divisão por zero. Quem chama decide o que mostrar. */
function avaliarExpressao(texto,separador){
  const sep=separador||',';
  const s=String(texto==null?'':texto);
  let i=0;

  const pular=()=>{ while(i<s.length&&s[i]===' ') i++; };
  const espiar=()=>{ pular(); return s[i]; };
  const digito=c=>c>='0'&&c<='9';

  function primario(){
    pular();
    let v;
    if(s[i]==='('){
      i++;
      v=expressao();
      pular();
      if(s[i]!==')') return NaN;
      i++;
    }else{
      const ini=i;
      while(i<s.length&&digito(s[i])) i++;
      if(s[i]===sep||s[i]==='.'){ i++; while(i<s.length&&digito(s[i])) i++; }
      if(i===ini) return NaN;
      v=parseFloat(s.slice(ini,i).replace(sep,'.'));
    }
    while(espiar()==='%'){ i++; v=v/100; }
    return v;
  }
  function unario(){
    pular();
    if(s[i]==='−'||s[i]==='-'){ i++; const v=unario(); return Number.isNaN(v)?NaN:-v; }
    return primario();
  }
  function termo(){
    let v=unario();
    for(;;){
      const op=espiar();
      if(op!=='×'&&op!=='*'&&op!=='÷'&&op!=='/') return v;
      i++;
      const d=unario();
      if(Number.isNaN(v)||Number.isNaN(d)) return NaN;
      v=(op==='×'||op==='*')?v*d:v/d;
    }
  }
  function expressao(){
    let v=termo();
    for(;;){
      const op=espiar();
      if(op!=='+'&&op!=='−'&&op!=='-') return v;
      i++;
      const d=termo();
      if(Number.isNaN(v)||Number.isNaN(d)) return NaN;
      v=op==='+'?v+d:v-d;
    }
  }

  const r=expressao();
  pular();
  if(i!==s.length) return NaN;          // sobrou coisa: a expressão não fecha
  return Number.isFinite(r)?r:NaN;      // divisão por zero cai aqui
}

/* O que pode ser digitado a seguir. Serve pra impedir "5 ++ 3" e "5 ,, 2"
   antes de virarem uma expressão que só falha no igual. */
function calcAceita(atual,tecla,separador){
  const sep=separador||',';
  const s=String(atual||'');
  const ultimo=s.slice(-1);
  const operadores='+−×÷';
  if(operadores.includes(tecla)) return s!==''&&!operadores.includes(ultimo)&&ultimo!=='(';
  if(tecla===sep) {
    /* um separador por número: olha pra trás até achar operador ou parêntese */
    let k=s.length-1;
    while(k>=0&&!operadores.includes(s[k])&&s[k]!=='('&&s[k]!==')') { if(s[k]===sep) return false; k--; }
    return true;
  }
  if(tecla==='%') return s!==''&&(ultimo===')'||ultimo===sep||(ultimo>='0'&&ultimo<='9'));
  return true;
}
