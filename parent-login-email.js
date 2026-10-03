async function generateParentLoginDetails(studentId,button){
  if(!studentId)return;

  const student=DATA.students.find(
    s=>String(s["Student ID"])===String(studentId)
  );

  if(!student){appNotify("The selected student could not be found in the current student records.","error","Student Not Found");return;}

  const parentName=student["Parent / Guardian"]||"the parent";

  const ok=await appConfirm(
    "The current parent password will be replaced and the parent will be required to change it at the next login.",
    "Generate Parent Login?",
    "SECURITY ACTION"
  );

  if(!ok)return;

  let emailWindow=null;

  try{
    emailWindow=window.open("about:blank","_blank");

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
      throw new Error(data?.error||"Unable to generate the parent login details.");
    }

    const children=(data.children||[])
      .map(c=>c.student_name+" ("+c.student_id+")")
      .join("\n");

    const subject="Banting Scrabble Academy | Parent Portal Login Details";
    const body=
      "Dear "+(data.parent_name||parentName)+",\n\n"+
      "We are pleased to inform you that the Banting Scrabble Academy Parent Portal is now available.\n\n"+
      "Parent Portal:\n"+
      "https://pixellynxsports.github.io/scrabble-class-management/\n\n"+
      "Login Email: "+data.email+"\n"+
      "Temporary Password: "+data.password+"\n\n"+
      "Registered Student(s):\n"+children+"\n\n"+
      "First Login:\n"+
      "1. Open the Parent Portal.\n"+
      "2. Select Parent Login.\n"+
      "3. Enter the login email and temporary password above.\n"+
      "4. The system will ask you to create a new password.\n"+
      "5. Save your new password for future logins.\n\n"+
      "Please keep your login details private.\n\n"+
      "Thank you.\n"+
      "Banting Scrabble Academy";

    const gmailUrl=
      "https://mail.google.com/mail/?view=cm&fs=1&tf=1"+
      "&to="+encodeURIComponent(data.email)+
      "&su="+encodeURIComponent(subject)+
      "&body="+encodeURIComponent(body);

    if(emailWindow&&!emailWindow.closed){
      emailWindow.location.href=gmailUrl;
    }else{
      appNotify("Gmail was blocked. The generated login details are ready for manual email delivery.","warning","Gmail Window Blocked");
    }

    appNotify("Gmail compose opened with the parent login email prepared. Send it once, then do not generate another password for this parent.","success","Login Details Ready");

  }catch(error){
    if(emailWindow&&!emailWindow.closed)emailWindow.close();
    appNotify(error?.message||"Unable to generate the parent login details.","error","Login Details Not Generated");
  }finally{
    if(button){
      button.disabled=false;
      button.textContent="Generate Password & Email";
    }
  }
}

window.generateParentLoginDetails=generateParentLoginDetails;
