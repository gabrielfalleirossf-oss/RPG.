window.iniciarPainelMestreV7=async function(){
  const auth=window.RPG_AUTH,qs=new URLSearchParams(location.search),campanha=qs.get("campanha")||"Testes",rpg=document.body.dataset.rpg;
  if(auth?.perfil!=="mestre")return;
  const estilo=document.createElement("link");estilo.rel="stylesheet";estilo.href="../../../mestre-painel-v7.css";document.head.appendChild(estilo);
  const main=document.querySelector(".pagina-mestre"),grade=document.querySelector("#grade-mestre"),cabecalho=document.querySelector(".mestre-cabecalho");
  const nav=document.createElement("nav");nav.className="painel-mestre-abas";nav.setAttribute("aria-label","Área da campanha");
  for(const [chave,nome] of [["jogadores","Fichas dos jogadores"],["escudo","Escudo do Mestre"],["npcs","NPCs/Monstros"]]){
    const b=document.createElement("button");b.type="button";b.dataset.painel=chave;b.textContent=nome;nav.appendChild(b);
  }
  cabecalho.after(nav);
  const escudo=document.createElement("section");escudo.className="escudo-campanha";escudo.hidden=true;
  escudo.innerHTML='<aside class="historico-mestre"><header><h2>Histórico de dados</h2><small>Rolagens dos jogadores desta campanha</small></header><div id="historico-dados" aria-live="polite"></div><button id="mais-historico" type="button">Carregar anteriores</button></aside><section><header class="escudo-resumo-topo"><h2>Jogadores da campanha</h2><button id="atualizar-escudo" type="button">↻ Atualizar</button></header><div id="resumos-campanha" class="resumos-campanha"></div></section>';
  main.appendChild(escudo);
  const npcs=document.createElement("section");npcs.className="painel-npcs";npcs.hidden=true;
  npcs.innerHTML='<header class="escudo-resumo-topo"><div><h2>NPCs e Monstros</h2><p>Fichas privadas do Mestre — sem limite de pontos.</p></div><button id="novo-npc" type="button">+ Criar ficha</button></header><div id="grade-npcs" class="resumos-campanha"></div>';
  main.appendChild(npcs);
  const atributos=[["agilidade","AGI"],["forca","FOR"],["apt_magica","APT"],["presenca","PRE"],["resistencia","RES"]];
  const aviso=(texto)=>{const p=document.querySelector("#aviso-mestre");p.textContent=texto;p.classList.remove("sucesso")};
  async function foto(path){if(!path)return "";const {data}=await auth.cliente.storage.from("personagens").createSignedUrl(path,3600);return data?.signedUrl||""}
  function texto(tag,valor,classe=""){const el=document.createElement(tag);el.textContent=valor;el.className=classe;return el}
  function barra(nome,atual,max,classe){const el=document.createElement("div");el.className="resumo-recurso "+classe;el.appendChild(texto("span",nome));const trilho=document.createElement("div");trilho.className="resumo-trilho";const fill=document.createElement("i");fill.style.width=(max?Math.min(100,Math.max(0,atual/max*100)):0)+"%";trilho.appendChild(fill);trilho.appendChild(texto("strong",atual+" / "+max));el.appendChild(trilho);return el}
  async function cartao(p,npc=false){
    const card=document.createElement("article");card.className="resumo-jogador";const header=document.createElement("header"),url=await foto(p.foto_path);
    if(url){const img=document.createElement("img");img.src=url;img.alt=p.nome;header.appendChild(img)}else header.appendChild(texto("div","?", "resumo-foto-vazia"));
    const info=document.createElement("div");info.appendChild(texto("h3",p.nome));info.appendChild(texto("small",npc?p.tipo:"Nível "+(p.nivel??0)));
    if(!npc){const {data:nome}=await auth.cliente.rpc("nome_jogador_da_ficha",{ficha_id:p.id});info.appendChild(texto("p",nome||"Jogador"))}
    header.appendChild(info);card.appendChild(header);
    const attrs=document.createElement("div");attrs.className="resumo-atributos";atributos.forEach(([campo,label])=>{const cel=document.createElement("div");cel.append(texto("small",label),texto("strong",p[campo]??0));attrs.appendChild(cel)});card.appendChild(attrs);
    card.append(barra("Vida",p.vida_atual??15,p.vida_max??15,"vida"),barra("Energia Mágica",p.energia_atual??0,p.energia_max??0,"energia"),barra("Sanidade",p.sanidade_atual??100,p.sanidade_max??100,"sanidade"));
    card.appendChild(texto("p","Defesa "+(p.defesa??10),"resumo-defesa"));
    if(npc){const b=texto("button","Abrir ficha e descrição →");b.type="button";b.onclick=()=>abrirEditorNpc(p);card.appendChild(b)}
    else{const a=texto("a","Abrir ficha →");a.href="../ficha/index.html?campanha="+encodeURIComponent(campanha)+"&id="+p.id;card.appendChild(a)}
    return card;
  }
  let tab="jogadores",ocupado=false,registros=[],anteriores=0,acabou=false;
  async function carregarResumo(){
    const {data,error}=await auth.cliente.from("personagens").select("*").eq("rpg",rpg).eq("campanha",campanha).order("criado_em");
    if(error){aviso("Não foi possível atualizar as fichas: "+error.message);return}
    const cards=await Promise.all(data.map(p=>cartao(p)));const lista=document.querySelector("#resumos-campanha");lista.replaceChildren(...cards);
    if(!data.length)lista.appendChild(texto("p","Nenhum personagem criado nesta campanha.","painel-vazio"));
  }
  function desenharHistorico(){
    const lista=document.querySelector("#historico-dados");lista.replaceChildren();
    registros.sort((a,b)=>new Date(b.criado_em)-new Date(a.criado_em));
    if(!registros.length)lista.appendChild(texto("p","As próximas rolagens dos jogadores aparecerão aqui.","painel-vazio"));
    registros.forEach(r=>{const el=document.createElement("article");el.className="rolagem-historico"+(r.critico?" critico":"");el.append(texto("small",new Date(r.criado_em).toLocaleString("pt-BR")),texto("h3",r.jogador_nome+" · "+r.personagem_nome),texto("p",r.origem+" · "+r.resultados.length+"D"+r.faces),texto("strong",r.resultados.join(" + ")+" = "+r.total));if(r.critico)el.appendChild(texto("span","Crítico!"));lista.appendChild(el)});
    document.querySelector("#mais-historico").hidden=acabou;
  }
  async function carregarHistorico(mais=false){
    let query=auth.cliente.from("rolagens_campanha").select("*").eq("rpg",rpg).eq("campanha",campanha).order("criado_em",{ascending:false}).order("id",{ascending:false});
    if(mais)query=query.range(anteriores,anteriores+99);else query=query.range(0,99);
    const {data,error}=await query;if(error){aviso("Para carregar o histórico, execute mestre-painel-v7.sql: "+error.message);return}
    if(mais||anteriores===0){anteriores+=data.length;acabou=data.length<100}
    const mapa=new Map(registros.map(r=>[r.id,r]));data.forEach(r=>mapa.set(r.id,r));registros=[...mapa.values()];desenharHistorico();
  }
  async function atualizar(){if(ocupado)return;ocupado=true;try{await Promise.all([carregarResumo(),carregarHistorico()])}finally{ocupado=false}}
  async function carregarNpcs(){
    const {data,error}=await auth.cliente.from("npcs_monstros").select("*").eq("rpg",rpg).eq("campanha",campanha).order("criado_em");
    if(error){aviso("Para criar NPCs e monstros, execute mestre-painel-v7.sql: "+error.message);return}
    const cards=await Promise.all(data.map(p=>cartao(p,true))),lista=document.querySelector("#grade-npcs");lista.replaceChildren(...cards);
    if(!data.length)lista.appendChild(texto("p","Crie seu primeiro NPC ou monstro para esta campanha.","painel-vazio"));
  }
  function abrirEditorNpc(p={}){
    const dialog=document.createElement("dialog");dialog.className="editor-npc";const form=document.createElement("form");dialog.appendChild(form);
    const header=document.createElement("header");header.appendChild(texto("h2",p.id?"Ficha de NPC/Monstro":"Criar NPC/Monstro"));const fechar=texto("button","×");fechar.type="button";fechar.setAttribute("aria-label","Fechar");fechar.onclick=()=>dialog.close();header.appendChild(fechar);form.appendChild(header);
    const campos=document.createElement("div");campos.className="npc-campos";form.appendChild(campos);
    function campo(nome,label,tipo="text",padrao="",largo=false){
      const wrap=texto("label",label);if(largo)wrap.className="npc-largo";const input=document.createElement(tipo==="textarea"?"textarea":tipo==="select"?"select":"input");input.name=nome;
      if(tipo==="select"){["NPC","Monstro"].forEach(valor=>{const op=texto("option",valor);op.value=valor;input.appendChild(op)})}
      else if(tipo!=="textarea")input.type=tipo;
      if(tipo==="number"){input.min="0";input.step="1"}
      if(nome==="nome"){input.required=true;input.maxLength=100}
      input.value=p[nome]??padrao;wrap.appendChild(input);campos.appendChild(wrap);return input;
    }
    campo("nome","Nome");campo("tipo","Tipo","select","NPC");const arquivo=campo("foto","Imagem","file");arquivo.accept="image/png,image/jpeg,image/webp";
    campo("descricao","Descrição, história e personalidade","textarea","",true);
    atributos.forEach(([nome,label])=>campo(nome,{"AGI":"Agilidade","FOR":"Força","APT":"Apt. Mágica","PRE":"Presença","RES":"Resistência"}[label],"number",0));
    for(const [nome,label,valor] of [["defesa","Defesa",10],["vida_atual","Vida atual",15],["vida_max","Vida máxima",15],["energia_atual","Energia atual",0],["energia_max","Energia máxima",0],["sanidade_atual","Sanidade atual",100],["sanidade_max","Sanidade máxima",100]])campo(nome,label,"number",valor);
    campo("ficha_livre","Ficha livre: ataques, habilidades, resistências, itens e notas","textarea","",true);
    const status=texto("p","","npc-status");form.appendChild(status);const footer=document.createElement("footer"),salvar=texto("button","Salvar ficha");salvar.type="submit";footer.appendChild(salvar);form.appendChild(footer);
    form.onsubmit=async e=>{
      e.preventDefault();salvar.disabled=true;status.textContent="Salvando...";
      try{
        const registro={rpg,campanha,nome:form.elements.nome.value.trim(),tipo:form.elements.tipo.value,descricao:form.elements.descricao.value,ficha_livre:form.elements.ficha_livre.value};
        ["agilidade","forca","apt_magica","presenca","resistencia","defesa","vida_atual","vida_max","energia_atual","energia_max","sanidade_atual","sanidade_max"].forEach(c=>registro[c]=Number(form.elements[c].value)||0);
        if(arquivo.files[0]){
          const f=arquivo.files[0];if(f.size>5242880||!["image/png","image/jpeg","image/webp"].includes(f.type))throw Error("Use PNG, JPG ou WEBP de até 5 MB.");
          const path=auth.usuario.id+"/"+rpg+"/npcs/"+crypto.randomUUID()+"."+({"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[f.type]);
          const {error}=await auth.cliente.storage.from("personagens").upload(path,f);if(error)throw error;registro.foto_path=path;
        }
        const query=p.id?auth.cliente.from("npcs_monstros").update(registro).eq("id",p.id).eq("rpg",rpg):auth.cliente.from("npcs_monstros").insert(registro);
        const {error}=await query;if(error)throw error;dialog.close();await carregarNpcs();
      }catch(error){status.textContent=error.message}finally{salvar.disabled=false}
    };
    dialog.addEventListener("close",()=>dialog.remove(),{once:true});document.body.appendChild(dialog);dialog.showModal();
  }
  nav.querySelectorAll("button").forEach(b=>b.onclick=async()=>{
    tab=b.dataset.painel;nav.querySelectorAll("button").forEach(el=>{el.classList.toggle("ativa",el===b);el.setAttribute("aria-pressed",String(el===b))});
    grade.hidden=tab!=="jogadores";escudo.hidden=tab!=="escudo";npcs.hidden=tab!=="npcs";
    cabecalho.querySelector("h1").textContent=tab==="jogadores"?"Fichas dos jogadores":tab==="escudo"?"Escudo do Mestre":"NPCs/Monstros";
    cabecalho.querySelector("p").textContent=tab==="jogadores"?"Selecione um personagem para abrir a ficha completa.":tab==="escudo"?"Visão da campanha · atualização em tempo real.":"Crie e edite suas criaturas e personagens livremente.";
    if(tab==="escudo")await atualizar();if(tab==="npcs")await carregarNpcs();
  });
  nav.querySelector("button").classList.add("ativa");
  document.querySelector("#novo-npc").onclick=()=>abrirEditorNpc();document.querySelector("#atualizar-escudo").onclick=atualizar;document.querySelector("#mais-historico").onclick=()=>carregarHistorico(true);
  const canalRolagens=auth.cliente.channel("rolagens-mestre-"+rpg+"-"+campanha)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"rolagens_campanha",filter:"rpg=eq."+rpg},payload=>{
      const nova=payload.new;if(nova?.campanha!==campanha)return;
      if(!registros.some(registro=>registro.id===nova.id)){registros.unshift(nova);anteriores+=1;if(tab==="escudo")desenharHistorico()}
    }).subscribe();
  const timer=setInterval(()=>{if(tab==="escudo"&&!document.hidden)carregarHistorico()},3000);
  document.addEventListener("visibilitychange",()=>{if(tab==="escudo"&&!document.hidden)carregarHistorico()});
  window.addEventListener("pagehide",()=>{clearInterval(timer);auth.cliente.removeChannel(canalRolagens)},{once:true});
  await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="../../../acoes-mestre-v8.js";script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
  await window.iniciarAcoesMestreV8();
};
