const parametrosMestre=new URLSearchParams(location.search);
const campanhaMestre=parametrosMestre.get("campanha")||"Testes";
const rpgMestre=document.body.dataset.rpg;
const paginaMestre=document.body.dataset.masterPage;
if(paginaMestre==="editar"){const estilo=document.createElement("link");estilo.rel="stylesheet";estilo.href="../../../mestre-ficha.css";document.head.appendChild(estilo)}
let acessoMestre;

function obterAcessoMestre(){
  if(window.RPG_AUTH)return Promise.resolve(window.RPG_AUTH);
  return new Promise(resolve=>document.addEventListener("rpg:auth-pronto",evento=>resolve(evento.detail),{once:true}));
}
function avisoMestre(texto,sucesso=false){const el=document.querySelector("#aviso-mestre");el.textContent=texto;el.classList.toggle("sucesso",sucesso)}
async function fotoPersonagem(path){if(!path)return null;const {data}=await acessoMestre.cliente.storage.from("personagens").createSignedUrl(path,3600);return data?.signedUrl||null}

async function listarPersonagens(){
  document.querySelector("#campanha-mestre").textContent=campanhaMestre;
  const grade=document.querySelector("#grade-mestre");
  const {data,error}=await acessoMestre.cliente.from("personagens")
    .select("id,nome,foto_path,nivel,vida_atual,vida_max,energia_atual,energia_max,criado_em")
    .eq("rpg",rpgMestre).eq("campanha",campanhaMestre).order("criado_em",{ascending:true});
  if(error){avisoMestre("Não foi possível carregar as fichas. Confira se mestre-schema-v1.sql foi executado.");return}
  if(!data.length){grade.innerHTML='<p class="mestre-vazio">Nenhum jogador criou personagem nesta campanha ainda.</p>';return}
  for(const personagem of data){
    const foto=await fotoPersonagem(personagem.foto_path),card=document.createElement("a");
    card.className="mestre-card";card.href=`../ficha/index.html?campanha=${encodeURIComponent(campanhaMestre)}&id=${personagem.id}`;
    const visual=document.createElement(foto?"img":"div");visual.className="mestre-card-foto";if(foto){visual.src=foto;visual.alt=`Foto de ${personagem.nome}`}else visual.textContent="?";
    const conteudo=document.createElement("div");conteudo.className="mestre-card-conteudo";
    const nome=document.createElement("h2");nome.textContent=personagem.nome;
    const status=document.createElement("p");status.textContent=`Nível ${personagem.nivel??0} · Vida ${personagem.vida_atual??15}/${personagem.vida_max??15} · Energia ${personagem.energia_atual??0}/${personagem.energia_max??0}`;
    const abrir=document.createElement("span");abrir.textContent="Abrir ficha →";
    conteudo.append(nome,status,abrir);card.append(visual,conteudo);grade.appendChild(card);
  }
}

async function editarPersonagem(){
  const id=parametrosMestre.get("id");if(!id){location.replace(`../personagens/index.html?campanha=${encodeURIComponent(campanhaMestre)}`);return}
  const {data,error}=await acessoMestre.cliente.from("personagens").select("*").eq("id",id).eq("rpg",rpgMestre).maybeSingle();
  if(error||!data){avisoMestre("Ficha não encontrada ou sem permissão de Mestre.");return}
  document.querySelector("#campanha-mestre").textContent=campanhaMestre;
  document.querySelector("#titulo-personagem-mestre").textContent=data.nome;
  document.querySelector("#voltar-personagens").href=`../personagens/index.html?campanha=${encodeURIComponent(campanhaMestre)}`;
  const form=document.querySelector("#form-ficha-mestre");
  const campos=["nome","historia","personalidade","objetivos","anotacoes","nivel","vida_atual","vida_max","experiencia","agilidade","forca","apt_magica","presenca","resistencia"];
  const preencher=valores=>campos.forEach(campo=>{form.elements[campo].value=valores[campo]??({vida_atual:15,vida_max:15}[campo]??0)});
  preencher(data);let valoresSalvos=Object.fromEntries(campos.map(campo=>[campo,form.elements[campo].value]));
  const foto=await fotoPersonagem(data.foto_path);if(foto){const img=document.querySelector("#foto-mestre");img.src=foto;img.hidden=false;document.querySelector("#foto-mestre-vazia").hidden=true}
  const atualizarPontos=()=>{
    const atributos=["agilidade","forca","apt_magica","presenca","resistencia"].map(c=>Math.max(0,Number(form.elements[c].value)||0));
    const restante=5-atributos.reduce((s,v)=>s+v,0),pontos=document.querySelector("#pontos-restantes-mestre");
    pontos.textContent=restante>=0?`${restante} ponto(s) disponível(is)`: `${Math.abs(restante)} ponto(s) acima do limite`;
    pontos.classList.toggle("erro",restante<0);document.querySelector("#energia-calculada").textContent=`${atributos[2]*5} / ${atributos[2]*5}`;return restante;
  };
  form.querySelectorAll(".campo-atributo input").forEach(input=>input.addEventListener("input",atualizarPontos));atualizarPontos();
  const botaoEditar=document.querySelector("#editar-ficha-mestre"),acoes=document.querySelector("#acoes-edicao"),estado=document.querySelector("#estado-ficha");
  const definirEdicao=editando=>{
    form.querySelectorAll("input,textarea").forEach(campo=>campo.disabled=!editando);
    form.classList.toggle("modo-edicao",editando);acoes.hidden=!editando;botaoEditar.classList.toggle("ativa",editando);botaoEditar.setAttribute("aria-pressed",String(editando));
    estado.textContent=editando?"Modo de edição — altere os campos e salve":"Modo de visualização";
  };
  definirEdicao(false);
  botaoEditar.addEventListener("click",()=>definirEdicao(true));
  document.querySelector("#cancelar-edicao").addEventListener("click",()=>{preencher(valoresSalvos);atualizarPontos();avisoMestre("");definirEdicao(false)});
  document.querySelectorAll(".mestre-guia").forEach(guia=>guia.addEventListener("click",()=>{
    document.querySelectorAll(".mestre-guia").forEach(item=>item.classList.toggle("ativa",item===guia));
    document.querySelectorAll(".aba-mestre").forEach(aba=>{const ativa=aba.dataset.conteudo===guia.dataset.aba;aba.classList.toggle("ativa",ativa);aba.hidden=!ativa});
  }));
  form.addEventListener("submit",async evento=>{
    evento.preventDefault();if(atualizarPontos()<0){avisoMestre("A soma dos atributos não pode ultrapassar cinco pontos.");return}
    const botao=document.querySelector("#salvar-ficha-mestre");botao.disabled=true;botao.textContent="Salvando...";avisoMestre("");
    const valores={nome:form.nome.value.trim(),historia:form.historia.value.trim(),personalidade:form.personalidade.value.trim(),objetivos:form.objetivos.value.trim(),anotacoes:form.anotacoes.value.trim(),nivel:Number(form.nivel.value),vida_atual:Number(form.vida_atual.value),vida_max:Number(form.vida_max.value),experiencia:Number(form.experiencia.value),agilidade:Number(form.agilidade.value),forca:Number(form.forca.value),apt_magica:Number(form.apt_magica.value),presenca:Number(form.presenca.value),resistencia:Number(form.resistencia.value)};
    const {data:salvo,error:erroSalvar}=await acessoMestre.cliente.from("personagens").update(valores).eq("id",id).eq("rpg",rpgMestre).select("energia_atual,energia_max").single();
    if(erroSalvar)avisoMestre(erroSalvar.message||"Não foi possível salvar a ficha.");else{document.querySelector("#energia-calculada").textContent=`${salvo.energia_atual} / ${salvo.energia_max}`;document.querySelector("#titulo-personagem-mestre").textContent=valores.nome;valoresSalvos=Object.fromEntries(campos.map(campo=>[campo,form.elements[campo].value]));avisoMestre("Ficha salva com sucesso!",true);definirEdicao(false)}
    botao.disabled=false;botao.textContent="Salvar alterações";
  });
}

document.addEventListener("DOMContentLoaded",async()=>{acessoMestre=await obterAcessoMestre();document.querySelector(".pagina-mestre").hidden=false;if(paginaMestre==="lista"){await listarPersonagens();const script=document.createElement("script");script.src="../../../mestre-painel-v7.js";script.onload=()=>window.iniciarPainelMestreV7();document.head.appendChild(script)}if(paginaMestre==="editar")await editarPersonagem()});
