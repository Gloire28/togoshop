import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TrackingScreen from '../src/screens/TrackingScreen';

const Stack = createStackNavigator();

export default function TrackingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TrackingScreen" component={TrackingScreen} />
    </Stack.Navigator>
  );
}
