const mestreQs=new URLSearchParams(location.search);
const mestreCampanha=mestreQs.get("campanha")||"Testes";
const mestreRpg=document.body.dataset.rpg;
const mestrePericias=[["Furtividade","AGI"],["Iniciativa","AGI"],["Investigação","APT"],["Medicina","APT"],["Percepção","PRE"],["Pontaria","AGI"],["Esquiva","AGI"],["Bloqueio","FOR"],["HtH","FOR"],["Esgrima","AGI"],["Combate com haste","FOR"],["Sobrevivência","APT"],["Vontade","PRE"]];
let mestreAuth,mestrePersonagem;

function aguardarAuthMestre(){if(window.RPG_AUTH)return Promise.resolve(window.RPG_AUTH);return new Promise(resolve=>document.addEventListener("rpg:auth-pronto",e=>resolve(e.detail),{once:true}))}
function mensagemFichaMestre(texto,sucesso=false){const el=document.querySelector("#mensagem");el.textContent=texto;el.classList.toggle("sucesso",sucesso)}
async function fotoFichaMestre(path){if(!path)return null;const {data}=await mestreAuth.cliente.storage.from("personagens").createSignedUrl(path,3600);return data?.signedUrl||null}
function textoOuPadrao(valor,padrao){return String(valor||"").trim()||padrao}

function aplicarFichaMestre(p){
  document.querySelector("#nome-ficha").textContent=p.nome;
  document.querySelector("#descricao-nome").textContent=p.nome;
  document.querySelector("#nivel-ficha").textContent=p.nivel??0;
  document.querySelector("#experiencia-ficha").textContent=`${p.experiencia??0}%`;
  document.querySelector("#vida-ficha").textContent=`${p.vida_atual??15} / ${p.vida_max??15}`;
  document.querySelector("#energia-ficha").textContent=`${p.energia_atual??0} / ${p.energia_max??0}`;
  document.querySelector("#barra-vida").style.setProperty("--valor",`${p.vida_max?Math.max(0,Math.min(100,(p.vida_atual??0)/p.vida_max*100)):0}%`);
  document.querySelector("#barra-energia").style.setProperty("--valor",`${p.energia_max?Math.max(0,Math.min(100,(p.energia_atual??0)/p.energia_max*100)):0}%`);
  ["agilidade","forca","apt_magica","presenca","resistencia"].forEach(nome=>document.querySelector(`.atributo[data-atributo="${nome}"] strong`).textContent=p[nome]??0);
  document.querySelector("#descricao-historia").textContent=textoOuPadrao(p.historia,"Nenhuma história registrada.");
  document.querySelector("#descricao-personalidade").textContent=textoOuPadrao(p.personalidade,"Nenhuma personalidade registrada.");
  document.querySelector("#descricao-objetivos").textContent=textoOuPadrao(p.objetivos,"Nenhum objetivo registrado.");
  document.querySelector("#descricao-anotacoes").textContent=textoOuPadrao(p.anotacoes,"Nenhuma anotação registrada.");
}
function rolarMestre(qtd=1,mod=0,prefixo=""){const dados=Array.from({length:qtd},()=>Math.floor(Math.random()*20)+1),total=dados.reduce((a,b)=>a+b,0)+mod,detalhe=dados.join(" + ")+(mod?` ${mod>0?"+":"−"} ${Math.abs(mod)}`:"");document.querySelector("#resultado-dados").textContent=`${prefixo}${detalhe} = ${total}`}
function montarPericiasMestre(){const lista=document.querySelector("#lista-pericias");mestrePericias.forEach(([nome,atr])=>{const linha=document.createElement("button");linha.type="button";linha.className="pericia";linha.innerHTML="<span></span><span></span><span>0</span><span>0</span>";linha.children[0].textContent=nome;linha.children[1].textContent=`(${atr})`;linha.addEventListener("click",()=>rolarMestre(1,0,`${nome}: `));lista.appendChild(linha)})}
function preencherEditor(p){const form=document.querySelector("#form-editor-mestre");["nome","nivel","vida_atual","vida_max","experiencia","agilidade","forca","apt_magica","presenca","resistencia","historia","personalidade","objetivos","anotacoes"].forEach(c=>form.elements[c].value=p[c]??"")}
function configurarInterfaceMestre(){
  const retorno=`../personagens/index.html?campanha=${encodeURIComponent(mestreCampanha)}`;document.querySelector("#voltar-campanha").href=retorno;document.querySelector("#voltar-personagens").href=retorno;
  document.querySelectorAll(".ficha-aba").forEach(botao=>botao.addEventListener("click",()=>{document.querySelectorAll(".ficha-aba").forEach(b=>b.classList.toggle("ativa",b===botao));document.querySelectorAll(".conteudo-aba").forEach(a=>a.hidden=a.id!==`aba-${botao.dataset.aba}`)}));
  const dialog=document.querySelector("#editor-mestre");document.querySelector("#editar-personagem").addEventListener("click",()=>{preencherEditor(mestrePersonagem);dialog.showModal()});document.querySelector("#fechar-editor").addEventListener("click",()=>dialog.close());document.querySelector("#cancelar-editor").addEventListener("click",()=>dialog.close());
  document.querySelector("#form-dados").addEventListener("submit",e=>{e.preventDefault();rolarMestre(Math.min(20,Math.max(1,Number(document.querySelector("#quantidade-dados").value)||1)),Math.min(99,Math.max(-99,Number(document.querySelector("#modificador-dados").value)||0)))});
  document.querySelector("#form-editor-mestre").addEventListener("submit",salvarEdicaoMestre);
}
async function salvarEdicaoMestre(e){
  e.preventDefault();const form=e.currentTarget,botao=document.querySelector("#salvar-editor");botao.disabled=true;botao.textContent="Salvando...";
  const numeros=["nivel","vida_atual","vida_max","experiencia","agilidade","forca","apt_magica","presenca","resistencia"],valores={nome:form.nome.value.trim(),historia:form.historia.value.trim(),personalidade:form.personalidade.value.trim(),objetivos:form.objetivos.value.trim(),anotacoes:form.anotacoes.value.trim()};numeros.forEach(c=>valores[c]=Math.max(0,Number(form.elements[c].value)||0));
  const {data,error}=await mestreAuth.cliente.from("personagens").update(valores).eq("id",mestrePersonagem.id).eq("rpg",mestreRpg).select("*").single();
  if(error)mensagemFichaMestre(error.message||"Não foi possível salvar a ficha.");else{mestrePersonagem=data;aplicarFichaMestre(data);document.querySelector("#editor-mestre").close();mensagemFichaMestre("Alterações salvas pelo Mestre.",true)}
  botao.disabled=false;botao.textContent="Salvar alterações";
}
async function iniciarFichaMestre(){
  const id=mestreQs.get("id");if(!id){location.replace(`../personagens/index.html?campanha=${encodeURIComponent(mestreCampanha)}`);return}
  const {data,error}=await mestreAuth.cliente.from("personagens").select("*").eq("id",id).eq("rpg",mestreRpg).maybeSingle();
  if(error||!data){mensagemFichaMestre("Ficha não encontrada ou sem permissão de Mestre.");return}
  mestrePersonagem=data;aplicarFichaMestre(data);const foto=await fotoFichaMestre(data.foto_path);if(foto){const img=document.querySelector("#foto-ficha");img.src=foto;img.addEventListener("load",()=>document.querySelector("#retrato-vazio").hidden=true,{once:true})}
}
document.documentElement.addEventListener("pointermove",e=>{document.documentElement.style.setProperty("--mouse-x",`${e.clientX/innerWidth*100}%`);document.documentElement.style.setProperty("--mouse-y",`${e.clientY/innerHeight*100}%`)},{passive:true});
document.addEventListener("DOMContentLoaded",async()=>{mestreAuth=await aguardarAuthMestre();configurarInterfaceMestre();montarPericiasMestre();await iniciarFichaMestre()});
