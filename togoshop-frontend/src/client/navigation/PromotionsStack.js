import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PromotionScreen from '../screens/PromotionScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';

const Stack = createStackNavigator();

export default function PromotionsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="PromotionsMain"
        component={PromotionScreen}
        options={{ title: 'Promotions' }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'Détails du Produit' }}
      />
    </Stack.Navigator>
  );
}