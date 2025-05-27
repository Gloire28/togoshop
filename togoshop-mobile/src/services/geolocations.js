import * as Location from 'expo-location';

// Fonction pour obtenir la position actuelle de l'utilisateur
const getCurrentLocation = async () => {
  try {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission de localisation refusée');
    }

    let location = await Location.getCurrentPositionAsync({});
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    throw new Error('Erreur lors de la récupération de la localisation');
  }
};

// Fonction pour calculer la distance entre deux points (en km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance en km
};

// Fonction pour trier les supermarchés par proximité
const sortByProximity = async (supermarkets) => {
  try {
    const userLocation = await getCurrentLocation();
    return supermarkets
      .map((supermarket) => {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          supermarket.latitude,
          supermarket.longitude
        );
        return { ...supermarket, distance };
      })
      .sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error(error.message);
    return supermarkets; // Retourne la liste non triée en cas d'erreur
  }
};

// Fonction pour calculer la distance jusqu'à un site spécifique
const getDistanceToSite = async (site) => {
  try {
    const userLocation = await getCurrentLocation();
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      site.latitude,
      site.longitude
    );
    return distance;
  } catch (error) {
    console.error(error.message);
    return null;
  }
};

export { getCurrentLocation, calculateDistance, sortByProximity, getDistanceToSite };