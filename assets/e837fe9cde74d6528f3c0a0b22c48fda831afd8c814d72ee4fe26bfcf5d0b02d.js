'use strict';
function recordingQueue(material,words,index=null){
  if(material.kind!=='vocabulary')return {clips:material.audio?[{file:material.audio,gap:0}]:[],missing:0};
  const selected=index===null?words:[words[index]];
  const available=selected.filter(w=>w&&w.audio);
  return {clips:available.map((w,i)=>({file:w.audio,gap:i===available.length-1?0:material.between_gap})),missing:selected.length-available.length};
}
class RecordingPlayer{
  constructor(env,notify,mediaBase='/uploads/'){this.mediaBase=mediaBase;this.env=env;this.notify=notify;this.state='idle';this.generation=0;this.timer=null;this.audio=null;}
  stop(announce=true){this.generation++;this.env.clearTimeout(this.timer);this.timer=null;if(this.audio){this.audio.onended=null;this.audio.onerror=null;this.audio.pause();this.audio.currentTime=0;}this.audio=null;this.state='idle';if(announce)this.notify('已停止','idle');}
  start(clips){this.stop(false);this.clips=clips;this.index=0;if(!clips.length){this.notify('老師尚未上傳錄音，請稍後再來喔！','idle');return;}this.state='playing';this.next();}
  next(){
    if(this.index>=this.clips.length){this.stop(false);this.notify('播放完成','idle');return;}
    this.phase='audio';const audio=this.env.audio(this.mediaBase ? this.mediaBase+encodeURIComponent(this.clips[this.index].file) : this.clips[this.index].file);this.audio=audio;
    audio.onended=()=>{if(this.audio!==audio||this.state!=='playing')return;this.phase='gap';this.wait(this.clips[this.index].gap*1000);};
    audio.onerror=()=>{if(this.audio===audio)this.fail();};this.playCurrent();
  }
  fail(){this.stop(false);this.notify('錄音無法播放，請重試，或請教師改用 MP3／WAV 音檔。','idle');}
  playCurrent(){const generation=++this.generation;this.notify('播放中','playing');try{Promise.resolve(this.audio.play()).catch(()=>{if(generation===this.generation)this.fail();});}catch(e){this.fail();}}
  wait(ms){this.remaining=ms;this.deadline=this.env.now()+ms;this.timer=this.env.setTimeout(()=>{this.timer=null;if(this.state==='playing'){this.index++;this.next();}},ms);}
  pause(){if(this.state!=='playing')return;this.state='paused';this.generation++;if(this.phase==='gap'){this.remaining=Math.max(0,this.deadline-this.env.now());this.env.clearTimeout(this.timer);this.timer=null;}else this.audio.pause();this.notify('已暫停','paused');}
  resume(){if(this.state!=='paused')return;this.state='playing';if(this.phase==='gap'){this.notify('播放中','playing');this.wait(this.remaining);}else this.playCurrent();}
}
if(typeof module!=='undefined')module.exports={recordingQueue,RecordingPlayer};
if(typeof document!=='undefined'){
  document.querySelectorAll('input[type=file][name=image]').forEach(input=>input.addEventListener('change',()=>{
    const old=input.parentElement.querySelector('.preview');if(old){URL.revokeObjectURL(old.src);old.remove();}
    const file=input.files[0];if(file){const img=document.createElement('img');img.className='preview';img.alt='選取圖片預覽，儲存後才會更新教材';img.src=URL.createObjectURL(file);input.parentElement.append(img);}
  }));
  // Only one teacher recording preview may play at a time.
  document.addEventListener('play',e=>{if(e.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(a=>{if(a!==e.target)a.pause();});},true);
  const dataNode=document.querySelector('#lesson-data');
  if(dataNode&&document.querySelector('#play')){
    const data=JSON.parse(dataNode.dataset.payload);let selected=null,missing=0;
    const notify=(text,state)=>{document.querySelector('#status').textContent=text+(missing?'（略過 '+missing+' 個尚未錄音的單字）':'');document.querySelector('#pause').disabled=state!=='playing';document.querySelector('#resume').disabled=state!=='paused';};
    const player=new RecordingPlayer({audio:src=>new Audio(src),setTimeout:(fn,ms)=>window.setTimeout(fn,ms),clearTimeout:id=>window.clearTimeout(id),now:()=>performance.now()},notify,data.mediaBase ?? '/uploads/');
    function play(index=null){selected=index;const q=recordingQueue(data.material,data.words,index);missing=q.missing;player.start(q.clips);}
    document.querySelector('#play').onclick=()=>play();document.querySelectorAll('.word-play').forEach(b=>b.onclick=()=>play(Number(b.dataset.index)));
    document.querySelector('#pause').onclick=()=>player.pause();document.querySelector('#resume').onclick=()=>player.resume();
    window.addEventListener('pagehide',()=>player.stop(false));document.addEventListener('click',e=>{if(e.target.closest('a[href]'))player.stop(false);});
  }
  if(document.referrer.startsWith(location.origin)&&!location.hash)document.querySelector('h1')?.focus({preventScroll:true});
}
