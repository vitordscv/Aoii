const bgArtCache={};
function applyBgArt(tema, ativo){
  if(!ativo) return;
  const root=document.documentElement.style;
  ['bg','bg-m'].forEach(suf=>{
    const key=tema+'-'+suf, prop='--'+key;
    if(root.getPropertyValue(prop)) return; // já injetado
    if(!bgArtCache[key]){
      const el=document.getElementById('bg-art-data');
      if(!el) return;
      if(!bgArtCache.__map) bgArtCache.__map=JSON.parse(el.textContent);
      const uri=bgArtCache.__map[key];
      if(!uri) return;
      bgArtCache[key]=uri;
    }
    root.setProperty(prop, `url("${bgArtCache[key]}")`);
  });
}
