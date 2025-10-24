import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  public darkMode = signal<boolean>(false);
  public icon = signal<string>('pi pi-sun');

  constructor() { const storedTheme = localStorage.getItem('darkMode'); this.setDarkMode(storedTheme === 'true') }

  setDarkMode(enabled: boolean) {
    this.darkMode.set(enabled);
    localStorage.setItem('darkMode', String(enabled));
    document.documentElement.classList.toggle('dark-mode', enabled);
    this.icon.set(enabled ? 'pi pi-sun' : 'pi pi-moon');
    console.log(`Dark mode set to ${enabled}`);
  }

  toggle() {
    this.setDarkMode(!this.darkMode());
  }
}
