import { definePreset } from '@primeng/themes';
import Lara from '@primeng/themes/lara';
import Aura from '@primeng/themes/aura';
import Nora from '@primeng/themes/nora';
import Material from '@primeng/themes/material';

const MyPreset = definePreset(Material, {
    semantic: {
        primary: {
            50: '#f3e9fa',
            100: '#dfc7f2',
            200: '#c59ae8',
            300: '#a96ddd',
            400: '#8f47d3',
            500: '#6e2ea7', // base color from project assistant
            600: '#5a248c',
            700: '#491b71',
            800: '#391356',
            900: '#2a0c3c',
            950: '#1d0728',
        },
    },
    primitive: {
        green: { //success 
            50: '#e6f8f8',
            100: '#bdeee9',
            200: '#91e0db',
            300: '#64d1cd',
            400: '#3abfbe',
            500: '#00adae', // base
            600: '#00939c',
            700: '#007780',
            800: '#005d65',
            900: '#00464b',
            950: '#002e30',
        },
        red: { //danger
            50: '#ffe5e8',
            100: '#ffb8c4',
            200: '#ff8aa0',
            300: '#ff5c7c',
            400: '#ff3860',
            500: '#ff0034', // base
            600: '#e6002e',
            700: '#b40026',
            800: '#86001c',
            900: '#5a0014',
            950: '#2f000a',
        },
        orange: { //warn
            50: '#fff2e6',
            100: '#ffd9b8',
            200: '#ffc08a',
            300: '#ffa85c',
            400: '#ff8f36',
            500: '#ff7700', // base
            600: '#e66a00',
            700: '#b35600',
            800: '#854200',
            900: '#592e00',
            950: '#2f1700',
        },
        blue: { //info
            50: '#e6f0ff',
            100: '#b8d4ff',
            200: '#8ab8ff',
            300: '#5c9cff',
            400: '#387fff',
            500: '#0063ff', // base
            600: '#0057e6',
            700: '#0046b4',
            800: '#003386',
            900: '#001f59',
            950: '#000f2f',
        },
        purple: { //help
            50: '#fde6f5',
            100: '#f9b8df',
            200: '#f38acc',
            300: '#ec5cb8',
            400: '#e436a9',
            500: '#d90097', // base
            600: '#b70082',
            700: '#8a0063',
            800: '#610046',
            900: '#3b0029',
            950: '#1d0014',
        },
        bluegray: { //help
            50: '#fde6f5',
            100: '#f9b8df',
            200: '#f38acc',
            300: '#ec5cb8',
            400: '#e436a9',
            500: '#d90097', // base
            600: '#b70082',
            700: '#8a0063',
            800: '#610046',
            900: '#3b0029',
            950: '#1d0014',
        },
    },
    dark: {
        primary: {
            50: '#1d0728',
            100: '#2a0c3c',
            200: '#391356',
            300: '#491b71',
            400: '#5a248c',
            500: '#6e2ea7',  // base color from project assistant
            600: '#8f47d3',
            700: '#a96ddd',
            800: '#c59ae8',
            900: '#dfc7f2',
            950: '#f3e9fa',
        },
    }
});
export default MyPreset;