import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Chip, ActivityIndicator, List } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import { apiClient } from '../services/api';

export const MedicineDetailsScreen: React.FC = () => {
  const route = useRoute();
  const { medicineId } = route.params as { medicineId: string };
  const [medicine, setMedicine] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMedicine();
  }, []);

  const fetchMedicine = async () => {
    try {
      const response = await apiClient.get(`/api/v2/eda/medicines/${medicineId}`);
      setMedicine(response.data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!medicine) return <Text>Medicine not found</Text>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <Card style={{ margin: 16 }}>
        <Card.Content>
          <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{medicine.name}</Text>
          <Chip style={{ marginTop: 8 }}>{medicine.status}</Chip>
          
          <List.Section>
            <List.Item title="Generic Name" description={medicine.generic_name} />
            <List.Item title="Manufacturer" description={medicine.manufacturer} />
            <List.Item title="Dosage Form" description={medicine.dosage_form} />
            <List.Item title="Strength" description={medicine.strength} />
            <List.Item title="Route" description={medicine.route} />
          </List.Section>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};
