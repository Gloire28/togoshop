import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../../shared/context/AppContext';
import { getPromotions, applyPromotion, getUserCart, apiRequest } from '../../shared/services/api';

// Composant principal de l'écran des promotions
export default function PromotionScreen({ navigation }) {
  const { promotions, setPromotions, cart, fetchCart } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);

  useEffect(() => {
    const fetchPromotions = async () => {
      setLoading(true);
      try {
        const data = await getPromotions();
        console.log('Promotions reçues:', data); // Débogage
        setPromotions(data);
      } catch (error) {
        console.log('Erreur lors de la récupération des promotions:', error.message);
        Alert.alert('Erreur', 'Impossible de charger les promotions');
      } finally {
        setLoading(false);
      }
    };

    fetchPromotions();
  }, [setPromotions]);

  const handleApplyPromo = async () => {
    if (!promoCode) {
      Alert.alert('Erreur', 'Veuillez entrer un code promo');
      return;
    }

    if (!cart || cart.length === 0) {
      Alert.alert('Erreur', 'Aucune commande en cours. Ajoutez des produits à votre panier.');
      return;
    }

    let orderId;
    try {
      const cartData = await getUserCart();
      if (!cartData || cartData.status !== 'cart_in_progress') {
        Alert.alert('Erreur', 'Aucune commande en cours trouvée.');
        return;
      }
      orderId = cartData._id;
    } catch (error) {
      console.log('Erreur lors de la récupération du panier:', error.message);
      Alert.alert('Erreur', 'Impossible de vérifier le panier');
      return;
    }

    setApplyingPromo(true);
    try {
      const response = await applyPromotion(promoCode, orderId);
      const promo = response.promotion;
      Alert.alert('Succès', `Promotion ${promoCode} appliquée avec succès ! Réduction de ${promo.discountValue}${promo.discountType === 'percentage' ? '%' : ' FCFA'}`);
      setPromoCode('');
      await fetchCart(); // Rafraîchir le panier pour refléter les promotedPrice
    } catch (error) {
      console.log('Erreur lors de l’application de la promotion:', error.message);
      Alert.alert('Erreur', error.message || 'Impossible d’appliquer la promotion');
    } finally {
      setApplyingPromo(false);
    }
  };

  const getLocationIdFromPromotion = async (promo) => {
    try {
      console.log('Promo analysée:', promo); // Débogage
      const productId = promo.productId?._id || promo.productId; // Extrait _id si objet, sinon utilise directement
      if (!productId || typeof productId !== 'string') {
        throw new Error('ID de produit invalide: ' + JSON.stringify(productId));
      }
      const product = await apiRequest(`/products/${productId}`); // Corrige l'endpoint avec /api
      console.log('Produit récupéré:', product); // Débogage
      if (product && product.stockByLocation && product.stockByLocation.length > 0) {
        return product.stockByLocation[0].locationId;
      }
      return null;
    } catch (error) {
      console.log('Erreur lors de la récupération du locationId:', error.message);
      Alert.alert('Erreur', 'Impossible de récupérer la localisation.');
      return null;
    }
  };

  return (
    <LinearGradient colors={['#1E3A8A', '#4A90E2']} style={styles.gradient}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Promotions Actives</Text>
        </View>

        <View style={styles.promoInputContainer}>
          <TextInput
            style={styles.promoInput}
            placeholder="Entrez un code promo"
            placeholderTextColor="#A1A1AA"
            value={promoCode}
            onChangeText={setPromoCode}
            editable={!applyingPromo}
          />
          <TouchableOpacity
            style={[styles.applyButton, applyingPromo && styles.disabledButton]}
            onPress={handleApplyPromo}
            disabled={applyingPromo}
          >
            {applyingPromo ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Appliquer</Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#fff" style={styles.loader} />
        ) : promotions.length > 0 ? (
          promotions.map((promo) => (
            <View key={promo._id} style={styles.promoCard}>
              <Text style={styles.promoTitle}>{promo.title}</Text>
              <Text style={styles.promoDescription}>{promo.description}</Text>

              <Text style={styles.promoDetail}>
                Réduction : {promo.discountValue}
                {promo.discountType === 'percentage' ? '%' : ' FCFA'}
              </Text>
              <Text style={styles.promoDetail}>
                Montant minimum : {promo.minOrderAmount} FCFA
              </Text>
              <Text style={styles.promoDetail}>
                Valide du {new Date(promo.startDate).toLocaleDateString('fr-FR')} au{' '}
                {new Date(promo.endDate).toLocaleDateString('fr-FR')}
              </Text>
              <Text style={styles.promoDetail}>Code : {promo.code}</Text>

              {promo.productId && (
                <TouchableOpacity
                  style={styles.detailButton}
                  onPress={async () => {
                    const locationId = await getLocationIdFromPromotion(promo);
                    if (locationId) {
                      navigation.navigate('ProductDetail', {
                        product: promo.productId,
                        discountValue: promo.discountValue,
                        discountType: promo.discountType,
                        supermarketId: promo.supermarketId,
                        locationId,
                      });
                    } else {
                      Alert.alert('Erreur', 'Impossible de déterminer la localisation');
                    }
                  }}
                >
                  <Text style={styles.buttonText}>Voir le produit</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.infoText}>Aucune promotion disponible</Text>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, padding: 20, paddingTop: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10, 
    marginTop: -35,
    marginTop: 5   
  },
  backButton: { padding: 10 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginTop: -5, // remonte le texte un peu plus haut
  },
  promoInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    elevation: 2,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginRight: 10,
  },
  applyButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#a5d6a7',
  },
  promoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  promoDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  promoDetail: {
    fontSize: 14,
    color: '#999',
    marginBottom: 5,
  },
  detailButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
  loader: {
    marginVertical: 20,
  },
});