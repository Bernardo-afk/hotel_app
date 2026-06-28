import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/authStore';
import Login from '../screens/auth/Login';
import Register from '../screens/auth/Register';
import BottomTabs from './BottomTabs';
import AptDetail from '../screens/home/AptDetail';
import TransportRegister from '../screens/home/TransportRegister';
import DoorWarning from '../screens/cleaning/DoorWarning';
import InProgress from '../screens/cleaning/InProgress';
import ReportIncident from '../screens/cleaning/ReportIncident';
import Complete from '../screens/cleaning/Complete';
import WellDone from '../screens/cleaning/WellDone';
import GuestPresent from '../screens/guest/GuestPresent';
import RelocationAlert from '../screens/standby/RelocationAlert';
import HomeAfterRelocation from '../screens/standby/HomeAfterRelocation';
import HistoryDetail from '../screens/history/HistoryDetail';
import Availability from '../screens/profile/Availability';

const Stack = createStackNavigator();

export default function RootNavigator() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!accessToken ? (
          <>
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Register" component={Register} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={BottomTabs} />
            <Stack.Screen name="AptDetail" component={AptDetail} />
            <Stack.Screen name="TransportRegister" component={TransportRegister} />
            <Stack.Screen name="DoorWarning" component={DoorWarning} />
            <Stack.Screen name="InProgress" component={InProgress} />
            <Stack.Screen name="ReportIncident" component={ReportIncident} />
            <Stack.Screen name="Complete" component={Complete} />
            <Stack.Screen name="WellDone" component={WellDone} />
            <Stack.Screen name="GuestPresent" component={GuestPresent} />
            <Stack.Screen name="RelocationAlert" component={RelocationAlert} />
            <Stack.Screen name="HomeAfterRelocation" component={HomeAfterRelocation} />
            <Stack.Screen name="HistoryDetail" component={HistoryDetail} />
            <Stack.Screen name="Availability" component={Availability} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
