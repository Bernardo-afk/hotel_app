import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import Home from '../screens/home/Home';
import SearchApts from '../screens/search/SearchApts';
import History from '../screens/history/History';
import Profile from '../screens/profile/Profile';

const Tab = createBottomTabNavigator();

const TabIcon = ({ icon, color }: { icon: string; color: string }) => (
  <Text style={{ fontSize: 22, color }}>{icon}</Text>
);

export default function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#0D7377',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: false,
        tabBarStyle: { paddingBottom: 4, height: 60 },
      }}
    >
      <Tab.Screen
        name="Casa"
        component={Home}
        options={{ tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} /> }}
      />
      <Tab.Screen
        name="Buscar"
        component={SearchApts}
        options={{ tabBarIcon: ({ color }) => <TabIcon icon="🔍" color={color} /> }}
      />
      <Tab.Screen
        name="Histórico"
        component={History}
        options={{ tabBarIcon: ({ color }) => <TabIcon icon="📋" color={color} /> }}
      />
      <Tab.Screen
        name="Eu"
        component={Profile}
        options={{ tabBarIcon: ({ color }) => <TabIcon icon="👤" color={color} /> }}
      />
    </Tab.Navigator>
  );
}
