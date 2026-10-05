/* SCMS application constants */
(function(){
  'use strict';
  window.SCMSConfig=Object.freeze({
    tournamentStatus:Object.freeze({DRAFT:'draft',READY:'ready',ACTIVE:'active',COMPLETED:'completed',ARCHIVED:'archived'}),
    awardType:Object.freeze({FIRST:'1st Place',SECOND:'2nd Place',THIRD:'3rd Place',MIP:'Most Improved',SP:'Strategic Player',FS:'Fighting Spirit',PARTICIPATION:'Participation'}),
    certificateStatus:Object.freeze({PENDING:'pending',GENERATING:'generating',PUBLISHED:'published',FAILED:'failed'}),
    app:Object.freeze({name:'Scrabble Class Management'})
  });
})();
