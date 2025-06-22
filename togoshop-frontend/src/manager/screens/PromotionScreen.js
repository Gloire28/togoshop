import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  FlatList,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { getManagerInfo, getSupermarketProducts, createPromotion, getSupermarketPromotions, updatePromotion, deletePromotion } from '../../shared/services/api';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

// Composant TextInput isolé avec gestion du focus
const InputField = memo(
  ({ label, value, onChangeText, placeholder, multiline, keyboardType, onBlur }) => {
    const inputRef = useRef(null);
    console.log(`InputField re-rendu pour ${placeholder}`);
    return (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          {label} {label.includes('*') && <Text style={styles.required}>*</Text>}
        </Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, multiline && styles.textArea]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#95a5a6"
          multiline={multiline}
          keyboardType={keyboardType}
          blurOnSubmit={false}
          onBlur={() => {
            console.log(`${label} TextInput perdu le focus`);
            onBlur && onBlur();
          }}
          onFocus={() => inputRef.current.focus()}
        />
      </View>
    );
  },
  (prevProps, nextProps) => prevProps.value === nextProps.value && prevProps.placeholder === nextProps.placeholder
);

export default function PromotionScreen({ navigation }) {
  const [promotionData, setPromotionData] = useState({
    id: null,
    productId: '',
    productName: '',
    title: '',
    description: '',
    discountType: 'percentage',
    discountValue: '',
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    minOrderAmount: '',
    maxUses: '',
  });
  const [supermarketId, setSupermarketId] = useState(null);
  const [supermarketName, setSupermarketName] = useState('');
  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [discountTypeModalVisible, setDiscountTypeModalVisible] = useState(false);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const discountTypes = ['percentage', 'fixed'];

  // Charger les données initiales
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

        const managerResponse = await getManagerInfo();
        const managerSupermarketId = managerResponse.supermarketId._id
          ? managerResponse.supermarketId._id.toString()
          : null;
        const managerSupermarketName = managerResponse.supermarketId.name || 'Inconnu';

        if (!managerSupermarketId) {
          Alert.alert('Erreur', 'ID du supermarché non trouvé.');
          return;
        }

        setSupermarketId(managerSupermarketId);
        setSupermarketName(managerSupermarketName);

        const productsResponse = await getSupermarketProducts(managerSupermarketId);
        setProducts(productsResponse);

        const promotionsResponse = await getSupermarketPromotions(managerSupermarketId);
        setPromotions(promotionsResponse);
      } catch (error) {
        Alert.alert('Erreur', 'Impossible de charger les données : ' + (error.message || 'Erreur inconnue'));
      } finally {
        setIsLoadingData(false);
      }
    };
    initialize();
  }, [navigation]);

  // Gérer les changements dans les champs
  const handleInputChange = useCallback((field, value) => {
    console.log(`handleInputChange appelé pour ${field} avec valeur: ${value}`);
    setPromotionData((prev) => {
      if (prev[field] === value) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  // Réinitialiser le formulaire
  const resetForm = () => {
    setPromotionData({
      id: null,
      productId: '',
      productName: '',
      title: '',
      description: '',
      discountType: 'percentage',
      discountValue: '',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      minOrderAmount: '',
      maxUses: '',
    });
  };

  // Créer ou modifier une promotion
  const handleSavePromotion = async () => {
    const now = new Date();
    let startDate = new Date(promotionData.startDate);
    const endDate = new Date(promotionData.endDate);

    // Ajuster startDate si elle est dans le passé
    if (startDate < now) {
      startDate = new Date(now.getTime() + 10 * 1000); // +10s
      handleInputChange('startDate', startDate); // Mettre à jour l'état
    }

    console.log('=== Enregistrement de promotion initié ===', {
      id: promotionData.id,
      supermarketId,
      productId: promotionData.productId,
      title: promotionData.title,
      description: promotionData.description,
      discountType: promotionData.discountType,
      discountValue: promotionData.discountValue,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      minOrderAmount: promotionData.minOrderAmount,
      maxUses: promotionData.maxUses,
    });

    if (!supermarketId) {
      Alert.alert('Erreur', 'Données du supermarché non disponibles.');
      return;
    }

    if (!promotionData.productId) {
      Alert.alert('Erreur', 'Le produit est requis.');
      return;
    }
    if (!promotionData.title.trim()) {
      Alert.alert('Erreur', 'Le titre est requis.');
      return;
    }
    if (!promotionData.description.trim()) {
      Alert.alert('Erreur', 'La description est requise.');
      return;
    }
    const discountValue = parseFloat(promotionData.discountValue);
    if (!promotionData.discountValue || isNaN(discountValue) || discountValue <= 0) {
      Alert.alert('Erreur', 'La valeur de la réduction doit être un nombre positif.');
      return;
    }
    if (endDate <= startDate) {
      Alert.alert('Erreur', 'La date de fin doit être après la date de début.');
      return;
    }
    const minOrderAmount = promotionData.minOrderAmount
      ? parseFloat(promotionData.minOrderAmount)
      : null;
    if (minOrderAmount !== null && (isNaN(minOrderAmount) || minOrderAmount < 0)) {
      Alert.alert('Erreur', 'Le montant minimum doit être un nombre positif ou zéro.');
      return;
    }
    const maxUses = promotionData.maxUses ? parseInt(promotionData.maxUses) : null;
    if (maxUses !== null && (isNaN(maxUses) || maxUses <= 0)) {
      Alert.alert('Erreur', 'Le nombre maximum d’utilisations doit être un nombre positif.');
      return;
    }

    setLoading(true);
    try {
      const promotionPayload = {
        supermarketId,
        productId: promotionData.productId,
        title: promotionData.title.trim(),
        description: promotionData.description.trim(),
        discountType: promotionData.discountType,
        discountValue,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        minOrderAmount: minOrderAmount || undefined,
        maxUses: maxUses || undefined,
      };

      let response;
      if (promotionData.id) {
        response = await updatePromotion(promotionData.id, promotionPayload);
      } else {
        response = await createPromotion(promotionPayload);
      }

      const updatedPromotions = await getSupermarketPromotions(supermarketId);
      setPromotions(updatedPromotions);

      Alert.alert('Succès', response.message || `Promotion ${promotionData.id ? 'modifiée' : 'créée'} avec succès`, [
        {
          text: 'OK',
          onPress: resetForm,
        },
      ]);
    } catch (error) {
      Alert.alert('Erreur', error.message || `Impossible de ${promotionData.id ? 'modifier' : 'créer'} la promotion.`);
    } finally {
      setLoading(false);
    }
  };

  // Supprimer une promotion
  const handleDeletePromotion = async (promotionId) => {
    Alert.alert(
      'Confirmer la suppression',
      'Êtes-vous sûr de vouloir supprimer cette promotion ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deletePromotion(promotionId);
              const updatedPromotions = await getSupermarketPromotions(supermarketId);
              setPromotions(updatedPromotions);
              Alert.alert('Succès', 'Promotion supprimée avec succès');
            } catch (error) {
              Alert.alert('Erreur', error.message || 'Impossible de supprimer la promotion.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Pré-remplir le formulaire pour modifier
  const handleEditPromotion = (promotion) => {
    const now = new Date();
    let startDate = new Date(promotion.startDate);
    if (startDate < now) {
      startDate = new Date(now.getTime() + 10 * 1000); // +10s
    }
    setPromotionData({
      id: promotion._id,
      productId: promotion.productId._id,
      productName: promotion.productId.name,
      title: promotion.title,
      description: promotion.description,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue.toString(),
      startDate,
      endDate: new Date(promotion.endDate),
      minOrderAmount: promotion.minOrderAmount ? promotion.minOrderAmount.toString() : '',
      maxUses: promotion.maxUses ? promotion.maxUses.toString() : '',
    });
  };

  // Rendre chaque promotion
  const renderPromotion = ({ item }) => (
    <View style={styles.promotionCard}>
      <Text style={styles.promotionTitle}>{item.title}</Text>
      <Text style={styles.promotionText}>
        Produit : {item.productId?.name || 'Tous les produits'}
      </Text>
      <Text style={styles.promotionText}>
        Réduction : {item.discountValue}
        {item.discountType === 'percentage' ? '%' : ' FCFA'}
      </Text>
      <Text style={styles.promotionText}>
        Valide du {new Date(item.startDate).toLocaleDateString()} au{' '}
        {new Date(item.endDate).toLocaleDateString()}
      </Text>
      <Text style={styles.promotionText}>Code : {item.code}</Text>
      <View style={styles.promotionActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditPromotion(item)}
        >
          <Ionicons name="pencil" size={20} color="#3498db" />
          <Text style={styles.actionText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeletePromotion(item._id)}
        >
          <Ionicons name="trash" size={20} color="#e74c3c" />
          <Text style={styles.actionText}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#28a745" />
        <Text style={styles.loadingText}>Chargement des données...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>{promotionData.id ? 'Modifier une Promotion' : 'Créer une Promotion'}</Text>

          {/* Produit */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Produit <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.input, styles.categoryButton]}
              onPress={() => setProductModalVisible(true)}
            >
              <Text style={styles.categoryText}>
                {promotionData.productName || 'Sélectionner un produit'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#34495e" />
            </TouchableOpacity>
          </View>
          <Modal
            visible={productModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setProductModalVisible(false)}
          >
            <TouchableWithoutFeedback onPress={() => setProductModalVisible(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <FlatList
                    data={products}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.modalItem}
                        onPress={() => {
                          handleInputChange('productId', item._id);
                          handleInputChange('productName', item.name);
                          setProductModalVisible(false);
                        }}
                      >
                        <Text style={styles.modalItemText}>
                          {item.name} ({item.price} FCFA)
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {/* Titre */}
          <InputField
            label="Titre *"
            value={promotionData.title}
            onChangeText={(value) => handleInputChange('title', value)}
            placeholder="Exemple : Promo sur les Pommes"
          />

          {/* Description */}
          <InputField
            label="Description *"
            value={promotionData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            placeholder="Entrez une description"
            multiline
          />

          {/* Type de réduction */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Type de réduction <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.input, styles.categoryButton]}
              onPress={() => setDiscountTypeModalVisible(true)}
            >
              <Text style={styles.categoryText}>
                {promotionData.discountType === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#34495e" />
            </TouchableOpacity>
          </View>
          <Modal
            visible={discountTypeModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setDiscountTypeModalVisible(false)}
          >
            <TouchableWithoutFeedback onPress={() => setDiscountTypeModalVisible(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <FlatList
                    data={discountTypes}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.modalItem}
                        onPress={() => {
                          handleInputChange('discountType', item);
                          setDiscountTypeModalVisible(false);
                        }}
                      >
                        <Text style={styles.modalItemText}>
                          {item === 'percentage' ? 'Pourcentage' : 'Montant fixe'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {/* Valeur de la réduction */}
          <InputField
            label="Valeur de la réduction *"
            value={promotionData.discountValue}
            onChangeText={(value) => handleInputChange('discountValue', value)}
            placeholder="Exemple : 10"
            keyboardType="numeric"
          />

          {/* Date de début */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Date de début <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.input, styles.categoryButton]}
              onPress={() => setStartDatePickerVisible(true)}
            >
              <Text style={styles.categoryText}>
                {promotionData.startDate.toLocaleDateString()}
              </Text>
              <Ionicons name="calendar" size={20} color="#34495e" />
            </TouchableOpacity>
          </View>
          <DateTimePickerModal
            isVisible={startDatePickerVisible}
            mode="date"
            date={promotionData.startDate}
            onConfirm={(date) => {
              handleInputChange('startDate', date);
              setStartDatePickerVisible(false);
            }}
            onCancel={() => setStartDatePickerVisible(false)}
          />

          {/* Date de fin */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Date de fin <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.input, styles.categoryButton]}
              onPress={() => setEndDatePickerVisible(true)}
            >
              <Text style={styles.categoryText}>
                {promotionData.endDate.toLocaleDateString()}
              </Text>
              <Ionicons name="calendar" size={20} color="#34495e" />
            </TouchableOpacity>
          </View>
          <DateTimePickerModal
            isVisible={endDatePickerVisible}
            mode="date"
            date={promotionData.endDate}
            onConfirm={(date) => {
              handleInputChange('endDate', date);
              setEndDatePickerVisible(false);
            }}
            onCancel={() => setEndDatePickerVisible(false)}
          />

          {/* Montant minimum */}
          <InputField
            label="Montant minimum de commande"
            value={promotionData.minOrderAmount}
            onChangeText={(value) => handleInputChange('minOrderAmount', value)}
            placeholder="Exemple : 5000"
            keyboardType="numeric"
          />

          {/* Nombre maximum d'utilisations */}
          <InputField
            label="Nombre maximum d'utilisations"
            value={promotionData.maxUses}
            onChangeText={(value) => handleInputChange('maxUses', value)}
            placeholder="Exemple : 100"
            keyboardType="numeric"
          />

          {/* Bouton de Création/Modification */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleSavePromotion}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name={promotionData.id ? 'save' : 'add-circle'} size={24} color="#fff" />
                <Text style={styles.createButtonText}>
                  {promotionData.id ? 'Modifier la Promotion' : 'Créer la Promotion'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Liste des promotions existantes */}
          <Text style={styles.title}>Promotions Existantes</Text>
          <FlatList
            data={promotions}
            renderItem={renderPromotion}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={<Text style={styles.emptyText}>Aucune promotion active</Text>}
            style={styles.promotionList}
            nestedScrollEnabled
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  formContainer: {
    paddingHorizontal: 20,
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
    marginTop: 20,
    textAlign: 'center',
    color: '#2c3e50',
  },
  inputContainer: {
    marginBottom: 15,
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
  promotionCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  promotionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  promotionText: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 3,
  },
  promotionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
  },
  actionText: {
    fontSize: 14,
    color: '#34495e',
    marginLeft: 5,
  },
  emptyText: {
    fontSize: 16,
    color: '#34495e',
    textAlign: 'center',
    marginTop: 20,
  },
  promotionList: {
    flexGrow: 0,
  },
});