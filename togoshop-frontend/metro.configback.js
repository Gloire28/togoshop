const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ajouter des extensions d'assets
config.resolver.assetExts.push('ttf', 'json');

// Optimisation du transformer
config.transformer.enableBabelRCLookup = true;
config.transformer.minifierConfig = {
  mangle: true,
  compress: { unused: true, warnings: false },
};

// Amélioration de la résolution des modules
config.resolver.sourceExts.push('cjs', 'mjs');

// Simplifier le cache (Metro 0.80.0 gère mieux le cache par défaut)
config.cacheVersion = '1.0'; // Forcer une version pour le cache
config.resetCache = true; // Réinitialiser le cache à chaque démarrage

module.exports = config;