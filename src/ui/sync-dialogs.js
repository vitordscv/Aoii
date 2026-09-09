/* Diálogos exclusivos da sincronização: senha e escolha de conflito. */
function pedirSenhaSync(opcoes){
  opcoes=opcoes||{};
  return new Promise(resolve=>{
    const bd=document.getElementById('senha-backdrop');
    const dg=document.getElementById('senha-dialog');
    const campo=document.getElementById('senha-input');
    const campo2=document.getElementById('senha-input-2');
    const linha2=document.getElementById('senha-linha-2');
    const erroEl=document.getElementById('senha-erro');
    const olho=document.getElementById('senha-olho');
    const okBtn=document.getElementById('senha-ok');
    const cancelBtn=document.getElementById('senha-cancelar');
    if(!bd||!dg||!campo){ resolve(null); return; }

    document.getElementById('senha-titulo').textContent=opcoes.titulo||L('senha.titulo');
    document.getElementById('senha-texto').textContent=opcoes.texto||'';
    campo.value=''; campo2.value=''; erroEl.textContent='';
    campo.setAttribute('aria-invalid','false'); campo2.setAttribute('aria-invalid','false');
    campo.setAttribute('aria-label',L('senha.campo'));
    campo2.setAttribute('aria-label',L('senha.repita'));
    olho.setAttribute('aria-label',L('senha.mostrar'));
    campo.type='password'; campo2.type='password';
    olho.setAttribute('aria-pressed','false');
    linha2.style.display=opcoes.confirmar?'flex':'none';
    campo.setAttribute('autocomplete',opcoes.confirmar?'new-password':'current-password');
    okBtn.textContent=opcoes.okLabel||L('btn.confirmar');
    bd.style.display='block'; dg.style.display='block';
    const restaurar=ativarDialogo(dg,bd,campo,cancelar);

    function fechar(v){
      bd.style.display='none'; dg.style.display='none';
      okBtn.removeEventListener('click',confirmar);
      cancelBtn.removeEventListener('click',cancelar);
      bd.removeEventListener('click',cancelar);
      olho.removeEventListener('click',alternar);
      dg.removeEventListener('keydown',tecla);
      campo.value=''; campo2.value='';
      restaurar();
      resolve(v);
    }
    function alternar(){
      const mostrando=campo.type==='text';
      campo.type=campo2.type=mostrando?'password':'text';
      olho.setAttribute('aria-pressed',mostrando?'false':'true');
      olho.setAttribute('aria-label',L(mostrando?'senha.mostrar':'senha.ocultar'));
    }
    function confirmar(){
      const s=campo.value;
      campo.setAttribute('aria-invalid','false'); campo2.setAttribute('aria-invalid','false');
      if(s.length<8){ erroEl.textContent=L('senha.curta'); campo.setAttribute('aria-invalid','true'); campo.focus(); return; }
      if(opcoes.confirmar&&s!==campo2.value){ erroEl.textContent=L('senha.naoBate'); campo2.setAttribute('aria-invalid','true'); campo2.focus(); return; }
      fechar(s);
    }
    function cancelar(){ fechar(null); }
    function tecla(e){
      if(e.key==='Enter'&&(e.target===campo||e.target===campo2)){ e.preventDefault(); confirmar(); }
    }
    okBtn.addEventListener('click',confirmar);
    cancelBtn.addEventListener('click',cancelar);
    bd.addEventListener('click',cancelar);
    olho.addEventListener('click',alternar);
    dg.addEventListener('keydown',tecla);
  });
}

function mostrarConflitoSync(daNuvem){
  return new Promise(resolve=>{
    const bd=document.getElementById('conflito-backdrop');
    const dg=document.getElementById('conflito-dialog');
    if(!bd||!dg){ resolve(null); return; }

    const resumo=(rotulo,d)=>{
      const t=(d&&d.transacoes||[]).length;
      const saldo=(d&&d.saldoAtual||0)+(d&&d.dinheiroVivo||0);
      const el=document.createElement('div');
      el.className='conflito-lado';
      const h=document.createElement('h4'); h.textContent=rotulo; el.appendChild(h);
      const dl=document.createElement('dl');
      const linha=(k,v,classe)=>{
        const d1=document.createElement('div');
        d1.textContent=k+': ';
        const s=document.createElement('span');
        if(classe) s.className=classe;
        s.textContent=v; d1.appendChild(s); dl.appendChild(d1);
      };
      linha(L('conflito.saldo'),formatBRL(saldo),'num');
      linha(L('conflito.lancamentos'),String(t));
      el.appendChild(dl);
      return el;
    };

    const lados=document.getElementById('conflito-lados');
    lados.innerHTML='';
    lados.appendChild(resumo(L('conflito.esteAparelho'),data));
    lados.appendChild(resumo(L('conflito.naNuvem'),daNuvem));

    const bExportar=document.getElementById('conflito-exportar');
    const bManter=document.getElementById('conflito-manter');
    const bUsar=document.getElementById('conflito-usar');
    const bDepois=document.getElementById('conflito-depois');
    bd.style.display='block'; dg.style.display='block';
    vibrate([10,40,10]);
    const restaurar=ativarDialogo(dg,bd,bDepois,depois);

    function fechar(v){
      bd.style.display='none'; dg.style.display='none';
      bExportar.removeEventListener('click',exportar);
      bManter.removeEventListener('click',manter);
      bUsar.removeEventListener('click',usar);
      bDepois.removeEventListener('click',depois);
      restaurar(); resolve(v);
    }
    function baixar(obj,nome){
      try{
        const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));
        const a=document.createElement('a'); a.href=url; a.download=nome;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      }catch(e){}
    }
    function exportar(){
      const dia=todayISO();
      baixar(data,'aoii-'+dia+'-este-aparelho.json');
      baixar(daNuvem,'aoii-'+dia+'-nuvem.json');
      setSaveStatus(L('st.doisBackups'));
    }
    function manter(){ fechar('local'); }
    function usar(){ fechar('nuvem'); }
    function depois(){ fechar(null); }
    bExportar.addEventListener('click',exportar);
    bManter.addEventListener('click',manter);
    bUsar.addEventListener('click',usar);
    bDepois.addEventListener('click',depois);
  });
}
