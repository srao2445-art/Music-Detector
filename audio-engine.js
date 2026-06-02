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

let nextMessageId = 0;

export class AudioEngine {
  constructor() {
    this.worker = undefined;
    this.pending = new Map();
    this.listeners = { log: [], progress: [] };
  }

  on(event, callback) {
    this.listeners[event]?.push(callback);
  }

  load(config) {
    if (!this.worker) {
      this.worker = new Worker(new URL('./ffmpeg-worker.js', import.meta.url));
      this.worker.addEventListener('message', ({ data }) => this.handleMessage(data));
      this.worker.addEventListener('error', (event) => {
        this.rejectPending(new Error(event.message || 'The audio engine worker could not start.'));
      });
    }
    return this.send(MESSAGE.LOAD, config);
  }

  writeFile(path, data) {
    return this.send(MESSAGE.WRITE_FILE, { path, data }, [data.buffer]);
  }

  exec(args) {
    return this.send(MESSAGE.EXEC, { args });
  }

  readFile(path) {
    return this.send(MESSAGE.READ_FILE, { path });
  }

  deleteFile(path) {
    return this.send(MESSAGE.DELETE_FILE, { path });
  }

  send(type, data, transfer = []) {
    if (!this.worker) return Promise.reject(new Error('The audio engine has not loaded.'));
    const id = ++nextMessageId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, data }, transfer);
    });
  }

  handleMessage({ id, type, data }) {
    if (type === MESSAGE.LOG || type === MESSAGE.PROGRESS) {
      this.listeners[type.toLowerCase()].forEach((callback) => callback(data));
      return;
    }
    const promise = this.pending.get(id);
    if (!promise) return;
    this.pending.delete(id);
    if (type === MESSAGE.ERROR) promise.reject(new Error(data));
    else promise.resolve(data);
  }

  rejectPending(error) {
    this.pending.forEach(({ reject }) => reject(error));
    this.pending.clear();
  }
}

export async function fileToBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

export async function fetchAsBlobUrl(url, type) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download ${url} (${response.status})`);
  return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type }));
}
