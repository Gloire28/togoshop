const B2 = require('backblaze-b2');

const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_KEY_ID,
  applicationKey: process.env.BACKBLAZE_APPLICATION_KEY,
});

exports.uploadFile = async (fileName, fileBuffer, mimeType) => {
  try {
    await b2.authorize();
    console.log('Authentification Backblaze réussie pour upload:', {
      keyId: process.env.BACKBLAZE_KEY_ID,
      bucketId: process.env.BACKBLAZE_BUCKET_ID,
    });

    const response = await b2.getUploadUrl({
      bucketId: process.env.BACKBLAZE_BUCKET_ID,
    });

    const uploadResponse = await b2.uploadFile({
      uploadUrl: response.data.uploadUrl,
      uploadAuthToken: response.data.authorizationToken,
      fileName: fileName,
      data: fileBuffer,
      mime: mimeType,
    });
    console.log('Upload réussi, fichier:', fileName); // Débogage

    // Obtenir l'autorisation de téléchargement
    const signedUrlResponse = await b2.getDownloadAuthorization({
      bucketId: process.env.BACKBLAZE_BUCKET_ID,
      fileNamePrefix: fileName,
      validDurationInSeconds: 604800, // 1 semaine
    });
    console.log('Réponse getDownloadAuthorization upload:', signedUrlResponse.data);

    const { authorizationToken } = signedUrlResponse.data;
    if (!authorizationToken) throw new Error('Aucun authorizationToken généré');

    // Construire l'URL signée selon la syntaxe Backblaze
    const baseDownloadUrl = `https://f003.backblazeb2.com/file/${process.env.BACKBLAZE_BUCKET_NAME}/${fileName}`;
    const signedUrl = `${baseDownloadUrl}?Authorization=${encodeURIComponent(authorizationToken)}`; // Syntaxe corrigée
    console.log('URL signée construite upload:', signedUrl);

    return signedUrl; // Retourner l'URL signée
  } catch (error) {
    console.error('Erreur Backblaze uploadFile:', error.response?.data || error.message);
    throw new Error(`Échec de l'upload: ${error.message}`);
  }
};

exports.getSignedUrl = async (fileUrl) => {
  try {
    await b2.authorize();
    console.log('Authentification Backblaze réussie pour getSignedUrl:', {
      keyId: process.env.BACKBLAZE_KEY_ID,
      bucketId: process.env.BACKBLAZE_BUCKET_ID,
    });

    const fileName = fileUrl.split('/').pop().split('?')[0]; // Extraire le nom du fichier sans paramètres

    const signedUrlResponse = await b2.getDownloadAuthorization({
      bucketId: process.env.BACKBLAZE_BUCKET_ID,
      fileNamePrefix: fileName,
      validDurationInSeconds: 604800,
    });
    console.log('Réponse getDownloadAuthorization getSignedUrl:', signedUrlResponse.data);

    const { authorizationToken } = signedUrlResponse.data;
    if (!authorizationToken) throw new Error('Aucun authorizationToken récupéré');

    const baseDownloadUrl = `https://f003.backblazeb2.com/file/${process.env.BACKBLAZE_BUCKET_NAME}/${fileName}`;
    const signedUrl = `${baseDownloadUrl}?Authorization=${encodeURIComponent(authorizationToken)}`; // Syntaxe corrigée
    console.log('Nouvelle URL signée générée:', signedUrl); // Débogage

    return signedUrl; // Retourner une URL signée fraîche
  } catch (error) {
    console.error('Erreur Backblaze getSignedUrl:', error.response?.data || error.message);
    throw new Error(`Échec de la récupération de l'URL signée: ${error.message}`);
  }
};