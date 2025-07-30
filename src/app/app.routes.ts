import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { LandingComponent } from './views/static/landing.component';
import { NotFoundComponent } from './views/static/not-found.component';
import { PageAssistantUploadComponent } from './views/page-assistant/components/page-assistant-upload.component';
import { UploadStateService } from './views/page-assistant/services/upload-state.service';
import { ImageAssistantComponent } from './views/image-assistant/image-assistant.component';
import { TranslationAssistantComponent } from './views/translation-assistant/translation-assistant.component';
import { ProjectAssistantComponent } from './views/project-assistant/project-assistant.component';
import { InventoryAssistantComponent } from './views/inventory-assistant/inventory-assistant.component';
import { AboutComponent } from './views/static/about.component';
import { TestComponent } from './views/my-test/test.component';

export const routes: Routes = [
    {
        path: '',
        component: LandingComponent,
        title: 'title.landing',
        data: { lang: 'en' },
    },
    {
        path: 'fr',
        component: LandingComponent,
        title: 'title.landing',
        data: { lang: 'fr' },
    },
    {
        path: 'page-assistant/compare',
        title: 'title.page',
        canActivate: [() => {
            const uploadState = inject(UploadStateService);
            const router = inject(Router);

            if (!uploadState.getUploadData()) {
                router.navigate(['/page-assistant']);
                return false;
            }

            return true;
        }],
        loadComponent: () => import('./views/page-assistant/page-assistant.component')
            .then(m => m.PageAssistantCompareComponent)

    },
    {
        path: 'page-assistant',
        component: PageAssistantUploadComponent,
        title: 'title.page',
        data: { lang: 'en' },
    },
    {
        path: 'image-assistant',
        component: ImageAssistantComponent,
        title: 'title.image',
        data: { lang: 'en' },
    },
    {
        path: 'translation-assistant',
        component: TranslationAssistantComponent,
        title: 'title.translation',
        data: { lang: 'en' },
    },
    {
        path: 'project-assistant',
        component: ProjectAssistantComponent,
        title: 'title.project',
        data: { lang: 'en' },
    },
    {
        path: 'inventory-assistant',
        component: InventoryAssistantComponent,
        title: 'title.inventory',
        data: { lang: 'en' },
    },
    {
        path: 'about-us',
        component: AboutComponent,
        title: 'title.about',
        data: { lang: 'en' },
    },
    {
        path: 'test',
        component: TestComponent,
        title: 'title.test',
        data: { lang: 'en' },
    },
    {
        path: '**',
        component: NotFoundComponent,
        title: 'title.404',
    },
];
export default routes;
