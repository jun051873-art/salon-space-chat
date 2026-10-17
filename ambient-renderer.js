// Original canvas artwork: each atmosphere has its own movement and material.
export function startAtmosphere(canvas,effect,{direction='left',rng=Math.random}={}) {
 const c=canvas.getContext?.('2d');if(!c)return ()=>{};
 let w=1,h=1,frame,stopped=false,start,last=-Infinity;
 const sign=direction==='stay'?0:direction==='right'?-1:1;
 const particles=Array.from({length:effect==='rain'?115:effect==='snow'?85:48},()=>({x:rng(),y:rng(),z:.25+rng()*.75,p:rng()*Math.PI*2,s:rng(),color:rng()}));
 function resize(){const r=canvas.getBoundingClientRect();w=Math.max(1,r.width);h=Math.max(1,r.height);const d=Math.min(globalThis.devicePixelRatio||1,2);canvas.width=w*d;canvas.height=h*d;c.setTransform(d,0,0,d,0,0);}
 resize();const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(canvas);
 const wrap=(v,size)=>((v%size)+size)%size;
 function glow(x,y,r,color){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
 function ellipse(x,y,rx,ry){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);}
 function petal(size,color){c.fillStyle=color;c.beginPath();c.moveTo(0,-size);c.bezierCurveTo(size*1.2,-size*.9,size*.85,size*.6,0,size);c.bezierCurveTo(-size*.9,size*.2,-size*.7,-size*.7,0,-size);c.fill();c.strokeStyle='rgba(255,245,249,.65)';c.lineWidth=.6;c.beginPath();c.moveTo(0,-size*.7);c.quadraticCurveTo(size*.2,0,0,size*.8);c.stroke();}
 function draw(t){c.clearRect(0,0,w,h);
 const night=['stars','moon','midautumn','fireflies','fireworks','halloween'].includes(effect);
 if(night){glow(w*.82,h*.12,w*.95,'rgba(61,65,110,.20)');glow(w*.12,h*.85,w*.7,'rgba(99,99,154,.12)');}
 if(['petals','hearts'].includes(effect))glow(w*.9,h*.1,w*.8,'rgba(246,185,203,.18)');
 if(['rain','snow','mist'].includes(effect))glow(w*.1,h*.05,w,'rgba(150,186,204,.18)');
 if(['sun','suncloud','rainbow'].includes(effect)){
  const x=w*.82,y=h*.08;glow(x,y,w*.65,'rgba(247,202,112,.30)');glow(x,y,65,'rgba(255,231,167,.55)');
  c.save();c.translate(x,y);c.rotate(t*.018);for(let j=0;j<7;j++){c.rotate(.35);const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,222,152,.075)');g.addColorStop(1,'transparent');c.fillStyle=g;c.beginPath();c.moveTo(0,0);c.lineTo(-30,h);c.lineTo(65,h);c.fill();}c.restore();
 }
 if(['moon','midautumn'].includes(effect)){glow(w*.79,h*.17,100,'rgba(222,220,255,.25)');c.fillStyle='rgba(247,239,210,.72)';ellipse(w*.79,h*.17,25,25);c.fill();c.fillStyle='rgba(185,177,194,.10)';for(let j=0;j<5;j++){ellipse(w*.79+Math.sin(j*3)*16,h*.17+Math.cos(j*2)*16,3+j,2+j);c.fill();}}
 if(effect==='rainbow'){c.save();c.globalAlpha=.17;c.lineWidth=5;['#dd9c9c','#e1b785','#e4dba3','#a1c7b0','#9bbdcc','#b4a5c9'].forEach((color,j)=>{c.strokeStyle=color;c.beginPath();c.arc(w*.6,h*.35,w*.65-j*6,Math.PI,Math.PI*2);c.stroke();});c.restore();}
 if(['clouds','suncloud','mist','wind'].includes(effect))for(let j=0;j<6;j++){
  let x=wrap(j*w*.31+t*(effect==='wind'?18:5)*sign,w*1.6)-w*.3,y=h*(.12+j*.14)+Math.sin(t*.17+j)*10;
  c.save();c.translate(x,y);c.scale(2.8,.36);glow(0,0,w*.22,effect==='mist'?'rgba(195,214,218,.16)':'rgba(221,229,230,.22)');c.restore();
  if(effect==='wind'){c.strokeStyle='rgba(140,173,169,.18)';c.lineWidth=1;c.beginPath();c.moveTo(x-80,y);c.bezierCurveTo(x-20,y-22,x+20,y+22,x+110,y-5);c.stroke();}
 }
 if(effect==='fireworks'){for(let j=0;j<4;j++){const age=(t*.24+j*.26)%1,x=w*(.2+j*.21),y=h*(.16+(j%2)*.22),radius=age*95;c.strokeStyle=`rgba(${j%2?'205,160,170':'211,179,112'},${(1-age)*.6})`;c.lineWidth=1.3;for(let k=0;k<32;k++){const a=k*Math.PI/16;c.beginPath();c.moveTo(x+Math.cos(a)*radius*.74,y+Math.sin(a)*radius*.74+age*age*22);c.lineTo(x+Math.cos(a)*radius,y+Math.sin(a)*radius+age*age*22);c.stroke();}}return;}
 particles.forEach((p,i)=>{
 const z=p.z;let x=wrap(p.x*w+t*(8+z*15)*sign+Math.sin(t*.65+p.p)*18,w+70)-35,y=wrap(p.y*h+t*(12+z*28),h+60)-30;
 if(effect==='rain'){x=wrap(p.x*w+t*30*sign,w+40)-20;y=wrap(p.y*h+t*(180+z*270),h+50)-25;c.strokeStyle=`rgba(113,157,178,${.14+z*.30})`;c.lineWidth=.45+z*.65;c.beginPath();c.moveTo(x,y);c.lineTo(x+sign*(2+z*4),y+8+z*19);c.stroke();if(i<12){const a=(t*.6+p.s)%1;c.strokeStyle=`rgba(130,167,178,${(1-a)*.23})`;ellipse(p.x*w,h*(.72+p.y*.28),a*22+1,a*5+.2);c.stroke();}return;}
 if(effect==='snow'){x=wrap(p.x*w+t*(3+z*8)*sign+Math.sin(t*.7+p.p)*18,w+40)-20;y=wrap(p.y*h+t*(9+z*24),h+30)-15;if(z>.85)glow(x,y,7,'rgba(220,232,239,.33)');c.fillStyle=`rgba(214,229,238,${.30+z*.45})`;ellipse(x,y,1+z*2.4,1+z*2.4);c.fill();return;}
 if(['clouds','mist','wind','rainbow'].includes(effect))return;
 if(['sun','suncloud','moon','midautumn','stars','fireflies'].includes(effect)){
  x=p.x*w+Math.sin(t*(effect==='fireflies'?.6:.12)+p.p)*22;y=p.y*h+Math.cos(t*.35+p.p)*15;
  const a=.15+.55*(.5+.5*Math.sin(t*(effect==='fireflies'?1.7:.8)+p.p));c.globalAlpha=a;
  glow(x,y,effect==='fireflies'?9:5,effect==='fireflies'?'rgba(186,191,95,.7)':'rgba(211,184,125,.7)');c.fillStyle=effect==='fireflies'?'#c5c67d':'#d1bc8e';ellipse(x,y,z*1.5,z*1.5);c.fill();c.globalAlpha=1;return;
 }
 if(effect==='ripples'){const a=(t*.22+p.s)%1;if(i>13)return;c.strokeStyle=`rgba(112,167,176,${(1-a)*.28})`;c.lineWidth=.8;ellipse(p.x*w,p.y*h,1+a*65,1+a*20);c.stroke();return;}
 if(['bubbles','hearts','birthday','lanterns','sprouts'].includes(effect))y=h+30-wrap(p.y*h+t*(8+z*22),h+70);
 if(i>({lanterns:12,birthday:14,halloween:12,gifts:15,christmas:14,dragonboat:15,wheat:22,sprouts:22}[effect]??48))return;
 c.save();c.translate(x,y);c.rotate(Math.sin(t*.6+p.p)*.5+(effect==='petals'?t*.22:0));c.globalAlpha=.22+z*.47;const s=4+z*7;
 if(['petals','leaves','confetti','newyear','dragonboat'].includes(effect)){
 c.scale(.35+Math.abs(Math.sin(t*.7+p.p))*.65,1);
 if(effect==='petals')petal(s,['#d88ca6','#e5a6bc','#f4c8d7'][i%3]);
 if(effect==='leaves'){petal(s*1.35,['#c9a36a','#bc895c','#d5b475'][i%3]);}
 if(effect==='confetti'){c.fillStyle=['#d7b0b6','#b5c9bc','#d5bd89','#b5c2d6'][i%4];c.fillRect(-s/3,-s,s*.65,s*1.7);}
 if(effect==='newyear'){c.fillStyle='#b35b55';c.fillRect(-s*.65,-s,s*1.3,s*2);c.strokeStyle='#dfbe7c';c.lineWidth=.8;c.strokeRect(-s*.45,-s*.8,s*.9,s*1.6);c.rotate(Math.PI/4);c.fillStyle='#dfbe7c';c.fillRect(-s*.25,-s*.25,s*.5,s*.5);}
 if(effect==='dragonboat'){c.fillStyle='#91a58a';c.beginPath();c.moveTo(0,-s);c.lineTo(s,s);c.lineTo(-s,s*.6);c.closePath();c.fill();c.strokeStyle='#d8c8a0';c.beginPath();c.moveTo(-s*.4,0);c.lineTo(s*.5,s*.8);c.moveTo(s*.3,-s*.3);c.lineTo(-s*.3,s*.8);c.stroke();}
 }else if(effect==='bubbles'){const g=c.createLinearGradient(-s,-s,s,s);g.addColorStop(0,'rgba(152,190,205,.7)');g.addColorStop(.5,'rgba(235,204,218,.25)');g.addColorStop(1,'rgba(162,204,190,.65)');c.strokeStyle=g;c.lineWidth=1;ellipse(0,0,s*1.7,s*1.7);c.stroke();c.strokeStyle='rgba(255,255,255,.8)';c.beginPath();c.arc(0,0,s*1.3,3.7,4.5);c.stroke();
 }else if(effect==='hearts'){c.fillStyle='#d6a0ae';c.beginPath();c.moveTo(0,s);c.bezierCurveTo(-s*2,-s*.2,-s,-s*1.5,0,-s*.5);c.bezierCurveTo(s,-s*1.5,s*2,-s*.2,0,s);c.fill();
 }else if(effect==='birthday'){c.fillStyle=['#c8a7b8','#a6bfc4','#d7bf8e'][i%3];ellipse(0,0,s,s*1.3);c.fill();c.strokeStyle='#acaaa2';c.lineWidth=.6;c.beginPath();c.moveTo(0,s*1.3);c.bezierCurveTo(-s,s*2.2,s,s*2.8,0,s*4);c.stroke();
 }else if(effect==='lanterns'){glow(0,0,s*3,'rgba(221,165,91,.35)');c.fillStyle='#c98568';ellipse(0,0,s,s*1.3);c.fill();c.strokeStyle='#edc78f';c.lineWidth=.7;for(let k=-1;k<=1;k++){ellipse(0,0,s*(.3+Math.abs(k)*.4),s*1.3);c.stroke();}c.fillStyle='#ba8c5f';c.fillRect(-s*.6,-s*1.35,s*1.2,2);c.fillRect(-s*.6,s*1.2,s*1.2,2);c.beginPath();c.moveTo(0,s*1.4);c.lineTo(0,s*2.3);c.stroke();
 }else if(['sprouts','wheat','christmas'].includes(effect)){c.strokeStyle=effect==='wheat'?'#b29c66':'#89a38a';c.lineWidth=1;c.beginPath();c.moveTo(0,s*2);c.quadraticCurveTo(-s*.2,0,0,-s*2);c.stroke();for(let k=0;k<4;k++){for(const side of [-1,1]){c.save();c.translate(side*s*.3,-s*1.4+k*s*.65);c.rotate(side*.8);petal(s*(effect==='wheat'?.35:.6),effect==='wheat'?'#c4af74':'#96ad96');c.restore();}}if(effect==='christmas'){glow(0,-s*2,5,'rgba(228,189,104,.8)');}
 }else if(effect==='gifts'){c.fillStyle=['#bd9caa','#9bb5a8','#c8b38c'][i%3];c.fillRect(-s,-s,s*2,s*1.7);c.fillStyle='#eee0c1';c.fillRect(-1,-s,2,s*1.7);c.fillRect(-s,-s*.55,s*2,2);c.strokeStyle='#d2ba90';ellipse(-s*.35,-s*1.2,s*.4,s*.25);c.stroke();ellipse(s*.35,-s*1.2,s*.4,s*.25);c.stroke();
 }else if(effect==='halloween'){c.fillStyle='#c7a075';ellipse(0,0,s,s*.8);c.fill();c.strokeStyle='#a68160';ellipse(0,0,s*.45,s*.8);c.stroke();c.strokeStyle='#889879';c.beginPath();c.moveTo(0,-s*.8);c.lineTo(2,-s*1.2);c.stroke();}
 c.restore();
 });
 }
 function tick(now){if(stopped)return;if(!canvas.isConnected){stop();return;}start??=now;if(now-last>=32){draw((now-start)/1000);last=now;}frame=requestAnimationFrame(tick);}
 function stop(){if(stopped)return;stopped=true;cancelAnimationFrame(frame);observer?.disconnect();}
 frame=requestAnimationFrame(tick);return stop;
}
