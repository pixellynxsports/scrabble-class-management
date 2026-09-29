async function generateParentLoginDetails(studentId){
  if(!studentId)return;

  const student=DATA.students.find(
    s=>String(s["Student ID"])===String(studentId)
  );

  if(!student)return alert("Student not found.");

  const parentName=student["Parent / Guardian"]||"the parent";

  const ok=confirm(
    "Generate a new temporary Parent Portal password for "+parentName+
    "?\n\nThe current parent password will be replaced and the parent will be required to change it at the next login.\n\nNo email will be sent."
  );

  if(!ok)return;

  try{
    const button=document.getElementById("generateParentLoginButton");

    if(button){
      button.disabled=true;
      button.textContent="Generating...";
    }

    const{data,error}=await supabaseClient.functions.invoke(
      "send-parent-login-email",
      {body:{student_id:String(studentId)}}
    );

    if(error)throw error;

    if(!data?.success){
      throw new Error(
        data?.error||"Unable to generate the parent login details."
      );
    }

    const children=(data.children||[])
      .map(c=>c.student_name+" ("+c.student_id+")")
      .join("\n");

    alert(
      "PARENT PORTAL LOGIN DETAILS\n\n"+
      "Parent: "+(data.parent_name||parentName)+"\n"+
      "Login Email: "+data.email+"\n"+
      "Temporary Password: "+data.password+"\n\n"+
      "Registered Student(s):\n"+
      children+
      "\n\nThe parent must change this password at first login.\n\n"+
      "Please copy or save these details securely before closing this message."
    );
  }catch(error){
    alert(
      error?.message||
      "Unable to generate the parent login details."
    );
  }finally{
    const button=document.getElementById("generateParentLoginButton");

    if(button){
      button.disabled=false;
      button.textContent="Generate Parent Login Details";
    }
  }
}

window.generateParentLoginDetails=generateParentLoginDetails;
