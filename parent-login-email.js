async function sendParentLoginEmail(studentId){
  if(!studentId)return;
  const student=DATA.students.find(s=>String(s["Student ID"])===String(studentId));
  if(!student)return alert("Student not found.");
  const parentName=student["Parent / Guardian"]||"the parent";
  const ok=confirm("Send a new temporary Parent Portal password to "+parentName+"?\n\nThe current parent password will be replaced and the parent will be required to change it at the next login.");
  if(!ok)return;
  try{
    const button=document.getElementById("sendParentLoginEmailButton");
    if(button){button.disabled=true;button.textContent="Sending...";}
    const{data,error}=await supabaseClient.functions.invoke("send-parent-login-email",{body:{student_id:String(studentId)}});
    if(error)throw error;
    if(!data?.success)throw new Error(data?.error||"Unable to send the parent login email.");
    alert("Parent login email sent successfully to "+data.email+".");
  }catch(error){
    alert(error.message||"Unable to send the parent login email.");
  }finally{
    const button=document.getElementById("sendParentLoginEmailButton");
    if(button){button.disabled=false;button.textContent="Send Parent Login Email";}
  }
}
window.sendParentLoginEmail=sendParentLoginEmail;
