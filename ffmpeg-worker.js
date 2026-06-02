const MESSAGE = {
  LOAD: 'LOAD',
  EXEC: 'EXEC',
  WRITE_FILE: 'WRITE_FILE',
  READ_FILE: 'READ_FILE',
  DELETE_FILE: 'DELETE_FILE',
  ERROR: 'ERROR',
  PROGRESS: 'PROGRESS',
  LOG: 'LOG',
};

let ffmpeg;

async function load({ coreURL, wasmURL }) {
  if (ffmpeg) return;
  importScripts(coreURL);
  ffmpeg = await self.createFFmpegCore({
    mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL }))}`,
  });
  ffmpeg.setLogger((data) => self.postMessage({ type: MESSAGE.LOG, data }));
  ffmpeg.setProgress((data) => self.postMessage({ type: MESSAGE.PROGRESS, data }));
}

function exec({ args }) {
  ffmpeg.exec('-nostdin', '-y', ...args);
  const code = ffmpeg.ret;
  ffmpeg.reset();
  return code;
}

self.addEventListener('message', async ({ data: { id, type, data } }) => {
  try {
    let result;
    if (type === MESSAGE.LOAD) result = await load(data);
    else if (!ffmpeg) throw new Error('The audio engine is not loaded.');
    else if (type === MESSAGE.WRITE_FILE) result = ffmpeg.FS.writeFile(data.path, data.data);
    else if (type === MESSAGE.EXEC) result = exec(data);
    else if (type === MESSAGE.READ_FILE) result = ffmpeg.FS.readFile(data.path);
    else if (type === MESSAGE.DELETE_FILE) result = ffmpeg.FS.unlink(data.path);
    else throw new Error(`Unsupported audio-engine action: ${type}`);

    const transfer = result instanceof Uint8Array ? [result.buffer] : [];
    self.postMessage({ id, type, data: result }, transfer);
  } catch (error) {
    self.postMessage({ id, type: MESSAGE.ERROR, data: error.message || String(error) });
  }
});
