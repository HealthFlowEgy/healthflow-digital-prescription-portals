// File: backend/services/interactions/drugInteraction.service.ts
// Purpose: Check for drug-drug and drug-food interactions

import { db } from '../../shared/database/connection';
import { logger } from '../../shared/utils/logger';
import { cache } from '../../shared/cache/redis';

export interface Medication {
  id: string;
  name: string;
  scientificName: string;
  activeIngredients: string[];
}

export interface Interaction {
  id: string;
  drug1: string;
  drug2: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  clinicalEffects: string[];
  mechanism: string;
  management: string;
  evidence: 'theoretical' | 'fair' | 'good' | 'excellent';
  references: string[];
}

export interface InteractionCheckResult {
  hasInteractions: boolean;
  interactionCount: number;
  interactions: InteractionDetail[];
  riskScore: number;
  recommendations: string[];
}

export interface InteractionDetail {
  interaction: Interaction;
  affectedMedications: string[];
  riskLevel: string;
  priority: number;
}

export class DrugInteractionService {
  /**
   * Check for interactions between multiple medications
   */
  static async checkInteractions(medications: Medication[]): Promise<InteractionCheckResult> {
    if (medications.length < 2) {
      return {
        hasInteractions: false,
        interactionCount: 0,
        interactions: [],
        riskScore: 0,
        recommendations: [],
      };
    }

    const cacheKey = this.getCacheKey(medications);
    const cached = await cache.get<InteractionCheckResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const interactions: InteractionDetail[] = [];

    // Check each pair of medications
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const pairInteractions = await this.checkPairInteraction(
          medications[i],
          medications[j]
        );
        interactions.push(...pairInteractions);
      }
    }

    // Sort by severity and priority
    interactions.sort((a, b) => b.priority - a.priority);

    const result: InteractionCheckResult = {
      hasInteractions: interactions.length > 0,
      interactionCount: interactions.length,
      interactions,
      riskScore: this.calculateRiskScore(interactions),
      recommendations: this.generateRecommendations(interactions),
    };

    // Cache for 1 hour
    await cache.set(cacheKey, result, 3600);

    return result;
  }

  /**
   * Check interaction between two medications
   */
  private static async checkPairInteraction(
    med1: Medication,
    med2: Medication
  ): Promise<InteractionDetail[]> {
    const interactions: InteractionDetail[] = [];

    // Check direct drug-drug interactions
    const directInteractions = await db('portal.drug_interactions')
      .where(function() {
        this.where({ drug1_id: med1.id, drug2_id: med2.id })
            .orWhere({ drug1_id: med2.id, drug2_id: med1.id });
      });

    for (const interaction of directInteractions) {
      interactions.push({
        interaction: this.mapToInteraction(interaction),
        affectedMedications: [med1.name, med2.name],
        riskLevel: this.getRiskLevel(interaction.severity),
        priority: this.calculatePriority(interaction),
      });
    }

    // Check ingredient-level interactions
    for (const ingredient1 of med1.activeIngredients) {
      for (const ingredient2 of med2.activeIngredients) {
        const ingredientInteractions = await db('portal.ingredient_interactions')
          .where(function() {
            this.where({ ingredient1, ingredient2 })
                .orWhere({ ingredient1: ingredient2, ingredient2: ingredient1 });
          });

        for (const interaction of ingredientInteractions) {
          interactions.push({
            interaction: this.mapIngredientInteraction(interaction),
            affectedMedications: [med1.name, med2.name],
            riskLevel: this.getRiskLevel(interaction.severity),
            priority: this.calculatePriority(interaction),
          });
        }
      }
    }

    return interactions;
  }

  /**
   * Check for food interactions
   */
  static async checkFoodInteractions(medications: Medication[]): Promise<any[]> {
    const foodInteractions: any[] = [];

    for (const med of medications) {
      const interactions = await db('portal.drug_food_interactions')
        .where({ medicine_id: med.id });

      for (const interaction of interactions) {
        foodInteractions.push({
          medication: med.name,
          food: interaction.food_item,
          effect: interaction.effect,
          severity: interaction.severity,
          management: interaction.management,
        });
      }
    }

    return foodInteractions;
  }

  /**
   * Check for alcohol interactions
   */
  static async checkAlcoholInteractions(medications: Medication[]): Promise<any[]> {
    const alcoholInteractions: any[] = [];

    for (const med of medications) {
      const interaction = await db('portal.drug_alcohol_interactions')
        .where({ medicine_id: med.id })
        .first();

      if (interaction) {
        alcoholInteractions.push({
          medication: med.name,
          severity: interaction.severity,
          effects: interaction.effects,
          recommendation: interaction.recommendation,
        });
      }
    }

    return alcoholInteractions;
  }

  /**
   * Get clinical decision support
   */
  static async getClinicalDecisionSupport(
    patientData: any,
    medications: Medication[]
  ): Promise<any> {
    const interactions = await this.checkInteractions(medications);
    const foodInteractions = await this.checkFoodInteractions(medications);
    const alcoholInteractions = await this.checkAlcoholInteractions(medications);

    // Check patient-specific risk factors
    const patientRiskFactors = this.assessPatientRiskFactors(patientData);

    // Generate clinical recommendations
    const clinicalRecommendations = this.generateClinicalRecommendations(
      interactions,
      foodInteractions,
      alcoholInteractions,
      patientRiskFactors
    );

    return {
      drugInteractions: interactions,
      foodInteractions,
      alcoholInteractions,
      patientRiskFactors,
      overallRiskLevel: this.calculateOverallRisk(
        interactions.riskScore,
        patientRiskFactors.score
      ),
      clinicalRecommendations,
      requiresPharmacistReview: this.requiresPharmacistReview(interactions),
      requiresDoctorConsultation: this.requiresDoctorConsultation(interactions),
    };
  }

  /**
   * Assess patient-specific risk factors
   */
  private static assessPatientRiskFactors(patientData: any): any {
    const riskFactors = [];
    let score = 0;

    if (patientData.age >= 65) {
      riskFactors.push('Elderly patient - increased risk of adverse effects');
      score += 15;
    }

    if (patientData.age < 18) {
      riskFactors.push('Pediatric patient - requires dose adjustment');
      score += 10;
    }

    if (patientData.renalImpairment) {
      riskFactors.push('Renal impairment - drug clearance may be affected');
      score += 20;
    }

    if (patientData.hepaticImpairment) {
      riskFactors.push('Hepatic impairment - drug metabolism may be affected');
      score += 20;
    }

    if (patientData.pregnant) {
      riskFactors.push('Pregnancy - teratogenic risk consideration');
      score += 25;
    }

    if (patientData.breastfeeding) {
      riskFactors.push('Breastfeeding - infant exposure consideration');
      score += 15;
    }

    if (patientData.allergies && patientData.allergies.length > 0) {
      riskFactors.push(`Known allergies: ${patientData.allergies.join(', ')}`);
      score += 10;
    }

    return {
      factors: riskFactors,
      score,
      level: score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low',
    };
  }

  /**
   * Calculate risk score from interactions
   */
  private static calculateRiskScore(interactions: InteractionDetail[]): number {
    let score = 0;

    for (const detail of interactions) {
      switch (detail.interaction.severity) {
        case 'contraindicated':
          score += 100;
          break;
        case 'major':
          score += 50;
          break;
        case 'moderate':
          score += 25;
          break;
        case 'minor':
          score += 10;
          break;
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate overall risk combining drug interactions and patient factors
   */
  private static calculateOverallRisk(
    interactionScore: number,
    patientScore: number
  ): string {
    const totalScore = interactionScore + patientScore;

    if (totalScore >= 75) return 'critical';
    if (totalScore >= 50) return 'high';
    if (totalScore >= 25) return 'moderate';
    return 'low';
  }

  /**
   * Generate recommendations based on interactions
   */
  private static generateRecommendations(interactions: InteractionDetail[]): string[] {
    const recommendations: string[] = [];

    const contraindicated = interactions.filter(
      i => i.interaction.severity === 'contraindicated'
    );
    const major = interactions.filter(i => i.interaction.severity === 'major');

    if (contraindicated.length > 0) {
      recommendations.push(
        '⛔ CONTRAINDICATED: Do not use these medications together. Alternative therapy required.'
      );
    }

    if (major.length > 0) {
      recommendations.push(
        '⚠️ MAJOR INTERACTION: Close monitoring required. Consider alternative therapy or dose adjustment.'
      );
    }

    // Add specific management for each interaction
    for (const detail of interactions.slice(0, 5)) {
      if (detail.interaction.management) {
        recommendations.push(`• ${detail.interaction.management}`);
      }
    }

    return recommendations;
  }

  /**
   * Generate clinical recommendations
   */
  private static generateClinicalRecommendations(
    drugInteractions: InteractionCheckResult,
    foodInteractions: any[],
    alcoholInteractions: any[],
    patientRiskFactors: any
  ): string[] {
    const recommendations: string[] = [];

    // Drug interaction recommendations
    recommendations.push(...drugInteractions.recommendations);

    // Food interaction recommendations
    if (foodInteractions.length > 0) {
      recommendations.push('📋 Dietary Restrictions:');
      foodInteractions.forEach(fi => {
        recommendations.push(`  • Avoid ${fi.food} with ${fi.medication}`);
      });
    }

    // Alcohol recommendations
    if (alcoholInteractions.length > 0) {
      recommendations.push('🍷 Alcohol Restrictions:');
      alcoholInteractions.forEach(ai => {
        recommendations.push(`  • ${ai.recommendation} (${ai.medication})`);
      });
    }

    // Patient-specific recommendations
    if (patientRiskFactors.level === 'high') {
      recommendations.push('👤 Patient Risk Factors:');
      patientRiskFactors.factors.forEach((factor: string) => {
        recommendations.push(`  • ${factor}`);
      });
    }

    return recommendations;
  }

  /**
   * Check if pharmacist review is required
   */
  private static requiresPharmacistReview(interactions: InteractionCheckResult): boolean {
    return (
      interactions.riskScore >= 50 ||
      interactions.interactions.some(i => i.interaction.severity === 'major')
    );
  }

  /**
   * Check if doctor consultation is required
   */
  private static requiresDoctorConsultation(interactions: InteractionCheckResult): boolean {
    return (
      interactions.riskScore >= 75 ||
      interactions.interactions.some(i => i.interaction.severity === 'contraindicated')
    );
  }

  /**
   * Helper methods
   */
  private static getCacheKey(medications: Medication[]): string {
    const ids = medications.map(m => m.id).sort().join(',');
    return `interactions:${ids}`;
  }

  private static mapToInteraction(row: any): Interaction {
    return {
      id: row.id,
      drug1: row.drug1_name,
      drug2: row.drug2_name,
      severity: row.severity,
      description: row.description,
      clinicalEffects: row.clinical_effects || [],
      mechanism: row.mechanism,
      management: row.management,
      evidence: row.evidence_level,
      references: row.references || [],
    };
  }

  private static mapIngredientInteraction(row: any): Interaction {
    return {
      id: row.id,
      drug1: row.ingredient1,
      drug2: row.ingredient2,
      severity: row.severity,
      description: row.description,
      clinicalEffects: row.clinical_effects || [],
      mechanism: row.mechanism || 'Ingredient-level interaction',
      management: row.management,
      evidence: row.evidence_level || 'fair',
      references: row.references || [],
    };
  }

  private static getRiskLevel(severity: string): string {
    const mapping: any = {
      contraindicated: 'critical',
      major: 'high',
      moderate: 'moderate',
      minor: 'low',
    };
    return mapping[severity] || 'unknown';
  }

  private static calculatePriority(interaction: any): number {
    const severityScore: any = {
      contraindicated: 100,
      major: 75,
      moderate: 50,
      minor: 25,
    };

    const evidenceScore: any = {
      excellent: 20,
      good: 15,
      fair: 10,
      theoretical: 5,
    };

    return (
      (severityScore[interaction.severity] || 0) +
      (evidenceScore[interaction.evidence_level] || 0)
    );
  }
}