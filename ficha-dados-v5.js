window.atualizarFichaV5=async function(personagem){
  const css=document.createElement("link");css.rel="stylesheet";css.href="../../../ficha-dados-v5.css";document.head.appendChild(css);
  const cssDefesa=document.createElement("link");cssDefesa.rel="stylesheet";cssDefesa.href="../../../ficha-defesa-v6.css";document.head.appendChild(cssDefesa);
  const auth=window.RPG_AUTH;
  const {data:nome,error}=await auth.cliente.rpc("nome_jogador_da_ficha",{ficha_id:personagem.id});
  document.querySelector("#jogador-ficha").textContent=nome||(!error&&auth.usuario.id===personagem.usuario_id?auth.acesso.nome_exibicao:"Nome indisponível — atualize o SQL");
  document.querySelectorAll(".identidade-dados div").forEach(div=>{if(div.querySelector("dt")?.textContent.trim().toLowerCase()==="classe")div.querySelector("dd").textContent="Desconhecida"});
  const energia=document.querySelector(".recurso.energia");
  if(!document.querySelector("#sanidade-ficha")){
    const sanidade=document.createElement("div");sanidade.className="recurso sanidade";
    sanidade.innerHTML='<div class="recurso-titulo"><span>Sanidade</span><strong id="sanidade-ficha"></strong></div><div class="recurso-trilho"><i id="barra-sanidade"></i></div>';
    energia.after(sanidade);
  }
  const atual=personagem.sanidade_atual??100,max=personagem.sanidade_max??100;
  document.querySelector("#sanidade-ficha").textContent=atual+" / "+max;
  document.querySelector("#barra-sanidade").style.setProperty("--valor",(max?Math.min(100,Math.max(0,atual/max*100)):0)+"%");
  const atributos=document.querySelector(".atributos");
  const escudo=document.createElement("div");escudo.className="defesa-pentagrama";escudo.setAttribute("aria-label","Defesa: "+(personagem.defesa??10));
  escudo.innerHTML='<svg viewBox="0 0 64 76" aria-hidden="true"><path d="M32 4 58 14v22c0 18-12 29-26 36C18 65 6 54 6 36V14Z"/></svg><strong></strong><small>Defesa</small>';
  escudo.querySelector("strong").textContent=personagem.defesa??10;atributos.appendChild(escudo);
  let pontos=document.querySelector("#pontos-atributo");
  if(!pontos){pontos=document.createElement("div");pontos.id="pontos-atributo";pontos.className="pontos-atributo";pontos.innerHTML="<strong></strong><small>Pontos</small>";atributos.appendChild(pontos);pontos.querySelector("strong").textContent=personagem.pontos_atributo??0}
  const titulo=document.createElement("span");titulo.className="titulo-pentagrama";titulo.textContent="Atributos";atributos.appendChild(titulo);
  const sincronizar=()=>{const restantes=Number(pontos.querySelector("strong").textContent)||0;titulo.hidden=restantes>0;pontos.classList.toggle("esgotado",restantes<=0)};
  new MutationObserver(sincronizar).observe(pontos.querySelector("strong"),{childList:true,characterData:true,subtree:true});sincronizar();
  const anterior=document.querySelector("#form-dados"),novo=document.createElement("section");novo.className="rolar-dados dados-novos";novo.id="form-dados";
  const geometrias={
    4:'<path d="M50 7 94 87H6Z"/><path d="M50 7v80M6 87l44-30 44 30"/>',
    6:'<path d="M15 15h70v70H15Z"/><circle cx="31" cy="31" r="3"/><circle cx="69" cy="31" r="3"/><circle cx="31" cy="50" r="3"/><circle cx="69" cy="50" r="3"/><circle cx="31" cy="69" r="3"/><circle cx="69" cy="69" r="3"/>',
    8:'<path d="M50 5 92 50 50 95 8 50Z"/><path d="M8 50h84M50 5v90"/>',
    10:'<path d="M50 5 94 43 72 86 28 86 6 43Z"/><path d="M50 5 28 86 94 43 6 43 72 86Z"/>',
    20:'<path d="M50 4 91 28 82 78 50 96 18 78 9 28Z"/><path d="M50 4 31 31 9 28M50 4l19 27 22-3M31 31l19 51 19-51M9 28l41 54 41-54M18 78l32 4 32-4"/>'
  };
  novo.innerHTML='<h2>Rolar dados</h2><p>Escolha um dado para rolar. Valor máximo = crítico.</p><div class="seletor-dados"></div><output id="resultado-dados" class="resultado-dados" aria-live="polite">Aguardando rolagem</output>';
  const seletor=novo.querySelector(".seletor-dados");
  Object.entries(geometrias).forEach(([faces,svg])=>{const b=document.createElement("button");b.type="button";b.className="dado-escolha";b.setAttribute("aria-label","Rolar um D"+faces);b.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true">'+svg+'</svg><span>D'+faces+'</span>';b.onclick=()=>rolar(Number(faces),1);seletor.appendChild(b)});
  const personalizado=document.createElement("button");personalizado.type="button";personalizado.className="dado-escolha";personalizado.setAttribute("aria-label","Dados personalizados");personalizado.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 5 91 28v44L50 95 9 72V28Z"/><path d="M50 30v40M30 50h40"/></svg><span>Personalizado</span>';seletor.appendChild(personalizado);
  anterior.replaceWith(novo);
  function rolar(faces,quantidade,prefixo=""){
    const valores=Array.from({length:quantidade},()=>Math.floor(Math.random()*faces)+1),saida=novo.querySelector("#resultado-dados");
    saida.replaceChildren();const resumo=document.createElement("div");resumo.textContent=prefixo+quantidade+"D"+faces+" · Total: "+valores.reduce((a,b)=>a+b,0);saida.appendChild(resumo);
    const resultados=document.createElement("div");resultados.className="resultados-individuais";
    valores.forEach(v=>{const s=document.createElement("span");s.textContent=String(v);if(v===faces){s.className="resultado-critico";s.title="Crítico! Valor máximo do dado."}resultados.appendChild(s)});
    saida.appendChild(resultados);resumo.classList.toggle("resultado-critico",valores.some(v=>v===faces));
    if(valores.some(v=>v===faces)){const aviso=document.createElement("small");aviso.className="resultado-critico";aviso.textContent="Crítico!";saida.appendChild(aviso)}
  }
  document.querySelectorAll("#lista-pericias button.pericia").forEach(botao=>{
    botao.addEventListener("click",evento=>{evento.preventDefault();evento.stopImmediatePropagation();rolar(20,1,botao.querySelector("span").textContent+": ")},{capture:true});
  });
  const dialog=document.createElement("dialog");dialog.className="modal-recurso";
  dialog.innerHTML='<form><header><h2>Dados personalizados</h2><button type="button" aria-label="Fechar">×</button></header><label>Quantidade de dados<input name="quantidade" type="number" min="1" max="100" value="1" required></label><label>Faces de cada dado<input name="faces" type="number" min="2" max="1000" value="20" required></label><footer><button class="botao principal" type="submit">Rolar dados</button></footer></form>';
  document.body.appendChild(dialog);personalizado.onclick=()=>dialog.showModal();dialog.querySelector('button[type="button"]').onclick=()=>dialog.close();
  dialog.querySelector("form").onsubmit=e=>{e.preventDefault();const f=e.currentTarget;rolar(Number(f.faces.value),Number(f.quantidade.value));dialog.close()};
};
