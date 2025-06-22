import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import DriverRegisterScreen from '../screens/DriverRegisterScreen';
import DriverLoginScreen from '../screens/DriverLoginScreen';
import DriverDashboardScreen from '../screens/DriverDashboardScreen';
import DriverOrderScreen from '../screens/DriverOrderScreen';
import DriverEarningScreen from '../screens/DriverEarningScreen';
import DriverValidationScreen from '../screens/DriverValidationScreen';

const Stack = createStackNavigator();

export default function DriverNavigator() {
  return (
    <Stack.Navigator initialRouteName="DriverLogin">
      <Stack.Screen
        name="DriverRegister"
        component={DriverRegisterScreen}
        options={{ title: 'Inscription Livreur' }}
      />
      <Stack.Screen
        name="DriverLogin"
        component={DriverLoginScreen}
        options={{ title: 'Connexion Livreur' }}
      />
      <Stack.Screen
        name="DriverDashboard"
        component={DriverDashboardScreen}
        options={{ title: 'Tableau de Bord' }}
      />
      <Stack.Screen
        name="DriverOrders"
        component={DriverOrderScreen}
        options={{ title: 'Mes Commandes' }}
      />
      <Stack.Screen
        name="DriverEarnings"
        component={DriverEarningScreen}
        options={{ title: 'Mes Gains' }}
      />
      <Stack.Screen
        name="DriverValidation"
        component={DriverValidationScreen}
        options={{ title: 'Valider la Livraison' }}
      />
    </Stack.Navigator>
  );
}