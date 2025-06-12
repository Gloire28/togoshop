import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TrackingScreen from '../screens/TrackingScreen';

const Stack = createStackNavigator();

export default function TrackingStack({ route, navigation }) {
  console.log('TrackingStack monté avec params:', route?.params); // Log pour débogage
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="Tracking"
        component={TrackingScreen}
        initialParams={route?.params} // Transmet les params initiaux
      />
    </Stack.Navigator>
  );
}