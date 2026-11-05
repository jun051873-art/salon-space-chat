// Presence is separate from read receipts: opening a chat need not mark it read.
export function createChatPresence({write,isVisible,setTimer=setInterval,clearTimer=clearInterval,onError=()=>{}}){
 let room='',timer=null,chain=Promise.resolve();
 const send=(id,active)=>{if(!id)return;chain=chain.catch(()=>{}).then(()=>write(id,active)).catch(onError);};
 const heartbeat=()=>{if(room&&isVisible())send(room,true);};
 function stop(){if(timer!==null)clearTimer(timer);timer=null;}
 return {
  enter(id){if(room&&room!==id)send(room,false);room=id;stop();if(isVisible()){heartbeat();timer=setTimer(heartbeat,15000);}},
  leave(){stop();send(room,false);room='';},
  visibility(){stop();if(!room)return;if(isVisible()){heartbeat();timer=setTimer(heartbeat,15000);}else send(room,false);},
  settled(){return chain;}
 };
}
