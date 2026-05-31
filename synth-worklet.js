class NocturneVoice {
  constructor(note, velocity, settings, sampleRate) {
    this.note=note;this.velocity=velocity;this.settings=settings;this.sampleRate=sampleRate;this.freq=440*Math.pow(2,(note-69)/12);this.phase=[0,0,0,0];this.age=0;this.released=false;this.releaseAt=0;this.low=0;this.band=0;this.seed=(note*9973)%2147483647;
  }
  wavetable(phase,position,warp){const p=(phase+Math.sin(phase*Math.PI*2)*warp*.12)%1,sine=Math.sin(p*Math.PI*2),saw=p*2-1,square=p<.5?1:-1,tri=1-4*Math.abs(p-.5);if(position<.34)return sine+(tri-sine)*position/.34;if(position<.68)return tri+(saw-tri)*(position-.34)/.34;return saw+(square-saw)*(position-.68)/.32}
  envelope(){const s=this.settings.env,t=this.age/this.sampleRate;if(this.released)return Math.max(0,this.releaseLevel*(1-(this.age-this.releaseAt)/(this.sampleRate*s.release)));if(t<s.attack)return t/s.attack;if(t<s.attack+s.decay)return 1-(1-s.sustain)*(t-s.attack)/s.decay;return s.sustain}
  next(){this.age++;const env=this.envelope();if(env<=0)return null;const s=this.settings,lfo=Math.sin(this.age/this.sampleRate*Math.PI*2*s.lfoRate)*s.lfoDepth;let sum=0;s.osc.forEach((o,i)=>{this.phase[i]+=this.freq*Math.pow(2,o.tune/12)/this.sampleRate;sum+=this.wavetable(this.phase[i],Math.max(0,Math.min(1,o.position+lfo)),o.warp)*o.level});this.phase[3]+=this.freq*.5/this.sampleRate;sum+=Math.sin(this.phase[3]*Math.PI*2)*s.subLevel;this.seed=this.seed*16807%2147483647;sum+=(this.seed/2147483647*2-1)*s.noiseLevel;const input=sum/4*this.velocity*env,cutoff=Math.min(.48,Math.max(.004,s.cutoff+lfo*.12));this.low+=cutoff*this.band;this.band+=cutoff*(input-this.low-s.resonance*this.band);return this.low*(1-s.filterMix)+this.band*s.filterMix}
  release(){if(!this.released){this.releaseLevel=this.envelope();this.released=true;this.releaseAt=this.age}}
}
class NocturneProcessor extends AudioWorkletProcessor {
  constructor(){super();this.voices=[];this.settings={cutoff:.18,resonance:.2,filterMix:.15,subLevel:.12,noiseLevel:.015,lfoRate:1.4,lfoDepth:.02,env:{attack:.03,decay:.22,sustain:.68,release:.45},osc:[{position:.18,tune:0,level:.8,warp:.2},{position:.52,tune:0,level:.6,warp:.1},{position:.82,tune:-12,level:.44,warp:.1}]};this.port.onmessage=e=>this.message(e.data)}
  message(data){if(data.type==='noteOn')this.voices.push(new NocturneVoice(data.note,data.velocity||.8,this.settings,sampleRate));if(data.type==='noteOff')this.voices.forEach(v=>{if(v.note===data.note)v.release()});if(data.type==='panic')this.voices=[];if(data.type==='settings'){this.settings=data.settings;this.voices.forEach(v=>v.settings=data.settings)}}
  process(_,outputs){const out=outputs[0];out.forEach(c=>c.fill(0));for(let i=0;i<out[0].length;i++){let sum=0;this.voices=this.voices.filter(v=>{const n=v.next();if(n===null)return false;sum+=n;return true});const soft=Math.tanh(sum*1.5);out.forEach((channel,c)=>channel[i]=soft*(c?0.985:1))}return true}
}
registerProcessor('nocturne-synth',NocturneProcessor);
