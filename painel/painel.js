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

iniciar().then(() => {
  if (advogadoAtual) {
    carregarRoteiros();
    carregarDetalhesAssinatura();
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
