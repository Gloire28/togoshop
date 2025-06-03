import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoyaltyScreen from '../screens/LoyaltyScreen';

const Stack = createStackNavigator();

export default function LoyaltyStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="LoyaltyMain"
        component={LoyaltyScreen}
        options={{ title: 'Fidélité' }}
      />
    </Stack.Navigator>
  );
}