class VintageReverbProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      ['mix',0,1,.35],['decay',.2,20,3],['size',.1,1,.55],['predelay',0,250,20],['lowCut',20,1000,120],['highCut',1500,20000,12000],['damping',0,1,.45],['modRate',0,8,.35],['modDepth',0,1,.25],['stereoWidth',0,2,1.15],['inputGain',-24,24,0],['outputGain',-24,24,0]
    ].map(([name,minValue,maxValue,defaultValue])=>({name,minValue,maxValue,defaultValue,automationRate:'k-rate'}));
  }
  constructor(){
    super(); this.mode='Plate'; this.color='Dark Vintage'; this.wetSolo=false; this.bypass=false; this.sr=sampleRate; this.phase=0;
    this.maxDelay=Math.ceil(this.sr*2.5); this.preL=new Float32Array(Math.ceil(this.sr*.3)); this.preR=new Float32Array(Math.ceil(this.sr*.3)); this.preI=0;
    this.lines=[.0297,.0371,.0411,.0437,.053,.061,.071,.083].map(t=>({buf:new Float32Array(this.maxDelay),i:0,lp:0}));
    this.ap=[.005,.0067,.011,.013].map(t=>({buf:new Float32Array(Math.ceil(this.sr*t)),i:0,g:.68}));
    this.hpL=0;this.hpR=0;this.hpXL=0;this.hpXR=0;this.lpL=0;this.lpR=0;
    this.port.onmessage=e=>{const d=e.data||{}; if(d.type==='state'){Object.assign(this,d.state)}};
  }
  p(params,n){const v=params[n]; return v.length?v[0]:v[0]}
  db(v){return Math.pow(10,v/20)}
  clamp(v,a,b){return Math.min(b,Math.max(a,v))}
  coeff(freq){return 1-Math.exp(-2*Math.PI*this.clamp(freq,20,20000)/this.sr)}
  read(line,delay){const di=Math.floor(delay), frac=delay-di, len=line.buf.length; let a=(line.i-di+len)%len, b=(a-1+len)%len; return line.buf[a]*(1-frac)+line.buf[b]*frac}
  allpass(x,ap){const y=ap.buf[ap.i]; const out=-x+ y; ap.buf[ap.i]=x + y*ap.g; ap.i=(ap.i+1)%ap.buf.length; return out}
  process(inputs,outputs,parameters){
    const input=inputs[0], out=outputs[0]; if(!input||!input[0]) return true; const inL=input[0], inR=input[1]||input[0], oL=out[0], oR=out[1]||out[0];
    const mix=this.p(parameters,'mix'), decay=this.p(parameters,'decay'), size=this.p(parameters,'size'), preMs=this.p(parameters,'predelay'), low=this.p(parameters,'lowCut'), high=this.p(parameters,'highCut'), damp=this.p(parameters,'damping'), rate=this.p(parameters,'modRate'), depth=this.p(parameters,'modDepth'), width=this.p(parameters,'stereoWidth'), inGain=this.db(this.p(parameters,'inputGain')), outGain=this.db(this.p(parameters,'outputGain'));
    const modeScale={Plate:.72,Room:.42,Hall:.95,Chamber:.62,Cathedral:1.35,Ambience:.25}[this.mode]||.72; const colorHigh={'Dark Vintage':7200,'Bright 80s':15000,'Clean Modern':20000}[this.color]||12000; const colorDamp={'Dark Vintage':.72,'Bright 80s':.35,'Clean Modern':.18}[this.color]||.45;
    const hp=this.coeff(low), lp=this.coeff(Math.min(high,colorHigh)); const fb=this.clamp(.18+decay/22, .2, .92); const preS=Math.floor(this.sr*preMs/1000); const base=[.0297,.0371,.0411,.0437,.053,.061,.071,.083];
    for(let i=0;i<inL.length;i++){
      let dryL=inL[i]*inGain, dryR=inR[i]*inGain; if(this.bypass){oL[i]=dryL*outGain; oR[i]=dryR*outGain; continue}
      const mono=(dryL+dryR)*.5; this.preL[this.preI]=mono; this.preR[this.preI]=(dryL-dryR)*.5; const pr=(this.preI-preS+this.preL.length)%this.preL.length; let x=this.preL[pr]+this.preR[pr]*.18; this.preI=(this.preI+1)%this.preL.length;
      for(const ap of this.ap) x=this.allpass(x,ap);
      this.phase += 2*Math.PI*rate/this.sr; if(this.phase>Math.PI*2) this.phase-=Math.PI*2; let wetL=0, wetR=0;
      for(let l=0;l<this.lines.length;l++){
        const line=this.lines[l], mod=Math.sin(this.phase*(1+(l%3)*.13)+l)*depth*this.sr*.0025, delay=this.sr*base[l]*(.45+size*1.55)*modeScale+mod;
        let y=this.read(line,delay); line.lp += (y-line.lp)*(1-(damp*.75+colorDamp*.25)); y=line.lp; const sign=l%2?-1:1; line.buf[line.i]=x*0.22 + y*fb*sign; line.i=(line.i+1)%line.buf.length; if(l%2) wetR+=y; else wetL+=y;
      }
      wetL*=.24; wetR*=.24; const mid=(wetL+wetR)*.5, side=(wetL-wetR)*.5*width; wetL=mid+side; wetR=mid-side;
      this.hpXL=wetL; this.hpL += (wetL-this.hpL)*hp; wetL-=this.hpL; this.hpXR=wetR; this.hpR += (wetR-this.hpR)*hp; wetR-=this.hpR; this.lpL += (wetL-this.lpL)*lp; this.lpR += (wetR-this.lpR)*lp; wetL=this.lpL; wetR=this.lpR;
      oL[i]=((this.wetSolo?0:dryL*(1-mix))+wetL*(this.wetSolo?1:mix))*outGain; oR[i]=((this.wetSolo?0:dryR*(1-mix))+wetR*(this.wetSolo?1:mix))*outGain;
    } return true;
  }
}
registerProcessor('vintage-reverb-processor', VintageReverbProcessor);
