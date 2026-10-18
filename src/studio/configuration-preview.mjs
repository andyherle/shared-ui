SharedUI.instance?.dispose();
for (const button of document.querySelectorAll('button[data-icon]')) SharedUI.adoptAction(button, {icon: button.dataset.icon, label: button.textContent, sprite: '/v1/icons.svg'});
const sheet = document.createElement('style'); document.head.append(sheet);
const receive = event => {
  if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'configuration-render') return;
  const {css, pack, theme, density} = event.data;
  if (typeof css !== 'string' || css.length > 65536 || !['postvisual', 'personal'].includes(pack) || !['light', 'dark'].includes(theme) || !['default', 'compact', 'dense', 'comfortable'].includes(density)) return;
  sheet.textContent = css; document.querySelector('[data-ui-baseline]')?.remove();
  Object.assign(document.documentElement.dataset, {ui: pack, theme, uiDensity: density}); SharedUI.refreshActions(document);
};
document.querySelector('form').addEventListener('submit', event => event.preventDefault());
document.querySelector('a').addEventListener('click', event => event.preventDefault());
window.addEventListener('message', receive);
window.addEventListener('pagehide', () => {window.removeEventListener('message', receive); SharedUI.disposeActions?.(document);}, {once: true});
parent.postMessage({type: 'configuration-ready'}, location.origin);
