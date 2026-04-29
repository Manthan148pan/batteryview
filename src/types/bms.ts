
export interface RawBMSDevice {
  available: boolean;
  connect: boolean;
  device_name: string;
  hex_data: string;
  last_seen: number;
  mac_address: string;
  deviceNickname?: string;
}

export interface DecodedBMSData {
  cellVoltages: number[];
  totalVoltage: number;
  avgVolt: number;
  current: number;
  soc: number;
  capacity: number;
  maxCell: number;
  minCell: number;
  temps: number[];
  mosT1: number;
  mosT2: number;
  power: number;
  remCap: number;
  cellCount: number;
  tempCount: number;
  cycles: number;
  balance: number;
  chgMos: number;
  dischgMos: number;
  avgCellVolt: number;
}

export type DecodedField<T> = {
  value: T;
  rawBytes: number[];
  startIndex: number;
};

export interface DecodedBMSDataWithRaw {
    cellVoltages: DecodedField<number>[];
    totalVoltage: DecodedField<number>;
    avgVolt: DecodedField<number>;
    current: DecodedField<number>;
    soc: DecodedField<number>;
    capacity: DecodedField<number>;
    maxCell: DecodedField<number>;
    minCell: DecodedField<number>;
    temps: DecodedField<number>[];
    mosT1: DecodedField<number>;
    mosT2: DecodedField<number>;
    power: DecodedField<number>;
    remCap: DecodedField<number>;
    cellCount: DecodedField<number>;
    tempCount: DecodedField<number>;
    cycles: DecodedField<number>;
    balance: DecodedField<number>;
    chgMos: DecodedField<number>;
    dischgMos: DecodedField<number>;
    avgCellVolt: DecodedField<number>;
}

export interface Fault {
  type: 'Over-voltage' | 'Under-voltage' | 'Over-current' | 'Short-circuit' | 'Over-heat' | 'Under-heat' | 'Cell Imbalance' | 'Low SOC' | 'Fully Charged';
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface BMSDevice {
  id: string; // MAC address
  available: boolean;
  connect: boolean;
  device_name: string;
  hex_data: string;
  last_seen: number;
  mac_address: string;
  deviceNickname?: string;
  decodedData?: DecodedBMSData;
  gatewayId?: string; // Which gateway discovered this BMS
  faults?: Fault[];
}

export interface ClaimedDevice {
  id: string;
  assigned_name: string;
  location: string;
  scooter_no?: string;
}

export interface SubscriptionInfo {
  status: 'active' | 'past_due' | 'unpaid' | 'trialing';
  current_period_end: number;
  plan_type: 'per_battery';
  price_per_unit: number; // e.g., 30
  currency: 'INR';
  customer_id?: string;
}

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  batteryCount: number;
  billingPeriod: string;
}
