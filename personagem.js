const qs = new URLSearchParams(location.search);
const campanha = qs.get("campanha") || "Testes";
const rpg = document.body.dataset.rpg;
const pagina = document.body.dataset.pagina;
let auth, personagemCriadoId, personagemSelecionadoId;

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
  document.querySelector("#nome-ficha").textContent=data.nome;document.querySelector("#historia-ficha").textContent=data.historia||"Sem história registrada.";document.querySelector("#personalidade-ficha").textContent=data.personalidade||"Sem descrição.";document.querySelector("#objetivos-ficha").textContent=data.objetivos||"Sem objetivos registrados.";document.querySelector("#anotacoes-ficha").textContent=data.anotacoes||"Sem anotações.";const foto=await urlFoto(data.foto_path);if(foto)document.querySelector("#foto-ficha").src=foto;
}

document.addEventListener("DOMContentLoaded",async()=>{auth=await obterAuth();document.querySelector(".pagina").hidden=false;if(pagina==="criar")await iniciarCriacao();if(pagina==="selecionar")await iniciarSelecao();if(pagina==="ficha")await iniciarFicha()});
