/* SCMS Automatic Tournament Certificates facade */
(function(){
  'use strict';
  const rules=window.SCMSCertificateRules,generator=window.SCMSCertificateGenerator;
  window.SCMSCertificates={preview:generator.preview,generateForAwards:generator.generateForAwards,generateTournament:generator.generateTournament,retryFailed:generator.retryFailed,awardCaption:rules.awardCaption,awardCode:rules.awardCode,certificateNumber:rules.certificateNumber};
})();
