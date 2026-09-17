const form = document.getElementById("form-login");
const botao = document.getElementById("botao-entrar");
const mensagem = document.getElementById("mensagem");

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = "mensagem " + tipo;
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarMensagem("", "");
  botao.disabled = true;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: form.email.value.trim(),
    password: form.senha.value,
  });

  if (error) {
    mostrarMensagem("E-mail ou senha inválidos.", "erro");
    botao.disabled = false;
    return;
  }

  window.location.href = "index.html";
});
