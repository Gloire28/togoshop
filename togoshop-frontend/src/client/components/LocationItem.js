import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const LocationItem = memo(({ item, onPress }) => (
  <TouchableOpacity style={styles.locationItem} onPress={() => onPress(item._id)}>
    <Text style={styles.siteName}>{item.name}</Text>
    <Text style={styles.siteAddress}>{item.address}</Text>
  </TouchableOpacity>
));

const styles = StyleSheet.create({
  locationItem: {
    marginVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  siteName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  siteAddress: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#666',
  },
});

export default LocationItem;