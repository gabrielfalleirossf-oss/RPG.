(()=>{'use strict';
const RACAS=['Humano','Ghoul','Uchiha','Elfo','Fada','Vampiro','Kitsune'];
const esperar=()=>window.RPG_AUTH?Promise.resolve(window.RPG_AUTH):new Promise(r=>document.addEventListener('rpg:auth-pronto',e=>r(e.detail),{once:true}));
async function iniciar(){
 const auth=await esperar();if(auth.perfil!=='mestre')return;
 const personagem=new URLSearchParams(location.search).get('id'),form=document.querySelector('#form-ficha-mestre');if(!personagem||!form)return;
 const box=document.createElement('section');box.className='controle-raca-v72';box.innerHTML=`<header><div><small>Segredo do Mestre</small><h3>Raça do personagem</h3></div><span>Somente o Mestre pode alterar</span></header><div class="campos-raca-v72"><label>Raça verdadeira<select data-raca>${RACAS.map(x=>`<option>${x}</option>`).join('')}</select></label><label class="revelar-v72"><input type="checkbox" data-revelada> Revelar na ficha</label></div><button type="button" data-salvar-raca>Salvar raça</button><p data-status-raca></p>`;
 form.prepend(box);const select=box.querySelector('[data-raca]'),revelada=box.querySelector('[data-revelada]'),status=box.querySelector('[data-status-raca]'),botao=box.querySelector('[data-salvar-raca]');
 const {data,error}=await auth.cliente.rpc('obter_raca_mestre_v72',{personagem_alvo:personagem});
 if(error){status.textContent='Execute o SQL da V72 no Supabase.';status.style.color='#ff7f8b';botao.disabled=true;return}
 select.value=data?.raca||'Humano';revelada.checked=data?.revelada!==false;revelada.disabled=select.value==='Humano';
 select.addEventListener('change',()=>{if(select.value==='Humano'){revelada.checked=true;revelada.disabled=true}else revelada.disabled=false});
 botao.addEventListener('click',async()=>{botao.disabled=true;status.textContent='Salvando...';const {error:e}=await auth.cliente.rpc('definir_raca_personagem_v72',{personagem_alvo:personagem,nova_raca:select.value,deve_revelar:select.value==='Humano'||revelada.checked});botao.disabled=false;if(e){status.textContent=e.message;status.style.color='#ff7f8b'}else{status.textContent='Raça salva. O segredo continua protegido.';status.style.color='#70e6a0'}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
