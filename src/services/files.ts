// Native file export/import for local backups. Files stay on the device unless the user shares them.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function saveAndShareJson(filename: string, json: string): Promise<string> {
  const file = new File(Paths.document, filename);
  file.create({ overwrite: true });
  await file.write(json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Momentum backup' });
  }
  return file.uri;
}

/** Returns the picked file's text, or null if the user cancelled. */
export async function pickJsonText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > 5 * 1024 * 1024) throw new Error('File is larger than 5 MB.');
  return new File(asset.uri).text();
}
