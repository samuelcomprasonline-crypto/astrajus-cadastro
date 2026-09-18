let sessaoAtual = null;
let advogadoAtual = null;
let areasAssinadasAtual = [];

const ROTULOS_AREA = {
  civel: "Cível", consumidor: "Consumidor", trabalhista: "Trabalhista", tributario: "Tributário",
  empresarial: "Empresarial", familia_sucessoes: "Família/Sucessões", criminal: "Criminal",
  previdenciario: "Previdenciário", bancario: "Bancário",
  imobiliario_regularizacao_fundiaria: "Imobiliário/Regularização Fundiária",
};
function rotuloArea(slug) { return ROTULOS_AREA[slug] || slug; }

async function iniciar() {
  sessaoAtual = await exigirSessao();
  if (!sessaoAtual) return;

  const { data: advogado, error } = await supabaseClient
    .from("advogados")
    .select("id, nome, oab_numero, oab_uf")
    .maybeSingle();

  if (error || !advogado) {
    document.getElementById("nome-advogado").textContent = "Não foi possível carregar seu perfil.";
    return;
  }
  advogadoAtual = advogado;

  document.getElementById("nome-advogado").textContent =
    `Olá, ${advogado.nome} (OAB/${advogado.oab_uf} ${advogado.oab_numero})`;

  const { data: assinatura } = await supabaseClient
    .from("assinaturas")
    .select("areas, status, valor_mensal_centavos, acesso_valido_ate")
    .in("status", ["ativa", "cancelamento_agendado"])
    .maybeSingle();

  if (!assinatura) {
    document.getElementById("areas-advogado").textContent = "";
    document.getElementById("status-assinatura").textContent =
      "Nenhuma assinatura ativa. Seus roteiros ficam indisponíveis até reativar.";
    return;
  }

  areasAssinadasAtual = assinatura.areas;
  document.getElementById("areas-advogado").textContent =
    "Áreas assinadas: " + assinatura.areas.map(rotuloArea).join(", ");
  document.getElementById("status-assinatura").textContent =
    assinatura.status === "cancelamento_agendado"
      ? `Assinatura cancelada — acesso liberado até ${assinatura.acesso_valido_ate}.`
      : "Assinatura ativa.";
}

document.getElementById("botao-sair").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});

function semanaIsoAtual() {
  const agora = new Date();
  const data = new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
  const diaSemana = data.getUTCDay() || 7;
  data.setUTCDate(data.getUTCDate() + 4 - diaSemana);
  const anoInicio = new Date(Date.UTC(data.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((data - anoInicio) / 86400000) + 1) / 7);
  return `${data.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

let todosRoteiros = [];
let gravadosPorRoteiro = new Set();
let areasEmAltaSemanaAtual = new Set();
let termosTrendsSemana = [];

function popularFiltros(roteiros) {
  const areas = [...new Set(roteiros.map((r) => r.area))].sort();
  const semanas = [...new Set(roteiros.map((r) => r.semana_iso))].sort().reverse();

  const container = document.getElementById("filtros-roteiros");
  container.innerHTML = "";

  const selectArea = document.createElement("select");
  selectArea.id = "filtro-area";
  selectArea.appendChild(new Option("Todas as áreas", ""));
  for (const area of areas) selectArea.appendChild(new Option(rotuloArea(area), area));

  const selectSemana = document.createElement("select");
  selectSemana.id = "filtro-semana";
  selectSemana.appendChild(new Option("Todas as semanas", ""));
  for (const semana of semanas) selectSemana.appendChild(new Option(semana, semana));

  selectArea.addEventListener("change", aplicarFiltros);
  selectSemana.addEventListener("change", aplicarFiltros);

  container.appendChild(selectArea);
  container.appendChild(selectSemana);
}

function aplicarFiltros() {
  const areaEscolhida = document.getElementById("filtro-area").value;
  const semanaEscolhida = document.getElementById("filtro-semana").value;
  const filtrados = todosRoteiros.filter(
    (r) => (!areaEscolhida || r.area === areaEscolhida)
      && (!semanaEscolhida || r.semana_iso === semanaEscolhida),
  );
  renderizarRoteiros(filtrados);
}

async function carregarRoteiros() {
  const { data: roteiros, error } = await supabaseClient
    .from("roteiros_gerados")
    .select("id, area, semana_iso, tom, cta, texto_completo, assunto, julgado_resumo, orgao_julgador, data_julgamento")
    .order("semana_iso", { ascending: false });

  if (error || !roteiros) {
    document.getElementById("lista-roteiros").textContent = "Não foi possível carregar os roteiros.";
    return;
  }
  todosRoteiros = roteiros;

  const { data: progresso } = await supabaseClient
    .from("roteiros_progresso")
    .select("roteiro_id, gravado");
  gravadosPorRoteiro = new Set((progresso || []).filter((p) => p.gravado).map((p) => p.roteiro_id));

  const semanaAtual = semanaIsoAtual();
  const { data: trends } = await supabaseClient
    .from("trends_semanais")
    .select("area, termo, posicao")
    .eq("semana_iso", semanaAtual)
    .order("posicao", { ascending: true });
  areasEmAltaSemanaAtual = new Set((trends || []).map((t) => t.area));
  termosTrendsSemana = trends || [];

  popularFiltros(roteiros);
  renderizarRoteiros(roteiros);
  renderizarTrends();
  atualizarEstatisticas();
}

function renderizarTrends() {
  const container = document.getElementById("lista-trends");
  container.innerHTML = "";

  for (const area of areasAssinadasAtual || []) {
    const termos = termosTrendsSemana
      .filter((t) => t.area === area)
      .sort((a, b) => a.posicao - b.posicao)
      .slice(0, 3);
    if (termos.length === 0) continue;

    const grupo = document.createElement("div");
    grupo.className = "grupo-trends";

    const titulo = document.createElement("h3");
    titulo.textContent = rotuloArea(area);
    grupo.appendChild(titulo);

    const lista = document.createElement("ol");
    for (const t of termos) {
      const li = document.createElement("li");
      const posicao = document.createElement("span");
      posicao.className = "trend-posicao";
      posicao.textContent = String(t.posicao);
      const termo = document.createElement("span");
      termo.textContent = t.termo;
      li.appendChild(posicao);
      li.appendChild(termo);
      lista.appendChild(li);
    }
    grupo.appendChild(lista);
    container.appendChild(grupo);
  }

  if (!container.hasChildNodes()) {
    container.textContent =
      "Os termos em alta desta semana aparecem aqui assim que forem atualizados (toda sexta).";
  }
}

function atualizarEstatisticas() {
  document.getElementById("stat-roteiros").textContent = String(todosRoteiros.length);
  document.getElementById("stat-gravados").textContent = String(gravadosPorRoteiro.size);
  document.getElementById("stat-areas").textContent = String((areasAssinadasAtual || []).length);
  document.getElementById("stat-semana").textContent = semanaIsoAtual();
}

function criarEl(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  el.textContent = texto;
  return el;
}

function textoNumeroJulgado(n) {
  return n ? `Processo/recurso nº ${n}` : "Número não informado pela fonte";
}

const ROTULOS_TOM = { urgencia: "Urgência", storytelling: "Storytelling", prevencao: "Prevenção" };
function rotuloTom(tom) {
  return ROTULOS_TOM[tom] || (tom.charAt(0).toUpperCase() + tom.slice(1));
}

// "YYYY-MM-DD" -> "dd/mm/aaaa" sem Date (evita erro de fuso).
function formatarDataBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function renderizarRoteiros(roteiros) {
  const container = document.getElementById("lista-roteiros");
  container.innerHTML = "";

  if (roteiros.length === 0) {
    container.textContent = "Nenhum roteiro disponível ainda. O primeiro sai até o fim da semana.";
    return;
  }

  const semanaAtual = semanaIsoAtual();
  for (const roteiro of roteiros) {
    const item = document.createElement("article");
    item.className = "item-roteiro";

    const cabecalho = document.createElement("div");
    cabecalho.className = "roteiro-cabecalho";
    const chips = document.createElement("div");
    chips.className = "roteiro-chips";
    chips.appendChild(criarEl("span", "chip-area", rotuloArea(roteiro.area)));
    if (areasEmAltaSemanaAtual.has(roteiro.area) && roteiro.semana_iso === semanaAtual) {
      chips.appendChild(criarEl("span", "selo-alta", "em alta"));
    }
    if (roteiro.tom) chips.appendChild(criarEl("span", "chip-tom", rotuloTom(roteiro.tom)));
    cabecalho.appendChild(chips);
    cabecalho.appendChild(criarEl("span", "roteiro-semana", `semana ${roteiro.semana_iso}`));
    item.appendChild(cabecalho);

    item.appendChild(criarEl("h3", "roteiro-titulo", roteiro.assunto || "Assunto não informado"));

    const meta = document.createElement("dl");
    meta.className = "roteiro-meta";
    const itensMeta = [
      ["Órgão julgador", roteiro.orgao_julgador || "não informado na fonte"],
      ["Data do julgamento", formatarDataBR(roteiro.data_julgamento) || "não informada na fonte"],
    ];
    for (const [rotulo, valor] of itensMeta) {
      const par = document.createElement("div");
      par.appendChild(criarEl("dt", "", rotulo + ":"));
      par.appendChild(criarEl("dd", "", valor));
      meta.appendChild(par);
    }
    item.appendChild(meta);

    if (roteiro.julgado_resumo) {
      const blocoJulgado = document.createElement("section");
      blocoJulgado.className = "roteiro-bloco";
      blocoJulgado.appendChild(criarEl("h4", "", "O julgado"));
      blocoJulgado.appendChild(criarEl("p", "", roteiro.julgado_resumo));
      item.appendChild(blocoJulgado);
    }

    const blocoRoteiro = document.createElement("section");
    blocoRoteiro.className = "roteiro-bloco";
    blocoRoteiro.appendChild(criarEl("h4", "", "Roteiro"));
    blocoRoteiro.appendChild(criarEl("p", "roteiro-texto", roteiro.texto_completo));
    if (roteiro.cta) {
      const cta = document.createElement("div");
      cta.className = "roteiro-cta";
      cta.appendChild(criarEl("span", "roteiro-cta-rotulo", "Chamada para ação"));
      cta.appendChild(criarEl("p", "", roteiro.cta));
      blocoRoteiro.appendChild(cta);
    }
    item.appendChild(blocoRoteiro);

    const rodape = document.createElement("div");
    rodape.className = "roteiro-acoes";

    const botaoCopiar = document.createElement("button");
    botaoCopiar.type = "button";
    botaoCopiar.className = "botao-secundario";
    botaoCopiar.textContent = "Copiar texto";
    botaoCopiar.addEventListener("click", () => navigator.clipboard.writeText(
      roteiro.cta ? `${roteiro.texto_completo}\n\n${roteiro.cta}` : roteiro.texto_completo,
    ));
    rodape.appendChild(botaoCopiar);

    const rotuloGravado = document.createElement("label");
    const checkboxGravado = document.createElement("input");
    checkboxGravado.type = "checkbox";
    checkboxGravado.checked = gravadosPorRoteiro.has(roteiro.id);
    checkboxGravado.addEventListener("change", async () => {
      const novoValor = checkboxGravado.checked;
      const { error: erroProgresso } = await supabaseClient.from("roteiros_progresso").upsert({
        advogado_id: advogadoAtual.id,
        roteiro_id: roteiro.id,
        gravado: novoValor,
        marcado_em: new Date().toISOString(),
      }, { onConflict: "advogado_id,roteiro_id" });

      if (erroProgresso) {
        checkboxGravado.checked = !novoValor;
        alert("Não foi possível salvar. Tente novamente.");
        return;
      }

      if (novoValor) {
        gravadosPorRoteiro.add(roteiro.id);
      } else {
        gravadosPorRoteiro.delete(roteiro.id);
      }
      atualizarEstatisticas();
    });
    rotuloGravado.appendChild(checkboxGravado);
    rotuloGravado.appendChild(document.createTextNode(" já gravei"));
    rodape.appendChild(rotuloGravado);
    item.appendChild(rodape);

    container.appendChild(item);
  }
}

const CANCELAR_ASSINATURA_URL =
  "https://wuxuxxdikaacggwqivmm.supabase.co/functions/v1/cancelar-assinatura-painel";

function mostrarMensagemAssinatura(texto, tipo) {
  const el = document.getElementById("mensagem-assinatura");
  el.textContent = texto;
  el.className = "mensagem " + tipo;
}

async function carregarDetalhesAssinatura() {
  const { data: assinatura } = await supabaseClient
    .from("assinaturas")
    .select("areas, forma_pagamento, valor_mensal_centavos, status, acesso_valido_ate")
    .in("status", ["ativa", "cancelamento_agendado"])
    .maybeSingle();

  const container = document.getElementById("detalhes-assinatura");
  const botaoCancelar = document.getElementById("botao-cancelar");

  if (!assinatura) {
    container.textContent = "Nenhuma assinatura ativa.";
    botaoCancelar.style.display = "none";
    return;
  }

  const valor = (assinatura.valor_mensal_centavos / 100).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
  });
  container.textContent =
    `Áreas: ${assinatura.areas.map(rotuloArea).join(", ")} — ${valor}/mês — ` +
    (assinatura.forma_pagamento === "cartao_credito" ? "cartão de crédito" : "Pix");

  if (assinatura.status === "cancelamento_agendado") {
    botaoCancelar.style.display = "none";
    mostrarMensagemAssinatura(
      `Assinatura já cancelada — acesso liberado até ${assinatura.acesso_valido_ate}.`,
      "",
    );
  } else {
    botaoCancelar.style.display = "";
  }
}

document.getElementById("botao-cancelar").addEventListener("click", async () => {
  const confirmado = window.confirm(
    "Cancelar sua assinatura? Você continua com acesso até o fim do ciclo já pago, sem reembolso do valor pago.",
  );
  if (!confirmado) return;

  const botao = document.getElementById("botao-cancelar");
  botao.disabled = true;
  mostrarMensagemAssinatura("Cancelando...", "");

  let resposta;
  let dados;
  try {
    resposta = await fetch(CANCELAR_ASSINATURA_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${sessaoAtual.access_token}`,
      },
    });
    dados = await resposta.json().catch(() => ({}));
  } catch {
    mostrarMensagemAssinatura("Não foi possível cancelar, tenta de novo em instantes.", "erro");
    botao.disabled = false;
    return;
  }

  if (!resposta.ok) {
    mostrarMensagemAssinatura(dados.erro || "Não foi possível cancelar, tenta de novo em instantes.", "erro");
    botao.disabled = false;
    return;
  }

  mostrarMensagemAssinatura(
    `Assinatura cancelada. Seu acesso continua liberado até ${dados.acesso_valido_ate}.`,
    "sucesso",
  );
  botao.style.display = "none";
});

// ---------- Gerar roteiro sob demanda ----------
const GERAR_ROTEIRO_URL = SUPABASE_URL + "/functions/v1/gerar-roteiro";
const LIMITE_PADRAO = 30;
const LIMITE_MUITAS_AREAS = 100;

let julgadoSelecionado = null; // dedupe_hash
let formatoSelecionado = null; // slug
let tiposRoteiro = [];
let usoMes = { usados: null, limite: LIMITE_PADRAO };
let gerando = false;
let historicoGerados = [];

function limiteMensal() {
  return (areasAssinadasAtual || []).length >= 10 ? LIMITE_MUITAS_AREAS : LIMITE_PADRAO;
}

function nomeFormato(slug) {
  const t = tiposRoteiro.find((x) => x.slug === slug);
  return t ? t.nome : slug;
}

// Início do mês corrente em America/Sao_Paulo (sem horário de verão desde 2019: -03:00).
function inicioMesSaoPauloISO() {
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" })
    .format(new Date()); // "2026-09"
  return `${ym}-01T00:00:00-03:00`;
}

function formatarDataHoraBR(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function textoParaCopiar(r) {
  return r.cta ? `${r.texto}\n\n${r.cta}` : r.texto;
}

function botaoCopiarTexto(getTexto) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "botao-secundario";
  b.textContent = "Copiar texto";
  let timer;
  b.addEventListener("click", async () => {
    let ok = true;
    try { await navigator.clipboard.writeText(getTexto()); } catch { ok = false; }
    b.textContent = ok ? "Copiado" : "Não foi possível copiar";
    clearTimeout(timer);
    timer = setTimeout(() => { b.textContent = "Copiar texto"; }, 2000);
  });
  return b;
}

function mostrarAvisoGerar(texto) {
  document.getElementById("aviso-gerar").textContent = texto || "";
}

function atualizarContador() {
  const { usados, limite } = usoMes;
  const rotulo = document.getElementById("contador-uso");
  const medidor = document.getElementById("medidor-uso");
  if (usados === null) {
    rotulo.textContent = `— de ${limite} neste mês`;
    medidor.style.width = "0%";
  } else {
    rotulo.textContent = `${usados} de ${limite} neste mês`;
    medidor.style.width = Math.min(100, Math.round((usados / limite) * 100)) + "%";
  }
  atualizarBotaoGerar();
}

function atualizarBotaoGerar() {
  const botao = document.getElementById("botao-gerar");
  const dica = document.getElementById("dica-gerar");
  const esgotada = usoMes.usados !== null && usoMes.usados >= usoMes.limite;
  let msg = "";
  if (gerando) msg = "Gerando seu roteiro, isso pode levar alguns segundos.";
  else if (esgotada) msg = "Você usou todos os roteiros deste mês. O contador zera no dia 1º.";
  else if (!julgadoSelecionado && !formatoSelecionado) msg = "Escolha um julgado e um formato para continuar.";
  else if (!julgadoSelecionado) msg = "Escolha um julgado para continuar.";
  else if (!formatoSelecionado) msg = "Escolha um formato para continuar.";
  dica.textContent = msg;
  botao.disabled = gerando || esgotada || !julgadoSelecionado || !formatoSelecionado;
  botao.textContent = gerando ? "Gerando…" : "Gerar roteiro";
  botao.setAttribute("aria-busy", gerando ? "true" : "false");
}

// Cartão selecionável (rádio nativo: teclado e leitor de tela de graça). `extra` fica fora do label.
function cartaoRadio(nome, valor, marcado, conteudo, aoMarcar, extra) {
  const cartao = document.createElement("div");
  cartao.className = "cartao-selecao";
  const rotulo = document.createElement("label");
  rotulo.className = "cartao-selecao-corpo";
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = nome;
  radio.value = valor;
  radio.checked = marcado;
  radio.addEventListener("change", () => { if (radio.checked) aoMarcar(valor); });
  rotulo.appendChild(radio);
  rotulo.appendChild(conteudo);
  cartao.appendChild(rotulo);
  if (extra) cartao.appendChild(extra);
  return cartao;
}

function renderizarJulgados(julgados) {
  const lista = document.getElementById("lista-julgados");
  lista.replaceChildren();
  if (!julgados.some((j) => j.dedupe_hash === julgadoSelecionado)) julgadoSelecionado = null;

  for (const j of julgados) {
    const conteudo = criarEl("span", "cartao-conteudo", "");
    const chips = criarEl("span", "roteiro-chips", "");
    chips.appendChild(criarEl("span", "chip-area", rotuloArea(j.area)));
    conteudo.appendChild(chips);
    conteudo.appendChild(criarEl("span", "cartao-titulo", j.assunto || "Assunto não informado"));
    const data = formatarDataBR(j.data_julgamento);
    conteudo.appendChild(criarEl("span", "cartao-meta",
      `${j.orgao_julgador || "Órgão não informado"} · ${data ? "julgado em " + data : "data não informada"}`));

    let extra = null;
    let resumoEl = null;
    if (j.resumo) {
      const resumo = resumoEl = criarEl("span", "julgado-resumo", j.resumo);
      if (j.resumo.length > 170) {
        extra = criarEl("button", "botao-texto", "Ver mais");
        extra.type = "button";
        extra.setAttribute("aria-expanded", "false");
        extra.addEventListener("click", () => {
          const aberto = resumo.classList.toggle("expandido");
          extra.setAttribute("aria-expanded", String(aberto));
          extra.textContent = aberto ? "Ver menos" : "Ver mais";
        });
      }
    }
    conteudo.appendChild(criarEl("span", "cartao-meta", textoNumeroJulgado(j.numero_julgado)));
    if (j.resumo) conteudo.appendChild(resumoEl);
    lista.appendChild(cartaoRadio("julgado", j.dedupe_hash, j.dedupe_hash === julgadoSelecionado, conteudo,
      (v) => { julgadoSelecionado = v; atualizarBotaoGerar(); }, extra));
  }
  atualizarBotaoGerar();
}

async function carregarJulgados() {
  const lista = document.getElementById("lista-julgados");
  const area = document.getElementById("filtro-julgados-area").value;
  let q = supabaseClient
    .from("julgados_disponiveis")
    .select("dedupe_hash, area, assunto, resumo, orgao_julgador, data_julgamento, numero_julgado, data_captura")
    .order("data_captura", { ascending: false })
    .limit(30);
  if (area) q = q.eq("area", area);
  const { data, error } = await q;
  if (error || !data) {
    lista.textContent = "Não foi possível carregar os julgados.";
    return;
  }
  if (data.length === 0) {
    lista.textContent = (areasAssinadasAtual || []).length === 0
      ? "Você precisa de uma assinatura ativa para ver os julgados."
      : "Nenhum julgado disponível para esta seleção nos últimos dias.";
    return;
  }
  renderizarJulgados(data);
}

async function carregarFormatos() {
  const lista = document.getElementById("lista-formatos");
  const { data, error } = await supabaseClient
    .from("tipos_roteiro_publico")
    .select("slug, nome, descricao, ordem")
    .order("ordem", { ascending: true });
  if (error || !data) {
    lista.textContent = "Não foi possível carregar os formatos.";
    return;
  }
  if (data.length === 0) {
    lista.textContent = "Nenhum formato disponível no momento.";
    return;
  }
  tiposRoteiro = data;
  lista.replaceChildren();
  for (const t of data) {
    const conteudo = criarEl("span", "cartao-conteudo", "");
    conteudo.appendChild(criarEl("span", "cartao-titulo", t.nome));
    if (t.descricao) conteudo.appendChild(criarEl("span", "cartao-meta", t.descricao));
    lista.appendChild(cartaoRadio("formato", t.slug, t.slug === formatoSelecionado, conteudo,
      (v) => { formatoSelecionado = v; atualizarBotaoGerar(); }));
  }
}

async function carregarUsoMes() {
  usoMes.limite = limiteMensal();
  const { count, error } = await supabaseClient
    .from("roteiros_usuario")
    .select("id", { count: "exact", head: true })
    .gte("criado_em", inicioMesSaoPauloISO());
  usoMes.usados = error || count === null ? null : count;
  atualizarContador();
}

// Cartão de roteiro gerado. `compacto`: texto recolhido com botão de expandir (histórico).
function criarCartaoGerado(r, compacto) {
  const item = document.createElement("article");
  item.className = "item-roteiro item-gerado";

  const cab = document.createElement("div");
  cab.className = "roteiro-cabecalho";
  const chips = document.createElement("div");
  chips.className = "roteiro-chips";
  chips.appendChild(criarEl("span", "chip-tom", nomeFormato(r.tipo_slug)));
  if (r.area) chips.appendChild(criarEl("span", "chip-area", rotuloArea(r.area)));
  cab.appendChild(chips);
  cab.appendChild(criarEl("span", "roteiro-semana", formatarDataHoraBR(r.criado_em)));
  item.appendChild(cab);

  item.appendChild(criarEl("h3", "roteiro-titulo", r.assunto || "Assunto não informado"));

  // Só mostra a referência quando o dado veio na resposta (o roteiro recém-gerado pode não trazê-lo;
  // o texto já leva o bloco "REFERÊNCIA DO JULGADO" anexado pelo servidor).
  const ref = [];
  if (r.orgao_julgador !== undefined) ref.push(["Órgão julgador", r.orgao_julgador || "não informado na fonte"]);
  if (r.data_julgamento !== undefined) ref.push(["Data do julgamento", formatarDataBR(r.data_julgamento) || "não informada na fonte"]);
  if (r.numero_julgado !== undefined) ref.push(["Referência", textoNumeroJulgado(r.numero_julgado)]);
  if (ref.length) {
    const meta = document.createElement("dl");
    meta.className = "roteiro-meta";
    for (const [rotulo, valor] of ref) {
      const par = document.createElement("div");
      par.appendChild(criarEl("dt", "", rotulo + ":"));
      par.appendChild(criarEl("dd", "", valor));
      meta.appendChild(par);
    }
    item.appendChild(meta);
  }

  const bloco = document.createElement("section");
  bloco.className = "roteiro-bloco";
  const texto = criarEl("p", "texto-gerado" + (compacto ? " recolhido" : ""), r.texto);
  bloco.appendChild(texto);
  if (r.cta) {
    const cta = document.createElement("div");
    cta.className = "roteiro-cta";
    cta.appendChild(criarEl("span", "roteiro-cta-rotulo", "Chamada para ação"));
    cta.appendChild(criarEl("p", "texto-gerado", r.cta));
    if (compacto) cta.hidden = true;
    bloco.appendChild(cta);
  }
  const aviso = criarEl("p", "roteiro-aviso-fidelidade",
    "Roteiro baseado apenas no resumo do julgado. Confira o julgado original antes de publicar.");
  if (compacto) aviso.hidden = true; // no histórico só aparece com o item expandido
  bloco.appendChild(aviso);
  item.appendChild(bloco);

  const acoes = document.createElement("div");
  acoes.className = "roteiro-acoes";
  if (compacto) {
    const alternar = criarEl("button", "botao-secundario", "Ver texto completo");
    alternar.type = "button";
    alternar.setAttribute("aria-expanded", "false");
    alternar.addEventListener("click", () => {
      const aberto = texto.classList.toggle("recolhido") === false;
      alternar.setAttribute("aria-expanded", String(aberto));
      alternar.textContent = aberto ? "Recolher" : "Ver texto completo";
      const cta = bloco.querySelector(".roteiro-cta");
      if (cta) cta.hidden = !aberto;
      aviso.hidden = !aberto;
    });
    acoes.appendChild(alternar);
  }
  acoes.appendChild(botaoCopiarTexto(() => textoParaCopiar(r)));
  item.appendChild(acoes);
  return item;
}

function renderizarHistoricoGerados() {
  const lista = document.getElementById("lista-gerados");
  lista.replaceChildren();
  if (historicoGerados.length === 0) {
    lista.textContent = "Você ainda não gerou nenhum roteiro. Escolha um julgado e um formato acima para começar.";
    return;
  }
  for (const r of historicoGerados) lista.appendChild(criarCartaoGerado(r, true));
}

async function carregarHistoricoGerados() {
  const { data, error } = await supabaseClient
    .from("roteiros_usuario")
    .select("id, tipo_slug, area, assunto, orgao_julgador, data_julgamento, numero_julgado, texto, cta, criado_em")
    .order("criado_em", { ascending: false })
    .limit(30);
  if (error || !data) {
    document.getElementById("lista-gerados").textContent = "Não foi possível carregar seu histórico.";
    return;
  }
  historicoGerados = data;
  renderizarHistoricoGerados();
}

async function gerarRoteiro() {
  if (gerando || !julgadoSelecionado || !formatoSelecionado) return;
  gerando = true;
  mostrarAvisoGerar("");
  atualizarBotaoGerar();

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "login.html"; return; }

    let resposta;
    try {
      resposta = await fetch(GERAR_ROTEIRO_URL, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + session.access_token,
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dedupe_hash: julgadoSelecionado, tipo_slug: formatoSelecionado }),
      });
    } catch {
      mostrarAvisoGerar("Não foi possível concluir o pedido. Recarregue a página e tente de novo.");
      return;
    }
    const dados = await resposta.json().catch(() => ({}));

    if (resposta.status === 401) {
      await supabaseClient.auth.signOut();
      window.location.href = "login.html";
      return;
    }
    if (!resposta.ok || !dados.roteiro) {
      mostrarAvisoGerar(typeof dados.erro === "string" && dados.erro
        ? dados.erro : (resposta.status === 403
          ? "Acesso não autorizado a esta função. Recarregue a página e tente de novo."
          : "Não foi possível gerar o roteiro agora. Tente de novo em instantes; se persistir, recarregue a página."));
      if (dados.uso && Number.isFinite(dados.uso.usados)) {
        usoMes = { usados: dados.uso.usados, limite: dados.uso.limite || usoMes.limite };
        atualizarContador();
      }
      return;
    }

    const resultado = document.getElementById("resultado-gerar");
    resultado.replaceChildren(criarCartaoGerado(dados.roteiro, false));
    resultado.hidden = false;
    resultado.focus({ preventScroll: true });
    resultado.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest",
    });

    historicoGerados = [dados.roteiro, ...historicoGerados.filter((x) => x.id !== dados.roteiro.id)].slice(0, 30);
    renderizarHistoricoGerados();
    if (dados.uso && Number.isFinite(dados.uso.usados)) {
      usoMes = { usados: dados.uso.usados, limite: dados.uso.limite || usoMes.limite };
    } else if (usoMes.usados !== null) {
      usoMes.usados += 1;
    }
    atualizarContador();
  } finally {
    gerando = false;
    atualizarBotaoGerar();
  }
}

function carregarGerador() {
  const select = document.getElementById("filtro-julgados-area");
  select.appendChild(new Option("Todas as áreas", ""));
  for (const area of areasAssinadasAtual || []) select.appendChild(new Option(rotuloArea(area), area));
  select.addEventListener("change", carregarJulgados);
  document.getElementById("botao-gerar").addEventListener("click", gerarRoteiro);
  usoMes.limite = limiteMensal();
  atualizarContador();
  carregarJulgados();
  carregarFormatos().then(carregarHistoricoGerados); // formatos primeiro: o histórico mostra o nome deles
  carregarUsoMes();
}

iniciar().then(() => {
  if (advogadoAtual) {
    carregarRoteiros();
    carregarDetalhesAssinatura();
    carregarGerador();
  }
});

// Destaque do item ativo na navegação lateral (aditivo, tolera elementos ausentes).
(function () {
  const links = Array.from(document.querySelectorAll(".lateral nav a[href^='#']"));
  const secoes = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if (!links.length || !secoes.length) return;
  function marcar(secao) {
    links.forEach((a) => {
      const ativo = !!secao && a.getAttribute("href") === "#" + secao.id;
      a.classList.toggle("ativo", ativo);
      if (ativo) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }
  marcar(secoes[0]);
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) marcar(e.target); });
  }, { rootMargin: "-25% 0px -65% 0px" });
  secoes.forEach((s) => io.observe(s));
  window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) marcar(secoes[secoes.length - 1]);
  }, { passive: true });
})();
