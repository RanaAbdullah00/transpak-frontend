/** Truck categories for load posting — value sent to API matches backend fare multipliers. */
export const VEHICLE_TYPES = [
  {
    value: 'Flatbed',
    icon: 'flatbed',
    en: { label: 'Flatbed Truck', use: 'Steel, machinery, oversized pallets', capacity: '20–25 tons' },
    ur: { label: 'فلیٹ بیڈ ٹرک', use: 'لوہا، مشینری، بڑے پیلٹ', capacity: '20–25 ٹن' }
  },
  {
    value: 'Container',
    icon: 'container',
    en: { label: 'Container Truck', use: 'Sealed export/import boxes', capacity: '20–40 ft container' },
    ur: { label: 'کنٹینر ٹرک', use: 'برآمد/درآمد بند ڈبے', capacity: '20–40 فٹ کنٹینر' }
  },
  {
    value: 'Reefer',
    icon: 'reefer',
    en: { label: 'Reefer (Cold)', use: 'Fruit, meat, dairy, medicines', capacity: '15–20 tons cooled' },
    ur: { label: 'ریفر (ٹھنڈا)', use: 'پھل، گوشت، دوائیں', capacity: '15–20 ٹن ٹھنڈا' }
  },
  {
    value: 'Tanker',
    icon: 'tanker',
    en: { label: 'Oil Tanker', use: 'Fuel, chemicals (licensed only)', capacity: 'Tank volume varies' },
    ur: { label: 'آئل ٹینکر', use: 'ایندھن، کیمیکل (لائسنس)', capacity: 'ٹینک سائز مختلف' }
  },
  {
    value: 'Trailer',
    icon: 'trailer',
    en: { label: 'Trailer', use: 'Long haul, heavy bulk cargo', capacity: '30–40 tons' },
    ur: { label: 'ٹریلر', use: 'لمبی سڑک، بھاری مال', capacity: '30–40 ٹن' }
  },
  {
    value: 'Dumper',
    icon: 'dumper',
    en: { label: 'Dumper', use: 'Sand, gravel, construction debris', capacity: '10–15 tons' },
    ur: { label: 'ڈمپر', use: 'ریت، بجری، ملبہ', capacity: '10–15 ٹن' }
  },
  {
    value: 'Mazda',
    icon: 'mazda',
    en: { label: 'Mazda / Medium', use: 'City-to-city general goods', capacity: '3–5 tons' },
    ur: { label: 'مازدا', use: 'شہروں کے درمیان عام مال', capacity: '3–5 ٹن' }
  },
  {
    value: 'Pickup',
    icon: 'pickup',
    en: { label: 'Pickup', use: 'Small parcels, shop deliveries', capacity: '1–1.5 tons' },
    ur: { label: 'پک اپ', use: 'چھوٹے پارسل، دکان کی ڈیلیوری', capacity: '1–1.5 ٹن' }
  },
  {
    value: 'Mini Loader',
    icon: 'loader',
    en: { label: 'Mini Loader', use: 'Warehouses, short urban trips', capacity: '2–3 tons' },
    ur: { label: 'منی لوڈر', use: 'گودام، شہر کے اندر', capacity: '2–3 ٹن' }
  },
  {
    value: 'Truck',
    icon: 'truck',
    en: { label: 'Standard Truck', use: 'General freight, most loads', capacity: '10–15 tons' },
    ur: { label: 'معیاری ٹرک', use: 'عام مال، زیادہ تر لوڈ', capacity: '10–15 ٹن' }
  },
  {
    value: '10 Wheeler',
    icon: 'wheeler10',
    en: { label: '10 Wheeler', use: 'Heavy goods on highways', capacity: '18–22 tons' },
    ur: { label: '10 وہیلر', use: 'بھاری مال، شاہراہ', capacity: '18–22 ٹن' }
  },
  {
    value: '22 Wheeler',
    icon: 'wheeler22',
    en: { label: '22 Wheeler', use: 'Maximum legal axle load', capacity: '35+ tons' },
    ur: { label: '22 وہیلر', use: 'زیادہ سے زیادہ بوجھ', capacity: '35+ ٹن' }
  }
];

export function getVehicleTypeMeta(value) {
  return VEHICLE_TYPES.find((v) => v.value === value) || VEHICLE_TYPES.find((v) => v.value === 'Truck');
}

/** Localized short label for filters, badges, and selects. */
export function getVehicleTypeLabel(value, locale = 'en') {
  const item = getVehicleTypeMeta(value);
  const lang = locale === 'ur' ? 'ur' : 'en';
  const meta = item?.[lang] || item?.en;
  return meta?.label || item?.value || String(value || 'Truck');
}
