/**
 * Tipos TypeScript estritos para o módulo de faturamento.
 * Alinhados com os schemas Pydantic do backend (Sprint 7).
 */

// ---------------------------------------------------------------------------
// Enums de domínio
// ---------------------------------------------------------------------------

export type AccountStatus = 'OPEN' | 'CLOSED';

export type TransactionType = 'DEBIT' | 'CREDIT' | 'REFUND';

export type TransactionCategory =
  | 'DIARIA'
  | 'FRIGOBAR'
  | 'RESTAURANTE'
  | 'LAVANDERIA'
  | 'PAGAMENTO_ANTECIPADO'
  | 'PAGAMENTO_CHECKOUT'
  | 'OUTROS';

export type MaturityStatus = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export interface Transaction {
  id: number;
  account_id: number;
  transaction_type: TransactionType;
  category: TransactionCategory;
  amount: string; // Decimal como string para preservar precisão
  description: string;
  created_by_user_id: number;
  original_transaction_id: number | null;
  refund_reason: string | null;
  is_refunded: boolean;
  created_at: string; // ISO-8601
}

export interface Account {
  id: number;
  reservation_id: number;
  status: AccountStatus;
  total_charges: string;
  total_paid: string;
  balance: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountStatement extends Account {
  transactions: Transaction[];
}

// ---------------------------------------------------------------------------
// Request/Response DTOs
// ---------------------------------------------------------------------------

export interface TransactionCreateRequest {
  transaction_type: 'DEBIT' | 'CREDIT';
  category: TransactionCategory;
  amount: string; // Enviar como string para evitar perda de precisão float
  description: string;
}

export interface AccountCloseRequest {
  payment_amount: string;
  payment_description: string;
}

export interface AccountCloseResponse {
  id: number;
  reservation_id: number;
  status: AccountStatus;
  total_charges: string;
  total_paid: string;
  balance: string;
  change_amount: string;
  message: string;
}

export interface RefundRequest {
  reason: string;
}

export interface RefundResponse {
  refund_transaction_id: number;
  original_transaction_id: number;
  amount_refunded: string;
  reason: string;
  message: string;
}

export interface InvoiceSummary {
  account_id: number;
  reservation_id: number;
  guest_name: string | null;
  room_number: string | null;
  balance: string;
  total_charges: string;
  total_paid: string;
  due_date: string | null;
  maturity_status: MaturityStatus;
  account_status: AccountStatus;
}

// ---------------------------------------------------------------------------
// UI Helpers
// ---------------------------------------------------------------------------

/** Cor CSS e label por nível de inadimplência. */
export const MATURITY_DISPLAY: Record<
  MaturityStatus,
  { label: string; color: string; bgClass: string; borderClass: string }
> = {
  GREEN: {
    label: 'Normal',
    color: '#2e7d32',
    bgClass: 'kanban-col--green',
    borderClass: 'border-green',
  },
  YELLOW: {
    label: 'Alerta',
    color: '#f57f17',
    bgClass: 'kanban-col--yellow',
    borderClass: 'border-yellow',
  },
  ORANGE: {
    label: 'Bloqueado',
    color: '#e65100',
    bgClass: 'kanban-col--orange',
    borderClass: 'border-orange',
  },
  RED: {
    label: 'Inadimplente',
    color: '#b71c1c',
    bgClass: 'kanban-col--red',
    borderClass: 'border-red',
  },
};

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  DIARIA: 'Diária',
  FRIGOBAR: 'Frigobar',
  RESTAURANTE: 'Restaurante',
  LAVANDERIA: 'Lavanderia',
  PAGAMENTO_ANTECIPADO: 'Pagamento Antecipado',
  PAGAMENTO_CHECKOUT: 'Pagamento no Checkout',
  OUTROS: 'Outros',
};
