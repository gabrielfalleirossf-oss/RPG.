const raiz = document.documentElement;
let quadroPendente;
document.addEventListener("pointermove", (evento) => {
    if (quadroPendente) cancelAnimationFrame(quadroPendente);
    quadroPendente = requestAnimationFrame(() => {
        raiz.style.setProperty("--mouse-x", `${(evento.clientX / innerWidth) * 100}%`);
        raiz.style.setProperty("--mouse-y", `${(evento.clientY / innerHeight) * 100}%`);
    });
}, { passive: true });

document.querySelectorAll(".campanha").forEach((cartao) => {
    const selecionar = () => {
        const nome = cartao.dataset.campanha;
        const aviso = document.querySelector("#aviso-campanha");
        localStorage.setItem("campanhaSelecionada", nome);
        aviso.textContent = `${nome} selecionada — a próxima tela será construída agora.`;
        aviso.classList.add("visivel");
        clearTimeout(window.tempoDoAviso);
        window.tempoDoAviso = setTimeout(() => aviso.classList.remove("visivel"), 3200);
    };
    cartao.addEventListener("click", selecionar);
    cartao.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" || evento.key === " ") { evento.preventDefault(); selecionar(); }
    });
});
