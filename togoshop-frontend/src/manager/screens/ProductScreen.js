import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Switch, ScrollView, Alert, ActivityIndicator, Modal, FlatList, TouchableWithoutFeedback, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest, uploadProductImage } from '../../shared/services/api';

export default function ProductScreen({ navigation }) {
  const [productData, setProductData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Fruits',
    stockByLocation: [{ locationId: '', stock: '0' }],
    weight: '1',
    isMadeInTogo: false,
    imageUrl: '',
  });
  const [managerLocationId, setManagerLocationId] = useState(null);
  const [supermarketId, setSupermarketId] = useState(null);
  const [supermarketName, setSupermarketName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [image, setImage] = useState(null); // État pour l'image sélectionnée
  const categories = ['Fruits', 'Légumes', 'Vêtements', 'Électronique', 'Viandes', 'Produits Laitiers', 'Épicerie', 'Boissons', 'Autres', 'Céréales'];

  // Charger les informations du manager
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoadingData(true);
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          Alert.alert('Erreur', 'Utilisateur non authentifié', [
            { text: 'OK', onPress: () => navigation.navigate('Login') },
          ]);
          return;
        }

        const response = await apiRequest('/managers/me', { method: 'GET' });
        const managerSupermarketId = response.supermarketId._id ? response.supermarketId._id.toString() : null;
        const managerLocId = response.locationId || null;
        const managerSupermarketName = response.supermarketId.name || 'Inconnu';

        if (!managerSupermarketId || !managerLocId) {
          Alert.alert('Erreur', 'Informations du manager incomplètes.');
          return;
        }

        setSupermarketId(managerSupermarketId);
        setSupermarketName(managerSupermarketName);
        setManagerLocationId(managerLocId);

        setProductData((prev) => ({
          ...prev,
          stockByLocation: [{ locationId: managerLocId, stock: '0' }],
        }));
      } catch (error) {
        Alert.alert('Erreur', 'Impossible de charger les données : ' + (error.message || 'Erreur inconnue'));
      } finally {
        setIsLoadingData(false);
      }
    };
    initialize();
  }, [navigation]);

  // Gérer les changements dans les champs du formulaire
  const handleInputChange = (field, value) => {
    setProductData((prev) => ({ ...prev, [field]: value }));
  };

  // Gérer les changements dans stockByLocation (seulement le stock)
  const handleStockChange = (value) => {
    setProductData((prev) => ({
      ...prev,
      stockByLocation: [{ ...prev.stockByLocation[0], stock: value }],
    }));
  };

  // Sélectionner une image
  const selectImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire pour sélectionner une image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    } else {
      console.log('Sélection d\'image annulée');
    }
  };

  // Créer le produit via l'API
// Remplace la fonction createProduct dans ProductScreen.js
  const createProduct = async () => {
    if (!supermarketId || !managerLocationId) {
      Alert.alert('Erreur', 'Données du supermarché ou du site non disponibles.');
      return;
    }

    if (!productData.name.trim()) {
      Alert.alert('Erreur', 'Le nom du produit est requis.');
      return;
    }

    const priceValue = parseFloat(productData.price);
    if (!productData.price || isNaN(priceValue) || priceValue <= 0) {
      Alert.alert('Erreur', 'Le prix doit être un nombre positif.');
      return;
    }

    if (!productData.category) {
      Alert.alert('Erreur', 'La catégorie est requise.');
      return;
    }

    const weightValue = parseFloat(productData.weight);
    if (!productData.weight || isNaN(weightValue) || weightValue < 0) {
      Alert.alert('Erreur', 'Le poids doit être un nombre positif ou zéro.');
      return;
    }

    const stockByLocation = productData.stockByLocation.map((stock) => ({
      locationId: stock.locationId,
      stock: parseInt(stock.stock) || 0,
    }));

    for (const stock of stockByLocation) {
      if (!stock.locationId) {
        Alert.alert('Erreur', 'Le site du manager est requis.');
        return;
      }
      if (stock.stock < 0) {
        Alert.alert('Erreur', 'Le stock ne peut pas être négatif.');
        return;
      }
    }

    setLoading(true);
    try {
      let imageUrl = '';
      if (image) {
        const uploadResponse = await uploadProductImage(image);
        if (uploadResponse && uploadResponse.imageUrl) {
          imageUrl = uploadResponse.imageUrl; // Vérification explicite
          console.log('Image URL générée:', imageUrl); // Débogage
        } else {
          throw new Error('Échec de l\'upload de l\'image ou URL manquante.');
        }
      }

      const productToCreate = {
        name: productData.name.trim(),
        description: productData.description.trim(),
        price: priceValue,
        category: productData.category,
        supermarketId,
        stockByLocation,
        weight: weightValue,
        isMadeInTogo: productData.isMadeInTogo,
        imageUrl, // Assure que l'URL est bien incluse
      };

      console.log('Données envoyées à createProduct:', productToCreate); // Débogage
      const response = await apiRequest('/products', {
        method: 'POST',
        body: productToCreate,
      });

      Alert.alert('Succès', response.message, [
        {
          text: 'OK',
          onPress: () => {
            setProductData({
              name: '',
              description: '',
              price: '',
              category: 'Fruits',
              stockByLocation: [{ locationId: managerLocationId, stock: '0' }],
              weight: '1',
              isMadeInTogo: false,
              imageUrl: '',
            });
            setImage(null);
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Impossible de créer le produit.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#28a745" />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Ajouter un Produit</Text>

      {/* Nom */}
      <Text style={styles.label}>Nom du produit <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={styles.input}
        value={productData.name}
        onChangeText={(value) => handleInputChange('name', value)}
        placeholder="Exemple : Pommes Gala"
        placeholderTextColor="#95a5a6"
      />

      {/* Description */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={productData.description}
        onChangeText={(value) => handleInputChange('description', value)}
        placeholder="Entrez une description (facultatif)"
        placeholderTextColor="#95a5a6"
        multiline
      />

      {/* Prix */}
      <Text style={styles.label}>Prix (FCFA) <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={styles.input}
        value={productData.price}
        onChangeText={(value) => handleInputChange('price', value)}
        placeholder="Exemple : 1500"
        placeholderTextColor="#95a5a6"
        keyboardType="numeric"
      />

      {/* Catégorie avec Modal */}
      <Text style={styles.label}>Catégorie <Text style={styles.required}>*</Text></Text>
      <TouchableOpacity style={[styles.input, styles.categoryButton]} onPress={() => setCategoryModalVisible(true)}>
        <Text style={styles.categoryText}>{productData.category || 'Sélectionner une catégorie'}</Text>
        <Ionicons name="chevron-down" size={20} color="#34495e" />
      </TouchableOpacity>
      <Modal
        visible={categoryModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCategoryModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <FlatList
                data={categories}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      handleInputChange('category', item);
                      setCategoryModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Stock pour le site du manager */}
      <Text style={styles.label}>Stock (Site : {supermarketName}) <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={styles.input}
        value={productData.stockByLocation[0].stock}
        onChangeText={(value) => handleStockChange(value)}
        placeholder="Exemple : 100"
        placeholderTextColor="#95a5a6"
        keyboardType="numeric"
      />

      {/* Poids */}
      <Text style={styles.label}>Poids (kg) <Text style={styles.required}>*</Text></Text>
      <TextInput
        style={styles.input}
        value={productData.weight}
        onChangeText={(value) => handleInputChange('weight', value)}
        placeholder="Exemple : 0.2"
        placeholderTextColor="#95a5a6"
        keyboardType="decimal-pad"
      />

      {/* Fabriqué au Togo */}
      <View style={styles.switchContainer}>
        <Text style={styles.label}>Fabriqué au Togo ?</Text>
        <Switch
          value={productData.isMadeInTogo}
          onValueChange={(value) => handleInputChange('isMadeInTogo', value)}
          trackColor={{ false: '#dc3545', true: '#28a745' }}
          thumbColor={productData.isMadeInTogo ? '#fff' : '#fff'}
          disabled={loading}
        />
      </View>

      {/* Sélection d'image */}
      <Text style={styles.label}>Image du produit</Text>
      <TouchableOpacity style={[styles.input, styles.imageButton]} onPress={selectImage}>
        <Text style={styles.imageButtonText}>{image ? 'Image sélectionnée' : 'Sélectionner une image'}</Text>
      </TouchableOpacity>
      {image && (
        <Image source={{ uri: image.uri }} style={styles.imagePreview} resizeMode="contain" />
      )}

      {/* Bouton de Création */}
      <TouchableOpacity style={[styles.createButton, loading && styles.createButtonDisabled]} onPress={createProduct} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.createButtonText}>Créer le Produit</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#34495e',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#2c3e50',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 5,
  },
  required: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
    color: '#2c3e50',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    width: '80%',
    maxHeight: '50%',
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalItemText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  imageButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3498db',
  },
  imageButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    marginBottom: 15,
    borderRadius: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  createButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 10,
  },
});