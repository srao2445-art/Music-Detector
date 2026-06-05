export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const SCALE_INTERVALS = {
  'Major':[0,2,4,5,7,9,11], 'Minor':[0,2,3,5,7,8,10], 'Harmonic Minor':[0,2,3,5,7,8,11],
  'Melodic Minor':[0,2,3,5,7,9,11], 'Pentatonic':[0,2,4,7,9], 'Blues':[0,3,5,6,7,10], 'Chromatic':[0,1,2,3,4,5,6,7,8,9,10,11]
};
export function frequencyToMidi(freq){return 69+12*Math.log2(freq/440)}
export function midiToFrequency(midi){return 440*Math.pow(2,(midi-69)/12)}
export function midiToNote(midi){const n=Math.round(midi);return `${NOTE_NAMES[((n%12)+12)%12]}${Math.floor(n/12)-1}`}
export function allowedPitchClasses(key='C', scale='Major', custom=null){if(custom?.length)return custom;const root=NOTE_NAMES.indexOf(key);return (SCALE_INTERVALS[scale]||SCALE_INTERVALS.Major).map(i=>(root+i)%12)}
export function nearestAllowedMidi(midi, classes){let best=midi, bestDist=999;for(let oct=-1;oct<=10;oct++){for(const pc of classes){const cand=12*(oct+1)+pc;const d=Math.abs(cand-midi);if(d<bestDist){bestDist=d;best=cand}}}return best}
export function detectPitchYin(buffer, sampleRate){const threshold=.12;const minFreq=65,maxFreq=1100;const minTau=Math.floor(sampleRate/maxFreq),maxTau=Math.min(Math.floor(sampleRate/minFreq),buffer.length-2);const yin=new Float32Array(maxTau+1);let running=0;for(let tau=1;tau<=maxTau;tau++){let sum=0;for(let i=0;i<maxTau;i++){const d=buffer[i]-buffer[i+tau];sum+=d*d}running+=sum;yin[tau]=running?sum*tau/running:1}let tauEstimate=-1;for(let tau=minTau;tau<=maxTau;tau++){if(yin[tau]<threshold){while(tau+1<=maxTau&&yin[tau+1]<yin[tau])tau++;tauEstimate=tau;break}}if(tauEstimate<0){let min=1;for(let tau=minTau;tau<=maxTau;tau++){if(yin[tau]<min){min=yin[tau];tauEstimate=tau}}if(min>.35)return {frequency:0,confidence:0}}const better=parabolic(yin,tauEstimate);const frequency=sampleRate/better;return {frequency,confidence:Math.max(0,Math.min(1,1-yin[tauEstimate]))}}
function parabolic(arr,i){const x0=arr[i-1]??arr[i],x1=arr[i],x2=arr[i+1]??arr[i];const denom=x0-2*x1+x2;return denom?i+(x0-x2)/(2*denom):i}
export function pitchInfo(freq, state){if(!freq)return {note:'--',cents:0,target:'--',targetFreq:0};const midi=frequencyToMidi(freq);const rounded=Math.round(midi);const classes=allowedPitchClasses(state.key,state.scale,state.customScale);const targetMidi=state.snapScale?nearestAllowedMidi(midi,classes):rounded;return {note:midiToNote(midi),cents:Math.round((midi-rounded)*100),target:midiToNote(targetMidi),targetFreq:midiToFrequency(targetMidi),midi,targetMidi}}
