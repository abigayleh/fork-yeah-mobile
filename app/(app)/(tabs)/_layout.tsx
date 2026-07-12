import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'browse-recipes': 'search',
  'saved-recipes': 'bookmark',
  'add-recipe': 'add-circle',
  'meal-planner': 'calendar',
  'grocery-lists': 'cart',
  'family': 'people',
};

export default function TabsLayout() {
  const { promptLogin } = useAuth();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name] ?? 'ellipse'} size={size} color={color} />
        ),
        tabBarActiveTintColor: '#0f766e',
        tabBarInactiveTintColor: '#9ca3af',
      })}
      screenListeners={({ route }) => ({
        tabPress: (e) => {
          if (!auth.currentUser && route.name !== 'browse-recipes') {
            e.preventDefault();
            promptLogin();
          }
        },
      })}
    >
      <Tabs.Screen name="browse-recipes" options={{ title: 'Browse' }} />
      <Tabs.Screen name="saved-recipes" options={{ title: 'Recipes' }} />
      <Tabs.Screen name="add-recipe" options={{ title: 'Add' }} />
      <Tabs.Screen name="meal-planner" options={{ title: 'Meal Plan' }} />
      <Tabs.Screen name="grocery-lists" options={{ title: 'Groceries' }} />
      <Tabs.Screen name="family" options={{ title: 'Family' }} />
    </Tabs>
  );
}
