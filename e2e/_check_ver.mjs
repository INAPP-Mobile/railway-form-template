import p1 from '@playwright/test/package.json' with { type: 'json' };
import p2 from 'playwright/package.json' with { type: 'json' };
console.log('@playwright/test:', p1.version);
console.log('playwright:', p2.version);
