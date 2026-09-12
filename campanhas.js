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
    const selecionar = async () => {
        const nome = cartao.dataset.campanha;
        const aviso = document.querySelector("#aviso-campanha");
        const rpg = document.body.dataset.rpg;
        const perfil = document.body.dataset.perfil;

        if (perfil === "mestre") {
            aviso.textContent = `Abrindo os personagens de ${nome}...`;
            aviso.classList.add("visivel");
            location.href = `personagens/index.html?campanha=${encodeURIComponent(nome)}`;
            return;
        }

        cartao.classList.add("carregando");
        aviso.textContent = "Procurando seus personagens...";
        aviso.classList.add("visivel");

        try {
            let auth = window.RPG_AUTH;
            if (!auth) auth = await new Promise((resolve) => document.addEventListener("rpg:auth-pronto", (e) => resolve(e.detail), { once: true }));

            const { data, error } = await auth.cliente
                .from("personagens")
                .select("id")
                .eq("usuario_id", auth.usuario.id)
                .eq("rpg", rpg)
                .eq("campanha", nome)
                .order("criado_em", { ascending: true });
            if (error) throw error;

            const base = `personagem/index.html?campanha=${encodeURIComponent(nome)}`;
            if (!data?.length) location.href = `${base}&modo=criar`;
            else if (nome === "Testes") location.href = `personagens/index.html?campanha=${encodeURIComponent(nome)}`;
            else location.href = `ficha/index.html?campanha=${encodeURIComponent(nome)}&id=${data[0].id}`;
        } catch (erro) {
            aviso.textContent = "Não foi possível abrir a campanha. Tente novamente.";
            cartao.classList.remove("carregando");
        }
    };
    cartao.addEventListener("click", selecionar);
    cartao.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" || evento.key === " ") { evento.preventDefault(); selecionar(); }
    });
});
