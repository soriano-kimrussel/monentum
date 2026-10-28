// Web preview: download / upload JSON through the browser.
import * as DocumentPicker from 'expo-document-picker';

export async function saveAndShareJson(filename: string, json: string): Promise<string> {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

export async function pickJsonText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.file) return asset.file.text();
  const res = await fetch(asset.uri);
  return res.text();
}
