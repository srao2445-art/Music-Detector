import { MODULES } from './audio-engine.js';
import { defaultPattern, normalizePattern } from './preset-manager.js';

export class DrumSequencer {
  constructor({ engine, getState, onStep, onChange }) {
    this.engine = engine; this.getState = getState; this.onStep = onStep; this.onChange = onChange;
    this.timer = null; this.step = 0; this.nextTime = 0; this.running = false;
  }
  ensurePattern() {
    const state = this.getState();
    state.sequence = normalizePattern(state.sequence || defaultPattern(state.stepCount), state.stepCount);
    return state.sequence;
  }
  setSteps(count) {
    const state = this.getState(); state.stepCount = count; state.sequence = normalizePattern(state.sequence, count); this.onChange?.();
  }
  toggle(channel, step) { const p = this.ensurePattern(); p.channels[channel].steps[step].on = !p.channels[channel].steps[step].on; this.onChange?.(); }
  setVelocity(channel, step, velocity) { const p = this.ensurePattern(); p.channels[channel].steps[step].velocity = velocity; this.onChange?.(); }
  clear() { const s = this.getState(); s.sequence = defaultPattern(s.stepCount); Object.values(s.sequence.channels).forEach(ch => ch.steps.forEach(st => st.on = false)); this.onChange?.(); }
  humanize() { const p = this.ensurePattern(); Object.values(p.channels).forEach(ch => ch.steps.forEach(st => { if (st.on) st.velocity = Math.max(.18, Math.min(1, st.velocity + (Math.random() - .5) * .28)); })); this.onChange?.(); }
  channelMute(id) { const p = this.ensurePattern(); p.channels[id].mute = !p.channels[id].mute; this.onChange?.(); }
  channelSolo(id) { const p = this.ensurePattern(); p.channels[id].solo = !p.channels[id].solo; this.onChange?.(); }
  async start() { await this.engine.init(); this.running = true; this.step = 0; this.nextTime = this.engine.context.currentTime + .04; this.schedule(); }
  stop() { this.running = false; clearTimeout(this.timer); this.onStep?.(-1); }
  togglePlay() { return this.running ? this.stop() : this.start(); }
  schedule() {
    if (!this.running) return;
    const state = this.getState(); const ctx = this.engine.context; const stepDur = 60 / state.bpm / 4;
    while (this.nextTime < ctx.currentTime + .12) {
      const swingOffset = (this.step % 2 ? state.swing * stepDur : 0);
      this.playStep(this.step, this.nextTime + swingOffset);
      this.onStep?.(this.step);
      this.nextTime += stepDur; this.step = (this.step + 1) % state.stepCount;
    }
    this.timer = setTimeout(() => this.schedule(), 25);
  }
  playStep(step, time) {
    const state = this.getState(); const p = this.ensurePattern(); const anySolo = Object.values(p.channels).some(ch => ch.solo);
    Object.keys(MODULES).forEach(id => {
      const ch = p.channels[id]; const st = ch.steps[step];
      if (st?.on && !ch.mute && (!anySolo || ch.solo) && !state.modules[id].muted) this.engine.trigger(state.modules[id], st.velocity, time, this.engine.master, true);
    });
  }
}
