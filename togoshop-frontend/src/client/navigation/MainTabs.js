import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeStack from './HomeStack';
import CatalogueStack from './CatalogueStack';
import CartStack from './CartStack';
import ProfileStack from './ProfileStack';
import PromotionsStack from './PromotionsStack';
import LoyaltyStack from './LoyaltyStack';
import TrackingStack from './TrackingStack';

const Tab = createBottomTabNavigator();

export default function MainTabs({ route }) {
  const { initialRouteName = 'Home' } = route.params || {};

  return (
    <Tab.Navigator
      initialRouteName={initialRouteName}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Catalogue: focused ? 'list' : 'list-outline',
            Cart: focused ? 'cart' : 'cart-outline',
            Profile: focused ? 'person' : 'person-outline',
            Promotions: focused ? 'pricetag' : 'pricetag-outline',
            Loyalty: focused ? 'star' : 'star-outline',
            Tracking: focused ? 'navigate' : 'navigate-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007bff',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Catalogue" component={CatalogueStack} />
      <Tab.Screen name="Cart" component={CartStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
      <Tab.Screen name="Promotions" component={PromotionsStack} />
      <Tab.Screen name="Loyalty" component={LoyaltyStack} />
      <Tab.Screen name="Tracking" component={TrackingStack} />
    </Tab.Navigator>
  );
}