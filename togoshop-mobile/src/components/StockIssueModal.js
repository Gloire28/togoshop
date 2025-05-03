import React from 'react';
import { View, Text, Modal, Button } from 'react-native';

const StockIssueModal = ({ product, visible, onClose }) => (
  <Modal visible={visible}>
    <View>
      <Text>Rupture pour {product.name}</Text>
      <Button title="Substitut" />
      <Button title="Autre site" />
      <Button title="Retirer" />
      <Button title="Notifier" />
      <Button title="Fermer" onPress={onClose} />
    </View>
  </Modal>
);

export default StockIssueModal;