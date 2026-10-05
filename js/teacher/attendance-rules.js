/* SCMS attendance business rules */
(function(){
  'use strict';
  function attendanceDateKey(value){if(!value)return '';const text=String(value);if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;const date=new Date(value);if(isNaN(date.getTime()))return text.slice(0,10);return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')}
  window.SCMSAttendanceRules={attendanceDateKey:attendanceDateKey,registrationDateKey:attendanceDateKey};
})();
