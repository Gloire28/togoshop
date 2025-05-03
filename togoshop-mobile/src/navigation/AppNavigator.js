import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/Auth/LoginScreen';
import CatalogScreen from '../screens/Customer/CatalogScreen';
import CartScreen from '../screens/Customer/CartScreen';
import PaymentScreen from '../screens/Customer/PaymentScreen';
import TrackingScreen from '../screens/Customer/TrackingScreen';
import ProfileScreen from '../screens/Customer/ProfileScreen';
import OrdersScreen from '../screens/Driver/OrdersScreen';
import OrderDetailsScreen from '../screens/Driver/OrderDetailsScreen';
import EarningsScreen from '../screens/Driver/EarningsScreen';

const Stack = createStackNavigator();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Catalog" component={CatalogScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="Tracking" component={TrackingScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
      <Stack.Screen name="Earnings" component={EarningsScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;