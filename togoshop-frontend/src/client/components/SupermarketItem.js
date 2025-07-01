import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

const SupermarketItem = memo(({ item, onPress }) => (
  <TouchableOpacity style={styles.supermarketItem} onPress={() => onPress(item)}>
    <View style={styles.supermarketLeft}>
      <Text style={styles.supermarketName}>{item.name}</Text>
    </View>
    <View style={styles.supermarketRight}>
      <View style={[styles.statusIndicator, { backgroundColor: item.isOpen ? '#00FF00' : '#FF0000' }]} />
      <Text style={styles.statusText}>{item.isOpen ? 'Ouvert' : 'Fermé'}</Text>
      <Text style={styles.siteCount}>{item.locations.length} site(s)</Text>
      <Image source={{ uri: item.logoUrl || 'https://via.placeholder.com/50' }} style={styles.logo} />
    </View>
  </TouchableOpacity>
));

const styles = StyleSheet.create({
  supermarketItem: {
    marginVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supermarketLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  supermarketName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  supermarketRight: {
    alignItems: 'flex-end',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 5,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  siteCount: {
    fontSize: 12,
    color: '#666',
  },
  logo: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
    marginTop: 5,
  },
});

export default SupermarketItem;