// Optional AudioWorkletProcessor for lightweight live metering/noise-gate preview.
// Final export quality is produced offline in audio-engine.js, not inside this realtime worklet.
class NoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.threshold = 0.004;
    this.gain = 1;
    this.frame = 0;
    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.threshold === 'number') this.threshold = event.data.threshold;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    let peak = 0;

    for (let channel = 0; channel < output.length; channel += 1) {
      const inChan = input[channel] || input[0] || new Float32Array(output[channel].length);
      const outChan = output[channel];
      for (let i = 0; i < outChan.length; i += 1) {
        peak = Math.max(peak, Math.abs(inChan[i]));
        const target = Math.abs(inChan[i]) < this.threshold ? 0.35 : 1;
        this.gain = target < this.gain ? this.gain * 0.96 + target * 0.04 : this.gain * 0.995 + target * 0.005;
        outChan[i] = inChan[i] * this.gain;
      }
    }

    this.frame += 1;
    if (this.frame % 24 === 0) this.port.postMessage({ peak });
    return true;
  }
}

registerProcessor('noise-processor', NoiseProcessor);
