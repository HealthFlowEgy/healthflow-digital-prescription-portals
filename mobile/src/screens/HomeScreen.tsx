// File: mobile/src/screens/Home/HomeScreen.tsx
// Purpose: Main dashboard with quick actions and stats

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Avatar,
  Text,
  Button,
  Badge,
  Chip,
  ActivityIndicator,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';

interface DashboardStats {
  activeMedicines: number;
  activeRecalls: number;
  recentAdverseEvents: number;
  unreadNotifications: number;
}

const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const { connected, notifications } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [userName, setUserName] = useState('');
  const [recentRecalls, setRecentRecalls] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const profile = await apiClient.getProfile();
      setUserName(profile.name);
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [dashboardData, recalls] = await Promise.all([
        apiClient.getDashboardStats(),
        apiClient.getRecalls({ limit: 3 }),
      ]);

      setStats(dashboardData);
      setRecentRecalls(recalls.items || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const QuickActionCard = ({ icon, title, onPress, color = '#1976d2' }: any) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <Avatar.Icon size={56} icon={icon} style={{ backgroundColor: color }} />
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  const StatCard = ({ icon, value, label, color }: any) => (
    <Card style={styles.statCard}>
      <Card.Content style={styles.statContent}>
        <View style={styles.statIcon}>
          <Icon name={icon} size={32} color={color} />
        </View>
        <View style={styles.statInfo}>
          <Title style={styles.statValue}>{value}</Title>
          <Paragraph style={styles.statLabel}>{label}</Paragraph>
        </View>
      </Card.Content>
    </Card>
  );

  const RecallItem = ({ recall }: any) => (
    <Card
      style={styles.recallCard}
      onPress={() => navigation.navigate('RecallDetail', { id: recall.id })}
    >
      <Card.Content>
        <View style={styles.recallHeader}>
          <Chip
            icon="alert-circle"
            style={[
              styles.severityChip,
              { backgroundColor: getSeverityColor(recall.severity) },
            ]}
            textStyle={{ color: 'white' }}
          >
            {recall.severity}
          </Chip>
          <Text style={styles.recallDate}>
            {new Date(recall.recall_date).toLocaleDateString()}
          </Text>
        </View>
        <Title style={styles.recallTitle}>{recall.medicine_name}</Title>
        <Paragraph numberOfLines={2}>{recall.reason}</Paragraph>
      </Card.Content>
    </Card>
  );

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'class_1':
        return '#d32f2f';
      case 'class_2':
        return '#ed6c02';
      case 'class_3':
        return '#fbc02d';
      default:
        return '#757575';
    }
  };

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good Morning</Text>
          <Title style={styles.userName}>{userName}</Title>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
          <View>
            <Icon name="bell-outline" size={28} color="#333" />
            {stats && stats.unreadNotifications > 0 && (
              <Badge style={styles.badge}>{stats.unreadNotifications}</Badge>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Connection Status */}
      {!connected && (
        <Card style={styles.offlineCard}>
          <Card.Content style={styles.offlineContent}>
            <Icon name="wifi-off" size={20} color="#ed6c02" />
            <Text style={styles.offlineText}>Working offline</Text>
          </Card.Content>
        </Card>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsContainer}>
          <QuickActionCard
            icon="magnify"
            title="Search Medicine"
            onPress={() => navigation.navigate('Search')}
          />
          <QuickActionCard
            icon="qrcode-scan"
            title="Scan Code"
            onPress={() => navigation.navigate('Scanner')}
            color="#2e7d32"
          />
          <QuickActionCard
            icon="alert"
            title="Report Event"
            onPress={() => navigation.navigate('AdverseEvent')}
            color="#d32f2f"
          />
          <QuickActionCard
            icon="bell-alert"
            title="View Recalls"
            onPress={() => navigation.navigate('Recalls')}
            color="#ed6c02"
          />
        </View>
      </View>

      {/* Statistics */}
      {stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="pill"
              value={stats.activeMedicines.toLocaleString()}
              label="Active Medicines"
              color="#1976d2"
            />
            <StatCard
              icon="alert-circle"
              value={stats.activeRecalls}
              label="Active Recalls"
              color="#d32f2f"
            />
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              icon="file-document-alert"
              value={stats.recentAdverseEvents}
              label="Recent Events"
              color="#ed6c02"
            />
            <StatCard
              icon="bell"
              value={stats.unreadNotifications}
              label="Notifications"
              color="#2e7d32"
            />
          </View>
        </View>
      )}

      {/* Recent Recalls */}
      {recentRecalls.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Recalls</Text>
            <Button
              mode="text"
              onPress={() => navigation.navigate('Recalls')}
              compact
            >
              View All
            </Button>
          </View>
          {recentRecalls.map((recall) => (
            <RecallItem key={recall.id} recall={recall} />
          ))}
        </View>
      )}

      {/* Safety Tips */}
      <Card style={styles.tipsCard}>
        <Card.Content>
          <Title style={styles.tipsTitle}>💡 Safety Tip</Title>
          <Paragraph>
            Always check medicine expiration dates and store medications in a cool, dry
            place away from direct sunlight.
          </Paragraph>
        </Card.Content>
      </Card>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#d32f2f',
  },
  offlineCard: {
    margin: 16,
    backgroundColor: '#fff3e0',
  },
  offlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineText: {
    color: '#ed6c02',
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    elevation: 2,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    marginRight: 12,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  recallCard: {
    marginBottom: 12,
    elevation: 2,
  },
  recallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  severityChip: {
    height: 28,
  },
  recallDate: {
    fontSize: 12,
    color: '#666',
  },
  recallTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tipsCard: {
    margin: 16,
    backgroundColor: '#e3f2fd',
    elevation: 2,
  },
  tipsTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  bottomPadding: {
    height: 24,
  },
});

export default HomeScreen;