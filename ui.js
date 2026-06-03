export const $ = selector => document.querySelector(selector);

export function bindTabs(root = document) {
  root.querySelectorAll('.editor-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.tab;
      root.querySelectorAll('.editor-tabs .tab').forEach(btn => btn.classList.toggle('active', btn === tab));
      root.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === key));
    });
  });
}

export function label(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, m => m.toUpperCase());
}

export function fmt(value) {
  const number = Number(value);
  return number.toFixed(Math.abs(number) >= 10 ? 0 : 2);
}

export function setPressed(button, pressed) {
  button?.classList.toggle('pressed', pressed);
  if (pressed) setTimeout(() => button.classList.remove('pressed'), 140);
}
