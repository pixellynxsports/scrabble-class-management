/* SCMS shared UI facade */
(function(){
  'use strict';
  window.SCMSUI={
    notify:function(message,type,title,options){if(typeof appNotify==='function')return appNotify(message,type||'info',title||'',options||{});console.warn(message)},
    confirm:function(message,title,eyebrow){if(typeof appConfirm==='function')return appConfirm(message,title||'Confirm Action',eyebrow||'CONFIRMATION');return Promise.resolve(window.confirm(message))},
    prompt:function(message,defaultValue,title,placeholder){if(typeof appPrompt==='function')return appPrompt(message,defaultValue||'',title||'Additional Information',placeholder||'Enter details');return Promise.resolve(window.prompt(message,defaultValue||''))}
  };
})();
