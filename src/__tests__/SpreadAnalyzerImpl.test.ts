import 'reflect-metadata';
import SpreadAnalyzer from '../SpreadAnalyzer';
import { Broker, QuoteSide, ConfigStore } from '../types';
import * as _ from 'lodash';
import Quote from '../types';
import { options } from '../logger';
import { toQuote } from '../util';
options.enabled = false;

const config = require('./config_test.json');
config.maxSize = 0.5;
const configStore = { config } as ConfigStore;
const positionMap = {
  Coincheck: {
    allowedLongSize: 10,
    allowedShortSize: 10,
    longAllowed: true,
    shortAllowed: true
  },
  Quoine: {
    allowedLongSize: 10,
    allowedShortSize: 10,
    longAllowed: true,
    shortAllowed: true
  }
};

let quotes = [
  toQuote('Coincheck', QuoteSide.Ask, 3, 1),
  toQuote('Coincheck', QuoteSide.Bid, 2, 2),
  toQuote('Quoine', QuoteSide.Ask, 3.5, 3),
  toQuote('Quoine', QuoteSide.Bid, 2.5, 4)
];

describe('Spread Analyzer', () => {
  test('analyze', async () => {
    const target = new SpreadAnalyzer(configStore);
    const result = await target.analyze(quotes, positionMap);
    expect(result.bestAsk.broker).toBe('Coincheck');
    expect(result.bestAsk.price).toBe(3);
    expect(result.bestAsk.volume).toBe(1);
    expect(result.bestBid.broker).toBe('Quoine');
    expect(result.bestBid.price).toBe(2.5);
    expect(result.bestBid.volume).toBe(4);
    expect(result.invertedSpread).toBe(-0.5);
    expect(result.targetVolume).toBe(0.5);
    expect(result.targetProfit).toBeCloseTo(0);
  });

  test('analyze positive profit', async () => {
    quotes = [
      toQuote('Coincheck', QuoteSide.Ask, 300000, 1),
      toQuote('Coincheck', QuoteSide.Bid, 200000, 2),
      toQuote('Quoine', QuoteSide.Ask, 350000, 3),
      toQuote('Quoine', QuoteSide.Bid, 360000, 4)
    ];
    const target = new SpreadAnalyzer(configStore);
    const result = await target.analyze(quotes, positionMap);
    expect(result.bestAsk.broker).toBe('Coincheck');
    expect(result.bestAsk.price).toBe(300000);
    expect(result.bestAsk.volume).toBe(1);
    expect(result.bestBid.broker).toBe('Quoine');
    expect(result.bestBid.price).toBe(360000);
    expect(result.bestBid.volume).toBe(4);
    expect(result.invertedSpread).toBe(60000);
    expect(result.targetVolume).toBe(0.5);
    expect(result.targetProfit).toBe(30000);
  });

  test('analyze positive profit with too small quotes', async () => {
    quotes = [
      toQuote('Coincheck', QuoteSide.Ask, 300000, 1),
      toQuote('Coincheck', QuoteSide.Bid, 200000, 2),
      toQuote('Coincheck', QuoteSide.Ask, 100000, 0.0099),
      toQuote('Quoine', QuoteSide.Ask, 350000, 3),
      toQuote('Quoine', QuoteSide.Bid, 360000, 4)
    ];
    const target = new SpreadAnalyzer(configStore);
    const result = await target.analyze(quotes, positionMap);
    expect(result.bestAsk.broker).toBe('Coincheck');
    expect(result.bestAsk.price).toBe(300000);
    expect(result.bestAsk.volume).toBe(1);
    expect(result.bestBid.broker).toBe('Quoine');
    expect(result.bestBid.price).toBe(360000);
    expect(result.bestBid.volume).toBe(4);
    expect(result.invertedSpread).toBe(60000);
    expect(result.targetVolume).toBe(0.5);
    expect(result.targetProfit).toBe(30000);
  });

  test('analyze positive profit with commission', async () => {
    config.brokers[2].commissionPercent = 0.05;
    quotes = [
      toQuote('Coincheck', QuoteSide.Ask, 300000, 1),
      toQuote('Coincheck', QuoteSide.Bid, 200000, 2),
      toQuote('Quoine', QuoteSide.Ask, 350000, 3),
      toQuote('Quoine', QuoteSide.Bid, 360000, 4)
    ];
    const target = new SpreadAnalyzer(configStore);
    const result = await target.analyze(quotes, positionMap);
    expect(result.bestAsk.broker).toBe('Coincheck');
    expect(result.bestAsk.price).toBe(300000);
    expect(result.bestAsk.volume).toBe(1);
    expect(result.bestBid.broker).toBe('Quoine');
    expect(result.bestBid.price).toBe(360000);
    expect(result.bestBid.volume).toBe(4);
    expect(result.invertedSpread).toBe(60000);
    expect(result.targetVolume).toBe(0.5);
    expect(result.targetProfit).toBe(29910);
  });

  test('analyze with no position map', async () => {
    const target = new SpreadAnalyzer(configStore);
    try {
      const result = await target.analyze(quotes, {});
    } catch (ex) {
      expect(ex.message).toBe('Position map is empty.');
      return;
    }
    throw new Error();
  });

  test('analyze with no best bid', async () => {
    quotes = [
      toQuote('Coincheck', QuoteSide.Ask, 3, 1),
      toQuote('Quoine', QuoteSide.Ask, 3.5, 3)
    ];
    const target = new SpreadAnalyzer(configStore);
    try {
      const result = await target.analyze(quotes, positionMap);
    } catch (ex) {
      expect(ex.message).toBe('No best bid was found.');
      return;
    }
    throw new Error();
  });

  test('analyze with no best ask', async () => {
    quotes = [
      toQuote('Coincheck', QuoteSide.Bid, 3, 1),
      toQuote('Quoine', QuoteSide.Bid, 3.5, 3)
    ];
    const target = new SpreadAnalyzer(configStore);
    try {
      const result = await target.analyze(quotes, positionMap);
    } catch (ex) {
      expect(ex.message).toBe('No best ask was found.');
      return;
    }
    throw new Error();
  });

  test('invalid closingPairs', async () => {
    quotes = [
      toQuote('Coincheck', QuoteSide.Bid, 3, 1),
      toQuote('Quoine', QuoteSide.Bid, 3.5, 3)
    ];
    const target = new SpreadAnalyzer(configStore);
    try {
      const result = await target.analyze(quotes, positionMap, [{size: 0.001}, {size: 0.002}]);
    } catch (ex) {
      expect(ex.message).toBe('Invalid closing pair.');
      return;
    }
    throw new Error();
  });
});