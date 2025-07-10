export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  decimals: number = 2
): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

export const formatPercentage = (
  value: number,
  decimals: number = 2
): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
};

export const formatNumber = (
  value: number,
  decimals: number = 2
): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const formatCompactNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
};

// Safe number formatter
export const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return defaultValue;
  }
  return Number(value);
};

// Safe percentage formatter
export const safePercentage = (value: any, decimals: number = 2): string => {
  const num = safeNumber(value, 0);
  return num.toFixed(decimals);
};

// Safe currency formatter
export const safeCurrency = (value: any, decimals: number = 2): string => {
  const num = safeNumber(value, 0);
  return num.toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

// Safe date formatter
export const safeDate = (value: any): string => {
  try {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString();
  } catch {
    return 'Invalid Date';
  }
};

// Safe array check
export const safeArray = (value: any): any[] => {
  return Array.isArray(value) ? value : [];
};

// Safe object check
export const safeObject = (value: any): any => {
  return value && typeof value === 'object' ? value : {};
};
export {};