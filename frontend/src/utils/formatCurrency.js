export function formatCurrency(amount, currency = 'INR') {
  if (amount == null) return '—';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatRent(amount) {
  return `₹${amount?.toLocaleString('en-IN') || 0}/mo`;
}
