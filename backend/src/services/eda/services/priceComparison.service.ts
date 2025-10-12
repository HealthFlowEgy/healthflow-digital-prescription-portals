// File: backend/services/pricing/priceComparison.service.ts
// Purpose: Multi-pharmacy price comparison and tracking

import { db } from '../../shared/database/connection';
import { logger } from '../../shared/utils/logger';
import { cache } from '../../shared/cache/redis';
import axios from 'axios';

export interface PharmacyPrice {
  pharmacyId: string;
  pharmacyName: string;
  pharmacyLocation: string;
  price: number;
  currency: string;
  inStock: boolean;
  lastUpdated: Date;
  distance?: number; // km from user
  rating?: number;
  deliveryAvailable: boolean;
  deliveryFee?: number;
  estimatedDeliveryTime?: string;
}

export interface PriceComparison {
  medicineId: string;
  medicineName: string;
  prices: PharmacyPrice[];
  lowestPrice: PharmacyPrice;
  highestPrice: PharmacyPrice;
  averagePrice: number;
  priceRange: number;
  savingsOpportunity: number;
  priceHistory?: PriceHistoryPoint[];
}

export interface PriceHistoryPoint {
  date: Date;
  price: number;
  pharmacyId: string;
}

export interface PriceAlert {
  id: string;
  userId: string;
  medicineId: string;
  targetPrice: number;
  currentLowestPrice: number;
  isActive: boolean;
}

export class PriceComparisonService {
  /**
   * Compare prices across multiple pharmacies
   */
  static async comparePrices(
    medicineId: string,
    userLocation?: { lat: number; lng: number }
  ): Promise<PriceComparison> {
    const cacheKey = `prices:${medicineId}:${userLocation?.lat},${userLocation?.lng}`;
    const cached = await cache.get<PriceComparison>(cacheKey);
    
    if (cached) {
      return cached;
    }

    // Get medicine details
    const medicine = await db('portal.medicines')
      .where({ id: medicineId })
      .first();

    if (!medicine) {
      throw new Error('Medicine not found');
    }

    // Get prices from all pharmacies
    let prices = await this.fetchPricesFromPharmacies(medicineId);

    // Calculate distances if user location provided
    if (userLocation) {
      prices = await this.calculateDistances(prices, userLocation);
      prices = prices.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    } else {
      prices = prices.sort((a, b) => a.price - b.price);
    }

    // Filter out of stock items (but keep at least 3 results)
    const inStockPrices = prices.filter(p => p.inStock);
    if (inStockPrices.length >= 3) {
      prices = inStockPrices;
    }

    // Calculate statistics
    const pricesArray = prices.map(p => p.price);
    const lowestPrice = prices[0];
    const highestPrice = prices[prices.length - 1];
    const averagePrice = pricesArray.reduce((a, b) => a + b, 0) / pricesArray.length;
    const priceRange = highestPrice.price - lowestPrice.price;
    const savingsOpportunity = highestPrice.price - lowestPrice.price;

    // Get price history
    const priceHistory = await this.getPriceHistory(medicineId, 30);

    const comparison: PriceComparison = {
      medicineId,
      medicineName: medicine.trade_name,
      prices,
      lowestPrice,
      highestPrice,
      averagePrice: Math.round(averagePrice * 100) / 100,
      priceRange: Math.round(priceRange * 100) / 100,
      savingsOpportunity: Math.round(savingsOpportunity * 100) / 100,
      priceHistory,
    };

    // Cache for 1 hour
    await cache.set(cacheKey, comparison, 3600);

    return comparison;
  }

  /**
   * Fetch prices from all pharmacies
   */
  private static async fetchPricesFromPharmacies(
    medicineId: string
  ): Promise<PharmacyPrice[]> {
    const prices: PharmacyPrice[] = [];

    // Get prices from database
    const dbPrices = await db('portal.pharmacy_prices')
      .select(
        'portal.pharmacy_prices.*',
        'portal.pharmacies.name as pharmacy_name',
        'portal.pharmacies.location',
        'portal.pharmacies.rating',
        'portal.pharmacies.delivery_available'
      )
      .leftJoin('portal.pharmacies', 'portal.pharmacy_prices.pharmacy_id', 'portal.pharmacies.id')
      .where({ 'portal.pharmacy_prices.medicine_id': medicineId })
      .where('portal.pharmacy_prices.is_active', true);

    for (const row of dbPrices) {
      prices.push({
        pharmacyId: row.pharmacy_id,
        pharmacyName: row.pharmacy_name,
        pharmacyLocation: row.location,
        price: parseFloat(row.price),
        currency: row.currency || 'EGP',
        inStock: row.in_stock,
        lastUpdated: row.updated_at,
        rating: row.rating,
        deliveryAvailable: row.delivery_available,
        deliveryFee: row.delivery_fee,
        estimatedDeliveryTime: row.estimated_delivery_time,
      });
    }

    // Fetch from external pharmacy APIs (if integrated)
    const externalPrices = await this.fetchExternalPrices(medicineId);
    prices.push(...externalPrices);

    return prices;
  }

  /**
   * Fetch prices from external pharmacy APIs
   */
  private static async fetchExternalPrices(medicineId: string): Promise<PharmacyPrice[]> {
    const externalPrices: PharmacyPrice[] = [];

    // Get medicine barcode/SKU for external lookups
    const medicine = await db('portal.medicines')
      .select('eda_number', 'barcode', 'scientific_name')
      .where({ id: medicineId })
      .first();

    // Example: Fetch from Pharmacy Chain API
    try {
      const chainApis = await db('portal.pharmacy_integrations')
        .where({ is_active: true });

      for (const api of chainApis) {
        try {
          const response = await axios.get(`${api.api_url}/prices`, {
            params: {
              eda_number: medicine.eda_number,
              barcode: medicine.barcode,
            },
            headers: {
              'Authorization': `Bearer ${api.api_key}`,
            },
            timeout: 5000,
          });

          if (response.data.price) {
            externalPrices.push({
              pharmacyId: api.pharmacy_id,
              pharmacyName: api.pharmacy_name,
              pharmacyLocation: api.location,
              price: response.data.price,
              currency: 'EGP',
              inStock: response.data.in_stock,
              lastUpdated: new Date(),
              deliveryAvailable: response.data.delivery_available,
            });
          }
        } catch (error) {
          logger.error(`Failed to fetch from ${api.pharmacy_name}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch external prices:', error);
    }

    return externalPrices;
  }

  /**
   * Calculate distances from user location
   */
  private static async calculateDistances(
    prices: PharmacyPrice[],
    userLocation: { lat: number; lng: number }
  ): Promise<PharmacyPrice[]> {
    for (const price of prices) {
      const pharmacy = await db('portal.pharmacies')
        .where({ id: price.pharmacyId })
        .first();

      if (pharmacy && pharmacy.latitude && pharmacy.longitude) {
        price.distance = this.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          pharmacy.latitude,
          pharmacy.longitude
        );
      }
    }

    return prices;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal
  }

  private static toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get price history for a medicine
   */
  static async getPriceHistory(
    medicineId: string,
    days: number = 30
  ): Promise<PriceHistoryPoint[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await db('portal.price_history')
      .select('recorded_at as date', 'price', 'pharmacy_id')
      .where({ medicine_id: medicineId })
      .where('recorded_at', '>=', startDate)
      .orderBy('recorded_at', 'asc');

    return history.map((row: any) => ({
      date: row.date,
      price: parseFloat(row.price),
      pharmacyId: row.pharmacy_id,
    }));
  }

  /**
   * Track price change
   */
  static async trackPriceChange(
    medicineId: string,
    pharmacyId: string,
    newPrice: number
  ): Promise<void> {
    const currentPrice = await db('portal.pharmacy_prices')
      .where({ medicine_id: medicineId, pharmacy_id: pharmacyId })
      .first();

    if (currentPrice && parseFloat(currentPrice.price) !== newPrice) {
      // Record price history
      await db('portal.price_history').insert({
        medicine_id: medicineId,
        pharmacy_id: pharmacyId,
        old_price: currentPrice.price,
        new_price: newPrice,
        change_percentage: ((newPrice - currentPrice.price) / currentPrice.price) * 100,
        recorded_at: new Date(),
      });

      // Update current price
      await db('portal.pharmacy_prices')
        .where({ medicine_id: medicineId, pharmacy_id: pharmacyId })
        .update({
          price: newPrice,
          updated_at: new Date(),
        });

      // Check and trigger price alerts
      await this.checkPriceAlerts(medicineId, newPrice);

      logger.info(
        `Price updated for medicine ${medicineId} at pharmacy ${pharmacyId}: ${currentPrice.price} -> ${newPrice}`
      );
    }
  }

  /**
   * Create price alert
   */
  static async createPriceAlert(
    userId: string,
    medicineId: string,
    targetPrice: number
  ): Promise<PriceAlert> {
    const comparison = await this.comparePrices(medicineId);

    const [alert] = await db('portal.price_alerts')
      .insert({
        user_id: userId,
        medicine_id: medicineId,
        target_price: targetPrice,
        current_lowest_price: comparison.lowestPrice.price,
        is_active: true,
      })
      .returning('*');

    return {
      id: alert.id,
      userId: alert.user_id,
      medicineId: alert.medicine_id,
      targetPrice: alert.target_price,
      currentLowestPrice: alert.current_lowest_price,
      isActive: alert.is_active,
    };
  }

  /**
   * Check and trigger price alerts
   */
  private static async checkPriceAlerts(medicineId: string, newPrice: number): Promise<void> {
    const alerts = await db('portal.price_alerts')
      .where({ medicine_id: medicineId, is_active: true })
      .where('target_price', '>=', newPrice);

    for (const alert of alerts) {
      // Send notification to user
      await this.notifyPriceAlert(alert, newPrice);

      // Deactivate alert
      await db('portal.price_alerts')
        .where({ id: alert.id })
        .update({ is_active: false, triggered_at: new Date() });
    }
  }

  /**
   * Notify user about price alert
   */
  private static async notifyPriceAlert(alert: any, newPrice: number): Promise<void> {
    const medicine = await db('portal.medicines')
      .where({ id: alert.medicine_id })
      .first();

    // Import notification service
    const { PushNotificationService } = await import('../notifications/pushNotification.service');

    await PushNotificationService.sendToUser(alert.user_id, {
      title: '💰 Price Alert!',
      body: `${medicine.trade_name} is now ${newPrice} EGP (target: ${alert.target_price} EGP)`,
      type: 'general',
      data: {
        medicineId: alert.medicine_id,
        price: newPrice,
      },
    });

    logger.info(`Price alert triggered for user ${alert.user_id}, medicine ${alert.medicine_id}`);
  }

  /**
   * Get best deal (considering price, distance, delivery)
   */
  static async getBestDeal(
    medicineId: string,
    userLocation: { lat: number; lng: number },
    preferences: {
      maxDistance?: number;
      includeDelivery?: boolean;
      prioritizeRating?: boolean;
    } = {}
  ): Promise<PharmacyPrice | null> {
    const comparison = await this.comparePrices(medicineId, userLocation);

    let eligiblePrices = comparison.prices.filter(p => p.inStock);

    // Apply filters
    if (preferences.maxDistance) {
      eligiblePrices = eligiblePrices.filter(
        p => !p.distance || p.distance <= preferences.maxDistance!
      );
    }

    if (!preferences.includeDelivery) {
      eligiblePrices = eligiblePrices.filter(p => !p.deliveryAvailable || p.deliveryFee === 0);
    }

    if (eligiblePrices.length === 0) {
      return null;
    }

    // Calculate score for each option
    const scored = eligiblePrices.map(price => {
      let score = 0;

      // Price score (lower is better)
      const priceScore = 100 - ((price.price - comparison.lowestPrice.price) / comparison.priceRange) * 50;
      score += priceScore * 0.5; // 50% weight

      // Distance score (closer is better)
      if (price.distance) {
        const distanceScore = 100 - Math.min(price.distance * 10, 100);
        score += distanceScore * 0.3; // 30% weight
      }

      // Rating score
      if (preferences.prioritizeRating && price.rating) {
        score += (price.rating / 5) * 100 * 0.2; // 20% weight
      }

      return { ...price, score };
    });

    // Return highest scoring option
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  }

  /**
   * Bulk price update from CSV/Excel
   */
  static async bulkUpdatePrices(pharmacyId: string, priceData: any[]): Promise<any> {
    let updated = 0;
    let inserted = 0;
    let errors = 0;

    for (const row of priceData) {
      try {
        const medicine = await db('portal.medicines')
          .where({ eda_number: row.eda_number })
          .orWhere({ barcode: row.barcode })
          .first();

        if (!medicine) {
          errors++;
          continue;
        }

        const existing = await db('portal.pharmacy_prices')
          .where({ medicine_id: medicine.id, pharmacy_id: pharmacyId })
          .first();

        if (existing) {
          await this.trackPriceChange(medicine.id, pharmacyId, row.price);
          updated++;
        } else {
          await db('portal.pharmacy_prices').insert({
            medicine_id: medicine.id,
            pharmacy_id: pharmacyId,
            price: row.price,
            currency: 'EGP',
            in_stock: row.in_stock !== false,
            is_active: true,
          });
          inserted++;
        }
      } catch (error) {
        logger.error('Error updating price:', error);
        errors++;
      }
    }

    // Clear cache
    await cache.deletePattern('prices:*');

    return {
      total: priceData.length,
      updated,
      inserted,
      errors,
    };
  }
}