// File: mobile/src/screens/Auth/LoginScreen.tsx
// Purpose: Login screen with biometric authentication

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Title,
  Subheading,
  HelperText,
  ActivityIndicator,
  IconButton,
} from 'react-native-paper';
import { Formik } from 'formik';
import * as Yup from 'yup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../services/api';

const LoginSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
});

const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkBiometrics();
    checkAutoLogin();
  }, []);

  const checkBiometrics = async () => {
    const rnBiometrics = new ReactNativeBiometrics();
    const { available, biometryType } = await rnBiometrics.isSensorAvailable();
    setBiometricsAvailable(available);
  };

  const checkAutoLogin = async () => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      // Verify token is still valid
      try {
        await apiClient.getProfile();
        navigation.replace('Main');
      } catch (error) {
        // Token expired, stay on login
      }
    }
  };

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await apiClient.login(values.email, values.password);
      
      // Ask to enable biometrics
      if (biometricsAvailable) {
        Alert.alert(
          'Enable Biometric Login',
          'Would you like to use fingerprint/face recognition for faster login?',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Enable',
              onPress: async () => {
                await AsyncStorage.setItem('biometricsEnabled', 'true');
                await AsyncStorage.setItem('savedEmail', values.email);
              },
            },
          ]
        );
      }

      navigation.replace('Main');
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    const rnBiometrics = new ReactNativeBiometrics();
    
    try {
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: 'Confirm your identity',
      });

      if (success) {
        const savedEmail = await AsyncStorage.getItem('savedEmail');
        const token = await AsyncStorage.getItem('authToken');
        
        if (token) {
          try {
            await apiClient.getProfile();
            navigation.replace('Main');
          } catch (error) {
            Alert.alert('Session Expired', 'Please login again');
          }
        }
      }
    } catch (error) {
      console.error('Biometric error:', error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        
        <Title style={styles.title}>Welcome Back</Title>
        <Subheading style={styles.subtitle}>Login to continue</Subheading>

        <Formik
          initialValues={{ email: '', password: '' }}
          validationSchema={LoginSchema}
          onSubmit={handleLogin}
        >
          {({ handleChange, handleBlur, handleSubmit, values, errors, touched }) => (
            <View style={styles.form}>
              <TextInput
                label="Email"
                mode="outlined"
                value={values.email}
                onChangeText={handleChange('email')}
                onBlur={handleBlur('email')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={touched.email && !!errors.email}
                disabled={loading}
                left={<TextInput.Icon icon="email" />}
              />
              {touched.email && errors.email && (
                <HelperText type="error">{errors.email}</HelperText>
              )}

              <TextInput
                label="Password"
                mode="outlined"
                value={values.password}
                onChangeText={handleChange('password')}
                onBlur={handleBlur('password')}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                error={touched.password && !!errors.password}
                disabled={loading}
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                style={styles.passwordInput}
              />
              {touched.password && errors.password && (
                <HelperText type="error">{errors.password}</HelperText>
              )}

              <Button
                mode="text"
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.forgotPassword}
              >
                Forgot Password?
              </Button>

              <Button
                mode="contained"
                onPress={() => handleSubmit()}
                loading={loading}
                disabled={loading}
                style={styles.loginButton}
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>

              {biometricsAvailable && (
                <IconButton
                  icon="fingerprint"
                  size={48}
                  onPress={handleBiometricLogin}
                  style={styles.biometricButton}
                />
              )}

              <View style={styles.signupContainer}>
                <Text>Don't have an account? </Text>
                <Button
                  mode="text"
                  onPress={() => navigation.navigate('Register')}
                  compact
                >
                  Sign Up
                </Button>
              </View>
            </View>
          )}
        </Formik>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  passwordInput: {
    marginTop: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  loginButton: {
    marginTop: 24,
    paddingVertical: 8,
  },
  biometricButton: {
    alignSelf: 'center',
    marginTop: 16,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
});

export default LoginScreen;