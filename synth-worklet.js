class NocturneVoice {
  constructor(note, velocity, settings, sampleRate) {
    this.note = note; this.velocity = velocity; this.settings = settings; this.sampleRate = sampleRate;
    this.freq = 440 * Math.pow(2, (note - 69) / 12); this.phase = [0, 0, 0]; this.age = 0; this.released = false; this.releaseAt = 0; this.filter = 0;
  }
  wavetable(phase, position) {
    const p = phase % 1, sine = Math.sin(p * Math.PI * 2), saw = p * 2 - 1, square = p < .5 ? 1 : -1, tri = 1 - 4 * Math.abs(p - .5);
    if (position < .34) return sine + (tri - sine) * position / .34;
    if (position < .68) return tri + (saw - tri) * (position - .34) / .34;
    return saw + (square - saw) * (position - .68) / .32;
  }
  next() {
    this.age++;
    const t = this.age / this.sampleRate, env = this.released ? Math.max(0, 1 - (this.age - this.releaseAt) / (this.sampleRate * .7)) : Math.min(1, t / .025);
    if (env <= 0) return null;
    let sum = 0;
    this.settings.osc.forEach((o, i) => { this.phase[i] += this.freq * Math.pow(2, o.tune / 12) / this.sampleRate; sum += this.wavetable(this.phase[i], o.position) * o.level; });
    const input = sum / 3 * this.velocity * env, cutoff = Math.min(.48, Math.max(.005, this.settings.cutoff));
    this.filter += cutoff * (input - this.filter);
    return this.filter;
  }
}
class NocturneProcessor extends AudioWorkletProcessor {
  constructor(){super();this.voices=[];this.settings={cutoff:.12,osc:[{position:.18,tune:0,level:.8},{position:.52,tune:0,level:.6},{position:.82,tune:-12,level:.44}]};this.port.onmessage=e=>this.message(e.data)}
  message(data){if(data.type==='noteOn')this.voices.push(new NocturneVoice(data.note,data.velocity||.8,this.settings,sampleRate));if(data.type==='noteOff')this.voices.forEach(v=>{if(v.note===data.note&&!v.released){v.released=true;v.releaseAt=v.age}});if(data.type==='panic')this.voices=[];if(data.type==='settings')this.settings=data.settings}
  process(_,outputs){const out=outputs[0];for(let c=0;c<out.length;c++)out[c].fill(0);for(let i=0;i<out[0].length;i++){let sum=0;this.voices=this.voices.filter(v=>{const n=v.next();if(n===null)return false;sum+=n;return true});const soft=Math.tanh(sum*1.3);out.forEach((channel,c)=>channel[i]=soft*(c?0.985:1))}return true}
}
registerProcessor('nocturne-synth', NocturneProcessor);
