import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { validateDeliveryByDriver } from '../../shared/services/api';

export default function DriverValidationScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [validationCode, setValidationCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    if (!validationCode.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un code de validation.');
      return;
    }

    setLoading(true);
    try {
      const response = await validateDeliveryByDriver(orderId, validationCode.trim().toUpperCase());
      if (response.success) {
        Alert.alert(
          'Succès',
          'Livraison validée avec succès !',
          [{ text: 'OK', onPress: () => navigation.navigate('DriverOrders') }]
        );
      } else {
        throw new Error(response.message || 'Code de validation incorrect.');
      }
    } catch (error) {
      console.log('Erreur lors de la validation:', error.message);
      Alert.alert('Erreur', error.message || 'Impossible de valider la livraison.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.title}>Valider la Livraison</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.instructions}>
          Entrez le code de validation fourni par le client pour confirmer la livraison de la commande #{orderId.substring(0, 8)}...
        </Text>
        <View style={styles.inputContainer}>
          <Icon name="lock" size={20} color="#4B5563" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Code de validation (ex. 738H9Q)"
            value={validationCode}
            onChangeText={setValidationCode}
            autoCapitalize="characters"
            maxLength={6}
            keyboardType="default"
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <TouchableOpacity
          style={[styles.validateButton, loading && styles.disabledButton]}
          onPress={handleValidate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="check-circle" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Valider</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 16,
    fontFamily: 'Poppins-Bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  instructions: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Poppins-Regular',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1E293B',
    fontFamily: 'Poppins-Regular',
  },
  validateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34D399',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Poppins-SemiBold',
  },
  buttonIcon: {
    marginRight: 8,
  },
});