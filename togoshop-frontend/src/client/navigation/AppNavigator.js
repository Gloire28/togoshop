import React, { useContext } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { AppContext } from '../../shared/context/AppContext';
import MainTabs from './MainTabs';
import PaymentScreen from '../screens/PaymentScreen';
import ProfileStack from './ProfileStack';
import TrackingStack from './TrackingStack';
import LoginStack from './LoginStack';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { user } = useContext(AppContext);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
          <Stack.Screen name="ProfileStack" component={ProfileStack} />
          <Stack.Screen name="TrackingStack" component={TrackingStack} />
        </>
      ) : (
        <Stack.Screen name="LoginStack" component={LoginStack} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});