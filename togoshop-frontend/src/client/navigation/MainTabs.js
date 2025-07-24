import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeStack from './HomeStack';
import SupermarketScreen from '../screens/SupermarketScreen';
import CartStack from './CartStack';
import ProfileStack from './ProfileStack';
import PromotionsStack from './PromotionsStack';
import LoyaltyStack from './LoyaltyStack';
import CatalogueStack from './CatalogueStack';

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
            Profil: focused ? 'person' : 'person-outline',
            Promo: focused ? 'pricetag' : 'pricetag-outline',
            Loyalty: focused ? 'star' : 'star-outline',
          };
          const iconName = icons[route.name];
          return iconName ? <Ionicons name={iconName} size={size} color={color} /> : null;
        },
        tabBarActiveTintColor: '#007bff',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Catalogue" component={CatalogueStack} />
      <Tab.Screen name="Cart" component={CartStack} />
      <Tab.Screen name="Profil" component={ProfileStack} />
      <Tab.Screen name="Promo" component={PromotionsStack} />
      <Tab.Screen name="Loyalty" component={LoyaltyStack} />
    </Tab.Navigator>
  );
}