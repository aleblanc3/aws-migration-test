import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  public darkMode = signal<boolean>(false);

  constructor() { const storedTheme = localStorage.getItem('darkMode'); this.setDarkMode(storedTheme === 'true') }

  setDarkMode(enabled: boolean) {
    this.darkMode.set(enabled);
    localStorage.setItem('darkMode', String(enabled));
    document.documentElement.classList.toggle('dark-mode', enabled);
    console.log(`Dark mode set to ${enabled}`);
  }

  toggle() {
    this.setDarkMode(!this.darkMode());
  }
}
