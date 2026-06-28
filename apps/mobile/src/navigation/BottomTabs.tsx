import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../screens/home/Home';
import SearchApts from '../screens/search/SearchApts';
import History from '../screens/history/History';
import Profile from '../screens/profile/Profile';

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Casa" component={Home} />
      <Tab.Screen name="Buscar" component={SearchApts} />
      <Tab.Screen name="Histórico" component={History} />
      <Tab.Screen name="Eu" component={Profile} />
    </Tab.Navigator>
  );
}
