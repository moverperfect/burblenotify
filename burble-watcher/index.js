import puppeteer from 'puppeteer';
import testData from './testData.js';
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'message-server',
  brokers: ['broker:29092'],
});

const producer = kafka.producer();

const currentLoads = new Map();
let lastCheck = 0;

async function main() {
  await producer.connect();
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/google-chrome',
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  await new Promise((r) => setTimeout(r, 5000));

  page.on('request', (request) => {
    request.continue();
  });

  // Listen for all responses
  page.on('response', async (response) => {
    if (response.url().includes('frontend') && Date.now() - lastCheck > 5000) {
      lastCheck = Date.now();
      let body = JSON.parse(await response.text());
      // body = testData;
      if (typeof body.loads == 'undefined') return;
      const loads = body.loads;
      for (const load of loads) {
        if (load.length === 0) continue;
        const loadState = currentLoads.get(load.name);
        if (!loadState || load.time_left !== loadState.time_left) {
          currentLoads.set(load.name, { time_left: load.time_left });
          console.log('Updated load');
          for (const group of load.groups) {
            for (const jumper of group) {
              console.log(`${load.name}_${jumper.name}_${load.time_left}`);
              await producer.send({
                topic: 'loadChanges',
                messages: [
                  {
                    key: `${jumper.name}`,
                    value: JSON.stringify({
                      loadName: load.name,
                      jumperName: jumper.name,
                      timeLeft: load.time_left,
                    }),
                  },
                ],
              });
            }
          }
        }
      }
    }
  });

  await page.goto(
    'https://dzm.burblesoft.com/jmp?dz_id=531&columns=6&display_tandem=1&display_student=1&display_sport=1&display_menu=1&font_size=0'
  );
}

main();
