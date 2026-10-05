/* SCMS shared runtime helpers
 * Small, dependency-free utilities shared by portal modules.
 * Keep business rules inside their owning modules.
 */
(function(){
  'use strict';
  const api=window.SCMSRuntime=window.SCMSRuntime||{};
  api.escapeHtml=function(value){
    return String(value==null?'':value).replace(/[&<>"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  };
  api.safeNumber=function(value,fallback){
    const n=Number(value);
    return Number.isFinite(n)?n:(fallback==null?0:fallback);
  };
  api.debounce=function(fn,wait){
    let timer=null;
    return function(){
      const args=arguments,ctx=this;
      clearTimeout(timer);
      timer=setTimeout(function(){fn.apply(ctx,args);},Math.max(0,Number(wait)||0));
    };
  };
})();
