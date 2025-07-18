import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService, LangChangeEvent } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

// PrimeNG UI modules
import { PanelMenuModule } from 'primeng/panelmenu';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'ca-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    PanelMenuModule,
    ButtonModule
  ],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnDestroy {
  // Array to hold translated menu items
  items: MenuItem[] = [];

  // Subscription to handle language change events
  private langChangeSub!: Subscription;

  constructor(private translate: TranslateService) { }

  ngOnInit() {
    // Load initial translations
    this.loadTranslations();

    // Re-load translations whenever the language changes
    this.langChangeSub = this.translate.onLangChange.subscribe(
      (event: LangChangeEvent) => {
        this.loadTranslations();
      }
    );
  }

  /**
   * Fetches translations and builds the sidebar menu items
   */
  private loadTranslations(): void {
    this.translate
      .get([
        'title.landing',
        'title.page',
        'title.image',
        'title.translation',
        'title.project',
        'title.inventory',
        'title.about',
        'feedback.email',
        'menu.feedback'
      ])
      .subscribe(translations => {
        this.items = [
          {
            label: translations['title.landing'],
            items: [
              {
                label: translations['title.page'],
                routerLink: ['/page-assistant'],
                icon: 'pi pi-file'
              },
              {
                label: translations['title.image'],
                routerLink: ['/image-assistant'],
                icon: 'pi pi-image'
              },
              {
                label: translations['title.translation'],
                routerLink: ['/translation-assistant'],
                icon: 'pi pi-globe'
              }
            ]
          },
          {
            label: translations['title.project'],
            items: [
              {
                label: translations['title.inventory'],
                routerLink: ['/inventory-assistant'],
                icon: 'pi pi-check-square'
              }
            ]
          },
          {
            label: translations['menu.feedback'],
            url: `${translations['feedback.email']}`,
            icon: 'pi pi-envelope',
            target: '_self' // Ensures it doesn't open in a new tab
          },
          {
            label: translations['title.about'],
            routerLink: ['/about-us'],
            icon: 'pi pi-info-circle'
          }
        ];
      });
  }

  ngOnDestroy(): void {
    // Unsubscribe to avoid memory leaks
    if (this.langChangeSub) {
      this.langChangeSub.unsubscribe();
    }
  }
}
