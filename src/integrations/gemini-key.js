
function getIaChave(){ try{ return localStorage.getItem('financas-ia-chave')||''; }catch(e){ return ''; } }
function setIaChave(v){ try{ localStorage.setItem('financas-ia-chave',v); }catch(e){} }
function iaAtiva(){ return data.iaAtiva===true && !!getIaChave(); }
