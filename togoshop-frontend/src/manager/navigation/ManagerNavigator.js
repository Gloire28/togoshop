import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import OrderScreen from '../screens/OrderScreen';
import ProductScreen from '../screens/ProductScreen';
import StockScreen from '../screens/StockScreen';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';

const Stack = createStackNavigator();

export default function ManagerNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Orders" component={OrderScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Products" component={ProductScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Stock" component={StockScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} options={{ title: 'Historique des Commandes', headerShown: false }} />
    </Stack.Navigator>
  );
}