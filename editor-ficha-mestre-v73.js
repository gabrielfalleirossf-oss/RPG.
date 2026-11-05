(()=>{'use strict';
const ORIGENS=['Nerd','Lutador','Bodybuilder','Atleta','Socorrista','Delinquente','Professor','Zelador','Veterano','Angatubense'];
const RACAS=['Humano','Ghoul','Uchiha','Elfo','Fada','Vampiro','Kitsune'];
const esperar=()=>window.RPG_AUTH?Promise.resolve(window.RPG_AUTH):new Promise(r=>document.addEventListener('rpg:auth-pronto',e=>r(e.detail),{once:true}));
const esc=s=>String(s??'').replace(/[&<>'"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[x]));
function acharAncora(){
 const barra=[...document.querySelectorAll('section,div,header')].find(x=>/MODO DE EDIÇÃO DO MESTRE/i.test(x.textContent||'')&&x.children.length<12);
 if(barra)return barra;
 return document.querySelector('[data-conteudo="descricao"],.aba-descricao,#descricao-personagem,.descricao-personagem,main');
}
async function iniciar(){
 const auth=await esperar();
 const mestre=auth?.perfil==='mestre'||document.body.dataset.perfil==='mestre'||document.body.classList.contains('visao-mestre');if(!mestre)return;
 const personagem=new URLSearchParams(location.search).get('id');if(!personagem||document.querySelector('.editor-mestre-v73'))return;
 let ancora=null;for(let i=0;i<40&&!ancora;i++){ancora=acharAncora();if(!ancora)await new Promise(r=>setTimeout(r,200))}if(!ancora)return;
 const box=document.createElement('section');box.className='editor-mestre-v73';box.innerHTML=`<header><div><small>CONTROLE EXCLUSIVO DO MESTRE</small><h3>Origem e raça</h3></div><span>Jogadores não podem alterar nem consultar a raça secreta.</span></header><div class="campos-v73"><label>Origem<select data-origem-v73>${ORIGENS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label><label>Raça verdadeira<select data-raca-v73>${RACAS.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label><label class="revelar-v73"><input type="checkbox" data-revelada-v73> Revelar raça na ficha</label></div><button type="button" data-salvar-v73>Salvar origem e raça</button><span data-status-v73></span>`;
 ancora.insertAdjacentElement('afterend',box);
 const origem=box.querySelector('[data-origem-v73]'),raca=box.querySelector('[data-raca-v73]'),revelada=box.querySelector('[data-revelada-v73]'),salvar=box.querySelector('[data-salvar-v73]'),status=box.querySelector('[data-status-v73]');
 const [{data:p,error:ep},{data:s,error:es}]=await Promise.all([auth.cliente.from('personagens').select('origem').eq('id',personagem).maybeSingle(),auth.cliente.rpc('obter_raca_mestre_v72',{personagem_alvo:personagem})]);
 if(ep){status.textContent='Não foi possível carregar a origem.';status.className='erro';return}origem.value=ORIGENS.find(x=>x.toLowerCase()===(p?.origem||'').toLowerCase())||'Nerd';
 if(es){status.textContent='Execute o SQL da V72 no Supabase para liberar as raças.';status.className='erro';raca.disabled=revelada.disabled=true}else{raca.value=s?.raca||'Humano';revelada.checked=s?.revelada!==false}
 function humano(){const h=raca.value==='Humano';if(h)revelada.checked=true;revelada.disabled=h}raca.addEventListener('change',humano);humano();
 salvar.addEventListener('click',async()=>{salvar.disabled=true;status.className='';status.textContent='Salvando...';try{
  const {error:e1}=await auth.cliente.from('personagens').update({origem:origem.value}).eq('id',personagem);if(e1)throw e1;
  const {error:e2}=await auth.cliente.rpc('definir_raca_personagem_v72',{personagem_alvo:personagem,nova_raca:raca.value,deve_revelar:raca.value==='Humano'||revelada.checked});if(e2)throw e2;
  document.querySelectorAll('dd').forEach(dd=>{const dt=dd.previousElementSibling;if(dt&&/^origem$/i.test(dt.textContent.trim()))dd.textContent=origem.value});
  status.textContent='Origem e raça salvas com sucesso.';
 }catch(e){status.textContent=e?.message||'Não foi possível salvar.';status.className='erro'}finally{salvar.disabled=false}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
