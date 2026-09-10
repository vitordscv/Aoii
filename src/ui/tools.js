/* ─── ferramentas do topo: calculadora e conversor de moedas ───

   Duas coisas que se usam NO MEIO de outra: você está lançando um gasto e
   precisa dividir por três, ou olhando um preço em euro. Por isso ficam no
   topo e abrem por cima, sem trocar de aba e sem perder o que estava na tela.

   Nenhuma das duas escreve em `data`. A calculadora não guarda nada; o
   conversor guarda a tabela de cotações e o último par de moedas em
   localStorage, que é onde mora o que é deste aparelho e não é do usuário. */

function separadorDecimal(){
  try{
    const partes=new Intl.NumberFormat(localeAtual()).formatToParts(1.1);
    const d=partes.find(p=>p.type==='decimal');
    return d?d.value:',';
  }catch(e){ return ','; }
}

/* ═══ calculadora ═══ */
let _abrirCalcSheet=null;
function abrirCalculadora(){ if(_abrirCalcSheet) _abrirCalcSheet(); }

function setupCalculadoraSheet(){
  const backdrop=document.getElementById('calc-sheet-backdrop');
  const sheet=document.getElementById('calc-sheet');
  const exprEl=document.getElementById('calcz-expr');
  const resEl=document.getElementById('calcz-resultado');
  const teclas=document.getElementById('calcz-teclas');
  if(!backdrop||!sheet||!exprEl||!resEl||!teclas) return;

  let expr='';
  let sep=separadorDecimal();

  function desenhar(){
    exprEl.textContent=expr;
    if(!expr){ resEl.textContent='0'; resEl.classList.remove('erro'); return; }
    const v=avaliarExpressao(expr,sep);
    if(Number.isNaN(v)){ resEl.textContent=L('tools.calcIncompleta'); resEl.classList.add('erro'); return; }
    resEl.classList.remove('erro');
    resEl.textContent=v.toLocaleString(localeAtual(),{maximumFractionDigits:8});
  }

  /* Um parêntese só: a tecla abre enquanto houver o que abrir e fecha quando
     há aberto esperando. Duas teclas para isso gastariam metade de uma linha
     do teclado por uma escolha que o próprio texto já denuncia. */
  function parenteseCerto(){
    let abertos=0;
    for(const c of expr){ if(c==='(') abertos++; else if(c===')') abertos--; }
    const ultimo=expr.slice(-1);
    const podeFechar=abertos>0&&ultimo!=='('&&ultimo!==''&&!'+−×÷'.includes(ultimo);
    return podeFechar?')':'(';
  }

  function digitar(tecla){
    if(tecla==='limpar'){ expr=''; return desenhar(); }
    if(tecla==='apagar'){ expr=expr.slice(0,-1); return desenhar(); }
    if(tecla==='igual'){
      const v=avaliarExpressao(expr,sep);
      if(Number.isNaN(v)) return desenhar();
      /* o resultado vira a expressão, para encadear outra conta em cima dele */
      expr=String(v).replace('.',sep);
      return desenhar();
    }
    if(tecla==='paren'){ expr+=parenteseCerto(); return desenhar(); }
    if(tecla==='sep'){
      const ultimo=expr.slice(-1);
      /* separador depois de operador (ou no vazio) precisa do zero na frente:
         ",5" não é número em lugar nenhum */
      if(expr===''||'+−×÷('.includes(ultimo)) expr+='0'+sep;
      else if(calcAceita(expr,sep,sep)) expr+=sep;
      return desenhar();
    }
    if(!calcAceita(expr,tecla,sep)) return;
    expr+=tecla;
    desenhar();
  }

  teclas.addEventListener('click',e=>{
    const btn=e.target.closest('[data-tecla]');
    if(!btn) return;
    vibrate(8);
    digitar(btn.getAttribute('data-tecla'));
  });

  /* teclado físico, enquanto o painel estiver aberto */
  /* Escape não está aqui de propósito: em todo painel do app ele fecha, e uma
     calculadora que rouba o Escape para limpar ensinaria uma exceção. Limpar
     é o C — e o C também é uma tecla do teclado. */
  const DO_TECLADO={'/':'÷','*':'×','-':'−','x':'×',',':'sep','.':'sep',
    'Enter':'igual','=':'igual','Backspace':'apagar','c':'limpar','C':'limpar'};
  function noTeclado(e){
    if(sheet.style.display==='none') return;
    /* Enter num botão em foco é o botão, não o "=". Quem está no "Copiar
       resultado" e aperta Enter quer copiar. */
    const emBotao=document.activeElement&&document.activeElement.tagName==='BUTTON'
      &&sheet.contains(document.activeElement)&&!document.activeElement.hasAttribute('data-tecla');
    if(e.key>='0'&&e.key<='9'){ e.preventDefault(); return digitar(e.key); }
    if(e.key==='+'||e.key==='%'||e.key==='('||e.key===')'){ e.preventDefault(); return digitar(e.key==='('||e.key===')'?'paren':e.key); }
    if((e.key==='Enter'||e.key===' ')&&emBotao) return;
    const t=DO_TECLADO[e.key];
    if(!t) return;
    e.preventDefault();
    digitar(t);
  }
  document.addEventListener('keydown',noTeclado);

  document.getElementById('calcz-copiar')?.addEventListener('click',async()=>{
    const texto=resEl.textContent||'';
    if(!texto||resEl.classList.contains('erro')) return;
    try{ await navigator.clipboard.writeText(texto); setSaveStatus(L('tools.copiado')); }
    catch(e){ /* sem permissão de área de transferência: não há o que fazer */ }
  });

  function open(){
    sep=separadorDecimal();
    const teclaSep=document.getElementById('calcz-tecla-sep');
    if(teclaSep) teclaSep.textContent=sep;
    desenhar();
    backdrop.classList.remove('closing'); sheet.classList.remove('closing');
    backdrop.style.display='block'; sheet.style.display='block';
    ativarSheet(sheet,backdrop,document.getElementById('calcz-copiar'),close);
  }
  function close(){ closeSheetWithAnim(sheet,backdrop); }
  attachSheetDragToClose(sheet,backdrop,sheet.querySelector('.sheet-handle'));
  _abrirCalcSheet=open;

  document.getElementById('topbar-calc-btn')?.addEventListener('click',()=>{ vibrate(10); open(); });
  document.getElementById('calc-sheet-cancel')?.addEventListener('click',close);
  backdrop.addEventListener('click',close);
}

/* ═══ conversor de moedas ═══ */
/* Enquanto não houver tabela, o seletor precisa mostrar alguma coisa. São as
   quatro moedas que o app já conhece — a lista real vem da tabela. */
const FX_MOEDAS_INICIAIS=['BRL','EUR','GBP','USD'];
/* O par de sempre. O conversor abre nele todas as vezes, e não no último par
   usado: lembrar parecia gentileza, mas quem converteu ienes uma vez achava
   ienes na abertura seguinte sem entender por quê. Trocar são dois toques. */
const FX_PADRAO_DE='USD', FX_PADRAO_PARA='BRL';

function formatarNaMoeda(valor,codigo){
  try{ return valor.toLocaleString(localeAtual(),{style:'currency',currency:codigo}); }
  catch(e){ return valor.toLocaleString(localeAtual(),{minimumFractionDigits:2,maximumFractionDigits:2})+' '+codigo; }
}

let _abrirFxSheet=null;
function abrirConversorMoedas(){ if(_abrirFxSheet) _abrirFxSheet(); }

function setupConversorSheet(){
  const backdrop=document.getElementById('fx-sheet-backdrop');
  const sheet=document.getElementById('fx-sheet');
  const valorEl=document.getElementById('fx-valor');
  const deEl=document.getElementById('fx-de');
  const paraEl=document.getElementById('fx-para');
  const resEl=document.getElementById('fx-resultado');
  const notaEl=document.getElementById('fx-nota');
  const atualizarBtn=document.getElementById('fx-atualizar');
  const copiarBtn=document.getElementById('fx-copiar');
  if(!backdrop||!sheet||!deEl||!paraEl||!resEl) return;

  let tabela=null;
  let buscando=false;

  function encherSeletores(){
    const moedas=tabela?moedasDaTabela(tabela):FX_MOEDAS_INICIAIS;
    for(const el of [deEl,paraEl]){
      const escolhido=el.value;
      el.textContent='';
      moedas.forEach(m=>{
        const op=document.createElement('option');
        op.value=m; op.textContent=m;
        el.appendChild(op);
      });
      if(moedas.includes(escolhido)) el.value=escolhido;
    }
  }

  function nota(chave,extra){
    let texto=L(chave);
    if(extra) for(const [k,v] of Object.entries(extra)) texto=texto.replace('{'+k+'}',v);
    notaEl.textContent=texto;
  }

  /* o número sozinho, sem símbolo: quem copia uma conversão está quase sempre
     indo colar num campo de valor — inclusive aqui dentro, num lançamento.
     "US$ 48,79" não entra num campo de número; "48,79" entra. */
  let paraCopiar='';

  function calcular(){
    const de=deEl.value, para=paraEl.value;
    const valor=parseNum(valorEl.value);
    paraCopiar='';
    if(copiarBtn) copiarBtn.disabled=true;
    if(de===para){ resEl.textContent='—'; nota('tools.fxIgual'); return; }
    const convertido=converterMoeda(Number.isFinite(valor)?valor:0,de,para,tabela);
    if(convertido===null){ resEl.textContent='—'; return; }
    resEl.textContent=formatarNaMoeda(convertido,para);
    paraCopiar=convertido.toLocaleString(localeAtual(),{minimumFractionDigits:2,maximumFractionDigits:2});
    if(copiarBtn) copiarBtn.disabled=false;
    const taxa=taxaEntre(de,para,tabela);
    nota('tools.fxCotacao',{de,para,
      taxa:taxa.toLocaleString(localeAtual(),{minimumFractionDigits:2,maximumFractionDigits:6}),
      data:new Date(tabela.data+'T12:00:00').toLocaleDateString(localeAtual())});
  }

  async function atualizar(silencioso){
    if(buscando) return;
    buscando=true;
    if(!silencioso) nota('tools.fxBuscando');
    try{
      const nova=await buscarCambio('BRL');
      guardarCambio(nova);
      tabela=nova;
      encherSeletores();
      calcular();
    }catch(e){
      /* sem rede: a tabela guardada continua respondendo, e a nota passa a
         dizer de quando ela é em vez de fingir que é de agora */
      if(tabela){ calcular(); nota('tools.fxGuardadas',{data:new Date(tabela.data+'T12:00:00').toLocaleDateString(localeAtual())}); }
      else nota('tools.fxErro');
    }finally{ buscando=false; }
  }

  [valorEl,deEl,paraEl].forEach(el=>{
    if(!el) return;
    el.addEventListener('input',calcular);
    el.addEventListener('change',calcular);
  });
  document.getElementById('fx-trocar')?.addEventListener('click',()=>{
    const a=deEl.value; deEl.value=paraEl.value; paraEl.value=a;
    vibrate(8); calcular();
  });
  atualizarBtn?.addEventListener('click',()=>{ vibrate(10); atualizar(false); });
  copiarBtn?.addEventListener('click',async()=>{
    if(!paraCopiar) return;
    try{ await navigator.clipboard.writeText(paraCopiar); setSaveStatus(L('tools.copiado')); }
    catch(e){ /* sem permissão de área de transferência: não há o que fazer */ }
  });

  function open(){
    /* limpeza da chave que a versão anterior gravava; some sozinha na primeira
       abertura e esta linha pode sair daqui a algumas versões */
    try{ localStorage.removeItem('aoii-cambio-par'); }catch(e){}
    tabela=cambioGuardado();
    encherSeletores();
    const moedas=tabela?moedasDaTabela(tabela):FX_MOEDAS_INICIAIS;
    if(moedas.includes(FX_PADRAO_DE)) deEl.value=FX_PADRAO_DE;
    if(moedas.includes(FX_PADRAO_PARA)) paraEl.value=FX_PADRAO_PARA;
    if(tabela){
      calcular();
      /* tabela do dia anterior ainda serve para responder na hora; a busca
         acontece atrás, e a tela se corrige sozinha quando ela chega */
      if(cambioEstaVelho(tabela)) atualizar(true);
    }else{
      resEl.textContent='—';
      if(copiarBtn) copiarBtn.disabled=true;
      atualizar(false);
    }
    backdrop.classList.remove('closing'); sheet.classList.remove('closing');
    backdrop.style.display='block'; sheet.style.display='block';
    ativarSheet(sheet,backdrop,valorEl,close);
  }
  function close(){ closeSheetWithAnim(sheet,backdrop); }
  attachSheetDragToClose(sheet,backdrop,sheet.querySelector('.sheet-handle'));
  _abrirFxSheet=open;

  document.getElementById('topbar-fx-btn')?.addEventListener('click',()=>{ vibrate(10); open(); });
  document.getElementById('fx-sheet-cancel')?.addEventListener('click',close);
  backdrop.addEventListener('click',close);
}
