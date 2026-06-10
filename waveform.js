export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export async function buildLowResolutionPeaks(file, barCount = 900) {
  // This intentionally avoids Web Audio API AudioBuffer decoding. For long MP3s,
  // it samples small byte ranges across the compressed file to create a visual-only,
  // low-resolution activity preview without duplicating the full audio in memory.
  const size = file.size;
  const chunkSize = Math.min(4096, Math.max(512, Math.floor(size / barCount)));
  const peaks = new Float32Array(barCount);

  for (let i = 0; i < barCount; i += 1) {
    const center = Math.floor((i / Math.max(1, barCount - 1)) * Math.max(0, size - chunkSize));
    const buffer = await file.slice(center, center + chunkSize).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let sum = 0;
    for (let j = 0; j < bytes.length; j += 8) sum += Math.abs(bytes[j] - 128);
    peaks[i] = Math.min(1, (sum / Math.max(1, Math.ceil(bytes.length / 8))) / 68);
  }

  smoothPeaks(peaks);
  return peaks;
}

function smoothPeaks(peaks) {
  for (let i = 1; i < peaks.length - 1; i += 1) {
    peaks[i] = (peaks[i - 1] + peaks[i] * 2 + peaks[i + 1]) / 4;
  }
}

export function drawWaveform(canvas, peaks, selection, duration) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = rect.width;
  const height = rect.height;
  const mid = height / 2;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, 'rgba(77, 248, 229, 0.08)');
  bg.addColorStop(1, 'rgba(54, 168, 255, 0.04)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  if (!peaks?.length) {
    ctx.fillStyle = 'rgba(159, 179, 199, 0.7)';
    ctx.font = '600 16px system-ui';
    ctx.fillText('Upload an MP3 to draw a lightweight preview', 24, mid);
    return;
  }

  const barWidth = Math.max(1, width / peaks.length);
  const selectedStart = duration ? (selection.start / duration) * width : 0;
  const selectedEnd = duration ? (selection.end / duration) * width : width;

  ctx.fillStyle = 'rgba(77, 248, 229, 0.12)';
  ctx.fillRect(selectedStart, 0, Math.max(0, selectedEnd - selectedStart), height);

  for (let i = 0; i < peaks.length; i += 1) {
    const x = i * barWidth;
    const amp = Math.max(0.04, peaks[i]);
    const barHeight = amp * height * 0.82;
    const inSelection = x >= selectedStart && x <= selectedEnd;
    const gradient = ctx.createLinearGradient(0, mid - barHeight / 2, 0, mid + barHeight / 2);
    gradient.addColorStop(0, inSelection ? '#65fff0' : 'rgba(54, 168, 255, 0.55)');
    gradient.addColorStop(1, inSelection ? '#36a8ff' : 'rgba(77, 248, 229, 0.38)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, mid - barHeight / 2, Math.max(1, barWidth * 0.62), barHeight);
  }
}
