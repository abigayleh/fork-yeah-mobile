import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text,
  TextInput, TouchableOpacity, View, ScrollView, Image,
} from 'react-native';
import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { auth, db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSavedRecipesBrowser, SavedRecipe, SavedRecipeSection, FolderItem } from '../../../hooks/useSavedRecipesBrowser';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const;
const API_KEY = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY ?? '';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const toDateKey = (d: Date) => d.toISOString().slice(0, 10);
const toDisplayLabel = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }).format(d);
const toFirestoreType = (label: string) => (label.toLowerCase() === 'snacks' ? 'snack' : label.toLowerCase());

const ordinal = (day: number) => {
  if (day % 10 === 1 && day !== 11) return `${day}st`;
  if (day % 10 === 2 && day !== 12) return `${day}nd`;
  if (day % 10 === 3 && day !== 13) return `${day}rd`;
  return `${day}th`;
};
const toLongDisplayLabel = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(year, month - 1, day));
  return `${monthName} ${ordinal(day)}, ${year}`;
};

type MealEntry = { id: string; recipeId: string; title: string; image: string; isMyRecipe: boolean };

export default function MealPlannerScreen() {
  const { getMyRecipes } = useAuth();

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekDates = getWeekDates(weekStart);

  const [mealPlans, setMealPlans] = useState<Record<string, MealEntry>>({});
  const [loading, setLoading] = useState(true);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCell, setPickerCell] = useState<{ date: string; type: string } | null>(null);
  const browser = useSavedRecipesBrowser();

  const [pendingRecipe, setPendingRecipe] = useState<SavedRecipe | null>(null);
  const [servings, setServings] = useState('2');
  const [saving, setSaving] = useState(false);

  const loadMealPlans = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'mealPlans'), where('userId', '==', user.uid)));
      const rawEntries = snap.docs.map((d) => ({ id: d.id, data: d.data() }));

      const myIds = Array.from(new Set(
        rawEntries
          .filter(({ data }) => Boolean(data.isMyRecipe))
          .map(({ data }) => String(data.recipeId || ''))
          .filter(Boolean)
      ));
      const spoonIds = Array.from(new Set(
        rawEntries
          .filter(({ data }) => !Boolean(data.isMyRecipe))
          .map(({ data }) => String(data.recipeId || ''))
          .filter(Boolean)
      ));

      const myMap = new Map<string, { title: string; image: string }>();
      if (myIds.length) {
        const mine = await getMyRecipes();
        ((mine ?? []) as { recipeId?: string; id?: string; name?: string; imageUrl?: string }[])
          .forEach((r) => {
            const id = String(r.recipeId ?? r.id ?? '');
            if (id) myMap.set(id, { title: String(r.name ?? ''), image: String(r.imageUrl ?? '') });
          });
      }

      const spoonMap = new Map<string, { title: string; image: string }>();
      if (spoonIds.length > 0 && API_KEY) {
        try {
          const res = await fetch(`https://api.spoonacular.com/recipes/informationBulk?ids=${spoonIds.join(',')}&apiKey=${API_KEY}`);
          if (res.ok) {
            const data = await res.json() as { id: number; title: string; image: string }[];
            data.forEach((r) => spoonMap.set(String(r.id), { title: r.title, image: r.image }));
          }
        } catch { /* ignore */ }
      }

      const entries: Record<string, MealEntry> = {};
      rawEntries.forEach(({ id, data }) => {
        const key = `${data.date}:${String(data.type).toLowerCase()}`;
        const recipeId = String(data.recipeId || '');
        const resolved = Boolean(data.isMyRecipe) ? myMap.get(recipeId) : spoonMap.get(recipeId);
        entries[key] = {
          id,
          recipeId,
          title: String(data.title || resolved?.title || recipeId),
          image: String(data.image || resolved?.image || ''),
          isMyRecipe: Boolean(data.isMyRecipe),
        };
      });
      setMealPlans(entries);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMealPlans(); }, [loadMealPlans]);

  const openPicker = (dateKey: string, type: string) => {
    setPickerCell({ date: dateKey, type });
    setPendingRecipe(null);
    browser.setSection('myRecipes');
    browser.setSearch('');
    setPickerOpen(true);
    browser.reload();
  };

  const closePicker = () => {
    setPickerOpen(false);
    setPendingRecipe(null);
  };

  const selectRecipe = (recipe: SavedRecipe) => {
    setPendingRecipe(recipe);
    setServings('2');
  };

  const confirmRecipe = async () => {
    const user = auth.currentUser;
    if (!user || !pickerCell || !pendingRecipe) return;
    setSaving(true);
    const fsType = toFirestoreType(pickerCell.type);
    try {
      const docRef = await addDoc(collection(db, 'mealPlans'), {
        userId: user.uid,
        recipeId: pendingRecipe.id,
        title: pendingRecipe.title,
        image: pendingRecipe.image,
        isMyRecipe: pendingRecipe.isMyRecipe,
        servings: Math.max(1, parseInt(servings, 10) || 2),
        date: pickerCell.date,
        type: fsType,
      });
      setMealPlans((prev) => ({
        ...prev,
        [`${pickerCell.date}:${fsType}`]: {
          id: docRef.id,
          recipeId: pendingRecipe.id,
          title: pendingRecipe.title,
          image: pendingRecipe.image,
          isMyRecipe: pendingRecipe.isMyRecipe,
        },
      }));
      closePicker();
    } catch {
      Alert.alert('Error', 'Could not save meal plan.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMeal = (key: string, mealId: string) => {
    Alert.alert('Remove Meal', 'Remove this meal from your plan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, 'mealPlans', mealId));
            setMealPlans((prev) => { const next = { ...prev }; delete next[key]; return next; });
          } catch {
            Alert.alert('Error', 'Could not remove meal.');
          }
        },
      },
    ]);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#0f766e" />;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.heading}>Meal Planner</Text>
      </View>

      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekStart((p) => { const d = new Date(p); d.setDate(d.getDate() - 7); return d; })} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{toDisplayLabel(weekDates[0])} – {toDisplayLabel(weekDates[6])}</Text>
        <TouchableOpacity onPress={() => setWeekStart((p) => { const d = new Date(p); d.setDate(d.getDate() + 7); return d; })} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {weekDates.map((date) => {
          const dateKey = toDateKey(date);
          const isPast = date < today;
          return (
            <View key={dateKey} style={[styles.dayCard, isPast && styles.dayCardPast]}>
              <Text style={[styles.dayLabel, isPast && styles.dim]}>{toDisplayLabel(date)}</Text>
              {MEAL_TYPES.map((mealType) => {
                const fsType = toFirestoreType(mealType);
                const key = `${dateKey}:${fsType}`;
                const meal = mealPlans[key];
                return (
                  <View key={mealType} style={styles.mealRow}>
                    <Text style={[styles.mealTypeText, isPast && styles.dim]}>{mealType}</Text>
                    {meal ? (
                      <View style={styles.mealFilled}>
                        {meal.image ? (
                          <Image source={{ uri: meal.image }} style={styles.mealImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.mealImagePlaceholder} />
                        )}
                        {!isPast && (
                          <TouchableOpacity onPress={() => deleteMeal(key, meal.id)}>
                            <Text style={styles.removeBtnText}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.addBtn, isPast && styles.addBtnDisabled]}
                        onPress={() => !isPast && openPicker(dateKey, mealType)}
                        disabled={isPast}
                      >
                        <Text style={[styles.addBtnText, isPast && styles.dim]}>+ Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={closePicker}>
        <View style={styles.modalPage}>
          {pendingRecipe ? (
            <>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setPendingRecipe(null)}>
                  <Text style={styles.modalClose}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>How many servings?</Text>
                <View style={{ width: 32 }} />
              </View>
              <View style={styles.servingsBody}>
                {pendingRecipe.image ? (
                  <Image source={{ uri: pendingRecipe.image }} style={styles.servingsImage} resizeMode="cover" />
                ) : (
                  <View style={styles.servingsImagePlaceholder} />
                )}
                <Text style={styles.servingsSubtitle}>{pendingRecipe.title}</Text>
                <TextInput
                  style={styles.servingsInput}
                  value={servings}
                  onChangeText={setServings}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
                <TouchableOpacity style={[styles.confirmBtn, saving && { opacity: 0.7 }]} onPress={confirmRecipe} disabled={saving}>
                  <Text style={styles.confirmBtnText}>{saving ? 'Saving...' : 'Add to Plan'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closePicker}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{pickerCell ? `${pickerCell.type} · ${toLongDisplayLabel(pickerCell.date)}` : 'Select Recipe'}</Text>
                <View style={{ width: 32 }} />
              </View>

              <View style={styles.pickerTabs}>
                {(['myRecipes', 'favorites', 'wantToTry'] as SavedRecipeSection[]).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.pickerTab, browser.section === tab && !browser.activeFolderId && styles.pickerTabActive]}
                    onPress={() => browser.setSection(tab)}
                  >
                    <Text style={[styles.pickerTabText, browser.section === tab && styles.pickerTabTextActive]}>
                      {tab === 'myRecipes' ? 'My Recipes' : tab === 'favorites' ? 'Favorites' : 'Want to Try'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Search by recipe or ingredient..."
                value={browser.search}
                onChangeText={browser.setSearch}
                clearButtonMode="while-editing"
              />

              {browser.folders.length > 0 && (
                <DraggableFlatList
                  data={browser.folders}
                  keyExtractor={(item, i) => item.id ?? String(i)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.folderScroll}
                  onDragEnd={() => {}}
                  renderItem={({ item }: RenderItemParams<FolderItem>) => {
                    const selected = browser.activeFolderId === item.id;
                    return (
                      <TouchableOpacity
                        style={[styles.chip, selected && styles.chipActive]}
                        onPress={() => browser.selectFolder(item)}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item.name}</Text>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}

              {browser.loading || browser.loadingFolder ? (
                <ActivityIndicator style={styles.loader} size="large" color="#0f766e" />
              ) : (
                <FlatList
                  data={browser.displayRecipes}
                  keyExtractor={(item) => `${item.isMyRecipe ? 'my_' : ''}${item.id}`}
                  numColumns={2}
                  columnWrapperStyle={styles.pickerCardRow}
                  contentContainerStyle={styles.pickerList}
                  ListHeaderComponent={browser.selectedFolder ? <Text style={styles.folderTitle}>{browser.selectedFolder.name}</Text> : null}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.pickerItemCard} onPress={() => selectRecipe(item)}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.pickerItemImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.pickerItemImagePlaceholder} />
                      )}
                      <Text style={styles.pickerItemText} numberOfLines={2}>{item.title}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={styles.emptyText}>No recipes found.</Text>}
                />
              )}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fffaf0' },
  loader: { flex: 1, marginTop: 60 },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  heading: { fontSize: 26, fontWeight: '800', color: '#115e59' },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e4d9c5' },
  navBtn: { padding: 10 },
  navArrow: { fontSize: 26, color: '#0f766e', fontWeight: '700' },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#115e59' },
  scroll: { padding: 16, paddingBottom: 40 },
  dayCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e4d9c5' },
  dayCardPast: { opacity: 0.55 },
  dayLabel: { fontWeight: '800', color: '#115e59', fontSize: 15, marginBottom: 10 },
  dim: { color: '#bbb' },
  mealRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mealTypeText: { width: 78, fontWeight: '600', color: '#5e6a63', fontSize: 13 },
  mealFilled: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ecfdf5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  mealImage: { width: 54, height: 40, borderRadius: 6 },
  mealImagePlaceholder: { width: 54, height: 40, borderRadius: 6, backgroundColor: '#d1fae5' },
  removeBtnText: { color: '#9f1239', fontWeight: '700', fontSize: 14, paddingLeft: 8 },
  addBtn: { flex: 1, borderWidth: 1, borderColor: '#e4d9c5', borderStyle: 'dashed', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  addBtnDisabled: { borderColor: '#e8e8e8' },
  addBtnText: { color: '#0f766e', fontWeight: '600', fontSize: 13 },
  // picker modal
  modalPage: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e4d9c5' },
  modalClose: { fontSize: 20, color: '#5e6a63', padding: 4 },
  modalTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#115e59', marginHorizontal: 8 },
  pickerTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e4d9c5' },
  pickerTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  pickerTabActive: { borderBottomWidth: 2, borderBottomColor: '#0f766e' },
  pickerTabText: { fontWeight: '600', color: '#5e6a63', fontSize: 13 },
  pickerTabTextActive: { color: '#0f766e' },
  pickerSearchInput: { margin: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  folderScroll: { paddingLeft: 16, paddingRight: 16, gap: 8, paddingBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e4d9c5', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  chipText: { fontWeight: '700', color: '#5e6a63', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  pickerList: { paddingHorizontal: 16, paddingBottom: 40 },
  pickerCardRow: { gap: 12, marginBottom: 12 },
  folderTitle: { fontSize: 15, fontWeight: '700', color: '#115e59', marginBottom: 12 },
  pickerItemCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e4d9c5' },
  pickerItemImage: { width: '100%', height: 110 },
  pickerItemImagePlaceholder: { width: '100%', height: 110, backgroundColor: '#ffeecf' },
  pickerItemText: { fontSize: 13, color: '#1f2421', fontWeight: '700', padding: 8, minHeight: 48 },
  emptyText: { textAlign: 'center', color: '#5e6a63', marginTop: 40 },
  // servings step (inline within the picker modal)
  servingsBody: { flex: 1, padding: 24, alignItems: 'center' },
  servingsImage: { width: 160, height: 160, borderRadius: 16, marginBottom: 16 },
  servingsImagePlaceholder: { width: 160, height: 160, borderRadius: 16, marginBottom: 16, backgroundColor: '#ffeecf' },
  servingsSubtitle: { color: '#115e59', marginBottom: 20, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  servingsInput: { borderWidth: 1, borderColor: '#e4d9c5', borderRadius: 10, padding: 12, fontSize: 18, textAlign: 'center', marginBottom: 14, width: 120 },
  confirmBtn: { backgroundColor: '#0f766e', borderRadius: 12, padding: 14, alignItems: 'center', width: '100%' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
