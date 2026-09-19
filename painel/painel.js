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
const LIMITE_HISTORICO = 100;
const AVISO_FIDELIDADE = "Roteiro baseado apenas no resumo do julgado. Confira o julgado original antes de publicar.";
const NAO_INFORMADO = "não informado pela fonte";

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

function mostrarAvisoGerar(texto) {
  document.getElementById("aviso-gerar").textContent = texto || "";
}

function julgadoEscolhido() {
  return todosJulgados.find((j) => j.dedupe_hash === julgadoSelecionado) || null;
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
  const j = julgadoEscolhido();
  document.getElementById("resumo-gerar").textContent =
    `Julgado: ${j ? (j.assunto || "assunto não informado") : "nenhum escolhido"} · ` +
    `Formato: ${formatoSelecionado ? nomeFormato(formatoSelecionado) : "nenhum escolhido"}`;
  let msg = "";
  if (gerando) msg = "Gerando… leva alguns segundos.";
  else if (esgotada) msg = "Você usou todos os roteiros deste mês. O contador zera no dia 1º.";
  else if (!julgadoSelecionado && !formatoSelecionado) msg = "Escolha um julgado (passo 1) e um formato (passo 2) para continuar.";
  else if (!julgadoSelecionado) msg = "Escolha um julgado (passo 1) para continuar.";
  else if (!formatoSelecionado) msg = "Escolha um formato (passo 2) para continuar.";
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

// ---- Passo 1: lista de julgados (filtro de área, incompletos opcionais e paginação, tudo no cliente) ----
const JULGADOS_POR_PAGINA = 9;
const RESUMO_CURTO = 320;
const MSG_SEM_JULGADOS_COMPLETOS =
  "Ainda não há julgados confirmados (com número e data) nas suas áreas. Novos julgados chegam toda semana.";
let todosJulgados = [];
let filtradosJulgados = [];
let exibidosJulgados = 0;
let limiteJulgados = JULGADOS_POR_PAGINA;
let incluirIncompletos = false;

function julgadoCompleto(j) {
  return !!(j.numero_julgado && String(j.numero_julgado).trim()) && !!formatarDataBR(j.data_julgamento);
}

// Data de julgamento desc (nulos por último), depois data_captura desc.
function compararJulgados(a, b) {
  const da = formatarDataBR(a.data_julgamento) ? a.data_julgamento : "";
  const db = formatarDataBR(b.data_julgamento) ? b.data_julgamento : "";
  if (da !== db) return !da ? 1 : !db ? -1 : (da < db ? 1 : -1);
  const ca = a.data_captura || "", cb = b.data_captura || "";
  return ca === cb ? 0 : (ca < cb ? 1 : -1);
}

// "Órgão · Processo/recurso nº X · Julgado em dd/mm/aaaa" (ausentes = "—")
function linhaMeta(r) {
  const num = r.numero_julgado && String(r.numero_julgado).trim();
  return `${r.orgao_julgador || "—"} · Processo/recurso nº ${num || "—"} · Julgado em ${formatarDataBR(r.data_julgamento) || "—"}`;
}

function criarCartaoJulgado(j) {
  const conteudo = criarEl("span", "cartao-conteudo", "");
  const selos = criarEl("span", "roteiro-chips", "");
  selos.appendChild(criarEl("span", "chip-area", rotuloArea(j.area)));
  if (!julgadoCompleto(j)) selos.appendChild(criarEl("span", "julgado-incompleto", "Dados incompletos"));
  conteudo.appendChild(selos);
  const titulo = criarEl("span", "cartao-titulo", j.assunto || "Assunto não informado");
  titulo.id = `julgado-titulo-${j._i}`;
  conteudo.appendChild(titulo);

  let extra = null;
  if (j.resumo) {
    const resumo = criarEl("span", "julgado-resumo", j.resumo);
    conteudo.appendChild(resumo);
    if (j.resumo.length > RESUMO_CURTO) {
      resumo.classList.add("truncado");
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
  const meta = criarEl("span", "julgado-meta", linhaMeta(j));
  meta.id = `julgado-meta-${j._i}`;
  conteudo.appendChild(meta);

  const cartao = cartaoRadio("julgado", j.dedupe_hash, j.dedupe_hash === julgadoSelecionado, conteudo,
    (v) => { julgadoSelecionado = v; atualizarBotaoGerar(); }, extra);
  const radio = cartao.querySelector("input");
  radio.setAttribute("aria-labelledby", titulo.id); // nome curto; os dados vão como descrição
  radio.setAttribute("aria-describedby", meta.id);
  return cartao;
}

// Desenha filtradosJulgados até limiteJulgados. `reiniciar` refaz a lista; senão só acrescenta o que falta.
function desenharJulgados(reiniciar) {
  const lista = document.getElementById("lista-julgados");
  if (reiniciar) { lista.replaceChildren(); exibidosJulgados = 0; }
  if (filtradosJulgados.length === 0) {
    lista.textContent = MSG_SEM_JULGADOS_COMPLETOS;
  } else {
    const primeiroNovo = exibidosJulgados;
    for (const j of filtradosJulgados.slice(exibidosJulgados, limiteJulgados)) lista.appendChild(criarCartaoJulgado(j));
    exibidosJulgados = Math.min(limiteJulgados, filtradosJulgados.length);
    if (!reiniciar) {
      const novo = lista.querySelectorAll(".cartao-selecao")[primeiroNovo];
      if (novo) novo.querySelector("input").focus();
    }
  }
  const n = filtradosJulgados.length;
  document.getElementById("contador-julgados").textContent = n === 0 ? "" :
    `${n} julgado${n === 1 ? "" : "s"}` + (exibidosJulgados < n ? ` · mostrando ${exibidosJulgados}` : "");
  document.getElementById("mais-julgados").hidden = exibidosJulgados >= n;
  atualizarBotaoGerar();
}

function atualizarJulgados() {
  const area = document.getElementById("filtro-julgados-area").value;
  const base = todosJulgados.filter((j) => !area || j.area === area);
  const incompletos = base.filter((j) => !julgadoCompleto(j)).length;
  filtradosJulgados = (incluirIncompletos ? base : base.filter(julgadoCompleto)).sort(compararJulgados);
  limiteJulgados = JULGADOS_POR_PAGINA;
  if (!filtradosJulgados.some((j) => j.dedupe_hash === julgadoSelecionado)) julgadoSelecionado = null;

  const link = document.getElementById("mostrar-incompletos");
  link.hidden = incompletos === 0;
  link.textContent = incluirIncompletos
    ? "Ocultar julgados sem número ou data"
    : `Ver também julgados sem número ou data (${incompletos})`;
  desenharJulgados(true);
}

async function carregarJulgados() {
  const lista = document.getElementById("lista-julgados");
  const { data, error } = await supabaseClient
    .from("julgados_disponiveis")
    .select("dedupe_hash, area, assunto, resumo, orgao_julgador, data_julgamento, numero_julgado, data_captura")
    .order("data_julgamento", { ascending: false, nullsFirst: false })
    .order("data_captura", { ascending: false })
    .limit(200);
  if (error || !data) {
    lista.textContent = "Não foi possível carregar os julgados.";
    return;
  }
  if (data.length === 0) {
    lista.textContent = (areasAssinadasAtual || []).length === 0
      ? "Você precisa de uma assinatura ativa para ver os julgados."
      : MSG_SEM_JULGADOS_COMPLETOS;
    return;
  }
  todosJulgados = data.map((j, i) => ({ ...j, _i: i }));
  atualizarJulgados();
}

// ---- Passo 2: formatos ----
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
  atualizarBotaoGerar();
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

// ---- Roteiro renderizado como o cartão de exemplo da página de venda ----
// Rótulo em MAIÚSCULAS + ":" no início da linha, opcionalmente com um trecho entre parênteses
// (ex.: "REFERÊNCIA DO JULGADO (para legenda/conferência):"). Tolera **negrito** de markdown.
const RE_ROTULO = /^[\s*#>_-]*([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 ]{1,50}(?: \([^)\n]{1,60}\))?)\s*:\s*\**\s*(.*)$/;

function rotuloBonito(r) {
  return r.length <= 4 ? r : r.charAt(0) + r.slice(1).toLowerCase();
}

function parsearRoteiro(texto) {
  const secoes = [];
  let atual = null;
  let naReferencia = false; // dentro da referência nada mais é rótulo (ex.: "STJ: ...")
  for (const linha of String(texto || "").split(/\r?\n/)) {
    const m = naReferencia ? null : RE_ROTULO.exec(linha);
    if (m) {
      atual = { rotulo: m[1].trim(), corpo: m[2].trim(), referencia: /^REFER[EÊ]NCIA/.test(m[1]) };
      naReferencia = atual.referencia;
      secoes.push(atual);
    } else if (atual) {
      atual.corpo += "\n" + linha;
    } else if (linha.trim()) {
      atual = { rotulo: "", corpo: linha.trim(), referencia: false };
      secoes.push(atual);
    }
  }
  for (const s of secoes) s.corpo = s.corpo.trim();
  return secoes.some((s) => s.rotulo) ? secoes : [];
}

function corpoRoteiro(r) {
  const corpo = criarEl("div", "rot-texto", "");
  const secoes = parsearRoteiro(r.texto);
  if (secoes.length === 0) {
    corpo.appendChild(criarEl("p", "rot-bruto", r.texto || ""));
    return corpo;
  }
  if (r.cta && !String(r.texto).includes(r.cta)) secoes.push({ rotulo: "CTA", corpo: r.cta, referencia: false });
  for (const s of secoes) {
    const p = document.createElement("p");
    p.className = "rot-secao" + (s.referencia ? " rot-referencia" : "");
    if (s.rotulo) p.appendChild(criarEl("strong", "", rotuloBonito(s.rotulo) + "."));
    p.appendChild(document.createTextNode((s.rotulo ? " " : "") + s.corpo));
    corpo.appendChild(p);
  }
  return corpo;
}

function textoBruto(r) {
  return r.cta && !String(r.texto).includes(r.cta) ? `${r.texto}\n\n${r.cta}` : r.texto;
}

function botaoCopiar(rotulo, getTexto) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "botao-secundario";
  b.textContent = rotulo;
  let timer;
  b.addEventListener("click", async () => {
    let ok = true;
    try { await navigator.clipboard.writeText(getTexto()); } catch { ok = false; }
    b.textContent = ok ? "Copiado" : "Não foi possível copiar";
    clearTimeout(timer);
    timer = setTimeout(() => { b.textContent = rotulo; }, 2000);
  });
  return b;
}

// Resultado recém-gerado: anatomia do `.exemplo` da landing (cabeçalho + ficha + seções + referência).
function criarCartaoResultado(r) {
  const item = document.createElement("article");
  item.className = "rot-cartao";
  const cab = document.createElement("header");
  cab.appendChild(criarEl("h3", "", "Seu roteiro"));
  cab.appendChild(criarEl("span", "selo-formato", nomeFormato(r.tipo_slug)));
  item.appendChild(cab);

  const meta = document.createElement("dl");
  meta.className = "rot-meta";
  const num = r.numero_julgado && String(r.numero_julgado).trim();
  for (const [rotulo, valor] of [
    ["Área", r.area ? rotuloArea(r.area) : ""],
    ["Formato", nomeFormato(r.tipo_slug)],
    ["Assunto", r.assunto],
    ["Órgão julgador", r.orgao_julgador],
    ["Data do julgamento", formatarDataBR(r.data_julgamento)],
    ["Processo/recurso nº", num],
  ]) {
    const par = document.createElement("div");
    par.appendChild(criarEl("dt", "", rotulo));
    par.appendChild(criarEl("dd", "", valor || NAO_INFORMADO));
    meta.appendChild(par);
  }
  item.appendChild(meta);
  item.appendChild(corpoRoteiro(r));
  item.appendChild(criarEl("p", "roteiro-aviso-fidelidade", AVISO_FIDELIDADE));
  const acoes = criarEl("div", "roteiro-acoes", "");
  acoes.appendChild(botaoCopiar("Copiar roteiro", () => textoBruto(r)));
  item.appendChild(acoes);
  return item;
}

// ---- Meus roteiros gerados: cartão compacto, agrupado por período ----
let idCartaoGerado = 0;
function criarCartaoGerado(r) {
  const id = "gerado-corpo-" + (++idCartaoGerado);
  const item = document.createElement("article");
  item.className = "rot-cartao rot-compacto item-gerado";

  const cab = document.createElement("header");
  const chips = criarEl("div", "roteiro-chips", "");
  chips.appendChild(criarEl("span", "selo-formato", nomeFormato(r.tipo_slug)));
  if (r.area) chips.appendChild(criarEl("span", "chip-area", rotuloArea(r.area)));
  cab.appendChild(chips);
  cab.appendChild(criarEl("span", "roteiro-semana", "Gerado em " + formatarDataHoraBR(r.criado_em)));
  item.appendChild(cab);

  item.appendChild(criarEl("h4", "rot-assunto", r.assunto || "Assunto não informado"));
  item.appendChild(criarEl("p", "rot-linha-meta", linhaMeta(r)));

  const detalhe = document.createElement("div");
  detalhe.id = id;
  detalhe.hidden = true;
  detalhe.appendChild(corpoRoteiro(r));
  detalhe.appendChild(criarEl("p", "roteiro-aviso-fidelidade", AVISO_FIDELIDADE));
  item.appendChild(detalhe);

  const acoes = criarEl("div", "roteiro-acoes", "");
  const alternar = criarEl("button", "botao-secundario", "Ver roteiro");
  alternar.type = "button";
  alternar.setAttribute("aria-expanded", "false");
  alternar.setAttribute("aria-controls", id);
  alternar.addEventListener("click", () => {
    detalhe.hidden = !detalhe.hidden;
    alternar.setAttribute("aria-expanded", String(!detalhe.hidden));
    alternar.textContent = detalhe.hidden ? "Ver roteiro" : "Recolher";
  });
  acoes.appendChild(alternar);
  acoes.appendChild(botaoCopiar("Copiar", () => textoBruto(r)));
  item.appendChild(acoes);
  return item;
}

function diaSaoPaulo(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d); // yyyy-mm-dd
}

// Segunda-feira da semana de `hoje` (yyyy-mm-dd), sem fuso: só aritmética de calendário.
function inicioSemanaChave(hoje) {
  const [a, m, d] = hoje.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

function periodoDoRoteiro(r, hoje, semana) {
  const dia = diaSaoPaulo(r.criado_em);
  if (dia === hoje) return "Hoje";
  return dia && dia >= semana ? "Esta semana" : "Anteriores";
}

function preencherFiltroGerados(select, todos, valores, rotular) {
  const atual = select.value;
  select.replaceChildren(new Option(todos, ""));
  for (const v of valores) select.appendChild(new Option(rotular(v), v));
  select.value = [...select.options].some((o) => o.value === atual) ? atual : "";
}

function renderizarHistoricoGerados() {
  const lista = document.getElementById("lista-gerados");
  const barra = document.getElementById("filtros-gerados");
  const selFormato = document.getElementById("filtro-gerados-formato");
  const selArea = document.getElementById("filtro-gerados-area");
  lista.replaceChildren();
  barra.hidden = historicoGerados.length === 0;
  if (historicoGerados.length === 0) {
    lista.textContent = "Você ainda não gerou nenhum roteiro. Escolha um julgado e um formato em “Gerar roteiro” para começar; eles ficam guardados aqui.";
    return;
  }
  preencherFiltroGerados(selFormato, "Todos os formatos",
    [...new Set(historicoGerados.map((r) => r.tipo_slug))], nomeFormato);
  preencherFiltroGerados(selArea, "Todas as áreas",
    [...new Set(historicoGerados.map((r) => r.area).filter(Boolean))].sort(), rotuloArea);

  const filtrados = historicoGerados.filter((r) =>
    (!selFormato.value || r.tipo_slug === selFormato.value) && (!selArea.value || r.area === selArea.value));
  document.getElementById("contador-gerados").textContent =
    `${filtrados.length} roteiro${filtrados.length === 1 ? "" : "s"}`;
  if (filtrados.length === 0) {
    lista.textContent = "Nenhum roteiro com esses filtros.";
    return;
  }

  const hoje = diaSaoPaulo(new Date().toISOString());
  const semana = inicioSemanaChave(hoje);
  const grupos = new Map([["Hoje", []], ["Esta semana", []], ["Anteriores", []]]);
  for (const r of filtrados) grupos.get(periodoDoRoteiro(r, hoje, semana)).push(r);
  for (const [titulo, itens] of grupos) {
    if (itens.length === 0) continue;
    const grupo = criarEl("section", "grupo-gerados", "");
    grupo.appendChild(criarEl("h3", "grupo-gerados-titulo", `${titulo} · ${itens.length}`));
    for (const r of itens) grupo.appendChild(criarCartaoGerado(r));
    lista.appendChild(grupo);
  }
}

async function carregarHistoricoGerados() {
  const { data, error } = await supabaseClient
    .from("roteiros_usuario")
    .select("id, tipo_slug, area, assunto, orgao_julgador, data_julgamento, numero_julgado, texto, cta, criado_em")
    .order("criado_em", { ascending: false })
    .limit(LIMITE_HISTORICO);
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
  const julgado = julgadoEscolhido();

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

    // Campos do julgado que a resposta não trouxer vêm do julgado escolhido.
    const roteiro = { ...dados.roteiro };
    if (julgado) {
      for (const k of ["area", "assunto", "orgao_julgador", "data_julgamento", "numero_julgado"]) {
        if (roteiro[k] == null) roteiro[k] = julgado[k];
      }
    }
    if (!roteiro.tipo_slug) roteiro.tipo_slug = formatoSelecionado;
    if (!roteiro.criado_em) roteiro.criado_em = new Date().toISOString();

    const resultado = document.getElementById("resultado-gerar");
    resultado.replaceChildren(criarCartaoResultado(roteiro));
    resultado.hidden = false;
    resultado.focus({ preventScroll: true });
    resultado.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start",
    });

    historicoGerados = [roteiro, ...historicoGerados.filter((x) => x.id !== roteiro.id)].slice(0, LIMITE_HISTORICO);
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
  select.hidden = (areasAssinadasAtual || []).length < 2;
  select.addEventListener("change", atualizarJulgados);
  document.getElementById("mostrar-incompletos").addEventListener("click", () => {
    incluirIncompletos = !incluirIncompletos;
    atualizarJulgados();
  });
  document.getElementById("mais-julgados").addEventListener("click", () => {
    limiteJulgados += JULGADOS_POR_PAGINA;
    desenharJulgados(false);
  });
  document.getElementById("botao-gerar").addEventListener("click", gerarRoteiro);
  document.getElementById("filtro-gerados-formato").addEventListener("change", renderizarHistoricoGerados);
  document.getElementById("filtro-gerados-area").addEventListener("change", renderizarHistoricoGerados);
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

// Navegação lateral: visão "Painel" (todas as seções) e visão "Assinatura", alternadas por hash sem recarregar.
// Nas seções do painel, o item ativo acompanha a rolagem.
(function () {
  const visaoPainel = document.getElementById("visao-painel");
  const visaoAssinatura = document.getElementById("visao-assinatura");
  const links = Array.from(document.querySelectorAll(".lateral nav a[href^='#']"));
  const linksSecao = links.filter((a) => a.getAttribute("href") !== "#assinatura");
  const secoes = linksSecao.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if (!visaoPainel || !visaoAssinatura || !links.length) return;
  const emAssinatura = () => location.hash === "#assinatura" || location.hash === "#secao-assinatura";

  function marcar(href) {
    links.forEach((a) => {
      const ativo = a.getAttribute("href") === href;
      a.classList.toggle("ativo", ativo);
      if (ativo) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }
  function aplicarVisao(rolar) {
    const ass = emAssinatura();
    visaoPainel.hidden = ass;
    visaoAssinatura.hidden = !ass;
    if (ass) {
      marcar("#assinatura");
      if (rolar) window.scrollTo({ top: 0, behavior: "instant" });
    } else if (rolar) {
      const alvo = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
      if (alvo) alvo.scrollIntoView(); else window.scrollTo({ top: 0, behavior: "instant" });
      if (alvo && linksSecao.some((a) => a.getAttribute("href") === location.hash)) marcar(location.hash);
    }
  }
  window.addEventListener("hashchange", () => aplicarVisao(true));
  aplicarVisao(false);
  if (!secoes.length) return;
  if (!emAssinatura()) marcar("#" + secoes[0].id);
  if (!("IntersectionObserver" in window)) return;
  const marcarSecao = (s) => { if (!emAssinatura()) marcar("#" + s.id); };
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) marcarSecao(e.target); });
  }, { rootMargin: "-25% 0px -65% 0px" });
  secoes.forEach((s) => io.observe(s));
  window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) marcarSecao(secoes[secoes.length - 1]);
  }, { passive: true });
})();
