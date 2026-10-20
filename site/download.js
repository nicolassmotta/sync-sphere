// Aponta os botões para os pacotes da última Release. Sem JavaScript ou sem
// resposta da API, os links continuam levando para a página de Releases.
const repository = 'nicolassmotta/sync-sphere';

const detectTarget = async () => {
  const hints = navigator.userAgentData;
  const agent = navigator.userAgent.toLowerCase();
  const platform = (hints?.platform || navigator.platform || '').toLowerCase();
  // iPad se apresenta como Mac; celulares e tablets não rodam o aplicativo.
  if (hints?.mobile || /android|iphone|ipad|ipod/.test(agent) || (platform.includes('mac') && navigator.maxTouchPoints > 1)) return null;
  let architecture = /arm|aarch64/.test(agent) ? 'arm' : null;
  try {
    if (hints?.getHighEntropyValues) architecture = (await hints.getHighEntropyValues(['architecture'])).architecture || architecture;
  } catch { /* O navegador pode recusar a dica de arquitetura. */ }
  if (platform.includes('win')) return architecture === 'arm' ? 'win-arm64' : 'win-x64';
  // Safari e Firefox não informam a arquitetura no Mac; Apple Silicon é o padrão desde 2020.
  if (platform.includes('mac')) return architecture === 'x86' ? 'darwin-x64' : 'darwin-arm64';
  if (platform.includes('linux')) return architecture === 'arm' ? 'linux-arm64' : 'linux-x64';
  return null;
};

const fetchRelease = async () => {
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
};

const [target, release] = await Promise.all([detectTarget(), fetchRelease()]);

const hero = document.querySelector('[data-hero-download]');
const heroLabel = hero?.dataset[`label${(target || '').replace(/(^|-)(\w)/g, (_, dash, letter) => letter.toUpperCase())}`];
if (hero && target && heroLabel) {
  hero.dataset.target = target;
  hero.querySelector('[data-hero-label]').textContent = heroLabel;
  if (target === 'darwin-arm64') document.querySelector('[data-mac-hint]')?.removeAttribute('hidden');
}

// A v1.0.0 saiu sem pacotes: só anuncia a versão quando ela tem o que baixar.
const assets = release?.assets || [];
const packageFor = (target) => assets.find(({ name }) => name.endsWith(`-${target}.zip`) || name.endsWith(`-${target}.tar.gz`));
if (assets.some(({ name }) => /\.(zip|tar\.gz)$/.test(name))) {
  const megabytes = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 0 });
  for (const link of document.querySelectorAll('[data-target]')) {
    const asset = packageFor(link.dataset.target);
    if (!asset) continue;
    link.href = asset.browser_download_url;
    const size = link.querySelector('[data-size]');
    if (size) size.textContent = `${megabytes.format(asset.size / 1048576)} MB`;
  }
  for (const link of document.querySelectorAll('[data-asset]')) {
    const asset = assets.find(({ name }) => name === link.dataset.asset);
    if (asset) link.href = asset.browser_download_url;
  }
  for (const version of document.querySelectorAll('[data-version]')) version.textContent = release.tag_name.replace(/^v/, '');
  document.querySelector('[data-release]')?.removeAttribute('hidden');
}
