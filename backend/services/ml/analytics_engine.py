# File: backend/services/ml/analytics_engine.py
# Purpose: Machine learning powered analytics for adverse events

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
from datetime import datetime, timedelta
import joblib
import json
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class MLAnalyticsEngine:
    """
    Machine Learning Analytics Engine for:
    - Adverse event pattern detection
    - Safety signal identification
    - Anomaly detection
    - Risk prediction
    """
    
    def __init__(self):
        self.anomaly_detector = None
        self.risk_classifier = None
        self.scaler = StandardScaler()
        self.load_models()
    
    def load_models(self):
        """Load pre-trained models or initialize new ones"""
        try:
            self.anomaly_detector = joblib.load('models/anomaly_detector.pkl')
            self.risk_classifier = joblib.load('models/risk_classifier.pkl')
            self.scaler = joblib.load('models/scaler.pkl')
            logger.info("ML models loaded successfully")
        except FileNotFoundError:
            logger.warning("Pre-trained models not found, initializing new models")
            self.initialize_models()
    
    def initialize_models(self):
        """Initialize new ML models"""
        self.anomaly_detector = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100
        )
        
        self.risk_classifier = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
    
    def detect_adverse_event_patterns(self, events: List[Dict]) -> Dict[str, Any]:
        """
        Detect patterns in adverse events using clustering
        
        Args:
            events: List of adverse event records
            
        Returns:
            Dictionary with detected patterns and insights
        """
        if len(events) < 10:
            return {
                'patterns': [],
                'message': 'Insufficient data for pattern detection'
            }
        
        # Convert to DataFrame
        df = pd.DataFrame(events)
        
        # Extract features
        features = self._extract_event_features(df)
        
        # Normalize features
        features_normalized = self.scaler.fit_transform(features)
        
        # Cluster events using DBSCAN
        clustering = DBSCAN(eps=0.5, min_samples=5)
        clusters = clustering.fit_predict(features_normalized)
        
        # Analyze clusters
        patterns = []
        for cluster_id in set(clusters):
            if cluster_id == -1:  # Skip noise
                continue
            
            cluster_events = df[clusters == cluster_id]
            pattern = self._analyze_cluster(cluster_events, cluster_id)
            patterns.append(pattern)
        
        return {
            'patterns': patterns,
            'total_clusters': len(set(clusters)) - (1 if -1 in clusters else 0),
            'noise_points': sum(clusters == -1),
            'timestamp': datetime.now().isoformat()
        }
    
    def _extract_event_features(self, df: pd.DataFrame) -> np.ndarray:
        """Extract numerical features from adverse events"""
        features = []
        
        for _, row in df.iterrows():
            feature_vector = [
                self._encode_severity(row.get('severity', 'mild')),
                self._encode_outcome(row.get('outcome', 'unknown')),
                self._encode_age_group(row.get('patient_age', 0)),
                1 if row.get('required_hospitalization') else 0,
                1 if row.get('life_threatening') else 0,
                len(row.get('symptoms', [])),
                (datetime.now() - pd.to_datetime(row.get('event_date'))).days,
            ]
            features.append(feature_vector)
        
        return np.array(features)
    
    def _encode_severity(self, severity: str) -> int:
        """Encode severity as numerical value"""
        mapping = {'mild': 1, 'moderate': 2, 'severe': 3, 'life_threatening': 4}
        return mapping.get(severity.lower(), 2)
    
    def _encode_outcome(self, outcome: str) -> int:
        """Encode outcome as numerical value"""
        mapping = {
            'recovered': 1,
            'recovering': 2,
            'not_recovered': 3,
            'death': 4,
            'unknown': 0
        }
        return mapping.get(outcome.lower(), 0)
    
    def _encode_age_group(self, age: int) -> int:
        """Encode age into age groups"""
        if age < 18:
            return 1  # Pediatric
        elif age < 65:
            return 2  # Adult
        else:
            return 3  # Elderly
    
    def _analyze_cluster(self, cluster_events: pd.DataFrame, cluster_id: int) -> Dict:
        """Analyze a cluster of events to identify patterns"""
        return {
            'cluster_id': cluster_id,
            'size': len(cluster_events),
            'common_severity': cluster_events['severity'].mode().iloc[0] if 'severity' in cluster_events else None,
            'common_outcome': cluster_events['outcome'].mode().iloc[0] if 'outcome' in cluster_events else None,
            'avg_age': cluster_events['patient_age'].mean() if 'patient_age' in cluster_events else None,
            'medicines': cluster_events['medicine_name'].value_counts().head(5).to_dict() if 'medicine_name' in cluster_events else {},
            'common_symptoms': self._get_common_symptoms(cluster_events),
            'time_range': {
                'start': cluster_events['event_date'].min() if 'event_date' in cluster_events else None,
                'end': cluster_events['event_date'].max() if 'event_date' in cluster_events else None,
            }
        }
    
    def _get_common_symptoms(self, events: pd.DataFrame) -> List[str]:
        """Extract most common symptoms from events"""
        all_symptoms = []
        for symptoms in events.get('symptoms', []):
            if isinstance(symptoms, list):
                all_symptoms.extend(symptoms)
        
        symptom_counts = pd.Series(all_symptoms).value_counts()
        return symptom_counts.head(5).index.tolist()
    
    def detect_safety_signals(self, medicine_id: str, events: List[Dict]) -> Dict[str, Any]:
        """
        Detect safety signals for a specific medicine
        
        Safety signal: Unusual pattern of adverse events that may indicate
        a previously unknown risk
        """
        if len(events) < 5:
            return {
                'signal_detected': False,
                'message': 'Insufficient data for signal detection'
            }
        
        df = pd.DataFrame(events)
        
        # Calculate key metrics
        severe_event_rate = len(df[df['severity'].isin(['severe', 'life_threatening'])]) / len(df)
        hospitalization_rate = len(df[df['required_hospitalization'] == True]) / len(df)
        death_rate = len(df[df['outcome'] == 'death']) / len(df)
        
        # Time-based analysis
        df['event_date'] = pd.to_datetime(df['event_date'])
        recent_events = df[df['event_date'] >= datetime.now() - timedelta(days=90)]
        recent_severe_rate = len(recent_events[recent_events['severity'].isin(['severe', 'life_threatening'])]) / max(len(recent_events), 1)
        
        # Detect signal based on thresholds and trends
        signal_detected = (
            severe_event_rate > 0.15 or
            hospitalization_rate > 0.10 or
            death_rate > 0.02 or
            recent_severe_rate > severe_event_rate * 1.5  # 50% increase in recent events
        )
        
        if signal_detected:
            signal_type = self._classify_signal_type(severe_event_rate, hospitalization_rate, death_rate, recent_severe_rate)
            
            return {
                'signal_detected': True,
                'medicine_id': medicine_id,
                'signal_type': signal_type,
                'metrics': {
                    'severe_event_rate': round(severe_event_rate, 3),
                    'hospitalization_rate': round(hospitalization_rate, 3),
                    'death_rate': round(death_rate, 3),
                    'recent_severe_rate': round(recent_severe_rate, 3),
                    'total_events': len(df),
                    'recent_events': len(recent_events)
                },
                'recommendation': self._generate_signal_recommendation(signal_type),
                'timestamp': datetime.now().isoformat()
            }
        
        return {
            'signal_detected': False,
            'medicine_id': medicine_id,
            'metrics': {
                'severe_event_rate': round(severe_event_rate, 3),
                'hospitalization_rate': round(hospitalization_rate, 3),
                'death_rate': round(death_rate, 3),
                'total_events': len(df)
            }
        }
    
    def _classify_signal_type(self, severe_rate: float, hosp_rate: float, 
                             death_rate: float, recent_rate: float) -> str:
        """Classify the type of safety signal"""
        if death_rate > 0.02:
            return 'critical'
        elif hosp_rate > 0.15 or recent_rate > 0.3:
            return 'high'
        elif severe_rate > 0.20:
            return 'moderate'
        else:
            return 'low'
    
    def _generate_signal_recommendation(self, signal_type: str) -> str:
        """Generate recommendation based on signal type"""
        recommendations = {
            'critical': 'URGENT: Consider immediate recall or suspension. Convene safety review committee.',
            'high': 'HIGH PRIORITY: Detailed investigation required. Consider risk mitigation measures.',
            'moderate': 'MODERATE: Monitor closely. Review product labeling and prescribing information.',
            'low': 'LOW: Continue monitoring. Consider additional post-market surveillance.'
        }
        return recommendations.get(signal_type, 'Review and monitor.')
    
    def predict_risk_score(self, event_data: Dict) -> Dict[str, Any]:
        """
        Predict risk score for an adverse event
        
        Risk score indicates likelihood of serious outcome
        """
        # Extract features
        features = np.array([[
            self._encode_severity(event_data.get('severity', 'mild')),
            self._encode_age_group(event_data.get('patient_age', 0)),
            1 if event_data.get('required_hospitalization') else 0,
            1 if event_data.get('life_threatening') else 0,
            len(event_data.get('symptoms', [])),
            len(event_data.get('concurrent_medications', [])),
            1 if event_data.get('has_allergies') else 0,
        ]])
        
        # Normalize
        features_normalized = self.scaler.transform(features)
        
        # Predict (if model is trained)
        try:
            risk_probability = self.risk_classifier.predict_proba(features_normalized)[0]
            risk_score = risk_probability[1]  # Probability of high risk
            
            return {
                'risk_score': round(risk_score, 3),
                'risk_level': self._classify_risk_level(risk_score),
                'confidence': round(max(risk_probability), 3),
                'recommendations': self._generate_risk_recommendations(risk_score)
            }
        except:
            # Fallback to rule-based scoring
            rule_based_score = self._calculate_rule_based_risk(event_data)
            return {
                'risk_score': rule_based_score,
                'risk_level': self._classify_risk_level(rule_based_score),
                'method': 'rule_based',
                'recommendations': self._generate_risk_recommendations(rule_based_score)
            }
    
    def _calculate_rule_based_risk(self, event_data: Dict) -> float:
        """Calculate risk score using rules when ML model unavailable"""
        score = 0.0
        
        severity = event_data.get('severity', 'mild').lower()
        if severity == 'life_threatening':
            score += 0.4
        elif severity == 'severe':
            score += 0.3
        elif severity == 'moderate':
            score += 0.15
        
        if event_data.get('required_hospitalization'):
            score += 0.25
        
        if event_data.get('life_threatening'):
            score += 0.2
        
        age = event_data.get('patient_age', 0)
        if age < 5 or age > 75:
            score += 0.1
        
        if len(event_data.get('symptoms', [])) > 5:
            score += 0.1
        
        return min(score, 1.0)
    
    def _classify_risk_level(self, risk_score: float) -> str:
        """Classify risk level from score"""
        if risk_score >= 0.7:
            return 'critical'
        elif risk_score >= 0.5:
            return 'high'
        elif risk_score >= 0.3:
            return 'moderate'
        else:
            return 'low'
    
    def _generate_risk_recommendations(self, risk_score: float) -> List[str]:
        """Generate recommendations based on risk score"""
        if risk_score >= 0.7:
            return [
                'Immediate medical attention required',
                'Consider hospitalization',
                'Report to regulatory authority urgently',
                'Document all symptoms and interventions'
            ]
        elif risk_score >= 0.5:
            return [
                'Close medical monitoring required',
                'Consider discontinuing medication',
                'Report to healthcare provider promptly',
                'Document progression of symptoms'
            ]
        elif risk_score >= 0.3:
            return [
                'Monitor symptoms closely',
                'Contact healthcare provider if symptoms worsen',
                'Report event to regulatory authority',
                'Keep detailed symptom diary'
            ]
        else:
            return [
                'Continue monitoring',
                'Report if symptoms persist or worsen',
                'Document event details'
            ]
    
    def detect_anomalies(self, events: List[Dict]) -> Dict[str, Any]:
        """
        Detect anomalous adverse events that deviate from normal patterns
        """
        if len(events) < 20:
            return {
                'anomalies': [],
                'message': 'Insufficient data for anomaly detection'
            }
        
        df = pd.DataFrame(events)
        features = self._extract_event_features(df)
        features_normalized = self.scaler.fit_transform(features)
        
        # Detect anomalies
        predictions = self.anomaly_detector.fit_predict(features_normalized)
        anomaly_scores = self.anomaly_detector.score_samples(features_normalized)
        
        # Get anomalous events
        anomalies = []
        for idx, (prediction, score) in enumerate(zip(predictions, anomaly_scores)):
            if prediction == -1:  # Anomaly
                event = events[idx]
                anomalies.append({
                    'event_id': event.get('id'),
                    'medicine_name': event.get('medicine_name'),
                    'severity': event.get('severity'),
                    'anomaly_score': float(score),
                    'reason': self._explain_anomaly(event, df)
                })
        
        return {
            'total_events': len(events),
            'anomalies_detected': len(anomalies),
            'anomaly_rate': round(len(anomalies) / len(events), 3),
            'anomalies': sorted(anomalies, key=lambda x: x['anomaly_score'])[:10],  # Top 10
            'timestamp': datetime.now().isoformat()
        }
    
    def _explain_anomaly(self, event: Dict, all_events: pd.DataFrame) -> str:
        """Explain why an event is anomalous"""
        reasons = []
        
        # Compare to average
        if event.get('patient_age'):
            avg_age = all_events['patient_age'].mean()
            if abs(event['patient_age'] - avg_age) > 20:
                reasons.append(f"Unusual age ({event['patient_age']} vs avg {avg_age:.0f})")
        
        severity = event.get('severity', '').lower()
        if severity == 'life_threatening':
            reasons.append("Life-threatening severity")
        
        if event.get('outcome') == 'death':
            reasons.append("Fatal outcome")
        
        if len(event.get('symptoms', [])) > 8:
            reasons.append(f"High number of symptoms ({len(event.get('symptoms', []))})")
        
        return '; '.join(reasons) if reasons else 'Statistical outlier'
    
    def train_models(self, training_data: List[Dict]):
        """
        Train ML models with historical data
        """
        df = pd.DataFrame(training_data)
        
        # Extract features
        X = self._extract_event_features(df)
        
        # Create labels for risk classification (high risk = severe/life-threatening + hospitalization)
        y = ((df['severity'].isin(['severe', 'life_threatening'])) | 
             (df['required_hospitalization'] == True)).astype(int)
        
        # Train anomaly detector
        X_normalized = self.scaler.fit_transform(X)
        self.anomaly_detector.fit(X_normalized)
        
        # Train risk classifier
        self.risk_classifier.fit(X_normalized, y)
        
        # Save models
        joblib.dump(self.anomaly_detector, 'models/anomaly_detector.pkl')
        joblib.dump(self.risk_classifier, 'models/risk_classifier.pkl')
        joblib.dump(self.scaler, 'models/scaler.pkl')
        
        logger.info("ML models trained and saved successfully")
        
        return {
            'training_samples': len(df),
            'anomaly_detector_trained': True,
            'risk_classifier_trained': True,
            'risk_classifier_accuracy': self.risk_classifier.score(X_normalized, y)
        }

# Initialize engine
ml_engine = MLAnalyticsEngine()