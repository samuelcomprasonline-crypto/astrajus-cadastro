const EDGE_FUNCTION_URL = "https://PROJECT_REF_AQUI.supabase.co/functions/v1/cadastro-advogado";

function validarCPF(cpfBruto) {
  const digitos = cpfBruto.replace(/\D/g, "");
  if (digitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDigito = (base, fatorInicial) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += parseInt(base[i], 10) * (fatorInicial - i);
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = calcularDigito(digitos.slice(0, 9), 10);
  const d2 = calcularDigito(digitos.slice(0, 10), 11);
  return d1 === parseInt(digitos[9], 10) && d2 === parseInt(digitos[10], 10);
}

console.assert(validarCPF("111.444.777-35") === true, "CPF válido deveria passar");
console.assert(validarCPF("11144477736") === false, "dígito verificador errado deveria falhar");
console.assert(validarCPF("00000000000") === false, "dígitos repetidos deveria falhar");

const form = document.getElementById("form-cadastro");
const botao = document.getElementById("botao-enviar");
const mensagem = document.getElementById("mensagem");
const erroCpf = document.getElementById("erro-cpf");

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = "mensagem " + tipo;
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  erroCpf.textContent = "";
  mostrarMensagem("", "");

  const cpf = form.cpf.value;
  if (!validarCPF(cpf)) {
    erroCpf.textContent = "CPF inválido";
    return;
  }

  const turnstileToken = form.querySelector('[name="cf-turnstile-response"]')?.value;
  if (!turnstileToken) {
    mostrarMensagem("Confirme que você não é um robô antes de enviar.", "erro");
    return;
  }

  const corpo = {
    nome: form.nome.value.trim(),
    cpf,
    oab_numero: form.oab_numero.value.trim(),
    oab_uf: form.oab_uf.value,
    email: form.email.value.trim(),
    telefone: form.telefone.value.trim(),
    endereco: form.endereco.value.trim(),
    aceite_lgpd: form.aceite_lgpd.checked,
    turnstileToken,
  };

  botao.disabled = true;
  mostrarMensagem("Enviando...", "");

  try {
    const resposta = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });

    if (resposta.status === 409) {
      mostrarMensagem("Você já está cadastrado.", "erro");
    } else if (resposta.ok) {
      mostrarMensagem("Cadastro enviado! Vamos avaliar seus dados em breve.", "sucesso");
      form.reset();
    } else {
      const dados = await resposta.json().catch(() => ({}));
      mostrarMensagem(dados.erro || "Não conseguimos enviar, tenta de novo em instantes.", "erro");
    }
  } catch {
    mostrarMensagem("Não conseguimos enviar, tenta de novo em instantes.", "erro");
  } finally {
    botao.disabled = false;
  }
});
