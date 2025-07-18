import { definePreset } from '@primeng/themes';
import Lara from '@primeng/themes/lara';

const MyPreset = definePreset(Lara, {
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