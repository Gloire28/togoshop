import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PromotionScreen from '../src/screens/PromotionScreen';
import ProductDetailScreen from '../src/screens/ProductDetailScreen';

const Stack = createStackNavigator();

export default function PromotionsStack() {
  return (
    <Stack.Navigator>
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