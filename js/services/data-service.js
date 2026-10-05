/* SCMS data service boundary
 * Supabase access for the main portal. UI modules consume these methods
 * instead of embedding the initial data-loading query set.
 */
(function(){
  'use strict';
  const api=window.SCMSDataService=window.SCMSDataService||{};
  function client(){
    if(!window.__scSupabaseClient)throw new Error('Supabase client is not ready.');
    return window.__scSupabaseClient;
  }
  api.loadTeacherData=async function(){
    const supabaseClient=client();
    const [s,a,p,o,settings]=await Promise.all([
      supabaseClient.from('students').select('*').order('student_name'),
      supabaseClient.from('attendance').select('*').order('attendance_date',{ascending:false}),
      supabaseClient.from('payments').select('*').order('payment_date',{ascending:false}),
      supabaseClient.from('orders').select('*').order('order_date',{ascending:false}),
      supabaseClient.from('settings').select('*')
    ]);
    for(const result of [s,a,p,o,settings]){if(result.error)throw dbError(result.error)}
    const cfg={fee:50,classesPerCycle:4,classTimes:['10:30 AM','2:00 PM']};
    settings.data?.forEach(x=>{
      if(x.setting==='fee')cfg.fee=Number(x.value)||50;
      if(x.setting==='classesPerCycle')cfg.classesPerCycle=Number(x.value)||4;
      if(x.setting==='classTimes'){
        try{const v=JSON.parse(x.value);if(Array.isArray(v)&&v.length)cfg.classTimes=v}catch(e){}
      }
    });
    return {
      students:(s.data||[]).map(studentFromDb),
      attendance:(a.data||[]).map(attendanceFromDb),
      payments:(p.data||[]).map(paymentFromDb),
      orders:(o.data||[]).map(orderFromDb),
      achievements:[],
      config:cfg
    };
  };
  api.getCurrentParentAccount=async function(){
    const supabaseClient=client();
    const {data,error}=await supabaseClient.auth.getUser();
    if(error)throw dbError(error);
    const uid=data.user?.id;
    if(!uid)throw new Error('Your session has expired. Please sign in again.');
    const {data:account,error:accountError}=await supabaseClient.from('parent_accounts').select('user_id,parent_name,email,whatsapp,active,must_change_password').eq('user_id',uid).maybeSingle();
    if(accountError)throw dbError(accountError);
    return account;
  };
})();
