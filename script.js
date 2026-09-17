const EDGE_FUNCTION_URL = "https://wuxuxxdikaacggwqivmm.supabase.co/functions/v1/cadastro-advogado";
const CRIAR_COBRANCA_URL = "https://wuxuxxdikaacggwqivmm.supabase.co/functions/v1/criar-cobranca";

const PRECO_BASE_CENTAVOS = 14700;
const PRECO_AREA_ADICIONAL_CENTAVOS = 4700;
const PRECO_PACOTE_COMPLETO_CENTAVOS = 39700;
const TOTAL_AREAS = 10;

function calcularPrecoCentavos(areas) {
  if (areas.length === 0) return 0;
  if (areas.length >= TOTAL_AREAS) return PRECO_PACOTE_COMPLETO_CENTAVOS;
  const valorAditivo = PRECO_BASE_CENTAVOS + (areas.length - 1) * PRECO_AREA_ADICIONAL_CENTAVOS;
  return Math.min(valorAditivo, PRECO_PACOTE_COMPLETO_CENTAVOS);
}

function formatarReais(centavos) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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
console.assert(calcularPrecoCentavos(["civel"]) === 14700, "1 area deveria custar 14700");
console.assert(calcularPrecoCentavos(["civel", "consumidor"]) === 19400, "2 areas deveria custar 19400");
console.assert(calcularPrecoCentavos(["civel", "consumidor", "trabalhista", "tributario", "empresarial", "familia_sucessoes", "criminal"]) === 39700, "7 areas deveria ser limitada ao preco do pacote completo");

const form = document.getElementById("form-cadastro");
const botao = document.getElementById("botao-enviar");
const mensagem = document.getElementById("mensagem");
const erroCpf = document.getElementById("erro-cpf");
const precoCalculado = document.getElementById("preco-calculado");
const checkboxesArea = document.querySelectorAll('input[name="area"]');
const areaPagamentoDiv = document.getElementById("area-pagamento");
const qrcodePix = document.getElementById("qrcode-pix");

let idempotencyKey = crypto.randomUUID();

const passos = Array.from(document.querySelectorAll(".passo"));
const indicadores = Array.from(document.querySelectorAll(".progresso-item"));
let passoAtual = 1;

function irParaPasso(numero) {
  passoAtual = numero;
  passos.forEach((secao) => {
    secao.hidden = Number(secao.dataset.passo) !== numero;
  });
  indicadores.forEach((item) => {
    const indice = Number(item.dataset.passoIndicador);
    item.classList.toggle("atual", indice === numero);
    item.classList.toggle("concluido", indice < numero);
  });
  passos[numero - 1].scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelectorAll("[data-voltar]").forEach((btn) => {
  btn.addEventListener("click", () => irParaPasso(passoAtual - 1));
});

function validarSecao(idSecao) {
  const campos = document.querySelectorAll(`#${idSecao} [required]`);
  for (const campo of campos) {
    if (!campo.checkValidity()) {
      campo.reportValidity();
      return false;
    }
  }
  return true;
}

function areasMarcadas() {
  return Array.from(checkboxesArea).filter((c) => c.checked).map((c) => c.value);
}

function atualizarPreco() {
  const areas = areasMarcadas();
  precoCalculado.textContent = areas.length === 0
    ? "Selecione ao menos uma área"
    : `Valor mensal: ${formatarReais(calcularPrecoCentavos(areas))}`;
}

checkboxesArea.forEach((c) => c.addEventListener("change", atualizarPreco));
atualizarPreco();

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = "mensagem " + tipo;
}

form.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarMensagem("", "");

  if (passoAtual === 1) {
    if (!validarSecao("passo-1")) return;
    erroCpf.textContent = "";
    if (!validarCPF(form.cpf.value)) {
      erroCpf.textContent = "CPF inválido";
      form.cpf.focus();
      return;
    }
    irParaPasso(2);
    return;
  }

  if (passoAtual === 2) {
    if (!validarSecao("passo-2")) return;
    const cepDigitos = form.endereco_cep.value.replace(/\D/g, "");
    if (cepDigitos.length !== 8) {
      mostrarMensagem("CEP inválido.", "erro");
      form.endereco_cep.focus();
      return;
    }
    if (areasMarcadas().length === 0) {
      mostrarMensagem("Selecione ao menos uma área.", "erro");
      return;
    }
    irParaPasso(3);
    return;
  }

  const cpf = form.cpf.value;
  const areas = areasMarcadas();
  const formaPagamento = form.querySelector('input[name="forma_pagamento"]:checked')?.value;
  const enderecoRua = form.endereco_rua.value.trim();
  const enderecoNumero = form.endereco_numero.value.trim();
  const enderecoCep = form.endereco_cep.value.replace(/\D/g, "");

  const turnstileToken = form.querySelector('[name="cf-turnstile-response"]')?.value;
  if (!turnstileToken) {
    mostrarMensagem("Confirme que você não é um robô antes de enviar.", "erro");
    return;
  }

  botao.disabled = true;
  mostrarMensagem("Enviando cadastro...", "");

  try {
    const respostaCadastro = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nome: form.nome.value.trim(),
        cpf,
        oab_numero: form.oab_numero.value.trim(),
        oab_uf: form.oab_uf.value,
        email: form.email.value.trim(),
        telefone: form.telefone.value.trim(),
        endereco: `${enderecoRua}, ${enderecoNumero} - CEP ${enderecoCep}`,
        aceite_lgpd: form.aceite_lgpd.checked,
        turnstileToken,
      }),
    });

    if (respostaCadastro.status === 409) {
      mostrarMensagem("Você já está cadastrado.", "erro");
      return;
    }
    if (!respostaCadastro.ok) {
      const dados = await respostaCadastro.json().catch(() => ({}));
      mostrarMensagem(dados.erro || "Não conseguimos enviar, tenta de novo em instantes.", "erro");
      return;
    }

    const { id: advogadoId } = await respostaCadastro.json();

    mostrarMensagem("Processando pagamento...", "");

    const respostaCobranca = await fetch(CRIAR_COBRANCA_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        advogado_id: advogadoId,
        areas,
        forma_pagamento: formaPagamento,
        idempotency_key: idempotencyKey,
        endereco_rua: enderecoRua,
        endereco_numero: enderecoNumero,
        endereco_cep: enderecoCep,
      }),
    });

    const dadosCobranca = await respostaCobranca.json().catch(() => ({}));

    if (!respostaCobranca.ok) {
      mostrarMensagem(
        dadosCobranca.erro || "Não conseguimos processar o pagamento, tenta de novo em instantes.",
        "erro",
      );
      return;
    }

    if (dadosCobranca.tipo === "cartao_credito" && dadosCobranca.checkoutUrl) {
      mostrarMensagem("Redirecionando pro pagamento...", "sucesso");
      idempotencyKey = crypto.randomUUID();
      window.location.href = dadosCobranca.checkoutUrl;
      return;
    }

    if (dadosCobranca.tipo === "pix_automatico" && dadosCobranca.qrCode) {
      mostrarMensagem("Escaneie o QR code no app do seu banco pra confirmar.", "sucesso");
      areaPagamentoDiv.hidden = false;
      const imagem = dadosCobranca.qrCode.encodedImage || dadosCobranca.qrCode.payload || "";
      qrcodePix.src = "data:image/png;base64," + imagem;
      idempotencyKey = crypto.randomUUID();
      return;
    }

    mostrarMensagem("Cadastro enviado! Vamos confirmar o pagamento em breve.", "sucesso");
  } catch {
    mostrarMensagem("Não conseguimos enviar, tenta de novo em instantes.", "erro");
  } finally {
    botao.disabled = false;
  }
});
