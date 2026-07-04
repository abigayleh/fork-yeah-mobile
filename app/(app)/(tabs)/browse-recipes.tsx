import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import RecipeCard from '../../../components/RecipeCard';
import { useBrowseRecipes } from '../../../hooks/useBrowseRecipes';
import { useAuth } from '../../../contexts/AuthContext';

const CUISINES = ['African', 'American', 'British', 'Chinese', 'French', 'Greek', 'Indian', 'Italian', 'Japanese', 'Korean', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Thai', 'Vietnamese'];
const DIETS = ['Gluten Free', 'Ketogenic', 'Vegetarian', 'Vegan', 'Pescetarian', 'Paleo', 'Whole30'];
const MEAL_TYPES = ['Main Course', 'Side Dish', 'Dessert', 'Appetizer', 'Breakfast', 'Soup', 'Snack', 'Drink'];

function ToggleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RangeInput({ label, value, onChange, unit }: { label: string; value: [number, number]; onChange: (v: [number, number]) => void; unit?: string }) {
  return (
    <View style={styles.rangeRow}>
      <Text style={styles.rangeLabel}>{label}{unit ? ` (${unit})` : ''}</Text>
      <View style={styles.rangeInputs}>
        <TextInput
          style={styles.rangeInput}
          value={String(value[0])}
          onChangeText={(t) => onChange([Number(t) || 0, value[1]])}
          keyboardType="numeric"
          placeholder="min"
        />
        <Text style={styles.rangeDash}>–</Text>
        <TextInput
          style={styles.rangeInput}
          value={String(value[1])}
          onChangeText={(t) => onChange([value[0], Number(t) || 0])}
          keyboardType="numeric"
          placeholder="max"
        />
      </View>
    </View>
  );
}

export default function BrowseRecipesScreen() {
  const {
    recipeList, loading, isFetchingMore, filterModalOpen,
    searchInput, setFilterModalOpen, setSearchInput,
    handleRefreshRecipes, loadMore, filterProps,
  } = useBrowseRecipes();

  const { addRecipeToUser, getUserRecipes } = useAuth();
  const [savedStatus, setSavedStatus] = useState<Record<string, { favorite: boolean; wantToTry: boolean }>>({});

  useEffect(() => {
    getUserRecipes().then((data) => {
      const status: Record<string, { favorite: boolean; wantToTry: boolean }> = {};
      (data ?? []).forEach((r: Record<string, unknown>) => {
        status[String(r.recipeId)] = { favorite: Boolean(r.favorite), wantToTry: Boolean(r.wantToTry) };
      });
      setSavedStatus(status);
    }).catch(() => {});
  }, []);

  const toggleFavorite = async (recipeId: string) => {
    setSavedStatus((prev) => ({
      ...prev,
      [recipeId]: { ...prev[recipeId], favorite: !prev[recipeId]?.favorite },
    }));
    await addRecipeToUser(recipeId, 'favorite', null);
  };

  const toggleWantToTry = async (recipeId: string) => {
    setSavedStatus((prev) => ({
      ...prev,
      [recipeId]: { ...prev[recipeId], wantToTry: !prev[recipeId]?.wantToTry },
    }));
    await addRecipeToUser(recipeId, 'wantToTry', null);
  };

  const [pendingCuisines, setPendingCuisines] = useState<string[]>(filterProps.cuisines);
  const [pendingDiets, setPendingDiets] = useState<string[]>(filterProps.diets);
  const [pendingMealTypes, setPendingMealTypes] = useState<string[]>(filterProps.mealTypes);
  const [pendingProtein, setPendingProtein] = useState<[number, number]>(filterProps.protein);
  const [pendingCarbs, setPendingCarbs] = useState<[number, number]>(filterProps.carbs);
  const [pendingFat, setPendingFat] = useState<[number, number]>(filterProps.fat);
  const [pendingCookingTime, setPendingCookingTime] = useState<[number, number]>(filterProps.cookingTime);

  const openFilter = () => {
    setPendingCuisines(filterProps.cuisines);
    setPendingDiets(filterProps.diets);
    setPendingMealTypes(filterProps.mealTypes);
    setPendingProtein(filterProps.protein);
    setPendingCarbs(filterProps.carbs);
    setPendingFat(filterProps.fat);
    setPendingCookingTime(filterProps.cookingTime);
    setFilterModalOpen(true);
  };

  const applyFilters = () => {
    filterProps.setCuisines(pendingCuisines);
    filterProps.setDiets(pendingDiets);
    filterProps.setMealTypes(pendingMealTypes);
    filterProps.setProtein(pendingProtein);
    filterProps.setCarbs(pendingCarbs);
    filterProps.setFat(pendingFat);
    filterProps.setCookingTime(pendingCookingTime);
    setFilterModalOpen(false);
  };

  const resetFilters = () => {
    setPendingCuisines([]);
    setPendingDiets([]);
    setPendingMealTypes([]);
    setPendingProtein([0, 150]);
    setPendingCarbs([0, 200]);
    setPendingFat([0, 80]);
    setPendingCookingTime([0, 180]);
  };

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const hasFilters = filterProps.cuisines.length > 0 || filterProps.diets.length > 0 ||
    filterProps.mealTypes.length > 0;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.heading}>Browse Recipes</Text>
        <TouchableOpacity onPress={handleRefreshRecipes}>
          <Text style={styles.refreshBtn}>↺ Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by recipe or ingredient..."
          value={searchInput}
          onChangeText={setSearchInput}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <TouchableOpacity style={[styles.filterBtn, hasFilters && styles.filterBtnActive]} onPress={openFilter}>
          <Text style={[styles.filterBtnText, hasFilters && styles.filterBtnTextActive]}>Filter{hasFilters ? ' ●' : ''}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0f766e" />
      ) : (
        <FlatList
          data={recipeList}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <RecipeCard
              id={String(item.id)}
              title={item.title}
              image={item.image}
              isMyRecipe={false}
              isFavorited={savedStatus[String(item.id)]?.favorite}
              isWantToTry={savedStatus[String(item.id)]?.wantToTry}
              onFavorite={() => toggleFavorite(String(item.id))}
              onWantToTry={() => toggleWantToTry(String(item.id))}
            />
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No recipes found. Try different filters.</Text>}
          ListFooterComponent={isFetchingMore ? <ActivityIndicator color="#0f766e" style={styles.footerLoader} /> : null}
        />
      )}

      <Modal visible={filterModalOpen} animationType="slide" onRequestClose={() => setFilterModalOpen(false)}>
        <View style={styles.modalPage}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setFilterModalOpen(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={resetFilters}>
              <Text style={styles.resetBtn}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.filterSection}>Cuisine</Text>
            <View style={styles.chips}>
              {CUISINES.map((c) => (
                <ToggleChip key={c} label={c} active={pendingCuisines.includes(c)} onPress={() => toggle(pendingCuisines, setPendingCuisines, c)} />
              ))}
            </View>

            <Text style={styles.filterSection}>Diet</Text>
            <View style={styles.chips}>
              {DIETS.map((d) => (
                <ToggleChip key={d} label={d} active={pendingDiets.includes(d)} onPress={() => toggle(pendingDiets, setPendingDiets, d)} />
              ))}
            </View>

            <Text style={styles.filterSection}>Meal Type</Text>
            <View style={styles.chips}>
              {MEAL_TYPES.map((m) => (
                <ToggleChip key={m} label={m} active={pendingMealTypes.includes(m)} onPress={() => toggle(pendingMealTypes, setPendingMealTypes, m)} />
              ))}
            </View>

            <Text style={styles.filterSection}>Nutrition</Text>
            <RangeInput label="Protein" value={pendingProtein} onChange={setPendingProtein} unit="g" />
            <RangeInput label="Carbs" value={pendingCarbs} onChange={setPendingCarbs} unit="g" />
            <RangeInput label="Fat" value={pendingFat} onChange={setPendingFat} unit="g" />
            <RangeInput label="Max cooking time" value={pendingCookingTime} onChange={setPendingCookingTime} unit="min" />
          </ScrollView>

          <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
            <Text style={styles.applyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fffaf0' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  heading: { fontSize: 26, fontWeight: '800', color: '#115e59' },
  refreshBtn: { color: '#0f766e', fontWeight: '700' },
  searchRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  filterBtn: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: '#fff' },
  filterBtnActive: { borderColor: '#0f766e', backgroundColor: '#ecfdf5' },
  filterBtnText: { fontWeight: '700', color: '#5e6a63' },
  filterBtnTextActive: { color: '#0f766e' },
  loader: { marginTop: 60 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  row: { gap: 12, marginBottom: 12 },
  emptyText: { textAlign: 'center', color: '#5e6a63', marginTop: 40 },
  footerLoader: { marginVertical: 16 },
  // filter modal
  modalPage: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: '#e4d9c5' },
  modalClose: { fontSize: 20, color: '#5e6a63', paddingHorizontal: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#115e59' },
  resetBtn: { color: '#9f1239', fontWeight: '700' },
  modalContent: { padding: 16, paddingBottom: 20 },
  filterSection: { fontSize: 16, fontWeight: '700', color: '#115e59', marginTop: 16, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  chipActive: { borderColor: '#0f766e', backgroundColor: '#ecfdf5' },
  chipText: { color: '#5e6a63', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#0f766e' },
  rangeRow: { marginBottom: 12 },
  rangeLabel: { fontWeight: '600', color: '#1f2421', marginBottom: 6 },
  rangeInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeInput: { flex: 1, borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 8, padding: 8, backgroundColor: '#fff', textAlign: 'center' },
  rangeDash: { color: '#5e6a63' },
  applyBtn: { backgroundColor: '#0f766e', margin: 16, borderRadius: 12, padding: 14, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
