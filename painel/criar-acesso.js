const form = document.getElementById("form-criar-acesso");
const botao = document.getElementById("botao-criar");
const mensagem = document.getElementById("mensagem");

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = "mensagem " + tipo;
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarMensagem("", "");
  botao.disabled = true;

  const email = form.email.value.trim();
  const { error: erroSignUp } = await supabaseClient.auth.signUp({
    email,
    password: form.senha.value,
  });

  if (erroSignUp) {
    mostrarMensagem(
      erroSignUp.message.includes("already registered")
        ? "Esse e-mail já tem acesso criado. Faça login."
        : "Não conseguimos criar o acesso, tenta de novo em instantes.",
      "erro",
    );
    botao.disabled = false;
    return;
  }

  // O trigger de banco só vincula auth_user_id se o e-mail bater com um
  // advogado aprovado com assinatura ativa. Confere aqui se o vínculo
  // aconteceu antes de mandar pro painel.
  const { data: advogado } = await supabaseClient
    .from("advogados")
    .select("id")
    .maybeSingle();

  if (!advogado) {
    mostrarMensagem(
      "Esse e-mail não tem uma assinatura ativa vinculada. Confirme se é o mesmo do seu cadastro.",
      "erro",
    );
    await supabaseClient.auth.signOut();
    botao.disabled = false;
    return;
  }

  window.location.href = "index.html";
});
