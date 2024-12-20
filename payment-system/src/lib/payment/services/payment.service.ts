// src/lib/payment/services/payment.service.ts
import { 
  PaymentProviderInterface,
  CreatePaymentInput,
  PaymentResult,
  PaymentMethod,
  AddPaymentMethodInput
} from '../types/provider.types';
import { validatePaymentInput } from '../utils/validation';
import { encrypt, decrypt } from '../utils/encryption';
import { PaymentLogger } from '../utils/logger';

export class PaymentService {
  private logger: PaymentLogger;

  constructor(
    private provider: PaymentProviderInterface,
    private options: PaymentServiceOptions = {}
  ) {
    this.logger = new PaymentLogger(options.logLevel || 'info');
  }

  async processPayment(input: CreatePaymentInput): Promise<PaymentResult> {
    try {
      // Validate input
      validatePaymentInput(input);

      // Encrypt sensitive data
      const encryptedData = await this.encryptSensitiveData(input);

      // Process payment
      this.logger.info('Processing payment', { amount: input.amount });
      const result = await this.provider.createPayment(encryptedData);

      // Log result
      if (result.success) {
        this.logger.info('Payment successful', { transactionId: result.transactionId });
      } else {
        this.logger.error('Payment failed', { error: result.error });
      }

      return result;
    } catch (error) {
      this.logger.error('Payment processing error', { error });
      throw error;
    }
  }

  async getPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      const methods = await this.provider.getPaymentMethods(customerId);
      return methods.map(method => ({
        ...method,
        details: this.maskSensitiveData(method.details)
      }));
    } catch (error) {
      this.logger.error('Error fetching payment methods', { error });
      throw error;
    }
  }

  async addPaymentMethod(
    customerId: string,
    input: AddPaymentMethodInput
  ): Promise<PaymentMethod> {
    try {
      const encryptedDetails = await encrypt(input.details);
      const method = await this.provider.addPaymentMethod(customerId, {
        ...input,
        details: encryptedDetails
      });

      return {
        ...method,
        details: this.maskSensitiveData(method.details)
      };
    } catch (error) {
      this.logger.error('Error adding payment method', { error });
      throw error;
    }
  }

  async removePaymentMethod(methodId: string): Promise<void> {
    try {
      await this.provider.removePaymentMethod(methodId);
      this.logger.info('Payment method removed', { methodId });
    } catch (error) {
      this.logger.error('Error removing payment method', { error });
      throw error;
    }
  }

  private async encryptSensitiveData(data: CreatePaymentInput): Promise<CreatePaymentInput> {
    if (typeof data.paymentMethod === 'object') {
      return {
        ...data,
        paymentMethod: {
          ...data.paymentMethod,
          details: await encrypt(data.paymentMethod.details)
        }
      };
    }
    return data;
  }

  private maskSensitiveData(data: Record<string, any>): Record<string, any> {
    const masked = { ...data };
    if (masked.cardNumber) {
      masked.cardNumber = `****${masked.cardNumber.slice(-4)}`;
    }
    return masked;
  }
}

interface PaymentServiceOptions {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}