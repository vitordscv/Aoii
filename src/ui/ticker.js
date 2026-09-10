/* ── faixa de cotações (TradingView) ──

   Por que um iframe pro domínio deles, e não o <script> na nossa página.

   O caminho óbvio era colar o <script type="module"> no index.html. Isso põe
   código de terceiro dentro da mesma página onde vivem as finanças em texto
   puro no localStorage e a chave do Gemini. Não é desconfiança de ninguém: é
   que a página deixaria de ser só do dono dela, e o custo de evitar isso é
   pequeno.

   Tentei antes um iframe local com `sandbox="allow-scripts"`. Isolava de
   verdade — origem opaca, `localStorage` respondendo SecurityError —, mas o
   widget registra o elemento e não desenha nada, porque ele precisa de
   armazenamento e a origem opaca nega. Isolamento que quebra o recurso não é
   isolamento, é recurso removido.

   A saída é usar a página que a própria TradingView publica em
   s.tradingview.com. Sendo outra origem, a regra de mesma origem do navegador
   já impede que ela alcance o nosso localStorage ou o nosso DOM — sem sandbox
   opaco, e com o armazenamento dela funcionando normalmente. O `sandbox` que
   fica é só endurecimento: sem formulários e sem navegar a página de cima.

   O endereço é montado aqui, e não escrito no HTML, por dois motivos: a faixa
   segue o tema do app (clara ou escura) e o idioma escolhido. */

const TICKER_LOCALES = { pt: 'br', en: 'en', es: 'es', fr: 'fr', it: 'it' };

/* Claro ou escuro? Lido de --cream, o fundo declarado pelo tema, em vez de
   uma lista de nomes — assim o tema personalizado também acerta. A variável
   vale assim que o atributo data-theme é posto; o fundo pintado do body só
   vale depois, e essa diferença já deixou a faixa clara num tema escuro. */
function faixaPrefereEscuro(){
  try{
    const cor=getComputedStyle(document.documentElement).getPropertyValue('--cream').trim();
    let r,g,b;
    const hex=/^#([0-9a-f]{6})$/i.exec(cor);
    if(hex){
      r=parseInt(hex[1].slice(0,2),16); g=parseInt(hex[1].slice(2,4),16); b=parseInt(hex[1].slice(4,6),16);
    }else{
      const m=/rgba?\(([^)]+)\)/.exec(cor);
      if(!m) return false;
      [r,g,b]=m[1].split(',').map(n=>parseFloat(n));
    }
    /* luminância aproximada, a mesma conta da auditoria de contraste */
    return (0.2126*r+0.7152*g+0.0722*b)/255 < 0.5;
  }catch(e){ return false; }
}

/* O endereço da nossa página, com o que ela precisa saber: os símbolos, o
   tema (pra fita não nascer clara dentro do tema escuro) e o idioma (só pro
   aviso de "sem internet"). */
function enderecoDaFaixa(simbolos){
  const p=new URLSearchParams({
    simbolos:simbolos,
    tema:faixaPrefereEscuro()?'dark':'light',
    lang:(data&&data.idioma)||'pt',
  });
  return 'ticker.html?'+p.toString();
}

/* Chamada a cada render. Só mexe no iframe quando o endereço muda de verdade —
   reatribuir o src a cada salvamento recarregaria o widget sem parar. */
function prepararFaixaCotacoes(){
  const f=document.getElementById('ticker-tape');
  if(!f) return;
  const simbolos=f.getAttribute('data-simbolos');
  if(!simbolos) return;
  const url=enderecoDaFaixa(simbolos);
  if(f.getAttribute('data-url')===url) return;
  f.setAttribute('data-url',url);
  /* Já visível: troca na hora. Ainda escondido: fica em data-src e quem
     promove é a troca de visão — quem nunca abre Investimentos nunca pede
     nada à TradingView. */
  if(f.getAttribute('src')) f.src=url;
  else f.setAttribute('data-src',url);
}
