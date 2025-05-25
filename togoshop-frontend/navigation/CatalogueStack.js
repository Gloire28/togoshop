import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CatalogueScreen from '../src/screens/CatalogueScreen';
import ProductDetailScreen from '../src/screens/ProductDetailScreen';
import CartScreen from '../src/screens/CartScreen';
import PaymentScreen from '../src/screens/PaymentScreen';
import TrackingScreen from '../src/screens/TrackingScreen';

const Stack = createStackNavigator();

export default function CatalogueStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CatalogueMain"
        component={CatalogueScreen}
        options={{ title: 'Catalogue' }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'Détails du Produit' }}
      />
      <Stack.Screen
        name="Cart"
        component={CartScreen}
        options={{ title: 'Panier' }}
      />
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