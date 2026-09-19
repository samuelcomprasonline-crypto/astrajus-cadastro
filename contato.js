// Canais do "Fale conosco". O dono preenche SOMENTE este objeto:
//   email: "contato@seudominio.com.br"
//   whatsapp: só dígitos com DDI e DDD, ex. "5565999999999"
// Enquanto um valor estiver vazio, o botão correspondente aparece desabilitado ("Contato em breve").
window.CONTATO_ASTRA = {
  email: "",
  whatsapp: "",
  assuntoEmail: "Contato pelo site Astra Jus",
  mensagemWhatsapp: "Olá! Vim pelo site do Astra Jus.",
};

(function () {
  function montar() {
    var c = window.CONTATO_ASTRA || {};
    var email = String(c.email || "").trim();
    var zap = String(c.whatsapp || "").replace(/\D/g, "");
    var hrefs = {
      email: email ? "mailto:" + email + "?subject=" + encodeURIComponent(c.assuntoEmail || "") : "",
      whatsapp: zap ? "https://wa.me/" + zap + "?text=" + encodeURIComponent(c.mensagemWhatsapp || "") : "",
    };
    var desabilitados = 0;
    document.querySelectorAll("[data-contato]").forEach(function (a) {
      var href = hrefs[a.getAttribute("data-contato")];
      if (href) {
        a.href = href;
        a.removeAttribute("aria-disabled");
        a.removeAttribute("role");
        a.removeAttribute("title");
        if (href.indexOf("https:") === 0) { a.target = "_blank"; a.rel = "noopener"; }
      } else {
        desabilitados++;
        a.removeAttribute("href");
        a.setAttribute("role", "link");
        a.setAttribute("aria-disabled", "true");
        a.title = "Contato em breve";
        if (!a.querySelector(".so-leitor")) {
          var s = document.createElement("span");
          s.className = "so-leitor";
          s.textContent = " (contato em breve)";
          a.appendChild(s);
        }
      }
    });
    document.querySelectorAll("[data-contato-dica]").forEach(function (p) {
      p.textContent = desabilitados ? "Contato em breve." : "";
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar); else montar();
})();
