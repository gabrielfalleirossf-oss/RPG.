const parametros = new URLSearchParams(location.search);
const rpg = parametros.get("rpg") === "marvel" ? "marvel" : "abismo";
const perfil = parametros.get("perfil") === "mestre" ? "mestre" : "jogador";
const configuracao = window.RPG_SUPABASE || {};

const pagina = document.querySelector(".pagina-login");
const universo = document.querySelector("#universo");
const titulo = document.querySelector("#titulo-login");
const subtitulo = document.querySelector("#subtitulo");
const voltar = document.querySelector("#voltar");
const formulario = document.querySelector("#formulario-login");
const abaEntrar = document.querySelector("#aba-entrar");
const abaCadastrar = document.querySelector("#aba-cadastrar");
const campoNome = document.querySelector("#campo-nome");
const nome = document.querySelector("#nome");
const email = document.querySelector("#email");
const senha = document.querySelector("#senha");
const mostrarSenha = document.querySelector("#mostrar-senha");
const enviar = document.querySelector("#enviar");
const mensagem = document.querySelector("#mensagem");

let modo = "entrar";
let cliente;

pagina.dataset.rpg = rpg;
universo.textContent = rpg.toUpperCase();
titulo.textContent = `Acesso do ${perfil === "mestre" ? "Mestre" : "Jogador"}`;
voltar.href = `../${rpg === "abismo" ? "rpg" : "marvel"}/index.html`;

if (perfil === "mestre") {
    subtitulo.textContent = "Entre com a conta de Mestre autorizada para este RPG.";
    abaCadastrar.disabled = true;
} else {
    subtitulo.textContent = "Entre na sua conta ou crie uma gratuitamente.";
}

function definirMensagem(texto, sucesso = false) {
    mensagem.textContent = texto;
    mensagem.classList.toggle("sucesso", sucesso);
}

function traduzirErro(erro) {
    const texto = (erro?.message || "").toLowerCase();
    if (texto.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
    if (texto.includes("user already registered")) return "Este e-mail já possui uma conta.";
    if (texto.includes("password")) return "A senha precisa ter pelo menos 6 caracteres.";
    if (texto.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
    return erro?.message || "Não foi possível concluir. Tente novamente.";
}

function trocarModo(novoModo) {
    if (perfil === "mestre") return;
    modo = novoModo;
    const cadastrando = modo === "cadastrar";
    abaEntrar.classList.toggle("ativa", !cadastrando);
    abaCadastrar.classList.toggle("ativa", cadastrando);
    campoNome.classList.toggle("oculto", !cadastrando);
    nome.required = cadastrando;
    senha.autocomplete = cadastrando ? "new-password" : "current-password";
    enviar.textContent = cadastrando ? "Criar minha conta" : "Entrar";
    definirMensagem("");
}

async function verificarPermissao() {
    let { data, error } = await cliente
        .from("membros_rpg")
        .select("rpg, perfil")
        .eq("rpg", rpg)
        .eq("perfil", perfil)
        .maybeSingle();

    if (error) throw error;

    // Um jogador autenticado pode entrar em outro RPG usando a mesma conta.
    if (!data && perfil === "jogador") {
        const { data: sessao } = await cliente.auth.getUser();
        const usuario = sessao?.user;
        if (!usuario) throw new Error("Faça login novamente.");

        const nomeSalvo = usuario.user_metadata?.nome || usuario.email?.split("@")[0] || "Jogador";
        const { error: erroCadastro } = await cliente.from("membros_rpg").insert({
            usuario_id: usuario.id,
            rpg,
            perfil: "jogador",
            nome_exibicao: nomeSalvo
        });
        if (erroCadastro) throw erroCadastro;
        data = { rpg, perfil: "jogador" };
    }

    if (!data) throw new Error("Esta conta não possui acesso de Mestre neste RPG.");
}

function destinoDaArea() {
    const pastaRpg = rpg === "abismo" ? "rpg" : "marvel";
    const pastaPerfil = perfil === "mestre" ? "mestre" : "jogadores";
    return `../${pastaRpg}/${pastaPerfil}/index.html`;
}

async function entrar() {
    const { error } = await cliente.auth.signInWithPassword({
        email: email.value.trim(),
        password: senha.value
    });
    if (error) throw error;
    await verificarPermissao();
    location.href = destinoDaArea();
}

async function cadastrarJogador() {
    const { data, error } = await cliente.auth.signUp({
        email: email.value.trim(),
        password: senha.value,
        options: { data: { nome: nome.value.trim() } }
    });
    if (error) throw error;

    if (!data.session) {
        trocarModo("entrar");
        definirMensagem("Conta criada! Confirme o e-mail e depois volte para entrar.", true);
        return;
    }

    const { error: erroMembro } = await cliente.from("membros_rpg").insert({
        usuario_id: data.user.id,
        rpg,
        perfil: "jogador",
        nome_exibicao: nome.value.trim()
    });
    if (erroMembro) throw erroMembro;
    location.href = destinoDaArea();
}

abaEntrar.addEventListener("click", () => trocarModo("entrar"));
abaCadastrar.addEventListener("click", () => trocarModo("cadastrar"));
mostrarSenha.addEventListener("click", () => {
    senha.type = senha.type === "password" ? "text" : "password";
    mostrarSenha.setAttribute("aria-label", senha.type === "password" ? "Mostrar senha" : "Ocultar senha");
});

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    definirMensagem("");

    if (!formulario.reportValidity()) return;
    if (!cliente) {
        definirMensagem("Falta conectar o site ao Supabase no arquivo supabase-config.js.");
        return;
    }

    enviar.disabled = true;
    enviar.textContent = "Aguarde...";
    try {
        if (modo === "cadastrar" && perfil === "jogador") await cadastrarJogador();
        else await entrar();
    } catch (erro) {
        await cliente.auth.signOut();
        definirMensagem(traduzirErro(erro));
    } finally {
        enviar.disabled = false;
        enviar.textContent = modo === "cadastrar" ? "Criar minha conta" : "Entrar";
    }
});

if (configuracao.url?.startsWith("https://") && !configuracao.anonKey?.startsWith("COLE_")) {
    cliente = window.supabase.createClient(configuracao.url, configuracao.anonKey);
}
