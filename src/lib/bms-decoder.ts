import type { DecodedBMSData, DecodedBMSDataWithRaw } from '@/types/bms';

export function decodeBMSHex(hex: string): DecodedBMSData | null {
  const clean = hex.replace(/\s+/g, '').toUpperCase();
  if (!clean) return null;

  function getUInt16(bytes: number[], idx: number): number {
    return (bytes[idx] << 8) | bytes[idx + 1];
  }

  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16));
  }
  
  const anchor = bytes.findIndex((b) => b === 0x75);
  if (anchor === -1 || anchor < 18) return null;

  try {
    const cellVoltages: number[] = [];
    let voltageSum = 0;
    for (let i = 3; i < 3 + 13 * 2; i += 2) {
      const v = getUInt16(bytes, i) / 1000;
      cellVoltages.push(v);
      voltageSum += v;
    }

    const temps: number[] = [];
    for (let i = anchor - 18; i < anchor - 10; i += 2) {
      const raw = getUInt16(bytes, i);
      temps.push(raw - 40);
    }

    const currentRaw = getUInt16(bytes, anchor - 8);
    const current =
      currentRaw === 0xFFFF || currentRaw === 0x00FF || currentRaw === 0x0000
        ? 0
        : (currentRaw - 30000) / 10;

    const avgVolt = getUInt16(bytes, anchor - 2) / 10;
    const capacity = getUInt16(bytes, anchor);
    const soc = getUInt16(bytes, anchor + 2) / 10;
    const maxCell = getUInt16(bytes, anchor + 4) / 1000;
    const minCell = getUInt16(bytes, anchor + 6) / 1000;
    const mosT1 = getUInt16(bytes, anchor + 8) - 40;
    const mosT2 = getUInt16(bytes, anchor + 10) - 40;
    const power = getUInt16(bytes, anchor + 12) / 1000;
    const remCap = getUInt16(bytes, anchor + 14) / 10;
    const cellCount = getUInt16(bytes, anchor + 16);
    const tempCount = getUInt16(bytes, anchor + 18);
    const cycles = getUInt16(bytes, anchor + 20);
    const balance = getUInt16(bytes, anchor + 22);
    const chgMos = getUInt16(bytes, anchor + 24);
    const dischgMos = getUInt16(bytes, anchor + 26);
    const avgCellVolt = getUInt16(bytes, anchor + 28) / 1000;
    
    return {
      cellVoltages,
      totalVoltage: parseFloat(voltageSum.toFixed(2)),
      avgVolt,
      current,
      soc,
      capacity,
      maxCell,
      minCell,
      temps,
      mosT1,
      mosT2,
      power,
      remCap,
      cellCount,
      tempCount,
      cycles,
      balance,
      chgMos,
      dischgMos,
      avgCellVolt,
    };
  } catch (error) {
    console.error("Error decoding BMS HEX data:", error);
    return null;
  }
}


export function decodeBMSHexWithRaw(hex: string): DecodedBMSDataWithRaw | null {
  const clean = hex.replace(/\s+/g, '').toUpperCase();
  if (!clean) return null;

  function getUInt16(bytes: number[], idx: number): number {
    return (bytes[idx] << 8) | bytes[idx + 1];
  }
  
  function getRawBytes(bytes: number[], idx: number, len: number = 2) {
      return bytes.slice(idx, idx + len);
  }

  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16));
  }
  
  const anchor = bytes.findIndex((b) => b === 0x75);
  if (anchor === -1 || anchor < 18) return null;
  
  try {
    const cellVoltages: { value: number; rawBytes: number[]; startIndex: number }[] = [];
    let voltageSum = 0;
    for (let i = 3; i < 3 + 13 * 2; i += 2) {
      const v = getUInt16(bytes, i) / 1000;
      cellVoltages.push({ value: v, rawBytes: getRawBytes(bytes, i), startIndex: i });
      voltageSum += v;
    }

    const temps: { value: number; rawBytes: number[]; startIndex: number }[] = [];
    for (let i = anchor - 18; i < anchor - 10; i += 2) {
      const raw = getUInt16(bytes, i);
      temps.push({ value: raw-40, rawBytes: getRawBytes(bytes, i), startIndex: i });
    }

    const currentRaw = getUInt16(bytes, anchor - 8);
    const current =
      currentRaw === 0xFFFF || currentRaw === 0x00FF || currentRaw === 0x0000
        ? 0
        : (currentRaw - 30000) / 10;
        
    const createField = (index: number, calc: (raw: number) => number, len: number = 2) => {
        const raw = len === 2 ? getUInt16(bytes, index) : bytes[index];
        return {
            value: calc(raw),
            rawBytes: getRawBytes(bytes, index, len),
            startIndex: index
        }
    };
    
    return {
      cellVoltages,
      totalVoltage: { value: parseFloat(voltageSum.toFixed(2)), rawBytes: [], startIndex: -1 },
      avgVolt: createField(anchor - 2, val => val / 10),
      current: { value: current, rawBytes: getRawBytes(bytes, anchor-8), startIndex: anchor-8 },
      soc: createField(anchor + 2, val => val / 10),
      capacity: createField(anchor, val => val),
      maxCell: createField(anchor + 4, val => val / 1000),
      minCell: createField(anchor + 6, val => val / 1000),
      temps,
      mosT1: createField(anchor + 8, val => val - 40),
      mosT2: createField(anchor + 10, val => val - 40),
      power: createField(anchor + 12, val => val / 1000),
      remCap: createField(anchor + 14, val => val / 10),
      cellCount: createField(anchor + 16, val => val),
      tempCount: createField(anchor + 18, val => val),
      cycles: createField(anchor + 20, val => val),
      balance: createField(anchor + 22, val => val),
      chgMos: createField(anchor + 24, val => val),
      dischgMos: createField(anchor + 26, val => val),
      avgCellVolt: createField(anchor + 28, val => val / 1000),
    };
  } catch (error) {
    console.error("Error decoding BMS HEX data:", error);
    return null;
  }
}
