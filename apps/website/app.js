(() => {
 const button=document.getElementById('language');
 let language='ar';
 try{language=localStorage.getItem('platinum.site.language')==='en'?'en':'ar';}catch{}
 function render(){
  document.documentElement.lang=language;
  document.documentElement.dir=language==='ar'?'rtl':'ltr';
  document.querySelectorAll('[data-ar][data-en]').forEach(element=>{element.innerHTML=element.dataset[language];});
  button.textContent=language==='ar'?'English':'العربية';
  button.setAttribute('aria-label',language==='ar'?'Switch to English':'التبديل إلى العربية');
  document.title=language==='ar'?'Platinum WhatsApp — تواصل أذكى. عمل أهدأ.':'Platinum WhatsApp — Better conversations. A calmer workflow.';
 }
 button.addEventListener('click',()=>{language=language==='ar'?'en':'ar';try{localStorage.setItem('platinum.site.language',language);}catch{}render();});
 render();
})();
