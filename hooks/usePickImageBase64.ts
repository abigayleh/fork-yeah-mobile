import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

// Picks a photo from the camera roll and returns it as a base64 data URI, ready to
// store directly on a Firestore document (matching web, which stores images the same
// way rather than using Firebase Storage). Compressed to keep documents well under
// Firestore's 1MB cap.
export function usePickImageBase64() {
  const pickImage = async (): Promise<string | null> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to add an image.');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.5,
    });

    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset?.base64) return null;

    return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
  };

  return { pickImage };
}
