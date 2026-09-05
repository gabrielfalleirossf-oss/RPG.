const qs = new URLSearchParams(location.search);
const campanha = qs.get("campanha") || "Testes";
const rpg = document.body.dataset.rpg;
const pagina = document.body.dataset.pagina;
let auth, personagemCriadoId, personagemSelecionadoId;

const PERICIAS_FICHA = [
  ["Furtividade", "AGI"], ["Iniciativa", "AGI"],
  ["Investigação", "APT"], ["Medicina", "APT"],
  ["Percepção", "PRE"], ["Pontaria", "AGI"],
  ["Esquiva", "AGI"], ["Bloqueio", "FOR"],
  ["HtH", "FOR"], ["Esgrima", "AGI"],
  ["Combate com haste", "FOR"], ["Sobrevivência", "APT"],
  ["Vontade", "PRE"]
];

document.documentElement.addEventListener("pointermove",(e)=>{document.documentElement.style.setProperty("--mouse-x",`${e.clientX/innerWidth*100}%`);document.documentElement.style.setProperty("--mouse-y",`${e.clientY/innerHeight*100}%`)},{passive:true});

async function obterAuth(){
  if(window.RPG_AUTH)return window.RPG_AUTH;
  return new Promise(resolve=>document.addEventListener("rpg:auth-pronto",e=>resolve(e.detail),{once:true}));
}
function caminho(tipo,id=""){
  const base=tipo==="criar"?"../personagem/index.html":tipo==="selecionar"?"../personagens/index.html":"../ficha/index.html";
  return `${base}?campanha=${encodeURIComponent(campanha)}${id?`&id=${id}`:""}`;
}
function mensagem(texto,sucesso=false){const el=document.querySelector("#mensagem");if(!el)return;el.textContent=texto;el.classList.toggle("sucesso",sucesso)}
async function urlFoto(path){if(!path)return null;const {data}=await auth.cliente.storage.from("personagens").createSignedUrl(path,3600);return data?.signedUrl||null}

async function iniciarCriacao(){
  document.querySelector("#campanha-atual").textContent=campanha;
  const form=document.querySelector("#form-personagem"),arquivo=document.querySelector("#foto"),preview=document.querySelector("#preview"),upload=document.querySelector(".upload"),irFicha=document.querySelector("#ir-ficha");
  arquivo.addEventListener("change",()=>{const f=arquivo.files[0];if(!f)return;if(f.size>5*1024*1024){mensagem("A imagem precisa ter no máximo 5 MB.");arquivo.value="";return}preview.src=URL.createObjectURL(f);upload.classList.add("tem-foto")});
  document.querySelectorAll("textarea[maxlength]").forEach(el=>{const out=el.parentElement.querySelector(".contador");const atualizar=()=>out.textContent=`${el.value.length}/${el.maxLength}`;el.addEventListener("input",atualizar);atualizar()});
  form.addEventListener("submit",async e=>{
    e.preventDefault();mensagem("");const salvar=document.querySelector("#criar-personagem");salvar.disabled=true;salvar.textContent="Criando...";
    try{
      const id=crypto.randomUUID();let fotoPath=null;const foto=arquivo.files[0];
      if(foto){const ext=(foto.name.split(".").pop()||"jpg").toLowerCase();fotoPath=`${auth.usuario.id}/${rpg}/${campanha}/${id}.${ext}`;const {error}=await auth.cliente.storage.from("personagens").upload(fotoPath,foto,{upsert:false});if(error)throw error}
      const registro={id,usuario_id:auth.usuario.id,rpg,campanha,nome:form.nome.value.trim(),historia:form.historia.value.trim(),personalidade:form.personalidade.value.trim(),objetivos:form.objetivos.value.trim(),anotacoes:form.anotacoes.value.trim(),foto_path:fotoPath};
      const {error}=await auth.cliente.from("personagens").insert(registro);if(error)throw error;
      personagemCriadoId=id;irFicha.disabled=false;mensagem("Personagem criado com sucesso!",true);salvar.textContent="Personagem criado";
    }catch(err){mensagem(err.message||"Não foi possível criar o personagem.");salvar.disabled=false;salvar.textContent="Criar personagem"}
  });
  irFicha.addEventListener("click",()=>{if(personagemCriadoId)location.href=caminho("ficha",personagemCriadoId)});
}

async function iniciarSelecao(){
  document.querySelector("#campanha-atual").textContent=campanha;
  const grade=document.querySelector("#grade-personagens");
  const {data,error}=await auth.cliente.from("personagens").select("id,nome,foto_path,criado_em").eq("usuario_id",auth.usuario.id).eq("rpg",rpg).eq("campanha",campanha).order("criado_em");
  if(error){grade.innerHTML='<p class="vazio">Não foi possível carregar seus personagens.</p>';return}
  if(!data.length){location.replace(caminho("criar"));return}
  for(const p of data){const foto=await urlFoto(p.foto_path);const card=document.createElement("article");card.className="cartao-personagem";card.tabIndex=0;card.dataset.id=p.id;card.innerHTML=`${foto?`<img class="foto-cartao" src="${foto}" alt="Foto de ${p.nome}">`:`<div class="foto-cartao"></div>`}<div class="cartao-conteudo"><h2></h2><p>Perfil de teste</p><span class="status">Selecionado</span><button class="botao" type="button">Selecionar</button></div>`;card.querySelector("h2").textContent=p.nome;const selecionar=()=>{document.querySelectorAll(".cartao-personagem").forEach(c=>c.classList.remove("selecionado"));card.classList.add("selecionado");personagemSelecionadoId=p.id;document.querySelector("#entrar-campanha").disabled=false};card.addEventListener("click",selecionar);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selecionar()}});grade.appendChild(card)}
  const novo=document.createElement("article");novo.className="cartao-personagem novo";novo.tabIndex=0;novo.innerHTML='<div><div class="mais">+</div><div class="cartao-conteudo"><h2>Novo personagem</h2><p>Crie outro herói para experimentar a campanha</p><button class="botao" type="button">Criar personagem</button></div></div>';novo.addEventListener("click",()=>location.href=caminho("criar"));grade.appendChild(novo);
  document.querySelector("#entrar-campanha").addEventListener("click",()=>{if(personagemSelecionadoId)location.href=caminho("ficha",personagemSelecionadoId)});
}

async function iniciarFicha(){
  const id=qs.get("id");if(!id){location.replace(caminho("selecionar"));return}
  const {data,error}=await auth.cliente.from("personagens").select("*").eq("id",id).eq("usuario_id",auth.usuario.id).maybeSingle();
  if(error||!data){document.querySelector("#mensagem").textContent="Personagem não encontrado.";return}
  document.querySelector("#nome-ficha").textContent=data.nome;
  const nomeJogador=auth.usuario.user_metadata?.nome_exibicao||auth.usuario.user_metadata?.name||auth.usuario.email?.split("@")[0]||"Jogador";
  document.querySelector("#jogador-ficha").textContent=nomeJogador;
  const foto=await urlFoto(data.foto_path),retrato=document.querySelector("#foto-ficha"),vazio=document.querySelector("#retrato-vazio");
  if(foto){retrato.src=foto;retrato.addEventListener("load",()=>vazio.hidden=true,{once:true})}

  let valoresFicha={
    nivel:data.nivel??0,vida_atual:data.vida_atual??15,vida_max:data.vida_max??15,
    energia_atual:data.energia_atual??0,energia_max:data.energia_max??0,
    experiencia:data.experiencia??0,agilidade:data.agilidade??0,forca:data.forca??0,
    apt_magica:data.apt_magica??0,presenca:data.presenca??0,resistencia:data.resistencia??0,
    pontos_atributo:data.pontos_atributo??5
  };
  aplicarValoresFicha(valoresFicha);

  document.querySelectorAll(".atributo[data-atributo]").forEach(botao=>{
    botao.addEventListener("click",async()=>{
      if(valoresFicha.pontos_atributo<=0)return;
      const campo=botao.dataset.atributo;
      document.querySelectorAll(".atributo[data-atributo]").forEach(b=>b.disabled=true);
      mensagem("Salvando ponto de atributo...");
      const {data:atualizado,error:erroAtributo}=await auth.cliente.from("personagens")
        .update({[campo]:(valoresFicha[campo]||0)+1})
        .eq("id",id).eq("usuario_id",auth.usuario.id)
        .select("nivel,vida_atual,vida_max,energia_atual,energia_max,experiencia,agilidade,forca,apt_magica,presenca,resistencia,pontos_atributo")
        .single();
      if(erroAtributo){mensagem(erroAtributo.message.includes("column")?"Execute o arquivo ficha-schema-v2.sql no Supabase antes de distribuir os pontos.":"Não foi possível salvar o atributo.");aplicarValoresFicha(valoresFicha);return}
      valoresFicha=atualizado;aplicarValoresFicha(valoresFicha);mensagem("Ponto salvo!",true);
    });
  });

  const lista=document.querySelector("#lista-pericias");
  PERICIAS_FICHA.forEach(([nome,atributo])=>{
    const linha=document.createElement("button");linha.type="button";linha.className="pericia";
    linha.innerHTML="<span></span><span></span><span>0</span><span>0</span>";
    linha.children[0].textContent=nome;linha.children[1].textContent=`(${atributo})`;
    linha.title=`Rolar ${nome}`;
    linha.addEventListener("click",()=>rolarDados(1,0,`${nome}: `));lista.appendChild(linha);
  });

  const formDados=document.querySelector("#form-dados");
  formDados.addEventListener("submit",e=>{
    e.preventDefault();
    const quantidade=Math.min(20,Math.max(1,Number(document.querySelector("#quantidade-dados").value)||1));
    const modificador=Math.min(99,Math.max(-99,Number(document.querySelector("#modificador-dados").value)||0));
    rolarDados(quantidade,modificador);
  });
}

function aplicarValoresFicha(valores){
  const nomes=["agilidade","forca","apt_magica","presenca","resistencia"];
  nomes.forEach(nome=>{const botao=document.querySelector(`.atributo[data-atributo="${nome}"]`);if(botao){botao.querySelector("strong").textContent=valores[nome]??0;botao.disabled=(valores.pontos_atributo??0)<=0}});
  const pontos=document.querySelector("#pontos-atributo");
  if(pontos){pontos.querySelector("strong").textContent=valores.pontos_atributo??0;pontos.classList.toggle("esgotado",(valores.pontos_atributo??0)<=0)}
  document.querySelector("#nivel-ficha").textContent=valores.nivel??0;
  document.querySelector("#experiencia-ficha").textContent=`${valores.experiencia??0}%`;
  document.querySelector("#vida-ficha").textContent=`${valores.vida_atual??15} / ${valores.vida_max??15}`;
  document.querySelector("#energia-ficha").textContent=`${valores.energia_atual??0} / ${valores.energia_max??0}`;
  document.querySelector("#barra-vida").style.setProperty("--valor",`${valores.vida_max?Math.max(0,Math.min(100,valores.vida_atual/valores.vida_max*100)):0}%`);
  document.querySelector("#barra-energia").style.setProperty("--valor",`${valores.energia_max?Math.max(0,Math.min(100,valores.energia_atual/valores.energia_max*100)):0}%`);
}

function rolarDados(quantidade=1,modificador=0,prefixo=""){
  const resultados=Array.from({length:quantidade},()=>Math.floor(Math.random()*20)+1);
  const total=resultados.reduce((soma,valor)=>soma+valor,0)+modificador;
  const detalhe=resultados.join(" + ")+(modificador?` ${modificador>0?"+":"−"} ${Math.abs(modificador)}`:"");
  const saida=document.querySelector("#resultado-dados");
  saida.textContent=`${prefixo}${detalhe} = ${total}`;saida.classList.remove("animando");void saida.offsetWidth;saida.classList.add("animando");
}

document.addEventListener("DOMContentLoaded",async()=>{auth=await obterAuth();document.querySelector(".pagina").hidden=false;if(pagina==="criar")await iniciarCriacao();if(pagina==="selecionar")await iniciarSelecao();if(pagina==="ficha")await iniciarFicha()});
