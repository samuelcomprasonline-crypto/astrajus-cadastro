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

iniciar();
