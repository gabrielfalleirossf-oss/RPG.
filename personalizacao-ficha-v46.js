(() => {
  "use strict";

  const TEMAS = ["original", "roxo", "rosa", "azul", "dourado"];
  const NOMES = { original: "Original", roxo: "Roxo", rosa: "Rosa", azul: "Azul-escuro", dourado: "Dourado" };
  const resultadosVistos = new WeakMap();
  let animacaoAtual = null;

  function iniciar() {
    if (document.querySelector(".controles-ficha-visual")) return;

    const rpg = document.body.dataset.rpg || "abismo";
    const chaveTema = `rpg-tema-ficha-${rpg}`;
    const chaveAnimacao = `rpg-animacao-dados-${rpg}`;
    let tema = localStorage.getItem(chaveTema) || "original";
    if (!TEMAS.includes(tema)) tema = "original";
    let animarDados = localStorage.getItem(chaveAnimacao) === "true";

    const controles = document.createElement("aside");
    controles.className = "controles-ficha-visual";
    controles.setAttribute("aria-label", "Personalização da ficha");
    controles.innerHTML = `
      <button class="controle-ficha-tema" type="button" aria-label="Trocar tema">
        <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6a18 18 0 1 0 0 36h3.2a3.8 3.8 0 0 0 1.1-7.4 3 3 0 0 1 1-5.8H35A7 7 0 0 0 42 22C42 13.2 34 6 24 6Z"/><circle cx="15" cy="20" r="2.4"/><circle cx="20" cy="13" r="2.4"/><circle cx="29" cy="13" r="2.4"/><circle cx="35" cy="20" r="2.4"/></svg>
      </button>
      <button class="controle-ficha-dado" type="button" aria-label="Ativar animação dos dados" aria-pressed="false">
        <svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 5 17 10-4 20-13 8-13-8-4-20Z"/><path d="m24 5-8 13 8 20 8-20Zm-17 10 9 3 16 0 9-3M11 35l13 3 13-3"/></svg>
      </button>`;
    document.body.appendChild(controles);

    const botaoTema = controles.querySelector(".controle-ficha-tema");
    const botaoDado = controles.querySelector(".controle-ficha-dado");

    function aplicarTema() {
      if (tema === "original") delete document.body.dataset.temaFicha;
      else document.body.dataset.temaFicha = tema;
      const proximo = TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length];
      botaoTema.title = `Tema atual: ${NOMES[tema]}. Próximo: ${NOMES[proximo]}`;
      botaoTema.setAttribute("aria-label", `Trocar tema. Tema atual: ${NOMES[tema]}`);
    }

    function aplicarAnimacao() {
      botaoDado.classList.toggle("ativo", animarDados);
      botaoDado.setAttribute("aria-pressed", String(animarDados));
      botaoDado.setAttribute("aria-label", `${animarDados ? "Desativar" : "Ativar"} animação dos dados`);
      botaoDado.title = `Animação dos dados: ${animarDados ? "ativada" : "desativada"}`;
    }

    botaoTema.addEventListener("click", () => {
      tema = TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length];
      localStorage.setItem(chaveTema, tema);
      aplicarTema();
    });
    botaoDado.addEventListener("click", () => {
      animarDados = !animarDados;
      localStorage.setItem(chaveAnimacao, String(animarDados));
      aplicarAnimacao();
    });

    aplicarTema();
    aplicarAnimacao();

    document.querySelectorAll(".resultado-dados").forEach((el) => resultadosVistos.set(el, el.textContent.trim()));
    const observador = new MutationObserver((mutacoes) => {
      if (!animarDados) return;
      const alvos = new Set();
      for (const mutacao of mutacoes) {
        const proprio = mutacao.target.nodeType === 1 ? mutacao.target : mutacao.target.parentElement;
        const resultado = proprio?.closest?.(".resultado-dados");
        if (resultado) alvos.add(resultado);
        mutacao.addedNodes.forEach((no) => {
          if (no.nodeType !== 1) return;
          if (no.matches?.(".resultado-dados")) alvos.add(no);
          no.querySelectorAll?.(".resultado-dados").forEach((el) => alvos.add(el));
        });
      }
      alvos.forEach(verificarResultado);
    });
    observador.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  function verificarResultado(el) {
    const texto = el.textContent.replace(/\s+/g, " ").trim();
    const anterior = resultadosVistos.get(el);
    resultadosVistos.set(el, texto);
    if (!texto || texto === anterior || /aguardando/i.test(texto)) return;
    if (!/\d/.test(texto)) return;
    mostrarAnimacao(texto);
  }

  function mostrarAnimacao(texto) {
    animacaoAtual?.remove();
    const total = texto.match(/total\s*:?\s*(-?\d+)/i)?.[1]
      || texto.match(/(?:d\d+\s*:?\s*)(-?\d+)/i)?.[1]
      || [...texto.matchAll(/-?\d+/g)].at(-1)?.[0]
      || "?";
    const tipo = texto.match(/d(4|6|8|10|12|20|100)/i)?.[1] || "20";
    const camada = document.createElement("div");
    camada.className = "animacao-dado-ficha";
    camada.setAttribute("aria-hidden", "true");
    camada.innerHTML = `<div class="dado-animado-ficha"><svg viewBox="0 0 120 120"><path d="M60 5 109 34 97 92 60 115 23 92 11 34Z"/><path d="M60 5 37 42 60 104 83 42ZM11 34l26 8h46l26-8M23 92l37 12 37-12"/></svg><span>?</span></div><small>D${tipo}</small>`;
    document.body.appendChild(camada);
    animacaoAtual = camada;
    requestAnimationFrame(() => camada.classList.add("rolando"));
    window.setTimeout(() => {
      camada.querySelector("span").textContent = total;
      camada.classList.add("resultado");
    }, 560);
    window.setTimeout(() => camada.classList.add("saindo"), 1050);
    window.setTimeout(() => {
      camada.remove();
      if (animacaoAtual === camada) animacaoAtual = null;
    }, 1350);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
})();
