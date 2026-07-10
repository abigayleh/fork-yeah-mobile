import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import RecipeActions from './RecipeActions';

type Props = {
  id: string;
  title: string;
  image: string;
  isMyRecipe: boolean;
  isFavorited?: boolean;
  isWantToTry?: boolean;
  onFavorite?: () => void;
  onWantToTry?: () => void;
};

export default function RecipeCard({ id, title, image, isMyRecipe, isFavorited, isWantToTry, onFavorite, onWantToTry }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push((isMyRecipe ? `/(app)/my-recipe/${id}` : `/(app)/recipe/${id}`) as never)}
    >
      <View>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
        <RecipeActions
          id={id}
          isMyRecipe={isMyRecipe}
          isFavorited={isFavorited}
          isWantToTry={isWantToTry}
          onFavorite={onFavorite}
          onWantToTry={onWantToTry}
        />
      </View>
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e4d9c5' },
  image: { width: '100%', height: 120 },
  imagePlaceholder: { width: '100%', height: 120, backgroundColor: '#ffeecf' },
  title: { padding: 8, paddingBottom: 4, fontWeight: '700', color: '#1f2421', fontSize: 13 },
});
