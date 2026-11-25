// Search is run only in the signed-in store console. A match is a suggestion,
// and never grants access to an existing profile.
export async function findReturningProfiles({applicant,search='',lookup}){
 const term=search.normalize('NFKC').trim();
 const fields=term?[['name',term],['phone',term]]:[['name',applicant.name],['phone',applicant.phone]];
 const batches=await Promise.all(fields.filter(([,value])=>value).map(([field,value])=>lookup(field,value)));
 return [...new Map(batches.flat().map(profile=>[profile.id,profile])).values()].filter(profile=>
  profile.id!==applicant.id && profile.role==='customer' && (profile.status||'active')==='active' &&
  !profile.adminDeleted && !profile.adminMergedInto && !profile.cleanupLock);
}
