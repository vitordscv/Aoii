/* ═══════════════════════════════════════════════════════════════════════════
   A forma do objeto `data`, declarada.

   Serve a validação (data/validation.js): campo que não está aqui é descartado
   ao entrar, venha de arquivo, de código de backup ou da nuvem. Ampliar o app
   passa por ampliar este arquivo — é de propósito.

   Campo novo? Declare aqui, dê o padrão em defaultData() e a normalização em
   migrateData(), e descreva em docs/DATA-MODEL.md.
   ═══════════════════════════════════════════════════════════════════════════ */

const SCHEMA_VERSAO = 1;

/* Limites. Não são estimativas do que o usuário faz: são o teto acima do qual
   o dado deixa de ser plausível e passa a ser tentativa de travar o app. */
const LIMITES = {
  bytes: 5 * 1024 * 1024,   // JSON inteiro
  itens: 20000,             // por lista
  profundidade: 12,         // aninhamento
  dinheiro: 1e11,           // |valor| máximo
  nome: 200,
  nota: 2000,
  categoria: 60,
  tag: 60,
  texto: 500,               // qualquer outro texto livre
};

/* ── tipos de campo ──
   'dinheiro'   número finito, aceita "1.234,56"
   'inteiro'    inteiro com min/max
   'texto'      string aparada, com teto de tamanho
   'booleano'
   'iso'        data-hora ISO ('2026-09-06T10:00:00.000Z')
   'dia'        YYYY-MM-DD
   'opcao'      um valor de uma lista fechada
   'url'        link http/https; qualquer outro esquema não sobrevive
   'id'         só sobrevive se couber em [A-Za-z0-9:_-]{1,64}; senão, novo
   'ref'        aponta pro id de outra lista; segue a troca, se houver
   'lista'      array de objetos, com `item`
   'listaTexto' array de strings
   'listaInteiro'
   'mapaDinheiro' objeto {chave de texto: número}                             */

const ITEM_GASTO_FIXO = {
  id: { tipo: 'id' },
  nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  valor: { tipo: 'dinheiro', padrao: 0 },
  diaDoMes: { tipo: 'inteiro', min: 1, max: 31, padrao: 1 },
  categoria: { tipo: 'texto', max: LIMITES.categoria, padrao: 'Outros' },
  ativo: { tipo: 'booleano', padrao: true },
  inicioAno: { tipo: 'inteiro', min: 1900, max: 3000, nulo: true },
  inicioMes: { tipo: 'inteiro', min: 1, max: 12, nulo: true },
  criadoEm: { tipo: 'iso', nulo: true },
  /* meses já quitados, como 'AAAA-M'. Uma conta fixa se repete, então pago é
     por mês — ver docs/DATA-MODEL.md. */
  pagoEm: { tipo: 'listaTexto', max: 20 },
  /* cobrada no cartão: o dinheiro não sai da conta no dia, entra na fatura */
  cartao: { tipo: 'booleano', padrao: false },
  cartaoId: { tipo: 'ref', de: 'cartoes', nulo: true },
};

const ITEM_GASTO_FATURA = {
  id: { tipo: 'id' },
  nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  valor: { tipo: 'dinheiro', padrao: 0 },
  pago: { tipo: 'booleano', padrao: false },
  categoria: { tipo: 'texto', max: LIMITES.categoria, padrao: 'Outros' },
  parcelamentoId: { tipo: 'ref', de: 'parcelamento', nulo: true },
  dataCompra: { tipo: 'dia', nulo: true },
  /* Os mesmos três da transação avulsa. A folha "Novo gasto" sempre mostrou
     Viagem, Tags e Nota junto com o crédito, mas o parcelamento os descartava
     no caminho — e aí gasto de viagem no cartão não contava no orçamento da
     viagem, que é justamente como quase todo mundo paga em viagem. */
  viagemId: { tipo: 'ref', de: 'viagens', nulo: true },
  tags: { tipo: 'listaTexto', max: LIMITES.tag },
  nota: { tipo: 'texto', max: LIMITES.nota, nulo: true },
  /* de onde veio, quando veio de fora: e o id da transacao no Pierre. E o que
     faz a segunda sincronizacao reconhecer o que ja entrou em vez de lancar
     tudo de novo. Texto curto porque e identificador de outro sistema. */
  idExterno: { tipo: 'texto', max: 120, nulo: true },
};

const ITEM_FATURA = {
  id: { tipo: 'id' },
  ano: { tipo: 'inteiro', min: 1900, max: 3000, padrao: 2000 },
  mes: { tipo: 'inteiro', min: 1, max: 12, padrao: 1 },
  valor: { tipo: 'dinheiro', padrao: 0 },
  pago: { tipo: 'booleano', padrao: false },
  cartaoId: { tipo: 'ref', de: 'cartoes', nulo: true },
  gastos: { tipo: 'lista', item: ITEM_GASTO_FATURA },
};

const ITEM_TRANSACAO = {
  id: { tipo: 'id' },
  nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  valor: { tipo: 'dinheiro', padrao: 0 },
  categoria: { tipo: 'texto', max: LIMITES.categoria, padrao: 'Outros' },
  metodo: { tipo: 'opcao', valores: ['debito', 'dinheiro', 'pix', 'credito'], padrao: 'debito' },
  data: { tipo: 'dia', padrao: null },
  /* ausente = gasto; 'receita' = entrada. Ver docs/DATA-MODEL.md. */
  tipo: { tipo: 'opcao', valores: ['receita'], nulo: true },
  viagemId: { tipo: 'ref', de: 'viagens', nulo: true },
  tags: { tipo: 'listaTexto', max: LIMITES.tag },
  nota: { tipo: 'texto', max: LIMITES.nota, nulo: true },
};

const ITEM_ENTRADA_EXTRA = {
  id: { tipo: 'id' },
  nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  valor: { tipo: 'dinheiro', padrao: 0 },
  recebido: { tipo: 'dinheiro', min: 0, padrao: 0 },
  /* sem padrão de propósito: quem decide é migrateData(), que sabe ler o
     interruptor `aosPoucos` do formato antigo. Com padrão aqui, `modo` já
     chegaria valendo 'unica' e a migração nunca aconteceria. */
  modo: { tipo: 'opcao', valores: ['unica', 'aosPoucos', 'semPrevisao'], nulo: true },
  dataPrevista: { tipo: 'dia', nulo: true },
  feito: { tipo: 'booleano', padrao: false },
  feitoEm: { tipo: 'dia', nulo: true },
  nota: { tipo: 'texto', max: LIMITES.nota, padrao: '' },
  /* formato antigo: o interruptor que virou `modo`. migrateData() consome. */
  aosPoucos: { tipo: 'booleano', legado: true },
};

const ITEM_DIVIDA = {
  id: { tipo: 'id' },
  nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  /* pra quem se deve; separado do nome porque a pessoa é o que se lembra */
  credor: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  valor: { tipo: 'dinheiro', padrao: 0 },
  pago: { tipo: 'dinheiro', min: 0, padrao: 0 },
  /* 'unica' quita numa data; 'aosPoucos' espalha até a data; 'semPrevisao'
     é a dívida sem combinado — vale, mas fica fora da projeção. */
  modo: { tipo: 'opcao', valores: ['unica', 'aosPoucos', 'semPrevisao'], padrao: 'semPrevisao' },
  dataPrevista: { tipo: 'dia', nulo: true },
  quitado: { tipo: 'booleano', padrao: false },
  quitadoEm: { tipo: 'dia', nulo: true },
  nota: { tipo: 'texto', max: LIMITES.nota, padrao: '' },
};

const ITEM_COMPRA = {
  id: { tipo: 'id' },
  nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  valor: { tipo: 'dinheiro', padrao: 0 },
  dataPrevista: { tipo: 'dia', nulo: true },
  cartao: { tipo: 'booleano', padrao: false },
  parcelas: { tipo: 'inteiro', min: 1, max: 360, padrao: 1 },
  parcelasLancadas: { tipo: 'booleano', padrao: false },
  cartaoId: { tipo: 'ref', de: 'cartoes', nulo: true },
  feito: { tipo: 'booleano', padrao: false },
  feitoEm: { tipo: 'dia', nulo: true },
  /* o motivo da compra, em texto livre — opcional */
  nota: { tipo: 'texto', max: LIMITES.nota, padrao: '' },
  /* link do produto — opcional. Vira href na lista, daí o tipo 'url'. */
  link: { tipo: 'url', max: LIMITES.texto, nulo: true },
};

const ITEM_META = {
  id: { tipo: 'id' },
  nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  valorAlvo: { tipo: 'dinheiro', min: 0, padrao: 0 },
  valorGuardado: { tipo: 'dinheiro', min: 0, padrao: 0 },
  dataAlvo: { tipo: 'dia', nulo: true },
  aporteMensal: { tipo: 'dinheiro', min: 0, padrao: 0 },
  ultimoAporte: { tipo: 'texto', max: 20, nulo: true },   // 'AAAA-M'
};

const ITEM_CARTAO = {
  id: { tipo: 'id' },
  nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  /* o id da conta no Pierre, para a sincronizacao reencontrar ESTE cartao em
     vez de criar outro a cada vez. Cartao digitado a mao nao tem, e fica fora
     da sincronizacao de proposito. */
  idExterno: { tipo: 'texto', max: 60, nulo: true },
  limite: { tipo: 'dinheiro', min: 0, padrao: 0 },
  diaFechamento: { tipo: 'inteiro', min: 1, max: 31, nulo: true },
  diaVencimento: { tipo: 'inteiro', min: 1, max: 31, nulo: true },
};

const ITEM_RENDA = {
  id: { tipo: 'id' },
  tipo: { tipo: 'texto', max: LIMITES.categoria, padrao: 'outros' },
  nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  valor: { tipo: 'dinheiro', padrao: 0 },
  diaDoMes: { tipo: 'inteiro', min: 1, max: 31, padrao: 1 },
  ativo: { tipo: 'booleano', padrao: true },
  criadoEm: { tipo: 'iso', nulo: true },
};

const ITEM_DIVIDENDO = {
  id: { tipo: 'id' },
  data: { tipo: 'dia', padrao: null },
  valor: { tipo: 'dinheiro', padrao: 0 },
};

const ITEM_INVESTIMENTO = {
  id: { tipo: 'id' },
  tipo: { tipo: 'texto', max: LIMITES.categoria, padrao: 'cdi' },
  nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  descricao: { tipo: 'texto', max: LIMITES.texto, padrao: '' },
  valorInvestido: { tipo: 'dinheiro', min: 0, padrao: 0 },
  percentCdi: { tipo: 'dinheiro', min: 0, nulo: true },
  dividendos: { tipo: 'lista', item: ITEM_DIVIDENDO },
  criadoEm: { tipo: 'iso', nulo: true },
};

const ITEM_VIAGEM = {
  id: { tipo: 'id' },
  nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
  orcamento: { tipo: 'dinheiro', min: 0, padrao: 0 },
};

const ITEM_PATRIMONIO = {
  ano: { tipo: 'inteiro', min: 1900, max: 3000, padrao: 2000 },
  mes: { tipo: 'inteiro', min: 1, max: 12, padrao: 1 },
  valor: { tipo: 'dinheiro', padrao: 0 },
};

const ESQUEMA = {
  schemaVersion: { tipo: 'inteiro', min: 0, max: 999, padrao: 0 },

  /* dinheiro parado */
  saldoAtual: { tipo: 'dinheiro', padrao: 0 },
  saldoAtualizadoEm: { tipo: 'iso', nulo: true },
  dinheiroVivo: { tipo: 'dinheiro', padrao: 0 },
  dinheiroVivoAtualizadoEm: { tipo: 'iso', nulo: true },

  /* renda */
  tipoRenda: { tipo: 'opcao', valores: ['diaria', 'mensal'], padrao: 'diaria' },
  rendaDiaria: { tipo: 'dinheiro', min: 0, padrao: 0 },
  diasTrabalho: { tipo: 'listaInteiro', min: 0, max: 6 },
  diasNaoTrabalhados: { tipo: 'listaTexto', max: 10, formato: 'dia' },
  rendaMensal: {
    tipo: 'objeto',
    campos: {
      valor: { tipo: 'dinheiro', min: 0, padrao: 0 },
      diaDoMes: { tipo: 'inteiro', min: 1, max: 31, padrao: 5 },
    },
  },
  rendasRecorrentes: { tipo: 'lista', item: ITEM_RENDA },

  /* projeção */
  dataAlvo: { tipo: 'dia', nulo: true },
  patrimonioHistorico: { tipo: 'lista', item: ITEM_PATRIMONIO },

  /* listas do dia a dia */
  gastosMensais: { tipo: 'lista', item: ITEM_GASTO_FIXO },
  faturas: { tipo: 'lista', item: ITEM_FATURA },
  transacoes: { tipo: 'lista', item: ITEM_TRANSACAO },
  entradasExtras: { tipo: 'lista', item: ITEM_ENTRADA_EXTRA },
  comprasPlanejadas: { tipo: 'lista', item: ITEM_COMPRA },
  dividas: { tipo: 'lista', item: ITEM_DIVIDA },
  metas: { tipo: 'lista', item: ITEM_META },
  cartoes: { tipo: 'lista', item: ITEM_CARTAO, idNamespace: 'cartoes' },
  investimentos: { tipo: 'lista', item: ITEM_INVESTIMENTO },
  viagens: { tipo: 'lista', item: ITEM_VIAGEM, idNamespace: 'viagens' },

  /* cartão — resquício de quando havia um só */
  limiteCartao: { tipo: 'dinheiro', min: 0, padrao: 0 },
  diaVencimentoFatura: { tipo: 'inteiro', min: 1, max: 31, padrao: 10 },

  /* categorias e orçamento */
  categorias: { tipo: 'listaTexto', max: LIMITES.categoria },
  /* o emoji de cada categoria criada pela pessoa. Mapa a parte, e nao dentro
     do nome, porque o nome viaja: vai pro CSV, pro orcamento, pro De-Para do
     banco e pra comparacao com o que ja existe. "Pets" tem que continuar
     sendo "Pets". */
  categoriaEmojis: { tipo: 'mapaTexto', maxChave: LIMITES.categoria, maxValor: 8 },
  orcamentos: { tipo: 'mapaDinheiro', maxChave: LIMITES.categoria },

  /* reserva de emergência */
  reservaGuardado: { tipo: 'dinheiro', min: 0, padrao: 0 },
  reservaMeses: { tipo: 'inteiro', min: 0, max: 120, padrao: 3 },
  reservaNaConta: { tipo: 'booleano', padrao: true },

  /* taxas */
  taxasManuais: {
    tipo: 'objeto',
    campos: {
      cdi: { tipo: 'dinheiro', min: 0, nulo: true },
      selic: { tipo: 'dinheiro', min: 0, nulo: true },
      atualizadoEm: { tipo: 'iso', nulo: true },
    },
  },

  /* preferências */
  tema: { tipo: 'opcao', valores: ['onda', 'noite', 'sakura', 'matcha', 'poupa', 'grafite', 'roxo', 'custom'], padrao: 'onda' },
  customTheme: { tipo: 'mapaTexto', maxChave: 60, maxValor: 60 },
  idioma: { tipo: 'opcao', valores: ['pt', 'en', 'es', 'fr', 'it'], padrao: 'pt' },
  moeda: { tipo: 'opcao', valores: ['BRL', 'USD', 'EUR', 'GBP'], padrao: 'BRL' },
  fundoIlustrado: { tipo: 'booleano', padrao: false },
  gastoDiario: { tipo: 'booleano', padrao: false },
  temaAutoNoite: { tipo: 'booleano', padrao: false },
  onboardingCompleto: { tipo: 'booleano', padrao: false },
  tourCompleto: { tipo: 'booleano', padrao: false },
  iaAtiva: { tipo: 'booleano', padrao: false },
  /* a integracao com o Pierre. A CHAVE nao esta aqui de proposito: como a da
     IA, ela mora fora do objeto, e por isso nao entra em backup nem sobe pra
     nuvem — ver src/integrations/pierre-key.js. */
  pierreAtivo: { tipo: 'booleano', padrao: false },
  pierreSincronizadoEm: { tipo: 'iso', nulo: true },
  /* o que a sincronizacao traz. Lista vazia de contas = todas, que e como a
     integracao se comporta antes de alguem escolher. */
  pierreTrazerSaldo: { tipo: 'booleano', padrao: true },
  pierreTrazerLancamentos: { tipo: 'booleano', padrao: true },
  pierreContas: { tipo: 'listaTexto', max: 120 },
  /* Sem isto, `pierreContas: []` queria dizer DUAS coisas: "nunca escolhi,
     traga tudo" e "desmarquei todas, nao traga nada". Quem desmarcasse todas
     recebia o extrato inteiro. Agora a lista e sempre explicita, e esta bandeira
     separa quem nunca mexeu (padrao, traz tudo) de quem escolheu. */
  pierreContasDefinidas: { tipo: 'booleano', padrao: false },
  pierreTrazerCartao: { tipo: 'booleano', padrao: false },
  pierreTrazerFixos: { tipo: 'booleano', padrao: false },
  /* buscar sozinho ao abrir o app. Desligado por padrao: exige a chave no
     disco, e gravar no Diario sem alguem ver o plano nao acontece nunca --
     isto so adianta a BUSCA, o plano continua esperando um toque. */
  pierreBuscarAoAbrir: { tipo: 'booleano', padrao: false },

  /* marcadores de "já aconteceu" — sem eles o app repete a ação toda vez que
     abre: um snapshot novo na nuvem, o card de revisão do mês de volta */
  snapshotsMensais: { tipo: 'listaTexto', max: 80 },
  revisoesVistas: { tipo: 'listaTexto', max: 20 },

  /* formato antigo: viravam gastos fixos. migrateData() consome e apaga. */
  internet: { tipo: 'objeto', legado: true, campos: {
    nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
    valor: { tipo: 'dinheiro', padrao: 0 },
    diaDoMes: { tipo: 'inteiro', min: 1, max: 31, padrao: 10 },
  } },
  spotify: { tipo: 'objeto', legado: true, campos: {
    nome: { tipo: 'texto', max: LIMITES.nome, padrao: '' },
    valor: { tipo: 'dinheiro', padrao: 0 },
    diaDoMes: { tipo: 'inteiro', min: 1, max: 31, padrao: 10 },
  } },
};

/* listas cujos ids são referenciados por outras listas */
const NAMESPACES_DE_ID = {
  cartoes: 'cartoes',
  viagens: 'viagens',
};
