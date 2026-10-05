/* SCMS application state registry
 * Transitional state boundary. Legacy globals remain compatible while
 * new modules gain one predictable state surface.
 */
(function(){
  'use strict';
  const state=window.SCMSState=window.SCMSState||{
    auth:{ready:false,role:'teacher'},
    portal:{type:null,selectedStudentId:null},
    teacher:{data:null},
    parent:{context:null},
    tournament:{selected:null,players:[],rounds:[],matches:[],awards:[],standings:[]}
  };
  window.SCMSStateSync={
    teacherData:function(data){state.teacher.data=data;return data;},
    parentContext:function(context){state.parent.context=context;return context;},
    auth:function(ready,role){state.auth.ready=!!ready;if(role)state.auth.role=role;}
  };
})();
