// Producción — usado con `ng build` (default) o `ng build --configuration production`
export const environment = {
  production: true,
  apiUrl: '/api'   // Relativo: nginx hace proxy_pass a Node.js
};
