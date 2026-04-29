import Constants from 'expo-constants';
import { navigationRef } from '@misc/NavigationService';

const CURRENT_VERSION = Constants.expoConfig?.version ?? '1.2.1';
const GITHUB_REPO = 'hiuraaaaa/AniFlix';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const UPDATE_NOTES_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/master/UPDATE_NOTES.md`;

function parseVersion(version: string): number[] {
  return version.replace(/^v/, '').split('.').map(Number);
}

function isNewerVersion(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] ?? 0;
    const cv = c[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export async function checkForUpdate(): Promise<void> {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!response.ok) return;

    const release = await response.json();
    const latestVersion: string = release.tag_name ?? '';

    if (!latestVersion || !isNewerVersion(latestVersion, CURRENT_VERSION)) return;

    // Ambil update notes dari UPDATE_NOTES.md
    let changelog = '';
    try {
      const notesRes = await fetch(UPDATE_NOTES_URL);
      if (notesRes.ok) {
        changelog = await notesRes.text();
      }
    } catch {}

    // Fallback ke release notes GitHub
    if (!changelog) {
      changelog = release.body ?? 'Tidak ada catatan update.';
    }

    // Cari APK universal atau arm64
    const assets: { name: string; browser_download_url: string }[] = release.assets ?? [];
    const apkAsset =
      assets.find(a => a.name.includes('universal')) ||
      assets.find(a => a.name.includes('arm64')) ||
      assets.find(a => a.name.endsWith('.apk'));

    const downloadUrl = apkAsset?.browser_download_url ?? release.html_url;

    // Navigate ke screen NeedUpdate
    navigationRef.current?.navigate('NeedUpdate', {
      nativeUpdate: true,
      latestVersion,
      changelog,
      download: downloadUrl,
    });
  } catch {
    // Gagal cek update, skip aja
  }
}

