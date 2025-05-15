import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useFonts } from "expo-font";
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
  Roboto_300Light,
} from "@expo-google-fonts/roboto";
import LoginScreen from "./src/screens/Auth/LoginScreen";
import RegisterScreen from "./src/screens/Auth/RegisterScreen";
import CatalogScreen from "./src/screens/Customer/CatalogScreen";
import CartScreen from "./src/screens/Customer/CartScreen";
import PaymentScreen from "./src/screens/Customer/PaymentScreen";
import TrackingScreen from "./src/screens/Customer/TrackingScreen";
import PromotionsScreen from "./src/screens/Customer/PromotionsScreen";
import ProfileScreen from "./src/screens/Customer/ProfileScreen";
import LoyaltyScreen from "./src/screens/Customer/LoyaltyScreen";
import ProductDetailScreen from "./src/screens/Customer/ProductDetailsScreen";
import AdminPromotionsScreen from "./src/screens/Customer/AdminPromotionsScreen";
import LocationSelectionScreen from "./src/screens/Customer/LocationSelectionScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    "Roboto-Regular": Roboto_400Regular,
    "Roboto-Medium": Roboto_500Medium,
    "Roboto-Bold": Roboto_700Bold,
    "Roboto-Light": Roboto_300Light,
  });

  if (!fontsLoaded) {
    return null; // Affiche rien tant que les polices ne sont pas chargées
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Catalog" component={CatalogScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="Payment" component={PaymentScreen} />
        <Stack.Screen name="Tracking" component={TrackingScreen} />
        <Stack.Screen name="Promotions" component={PromotionsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Loyalty" component={LoyaltyScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen
          name="AdminPromotions"
          component={AdminPromotionsScreen}
        />
        <Stack.Screen
          name="LocationSelectionScreen" component={LocationSelectionScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
