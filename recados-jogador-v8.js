window.iniciarRecadosJogadorV8=async function(){
 const auth=window.RPG_AUTH,rpg=document.body.dataset.rpg;if(!auth||auth.perfil!=="jogador"||window.__recadosJogadorV8Ativo)return;
 window.__recadosJogadorV8Ativo=true;
 const raiz=location.pathname.split("/"+(rpg==="abismo"?"rpg":"marvel")+"/")[0],css=document.createElement("link");css.rel="stylesheet";css.href=raiz+"/recados-jogador-v8.css";document.head.appendChild(css);
 let consultando=false;
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
  caixa.querySelector("button").onclick=async()=>{caixa.querySelector("button").disabled=true;await auth.cliente.rpc("marcar_recado_lido",{recado_id:data.id});overlay.classList.add("saindo");setTimeout(()=>{overlay.remove();proximo()},450)};
 }
 function tocarSom(tema){
  try{const C=window.AudioContext||window.webkitAudioContext,ctx=new C(),agora=ctx.currentTime,ganho=ctx.createGain();ganho.gain.setValueAtTime(.0001,agora);ganho.gain.exponentialRampToValueAtTime(.055,agora+.035);ganho.gain.exponentialRampToValueAtTime(.0001,agora+.65);ganho.connect(ctx.destination);
   const notas=tema==="abismo"?[392,523.25]:[659.25,987.77];notas.forEach((freq,i)=>{const o=ctx.createOscillator();o.type=tema==="abismo"?"sine":"triangle";o.frequency.value=freq;o.connect(ganho);o.start(agora+i*.12);o.stop(agora+.7)});
   if(ctx.state==="suspended"){const retomar=()=>{ctx.resume();document.removeEventListener("pointerdown",retomar)};document.addEventListener("pointerdown",retomar)}
  }catch{}
 }
 await proximo();
 const canal=auth.cliente.channel("recados-jogador-"+auth.usuario.id+"-"+rpg)
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"recados_mestre",filter:"usuario_id=eq."+auth.usuario.id},payload=>{
   if(payload.new?.rpg===rpg)proximo();
  }).subscribe();
 const verificacao=setInterval(()=>{if(!document.hidden)proximo()},3000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)proximo()});
 window.addEventListener("pagehide",()=>{clearInterval(verificacao);auth.cliente.removeChannel(canal);window.__recadosJogadorV8Ativo=false},{once:true});
};
