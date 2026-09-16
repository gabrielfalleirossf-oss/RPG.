const qs = new URLSearchParams(location.search);
const campanha = qs.get("campanha") || "Testes";
const rpg = document.body.dataset.rpg;
const pagina = document.body.dataset.pagina;
let auth, personagemCriadoId, personagemSelecionadoId;

const ORIGENS = {
  Nerd:{imagem:"../../../assets/origens/nerd.png?v=21",descricao:"Um jovem extremamente focado nos estudos. Sua busca incansável por conhecimento cobrou um preço: alimentação ruim, nenhuma atividade física e um corpo pouco saudável.",pericias:{Medicina:2,"Sobrevivência":1,"Percepção":3,"Investigação":1},atributos:{presenca:3,apt_magica:2,forca:-2,agilidade:-2,resistencia:-2}},
  Lutador:{imagem:"../../../assets/origens/lutador.png?v=21",descricao:"Desde cedo encontrou sua paixão nas artes marciais e fez do treino uma obsessão. Seu corpo tornou-se uma arma letal e um escudo impenetrável, mas seu crescente ceticismo o fez acreditar que tudo pode ser resolvido com os punhos.",pericias:{Esquiva:2,HtH:3,Bloqueio:2},atributos:{agilidade:2,forca:1,apt_magica:-4}},
  Bodybuilder:{imagem:"../../../assets/origens/bodybuilder.png?v=21",descricao:"Encontrou na academia sua própria forma de superação. Treina de maneira obstinada, transformando o corpo enquanto ignora dores e articulações sobrecarregadas. Não acredita no sobrenatural: acredita apenas em si mesmo.",pericias:{Bloqueio:3,Vontade:3,Iniciativa:1},atributos:{forca:3,resistencia:2,agilidade:-2,apt_magica:-3}}
};
window.RPG_ORIGENS=ORIGENS;
function dadosOrigem(nome){return ORIGENS[nome]||{pericias:{},atributos:{}}}
function valorComOrigem(valores,campo){return (Number(valores[campo])||0)+(Number(dadosOrigem(valores.origem).atributos[campo])||0)}

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
  const form=document.querySelector("#form-personagem"),arquivo=document.querySelector("#foto"),preview=document.querySelector("#preview"),upload=document.querySelector(".upload"),irFicha=document.querySelector("#ir-ficha");let origemSelecionada="";
  const origemArea=document.createElement("section");origemArea.className="selecao-origem campo largo";origemArea.innerHTML='<header><label>Origem do personagem</label><p>Escolha uma origem para conhecer sua história e seus modificadores.</p></header><div class="grade-origens"></div>';
  form.querySelector(".campos").insertBefore(origemArea,form.querySelector(".campo.historia"));
  const formatarBonus=o=>[...Object.entries(o.pericias).map(([n,v])=>`${v>0?"+":""}${v} ${n}`),...Object.entries(o.atributos).map(([n,v])=>`${v>0?"+":""}${v} ${n.replace("apt_magica","Apt. Mágica")}`)].join(" · ");
  Object.entries(ORIGENS).forEach(([nome,o])=>{const b=document.createElement("button");b.type="button";b.className="cartao-origem";b.innerHTML=`<img src="${o.imagem}" alt=""><span><strong>${nome}</strong><small></small><em></em></span>`;b.querySelector("small").textContent=o.descricao;b.querySelector("em").textContent=formatarBonus(o);b.onclick=()=>{origemSelecionada=nome;origemArea.querySelectorAll(".cartao-origem").forEach(x=>x.classList.toggle("selecionada",x===b))};origemArea.querySelector(".grade-origens").appendChild(b)});
  arquivo.addEventListener("change",()=>{const f=arquivo.files[0];if(!f)return;if(f.size>5*1024*1024){mensagem("A imagem precisa ter no máximo 5 MB.");arquivo.value="";return}preview.src=URL.createObjectURL(f);upload.classList.add("tem-foto")});
  document.querySelectorAll("textarea[maxlength]").forEach(el=>{const out=el.parentElement.querySelector(".contador");const atualizar=()=>out.textContent=`${el.value.length}/${el.maxLength}`;el.addEventListener("input",atualizar);atualizar()});
  form.addEventListener("submit",async e=>{
    e.preventDefault();mensagem("");const salvar=document.querySelector("#criar-personagem");salvar.disabled=true;salvar.textContent="Criando...";
    try{
      if(!origemSelecionada)throw Error("Escolha uma origem para o personagem.");
      const id=crypto.randomUUID();let fotoPath=null;const foto=arquivo.files[0];
      if(foto){const ext=(foto.name.split(".").pop()||"jpg").toLowerCase();fotoPath=`${auth.usuario.id}/${rpg}/${campanha}/${id}.${ext}`;const {error}=await auth.cliente.storage.from("personagens").upload(fotoPath,foto,{upsert:false});if(error)throw error}
      const registro={id,usuario_id:auth.usuario.id,rpg,campanha,origem:origemSelecionada,nome:form.nome.value.trim(),historia:form.historia.value.trim(),personalidade:form.personalidade.value.trim(),objetivos:form.objetivos.value.trim(),anotacoes:form.anotacoes.value.trim(),foto_path:fotoPath};
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
  for(const p of data){
    const foto=await urlFoto(p.foto_path),card=document.createElement("article");card.className="cartao-personagem";card.tabIndex=0;card.dataset.id=p.id;
    card.innerHTML=`${foto?`<img class="foto-cartao" src="${foto}" alt="Foto de ${p.nome}">`:`<div class="foto-cartao"></div>`}<div class="cartao-conteudo"><h2></h2><p>Perfil de teste</p><span class="status">Selecionado</span><button class="botao" type="button">Selecionar</button></div>`;
    card.querySelector("h2").textContent=p.nome;
    const selecionar=()=>{document.querySelectorAll(".cartao-personagem").forEach(c=>c.classList.remove("selecionado"));card.classList.add("selecionado");personagemSelecionadoId=p.id;document.querySelector("#entrar-campanha").disabled=false};
    card.addEventListener("click",selecionar);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selecionar()}});
    if(campanha==="Testes"){
      const apagar=document.createElement("button");apagar.type="button";apagar.className="apagar-personagem";apagar.title="Apagar personagem";apagar.setAttribute("aria-label",`Apagar ${p.nome}`);apagar.textContent="🗑";
      apagar.addEventListener("click",async e=>{e.preventDefault();e.stopPropagation();if(!confirm(`Apagar ${p.nome}? Esta ação não poderá ser desfeita.`))return;apagar.disabled=true;mensagem("Apagando personagem...");const{error:erroApagar}=await auth.cliente.from("personagens").delete().eq("id",p.id).eq("usuario_id",auth.usuario.id).eq("campanha","Testes");if(erroApagar){mensagem("Não foi possível apagar: "+erroApagar.message);apagar.disabled=false;return}if(p.foto_path)await auth.cliente.storage.from("personagens").remove([p.foto_path]);card.remove();if(personagemSelecionadoId===p.id){personagemSelecionadoId=null;document.querySelector("#entrar-campanha").disabled=true}mensagem(`${p.nome} foi apagado.`,true);if(!grade.querySelector(".cartao-personagem:not(.novo)"))location.replace(caminho("criar"))});
      card.appendChild(apagar);
    }
    grade.appendChild(card);
  }
  const novo=document.createElement("article");novo.className="cartao-personagem novo";novo.tabIndex=0;novo.innerHTML='<div><div class="mais">+</div><div class="cartao-conteudo"><h2>Novo personagem</h2><p>Crie outro herói para experimentar a campanha</p><button class="botao" type="button">Criar personagem</button></div></div>';novo.addEventListener("click",()=>location.href=caminho("criar"));grade.appendChild(novo);
  document.querySelector("#entrar-campanha").addEventListener("click",()=>{if(personagemSelecionadoId)location.href=caminho("ficha",personagemSelecionadoId)});
}

async function iniciarFicha(){
  const id=qs.get("id");if(!id){location.replace(caminho("selecionar"));return}
  const {data,error}=await auth.cliente.from("personagens").select("*").eq("id",id).eq("usuario_id",auth.usuario.id).maybeSingle();
  if(error||!data){document.querySelector("#mensagem").textContent="Personagem não encontrado.";return}
  document.querySelector("#nome-ficha").textContent=data.nome;
  document.querySelectorAll(".identidade-dados div").forEach(div=>{if(div.querySelector("dt")?.textContent.trim()==="Origem")div.querySelector("dd").textContent=data.origem||"Desconhecida"});
  const nomeJogador=auth.usuario.user_metadata?.nome_exibicao||auth.usuario.user_metadata?.name||auth.usuario.email?.split("@")[0]||"Jogador";
  document.querySelector("#jogador-ficha").textContent=nomeJogador;
  const foto=await urlFoto(data.foto_path),retrato=document.querySelector("#foto-ficha"),vazio=document.querySelector("#retrato-vazio");
  if(foto){retrato.src=foto;retrato.addEventListener("load",()=>vazio.hidden=true,{once:true})}

  let valoresFicha={
    nivel:data.nivel??0,vida_atual:data.vida_atual??15,vida_max:data.vida_max??15,
    energia_atual:data.energia_atual??0,energia_max:data.energia_max??0,
    experiencia:data.experiencia??0,agilidade:data.agilidade??0,forca:data.forca??0,
    apt_magica:data.apt_magica??0,presenca:data.presenca??0,resistencia:data.resistencia??0,
    pontos_atributo:data.pontos_atributo??5,origem:data.origem||""
  };
  aplicarValoresFicha(valoresFicha);
  window.addEventListener("rpg:ficha-atualizada",evento=>{
    const atualizada=evento.detail;if(atualizada?.id!==id)return;
    valoresFicha={...valoresFicha,...atualizada};aplicarValoresFicha(valoresFicha);
  });

  document.querySelectorAll(".atributo[data-atributo]").forEach(botao=>{
    botao.addEventListener("click",async()=>{
      if(valoresFicha.pontos_atributo<=0)return;
      const campo=botao.dataset.atributo;
      document.querySelectorAll(".atributo[data-atributo]").forEach(b=>b.disabled=true);
      mensagem("Salvando ponto de atributo...");
      const {data:atualizado,error:erroAtributo}=await auth.cliente.from("personagens")
        .update({[campo]:(valoresFicha[campo]||0)+1})
        .eq("id",id).eq("usuario_id",auth.usuario.id)
        .select("nivel,vida_atual,vida_max,energia_atual,energia_max,experiencia,agilidade,forca,apt_magica,presenca,resistencia,pontos_atributo,origem")
        .single();
      if(erroAtributo){mensagem(erroAtributo.message.includes("column")?"Execute o arquivo ficha-schema-v2.sql no Supabase antes de distribuir os pontos.":"Não foi possível salvar o atributo.");aplicarValoresFicha(valoresFicha);return}
      valoresFicha=atualizado;aplicarValoresFicha(valoresFicha);mensagem("Ponto salvo!",true);
    });
  });

  const lista=document.querySelector("#lista-pericias");
  PERICIAS_FICHA.forEach(([nome,atributo])=>{
    const linha=document.createElement("button");linha.type="button";linha.className="pericia";
    const bonus=Number(dadosOrigem(data.origem).pericias[nome])||0;linha.innerHTML="<span></span><span></span><span></span><span>0</span>";
    linha.children[0].textContent=nome;linha.children[1].textContent=`(${atributo})`;
    linha.children[2].textContent=bonus>0?`+${bonus}`:String(bonus);
    linha.title=`Rolar ${nome}`;
    linha.addEventListener("click",()=>rolarDados(1,bonus,`${nome}: `));lista.appendChild(linha);
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
  nomes.forEach(nome=>{const botao=document.querySelector(`.atributo[data-atributo="${nome}"]`);if(botao){botao.querySelector("strong").textContent=valorComOrigem(valores,nome);botao.disabled=(valores.pontos_atributo??0)<=0}});
  const pontos=document.querySelector("#pontos-atributo");
  if(pontos){pontos.querySelector("strong").textContent=valores.pontos_atributo??0;pontos.classList.toggle("esgotado",(valores.pontos_atributo??0)<=0)}
  document.querySelector("#nivel-ficha").textContent=valores.nivel??0;
  const nivelAtual=valores.nivel??0,proximoXp=100+Math.floor(nivelAtual/5)*10;
  document.querySelector("#experiencia-ficha").textContent=`${valores.experiencia??0} / ${proximoXp} XP`;
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

async function carregarRecursosDaFicha(){const estilo=document.createElement("link");estilo.rel="stylesheet";estilo.href="../../../ficha-recursos.css?v=21";document.head.appendChild(estilo);await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="../../../ficha-recursos.js?v=21";script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});await window.iniciarRecursosFicha()}
document.addEventListener("DOMContentLoaded",async()=>{auth=await obterAuth();document.querySelector(".pagina").hidden=false;if(pagina==="criar")await iniciarCriacao();if(pagina==="selecionar")await iniciarSelecao();if(pagina==="ficha"){await iniciarFicha();await carregarRecursosDaFicha()}});
