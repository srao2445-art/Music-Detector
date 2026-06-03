import { synthesizeModule } from './audio-engine.js';
import { downloadJson } from './preset-manager.js';

export class ExportRenderer {
  constructor(getState) { this.getState = getState; }
  async renderSound(moduleId) {
    const state = this.getState(); const module = state.modules[moduleId];
    const duration = estimateModuleLength(module); const ctx = new OfflineAudioContext(2, Math.ceil(44100 * duration), 44100);
    const master = ctx.createGain(); master.gain.value = state.masterVolume;
    master.connect(ctx.destination);
    synthesizeModule(ctx, module, master, 0.03, 1, true);
    const buffer = await ctx.startRendering(); downloadWav(buffer, `drumforge-${moduleId}.wav`);
  }
  async renderLoop(bars = 1) {
    const state = this.getState(); const stepDur = 60 / state.bpm / 4; const duration = stepDur * state.stepCount * bars + 3;
    const ctx = new OfflineAudioContext(2, Math.ceil(44100 * duration), 44100); const master = ctx.createGain(); master.gain.value = state.masterVolume; master.connect(ctx.destination);
    const pattern = state.sequence; const anySolo = Object.values(pattern.channels).some(ch => ch.solo);
    for (let bar = 0; bar < bars; bar++) for (let step = 0; step < state.stepCount; step++) {
      const t = 0.03 + bar * state.stepCount * stepDur + step * stepDur + (step % 2 ? state.swing * stepDur : 0);
      Object.entries(pattern.channels).forEach(([id, ch]) => { const st = ch.steps[step]; if (st?.on && !ch.mute && (!anySolo || ch.solo)) synthesizeModule(ctx, state.modules[id], master, t, st.velocity, true); });
    }
    const buffer = await ctx.startRendering(); downloadWav(buffer, 'drumforge-loop.wav');
  }
  exportPattern() { const s = this.getState(); downloadJson({ format: 'DrumForge Pro Pattern', version: 1, bpm: s.bpm, swing: s.swing, stepCount: s.stepCount, sequence: s.sequence }, 'drumforge-pattern.json'); }
  exportMidi() { const bytes = makeMidi(this.getState()); const blob = new Blob([bytes], { type: 'audio/midi' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'drumforge-pattern.mid'; a.click(); URL.revokeObjectURL(url); }
}

function estimateModuleLength(module) {
  const p = module.params; return Math.min(10, Math.max(1.2, p.decay || p.tail || p.roomTail * 2 || 2, (p.release || 0) + (p.decay || 1) + 1));
}

export function downloadWav(audioBuffer, filename) {
  const wav = encodeWav(audioBuffer); const blob = new Blob([wav], { type: 'audio/wav' }); const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function encodeWav(buffer) {
  const channels = buffer.numberOfChannels; const sampleRate = buffer.sampleRate; const length = buffer.length * channels * 2 + 44; const out = new ArrayBuffer(length); const view = new DataView(out);
  write(view, 0, 'RIFF'); view.setUint32(4, length - 8, true); write(view, 8, 'WAVE'); write(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); write(view, 36, 'data'); view.setUint32(40, length - 44, true);
  let offset = 44; const data = Array.from({ length: channels }, (_, ch) => buffer.getChannelData(ch));
  for (let i = 0; i < buffer.length; i++) for (let ch = 0; ch < channels; ch++) { const s = Math.max(-1, Math.min(1, data[ch][i])); view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true); offset += 2; }
  return out;
}
function write(view, offset, text) { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); }

function makeMidi(state) {
  const ppq = 96; const stepTicks = ppq / 4; const notes = { kick:36, snare:38, clap:39, hihat:42, cymbal:49, sub808:35, perc:75, fx:55 };
  const events = [];
  Object.entries(state.sequence.channels).forEach(([id, ch]) => ch.steps.forEach((st, step) => { if (st.on) { const tick = Math.round(step * stepTicks); events.push([tick, 0x99, notes[id] || 60, Math.round(st.velocity * 110)]); events.push([tick + 12, 0x89, notes[id] || 60, 0]); } }));
  events.sort((a,b) => a[0]-b[0]); const track = [];
  pushVar(track, 0); track.push(0xff,0x51,0x03, ...u24(Math.round(60000000 / state.bpm)));
  let last = 0; events.forEach(e => { pushVar(track, e[0]-last); track.push(e[1], e[2], e[3]); last = e[0]; }); pushVar(track, 0); track.push(0xff,0x2f,0);
  return new Uint8Array([...str('MThd'),0,0,0,6,0,0,0,1,0,ppq, ...str('MTrk'), ...u32(track.length), ...track]);
}
function str(s) { return [...s].map(c => c.charCodeAt(0)); }
function u24(n) { return [(n>>16)&255,(n>>8)&255,n&255]; }
function u32(n) { return [(n>>24)&255,(n>>16)&255,(n>>8)&255,n&255]; }
function pushVar(a, n) { let b = n & 0x7f; while ((n >>= 7)) { b <<= 8; b |= ((n & 0x7f) | 0x80); } for (;;) { a.push(b & 0xff); if (b & 0x80) b >>= 8; else break; } }
