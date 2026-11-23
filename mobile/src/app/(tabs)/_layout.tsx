import { Tabs } from 'expo-router';
import { ChartColumn, ListChecks, UserRound } from 'lucide-react-native';
import { color, font, icon } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.line },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: color.canvas },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: ({ color: tint }) => <ListChecks size={icon.navigation} color={tint} /> }}
      />
      <Tabs.Screen
        name="report"
        options={{ title: 'Report', tabBarIcon: ({ color: tint }) => <ChartColumn size={icon.navigation} color={tint} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color: tint }) => <UserRound size={icon.navigation} color={tint} /> }}
      />
    </Tabs>
  );
}
