import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Searchbar,
  FAB,
  ActivityIndicator,
  Badge,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

interface Recall {
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
}

export const RecallListScreen: React.FC = () => {
  const navigation = useNavigation();
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [filteredRecalls, setFilteredRecalls] = useState<Recall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const { subscribe } = useWebSocket();

  useEffect(() => {
    fetchRecalls();

    // Subscribe to real-time recall updates
    const unsubscribe = subscribe('recall:created', handleRecallUpdate);
    const unsubscribe2 = subscribe('recall:updated', handleRecallUpdate);

    return () => {
      unsubscribe();
      unsubscribe2();
    };
  }, []);

  useEffect(() => {
    filterRecalls();
  }, [recalls, searchQuery, filter]);

  const fetchRecalls = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/v2/eda/recalls');
      setRecalls(response.data.recalls);
    } catch (error) {
      console.error('Error fetching recalls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecallUpdate = (data: any) => {
    setRecalls(prev => {
      const index = prev.findIndex(r => r.id === data.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = data;
        return updated;
      }
      return [data, ...prev];
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecalls();
    setRefreshing(false);
  };

  const filterRecalls = () => {
    let filtered = recalls;

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(r => r.status === filter);
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        r =>
          r.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.reason.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredRecalls(filtered);
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

  const renderRecallCard = ({ item }: { item: Recall }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('RecallDetails', { recallId: item.id })}
    >
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text style={styles.medicineName}>{item.medicine_name}</Text>
            <Chip
              mode="flat"
              style={[
                styles.severityChip,
                { backgroundColor: getSeverityColor(item.severity) },
              ]}
              textStyle={styles.chipText}
            >
              {item.severity.toUpperCase()}
            </Chip>
          </View>

          <Text style={styles.reason} numberOfLines={2}>
            {item.reason}
          </Text>

          <View style={styles.cardFooter}>
            <Chip
              mode="outlined"
              style={[styles.statusChip, { borderColor: getStatusColor(item.status) }]}
              textStyle={{ color: getStatusColor(item.status) }}
            >
              {item.status}
            </Chip>

            <View style={styles.metaInfo}>
              <Text style={styles.metaText}>
                Batches: {item.affected_batches.length}
              </Text>
              <Text style={styles.metaText}>
                Notified: {item.notifications_sent}
              </Text>
            </View>
          </View>

          <Text style={styles.dateText}>
            Initiated: {new Date(item.initiated_date).toLocaleDateString()}
          </Text>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search recalls..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      <View style={styles.filterContainer}>
        <Chip
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
          style={styles.filterChip}
        >
          All
        </Chip>
        <Chip
          selected={filter === 'active'}
          onPress={() => setFilter('active')}
          style={styles.filterChip}
        >
          Active
          {recalls.filter(r => r.status === 'active').length > 0 && (
            <Badge style={styles.badge}>
              {recalls.filter(r => r.status === 'active').length}
            </Badge>
          )}
        </Chip>
        <Chip
          selected={filter === 'completed'}
          onPress={() => setFilter('completed')}
          style={styles.filterChip}
        >
          Completed
        </Chip>
      </View>

      <FlatList
        data={filteredRecalls}
        renderItem={renderRecallCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recalls found</Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateRecall')}
      />
    </View>
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
  searchBar: {
    margin: 16,
    elevation: 2,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  badge: {
    marginLeft: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  medicineName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  severityChip: {
    height: 24,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  reason: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusChip: {
    height: 28,
  },
  metaInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});

