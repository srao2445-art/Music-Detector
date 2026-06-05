export const PRESETS=[
 ['Natural Pop Vocal','Pop',{key:'C',scale:'Major',retuneSpeed:35,humanize:42,correctionAmount:72,formantShift:0,mixerDryWet:78}],
 ['Hard Trap Tune','Rap',{key:'D',scale:'Minor',retuneSpeed:96,humanize:2,correctionAmount:100,hardTune:true,naturalTune:false,formantShift:-1,mixerDryWet:92}],
 ['T-Pain Robotic','Robotic',{key:'F#',scale:'Minor',retuneSpeed:100,humanize:0,correctionAmount:100,hardTune:true,transitionSmoothing:6,formantShift:2}],
 ['Travis-style Smooth Tune','Rap',{key:'A',scale:'Minor',retuneSpeed:68,humanize:18,correctionAmount:88,flexTune:18,formantShift:-.5}],
 ['Bollywood Smooth Vocal','World',{key:'E',scale:'Harmonic Minor',retuneSpeed:42,humanize:38,correctionAmount:75,formantShift:1,naturalness:88}],
 ['Afrobeat Vocal','World',{key:'G',scale:'Major',retuneSpeed:48,humanize:35,correctionAmount:70,mixerDryWet:72}],
 ['Drill Rap Vocal','Rap',{key:'C#',scale:'Minor',retuneSpeed:74,humanize:14,correctionAmount:92,formantShift:-2}],
 ['Phonk Vocal FX','FX',{key:'F',scale:'Minor',retuneSpeed:80,humanize:10,correctionAmount:90,formantShift:-5,mixerDryWet:95}],
 ['Clean Podcast Voice','Voice',{key:'C',scale:'Chromatic',retuneSpeed:12,humanize:80,correctionAmount:20,mixerDryWet:35,naturalness:95}],
 ['Female Lead Vocal','Lead',{key:'B',scale:'Major',retuneSpeed:45,humanize:32,correctionAmount:78,formantShift:2.2}],
 ['Male Rap Vocal','Rap',{key:'G#',scale:'Minor',retuneSpeed:65,humanize:22,correctionAmount:84,formantShift:-1.8}]
].map(([name,category,settings])=>({name,category,favorite:false,settings:{...settings,fx:{},mixer:{}}}));
export function applyPreset(state,preset){Object.assign(state,preset.settings);state.currentPreset=preset.name}
export function serializePreset(state,name='Preset'){return {name,category:'User',favorite:false,settings:{key:state.key,scale:state.scale,retuneSpeed:state.retuneSpeed,humanize:state.humanize,correctionAmount:state.correctionAmount,flexTune:state.flexTune,transitionSmoothing:state.transitionSmoothing,hardTune:state.hardTune,naturalTune:state.naturalTune,snapScale:state.snapScale,formantPreserve:state.formantPreserve,formantShift:state.formantShift,genderTone:state.genderTone,throatLength:state.throatLength,voiceCharacter:state.voiceCharacter,naturalness:state.naturalness,fx:state.fx,mixerDryWet:state.mixerDryWet,mixerVolume:state.mixerVolume,mixerPan:state.mixerPan,mixerSend:state.mixerSend,outputGain:state.outputGain}}}
