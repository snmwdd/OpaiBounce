import base from './playwright.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,testIgnore:[],testMatch:'paint-cost.spec.ts',use:{...base.use,launchOptions:{args:['--disable-gpu']}},reporter:[['list']]});
