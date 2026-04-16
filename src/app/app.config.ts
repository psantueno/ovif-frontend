import { ApplicationConfig, InjectionToken } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';

// 👉 Interceptor JWT
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { environment } from '../environments/environment';

// 🔹 Token para la URL de la API
export const API_URL = new InjectionToken<string>('API_URL');

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor]) // 👈 token automático en requests
    ),
    { provide: API_URL, useValue: environment.apiUrl }
  ]
};
