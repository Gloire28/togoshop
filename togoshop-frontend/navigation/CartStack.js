import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CartScreen from '../src/screens/CartScreen';
import PaymentScreen from '../src/screens/PaymentScreen';
import TrackingScreen from '../src/screens/TrackingScreen';
import DeliveryAddressScreen from '../src/screens/DeliveryAddressScreen';

const Stack = createStackNavigator();

export default function CartStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="CartMain"
        component={CartScreen}
        options={{ title: 'Panier' }}
      />
      <Stack.Screen name="DeliveryAddressScreen" component={DeliveryAddressScreen} />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ title: 'Paiement' }}
      />
      <Stack.Screen
        name="Tracking"
        component={TrackingScreen}
        options={{ title: 'Suivi Livraison' }}
      />
    </Stack.Navigator>
  );
}