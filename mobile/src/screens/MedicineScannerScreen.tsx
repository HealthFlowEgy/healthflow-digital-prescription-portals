// File: mobile/src/screens/Scanner/ScannerScreen.tsx
// Purpose: QR/Barcode scanner for medicine lookup

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import {
  Text,
  Button,
  Portal,
  Modal,
  Card,
  Title,
  Paragraph,
  ActivityIndicator,
} from 'react-native-paper';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { RNCamera } from 'react-native-camera';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api';

const ScannerScreen = () => {
  const navigation = useNavigation<any>();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    checkCameraPermission();
  }, []);

  const checkCameraPermission = async () => {
    const permission = Platform.OS === 'ios' 
      ? PERMISSIONS.IOS.CAMERA 
      : PERMISSIONS.ANDROID.CAMERA;

    const result = await check(permission);

    if (result === RESULTS.GRANTED) {
      setHasPermission(true);
    } else if (result === RESULTS.DENIED) {
      const requestResult = await request(permission);
      setHasPermission(requestResult === RESULTS.GRANTED);
    } else {
      setHasPermission(false);
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera access in settings to use the scanner.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleScan = async (scanResult: any) => {
    if (!scanning) return;

    setScanning(false);
    setLoading(true);

    try {
      const code = scanResult.data;
      
      // Parse the scanned code (could be EDA number, barcode, or QR code)
      let medicineData;

      if (code.startsWith('EDA-')) {
        // EDA number format
        medicineData = await apiClient.getMedicine(code);
      } else if (code.length === 13 || code.length === 12) {
        // Barcode format (EAN-13 or UPC)
        const searchResults = await apiClient.searchMedicines('', { barcode: code });
        if (searchResults.length > 0) {
          medicineData = searchResults[0];
        } else {
          throw new Error('Medicine not found');
        }
      } else {
        // Try to parse as JSON (QR code with medicine info)
        try {
          const qrData = JSON.parse(code);
          if (qrData.edaNumber) {
            medicineData = await apiClient.getMedicine(qrData.edaNumber);
          } else {
            throw new Error('Invalid QR code format');
          }
        } catch {
          throw new Error('Invalid code format');
        }
      }

      setScannedData(medicineData);
      setShowResult(true);
    } catch (error: any) {
      Alert.alert(
        'Scan Failed',
        error.message || 'Could not find medicine information',
        [
          {
            text: 'Try Again',
            onPress: () => {
              setScanning(true);
              setLoading(false);
            },
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = () => {
    setShowResult(false);
    navigation.navigate('MedicineDetail', { 
      id: scannedData.id,
      medicine: scannedData 
    });
  };

  const handleScanAnother = () => {
    setShowResult(false);
    setScannedData(null);
    setScanning(true);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Checking camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Camera permission not granted</Text>
        <Button mode="contained" onPress={checkCameraPermission} style={styles.button}>
          Request Permission
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <QRCodeScanner
        onRead={handleScan}
        reactivate={scanning}
        reactivateTimeout={2000}
        showMarker
        markerStyle={styles.marker}
        cameraStyle={styles.camera}
        topContent={
          <View style={styles.topContent}>
            <Title style={styles.title}>Scan Medicine Code</Title>
            <Paragraph style={styles.subtitle}>
              Scan QR code, barcode, or EDA number
            </Paragraph>
          </View>
        }
        bottomContent={
          <View style={styles.bottomContent}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1976d2" />
                <Text style={styles.loadingText}>Looking up medicine...</Text>
              </View>
            )}
            
            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              style={styles.button}
            >
              Cancel
            </Button>
          </View>
        }
        flashMode={RNCamera.Constants.FlashMode.auto}
      />

      {/* Result Modal */}
      <Portal>
        <Modal
          visible={showResult}
          onDismiss={handleScanAnother}
          contentContainerStyle={styles.modal}
        >
          <Card>
            <Card.Content>
              <View style={styles.modalHeader}>
                <View style={styles.successIcon}>
                  <Text style={styles.successIconText}>✓</Text>
                </View>
                <Title style={styles.modalTitle}>Medicine Found!</Title>
              </View>

              {scannedData && (
                <View style={styles.medicineInfo}>
                  <Text style={styles.medicineLabel}>Trade Name</Text>
                  <Title style={styles.medicineName}>{scannedData.trade_name}</Title>

                  <Text style={styles.medicineLabel}>Scientific Name</Text>
                  <Paragraph>{scannedData.scientific_name}</Paragraph>

                  <Text style={styles.medicineLabel}>Manufacturer</Text>
                  <Paragraph>{scannedData.manufacturer}</Paragraph>

                  <Text style={styles.medicineLabel}>EDA Number</Text>
                  <Paragraph>{scannedData.eda_number}</Paragraph>

                  {scannedData.status === 'recalled' && (
                    <View style={styles.warningBanner}>
                      <Text style={styles.warningText}>
                        ⚠️ This medicine has been recalled
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Card.Content>
            <Card.Actions>
              <Button onPress={handleScanAnother}>Scan Another</Button>
              <Button mode="contained" onPress={handleViewDetails}>
                View Details
              </Button>
            </Card.Actions>
          </Card>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  camera: {
    height: '100%',
  },
  marker: {
    borderColor: '#1976d2',
    borderWidth: 2,
  },
  topContent: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
  },
  bottomContent: {
    padding: 20,
    width: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    marginTop: 12,
  },
  modal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2e7d32',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successIconText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  medicineInfo: {
    marginTop: 16,
  },
  medicineLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  medicineName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  warningBanner: {
    backgroundColor: '#fff3e0',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ed6c02',
  },
  warningText: {
    color: '#ed6c02',
    fontWeight: 'bold',
  },
});

export default ScannerScreen;