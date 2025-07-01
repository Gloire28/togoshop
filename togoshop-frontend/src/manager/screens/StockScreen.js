import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Alert, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest, getManagerInfo } from '../../shared/services/api';

export default function StockScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newImage, setNewImage] = useState(null);
  const [newStock, setNewStock] = useState('');
  const [managerInfo, setManagerInfo] = useState(null);

  const CATEGORIES = [
    'Fruits',
    'Légumes',
    'Vêtements',
    'Électronique',
    'Viandes',
    'Produits Laitiers',
    'Épicerie',
    'Boissons',
    'Autres',
    'Céréales',
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Début de fetchData dans StockScreen');
        const info = await getManagerInfo();
        console.log('Manager info récupéré:', info);
        setManagerInfo(info);
        const supermarketId = info.supermarketId._id;
        const response = await apiRequest(`/products/supermarket/${supermarketId}?locationId=${info.locationId}`, { method: 'GET' });
        console.log('Produits récupérés:', response);
        setProducts(response);
        setFilteredProducts(response);

        const uniqueCategories = [...new Set(response.map(p => p.category))];
        setCategories(['Tout', ...uniqueCategories]);
      } catch (error) {
        console.log('Erreur dans fetchData:', error.message);
        Alert.alert('Erreur', 'Impossible de charger les données : ' + error.message);
      } finally {
        console.log('Fin de fetchData, loading:', false);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = products;

    if (selectedCategory && selectedCategory !== 'Tout') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchText) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(searchText.toLowerCase()));
    }

    setFilteredProducts(filtered);
  }, [selectedCategory, searchText, products]);

  const handleDelete = async (productId) => {
    console.log('Début de handleDelete pour productId:', productId);
    Alert.alert('Confirmation', 'Voulez-vous vraiment supprimer ce produit ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Oui',
        onPress: async () => {
          try {
            console.log('Tentative de suppression pour productId:', productId);
            await apiRequest(`/products/${productId}`, { method: 'DELETE' });
            console.log('Suppression réussie pour productId:', productId);
            setProducts(products.filter(p => p._id !== productId));
            setFilteredProducts(filteredProducts.filter(p => p._id !== productId));
            Alert.alert('Succès', 'Produit supprimé avec succès');
          } catch (error) {
            console.log('Erreur dans handleDelete:', error.message);
            Alert.alert('Erreur', 'Impossible de supprimer le produit : ' + error.message);
          }
        },
      },
    ]);
  };

  const pickImage = async () => {
    console.log('Début de pickImage');
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      console.log('Image sélectionnée:', result.assets[0].uri);
      setNewImage(result.assets[0].uri);
    } else {
      console.log('Sélection d\'image annulée');
    }
  };

  const handleUpdate = async () => {
    console.log('Début de handleUpdate pour selectedProduct:', selectedProduct);
    if (!selectedProduct || !managerInfo) {
      console.log('Erreur: selectedProduct ou managerInfo manquant');
      return;
    }

    const formData = new FormData();
    if (newDescription) formData.append('description', newDescription);
    if (newCategory) formData.append('category', newCategory);
    if (newImage) {
      const filename = newImage.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;
      formData.append('imageUrl', { uri: newImage, name: filename, type });
      console.log('Image ajoutée à formData:', { uri: newImage, name: filename, type });
    }
    if (newStock !== '') {
      const stock = parseInt(newStock, 10);
      if (isNaN(stock) || stock < 0) {
        console.log('Erreur: Nouvelle quantité invalide:', newStock);
        Alert.alert('Erreur', 'La quantité doit être un nombre positif');
        return;
      }
      const stockUpdate = {
        locationId: managerInfo.locationId,
        stock: stock,
      };
      console.log('Envoi de stockByLocation:', [stockUpdate]);
      formData.append('stockByLocation', JSON.stringify([stockUpdate]));
    }

    try {
      console.log('Tentative de mise à jour avec formData:', formData);
      const updatedProduct = await apiRequest(`/products/${selectedProduct._id}`, {
        method: 'PUT',
        body: formData,
        isFormData: true,
      });
      console.log('Réponse API handleUpdate:', updatedProduct);
      setProducts(products.map(p =>
        p._id === selectedProduct._id ? updatedProduct.product : p
      ));
      setFilteredProducts(filteredProducts.map(p =>
        p._id === selectedProduct._id ? updatedProduct.product : p
      ));
      setModalVisible(false);
      setNewDescription('');
      setNewCategory('');
      setNewImage(null);
      setNewStock('');
      Alert.alert('Succès', 'Produit mis à jour avec succès');
    } catch (error) {
      console.log('Erreur dans handleUpdate:', error.message);
      Alert.alert('Erreur', 'Impossible de mettre à jour le produit : ' + error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Chargement des stocks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestion des Stocks</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Rechercher un produit..."
        value={searchText}
        onChangeText={setSearchText}
      />

      <FlatList
        horizontal
        data={categories}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryButton, selectedCategory === item && styles.categoryButtonSelected]}
            onPress={() => setSelectedCategory(item)}
          >
            <Text style={[styles.categoryText, selectedCategory === item && styles.categoryTextSelected]}
                  numberOfLines={1}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryList}
      />

      <FlatList
        data={filteredProducts}
        keyExtractor={item => item._id}
        renderItem={({ item }) => {
          const stockEntry = item.stockByLocation.find(stock => stock.locationId === managerInfo?.locationId) || { stock: 0 };
          return (
            <View style={styles.productItem}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productDesc}>{item.description || 'Aucune description'}</Text>
              <Text style={styles.productStock}>Stock : {stockEntry.stock}</Text>
              <View style={styles.buttons}>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => {
                    setSelectedProduct(item);
                    setNewDescription(item.description || '');
                    setNewCategory(item.category || '');
                    setNewImage(null);
                    setNewStock(stockEntry.stock.toString());
                    setModalVisible(true);
                  }}
                >
                  <Ionicons name="pencil" size={20} color="#3498db" />
                  <Text style={styles.buttonText}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item._id)}>
                  <Ionicons name="trash" size={20} color="#e74c3c" />
                  <Text style={styles.deleteText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier le Produit</Text>
            <TextInput
              style={styles.input}
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder="Nouvelle description"
              multiline
            />
            <View style={styles.categoryButtons}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryButtonModal, newCategory === cat && styles.categoryButtonModalSelected]}
                  onPress={() => setNewCategory(cat)}
                >
                  <Text style={[styles.categoryTextModal, newCategory === cat && styles.categoryTextModalSelected]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={newStock}
              onChangeText={setNewStock}
              placeholder="Nouvelle quantité"
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={() => {
                Keyboard.dismiss();
                handleUpdate();
              }}
            />
            <TouchableOpacity style={styles.button} onPress={pickImage}>
              <Ionicons name="image" size={20} color="#3498db" />
              <Text style={styles.buttonText}>Choisir une image</Text>
            </TouchableOpacity>
            {newImage && <Text style={styles.imagePreview}>Image sélectionnée : {newImage.split('/').pop()}</Text>}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
                <Text style={styles.saveText}>Sauvegarder</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: 20, backgroundColor: '#f5f5f5', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  searchInput: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 16,
    color: '#2c3e50',
  },
  categoryList: { marginBottom: 15 },
  categoryButton: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
    width: 100,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryButtonSelected: {
    backgroundColor: '#3498db',
  },
  categoryText: {
    fontSize: 14,
    color: '#2c3e50',
    textAlign: 'center',
  },
  categoryTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  productItem: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10 },
  productName: { fontSize: 18, fontWeight: '600', color: '#2c3e50' },
  productDesc: { fontSize: 14, color: '#7f8c8d', marginVertical: 5 },
  productStock: { fontSize: 14, color: '#2c3e50', marginVertical: 5 },
  buttons: { flexDirection: 'row', justifyContent: 'space-between' },
  button: { flexDirection: 'row', alignItems: 'center', padding: 5 },
  buttonText: { fontSize: 16, color: '#3498db', marginLeft: 5 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', padding: 5 },
  deleteText: { fontSize: 16, color: '#e74c3c', marginLeft: 5 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginHorizontal: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  input: { backgroundColor: '#f0f0f0', padding: 10, borderRadius: 5, marginBottom: 10 },
  categoryButtons: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  categoryButtonModal: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    margin: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryButtonModalSelected: {
    backgroundColor: '#3498db',
  },
  categoryTextModal: {
    fontSize: 14,
    color: '#2c3e50',
    textAlign: 'center',
  },
  categoryTextModalSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  imagePreview: { fontSize: 14, color: '#7f8c8d', marginVertical: 5 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  saveButton: { backgroundColor: '#28a745', padding: 10, borderRadius: 5, flex: 1, marginRight: 5 },
  saveText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  cancelButton: { backgroundColor: '#e74c3c', padding: 10, borderRadius: 5, flex: 1, marginLeft: 5 },
  cancelText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
});