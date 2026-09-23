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

function criarEl(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  el.textContent = texto;
  return el;
}

// Plano derivado da quantidade de áreas: 1 = Básico, 2–9 = Intermediário, 10 = Completo.
const NOMES_PLANO = { 1: "Básico", 2: "Intermediário", 3: "Completo" };
function nivelUsuario() {
  const n = (areasAssinadasAtual || []).length;
  return n >= 10 ? 3 : n >= 2 ? 2 : 1;
}

// Indicador: número grande + complemento em texto menor (sempre textContent).
function definirIndicador(id, numero, complemento) {
  const dd = document.getElementById(id);
  dd.replaceChildren(criarEl("span", "indicador-numero", String(numero)));
  if (complemento) dd.appendChild(document.createTextNode(" " + complemento));
}

function saudacaoHora() {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite";
}

// ---------- Avatar (bucket privado "avatares", pasta <uid>/) ----------
let avatarUrl = null;
const CAMINHO_AVATAR = () => `${sessaoAtual.user.id}/avatar.jpg`;

function iniciais(nome) {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  return ((p[0] || "")[0] || "") + (p.length > 1 ? p[p.length - 1][0] : "");
}

function pintarAvatares() {
  for (const id of ["avatar-topo", "avatar-perfil"]) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (avatarUrl) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = avatarUrl;
      img.addEventListener("error", () => { avatarUrl = null; pintarAvatares(); }, { once: true });
      el.replaceChildren(img);
    } else {
      el.replaceChildren(criarEl("span", "avatar-iniciais", iniciais(advogadoAtual && advogadoAtual.nome).toUpperCase()));
    }
  }
  const rem = document.getElementById("botao-remover-foto");
  if (rem) rem.hidden = !avatarUrl;
}

async function carregarAvatar() {
  const msg = document.getElementById("mensagem-foto");
  try {
    const { data, error } = await supabaseClient.storage.from("avatares").createSignedUrl(CAMINHO_AVATAR(), 3600);
    if (error || !data || !data.signedUrl) {
      avatarUrl = null;
      if (error && !/not.?found|does not exist/i.test(error.message || "")) msg.textContent = "Não foi possível carregar sua foto agora. Suas iniciais aparecem no lugar.";
    } else {
      avatarUrl = data.signedUrl;
    }
  } catch {
    avatarUrl = null;
  }
  pintarAvatares();
}

// Recorte quadrado central, 256x256 JPEG (< 512 KB).
function prepararFoto(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 256, 256);
      ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 256, 256);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("imagem")); };
    img.src = url;
  });
}

function configurarPerfil() {
  const msg = document.getElementById("mensagem-foto");
  const entrada = document.getElementById("arquivo-foto");
  const botao = document.getElementById("botao-foto");
  const remover = document.getElementById("botao-remover-foto");
  botao.addEventListener("click", () => entrada.click());
  entrada.addEventListener("change", async () => {
    const arq = entrada.files[0];
    entrada.value = "";
    if (!arq) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(arq.type)) { msg.textContent = "Formato não aceito. Use uma imagem JPEG, PNG ou WEBP."; return; }
    if (arq.size > 5 * 1024 * 1024) { msg.textContent = "A imagem é grande demais. Escolha uma de até 5 MB."; return; }
    botao.disabled = remover.disabled = true;
    msg.textContent = "Enviando foto...";
    try {
      const blob = await prepararFoto(arq);
      const { error } = await supabaseClient.storage.from("avatares")
        .upload(CAMINHO_AVATAR(), blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      msg.textContent = "Foto atualizada.";
      await carregarAvatar();
    } catch {
      msg.textContent = "Não foi possível enviar a foto agora. Tente de novo em instantes.";
    } finally {
      botao.disabled = remover.disabled = false;
    }
  });
  remover.addEventListener("click", async () => {
    botao.disabled = remover.disabled = true;
    const { error } = await supabaseClient.storage.from("avatares").remove([CAMINHO_AVATAR()]);
    botao.disabled = remover.disabled = false;
    if (error) { msg.textContent = "Não foi possível remover a foto agora."; return; }
    avatarUrl = null;
    msg.textContent = "Foto removida.";
    pintarAvatares();
  });
}

async function carregarDadosPerfil() {
  const dado = (id, v) => { document.getElementById(id).textContent = v || "—"; };
  dado("dado-nome", advogadoAtual.nome);
  dado("dado-oab", `OAB/${advogadoAtual.oab_uf} ${advogadoAtual.oab_numero}`);
  dado("dado-email", sessaoAtual.user.email);
  dado("dado-plano", areasAssinadasAtual.length
    ? `Plano ${NOMES_PLANO[nivelUsuario()]}: ${areasAssinadasAtual.map(rotuloArea).join(", ")}` : "Nenhuma assinatura ativa");
  // email/telefone da tabela advogados (RLS própria); se a leitura falhar, mantém o e-mail da sessão.
  const { data } = await supabaseClient.from("advogados").select("email, telefone").maybeSingle();
  if (data) { if (data.email) dado("dado-email", data.email); dado("dado-telefone", data.telefone); }
}

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
  document.getElementById("saudacao").textContent = `${saudacaoHora()}, ${advogado.nome.trim().split(/\s+/)[0]}`;
  document.getElementById("acolhimento").hidden = false;
  pintarAvatares();
  document.getElementById("nome-advogado").textContent = advogado.nome;
  document.getElementById("oab-advogado").textContent = `OAB/${advogado.oab_uf} ${advogado.oab_numero}`;

  const { data: assinatura } = await supabaseClient
    .from("assinaturas")
    .select("areas, status, valor_mensal_centavos, acesso_valido_ate")
    .in("status", ["ativa", "cancelamento_agendado"])
    .maybeSingle();

  const status = document.getElementById("status-assinatura");
  if (!assinatura) {
    status.textContent = "Nenhuma assinatura ativa. Seus roteiros ficam indisponíveis até reativar.";
    return;
  }

  areasAssinadasAtual = assinatura.areas;
  const plano = document.getElementById("plano-advogado");
  plano.textContent = "Plano " + NOMES_PLANO[nivelUsuario()];
  plano.hidden = false;
  const chips = document.getElementById("areas-advogado");
  for (const a of assinatura.areas) {
    const li = document.createElement("li");
    li.appendChild(criarEl("span", "chip-area", rotuloArea(a)));
    chips.appendChild(li);
  }
  if (assinatura.status === "cancelamento_agendado") {
    status.textContent = `Assinatura cancelada. Acesso liberado até ${formatarDataBR(assinatura.acesso_valido_ate) || assinatura.acesso_valido_ate}.`;
  }
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

// "2026-W38" -> {inicio: segunda, fim: domingo} daquela semana ISO (UTC, sem depender de fuso do navegador).
function intervaloDaSemanaIso(semanaIso) {
  const m = /^(\d{4})-W(\d{2})$/.exec(semanaIso || "");
  if (!m) return null;
  const ano = Number(m[1]), semana = Number(m[2]);
  const d4 = new Date(Date.UTC(ano, 0, 4)); // 4 de janeiro sempre cai na semana ISO 1
  const diaSemanaD4 = d4.getUTCDay() || 7;
  const segundaSemana1 = new Date(d4); segundaSemana1.setUTCDate(d4.getUTCDate() - diaSemanaD4 + 1);
  const inicio = new Date(segundaSemana1); inicio.setUTCDate(segundaSemana1.getUTCDate() + (semana - 1) * 7);
  const fim = new Date(inicio); fim.setUTCDate(inicio.getUTCDate() + 6);
  return { inicio, fim };
}

function formatarPeriodoTrends(semanaIso) {
  const intervalo = intervaloDaSemanaIso(semanaIso);
  if (!intervalo) return "";
  const dd = (d) => String(d.getUTCDate()).padStart(2, "0");
  const mm = (d) => String(d.getUTCMonth() + 1).padStart(2, "0");
  const { inicio, fim } = intervalo;
  return inicio.getUTCFullYear() === fim.getUTCFullYear()
    ? `Período: ${dd(inicio)}/${mm(inicio)} a ${dd(fim)}/${mm(fim)}/${fim.getUTCFullYear()}`
    : `Período: ${dd(inicio)}/${mm(inicio)}/${inicio.getUTCFullYear()} a ${dd(fim)}/${mm(fim)}/${fim.getUTCFullYear()}`;
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

// ---------- Tendências: assuntos jurídicos mais pesquisados no Google na semana, por área ----------
let areasEmAltaSemanaAtual = new Set();

let semanaTrendsCarregada = null; // semana efetivamente exibida (pode ser a última disponível, não a atual)

async function carregarTendencias() {
  const container = document.getElementById("lista-trends");
  // Mostra sempre algo: usa a semana atual se já tiver dados; senão cai para a última semana disponível
  // (a coleta é semanal, às sextas — sem isso a seção fica vazia entre a virada da semana e a próxima coleta).
  let semana = semanaIsoAtual();
  const { data: existeAtual } = await supabaseClient
    .from("trends_semanais").select("semana_iso").eq("semana_iso", semana).limit(1);
  if (!existeAtual || existeAtual.length === 0) {
    const { data: ultima } = await supabaseClient
      .from("trends_semanais").select("semana_iso").order("semana_iso", { ascending: false }).limit(1);
    if (ultima && ultima.length > 0) semana = ultima[0].semana_iso;
  }
  semanaTrendsCarregada = semana;
  const notaFrescor = document.getElementById("trends-frescor");
  if (notaFrescor) notaFrescor.textContent = formatarPeriodoTrends(semana);
  const { data } = await supabaseClient
    .from("trends_semanais")
    .select("area, termo, posicao")
    .eq("semana_iso", semana)
    .order("posicao", { ascending: true });
  const trends = data || [];
  areasEmAltaSemanaAtual = new Set(trends.map((t) => t.area));
  container.replaceChildren();

  for (const area of areasAssinadasAtual || []) {
    const termos = trends.filter((t) => t.area === area).sort((a, b) => a.posicao - b.posicao).slice(0, 5);
    if (termos.length === 0) continue;
    const grupo = document.createElement("article");
    grupo.className = "grupo-trends";
    grupo.appendChild(criarEl("h3", "", rotuloArea(area)));
    const lista = document.createElement("ol");
    termos.forEach((t, i) => {
      const li = document.createElement("li");
      li.appendChild(criarEl("span", "trend-posicao", String(i + 1)));
      li.appendChild(criarEl("span", "trend-termo", t.termo));
      if (i === 0) li.appendChild(criarEl("span", "selo-alta", "Em alta"));
      lista.appendChild(li);
    });
    grupo.appendChild(lista);
    container.appendChild(grupo);
  }
  if (!container.hasChildNodes()) {
    container.textContent = "Os assuntos em alta desta semana aparecem aqui assim que forem atualizados (toda sexta).";
  }
}

// ---------- Meus roteiros › Prontos da semana (roteiros_gerados), no mesmo formato compacto ----------
const PRONTOS_POR_PAGINA = 6;
let prontos = [];
let gravadosPorRoteiro = new Set();
let limiteProntos = PRONTOS_POR_PAGINA;
let idCartaoPronto = 0;

function criarCartaoPronto(r) {
  const id = "pronto-corpo-" + (++idCartaoPronto);
  const item = document.createElement("article");
  item.className = "rot-cartao rot-compacto item-gerado";

  const cab = document.createElement("header");
  const chips = criarEl("div", "roteiro-chips", "");
  chips.appendChild(criarEl("span", "chip-area", rotuloArea(r.area)));
  if (areasEmAltaSemanaAtual.has(r.area) && r.semana_iso === semanaTrendsCarregada) chips.appendChild(criarEl("span", "selo-alta", "Em alta"));
  if (r.tom) chips.appendChild(criarEl("span", "chip-tom", rotuloTom(r.tom)));
  cab.appendChild(chips);
  cab.appendChild(criarEl("span", "roteiro-semana", `Semana ${r.semana_iso}`));
  item.appendChild(cab);

  item.appendChild(criarEl("h4", "rot-assunto", r.assunto || "Assunto não informado"));
  item.appendChild(criarEl("p", "rot-linha-meta", `${r.orgao_julgador || "—"} · Julgado em ${formatarDataBR(r.data_julgamento) || "—"}`));

  const detalhe = document.createElement("div");
  detalhe.id = id;
  detalhe.hidden = true;
  const dado = { texto: r.texto_completo, cta: r.cta };
  detalhe.appendChild(corpoRoteiro(dado));
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
  acoes.appendChild(botaoCopiar("Copiar", () => textoBruto(dado)));

  const rotuloGravado = document.createElement("label");
  rotuloGravado.className = "marcar-gravado";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = gravadosPorRoteiro.has(r.id);
  cb.addEventListener("change", async () => {
    const novo = cb.checked;
    const { error } = await supabaseClient.from("roteiros_progresso").upsert({
      advogado_id: advogadoAtual.id, roteiro_id: r.id, gravado: novo, marcado_em: new Date().toISOString(),
    }, { onConflict: "advogado_id,roteiro_id" });
    if (error) { cb.checked = !novo; alert("Não foi possível salvar. Tente novamente."); return; }
    if (novo) gravadosPorRoteiro.add(r.id); else gravadosPorRoteiro.delete(r.id);
  });
  rotuloGravado.appendChild(cb);
  rotuloGravado.appendChild(document.createTextNode(" Já gravei"));
  acoes.appendChild(rotuloGravado);
  item.appendChild(acoes);
  return item;
}

function renderizarProntos() {
  const lista = document.getElementById("lista-prontos");
  lista.replaceChildren();
  const grupo = criarEl("section", "grupo-gerados", "");
  for (const r of prontos.slice(0, limiteProntos)) grupo.appendChild(criarCartaoPronto(r));
  lista.appendChild(grupo);
  document.getElementById("mais-prontos").hidden = limiteProntos >= prontos.length;
}

async function carregarProntos() {
  const { data, error } = await supabaseClient
    .from("roteiros_gerados")
    .select("id, area, semana_iso, tom, cta, texto_completo, assunto, orgao_julgador, data_julgamento")
    .order("semana_iso", { ascending: false });
  if (error || !data || data.length === 0) return;
  const { data: progresso } = await supabaseClient.from("roteiros_progresso").select("roteiro_id, gravado");
  gravadosPorRoteiro = new Set((progresso || []).filter((p) => p.gravado).map((p) => p.roteiro_id));
  prontos = data;
  renderizarProntos();
  document.querySelector(".abas").hidden = false;
}

function configurarAbas() {
  const abas = [...document.querySelectorAll(".abas [role=tab]")];
  const selecionar = (aba, focar) => {
    for (const a of abas) {
      const ativa = a === aba;
      a.setAttribute("aria-selected", String(ativa));
      a.tabIndex = ativa ? 0 : -1;
      document.getElementById(a.getAttribute("aria-controls")).hidden = !ativa;
    }
    if (focar) aba.focus();
  };
  for (const a of abas) {
    a.addEventListener("click", () => selecionar(a, false));
    a.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      selecionar(abas[(abas.indexOf(a) + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length], true);
    });
  }
  document.getElementById("mais-prontos").addEventListener("click", () => {
    limiteProntos += PRONTOS_POR_PAGINA;
    renderizarProntos();
  });
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
    (assinatura.forma_pagamento === "cartao_credito" ? "Cartão de crédito" : "Pix");

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

function botaoCopiar(rotulo, getTexto, classe) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = classe || "botao-secundario";
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


// ---------- Uso mensal ----------
const GERAR_ROTEIRO_URL = SUPABASE_URL + "/functions/v1/gerar-roteiro";
const LIMITE_PADRAO = 30;
const LIMITE_MUITAS_AREAS = 100;
const LIMITE_HISTORICO = 100;
const AVISO_FIDELIDADE = "Roteiro baseado apenas no resumo do julgado. Confira o julgado original antes de publicar.";
const NAO_INFORMADO = "Não informado pela fonte";

let tiposRoteiro = [];
let usoMes = { usados: null, limite: LIMITE_PADRAO };
let historicoGerados = [];

function limiteMensal() {
  return (areasAssinadasAtual || []).length >= 10 ? LIMITE_MUITAS_AREAS : LIMITE_PADRAO;
}
function esgotada() { return usoMes.usados !== null && usoMes.usados >= usoMes.limite; }

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

function atualizarContador() {
  const { usados, limite } = usoMes;
  definirIndicador("ind-usados", usados === null ? "—" : usados, `de ${limite} usados`);
  definirIndicador("ind-restam", usados === null ? "—" : Math.max(0, limite - usados), "");
  if (aberto && aberto.atualizarUI) aberto.atualizarUI();
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

// Julgados captados nesta semana (segunda a domingo, America/Sao_Paulo), contagem real da view.
async function carregarSemana() {
  const inicio = `${inicioSemanaChave(diaSaoPaulo(new Date().toISOString()))}T00:00:00-03:00`;
  const { count, error } = await supabaseClient
    .from("julgados_disponiveis")
    .select("dedupe_hash", { count: "exact", head: true })
    .gte("data_captura", inicio);
  definirIndicador("ind-semana", error || count === null ? "—" : count, "");
}

// ---------- Formatos (nivel_minimo: 1 = Básico, 2 = Intermediário, 3 = Completo) ----------
async function carregarFormatos() {
  const { data } = await supabaseClient
    .from("tipos_roteiro_publico")
    .select("slug, nome, descricao, ordem, nivel_minimo")
    .order("ordem", { ascending: true });
  tiposRoteiro = data || [];
}

function dicaPlano(nivel) {
  return nivel >= 3 ? "Disponível no plano Completo" : "Disponível no plano Intermediário ou Completo";
}

// Cartão selecionável (rádio nativo: teclado e leitor de tela de graça).
function cartaoRadio(nome, valor, marcado, conteudo, aoMarcar, bloqueado) {
  const cartao = document.createElement("div");
  cartao.className = "cartao-selecao" + (bloqueado ? " bloqueado" : "");
  const rotulo = document.createElement("label");
  rotulo.className = "cartao-selecao-corpo";
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = nome;
  radio.value = valor;
  radio.checked = marcado;
  radio.disabled = !!bloqueado;
  radio.addEventListener("change", () => { if (radio.checked) aoMarcar(valor); });
  rotulo.appendChild(radio);
  rotulo.appendChild(conteudo);
  cartao.appendChild(rotulo);
  return cartao;
}

// ---------- Roteiros sugeridos: cartões de julgados (filtro de área, incompletos opcionais, paginação no cliente) ----------
const JULGADOS_POR_PAGINA = 6;
const MSG_SEM_JULGADOS_COMPLETOS =
  "Ainda não há julgados confirmados (com número e data) nas suas áreas. Novos julgados chegam toda semana.";
let todosJulgados = [];
let filtradosJulgados = [];
let exibidosJulgados = 0;
let limiteJulgados = JULGADOS_POR_PAGINA;
let incluirIncompletos = false;
let areaFiltro = "";
let aberto = null; // { hash, formato, erro, gerando, resultado, atualizarUI }
const cartoes = new Map(); // dedupe_hash -> elemento

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

// Ficha em grade (mesma anatomia do exemplo da página de venda).
function fichaRoteiro(itens) {
  const dl = document.createElement("dl");
  dl.className = "rot-meta";
  for (const [rotulo, valor, cheio] of itens) {
    const par = document.createElement("div");
    if (cheio) par.className = "cheio";
    par.appendChild(criarEl("dt", "", rotulo));
    par.appendChild(criarEl("dd", "", valor || NAO_INFORMADO));
    dl.appendChild(par);
  }
  return dl;
}

function fichaJulgado(j) {
  const num = j.numero_julgado && String(j.numero_julgado).trim();
  return fichaRoteiro([
    ["Assunto", j.assunto, true],
    ["Área", rotuloArea(j.area)],
    ["Órgão julgador", j.orgao_julgador],
    ["Data do julgamento", formatarDataBR(j.data_julgamento)],
    ["Processo/recurso nº", num],
  ]);
}

function julgadoPorHash(h) { return todosJulgados.find((j) => j.dedupe_hash === h); }

function montarCartao(j) {
  const est = aberto && aberto.hash === j.dedupe_hash ? aberto : null;
  const card = document.createElement("article");
  card.className = "rot-cartao julgado-card" + (est ? " aberto" : "");
  card.dataset.hash = j.dedupe_hash;

  if (est && est.resultado) { montarResultado(card, j, est); return card; }

  card.appendChild(fichaJulgado(j));
  if (j.resumo) {
    const det = document.createElement("details");
    det.className = "explicacao";
    det.appendChild(criarEl("summary", "", "Ver explicação"));
    det.appendChild(criarEl("p", "", j.resumo));
    card.appendChild(det);
  }
  if (est) {
    card.appendChild(painelFormatos(j, est));
  } else {
    const acoes = criarEl("div", "roteiro-acoes", "");
    const b = criarEl("button", "botao-primario", "Gerar roteiro");
    b.type = "button";
    b.setAttribute("aria-label", "Gerar roteiro: " + (j.assunto || "julgado sem assunto informado"));
    b.addEventListener("click", () => abrirCartao(j));
    acoes.appendChild(b);
    card.appendChild(acoes);
  }
  return card;
}

// Troca o cartão no lugar; `foco` = "painel" | "resultado" | "botao" (só quando a ação veio do usuário).
function substituirCartao(hash, foco) {
  const velho = cartoes.get(hash);
  const j = julgadoPorHash(hash);
  if (!velho || !j) return;
  const novo = montarCartao(j);
  velho.replaceWith(novo);
  cartoes.set(hash, novo);
  if (!foco) return;
  const alvo = foco === "painel" ? novo.querySelector(".gerador")
    : foco === "resultado" ? novo.querySelector(".resultado-titulo")
    : novo.querySelector(".botao-primario");
  if (alvo) {
    alvo.focus({ preventScroll: true });
    novo.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
}

function abrirCartao(j) {
  if (aberto && aberto.gerando) return;
  const anterior = aberto && aberto.hash;
  aberto = { hash: j.dedupe_hash, formato: null, erro: "", gerando: false, resultado: null, atualizarUI: null };
  if (anterior) substituirCartao(anterior);
  substituirCartao(j.dedupe_hash, "painel");
}

function fecharCartao() {
  if (!aberto || aberto.gerando) return;
  const h = aberto.hash;
  aberto = null;
  substituirCartao(h, "botao");
}

function painelFormatos(j, est) {
  const painel = criarEl("div", "gerador", "");
  painel.tabIndex = -1;
  painel.setAttribute("role", "group");
  const titulo = criarEl("h4", "", "Escolha o formato");
  titulo.id = "gerador-titulo-" + j._i;
  painel.setAttribute("aria-labelledby", titulo.id);
  painel.appendChild(titulo);

  const nivel = nivelUsuario();
  const lista = criarEl("div", "grade-formatos", "");
  lista.setAttribute("role", "radiogroup");
  lista.setAttribute("aria-labelledby", titulo.id);
  if (tiposRoteiro.length === 0) lista.textContent = "Nenhum formato disponível no momento.";
  for (const t of tiposRoteiro) {
    const minimo = t.nivel_minimo || 1;
    const bloqueado = minimo > nivel;
    const conteudo = criarEl("span", "cartao-conteudo", "");
    conteudo.appendChild(criarEl("span", "cartao-titulo", t.nome));
    if (t.descricao) conteudo.appendChild(criarEl("span", "cartao-meta", t.descricao));
    let dica = null;
    if (bloqueado) {
      dica = criarEl("span", "cartao-bloqueio", dicaPlano(minimo));
      dica.id = `bloq-${j._i}-${t.slug}`;
      conteudo.appendChild(dica);
    }
    const cartao = cartaoRadio("formato-" + j._i, t.slug, est.formato === t.slug, conteudo, (v) => {
      est.formato = v;
      est.erro = "";
      est.atualizarUI();
    }, bloqueado);
    if (dica) cartao.querySelector("input").setAttribute("aria-describedby", dica.id);
    lista.appendChild(cartao);
  }
  painel.appendChild(lista);

  const aviso = criarEl("p", "mensagem erro", "");
  aviso.setAttribute("role", "alert");
  painel.appendChild(aviso);

  const barra = criarEl("div", "gerador-acoes", "");
  const botao = criarEl("button", "botao-primario", "Gerar");
  botao.type = "button";
  const cancelar = criarEl("button", "botao-secundario", "Cancelar");
  cancelar.type = "button";
  const dicaBarra = criarEl("p", "dica-gerar", "");
  botao.setAttribute("aria-describedby", "dica-" + j._i);
  dicaBarra.id = "dica-" + j._i;
  barra.append(botao, cancelar, dicaBarra);
  painel.appendChild(barra);

  est.atualizarUI = () => {
    aviso.textContent = est.erro || "";
    let msg = "";
    if (est.gerando) msg = "Gerando… leva alguns segundos.";
    else if (esgotada()) msg = "Você usou todos os roteiros deste mês. O contador zera no dia 1º.";
    else if (!est.formato) msg = "Escolha um formato para continuar.";
    dicaBarra.textContent = msg;
    botao.disabled = est.gerando || esgotada() || !est.formato;
    cancelar.disabled = est.gerando;
    botao.textContent = est.gerando ? "Gerando…" : "Gerar";
    botao.setAttribute("aria-busy", est.gerando ? "true" : "false");
  };
  botao.addEventListener("click", () => gerarRoteiro(j, est));
  cancelar.addEventListener("click", fecharCartao);
  est.atualizarUI();
  return painel;
}

// Desenha filtradosJulgados até limiteJulgados. `reiniciar` refaz a lista; senão só acrescenta o que falta.
function desenharJulgados(reiniciar) {
  const lista = document.getElementById("lista-julgados");
  if (reiniciar) { lista.replaceChildren(); cartoes.clear(); exibidosJulgados = 0; }
  if (filtradosJulgados.length === 0) {
    lista.textContent = MSG_SEM_JULGADOS_COMPLETOS;
  } else {
    const primeiroNovo = exibidosJulgados;
    for (const j of filtradosJulgados.slice(exibidosJulgados, limiteJulgados)) {
      const c = montarCartao(j);
      cartoes.set(j.dedupe_hash, c);
      lista.appendChild(c);
    }
    exibidosJulgados = Math.min(limiteJulgados, filtradosJulgados.length);
    if (!reiniciar) {
      const novo = lista.querySelectorAll(".julgado-card")[primeiroNovo];
      const b = novo && novo.querySelector("button, summary");
      if (b) b.focus();
    }
  }
  const n = filtradosJulgados.length;
  document.getElementById("contador-julgados").textContent = n === 0 ? "" :
    `${n} julgado${n === 1 ? "" : "s"}` + (exibidosJulgados < n ? ` · mostrando ${exibidosJulgados}` : "");
  document.getElementById("mais-julgados").hidden = exibidosJulgados >= n;
}

function atualizarJulgados() {
  const base = todosJulgados.filter((j) => !areaFiltro || j.area === areaFiltro);
  const incompletos = base.filter((j) => !julgadoCompleto(j)).length;
  filtradosJulgados = (incluirIncompletos ? base : base.filter(julgadoCompleto)).sort(compararJulgados);
  limiteJulgados = JULGADOS_POR_PAGINA;
  if (aberto && !aberto.gerando && !filtradosJulgados.some((j) => j.dedupe_hash === aberto.hash)) aberto = null;

  const link = document.getElementById("mostrar-incompletos");
  link.hidden = incompletos === 0;
  link.textContent = incluirIncompletos
    ? "Ocultar julgados sem número ou data"
    : `Ver também julgados sem número ou data (${incompletos})`;
  desenharJulgados(true);
}

function montarFiltroArea() {
  const barra = document.getElementById("filtro-julgados-area");
  const areas = areasAssinadasAtual || [];
  barra.hidden = areas.length < 2;
  if (areas.length < 2) return;
  for (const [valor, rotulo] of [["", "Todas"], ...areas.map((a) => [a, rotuloArea(a)])]) {
    const b = criarEl("button", "chip-filtro", rotulo);
    b.type = "button";
    b.setAttribute("aria-pressed", String(valor === areaFiltro));
    b.addEventListener("click", () => {
      areaFiltro = valor;
      for (const x of barra.children) x.setAttribute("aria-pressed", String(x === b));
      atualizarJulgados();
    });
    barra.appendChild(b);
  }
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

// Resultado dentro do próprio cartão: anatomia do `.exemplo` da landing (cabeçalho + ficha + seções + referência).
function montarResultado(card, j, est) {
  const r = est.resultado;
  const cab = document.createElement("header");
  const titulo = criarEl("h3", "resultado-titulo", "Seu roteiro");
  titulo.tabIndex = -1;
  cab.appendChild(titulo);
  cab.appendChild(criarEl("span", "selo-formato", nomeFormato(r.tipo_slug)));
  card.appendChild(cab);

  const num = r.numero_julgado && String(r.numero_julgado).trim();
  card.appendChild(fichaRoteiro([
    ["Área", r.area ? rotuloArea(r.area) : ""],
    ["Formato", nomeFormato(r.tipo_slug)],
    ["Assunto", r.assunto],
    ["Órgão julgador", r.orgao_julgador],
    ["Data do julgamento", formatarDataBR(r.data_julgamento)],
    ["Processo/recurso nº", num],
  ]));
  card.appendChild(corpoRoteiro(r));
  card.appendChild(criarEl("p", "roteiro-aviso-fidelidade", AVISO_FIDELIDADE));

  const acoes = criarEl("div", "roteiro-acoes", "");
  acoes.appendChild(botaoCopiar("Copiar roteiro", () => textoBruto(r), "botao-primario"));
  const outro = criarEl("button", "botao-secundario", "Gerar em outro formato");
  outro.type = "button";
  outro.addEventListener("click", () => {
    est.resultado = null; est.formato = null; est.erro = "";
    substituirCartao(j.dedupe_hash, "painel");
  });
  const fechar = criarEl("button", "botao-secundario", "Fechar");
  fechar.type = "button";
  fechar.addEventListener("click", fecharCartao);
  const ver = criarEl("a", "botao-secundario botao-link", "Ver em Meus roteiros");
  ver.href = "#meus-roteiros";
  acoes.append(outro, ver, fechar);
  card.appendChild(acoes);
}

// ---- Meus roteiros › Gerados por mim: cartão compacto, agrupado por período ----
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

function renderizarHistoricoGerados() {
  const lista = document.getElementById("lista-gerados");
  const barra = document.getElementById("filtros-gerados");
  const selFormato = document.getElementById("filtro-gerados-formato");
  const selArea = document.getElementById("filtro-gerados-area");
  lista.replaceChildren();
  barra.hidden = historicoGerados.length === 0;
  if (historicoGerados.length === 0) {
    lista.textContent = "Você ainda não gerou nenhum roteiro. Use “Gerar roteiro” em um dos julgados sugeridos; eles ficam guardados aqui.";
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

function mensagemErroGerar(status, dados) {
  if (typeof dados.erro === "string" && dados.erro) return dados.erro;
  return {
    403: "Este formato não está disponível no seu plano.",
    422: "Não foi possível gerar o roteiro para este julgado. Tente outro formato ou outro julgado.",
    429: "Você atingiu o limite de roteiros deste mês.",
    502: "O serviço de geração está indisponível agora. Tente de novo em instantes.",
  }[status] || "Não foi possível gerar o roteiro agora. Tente de novo em instantes; se persistir, recarregue a página.";
}

async function gerarRoteiro(j, est) {
  if (est.gerando || !est.formato || esgotada()) return;
  est.gerando = true;
  est.erro = "";
  est.atualizarUI();
  const formato = est.formato;
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
        body: JSON.stringify({ dedupe_hash: j.dedupe_hash, tipo_slug: formato }),
      });
    } catch {
      est.erro = "Não foi possível concluir o pedido. Verifique sua conexão e tente de novo.";
      return;
    }
    const dados = await resposta.json().catch(() => ({}));

    if (resposta.status === 401) {
      await supabaseClient.auth.signOut();
      window.location.href = "login.html";
      return;
    }
    if (!resposta.ok || !dados.roteiro) {
      est.erro = mensagemErroGerar(resposta.status, dados);
      if (dados.uso && Number.isFinite(dados.uso.usados)) {
        usoMes = { usados: dados.uso.usados, limite: dados.uso.limite || usoMes.limite };
      }
      return;
    }

    // Campos do julgado que a resposta não trouxer vêm do julgado escolhido.
    const roteiro = { ...dados.roteiro };
    for (const k of ["area", "assunto", "orgao_julgador", "data_julgamento", "numero_julgado"]) {
      if (roteiro[k] == null) roteiro[k] = j[k];
    }
    if (!roteiro.tipo_slug) roteiro.tipo_slug = formato;
    if (!roteiro.criado_em) roteiro.criado_em = new Date().toISOString();
    est.resultado = roteiro;

    historicoGerados = [roteiro, ...historicoGerados.filter((x) => x.id !== roteiro.id)].slice(0, LIMITE_HISTORICO);
    renderizarHistoricoGerados();
    if (dados.uso && Number.isFinite(dados.uso.usados)) {
      usoMes = { usados: dados.uso.usados, limite: dados.uso.limite || usoMes.limite };
    } else if (usoMes.usados !== null) {
      usoMes.usados += 1;
    }
  } finally {
    est.gerando = false;
    if (aberto === est) {
      if (est.resultado) substituirCartao(j.dedupe_hash, "resultado");
      else est.atualizarUI();
    }
    atualizarContador();
  }
}

// ---------- Estúdio Astra (aulas_estudio) ----------
const ID_YOUTUBE = /^[A-Za-z0-9_-]{6,20}$/;

function criarCartaoAula(a) {
  const card = criarEl("article", "aula-cartao", "");
  card.appendChild(criarEl("h4", "aula-titulo", a.titulo));
  if (a.descricao) card.appendChild(criarEl("p", "aula-descricao", a.descricao));
  const rodape = criarEl("div", "aula-rodape", "");
  if (a.duracao_min) rodape.appendChild(criarEl("span", "aula-duracao", `${a.duracao_min} min`));
  if (a.video_youtube_id && ID_YOUTUBE.test(a.video_youtube_id)) {
    const btn = criarEl("button", "botao-secundario aula-assistir", "Assistir");
    btn.type = "button";
    btn.setAttribute("aria-label", `Assistir: ${a.titulo}`);
    btn.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${a.video_youtube_id}`;
      iframe.title = `Vídeo: ${a.titulo}`;
      iframe.loading = "lazy";
      iframe.allowFullscreen = true;
      iframe.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      const quadro = criarEl("div", "aula-video", "");
      quadro.appendChild(iframe);
      card.insertBefore(quadro, rodape);
      btn.remove();
      iframe.focus();
    });
    rodape.appendChild(btn);
  } else {
    rodape.appendChild(criarEl("span", "aula-embreve", "Em breve"));
  }
  card.appendChild(rodape);
  return card;
}

async function carregarEstudio() {
  const lista = document.getElementById("lista-estudio");
  const { data, error } = await supabaseClient
    .from("aulas_estudio")
    .select("id, trilha, titulo, descricao, video_youtube_id, duracao_min, ordem, publicada")
    .order("ordem", { ascending: true });
  if (error) { lista.textContent = "Não foi possível carregar as aulas agora. Tente de novo em instantes."; return; }
  const aulas = (data || []).filter((a) => a.publicada !== false);
  if (aulas.length === 0) {
    lista.textContent = "As aulas do Estúdio Astra estão sendo preparadas. Volte em breve.";
    return;
  }
  const trilhas = new Map();
  for (const a of aulas) {
    const nome = a.trilha || "Aulas";
    if (!trilhas.has(nome)) trilhas.set(nome, []);
    trilhas.get(nome).push(a);
  }
  lista.replaceChildren();
  for (const [nome, itens] of trilhas) {
    const grupo = criarEl("section", "trilha", "");
    grupo.appendChild(criarEl("h3", "trilha-titulo", nome));
    const grade = criarEl("div", "grade-aulas", "");
    for (const a of itens) grade.appendChild(criarCartaoAula(a));
    grupo.appendChild(grade);
    lista.appendChild(grupo);
  }
}

function iniciarPainel() {
  configurarPerfil();
  carregarAvatar();
  carregarDadosPerfil();
  montarFiltroArea();
  document.getElementById("mostrar-incompletos").addEventListener("click", () => {
    incluirIncompletos = !incluirIncompletos;
    atualizarJulgados();
  });
  document.getElementById("mais-julgados").addEventListener("click", () => {
    limiteJulgados += JULGADOS_POR_PAGINA;
    desenharJulgados(false);
  });
  document.getElementById("filtro-gerados-formato").addEventListener("change", renderizarHistoricoGerados);
  document.getElementById("filtro-gerados-area").addEventListener("change", renderizarHistoricoGerados);
  configurarAbas();
  usoMes.limite = limiteMensal();
  atualizarContador();
  // Formatos primeiro: cartões abertos e histórico mostram o nome deles.
  carregarFormatos().then(() => { carregarJulgados(); carregarHistoricoGerados(); });
  carregarEstudio();
  carregarUsoMes();
  carregarSemana();
  carregarTendencias().then(carregarProntos); // "em alta" nos prontos depende das tendências
}

iniciar().then(() => {
  if (advogadoAtual) {
    carregarDetalhesAssinatura();
    iniciarPainel();
  }
});

// Navegação lateral: 6 visões (Painel, Meus roteiros, Estúdio, Perfil, Assinatura, Contato) alternadas por hash sem recarregar.
// Hash desconhecido = visão Painel. Na visão Painel, o item ativo acompanha a rolagem.
(function () {
  const VISOES = {
    "#meus-roteiros": "meus-roteiros", "#secao-meus-roteiros": "meus-roteiros",
    "#estudio": "estudio", "#secao-estudio": "estudio",
    "#perfil": "perfil", "#contato": "contato",
    "#assinatura": "assinatura", "#secao-assinatura": "assinatura",
  };
  const visoes = ["painel", "meus-roteiros", "estudio", "perfil", "assinatura", "contato"];
  const links = Array.from(document.querySelectorAll(".lateral nav a[href^='#']"));
  const linksSecao = links.filter((a) => a.classList.contains("sub"));
  const secoes = linksSecao.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if (!links.length) return;
  const visaoAtual = () => VISOES[location.hash] || "painel";

  function marcar(href) {
    links.forEach((a) => {
      const ativo = a.getAttribute("href") === href;
      a.classList.toggle("ativo", ativo);
      if (ativo) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }
  function aplicarVisao(rolar) {
    const v = visaoAtual();
    for (const nome of visoes) document.getElementById("visao-" + nome).hidden = nome !== v;
    if (v !== "painel") {
      marcar("#" + v);
      if (rolar) window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      marcar(secoes.length ? "#" + secoes[0].id : "#secao-perfil");
      const alvo = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
      if (rolar) {
        if (alvo) alvo.scrollIntoView(); else window.scrollTo({ top: 0, behavior: "instant" });
      }
      if (alvo && linksSecao.some((a) => a.getAttribute("href") === location.hash)) marcar(location.hash);
    }
  }
  window.addEventListener("hashchange", () => aplicarVisao(true));
  aplicarVisao(false);
  if (!secoes.length || !("IntersectionObserver" in window)) return;
  const marcarSecao = (s) => { if (visaoAtual() === "painel") marcar("#" + s.id); };
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) marcarSecao(e.target); });
  }, { rootMargin: "-25% 0px -65% 0px" });
  secoes.forEach((s) => io.observe(s));
  window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) marcarSecao(secoes[secoes.length - 1]);
  }, { passive: true });
})();
