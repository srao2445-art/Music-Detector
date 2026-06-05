class VocalTuneProcessor extends AudioWorkletProcessor{
  static get parameterDescriptors(){return[{name:'pitchRatio',defaultValue:1,minValue:.5,maxValue:2},{name:'wet',defaultValue:.85,minValue:0,maxValue:1}]}
  process(inputs,outputs,parameters){const input=inputs[0],output=outputs[0];if(!input?.length)return true;const ratio=parameters.pitchRatio,wet=parameters.wet;for(let ch=0;ch<output.length;ch++){const src=input[ch]||input[0],dst=output[ch];for(let i=0;i<dst.length;i++){const r=ratio.length>1?ratio[i]:ratio[0];const w=wet.length>1?wet[i]:wet[0];const read=Math.min(src.length-1,i*r);const i0=Math.floor(read),frac=read-i0;const shifted=(src[i0]||0)*(1-frac)+(src[i0+1]||0)*frac;dst[i]=(shifted*w+src[i]*(1-w))*.96}}return true}
}
registerProcessor('vocal-tune-processor',VocalTuneProcessor);
