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

/* Claro ou escuro? Lido do fundo que o tema realmente pinta, em vez de uma
   lista de nomes de tema — assim o tema personalizado também acerta. */
function faixaPrefereEscuro(){
  try{
    const cor=getComputedStyle(document.body).backgroundColor||'';
    const m=/rgba?\(([^)]+)\)/.exec(cor);
    if(!m) return false;
    const [r,g,b]=m[1].split(',').map(n=>parseFloat(n));
    /* luminância aproximada, na mesma conta que a auditoria de contraste usa */
    return (0.2126*r+0.7152*g+0.0722*b)/255 < 0.5;
  }catch(e){ return false; }
}

function enderecoDaFaixa(simbolos){
  const config={
    symbols:simbolos.split(',').map(s=>s.trim()).filter(Boolean)
      .map(s=>({proName:s,title:s.split(':').pop().replace(/[0-9]!$/,'')})),
    showSymbolLogo:true,
    isTransparent:true,
    displayMode:'adaptive',
    colorTheme:faixaPrefereEscuro()?'dark':'light',
    locale:TICKER_LOCALES[data&&data.idioma]||'br',
  };
  return 'https://s.tradingview.com/embed-widget/ticker-tape/?locale='+
    encodeURIComponent(config.locale)+'#'+encodeURIComponent(JSON.stringify(config));
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
