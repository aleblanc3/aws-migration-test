import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from "@angular/core";
import { provideHttpClient } from "@angular/common/http";
import { TranslateModule, TranslateLoader } from "@ngx-translate/core";
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { provideRouter, TitleStrategy } from '@angular/router';
import { CustomTitleStrategy } from './common/custom-title-strategy';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
//import Lara from '@primeng/themes/lara';
import MyPreset from './mypreset';

import { routes } from './app.routes';

const httpLoaderFactory: (http: HttpClient) => TranslateHttpLoader = (http: HttpClient) =>
  new TranslateHttpLoader(http, './i18n/', '.json');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: TitleStrategy, useClass: CustomTitleStrategy },
    provideHttpClient(),
    importProvidersFrom([TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: httpLoaderFactory,
        deps: [HttpClient],
      },
    })]),
    provideAnimationsAsync(),
    providePrimeNG({
      
      inputVariant: 'filled' , // default is outlined
      theme: {
        preset: MyPreset,
        options: {
            colorScheme: 'light', // or 'dark'
            theme: 'blue',        // or 'indigo', 'teal', etc.
            ripple: true,
            darkModeSelector: '.dark-mode'
        }
      }
    })
  ],
};