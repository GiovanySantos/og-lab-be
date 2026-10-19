import express from 'express';
import { createServer } from 'node:http';

describe('application entry point', () => {
  const originalPort = process.env['PORT'];
  const portCases: ReadonlyArray<{
    label: string;
    port: string | undefined;
    expectedPort: number;
  }> = [
    { label: 'the default port', port: undefined, expectedPort: 3000 },
    { label: 'the configured port', port: '4317', expectedPort: 4317 },
  ];

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env['PORT'];
    } else {
      process.env['PORT'] = originalPort;
    }

    jest.resetModules();
    jest.dontMock('../app.js');
  });

  it.each(portCases)(
    'starts the application on $label',
    ({ port, expectedPort }) => {
      const app = express();
      const listen = jest
        .spyOn(app, 'listen')
        .mockReturnValue(createServer());

      if (port === undefined) {
        delete process.env['PORT'];
      } else {
        process.env['PORT'] = port;
      }

      jest.isolateModules(() => {
        jest.doMock('../app.js', () => ({
          createApp: () => app,
        }));
        jest.requireActual('../index.js');
      });

      expect(listen).toHaveBeenCalledWith(expectedPort);
    },
  );
});
