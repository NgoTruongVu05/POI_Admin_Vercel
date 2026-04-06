export function escapeHtml(value) {
  return (value ?? '')
    .toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export function setHtml(el, html) {
  el.innerHTML = html;
}

export function getTailwindColorFromClass(className) {
  try {
    const el = document.createElement('span');
    el.className = className;
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    el.style.top = '-9999px';
    document.body.appendChild(el);
    const color = getComputedStyle(el).color;
    el.remove();
    return (typeof color === 'string' && color.trim() !== '') ? color : null;
  } catch {
    return null;
  }
}

export async function waitForGlobal(name, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window[name]) return window[name];
    await new Promise(r => setTimeout(r, 30));
  }
  return null;
}
