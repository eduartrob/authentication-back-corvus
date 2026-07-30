export function normalizeUniversity(name: string): string {
  if (!name) return name;
  let normalized = name.toLowerCase().trim();
  
  // Remove accents
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Common synonyms for UPChiapas
  if (
    normalized.includes('politecnica de chiapas') ||
    normalized.includes('upchiapas') ||
    normalized === 'politecnica' ||
    normalized === 'universidad politecnica'
  ) {
    return 'Universidad Politécnica de Chiapas';
  }

  if (normalized.includes('unach') || normalized.includes('autonoma de chiapas')) {
    return 'Universidad Autónoma de Chiapas';
  }
  
  if (normalized.includes('unicach') || normalized.includes('ciencias y artes de chiapas')) {
    return 'Universidad de Ciencias y Artes de Chiapas';
  }

  if (normalized.includes('tec de monterrey') || normalized.includes('itesm')) {
    return 'Tecnológico de Monterrey';
  }

  // Capitalize first letters of each word
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeCareer(name: string): string {
  if (!name) return name;
  let normalized = name.toLowerCase().trim();
  
  // Only capitalize first letters
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}
