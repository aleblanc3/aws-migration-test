import { definePreset } from '@primeng/themes';
import Lara from '@primeng/themes/lara';
import Aura from '@primeng/themes/aura';
import Nora from '@primeng/themes/nora';
import Material from '@primeng/themes/material';

const MyPreset = definePreset(Material, {
    semantic: {
        primary: {
            50: '#f9f2fd',
            100: '#ecd9f8',
            200: '#dabaf2',
            300: '#c393e8',
            400: '#a36adc', // 4.76 vs black
            500: '#7636ab', // 7.27 vs white
            600: '#5e298a',
            700: '#4a1f6c',
            800: '#35154d',
            900: '#210c30',
            950: '#13051b',
        },
    },
    primitive: {
        green: { //success 
            50: '#e6f8f8',
            100: '#bdeee9',
            200: '#91e0db',
            300: '#64d1cd',
            400: '#3fc9c7', // 9.60 vs black
            500: '#00706f', // 5.92 vs white
            600: '#005b59',
            700: '#004644',
            800: '#003130',
            900: '#001e1e',
            950: '#001010',
        },
        red: { //danger
            50: '#ffe5e8',
            100: '#ffb8c4',
            200: '#ff8aa0',
            300: '#ff5c7c',
            400: '#ff5572', // 6.38 vs black
            500: '#c50028', // 6.16 vs white
            600: '#a80023',
            700: '#85001b',
            800: '#620014',
            900: '#40000d',
            950: '#200006',
        },
        orange: { //warn
            50: '#fff4e8',
            100: '#ffe0c2',
            200: '#ffcb99',
            300: '#ffb470',
            400: '#ff9844', // 8.81 vs black
            500: '#e66411', // 3.38 vs white
            600: '#ba500e',
            700: '#8f3d0a',
            800: '#652a07',
            900: '#3c1803',
            950: '#200c01',
        },
        sky: { //info
            50: '#e6f7fc',
            100: '#b3e6f7',
            200: '#80d4f2',
            300: '#4dbfea',
            400: '#1aaae2', // 7.10 vs black
            500: '#0794d3', // 3.39 vs white
            600: '#0678ab',
            700: '#055c83',
            800: '#03405b',
            900: '#022433',
            950: '#01131c',
        },
        purple: { //help
            50: '#fde6f5',
            100: '#f9b8df',
            200: '#f38acc',
            300: '#ec5cb8',
            400: '#e24aae', // 5.62 vs black
            500: '#a80078', // 7.15 vs white
            600: '#870061',
            700: '#66004b',
            800: '#470034',
            900: '#2a001f',
            950: '#14000e',
        },
    },
    dark: {
        primary: {
            50: '#13051b',
            100: '#210c30',
            200: '#35154d',
            300: '#4a1f6c',
            400: '#5e298a',
            500: '#7636ab', // base
            600: '#a36adc',
            700: '#c393e8',
            800: '#dabaf2',
            900: '#ecd9f8',
            950: '#f9f2fd',
        },
    }
});
export default MyPreset;