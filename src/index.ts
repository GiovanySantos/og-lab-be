import { createApp } from './app.js';

const port = Number(process.env['PORT'] ?? 3000);

createApp().listen(port, () => {
  console.info(`Server running at http://localhost:${String(port)}`);
});
