import {defineConfig} from '@playwright/test';
export default defineConfig({
    testDir:'./tests',testIgnore:'paint-cost.spec.ts', timeout:30000, workers:1,
    use:{baseURL:'http://127.0.0.1:4173',viewport:{width:2000,height:1100},channel:'chrome',headless:true},
    webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:true},
    reporter:[['list'],['json',{outputFile:'reports/browser-results.json'}]],
});
