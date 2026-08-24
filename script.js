const seletorAventuras = document.querySelector(".seletor-aventuras");
const botaoRpg = document.querySelector(".botao-rpg");
const botaoMarvel = document.querySelector(".botao-marvel");

function ativarLado(nomeDaClasse) {
    seletorAventuras.classList.remove("rpg-ativo", "marvel-ativo");
    seletorAventuras.classList.add(nomeDaClasse);
}

function voltarAoNormal() {
    seletorAventuras.classList.remove("rpg-ativo", "marvel-ativo");
}

/* O movimento só começa quando o cursor entra exatamente em um botão. */
botaoRpg.addEventListener("mouseenter", () => ativarLado("rpg-ativo"));
botaoRpg.addEventListener("mouseleave", voltarAoNormal);

botaoMarvel.addEventListener("mouseenter", () => ativarLado("marvel-ativo"));
botaoMarvel.addEventListener("mouseleave", voltarAoNormal);

/* Mantém o mesmo comportamento para quem navega usando o teclado. */
botaoRpg.addEventListener("focus", () => ativarLado("rpg-ativo"));
botaoRpg.addEventListener("blur", voltarAoNormal);

botaoMarvel.addEventListener("focus", () => ativarLado("marvel-ativo"));
botaoMarvel.addEventListener("blur", voltarAoNormal);
