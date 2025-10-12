import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  Divider,
  ActivityIndicator,
  List,
} from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { apiClient } from '../services/api';

interface RecallDetails {
  id: string;
  medicine_id: string;
  medicine_name: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  affected_batches: string[];
  initiated_date: string;
  completion_date?: string;
  notifications_sent: number;
  description: string;
  action_required: string;
  contact_info: string;
  created_by: string;
  updated_at: string;
}

export const RecallDetailsScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { recallId } = route.params as { recallId: string };

  const [recall, setRecall] = useState<RecallDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchRecallDetails();
  }, [recallId]);

  const fetchRecallDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/v2/eda/recalls/${recallId}`);
      setRecall(response.data);
    } catch (error) {
      console.error('Error fetching recall details:', error);
      Alert.alert('Error', 'Failed to load recall details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotifications = async () => {
    Alert.alert(
      'Send Notifications',
      'Are you sure you want to send notifications for this recall?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              setSending(true);
              await apiClient.post(`/api/v2/eda/recalls/${recallId}/notify`);
              Alert.alert('Success', 'Notifications sent successfully');
              fetchRecallDetails();
            } catch (error) {
              Alert.alert('Error', 'Failed to send notifications');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#D32F2F';
      case 'high':
        return '#F57C00';
      case 'medium':
        return '#FBC02D';
      case 'low':
        return '#388E3C';
      default:
        return '#757575';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#1976D2';
      case 'completed':
        return '#388E3C';
      case 'cancelled':
        return '#757575';
      case 'draft':
        return '#FBC02D';
      default:
        return '#757575';
    }
  };

  if (loading || !recall) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <Text style={styles.title}>{recall.medicine_name}</Text>
            <View style={styles.badges}>
              <Chip
                mode="flat"
                style={[
                  styles.severityChip,
                  { backgroundColor: getSeverityColor(recall.severity) },
                ]}
                textStyle={styles.chipText}
              >
                {recall.severity.toUpperCase()}
              </Chip>
              <Chip
                mode="outlined"
                style={[
                  styles.statusChip,
                  { borderColor: getStatusColor(recall.status) },
                ]}
                textStyle={{ color: getStatusColor(recall.status) }}
              >
                {recall.status.toUpperCase()}
              </Chip>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reason for Recall</Text>
            <Text style={styles.sectionContent}>{recall.reason}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.sectionContent}>{recall.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Action Required</Text>
            <Text style={styles.sectionContent}>{recall.action_required}</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Affected Batches</Text>
            {recall.affected_batches.map((batch, index) => (
              <Chip key={index} style={styles.batchChip}>
                {batch}
              </Chip>
            ))}
          </View>

          <Divider style={styles.divider} />

          <List.Section>
            <List.Item
              title="Initiated Date"
              description={new Date(recall.initiated_date).toLocaleString()}
              left={props => <List.Icon {...props} icon="calendar" />}
            />
            {recall.completion_date && (
              <List.Item
                title="Completion Date"
                description={new Date(recall.completion_date).toLocaleString()}
                left={props => <List.Icon {...props} icon="calendar-check" />}
              />
            )}
            <List.Item
              title="Notifications Sent"
              description={`${recall.notifications_sent} notifications`}
              left={props => <List.Icon {...props} icon="bell" />}
            />
            <List.Item
              title="Created By"
              description={recall.created_by}
              left={props => <List.Icon {...props} icon="account" />}
            />
            <List.Item
              title="Last Updated"
              description={new Date(recall.updated_at).toLocaleString()}
              left={props => <List.Icon {...props} icon="update" />}
            />
          </List.Section>

          <Divider style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <Text style={styles.sectionContent}>{recall.contact_info}</Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.actions}>
        {recall.status === 'active' && (
          <Button
            mode="contained"
            onPress={handleSendNotifications}
            loading={sending}
            disabled={sending}
            style={styles.button}
            icon="send"
          >
            Send Notifications
          </Button>
        )}

        <Button
          mode="outlined"
          onPress={() => navigation.navigate('EditRecall', { recallId: recall.id })}
          style={styles.button}
          icon="pencil"
        >
          Edit Recall
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  severityChip: {
    height: 28,
  },
  statusChip: {
    height: 28,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  sectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  batchChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  button: {
    marginBottom: 8,
  },
});

