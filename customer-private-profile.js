// Customer identity remains in users/{uid}; salon aliases are admin-only.
export function privateAlias(value){
 const alias=String(value??'').trim();
 if(alias.length>80)throw Error('店家稱呼最多 80 個字');
 return alias;
}
export async function savePrivateProfile({db,uid,alias,notes,doc,runTransaction,deleteField,stamp}){
 if(alias!==undefined)privateAlias(alias);
 return runTransaction(db,async tx=>{
  const userRef=doc(db,'users',uid),chatRef=doc(db,'chats',uid),noteRef=doc(db,'customerNotes',uid);
  const [user,chat,note]=await Promise.all([tx.get(userRef),tx.get(chatRef),tx.get(noteRef)]);
  if(!user.exists())throw Error('找不到顧客資料');
  const previous=note.data()||{};
  const legacy=user.data().adminProfile!==undefined||user.data().adminName!==undefined||chat.data()?.adminName!==undefined;
  if(alias===undefined&&!legacy)return previous;
  const name=privateAlias(alias===undefined?(previous.alias??user.data().adminProfile?.name??user.data().adminName??chat.data()?.adminName??''):alias);
  const patch={alias:name,updatedAt:stamp()};
  if(notes!==undefined)patch.notes=String(notes);
  // Preserve historical overrides privately for recovery, never publish them.
  if(user.data().adminProfile&&!previous.legacyAdminProfile)patch.legacyAdminProfile=user.data().adminProfile;
  if(user.data().adminName&&!previous.legacyUserAdminName)patch.legacyUserAdminName=user.data().adminName;
  if(chat.data()?.adminName&&!previous.legacyAdminName)patch.legacyAdminName=chat.data().adminName;
  tx.set(noteRef,patch,{merge:true});
  const cleanup={};
  for(const key of ['adminProfile','adminName'])if(user.data()[key]!==undefined)cleanup[key]=deleteField();
  if(Object.keys(cleanup).length)tx.update(userRef,cleanup);
  if(chat.exists()&&chat.data().adminName!==undefined)tx.update(chatRef,{adminName:deleteField()});
  return {...previous,...patch};
 });
}

// Presentation only: never write this combined name into customer-owned records.
export function shopDisplayName(name,alias){
 name=String(name||'客人').trim();alias=privateAlias(alias);
 if(!alias||alias===name)return name;
 if(alias.startsWith(name+'（')||alias.startsWith(name+'('))return alias;
 return name+'（'+alias.replace(/^[（(](.*)[）)]$/u,'$1')+'）';
}
