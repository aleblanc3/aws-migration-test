import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TranslateModule } from "@ngx-translate/core";
import { HeaderComponent } from './template/header.component';
import { SidebarComponent } from './template/sidebar.component';
import { FooterComponent } from './template/footer.component';
import { ApiKeyComponent } from './template/api-key.component';
import { LocalStorageService } from './services/local-storage.service';
import { CustomTitleStrategy } from './common/custom-title-strategy';
import { PrimeNG } from 'primeng/config';


@Component({
  selector: 'ca-root',
  imports: [CommonModule, RouterOutlet, RouterModule, TranslateModule, HeaderComponent, SidebarComponent, FooterComponent, ApiKeyComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  CustomTitle = inject(CustomTitleStrategy);
  titleService = inject(Title);
  localStore = inject(LocalStorageService);
  private primeng = inject(PrimeNG);
  router = inject(Router);
  route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.primeng.ripple.set(true);
    //Set api key from url parameter if present then remove the param
    this.route.queryParams.subscribe(params => {
      const apiKey = params['key'];
      if (apiKey) {
        this.localStore.saveData('apiKey', apiKey);
        const allParams = { ...params };
        delete allParams['key']; //only removes key from the params
        this.router.navigate([], {
          queryParams: allParams,
          replaceUrl: true, // replaces the current history entry
        });
      }
    });
    console.log('The initial API key is: ', this.localStore.getData('apiKey'));
  }
}