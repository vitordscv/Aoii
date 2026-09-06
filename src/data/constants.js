/* Nomes de mês, dias da semana e a chave do localStorage.
   Vale para todos os idiomas: applyIdiomaMonths() troca o conteúdo destes
   arrays no lugar, então quem já guardou uma referência continua válido. */

const MONTH_NAMES  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_ABBR   = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const WEEKDAY_ABBR = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MONTH_NAMES_I18N={
  pt:['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
  en:['January','February','March','April','May','June','July','August','September','October','November','December'],
  es:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  fr:['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  it:['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],
};
const MONTH_ABBR_I18N={
  pt:['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'],
  en:['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'],
  es:['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'],
  fr:['JAN','FÉV','MAR','AVR','MAI','JUIN','JUIL','AOÛ','SEP','OCT','NOV','DÉC'],
  it:['GEN','FEB','MAR','APR','MAG','GIU','LUG','AGO','SET','OTT','NOV','DIC'],
};
const WEEKDAY_ABBR_I18N={
  pt:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'],
  en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
  es:['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
  fr:['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'],
  it:['Dom','Lun','Mar','Mer','Gio','Ven','Sab'],
};
const STORAGE_KEY  = 'financas-data';

