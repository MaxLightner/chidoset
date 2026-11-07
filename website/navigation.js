// Keep navigation responsive while the product/3D modules are still loading.
const toggle=document.querySelector('#menu-toggle'),menu=document.querySelector('#mobile-nav');
if(toggle&&menu){
 toggle.addEventListener('click',()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));});
 menu.addEventListener('click',event=>{if(event.target.closest('a')){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}});
}
