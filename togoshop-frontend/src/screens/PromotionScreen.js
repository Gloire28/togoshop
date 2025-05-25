import React, { useContext } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { AppContext } from '../../context/AppContext';

export default function PromotionScreen({ navigation }) {
  const { promotions } = useContext(AppContext);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Promotions</Text>
      {promotions.length > 0 ? (
        promotions.map((promo) => (
          <View key={promo._id} style={styles.promoCard}>
            <Text style={styles.promoText}>{promo.name}</Text>
            <Button
              title="Voir détails"
              onPress={() => navigation.navigate('ProductDetail', { product: promo.product })}
            />
          </View>
        ))
      ) : (
        <Text style={styles.infoText}>Aucune promotion disponible</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  promoCard: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
  },
  promoText: {
    fontSize: 16,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
  },
});