// Desarrollo — usado con `ng serve` y `ng build --configuration development`
// El proxy de ng serve reenvía /api a localhost:3000 (ver proxy.conf.json)
export const environment = {
  production: false,
  apiUrl: '/api'
};
