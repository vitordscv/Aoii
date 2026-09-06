
/* ═══════════════════════════════════════════════════════════════════
   AVALIAÇÕES PEDIDAS (ainda NÃO implementadas — só análise):

   1) CRIPTOGRAFIA CLIENT-SIDE ANTES DO SYNC (Supabase)
      Viável e recomendado usando só APIs nativas (Web Crypto):
      - Derivar a chave da senha do usuário com PBKDF2
        → crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},…)
      - Cifrar JSON.stringify(data) com AES-GCM (IV aleatório por gravação)
        e salvar {salt, iv, ciphertext} em base64 no campo `data` do Supabase.
      - supabaseSet cifraria antes do POST; supabaseGet decifraria após o GET.
        A senha nunca sai do aparelho; sem ela o servidor só vê bytes opacos.
      Cuidados: senha esquecida = dados irrecuperáveis (manter o export
      local em claro como backup); pedir a senha 1x por sessão e guardar a
      CryptoKey só em memória; o polling de 20s passa a decifrar a cada
      comparação (barato). Nenhuma dependência externa é necessária.

   2) PESO DO ARQUIVO — ✅ OTIMIZADO (de ~4,9 MB para ~0,86 MB)
      Aplicado: ícones PWA reexportados (favicon 192px, apple 180px,
      manifest com 192/512 reais, todos otimizados) e a máscara SVG do
      padrão de fundo definida uma única vez via var(--pattern-mask).
      Análise original (mantida como referência):
      As fontes NÃO estão embutidas (vêm do Google Fonts). O peso real é:
      - linha 9: manifest em base64 com ícones PNG (~2,4 MB!)
      - linhas 4 e 8: favicon/apple-touch-icon PNG 800×800 (~0,9 MB cada)
      - linhas 182–183: máscara SVG do padrão de fundo (~0,25 MB)
      Sugestões sem mudar a aparência:
      a) Reexportar os ícones em 192px/512px comprimidos (tinypng/squoosh):
         cada um cai pra ~15–40 KB → o HTML fica com menos de 500 KB.
      b) Servir manifest.webmanifest + ícones como arquivos separados no
         mesmo host (o app continua instalável e o HTML perde ~4 MB).
      c) Minificar a máscara SVG (svgo) ou trocá-la por um pattern SVG
         inline de poucos KB com o mesmo visual.
   ═══════════════════════════════════════════════════════════════════ */

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

