import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../services/api';

export const AdverseEventFormScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    medicine_id: '',
    patient_age: '',
    event_description: '',
    severity: 'moderate',
    outcome: '',
  });

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await apiClient.post('/api/v2/eda/adverse-events', formData);
      Alert.alert('Success', 'Adverse event reported successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit adverse event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Report Adverse Event</Text>
          <TextInput
            label="Medicine ID"
            value={formData.medicine_id}
            onChangeText={text => setFormData({ ...formData, medicine_id: text })}
            style={styles.input}
          />
          <TextInput
            label="Patient Age"
            value={formData.patient_age}
            onChangeText={text => setFormData({ ...formData, patient_age: text })}
            keyboardType="numeric"
            style={styles.input}
          />
          <TextInput
            label="Event Description"
            value={formData.event_description}
            onChangeText={text => setFormData({ ...formData, event_description: text })}
            multiline
            numberOfLines={4}
            style={styles.input}
          />
          <TextInput
            label="Outcome"
            value={formData.outcome}
            onChangeText={text => setFormData({ ...formData, outcome: text })}
            style={styles.input}
          />
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            style={styles.button}
          >
            Submit Report
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  card: { margin: 16 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: { marginBottom: 12 },
  button: { marginTop: 16 },
});
