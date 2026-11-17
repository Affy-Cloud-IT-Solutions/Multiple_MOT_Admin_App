import { NativeModules, Platform, Linking, Alert } from 'react-native';
import Toast from 'react-native-toast-message';

const { DownloadManagerModule } = NativeModules;

export interface DownloadFileParams {
  url: string;
  fileName: string;
  title?: string;
  mimeType?: string;
}

/**
 * Downloads a file directly into the device's Files / Downloads folder.
 * Uses Android's native system DownloadManager so it saves directly to storage without opening Chrome.
 */
export async function downloadReceiptFile({
  url,
  fileName,
  title = 'Downloading Receipt',
  mimeType = 'application/pdf',
}: DownloadFileParams): Promise<boolean> {
  const sanitizedFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  if (Platform.OS === 'android' && DownloadManagerModule && typeof DownloadManagerModule.downloadFile === 'function') {
    try {
      await DownloadManagerModule.downloadFile(url, sanitizedFileName, title, mimeType);
      Toast.show({
        type: 'success',
        text1: '📥 Saving to Device Files',
        text2: `${sanitizedFileName} is downloading to your Downloads folder`,
        visibilityTime: 4000,
      });
      return true;
    } catch (err: any) {
      console.warn('[DownloadManager] Native download failed, falling back to browser:', err);
    }
  }

  // Fallback for iOS or before native rebuild
  try {
    await Linking.openURL(url);
    return true;
  } catch (err: any) {
    Alert.alert('Download Error', `Could not download file: ${err?.message || 'Unknown error'}`);
    return false;
  }
}
