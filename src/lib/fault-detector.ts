
import type { DecodedBMSData, Fault } from '@/types/bms';

// Define thresholds for fault detection
const MAX_CELL_VOLTAGE = 4.2; // Volts
const MIN_CELL_VOLTAGE = 2.8; // Volts
const MAX_TEMP = 60; // Celsius
const MIN_TEMP = 0; // Celsius
const MAX_CELL_IMBALANCE = 0.3; // Volts (300mV)
const LOW_SOC_THRESHOLD = 20; // Percent
const FULL_SOC_THRESHOLD = 99.5; // Percent

export function detectFaults(data: DecodedBMSData | undefined): Fault[] {
  if (!data) {
    return [];
  }

  const faults: Fault[] = [];

  // 1. Fully Charged
  // Trigger if SOC is >= 99.5% OR if the charging MOS is turned off while SOC is high.
  if (data.soc >= FULL_SOC_THRESHOLD || (data.chgMos === 0 && data.soc > 95)) {
    // To avoid showing both "Fully Charged" and "Low SOC" at the same time in edge cases,
    // we check if a Fully Charged alert already exists before adding a Low SOC one.
    const isAlreadyFullyCharged = faults.some(f => f.type === 'Fully Charged');
    if (!isAlreadyFullyCharged) {
        faults.push({
          type: 'Fully Charged',
          message: `Battery has reached full charge (${data.soc.toFixed(1)}%).`,
          severity: 'info',
        });
    }
  }

  // 2. Over-Voltage Protection
  if (data.maxCell > MAX_CELL_VOLTAGE) {
    faults.push({
      type: 'Over-voltage',
      message: `Cell voltage exceeds safe limit (${data.maxCell.toFixed(2)}V > ${MAX_CELL_VOLTAGE}V).`,
      severity: 'critical',
    });
  }

  // 3. Under-Voltage Protection
  if (data.minCell < MIN_CELL_VOLTAGE) {
    faults.push({
      type: 'Under-voltage',
      message: `Cell voltage is critically low (${data.minCell.toFixed(2)}V < ${MIN_CELL_VOLTAGE}V).`,
      severity: 'critical',
    });
  }

  // 4. Short-Circuit or Over-Current Protection (inferred from MOS status)
  // If both MOS are off, it implies a critical safety shutdown.
  if (data.chgMos === 0 && data.dischgMos === 0) {
     faults.push({
      type: 'Short-circuit', // This is an assumption; it covers multiple critical faults
      message: 'Full shutdown detected. Possible short-circuit, over-current, or over-heat.',
      severity: 'critical',
    });
  }

  // 5. Temperature Protection
  const maxTemp = Math.max(...data.temps, data.mosT1, data.mosT2);
  const minTemp = Math.min(...data.temps, data.mosT1, data.mosT2);

  if (maxTemp > MAX_TEMP) {
    faults.push({
      type: 'Over-heat',
      message: `Temperature is too high (${maxTemp}°C > ${MAX_TEMP}°C).`,
      severity: 'critical',
    });
  }
  if (minTemp < MIN_TEMP) {
     faults.push({
      type: 'Under-heat',
      message: `Temperature is too low (${minTemp}°C < ${MIN_TEMP}°C).`,
      severity: 'warning',
    });
  }
  
  // 6. High Cell Imbalance
  const imbalance = data.maxCell - data.minCell;
  if (imbalance > MAX_CELL_IMBALANCE) {
    faults.push({
      type: 'Cell Imbalance',
      message: `High cell imbalance detected (${(imbalance * 1000).toFixed(0)}mV > ${(MAX_CELL_IMBALANCE * 1000).toFixed(0)}mV).`,
      severity: 'warning',
    });
  }

  // 7. Low State of Charge (SOC) - only if not fully charged
  // Avoid showing low SOC if it's already considered fully charged.
  if (data.soc < LOW_SOC_THRESHOLD && !faults.some(f => f.type === 'Fully Charged')) {
    faults.push({
      type: 'Low SOC',
      message: `Battery charge is low (${data.soc.toFixed(1)}%).`,
      severity: 'info',
    });
  }

  return faults;
}
