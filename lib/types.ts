export interface Product {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  category?: string;
  sku_prefix?: string;
  images?: string[];
  base_price?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes?: Record<string, string>;
  image_url?: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Sale {
  id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'completed' | 'cancelled' | 'refunded';
  payment_method?: 'cash' | 'transfer' | 'card' | 'online';
  notes?: string;
  sale_date?: string;
  customer_ready_date?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  items?: SaleItem[];
  payments?: SalePayment[];
}

export interface SalePayment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: 'cash' | 'transfer' | 'card' | 'online';
  reference?: string;
  received_by?: string;
  payment_date: string;
  created_at?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  variant_id?: string;
  variant_name: string;
  variant_attributes?: Record<string, string>;
  sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at?: string;
}

export interface Purchase {
  id: string;
  supplier_name: string;
  supplier_contact?: string;
  supplier_address?: string;
  total_amount: number;
  status: 'pending' | 'ready' | 'partially_received' | 'completed' | 'cancelled';
  notes?: string;
  purchase_date?: string;
  ready_date_estimate?: string;
  ready_date_confirmed?: string;
  linked_sale_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  variant_id?: string;
  variant_name: string;
  sku: string;
  quantity: number;
  quantity_received?: number;
  unit_price: number;
  subtotal: number;
  created_at?: string;
}

export interface InventoryLog {
  id: string;
  product_id?: string;
  variant_id?: string;
  type: 'sale' | 'purchase' | 'adjustment' | 'return' | 'initial';
  quantity_change: number;
  quantity_before?: number;
  quantity_after?: number;
  reference_type?: 'sale' | 'purchase' | 'adjustment';
  reference_id?: string;
  variant_name?: string;
  sku?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  role: 'user' | 'admin';
  created_at?: string;
  updated_at?: string;
}
