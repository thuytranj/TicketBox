export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  orderInfo: string;
  returnUrl: string;
  ipnUrl: string;
  ipAddress?: string;
}

export interface PaymentUrlResult {
  payUrl: string;
  deeplink?: string;
  qrCodeUrl?: string;
}

export interface WebhookVerifyResult {
  isValid: boolean;
  orderId: string;
  transactionId: string;
  amount: number;
  resultCode: number | string;
  message: string;
}

export interface IPaymentGateway {
  createPaymentUrl(params: CreatePaymentParams): Promise<PaymentUrlResult>;
  verifyWebhook(payload: Record<string, any>): WebhookVerifyResult;
}
