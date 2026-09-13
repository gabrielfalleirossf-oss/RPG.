window.iniciarAcoesMestreV8=async function(){
 const auth=window.RPG_AUTH,qs=new URLSearchParams(location.search),campanha=qs.get("campanha")||"Testes",rpg=document.body.dataset.rpg;
 if(auth?.perfil!=="mestre"||document.querySelector("#abrir-acoes-mestre"))return;
 const estilo=document.createElement("link");estilo.rel="stylesheet";estilo.href="../../../acoes-mestre-v8.css";document.head.appendChild(estilo);
 const css=document.createElement("link");css.rel="stylesheet";css.href="../../../acoes-mestre-v8.css";document.head.appendChild(css);
 const topo=document.querySelector(".escudo-campanha .escudo-resumo-topo"),mais=document.createElement("button");mais.id="abrir-acoes-mestre";mais.className="abrir-acoes-mestre";mais.type="button";mais.textContent="+";mais.title="Ações do Mestre";mais.setAttribute("aria-label","Abrir ações do Mestre");topo.appendChild(mais);
 const mensagem=(texto,sucesso=false)=>{const el=document.querySelector("#aviso-mestre");el.textContent=texto;el.classList.toggle("sucesso",sucesso)};
 async function jogadores(){
  const {data,error}=await auth.cliente.from("personagens").select("id,usuario_id,nome,foto_path,nivel,experiencia").eq("rpg",rpg).eq("campanha",campanha).order("criado_em");
  if(error)throw error;
  return Promise.all(data.map(async p=>{const {data:nome}=await auth.cliente.rpc("nome_jogador_da_ficha",{ficha_id:p.id});return {...p,jogador:nome||"Jogador"}}));
 }
 async function enviarImagem(arquivo,pasta){
  if(!arquivo)return null;if(arquivo.size>5242880||!["image/png","image/jpeg","image/webp"].includes(arquivo.type))throw Error("A imagem deve ser PNG, JPG ou WEBP, com até 5 MB.");
  const ext={"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[arquivo.type],path=auth.usuario.id+"/"+rpg+"/"+pasta+"/"+crypto.randomUUID()+"."+ext;
  const {error}=await auth.cliente.storage.from("personagens").upload(path,arquivo);if(error)throw error;return path;
 }
 function criarDialog(){
  const d=document.createElement("dialog");d.className="acoes-mestre-dialog";d.innerHTML='<div class="acoes-mestre-corpo"><header><div><small>Comandos da campanha</small><h2>Ações do Mestre</h2></div><button class="fechar-acoes" type="button" aria-label="Fechar">×</button></header><div id="conteudo-acoes"></div><p id="status-acoes"></p></div>';
  d.querySelector(".fechar-acoes").onclick=()=>d.close();d.addEventListener("close",()=>d.remove(),{once:true});document.body.appendChild(d);return d;
 }
 function status(d,texto,erro=false){const el=d.querySelector("#status-acoes");el.textContent=texto;el.classList.toggle("erro",erro)}
 async function abrirSelecao(){
  const d=criarDialog();d.showModal();status(d,"Carregando jogadores...");
  try{
   const lista=await jogadores(),area=d.querySelector("#conteudo-acoes");status(d,"");
   area.innerHTML='<section class="selecao-jogadores"><h3>Selecione os jogadores</h3><div class="lista-selecao"></div><button id="continuar-acoes" type="button">Continuar</button></section>';
   const grade=area.querySelector(".lista-selecao");
   if(!lista.length){grade.textContent="Nenhum personagem nesta campanha.";area.querySelector("#continuar-acoes").disabled=true}
   lista.forEach(p=>{const label=document.createElement("label");label.className="jogador-selecao";const input=document.createElement("input");input.type="checkbox";input.value=p.id;label.append(input);const div=document.createElement("div");const strong=document.createElement("strong");strong.textContent=p.jogador;const span=document.createElement("span");span.textContent=p.nome+" · Nível "+(p.nivel??0)+" · "+(p.experiencia??0)+" XP";div.append(strong,span);label.appendChild(div);grade.appendChild(label)});
   area.querySelector("#continuar-acoes").onclick=()=>{const ids=[...grade.querySelectorAll("input:checked")].map(i=>i.value),selecionados=lista.filter(p=>ids.includes(p.id));if(!ids.length){status(d,"Selecione pelo menos um jogador.",true);return}mostrarMenu(d,selecionados)};
  }catch(e){status(d,e.message,true)}
 }
 function mostrarMenu(d,selecionados){
  const area=d.querySelector("#conteudo-acoes");status(d,selecionados.length+" selecionado(s)");
  area.innerHTML='<section class="menu-acoes"><h3>O que deseja fazer?</h3><div><button data-acao="recado">✉<span>Dar um recado</span></button><button data-acao="habilidade">✦<span>Adicionar habilidade</span></button><button data-acao="item">◇<span>Adicionar item</span></button><button data-acao="xp">↑<span>Upar level/XP</span></button><button data-acao="confronto">⚔<span>Adicionar confronto</span></button></div></section>';
  area.querySelectorAll("[data-acao]").forEach(b=>b.onclick=()=>b.dataset.acao==="confronto"?mostrarConfronto(d,selecionados):mostrarFormulario(d,selecionados,b.dataset.acao));
 }
 async function mostrarConfronto(d,selecionados){
  if(selecionados.length!==1){status(d,"Para iniciar um confronto, selecione exatamente um personagem na primeira etapa.",true);return}
  const principal=selecionados[0],area=d.querySelector("#conteudo-acoes");area.innerHTML='<section class="selecao-jogadores"><button class="voltar-menu" type="button">← Voltar</button><h3>Quem enfrentará '+principal.nome+'?</h3><p>Escolha outro personagem, NPC ou monstro desta campanha.</p><div class="lista-selecao" id="oponentes-confronto"></div><button id="iniciar-confronto" type="button">Iniciar confronto</button></section>';area.querySelector(".voltar-menu").onclick=()=>mostrarMenu(d,selecionados);status(d,"Carregando oponentes...");
  const [{data:personagens,error:erroP},{data:npcs,error:erroN}]=await Promise.all([
   auth.cliente.from("personagens").select("id,nome,nivel").eq("rpg",rpg).eq("campanha",campanha).neq("id",principal.id).order("nome"),
   auth.cliente.from("npcs_monstros").select("id,nome,tipo").eq("rpg",rpg).eq("campanha",campanha).order("nome")
  ]);if(erroP||erroN){status(d,(erroP||erroN).message,true);return}
  const lista=area.querySelector("#oponentes-confronto"),oponentes=[...(personagens||[]).map(p=>({...p,tipo_oponente:"personagem",subtitulo:"Personagem · Nível "+(p.nivel??0)})),...(npcs||[]).map(n=>({...n,tipo_oponente:"npc",subtitulo:n.tipo}))];
  if(!oponentes.length){lista.textContent="Não há outro personagem, NPC ou monstro disponível.";area.querySelector("#iniciar-confronto").disabled=true}
  oponentes.forEach((p,i)=>{const label=document.createElement("label");label.className="jogador-selecao";const input=document.createElement("input");input.type="radio";input.name="oponente";input.value=p.id;input.dataset.tipo=p.tipo_oponente;if(i===0)input.checked=true;const div=document.createElement("div"),strong=document.createElement("strong"),span=document.createElement("span");strong.textContent=p.nome;span.textContent=p.subtitulo;div.append(strong,span);label.append(input,div);lista.appendChild(label)});status(d,"");
  area.querySelector("#iniciar-confronto").onclick=async()=>{const escolhido=lista.querySelector("input:checked");if(!escolhido){status(d,"Escolha um oponente.",true);return}const botao=area.querySelector("#iniciar-confronto");botao.disabled=true;status(d,"Preparando confronto...");const {data:id,error}=await auth.cliente.rpc("iniciar_confronto_mestre",{ficha_principal:principal.id,tipo_oponente:escolhido.dataset.tipo,oponente_id:escolhido.value});if(error){status(d,error.message,true);botao.disabled=false;return}const url="../confronto/index.html?campanha="+encodeURIComponent(campanha)+"&confronto="+id;window.open(url,"_blank","noopener");status(d,"Confronto iniciado! A ficha foi aberta em uma nova guia.");setTimeout(()=>d.close(),900)};
 }
 function formularioBase(titulo,campos){
  return '<form class="form-acao"><button class="voltar-menu" type="button">← Voltar</button><h3>'+titulo+'</h3>'+campos+'<button class="confirmar-acao" type="submit">Confirmar</button></form>';
 }
 function mostrarFormulario(d,selecionados,acao){
  const area=d.querySelector("#conteudo-acoes");
  if(acao==="recado")area.innerHTML=formularioBase("Dar um recado",'<label>Recado<textarea name="mensagem" required maxlength="5000"></textarea></label><label>Imagem opcional<input name="foto" type="file" accept="image/png,image/jpeg,image/webp"></label>');
  if(acao==="habilidade")area.innerHTML=formularioBase("Adicionar habilidade",'<label>Nome<input name="nome" required maxlength="100"></label><label>Descrição<textarea name="descricao" maxlength="3000"></textarea></label><label>Imagem opcional<input name="foto" type="file" accept="image/png,image/jpeg,image/webp"></label>');
  if(acao==="item")area.innerHTML=formularioBase("Adicionar item",'<label>Nome<input name="nome" required maxlength="100"></label><label>Descrição<textarea name="descricao" maxlength="3000"></textarea></label><label>Bônus<input name="bonus" maxlength="200" placeholder="+2 Defesa, cura 5..."></label><label>Imagem opcional<input name="foto" type="file" accept="image/png,image/jpeg,image/webp"></label>');
  if(acao==="xp")area.innerHTML=formularioBase("Upar level/XP",'<div class="progresso-opcoes"><label>Adicionar XP<input name="xp" type="number" min="0" max="100000" value="0"></label><label>Adicionar níveis diretamente<input name="niveis" type="number" min="0" max="1000" value="0"></label></div><p class="explicacao-xp">Cada nível concede 3 pontos de atributo. O XP excedente continua para o próximo nível.</p>');
  const form=area.querySelector("form");form.querySelector(".voltar-menu").onclick=()=>mostrarMenu(d,selecionados);
  form.onsubmit=async e=>{
   e.preventDefault();const botao=form.querySelector(".confirmar-acao");botao.disabled=true;status(d,"Aplicando ação...");
   try{
    if(acao==="recado"){
     const path=await enviarImagem(form.foto.files[0],"recados"),unicos=[...new Map(selecionados.map(p=>[p.usuario_id,p])).values()];
     for(const p of unicos){const {error}=await auth.cliente.rpc("enviar_recado_mestre",{alvo_personagem:p.id,texto:form.mensagem.value,imagem_path:path});if(error)throw error}
    }
    if(acao==="habilidade"||acao==="item"){
     const path=await enviarImagem(form.foto.files[0],acao==="item"?"itens":"habilidades"),tabela=acao==="item"?"itens_personagem":"habilidades_personagem";
     const registros=selecionados.map(p=>{const o={personagem_id:p.id,nome:form.nome.value.trim(),descricao:form.descricao.value.trim(),foto_path:path,criado_por:auth.usuario.id};if(acao==="item")o.bonus=form.bonus.value.trim();return o});
     const {error}=await auth.cliente.from(tabela).insert(registros);if(error)throw error;
    }
    if(acao==="xp"){
     const xp=Number(form.xp.value)||0,niveis=Number(form.niveis.value)||0;if(!xp&&!niveis)throw Error("Digite uma quantidade de XP ou níveis.");
     const {error}=await auth.cliente.rpc("conceder_progresso_mestre",{alvos:selecionados.map(p=>p.id),xp_adicional:xp,niveis_adicionais:niveis});if(error)throw error;
    }
    status(d,"Ação concluída!",false);document.querySelector("#atualizar-escudo")?.click();setTimeout(()=>d.close(),700);
   }catch(e){status(d,e.message||"Não foi possível concluir.",true);botao.disabled=false}
  };
 }
 mais.onclick=abrirSelecao;
};
