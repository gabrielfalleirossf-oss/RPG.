document.addEventListener("DOMContentLoaded", async () => {
    const corpo = document.body;
    const rpg = corpo.dataset.rpg;
    const perfil = corpo.dataset.perfil;
    const config = window.RPG_SUPABASE || {};
    const pastaRpg = rpg === "abismo" ? "rpg" : "marvel";
    const login = `../../login/index.html?rpg=${rpg}&perfil=${perfil}`;

    if (!config.url?.startsWith("https://") || config.anonKey?.startsWith("COLE_")) {
        location.replace(login);
        return;
    }

    const cliente = window.supabase.createClient(config.url, config.anonKey);
    const { data: usuario } = await cliente.auth.getUser();
    if (!usuario?.user) {
        location.replace(login);
        return;
    }

    const { data: acesso } = await cliente
        .from("membros_rpg")
        .select("nome_exibicao")
        .eq("rpg", rpg)
        .eq("perfil", perfil)
        .maybeSingle();

    if (!acesso) {
        location.replace(login);
        return;
    }

    const nome = document.querySelector("#nome-usuario");
    if (nome) nome.textContent = acesso.nome_exibicao;
    document.querySelector("main").hidden = false;

    document.querySelector("#sair")?.addEventListener("click", async () => {
        await cliente.auth.signOut();
        location.replace(`../../${pastaRpg}/index.html`);
    });
});
