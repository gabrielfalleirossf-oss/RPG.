window.iniciarRecadosJogadorV8=async function(){
 const auth=window.RPG_AUTH,rpg=document.body.dataset.rpg;if(!auth||auth.perfil!=="jogador"||window.__recadosJogadorV8Ativo)return;
 window.__recadosJogadorV8Ativo=true;
 const raiz=location.pathname.split("/"+(rpg==="abismo"?"rpg":"marvel")+"/")[0],css=document.createElement("link");css.rel="stylesheet";css.href=raiz+"/recados-jogador-v8.css";document.head.appendChild(css);
 let consultando=false,fila=[];
 function processarFila(){if(document.querySelector(".recado-overlay")||!fila.length)return;mostrarEvento(fila.shift())}
 function avisar(tipo,titulo,texto){fila.push({tipo,titulo,texto});processarFila()}
 function mostrarEvento(evento){
  const overlay=document.createElement("div");overlay.className="recado-overlay tema-"+rpg+" aviso-acao aviso-"+evento.tipo;
  const caixa=document.createElement("article");caixa.className="recado-popup";caixa.innerHTML='<div class="recado-efeito" aria-hidden="true"></div><header><small>Atualização da campanha</small><h2></h2></header><div class="recado-conteudo"><p></p></div><button type="button">Entendido</button>';
  caixa.querySelector("h2").textContent=evento.titulo;caixa.querySelector("p").textContent=evento.texto;overlay.appendChild(caixa);document.body.appendChild(overlay);tocarSom(rpg);
  caixa.querySelector("button").onclick=()=>{overlay.classList.add("saindo");setTimeout(()=>{overlay.remove();proximo();processarFila()},450)};
 }
 async function proximo(){
  if(consultando||document.querySelector(".recado-overlay"))return;
  consultando=true;
  const {data,error}=await auth.cliente.from("recados_mestre").select("*").eq("usuario_id",auth.usuario.id).eq("rpg",rpg).eq("lido",false).order("criado_em",{ascending:true}).limit(1).maybeSingle();
  if(error||!data){consultando=false;return}
  let imagem="";if(data.foto_path){const {data:url}=await auth.cliente.storage.from("personagens").createSignedUrl(data.foto_path,3600);imagem=url?.signedUrl||""}
  const overlay=document.createElement("div");overlay.className="recado-overlay tema-"+rpg;const caixa=document.createElement("article");caixa.className="recado-popup";
  caixa.innerHTML='<div class="recado-efeito" aria-hidden="true"></div><header><small>Mensagem do Mestre</small><h2>Um recado para você</h2></header><div class="recado-conteudo"></div><button type="button">Entendido</button>';
  const conteudo=caixa.querySelector(".recado-conteudo");if(imagem){const img=document.createElement("img");img.src=imagem;img.alt="Imagem anexada pelo Mestre";conteudo.appendChild(img)}const p=document.createElement("p");p.textContent=data.mensagem;conteudo.appendChild(p);overlay.appendChild(caixa);document.body.appendChild(overlay);consultando=false;
  tocarSom(rpg);
  caixa.querySelector("button").onclick=async()=>{caixa.querySelector("button").disabled=true;await auth.cliente.rpc("marcar_recado_lido",{recado_id:data.id});overlay.classList.add("saindo");setTimeout(()=>{overlay.remove();proximo();processarFila()},450)};
 }
 function tocarSom(tema){
  try{const C=window.AudioContext||window.webkitAudioContext,ctx=new C(),agora=ctx.currentTime,ganho=ctx.createGain();ganho.gain.setValueAtTime(.0001,agora);ganho.gain.exponentialRampToValueAtTime(.055,agora+.035);ganho.gain.exponentialRampToValueAtTime(.0001,agora+.65);ganho.connect(ctx.destination);
   const notas=tema==="abismo"?[392,523.25]:[659.25,987.77];notas.forEach((freq,i)=>{const o=ctx.createOscillator();o.type=tema==="abismo"?"sine":"triangle";o.frequency.value=freq;o.connect(ganho);o.start(agora+i*.12);o.stop(agora+.7)});
   if(ctx.state==="suspended"){const retomar=()=>{ctx.resume();document.removeEventListener("pointerdown",retomar)};document.addEventListener("pointerdown",retomar)}
  }catch{}
 }
 await proximo();
 const {data:fichasIniciais}=await auth.cliente.from("personagens").select("*").eq("usuario_id",auth.usuario.id).eq("rpg",rpg);
 const fichas=new Map((fichasIniciais||[]).map(f=>[f.id,f]));
 const canal=auth.cliente.channel("recados-jogador-"+auth.usuario.id+"-"+rpg)
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"recados_mestre",filter:"usuario_id=eq."+auth.usuario.id},payload=>{
   if(payload.new?.rpg===rpg)proximo();
  }).subscribe();
 const canalAcoes=auth.cliente.channel("acoes-jogador-"+auth.usuario.id+"-"+rpg)
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"habilidades_personagem"},payload=>{
   const nova=payload.new;if(!fichas.has(nova?.personagem_id)||nova.criado_por===auth.usuario.id)return;
   avisar("habilidade","Nova habilidade",`${nova.nome} foi adicionada a ${fichas.get(nova.personagem_id).nome}.`);window.dispatchEvent(new CustomEvent("rpg:habilidade-adicionada",{detail:nova}));
  })
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"itens_personagem"},payload=>{
   const novo=payload.new;if(!fichas.has(novo?.personagem_id)||novo.criado_por===auth.usuario.id)return;
   avisar("item","Novo item",`${novo.nome} foi adicionado ao inventário de ${fichas.get(novo.personagem_id).nome}.`);window.dispatchEvent(new CustomEvent("rpg:item-adicionado",{detail:novo}));
  })
  .on("postgres_changes",{event:"UPDATE",schema:"public",table:"personagens",filter:"usuario_id=eq."+auth.usuario.id},payload=>{
   const nova=payload.new,anterior=fichas.get(nova?.id);if(!nova||nova.rpg!==rpg)return;fichas.set(nova.id,nova);
   if(anterior&&((nova.nivel??0)!==(anterior.nivel??0)||(nova.experiencia??0)!==(anterior.experiencia??0))){
    const subiu=(nova.nivel??0)>(anterior.nivel??0),texto=subiu?`${nova.nome} chegou ao nível ${nova.nivel} e recebeu novos pontos de atributo.`:`${nova.nome} agora possui ${nova.experiencia} XP.`;
    avisar("progresso",subiu?"Você subiu de nível!":"Experiência recebida",texto);
   }
   window.dispatchEvent(new CustomEvent("rpg:ficha-atualizada",{detail:nova}));
  }).subscribe();
 const verificacao=setInterval(()=>{if(!document.hidden)proximo()},3000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)proximo()});
 window.addEventListener("pagehide",()=>{clearInterval(verificacao);auth.cliente.removeChannel(canal);auth.cliente.removeChannel(canalAcoes);window.__recadosJogadorV8Ativo=false},{once:true});
};
