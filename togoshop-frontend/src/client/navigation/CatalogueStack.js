// src/client/navigation/CatalogueStack.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SupermarketScreen from '../screens/SupermarketScreen';
import SitesScreen from '../screens/SitesScreen';
import CatalogueScreen from '../screens/CatalogueScreen';

const Stack = createStackNavigator();

export default function CatalogueStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Supermarket" component={SupermarketScreen} />
      <Stack.Screen name="Sites" component={SitesScreen} />
      <Stack.Screen name="Catalogue" component={CatalogueScreen} />
    </Stack.Navigator>
  );
}