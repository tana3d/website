type Hints = { platform?: string; architecture?: string; bitness?: string; mobile?: boolean };
export type DownloadNavigator = {
  userAgent: string;
  maxTouchPoints?: number;
  userAgentData?: Hints & { getHighEntropyValues?: (hints: string[]) => Promise<Hints> };
};

export async function detectDownloadPlatform(nav: DownloadNavigator): Promise<string | null> {
  const ua = nav.userAgent;
  if (nav.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(ua)
    || (/Macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1)) return null;
  let hints: Hints = nav.userAgentData ?? {};
  try {
    const detail = await nav.userAgentData?.getHighEntropyValues?.(['architecture', 'bitness']);
    hints = { ...hints, ...detail };
  } catch { /* Missing or denied hints leave the choice to the visitor. */ }
  const platform = hints.platform ?? '';
  if (platform === 'macOS' || /Macintosh/i.test(ua)) {
    // Apple Silicon browsers also say "Intel Mac OS X" and "MacIntel".
    // Only an explicit architecture hint can choose between the two installers.
    if (hints.architecture === 'arm') return 'darwin-arm64';
    if (hints.architecture === 'x86') return 'darwin-x64';
    return null;
  }
  if (platform === 'Windows' || /Windows/i.test(ua)) {
    if (hints.architecture === 'x86' && hints.bitness === '64') return 'win32-x64';
    if (!hints.architecture && /Win64|WOW64/i.test(ua)) return 'win32-x64';
  }
  if (platform === 'Linux' || /Linux/i.test(ua)) {
    if (hints.architecture === 'x86' && hints.bitness === '64') return 'linux-x64';
    if (!hints.architecture && /x86_64|amd64/i.test(ua)) return 'linux-x64';
  }
  return null;
}

export async function setupDownloadPicker(doc: Document, nav: DownloadNavigator) {
  const picker = doc.querySelector<HTMLSelectElement>('[data-download-picker]');
  const button = doc.querySelector<HTMLAnchorElement>('[data-primary-download]');
  if (!picker || !button || picker.dataset.ready) return;
  picker.dataset.ready = 'true';
  let manual = false;
  function update() {
    const option = picker!.selectedOptions[0];
    button!.href = option?.dataset.url ?? '#studio-downloads';
    button!.dataset.platform = option?.value ?? '';
    const label = button!.querySelector('[data-download-label]');
    if (label) label.textContent = option?.value ? `Download for ${option.textContent}` : 'Choose your download';
  }
  picker.addEventListener('change', () => { manual = true; update(); });
  const detected = await detectDownloadPlatform(nav);
  if (!manual && picker.isConnected && detected
    && Array.from(picker.options).some(option => option.value === detected)) {
    picker.value = detected;
    update();
  }
}
