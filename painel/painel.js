let sessaoAtual = null;
let advogadoAtual = null;

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

  document.getElementById("areas-advogado").textContent =
    "Áreas assinadas: " + assinatura.areas.join(", ");
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

function popularFiltros(roteiros) {
  const areas = [...new Set(roteiros.map((r) => r.area))].sort();
  const semanas = [...new Set(roteiros.map((r) => r.semana_iso))].sort().reverse();

  const container = document.getElementById("filtros-roteiros");
  container.innerHTML = "";

  const selectArea = document.createElement("select");
  selectArea.id = "filtro-area";
  selectArea.appendChild(new Option("Todas as áreas", ""));
  for (const area of areas) selectArea.appendChild(new Option(area, area));

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
    .select("id, area, semana_iso, tom, cta, texto_completo")
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
    .select("area, termo")
    .eq("semana_iso", semanaAtual);
  areasEmAltaSemanaAtual = new Set((trends || []).map((t) => t.area));

  popularFiltros(roteiros);
  renderizarRoteiros(roteiros);
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

    const titulo = document.createElement("h3");
    titulo.textContent = `${roteiro.area} — semana ${roteiro.semana_iso}`;
    if (areasEmAltaSemanaAtual.has(roteiro.area) && roteiro.semana_iso === semanaAtual) {
      const selo = document.createElement("span");
      selo.className = "selo-alta";
      selo.textContent = "em alta";
      titulo.appendChild(selo);
    }
    item.appendChild(titulo);

    const texto = document.createElement("p");
    texto.textContent = roteiro.texto_completo;
    item.appendChild(texto);

    const botaoCopiar = document.createElement("button");
    botaoCopiar.type = "button";
    botaoCopiar.className = "botao-secundario";
    botaoCopiar.textContent = "Copiar texto";
    botaoCopiar.addEventListener("click", () => navigator.clipboard.writeText(roteiro.texto_completo));
    item.appendChild(botaoCopiar);

    const rotuloGravado = document.createElement("label");
    const checkboxGravado = document.createElement("input");
    checkboxGravado.type = "checkbox";
    checkboxGravado.checked = gravadosPorRoteiro.has(roteiro.id);
    checkboxGravado.addEventListener("change", async () => {
      await supabaseClient.from("roteiros_progresso").upsert({
        advogado_id: advogadoAtual.id,
        roteiro_id: roteiro.id,
        gravado: checkboxGravado.checked,
        marcado_em: new Date().toISOString(),
      }, { onConflict: "advogado_id,roteiro_id" });
      if (checkboxGravado.checked) {
        gravadosPorRoteiro.add(roteiro.id);
      } else {
        gravadosPorRoteiro.delete(roteiro.id);
      }
    });
    rotuloGravado.appendChild(checkboxGravado);
    rotuloGravado.appendChild(document.createTextNode(" já gravei"));
    item.appendChild(rotuloGravado);

    container.appendChild(item);
  }
}

iniciar().then(() => {
  if (advogadoAtual) carregarRoteiros();
});
